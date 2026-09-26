import { and, asc, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { contentProviders, playerActivationCodes, playerActivity, playerPairings, providerServers, providerUsernamePrefixes } from "@/infrastructure/database/schema";
import type { ProviderStatus } from "@/core/state-machines";
import type { ActivityKind } from "./activity";

/** أيام المنصة بتوقيت السعودية حتى يطابق «اليوم» ساعة المدير. */
export const PLATFORM_TZ = "Asia/Riyadh";
export const ACTIVITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** «2026-09-26» بتوقيت المنصة. */
export function platformDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PLATFORM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export interface DashboardProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  servers: number;
  activeServers: number;
  prefixes: number;
  activeCodes: number;
  totalCodes: number;
  redemptions: number;
  lastActivityAt: Date | null;
}

/**
 * لوحة تطبيق المشغّل لمدير المنصة: المؤشرات، نشاط آخر 14 يوماً، المزوّدون، آخر العمليات،
 * وتنبيهات ما يمنع مزوّداً من الظهور في التطبيق.
 */
export async function getPlayerDashboard(now = new Date()) {
  const since = new Date(now.getTime() - (ACTIVITY_DAYS - 1) * DAY_MS - DAY_MS);
  const week = new Date(now.getTime() - 7 * DAY_MS);
  // المنطقة الزمنية ثابتة في الكود (لا مدخل مستخدم)، وتُكتب نصاً حتى يتطابق تعبير SELECT وGROUP BY.
  const dayExpr = sql<string>`to_char(${playerActivity.createdAt} at time zone ${sql.raw(`'${PLATFORM_TZ}'`)}, 'YYYY-MM-DD')`;

  const [providers, serverRows, prefixRows, codeRows, activityByProvider, dailyRows, recent, pendingPairings, week7] = await Promise.all([
    db.select({ id: contentProviders.id, name: contentProviders.name, status: contentProviders.status }).from(contentProviders).orderBy(asc(contentProviders.name)),
    db
      .select({ id: providerServers.id, providerId: providerServers.providerId, label: providerServers.label, isActive: providerServers.isActive })
      .from(providerServers)
      .orderBy(asc(providerServers.createdAt)),
    db
      .select({ serverId: providerUsernamePrefixes.serverId, count: sql<number>`count(*)::int` })
      .from(providerUsernamePrefixes)
      .groupBy(providerUsernamePrefixes.serverId),
    db
      .select({
        serverId: playerActivationCodes.serverId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${playerActivationCodes.status} = 'active' and (${playerActivationCodes.expiresAt} is null or ${playerActivationCodes.expiresAt} > ${now.toISOString()}::timestamptz))::int`,
        redemptions: sql<number>`coalesce(sum(${playerActivationCodes.redemptionCount}), 0)::int`,
      })
      .from(playerActivationCodes)
      .groupBy(playerActivationCodes.serverId),
    db
      .select({ providerId: playerActivity.providerId, last: sql<Date | null>`max(${playerActivity.createdAt})` })
      .from(playerActivity)
      .groupBy(playerActivity.providerId),
    db
      .select({ day: dayExpr, kind: playerActivity.kind, count: sql<number>`count(*)::int` })
      .from(playerActivity)
      .where(gte(playerActivity.createdAt, since))
      .groupBy(dayExpr, playerActivity.kind),
    db
      .select({
        id: playerActivity.id,
        kind: playerActivity.kind,
        at: playerActivity.createdAt,
        providerId: playerActivity.providerId,
        providerName: contentProviders.name,
        serverLabel: providerServers.label,
        code: playerActivationCodes.code,
      })
      .from(playerActivity)
      .innerJoin(contentProviders, eq(contentProviders.id, playerActivity.providerId))
      .leftJoin(providerServers, eq(providerServers.id, playerActivity.serverId))
      .leftJoin(playerActivationCodes, eq(playerActivationCodes.id, playerActivity.codeId))
      .orderBy(desc(playerActivity.createdAt))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(playerPairings)
      .where(and(eq(playerPairings.status, "pending"), gt(playerPairings.expiresAt, now))),
    db
      .select({ kind: playerActivity.kind, count: sql<number>`count(*)::int` })
      .from(playerActivity)
      .where(gte(playerActivity.createdAt, week))
      .groupBy(playerActivity.kind),
  ]);

  const prefixBy = new Map(prefixRows.map((r) => [r.serverId, r.count]));
  const codesBy = new Map(codeRows.map((r) => [r.serverId, r]));
  const lastBy = new Map(activityByProvider.map((r) => [r.providerId, r.last ? new Date(r.last) : null]));

  const rows: DashboardProvider[] = providers.map((p) => {
    const servers = serverRows.filter((s) => s.providerId === p.id);
    const codes = servers.map((s) => codesBy.get(s.id)).filter((c): c is NonNullable<typeof c> => !!c);
    return {
      id: p.id,
      name: p.name,
      status: p.status as ProviderStatus,
      servers: servers.length,
      activeServers: servers.filter((s) => s.isActive).length,
      prefixes: servers.reduce((n, s) => n + (prefixBy.get(s.id) ?? 0), 0),
      activeCodes: codes.reduce((n, c) => n + c.active, 0),
      totalCodes: codes.reduce((n, c) => n + c.total, 0),
      redemptions: codes.reduce((n, c) => n + c.redemptions, 0),
      lastActivityAt: lastBy.get(p.id) ?? null,
    };
  });

  // سلسلة يومية كاملة (أيام بلا نشاط = صفر) بتوقيت المنصة.
  const counts = new Map<string, { code_redeemed: number; tv_paired: number }>();
  for (const r of dailyRows) {
    const c = counts.get(r.day) ?? { code_redeemed: 0, tv_paired: 0 };
    c[r.kind as ActivityKind] = r.count;
    counts.set(r.day, c);
  }
  const daily = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const day = platformDay(new Date(now.getTime() - (ACTIVITY_DAYS - 1 - i) * DAY_MS));
    const c = counts.get(day) ?? { code_redeemed: 0, tv_paired: 0 };
    return { day, codes: c.code_redeemed, pairings: c.tv_paired, total: c.code_redeemed + c.tv_paired };
  });

  const live = rows.filter((r) => r.status === "approved" && r.activeServers > 0);
  const weekCounts = { codes: week7.find((w) => w.kind === "code_redeemed")?.count ?? 0, pairings: week7.find((w) => w.kind === "tv_paired")?.count ?? 0 };

  return {
    kpis: {
      liveProviders: live.length,
      approvedProviders: rows.filter((r) => r.status === "approved").length,
      awaitingReview: rows.filter((r) => r.status === "pending" || r.status === "under_review").length,
      activeServers: live.reduce((n, r) => n + r.activeServers, 0),
      prefixes: live.reduce((n, r) => n + r.prefixes, 0),
      activeCodes: rows.reduce((n, r) => n + r.activeCodes, 0),
      totalCodes: rows.reduce((n, r) => n + r.totalCodes, 0),
      week: { ...weekCounts, total: weekCounts.codes + weekCounts.pairings },
      today: daily[daily.length - 1],
      pendingPairings: pendingPairings[0]?.count ?? 0,
    },
    daily,
    providers: rows,
    recent: recent.map((r) => ({ ...r, kind: r.kind as ActivityKind })),
    warnings: {
      approvedWithoutServer: rows.filter((r) => r.status === "approved" && r.activeServers === 0),
      blockedWithCodes: rows.filter((r) => r.status !== "approved" && r.activeCodes > 0),
    },
    /** خوادم مزوّدين مقبولين مفعّلة: لنموذج إصدار كود سريع. */
    issuableServers: serverRows
      .filter((s) => s.isActive && rows.some((r) => r.id === s.providerId && r.status === "approved"))
      .map((s) => ({ id: s.id, label: s.label, providerId: s.providerId, providerName: rows.find((r) => r.id === s.providerId)!.name })),
  };
}

export type PlayerDashboard = Awaited<ReturnType<typeof getPlayerDashboard>>;
