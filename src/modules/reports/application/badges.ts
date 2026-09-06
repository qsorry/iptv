import { and, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { orders, reviews } from "@/infrastructure/database/schema";

/** أعداد للشارات في القائمة الجانبية. */
export async function sidebarBadges(storeId: string) {
  const [o] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.paymentStatus, "unpaid")));
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.storeId, storeId), eq(reviews.status, "pending")));
  return { pendingOrders: o?.n ?? 0, pendingReviews: r?.n ?? 0 };
}
