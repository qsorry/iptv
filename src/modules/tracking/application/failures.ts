import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { trackingDeliveries, trackingEvents } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError } from "@/core/errors";

export interface FailedEventView {
  id: string;
  eventId: string;
  eventName: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  failedPlatforms: { platform: string; error: string | null; statusCode: number | null }[];
}

/** سجل الإرسال الفاشل — أساس شاشة إعادة المحاولة اليدوية. */
export async function listFailedEvents(storeId: string, limit = 50): Promise<FailedEventView[]> {
  const rows = await db
    .select()
    .from(trackingEvents)
    // partial = نفدت المحاولات بعد نجاح بعض المنصات؛ يستحق العرض وإعادة المحاولة كذلك.
    .where(and(eq(trackingEvents.storeId, storeId), inArray(trackingEvents.status, ["failed", "partial"])))
    .orderBy(desc(trackingEvents.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const deliveries = await db
    .select()
    .from(trackingDeliveries)
    .where(eq(trackingDeliveries.storeId, storeId));
  const byEvent = new Map<string, typeof deliveries>();
  for (const d of deliveries) {
    if (d.status !== "failed") continue;
    byEvent.set(d.trackingEventId, [...(byEvent.get(d.trackingEventId) ?? []), d]);
  }

  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    eventName: r.eventName,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError,
    createdAt: r.createdAt,
    failedPlatforms: (byEvent.get(r.id) ?? []).map((d) => ({ platform: d.platform, error: d.error, statusCode: d.statusCode })),
  }));
}

/** إعادة الحدث للطابور. المنصات التي نجحت سابقاً لا يُعاد إرسالها. */
export async function retryTrackingEvent(ctx: StoreContext, trackingEventId: string) {
  requireRole(ctx, "owner", "admin");
  const [row] = await db
    .update(trackingEvents)
    .set({ status: "pending", attempts: 0, lastError: null, nextAttemptAt: new Date() })
    .where(and(eq(trackingEvents.id, trackingEventId), eq(trackingEvents.storeId, ctx.storeId)))
    .returning({ id: trackingEvents.id });
  if (!row) throw new NotFoundError("حدث التتبّع", trackingEventId);
}
