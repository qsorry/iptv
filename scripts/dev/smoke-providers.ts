/**
 * اختبار دخاني لقبول مزوّدي المحتوى على قاعدة بيانات حقيقية:
 * الشروط الافتراضية، آلة الحالات، منع القبول قبل اكتمال الشروط، الإيقاف عند رفض شرط،
 * والإيقاف التلقائي عند انتهاء مستند دون إيقاف بسبب شرط جديد.
 * التشغيل: DATABASE_URL=... npx tsx scripts/dev/smoke-providers.ts
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { auditLogs, contentProviders, domainEvents } from "@/infrastructure/database/schema";
import {
  DEFAULT_REQUIREMENTS,
  changeProviderStatus,
  createProvider,
  createRequirement,
  ensureDefaultRequirements,
  evaluateReadiness,
  getProviderReview,
  listRequirements,
  reviewSubmission,
  suspendProvidersWithExpiredDocuments,
  updateRequirement,
  type Actor,
} from "@/modules/providers";
import { InvalidStateTransitionError, ValidationError } from "@/core/errors";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`✓ ${msg}`);
};

async function rejects(fn: () => Promise<unknown>, type: new (...args: never[]) => Error, msg: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof type, `${msg} (${(e as Error).message})`);
    return;
  }
  throw new Error(`FAILED: ${msg} — لم يُرمَ خطأ`);
}

const DAY = 24 * 60 * 60 * 1000;
const actor: Actor = { userId: null, email: "smoke@test" };

async function statusOf(id: string) {
  return (await db.query.contentProviders.findFirst({ where: eq(contentProviders.id, id) }))!.status;
}

async function main() {
  // ── الدالة النقية ──
  const now = new Date();
  const reqs = [
    { id: "a", title: "A", isRequired: true, hasExpiry: true, isActive: true },
    { id: "b", title: "B", isRequired: false, hasExpiry: false, isActive: true },
    { id: "c", title: "C", isRequired: true, hasExpiry: false, isActive: false },
  ];
  let r = evaluateReadiness(reqs, [], now);
  assert(!r.ready && r.requiredCount === 1 && r.blocking[0].state === "missing", "readiness: المطلوب الناقص يمنع، والمعطّل لا يُحسب");
  r = evaluateReadiness(reqs, [{ requirementId: "a", status: "accepted", expiresAt: null }], now);
  assert(!r.ready && r.blocking[0].state === "no_expiry", "readiness: شرط له انتهاء بلا تاريخ غير مستوفى");
  r = evaluateReadiness(reqs, [{ requirementId: "a", status: "accepted", expiresAt: new Date(now.getTime() + 10 * DAY) }], now);
  assert(r.ready && r.expiringSoon.length === 1, "readiness: مستوفى مع تنبيه قرب الانتهاء");
  r = evaluateReadiness(reqs, [{ requirementId: "a", status: "accepted", expiresAt: new Date(now.getTime() - DAY) }], now);
  assert(!r.ready && r.blocking[0].state === "expired", "readiness: المنتهي غير مستوفى");

  // ── الشروط الافتراضية ──
  await ensureDefaultRequirements();
  await ensureDefaultRequirements();
  const defaults = await listRequirements();
  assert(DEFAULT_REQUIREMENTS.every((d) => defaults.filter((x) => x.code === d.code).length === 1), "الشروط الافتراضية تُضاف مرة واحدة");
  await rejects(() => createRequirement({ title: "", kind: "document", isRequired: true, hasExpiry: false }), ValidationError, "شرط بلا عنوان مرفوض");

  // ── دورة القبول ──
  const provider = await createProvider({ name: "مزوّد تجريبي", crNumber: "1010000000", contactEmail: "" }, actor);
  assert(provider.status === "pending", "المزوّد الجديد بانتظار المستندات");
  await rejects(() => changeProviderStatus(provider.id, { to: "approved" }, actor), InvalidStateTransitionError, "لا قبول مباشر من pending");
  await changeProviderStatus(provider.id, { to: "under_review" }, actor);
  await rejects(() => changeProviderStatus(provider.id, { to: "approved" }, actor), ValidationError, "لا قبول قبل اكتمال الشروط");
  await rejects(() => changeProviderStatus(provider.id, { to: "rejected" }, actor), ValidationError, "الرفض يحتاج سبباً");

  const active = await listRequirements({ activeOnly: true });
  const withExpiry = active.find((x) => x.hasExpiry && x.isRequired)!;
  await rejects(() => reviewSubmission(provider.id, withExpiry.id, { status: "accepted" }, actor), ValidationError, "قبول شرط له انتهاء بلا تاريخ مرفوض");
  await rejects(
    () => reviewSubmission(provider.id, withExpiry.id, { status: "accepted", expiresAt: new Date(Date.now() - DAY).toISOString() }, actor),
    ValidationError,
    "قبول بتاريخ منتهٍ مرفوض",
  );

  const expiry = new Date(Date.now() + 90 * DAY);
  for (const req of active.filter((x) => x.isRequired)) {
    await reviewSubmission(provider.id, req.id, { status: "accepted", reference: `REF-${req.code}`, expiresAt: req.hasExpiry ? expiry.toISOString().slice(0, 10) : "" }, actor);
  }
  let review = await getProviderReview(provider.id);
  assert(review.readiness.ready, "كل الشروط المطلوبة مستوفاة");
  await changeProviderStatus(provider.id, { to: "approved" }, actor);
  assert((await statusOf(provider.id)) === "approved", "القبول بعد اكتمال الشروط");

  const events = await db.select().from(domainEvents).where(and(eq(domainEvents.aggregateId, provider.id), eq(domainEvents.eventType, "provider.status_changed")));
  assert(events.length === 2, "كل تغيير حالة يكتب حدث outbox");
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, provider.id));
  assert(logs.some((l) => l.action === "provider.requirement_reviewed") && logs.some((l) => l.action === "provider.created"), "المراجعات مسجّلة في audit_logs");

  // ── رفض شرط لمزوّد مفعّل يوقفه فوراً ──
  const contract = active.find((x) => x.code === "platform_contract")!;
  const res = await reviewSubmission(provider.id, contract.id, { status: "rejected", note: "العقد غير موقّع" }, actor);
  assert(res.suspended && (await statusOf(provider.id)) === "suspended", "رفض شرط مطلوب يوقف المزوّد المفعّل");
  await reviewSubmission(provider.id, contract.id, { status: "accepted" }, actor);
  await changeProviderStatus(provider.id, { to: "approved" }, actor);
  assert((await statusOf(provider.id)) === "approved", "إعادة التفعيل من الإيقاف بعد الاستيفاء");

  // ── شرط مطلوب جديد لا يوقف تلقائياً، والانتهاء يوقف ──
  const extra = await createRequirement({ title: "شهادة اختبار", kind: "document", isRequired: true, hasExpiry: false, sortOrder: 999 });
  let suspended = await suspendProvidersWithExpiredDocuments(new Date());
  assert(!suspended.some((s) => s.id === provider.id) && (await statusOf(provider.id)) === "approved", "الشرط الجديد لا يوقف المزوّد المفعّل");
  review = await getProviderReview(provider.id);
  assert(!review.readiness.ready && review.readiness.blocking.some((b) => b.requirementId === extra.id), "الشرط الجديد يظهر كنقص");
  await updateRequirement(extra.id, { title: extra.title, kind: "document", isRequired: true, hasExpiry: false, sortOrder: 999, isActive: false });

  suspended = await suspendProvidersWithExpiredDocuments(new Date(expiry.getTime() + DAY));
  assert(suspended.some((s) => s.id === provider.id) && (await statusOf(provider.id)) === "suspended", "انتهاء مستند مطلوب يوقف المزوّد تلقائياً");

  console.log("\nكل اختبارات قبول المزوّدين نجحت");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
