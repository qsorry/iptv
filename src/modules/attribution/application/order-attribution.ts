import { and, eq } from "drizzle-orm";
import { visitors } from "@/infrastructure/database/schema";
import type { DbExecutor } from "@/infrastructure/database/client";
import { TOUCH_KEYS, type Touch } from "../domain/touch";

/** أعمدة الإسناد على جدول orders — نسخ من الزائر لحظة إنشاء الطلب. */
export type OrderAttribution = Partial<Record<(typeof TOUCH_KEYS)[number], string | null>> & {
  visitorKey: string;
  firstTouch: Touch;
};

/**
 * يقرأ لمسات الزائر ويحوّلها إلى قيم تُكتب في صف الطلب.
 * last touch في الأعمدة (يُستعلم عليها في التقارير)، first touch لقطة JSON بجانبها.
 */
export async function orderAttributionFor(executor: DbExecutor, storeId: string, visitorKey: string): Promise<OrderAttribution | null> {
  const [row] = await executor
    .select()
    .from(visitors)
    .where(and(eq(visitors.storeId, storeId), eq(visitors.visitorKey, visitorKey)))
    .limit(1);
  if (!row) return null;

  const last = (row.lastTouch ?? {}) as Touch;
  const columns: Partial<Record<(typeof TOUCH_KEYS)[number], string | null>> = {};
  for (const key of TOUCH_KEYS) columns[key] = last[key] ?? null;

  return { ...columns, visitorKey, firstTouch: (row.firstTouch ?? {}) as Touch };
}
