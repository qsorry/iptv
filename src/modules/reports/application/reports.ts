import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { orders, orderItems } from "@/infrastructure/database/schema";
import { toMinor, type Minor } from "@/core/money";

export interface StoreReport {
  ordersCount: number;
  paidCount: number;
  pendingCount: number;
  revenue: Minor; // من الطلبات المدفوعة
  daily: { day: string; revenue: Minor }[]; // آخر 14 يوماً
  topProducts: { name: string; quantity: number; revenue: Minor }[];
}

export async function storeReport(storeId: string): Promise<StoreReport> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      paid: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'paid')::int`,
      pending: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'unpaid')::int`,
      revenue: sql<string>`coalesce(sum(${orders.grandTotal}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
    })
    .from(orders)
    .where(eq(orders.storeId, storeId));

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const dailyRows = await db
    .select({
      day: sql<string>`to_char(${orders.placedAt}, 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(${orders.grandTotal}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), gte(orders.placedAt, since)))
    .groupBy(sql`to_char(${orders.placedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${orders.placedAt}, 'YYYY-MM-DD')`);
  const dailyMap = new Map(dailyRows.map((r) => [r.day, toMinor(r.revenue)]));
  const daily: { day: string; revenue: Minor }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    daily.push({ day: d, revenue: dailyMap.get(d) ?? 0 });
  }

  const top = await db
    .select({
      name: orderItems.productName,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${orderItems.total}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.storeId, storeId), eq(orders.paymentStatus, "paid")))
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  return {
    ordersCount: counts?.total ?? 0,
    paidCount: counts?.paid ?? 0,
    pendingCount: counts?.pending ?? 0,
    revenue: toMinor(counts?.revenue ?? "0"),
    daily,
    topProducts: top.map((t) => ({ name: t.name, quantity: t.quantity, revenue: toMinor(t.revenue) })),
  };
}
