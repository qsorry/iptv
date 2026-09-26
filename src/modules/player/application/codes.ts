import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentProviders, playerActivationCodes, providerServers } from "@/infrastructure/database/schema";
import { AppError, NotFoundError, ValidationError } from "@/core/errors";
import { activationCodeStateMachine, type ActivationCodeStatus } from "@/core/state-machines";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { Actor } from "@/modules/providers";
import { parseInput } from "@/modules/providers/validations";
import { createCodeSchema } from "../validations";
import { generateActivationCode, normalizeActivationCode } from "../domain/codes";
import { auditProvider, listProviderServers } from "./servers";
import { recordActivity } from "./activity";

/** ما يحتاجه التطبيق لتسجيل الدخول على خادم Xtream. */
export interface PlayerAccount {
  provider: { name: string };
  server: { label: string; url: string };
  username: string;
  password: string;
}

/** رسالة واحدة لكل أسباب الفشل حتى لا يُستدلّ منها على وجود الكود. */
export class InvalidActivationCodeError extends AppError {
  constructor() {
    super("الكود غير صالح أو منتهي. تأكد منه أو اطلب كوداً جديداً من مزوّدك.", "INVALID_ACTIVATION_CODE", 404);
  }
}

/** يُصدر كوداً جديداً لحساب على خادم. يُعاد الكود مرة واحدة ليُسلَّم للمشترك. */
export async function createActivationCode(input: unknown, actor: Actor, now = new Date()) {
  const data = parseInput(createCodeSchema, input);
  if (data.expiresAt && data.expiresAt.getTime() <= now.getTime()) throw new ValidationError("تاريخ انتهاء الكود مضى بالفعل");

  return db.transaction(async (tx) => {
    const [server] = await tx.select().from(providerServers).where(eq(providerServers.id, data.serverId));
    if (!server) throw new NotFoundError("الخادم", data.serverId);

    // تصادم الكود شبه مستحيل (32^8)، لكن القيد الفريد هو الضمان؛ نعيد المحاولة بكود آخر.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateActivationCode();
      const [row] = await tx
        .insert(playerActivationCodes)
        .values({
          code,
          serverId: server.id,
          username: data.username,
          passwordEncrypted: encryptSecret(data.password),
          expiresAt: data.expiresAt ?? null,
          note: data.note ?? null,
          createdBy: actor.email,
        })
        .onConflictDoNothing({ target: playerActivationCodes.code })
        .returning();
      if (row) {
        await auditProvider(tx, actor, "player.code_created", server.providerId, { code, server: server.label, username: data.username });
        return row;
      }
    }
    throw new AppError("تعذّر توليد كود فريد، حاول مرة أخرى", "CODE_GENERATION_FAILED", 500);
  });
}

export const CODES_PAGE_SIZE = 100;

/** أكواد المزوّد (بلا كلمات المرور)، الأحدث أولاً، مع بحث بالكود أو اسم المستخدم للوصول للأقدم. */
export async function listActivationCodes(providerId: string, opts: { q?: string; limit?: number } = {}) {
  const q = (opts.q ?? "").trim();
  const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  return db
    .select({
      id: playerActivationCodes.id,
      code: playerActivationCodes.code,
      username: playerActivationCodes.username,
      status: playerActivationCodes.status,
      expiresAt: playerActivationCodes.expiresAt,
      note: playerActivationCodes.note,
      redemptionCount: playerActivationCodes.redemptionCount,
      lastRedeemedAt: playerActivationCodes.lastRedeemedAt,
      createdAt: playerActivationCodes.createdAt,
      serverLabel: providerServers.label,
      serverActive: providerServers.isActive,
    })
    .from(playerActivationCodes)
    .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
    .where(q ? and(eq(providerServers.providerId, providerId), or(ilike(playerActivationCodes.code, pattern), ilike(playerActivationCodes.username, pattern))) : eq(providerServers.providerId, providerId))
    .orderBy(desc(playerActivationCodes.createdAt))
    .limit(opts.limit ?? CODES_PAGE_SIZE);
}

/** عدد أكواد المزوّد كلها: الصالحة للاستخدام الآن (فعّالة، غير منتهية، على خادم مفعّل) والإجمالي. */
export async function countActivationCodes(providerId: string, now = new Date()) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      usable: sql<number>`count(*) filter (where ${playerActivationCodes.status} = 'active' and ${providerServers.isActive} and (${playerActivationCodes.expiresAt} is null or ${playerActivationCodes.expiresAt} > ${now.toISOString()}::timestamptz))::int`,
    })
    .from(playerActivationCodes)
    .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
    .where(eq(providerServers.providerId, providerId));
  return { total: row?.total ?? 0, usable: row?.usable ?? 0 };
}

