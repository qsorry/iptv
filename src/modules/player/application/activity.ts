import type { DbExecutor } from "@/infrastructure/database/client";
import { playerActivity } from "@/infrastructure/database/schema";

export type ActivityKind = "code_redeemed" | "tv_paired";

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  code_redeemed: "دخول بكود تفعيل",
  tv_paired: "ربط تلفاز بالجوال",
};

/** يسجّل دخولاً مرّ عبر المنصة (للوحة المشغّل). */
export async function recordActivity(executor: DbExecutor, a: { kind: ActivityKind; providerId: string; serverId: string | null; codeId: string | null; at: Date }) {
  await executor.insert(playerActivity).values({ kind: a.kind, providerId: a.providerId, serverId: a.serverId, codeId: a.codeId, createdAt: a.at });
}
