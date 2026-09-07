import { and, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { trackingDeliveries } from "@/infrastructure/database/schema";
import type { Platform } from "../domain/platforms";

export interface PlatformActivity {
  /** آخر إرسال ناجح إلى هذه المنصة. */
  lastSentAt: Date | null;
  /** محاولات فاشلة لم تُحلّ — سبب انتقال الصف إلى «يحتاج انتباه». */
  failed: number;
}

/**
 * نشاط كل منصة من سجل الإرسال: متى وصلها آخر حدث، وكم محاولة فاشلة عليها.
 * الصف في لوحة التحكم يقول «متصل» أو «يحتاج انتباه» من هنا لا من مجرد
 * كون التكامل مفعّلاً — تكامل مفعّل يفشل إرساله ليس متصلاً.
 */
export async function platformActivity(storeId: string): Promise<Partial<Record<Platform, PlatformActivity>>> {
  const rows = await db
    .select({
      platform: trackingDeliveries.platform,
      lastSentAt: sql<Date | null>`max(${trackingDeliveries.createdAt}) filter (where ${trackingDeliveries.status} = 'sent')`,
      failed: sql<number>`count(*) filter (where ${trackingDeliveries.status} = 'failed')::int`,
    })
    .from(trackingDeliveries)
    .where(eq(trackingDeliveries.storeId, storeId))
    .groupBy(trackingDeliveries.platform);

  const out: Partial<Record<Platform, PlatformActivity>> = {};
  for (const row of rows) {
    out[row.platform as Platform] = {
      lastSentAt: row.lastSentAt ? new Date(row.lastSentAt) : null,
      failed: row.failed,
    };
  }
  return out;
}

/** عدد المحاولات الفاشلة على منصة واحدة (للاستخدام السريع في الواجهة). */
export async function failedDeliveries(storeId: string, platform: Platform): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trackingDeliveries)
    .where(and(eq(trackingDeliveries.storeId, storeId), eq(trackingDeliveries.platform, platform), eq(trackingDeliveries.status, "failed")));
  return row?.count ?? 0;
}
