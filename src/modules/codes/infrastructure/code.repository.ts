import { and, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { digitalCodes } from "@/infrastructure/database/schema";

export const codeRepository = {
  /** عدد الأكواد حسب الحالة لكل variant. */
  async summary(storeId: string, variantId: string) {
    const rows = await db
      .select({ status: digitalCodes.status, count: sql<number>`count(*)::int` })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.variantId, variantId)))
      .groupBy(digitalCodes.status);
    const out = { available: 0, reserved: 0, delivered: 0, disabled: 0 };
    for (const r of rows) out[r.status] = r.count;
    return out;
  },

  /** عدد المتاح لبيعه من variant. */
  async availableCount(storeId: string, variantId: string, executor: DbExecutor = db) {
    const [row] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.variantId, variantId), eq(digitalCodes.status, "available")));
    return row?.count ?? 0;
  },

  /**
   * يحجز ويُسلّم عدداً من الأكواد المتاحة لـ variant داخل transaction.
   * FOR UPDATE SKIP LOCKED يمنع تسليم نفس الكود لطلبين متزامنين.
   */
  async claimForOrder(
    executor: DbExecutor,
    params: { storeId: string; variantId: string; quantity: number; orderId: string; orderItemId: string },
  ) {
    const picked = await executor
      .select({ id: digitalCodes.id })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, params.storeId), eq(digitalCodes.variantId, params.variantId), eq(digitalCodes.status, "available")))
      .limit(params.quantity)
      .for("update", { skipLocked: true });

    if (picked.length === 0) return [];

    const ids = picked.map((p) => p.id);
    const updated = await executor
      .update(digitalCodes)
      .set({ status: "delivered", orderId: params.orderId, orderItemId: params.orderItemId, deliveredAt: new Date(), updatedAt: new Date() })
      .where(sql`${digitalCodes.id} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)
      .returning({ code: digitalCodes.code });
    return updated.map((u) => u.code);
  },

  /** الأكواد المُسلَّمة لطلب (للعرض للمشتري بعد نجاح الدفع). */
  async deliveredForOrder(storeId: string, orderId: string) {
    return db
      .select({ code: digitalCodes.code, orderItemId: digitalCodes.orderItemId, deliveredAt: digitalCodes.deliveredAt })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.orderId, orderId), eq(digitalCodes.status, "delivered")));
  },
};
