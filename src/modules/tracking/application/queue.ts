import { and, eq, lt, lte, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { trackingDeliveries, trackingEvents } from "@/infrastructure/database/schema";
import { allowsPlatform } from "./consent";
import { runtimeIntegrations, type IntegrationRuntime } from "./settings";
import { ADAPTERS } from "../adapters";
import type { AdapterResult } from "../adapters/types";
import type { UnifiedEvent } from "../domain/events";
import type { Platform } from "../domain/platforms";

const MAX_ATTEMPTS = 6;
const TIMEOUT_MS = 8000;
/** مهلة حجز الصف: لو مات العامل يعود الحدث للطابور بعدها. */
const LEASE_MS = 2 * 60 * 1000;

/** تراجع أُسّي: 1د، 2د، 4د، 8د، 16د، 32د. */
function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** attempts, 32 * 60_000);
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<AdapterResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) return { status: "sent", statusCode: res.status };
    const text = (await res.text().catch(() => "")).slice(0, 500);
    return { status: "failed", statusCode: res.status, error: text || `HTTP ${res.status}` };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** يحجز حدثاً واحداً من الطابور. لا عاملان على نفس الصف. */
async function claim() {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(trackingEvents)
      .where(
        and(
          eq(trackingEvents.status, "pending"),
          lte(trackingEvents.nextAttemptAt, new Date()),
          lt(trackingEvents.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(trackingEvents.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row) return null;
    await tx
      .update(trackingEvents)
      .set({ nextAttemptAt: new Date(Date.now() + LEASE_MS) })
      .where(eq(trackingEvents.id, row.id));
    return row;
  });
}

async function alreadySent(trackingEventId: string): Promise<Set<string>> {
  const rows = await db
    .select({ platform: trackingDeliveries.platform, status: trackingDeliveries.status })
    .from(trackingDeliveries)
    .where(eq(trackingDeliveries.trackingEventId, trackingEventId));
  return new Set(rows.filter((r) => r.status === "sent").map((r) => r.platform));
}

async function recordDelivery(storeId: string, trackingEventId: string, platform: Platform, result: AdapterResult) {
  await db
    .insert(trackingDeliveries)
    .values({
      storeId,
      trackingEventId,
      platform,
      status: result.status,
      statusCode: result.statusCode ?? null,
      error: result.error ?? null,
    })
    .onConflictDoUpdate({
      target: [trackingDeliveries.trackingEventId, trackingDeliveries.platform],
      set: { status: result.status, statusCode: result.statusCode ?? null, error: result.error ?? null, createdAt: new Date() },
    });
}

/** يرسل حدثاً واحداً لكل منصة مفعّلة ومسموح بها بالموافقة. */
async function dispatch(row: typeof trackingEvents.$inferSelect, integrations: IntegrationRuntime[]) {
  const event = row.payload as unknown as UnifiedEvent;
  const sent = await alreadySent(row.id);
  let failures = 0;
  let succeeded = sent.size;

  for (const adapter of ADAPTERS) {
    const integration = integrations.find((i) => i.platform === adapter.platform);
    if (!integration?.enabled) continue;
    if (sent.has(adapter.platform)) continue;

    if (!allowsPlatform(event.consent, adapter.platform)) {
      await recordDelivery(row.storeId, row.id, adapter.platform, { status: "skipped", error: "بلا موافقة" });
      continue;
    }
    const request = adapter.build(event, integration.config, integration.secrets);
    if (!request) {
      await recordDelivery(row.storeId, row.id, adapter.platform, { status: "skipped", error: "لا مقابل للحدث أو إعداد ناقص" });
      continue;
    }
    const result = await postJson(request.url, request.body, request.headers);
    if (result.status === "failed") failures++;
    else if (result.status === "sent") succeeded++;
    await recordDelivery(row.storeId, row.id, adapter.platform, result);
  }

  return { failures, succeeded };
}

/**
 * عامل الطابور. يُستدعى دورياً (Cron) خارج مسار الطلب تماماً.
 * الفشل يُعاد مع تراجع أُسّي ويُسجَّل سببه لكل منصة على حدة.
 */
export async function processTrackingQueue(limit = 25) {
  let sent = 0;
  let failed = 0;
  const cache = new Map<string, IntegrationRuntime[]>();

  for (let i = 0; i < limit; i++) {
    const row = await claim();
    if (!row) break;

    let integrations = cache.get(row.storeId);
    if (!integrations) {
      integrations = await runtimeIntegrations(db, row.storeId);
      cache.set(row.storeId, integrations);
    }

    try {
      const { failures, succeeded } = await dispatch(row, integrations);
      if (failures === 0) {
        await db
          .update(trackingEvents)
          .set({ status: "sent", processedAt: new Date(), lastError: null, nextAttemptAt: new Date() })
          .where(eq(trackingEvents.id, row.id));
        sent++;
      } else {
        await markRetry(row, `${failures} منصة/منصات فشلت`, succeeded);
        failed++;
      }
    } catch (e) {
      await markRetry(row, e instanceof Error ? e.message : String(e), 0);
      failed++;
    }
  }

  return { sent, failed };
}

/** نفاد المحاولات مع نجاح جزئي يُسجَّل `partial` لا `failed`: بعض المنصات استلمت الحدث فعلاً. */
async function markRetry(row: typeof trackingEvents.$inferSelect, error: string, succeeded: number) {
  const attempts = row.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  const finalStatus = succeeded > 0 ? "partial" : "failed";
  await db
    .update(trackingEvents)
    .set({
      attempts,
      status: exhausted ? finalStatus : "pending",
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
    })
    .where(eq(trackingEvents.id, row.id));
}

/**
 * ملخص لشاشة الإعدادات: كم حدث معلّق وكم فشل، ومتى أقدم حدث ينتظر.
 * أقدم معلّق هو مؤشر عمل المجدول: بقاؤه دقائق طويلة يعني أن العامل لا يعمل أصلاً.
 */
export async function trackingHealth(storeId: string) {
  const [rows, [oldest]] = await Promise.all([
    db
      .select({ status: trackingEvents.status, count: sql<number>`count(*)::int` })
      .from(trackingEvents)
      .where(eq(trackingEvents.storeId, storeId))
      .groupBy(trackingEvents.status),
    db
      .select({ createdAt: trackingEvents.createdAt })
      .from(trackingEvents)
      .where(and(eq(trackingEvents.storeId, storeId), eq(trackingEvents.status, "pending")))
      .orderBy(trackingEvents.createdAt)
      .limit(1),
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  return {
    pending: by.pending ?? 0,
    sent: by.sent ?? 0,
    failed: by.failed ?? 0,
    partial: by.partial ?? 0,
    oldestPendingAt: oldest?.createdAt ?? null,
  };
}