export async function revokeActivationCode(codeId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ code: playerActivationCodes, providerId: providerServers.providerId })
      .from(playerActivationCodes)
      .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
      .where(eq(playerActivationCodes.id, codeId));
    if (!row) throw new NotFoundError("كود التفعيل", codeId);
    activationCodeStateMachine.assertTransition(row.code.status as ActivationCodeStatus, "revoked");
    await tx.update(playerActivationCodes).set({ status: "revoked", updatedAt: new Date() }).where(eq(playerActivationCodes.id, codeId));
    await auditProvider(tx, actor, "player.code_revoked", row.providerId, { code: row.code.code });
  });
}

/** نتيجة الاستبدال مع المعرّفات اللازمة لسجل النشاط. */
export interface Redemption {
  account: PlayerAccount;
  providerId: string;
  serverId: string;
  codeId: string;
}

/**
 * يستبدل الكود ببيانات الحساب ويزيد عدّاده، دون تسجيل نشاط (يسجّله المستدعي بنوعه:
 * دخول مباشر بالكود، أو ربط تلفاز استخدم الكود).
 */
export async function redeemCode(input: unknown, now = new Date()): Promise<Redemption> {
  const code = normalizeActivationCode(input);
  if (!code) throw new InvalidActivationCodeError();
  const [row] = await db
    .select({ code: playerActivationCodes, server: providerServers, providerName: contentProviders.name })
    .from(playerActivationCodes)
    .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
    .innerJoin(contentProviders, eq(contentProviders.id, providerServers.providerId))
    .where(and(eq(playerActivationCodes.code, code), eq(playerActivationCodes.status, "active"), eq(providerServers.isActive, true), eq(contentProviders.status, "approved")));
  if (!row || (row.code.expiresAt && row.code.expiresAt.getTime() <= now.getTime())) throw new InvalidActivationCodeError();

  await db
    .update(playerActivationCodes)
    .set({ redemptionCount: sql`${playerActivationCodes.redemptionCount} + 1`, lastRedeemedAt: now })
    .where(eq(playerActivationCodes.id, row.code.id));

  return {
    account: {
      provider: { name: row.providerName },
      server: { label: row.server.label, url: row.server.baseUrl },
      username: row.code.username,
      password: decryptSecret(row.code.passwordEncrypted),
    },
    providerId: row.server.providerId,
    serverId: row.server.id,
    codeId: row.code.id,
  };
}

/** يتحقق من الكود دون استخدامه (لا عدّاد ولا سجل): للتطبيق أثناء الكتابة، قبل ضغط «دخول». */
export async function checkActivationCode(input: unknown, now = new Date()) {
  const code = normalizeActivationCode(input);
  if (!code) throw new InvalidActivationCodeError();
  const [row] = await db
    .select({ expiresAt: playerActivationCodes.expiresAt, providerName: contentProviders.name, serverLabel: providerServers.label })
    .from(playerActivationCodes)
    .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
    .innerJoin(contentProviders, eq(contentProviders.id, providerServers.providerId))
    .where(and(eq(playerActivationCodes.code, code), eq(playerActivationCodes.status, "active"), eq(providerServers.isActive, true), eq(contentProviders.status, "approved")));
  if (!row || (row.expiresAt && row.expiresAt.getTime() <= now.getTime())) throw new InvalidActivationCodeError();
  return { provider: { name: row.providerName }, server: { label: row.serverLabel } };
}

/**
 * يستبدل الكود ببيانات الحساب (دخول التطبيق مباشرة بالكود). يعمل عدة مرات (جوال وتلفاز لنفس
 * المشترك) ما دام الكود فعّالاً وغير منتهٍ، والخادم مفعّلاً، والمزوّد مقبولاً.
 */
export async function redeemActivationCode(input: unknown, now = new Date()): Promise<PlayerAccount> {
  const r = await redeemCode(input, now);
  await recordActivity(db, { kind: "code_redeemed", providerId: r.providerId, serverId: r.serverId, codeId: r.codeId, at: now });
  return r.account;
}

/** كل ما تحتاجه صفحة إعدادات المشغّل لمزوّد واحد (q: بحث في الأكواد). */
export async function getPlayerSettings(providerId: string, opts: { q?: string } = {}) {
  const provider = await db.query.contentProviders.findFirst({ where: eq(contentProviders.id, providerId) });
  if (!provider) throw new NotFoundError("المزوّد", providerId);
  const [servers, codes, codeCounts] = await Promise.all([listProviderServers(providerId), listActivationCodes(providerId, { q: opts.q }), countActivationCodes(providerId)]);
  return { provider, servers, codes, codeCounts, codesLimited: codes.length >= CODES_PAGE_SIZE };
}
