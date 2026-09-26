import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { playerPairings } from "@/infrastructure/database/schema";
import { AppError, NotFoundError } from "@/core/errors";
import { pairingStateMachine, type PairingStatus } from "@/core/state-machines";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { parseInput } from "@/modules/providers/validations";
import { completePairingSchema } from "../validations";
import { generatePairingCode, generatePollToken, hashToken, normalizePairingCode, toLatinDigits, tokenMatches } from "../domain/codes";
import { redeemCode, type PlayerAccount } from "./codes";
import { recordActivity } from "./activity";
import { detectServer } from "./servers";

/** مدة صلاحية رمز الربط الظاهر على التلفاز. */
export const PAIRING_TTL_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pairingUrl(code: string) {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/player/pair?code=${encodeURIComponent(code)}`;
}

/** التلفاز يطلب رمز ربط. رمز الاستطلاع يُعاد مرة واحدة ولا يُخزَّن إلا بصمته. */
export async function startPairing(now = new Date()) {
  // تنظيف ما انتهى منذ يوم؛ الطلبات قصيرة العمر ولا حاجة لها بعد ذلك.
  await db.delete(playerPairings).where(lt(playerPairings.expiresAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));

  const pollToken = generatePollToken();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePairingCode();
    const [row] = await db
      .insert(playerPairings)
      .values({ code, pollTokenHash: hashToken(pollToken), expiresAt })
      .onConflictDoNothing({ target: playerPairings.code })
      .returning();
    if (row) return { id: row.id, code, pollToken, expiresAt, pairUrl: pairingUrl(code) };
  }
  throw new AppError("تعذّر إنشاء رمز ربط، حاول مرة أخرى", "PAIRING_FAILED", 500);
}

/** رمز الربط غير موجود أو استُخدم أو انتهى. */
export class PairingCodeError extends AppError {
  constructor() {
    super("رمز الربط غير صحيح أو انتهت صلاحيته. أعد فتح شاشة الربط على التلفاز.", "PAIRING_CODE_INVALID", 422);
  }
}

/** اسم مستخدم لا تطابق بادئته مزوّداً مقبولاً. */
export class UnknownUsernameError extends AppError {
  constructor() {
    super("لم نتعرّف على مزوّد لاسم المستخدم هذا. استخدم كود التفعيل بدلاً منه.", "UNKNOWN_USERNAME", 422);
  }
}

/** مهلة إضافية ليستلم التلفاز حساباً أُرسل قبيل انتهاء الرمز (يستطلع كل 3 ثوانٍ). */
export const PAIRING_CLAIM_GRACE_MS = 60 * 1000;

/** ما يُشفَّر في الطلب حتى يستلمه التلفاز: الحساب، ومعرّفات سجل النشاط. */
interface PairingPayload {
  account: PlayerAccount;
  activity: { providerId: string; serverId: string; codeId: string | null };
}

/** يتحقق أن رمز الربط قائم وينتظر، دون كشف أي بيانات (لصفحة الجوال قبل الإرسال). */
export async function findPendingPairing(input: unknown, now = new Date()) {
  const code = normalizePairingCode(input);
  if (!code) return null;
  const row = await db.query.playerPairings.findFirst({ where: eq(playerPairings.code, code) });
  if (!row || row.status !== "pending" || row.expiresAt.getTime() <= now.getTime()) return null;
  return { code: row.code, expiresAt: row.expiresAt };
}

/**
 * الجوال يرسل الحساب للتلفاز: بكود تفعيل، أو باسم مستخدم يتعرّف عليه المشغّل من بادئته.
 * التحديث مشروط بـ status = pending وبعدم انتهاء الرمز، فلا يُكمَل الطلب مرتين ولا بعد انتهائه.
 */
export async function completePairing(input: unknown, now = new Date()) {
  const data = parseInput(completePairingSchema, input);
  const pending = await findPendingPairing(data.pairCode, now);
  if (!pending) throw new PairingCodeError();

  let payload: PairingPayload;
  if (data.activationCode) {
    const r = await redeemCode(data.activationCode, now);
    payload = { account: r.account, activity: { providerId: r.providerId, serverId: r.serverId, codeId: r.codeId } };
  } else {
    // نفس تطبيع التطبيق: لوحات مفاتيح الجوال العربية تكتب ٠-٩، وخادم المزوّد يتوقع 0-9.
    const username = toLatinDigits(data.username!).trim();
    const detected = await detectServer(username);
    if (!detected) throw new UnknownUsernameError();
    payload = {
      account: { provider: { name: detected.provider.name }, server: { label: detected.server.label, url: detected.server.url }, username, password: data.password! },
      activity: { providerId: detected.provider.id, serverId: detected.server.id, codeId: null },
    };
  }

  pairingStateMachine.assertTransition("pending", "completed");
  const [updated] = await db
    .update(playerPairings)
    .set({ status: "completed", payloadEncrypted: encryptSecret(JSON.stringify(payload)), completedAt: now, updatedAt: now })
    .where(and(eq(playerPairings.code, pending.code), eq(playerPairings.status, "pending"), gt(playerPairings.expiresAt, now)))
    .returning({ id: playerPairings.id });
  if (!updated) throw new PairingCodeError();
  return { providerName: payload.account.provider.name, serverLabel: payload.account.server.label };
}

export type PairingPoll =
  | { status: "pending"; expiresAt: Date }
  | { status: "completed"; account: PlayerAccount }
  | { status: "consumed" | "expired" };

/** ينهي الطلب فقط إن بقيت حالته كما قُرئت (لا يمحو إكمالاً وصل للتو). */
async function expire(id: string, from: PairingStatus, now: Date) {
  pairingStateMachine.assertTransition(from, "expired");
  await db
    .update(playerPairings)
    .set({ status: "expired", payloadEncrypted: null, updatedAt: now })
    .where(and(eq(playerPairings.id, id), eq(playerPairings.status, from)));
}

/**
 * التلفاز يستطلع كل بضع ثوانٍ. الحساب يُسلَّم مرة واحدة ثم تُمسح الحمولة، ويُسجَّل «ربط تلفاز» عندها فقط
 * (لا عند إرسال الجوال)، فلا يُحسب ربط لم يصل للتلفاز.
 */
export async function pollPairing(id: string, pollToken: string, now = new Date()): Promise<PairingPoll> {
  if (!UUID.test(id)) throw new NotFoundError("طلب الربط");
  const row = await db.query.playerPairings.findFirst({ where: eq(playerPairings.id, id) });
  if (!row || !pollToken || !tokenMatches(pollToken, row.pollTokenHash)) throw new NotFoundError("طلب الربط");

  const status = row.status as PairingStatus;
  const expired = row.expiresAt.getTime() <= now.getTime();
  if (status === "pending" && expired) {
    await expire(id, "pending", now);
    return { status: "expired" };
  }
  if (status === "completed" && row.expiresAt.getTime() + PAIRING_CLAIM_GRACE_MS <= now.getTime()) {
    await expire(id, "completed", now);
    return { status: "expired" };
  }
  if (status === "pending") return { status: "pending", expiresAt: row.expiresAt };
  if (status !== "completed") return { status };

  pairingStateMachine.assertTransition("completed", "consumed");
  const [taken] = await db
    .update(playerPairings)
    .set({ status: "consumed", payloadEncrypted: null, consumedAt: now, updatedAt: now })
    .where(and(eq(playerPairings.id, id), eq(playerPairings.status, "completed")))
    .returning({ id: playerPairings.id });
  if (!taken || !row.payloadEncrypted) return { status: "consumed" };
  const payload = JSON.parse(decryptSecret(row.payloadEncrypted)) as PairingPayload;
  await recordActivity(db, { kind: "tv_paired", ...payload.activity, at: now });
  return { status: "completed", account: payload.account };
}
