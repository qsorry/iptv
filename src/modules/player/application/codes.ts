import { and, desc, eq, sql } from "drizzle-orm";
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

/** آخر أكواد المزوّد (بلا كلمات المرور). */
export async function listActivationCodes(providerId: string, limit = 100) {
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
    })
    .from(playerActivationCodes)
    .innerJoin(providerServers, eq(providerServers.id, playerActivationCodes.serverId))
    .where(eq(providerServers.providerId, providerId))
    .orderBy(desc(playerActivationCodes.createdAt))
    .limit(limit);
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
export async function redeemCode(input: string, now = new Date()): Promise<Redemption> {
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

/**
 * يستبدل الكود ببيانات الحساب (دخول التطبيق مباشرة بالكود). يعمل عدة مرات (جوال وتلفاز لنفس
 * المشترك) ما دام الكود فعّالاً وغير منتهٍ، والخادم مفعّلاً، والمزوّد مقبولاً.
 */
export async function redeemActivationCode(input: string, now = new Date()): Promise<PlayerAccount> {
  const r = await redeemCode(input, now);
  await recordActivity(db, { kind: "code_redeemed", providerId: r.providerId, serverId: r.serverId, codeId: r.codeId, at: now });
  return r.account;
}

/** كل ما تحتاجه صفحة إعدادات المشغّل لمزوّد واحد. */
export async function getPlayerSettings(providerId: string) {
  const provider = await db.query.contentProviders.findFirst({ where: eq(contentProviders.id, providerId) });
  if (!provider) throw new NotFoundError("المزوّد", providerId);
  const [servers, codes] = await Promise.all([listProviderServers(providerId), listActivationCodes(providerId)]);
  return { provider, servers, codes };
}
