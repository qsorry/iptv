import { and, eq, lt } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { playerPairings } from "@/infrastructure/database/schema";
import { AppError, NotFoundError, ValidationError } from "@/core/errors";
import { pairingStateMachine, type PairingStatus } from "@/core/state-machines";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { parseInput } from "@/modules/providers/validations";
import { completePairingSchema } from "../validations";
import { generatePairingCode, generatePollToken, hashToken, normalizePairingCode, tokenMatches } from "../domain/codes";
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

const INVALID_PAIR_CODE = "رمز الربط غير صحيح أو انتهت صلاحيته. أعد فتح شاشة الربط على التلفاز.";

/** يتحقق أن رمز الربط قائم وينتظر، دون كشف أي بيانات (لصفحة الجوال قبل الإرسال). */
export async function findPendingPairing(input: string, now = new Date()) {
  const code = normalizePairingCode(input);
  if (!code) return null;
  const row = await db.query.playerPairings.findFirst({ where: eq(playerPairings.code, code) });
  if (!row || row.status !== "pending" || row.expiresAt.getTime() <= now.getTime()) return null;
  return { code: row.code, expiresAt: row.expiresAt };
}

/**
 * الجوال يرسل الحساب للتلفاز: بكود تفعيل، أو باسم مستخدم يتعرّف عليه المشغّل من بادئته.
 * التحديث مشروط بـ status = pending فلا يُكمَل الطلب مرتين.
 */
export async function completePairing(input: unknown, now = new Date()) {
  const data = parseInput(completePairingSchema, input);
  const pending = await findPendingPairing(data.pairCode, now);
  if (!pending) throw new ValidationError(INVALID_PAIR_CODE);

  let account: PlayerAccount;
  let activity: { providerId: string; serverId: string; codeId: string | null };
  if (data.activationCode) {
    const r = await redeemCode(data.activationCode, now);
    account = r.account;
    activity = { providerId: r.providerId, serverId: r.serverId, codeId: r.codeId };
  } else {
    const detected = await detectServer(data.username!);
    if (!detected) throw new ValidationError("لم نتعرّف على مزوّد لاسم المستخدم هذا. استخدم كود التفعيل بدلاً منه.");
    account = { provider: { name: detected.provider.name }, server: { label: detected.server.label, url: detected.server.url }, username: data.username!, password: data.password! };
    activity = { providerId: detected.provider.id, serverId: detected.server.id, codeId: null };
  }

  pairingStateMachine.assertTransition("pending", "completed");
  const [updated] = await db
    .update(playerPairings)
    .set({ status: "completed", payloadEncrypted: encryptSecret(JSON.stringify(account)), completedAt: now, updatedAt: now })
    .where(and(eq(playerPairings.code, pending.code), eq(playerPairings.status, "pending")))
    .returning({ id: playerPairings.id });
  if (!updated) throw new ValidationError(INVALID_PAIR_CODE);
  await recordActivity(db, { kind: "tv_paired", ...activity, at: now });
  return { providerName: account.provider.name, serverLabel: account.server.label };
}

export type PairingPoll =
  | { status: "pending"; expiresAt: Date }
  | { status: "completed"; account: PlayerAccount }
  | { status: "consumed" | "expired" };

/** التلفاز يستطلع كل بضع ثوانٍ. الحساب يُسلَّم مرة واحدة ثم تُمسح الحمولة. */
export async function pollPairing(id: string, pollToken: string, now = new Date()): Promise<PairingPoll> {
  if (!UUID.test(id)) throw new NotFoundError("طلب الربط");
  const row = await db.query.playerPairings.findFirst({ where: eq(playerPairings.id, id) });
  if (!row || !pollToken || !tokenMatches(pollToken, row.pollTokenHash)) throw new NotFoundError("طلب الربط");

  const status = row.status as PairingStatus;
  if ((status === "pending" || status === "completed") && row.expiresAt.getTime() <= now.getTime()) {
    pairingStateMachine.assertTransition(status, "expired");
    await db.update(playerPairings).set({ status: "expired", payloadEncrypted: null, updatedAt: now }).where(eq(playerPairings.id, id));
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
  return { status: "completed", account: JSON.parse(decryptSecret(row.payloadEncrypted)) as PlayerAccount };
}
