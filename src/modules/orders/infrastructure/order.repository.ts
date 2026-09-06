import { and, eq, sql, desc } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { orders, orderItems, orderAddresses, orderEvents } from "@/infrastructure/database/schema";
import { offsetOf, paginate, type Pagination } from "@/core/pagination";

export const orderRepository = {
  /** رقم طلب متسلسل لكل متجر. يجب أن يكون صف المتجر مقفولاً (FOR UPDATE) قبل الاستدعاء. */
  async nextOrderNumber(storeId: string, executor: DbExecutor): Promise<string> {
    const [{ count }] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.storeId, storeId));
    return String(1000 + count + 1);
  },

  async list(storeId: string, p: Pagination, executor: DbExecutor = db) {
    const where = eq(orders.storeId, storeId);
    const [rows, [{ count }]] = await Promise.all([
      executor.select().from(orders).where(where).orderBy(desc(orders.placedAt)).limit(p.perPage).offset(offsetOf(p)),
      executor.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
    ]);
    return paginate(rows, count, p);
  },

  itemsFor: (orderId: string, executor: DbExecutor = db) => executor.select().from(orderItems).where(eq(orderItems.orderId, orderId)),

  async findById(storeId: string, id: string, executor: DbExecutor = db) {
    return executor.query.orders.findFirst({ where: and(eq(orders.storeId, storeId), eq(orders.id, id)) });
  },

  async insert(values: typeof orders.$inferInsert, executor: DbExecutor) {
    const [row] = await executor.insert(orders).values(values).returning();
    return row;
  },

  insertItems: (values: (typeof orderItems.$inferInsert)[], executor: DbExecutor) => executor.insert(orderItems).values(values).returning(),

  insertAddresses: (values: (typeof orderAddresses.$inferInsert)[], executor: DbExecutor) =>
    executor.insert(orderAddresses).values(values).returning(),

  addEvent: (values: typeof orderEvents.$inferInsert, executor: DbExecutor) => executor.insert(orderEvents).values(values),

  async updateStatus(id: string, patch: Partial<Pick<typeof orders.$inferInsert, "status" | "paymentStatus" | "fulfillmentStatus" | "cancelledAt">>, executor: DbExecutor) {
    const [row] = await executor.update(orders).set({ ...patch, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return row;
  },
};
