import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { auditLogs, contentProviders, providerRequirements, providerSubmissions } from "@/infrastructure/database/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors";
import { providerStateMachine, type ProviderStatus } from "@/core/state-machines";
import { publishEvent } from "@/core/events";
import { changeStatusSchema, createProviderSchema, parseInput, reviewSubmissionSchema } from "../validations";
import { evaluateReadiness, itemState } from "../domain/readiness";
import { listRequirements } from "./requirements";

/** من قام بالإجراء (مدير المنصة). يُسجَّل في audit_logs. */
export interface Actor {
  userId: string | null;
  email: string;
}

/** المنفّذ عند الإيقاف التلقائي المجدول. */
export const SYSTEM_ACTOR: Actor = { userId: null, email: "system" };

const ENTITY = "content_provider";

async function audit(executor: DbExecutor, actor: Actor, action: string, providerId: string, newValues: Record<string, unknown>, oldValues?: Record<string, unknown>) {
  await executor.insert(auditLogs).values({
    storeId: null,
    userId: actor.userId,
    action,
    entityType: ENTITY,
    entityId: providerId,
    oldValues,
    newValues: { ...newValues, by: actor.email },
  });
}

async function loadProvider(executor: DbExecutor, id: string) {
  const provider = await executor.query.contentProviders.findFirst({ where: eq(contentProviders.id, id) });
  if (!provider) throw new NotFoundError("المزوّد", id);
  return provider;
}

async function readinessFor(executor: DbExecutor, providerId: string, now = new Date()) {
  const requirements = await listRequirements({ activeOnly: true });
  const submissions = await executor.select().from(providerSubmissions).where(eq(providerSubmissions.providerId, providerId));
  return { requirements, submissions, readiness: evaluateReadiness(requirements, submissions, now) };
}

/** نقل الحالة داخل transaction: فحص الآلة، الطوابع الزمنية، حدث outbox، وسجل تدقيق. */
async function transition(executor: DbExecutor, actor: Actor, provider: typeof contentProviders.$inferSelect, to: ProviderStatus, reason: string | null) {
  const from = provider.status as ProviderStatus;
  providerStateMachine.assertTransition(from, to);
  const now = new Date();
  // مشروط بالحالة المقروءة: قراران متزامنان (أو المجدول ومدير) لا يكتب أحدهما فوق الآخر.
  const [changed] = await executor
    .update(contentProviders)
    .set({
      status: to,
      statusReason: reason,
      approvedAt: to === "approved" ? now : provider.approvedAt,
      suspendedAt: to === "suspended" ? now : to === "approved" ? null : provider.suspendedAt,
      updatedAt: now,
    })
    .where(and(eq(contentProviders.id, provider.id), eq(contentProviders.status, from)))
    .returning({ id: contentProviders.id });
  if (!changed) throw new ConflictError("تغيّرت حالة المزوّد للتو. حدّث الصفحة ثم أعد المحاولة.");
  await publishEvent(executor, { storeId: null, type: "provider.status_changed", aggregateType: ENTITY, aggregateId: provider.id, payload: { from, to, reason } });
  await audit(executor, actor, "provider.status_changed", provider.id, { status: to, reason }, { status: from });
}

export async function createProvider(input: unknown, actor: Actor) {
  const data = parseInput(createProviderSchema, input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(contentProviders).values(data).returning();
    await audit(tx, actor, "provider.created", row.id, { name: row.name });
    return row;
  });
}

/** كل المزوّدين مع نسبة اكتمال شروطهم (للقائمة). */
export async function listProvidersWithReadiness(now = new Date()) {
  const [providers, requirements] = await Promise.all([
    db.query.contentProviders.findMany({ orderBy: [desc(contentProviders.createdAt)] }),
    listRequirements({ activeOnly: true }),
  ]);
  const ids = providers.map((p) => p.id);
  const submissions = ids.length ? await db.select().from(providerSubmissions).where(inArray(providerSubmissions.providerId, ids)) : [];
  return providers.map((p) => ({
    ...p,
    readiness: evaluateReadiness(
      requirements,
      submissions.filter((s) => s.providerId === p.id),
      now,
    ),
  }));
}

/** كل ما تحتاجه صفحة مراجعة مزوّد واحد. */
export async function getProviderReview(id: string, now = new Date()) {
  const provider = await loadProvider(db, id);
  const { requirements, submissions, readiness } = await readinessFor(db, id, now);
  const byRequirement = new Map(submissions.map((s) => [s.requirementId, s]));
  const history = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, ENTITY), eq(auditLogs.entityId, id)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  return {
    provider,
    readiness,
    rows: requirements.map((r) => ({ requirement: r, submission: byRequirement.get(r.id) ?? null, state: readiness.items.find((i) => i.requirementId === r.id)!.state })),
    nextStates: providerStateMachine.nextStates(provider.status as ProviderStatus),
    history,
  };
}

/**
 * تسجيل نتيجة مراجعة شرط. قبول شرط له انتهاء يتطلب تاريخاً مستقبلياً.
 * إن كان المزوّد مفعّلاً وأصبح شرط مطلوب غير مستوفى، يُوقف فوراً.
 */
