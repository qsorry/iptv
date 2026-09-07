import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { visitors } from "@/infrastructure/database/schema";
import { parseTouch, hasSource, type Touch } from "../domain/touch";

export interface CaptureVisitInput {
  storeId: string;
  visitorKey: string;
  url: string;
  referrer?: string | null;
  userAgent?: string | null;
  customerId?: string | null;
}

/**
 * يسجّل زيارة: ينشئ الزائر عند أول مرة (first touch نهائي)،
 * ويحدّث last touch فقط إن حملت الزيارة مصدراً — الزيارة المباشرة لا تمحو حملة سابقة.
 */
export async function captureVisit(input: CaptureVisitInput): Promise<Touch> {
  const touch = parseTouch({ url: input.url, referrer: input.referrer, userAgent: input.userAgent });
  const now = new Date();

  const existing = await db.query.visitors.findFirst({
    where: and(eq(visitors.storeId, input.storeId), eq(visitors.visitorKey, input.visitorKey)),
  });

  if (!existing) {
    const firstTouch: Touch = { ...touch, firstSeenAt: now.toISOString() };
    await db
      .insert(visitors)
      .values({
        storeId: input.storeId,
        visitorKey: input.visitorKey,
        customerId: input.customerId ?? null,
        firstTouch,
        lastTouch: touch,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoNothing({ target: [visitors.storeId, visitors.visitorKey] });
    return touch;
  }

  await db
    .update(visitors)
    .set({
      lastTouch: hasSource(touch) ? touch : existing.lastTouch,
      lastSeenAt: now,
      customerId: input.customerId ?? existing.customerId,
      updatedAt: now,
    })
    .where(eq(visitors.id, existing.id));

  return (existing.firstTouch ?? {}) as Touch;
}

/** لمسات الزائر كما هي مخزّنة (للنسخ إلى الطلب). */
export async function visitorTouches(storeId: string, visitorKey: string): Promise<{ first: Touch; last: Touch } | null> {
  const row = await db.query.visitors.findFirst({
    where: and(eq(visitors.storeId, storeId), eq(visitors.visitorKey, visitorKey)),
  });
  if (!row) return null;
  return { first: (row.firstTouch ?? {}) as Touch, last: (row.lastTouch ?? {}) as Touch };
}
