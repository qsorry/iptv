import { and, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { inventoryLevels, inventoryMovements } from "@/infrastructure/database/schema";

export const inventoryRepository = {
  /** يقفل الصف (FOR UPDATE) لضمان عدم تجاوز البيع للمخزون تحت التزامن. */
  async lockLevel(warehouseId: string, variantId: string, executor: DbExecutor) {
    const [row] = await executor
      .select()
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.warehouseId, warehouseId), eq(inventoryLevels.variantId, variantId)))
      .for("update");
    return row ?? null;
  },

  async upsertLevel(warehouseId: string, variantId: string, deltaAvailable: number, deltaReserved: number, executor: DbExecutor = db) {
    const [row] = await executor
      .insert(inventoryLevels)
      .values({ warehouseId, variantId, availableQuantity: Math.max(deltaAvailable, 0), reservedQuantity: Math.max(deltaReserved, 0) })
      .onConflictDoUpdate({
        target: [inventoryLevels.warehouseId, inventoryLevels.variantId],
        set: {
          availableQuantity: sql`${inventoryLevels.availableQuantity} + ${deltaAvailable}`,
          reservedQuantity: sql`${inventoryLevels.reservedQuantity} + ${deltaReserved}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  /**
   * القابل للبيع لخيار عبر كل المستودعات (available - reserved)، أو null إن لم يكن له مستوى مخزون
   * (منتج لا يتتبّع المخزون). تُستخدم لعرض التوفر في واجهة المتجر وJSON-LD.
   */
  async sellableForVariant(variantId: string, executor: DbExecutor = db): Promise<number | null> {
    const [row] = await executor
      .select({
        levels: sql<number>`count(*)::int`,
        sellable: sql<number>`coalesce(sum(${inventoryLevels.availableQuantity} - ${inventoryLevels.reservedQuantity}), 0)::int`,
      })
      .from(inventoryLevels)
      .where(eq(inventoryLevels.variantId, variantId));
    return row && row.levels > 0 ? row.sellable : null;
  },

  async recordMovement(values: typeof inventoryMovements.$inferInsert, executor: DbExecutor = db) {
    const [row] = await executor.insert(inventoryMovements).values(values).returning();
    return row;
  },
};