export async function reviewSubmission(providerId: string, requirementId: string, input: unknown, actor: Actor) {
  const data = parseInput(reviewSubmissionSchema, input);
  const requirement = await db.query.providerRequirements.findFirst({ where: eq(providerRequirements.id, requirementId) });
  if (!requirement) throw new NotFoundError("الشرط", requirementId);

  const now = new Date();
  if (data.status === "accepted" && requirement.hasExpiry) {
    if (!data.expiresAt) throw new ValidationError(`«${requirement.title}» يحتاج تاريخ انتهاء قبل قبوله`);
    if (data.expiresAt.getTime() <= now.getTime()) throw new ValidationError(`تاريخ انتهاء «${requirement.title}» مضى بالفعل`);
  }

  return db.transaction(async (tx) => {
    const provider = await loadProvider(tx, providerId);
    const values = {
      status: data.status,
      reference: data.reference ?? null,
      expiresAt: data.expiresAt ?? null,
      reviewerNote: data.note ?? null,
      reviewedBy: actor.email,
      reviewedAt: now,
      updatedAt: now,
    };
    await tx
      .insert(providerSubmissions)
      .values({ providerId, requirementId, ...values })
      .onConflictDoUpdate({ target: [providerSubmissions.providerId, providerSubmissions.requirementId], set: values });
    await audit(tx, actor, "provider.requirement_reviewed", providerId, { requirement: requirement.title, status: data.status, expiresAt: data.expiresAt ?? null, note: data.note ?? null });

    const state = itemState(requirement, { requirementId, status: data.status, expiresAt: data.expiresAt ?? null }, now);
    if (provider.status === "approved" && requirement.isActive && requirement.isRequired && state !== "ok") {
      await transition(tx, actor, provider, "suspended", `شرط لم يعد مستوفى: ${requirement.title}`);
      return { suspended: true };
    }
    return { suspended: false };
  });
}

/** تغيير حالة المزوّد يدوياً. القبول مشروط باكتمال كل الشروط المطلوبة، والرفض والإيقاف يحتاجان سبباً. */
export async function changeProviderStatus(providerId: string, input: unknown, actor: Actor) {
  const { to, reason } = parseInput(changeStatusSchema, input);
  if ((to === "rejected" || to === "suspended") && !reason) throw new ValidationError("اكتب سبب الرفض أو الإيقاف");

  return db.transaction(async (tx) => {
    const provider = await loadProvider(tx, providerId);
    providerStateMachine.assertTransition(provider.status as ProviderStatus, to);
    if (to === "approved") {
      const { readiness } = await readinessFor(tx, providerId);
      if (!readiness.ready) {
        throw new ValidationError(`لا يمكن القبول قبل استيفاء: ${readiness.blocking.map((b) => b.title).join("، ")}`);
      }
    }
    await transition(tx, actor, provider, to, reason ?? null);
  });
}

/**
 * يوقف المزوّدين المفعّلين الذين انتهى أحد مستنداتهم المطلوبة. يُشغَّل يومياً من /api/internal/review-providers.
 * شرط مطلوب جديد أضافه المدير لا يوقف أحداً تلقائياً؛ يظهر كتنبيه في القائمة فقط.
 */
export async function suspendProvidersWithExpiredDocuments(now = new Date(), actor: Actor = SYSTEM_ACTOR) {
  const approved = await db.query.contentProviders.findMany({ where: eq(contentProviders.status, "approved"), orderBy: [asc(contentProviders.createdAt)] });
  const suspended: { id: string; name: string; expired: string[] }[] = [];
  for (const provider of approved) {
    const { readiness } = await readinessFor(db, provider.id, now);
    const expired = readiness.blocking.filter((b) => b.state === "expired").map((b) => b.title);
    if (expired.length === 0) continue;
    const done = await db.transaction(async (tx) => {
      // إعادة القراءة داخل المعاملة: قد يكون المدير غيّر الحالة منذ بدء الحلقة.
      const fresh = await loadProvider(tx, provider.id);
      if (fresh.status !== "approved") return false;
      await transition(tx, actor, fresh, "suspended", `انتهت صلاحية: ${expired.join("، ")}`);
      return true;
    });
    if (done) suspended.push({ id: provider.id, name: provider.name, expired });
  }
  return suspended;
}

const REVIEW_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastReviewAt = 0;

/**
 * يشغّل الإيقاف التلقائي مرة كل 6 ساعات على الأكثر. يُستدعى من مجدول process-events (كل دقيقة) حتى لا
 * يعتمد الإيقاف على مهمة Coolify إضافية. العدّاد في الذاكرة لكل نسخة؛ التكرار آمن (لا يمس إلا المفعّلين).
 */
export async function reviewProvidersIfDue(now = new Date()) {
  if (now.getTime() - lastReviewAt < REVIEW_INTERVAL_MS) return null;
  lastReviewAt = now.getTime();
  return suspendProvidersWithExpiredDocuments(now);
}
