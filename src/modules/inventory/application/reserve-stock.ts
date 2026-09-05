import type { DbExecutor } from "@/infrastructure/database/client";
import { InsufficientStockError } from "@/core/errors";
import { inventoryRepository } from "../infrastructure/inventory.repository";

export interface ReserveLine {
  variantId: string;
  quantity: number;
}

/**
 * حجز مخزون لطلب. يُستدعى داخل transaction إنشاء الطلب.
 * القابل للبيع = available - reserved.
 */
export async function reserveStock(
  executor: DbExecutor,
  params: { storeId: string; warehouseId: string; orderId: string; lines: ReserveLine[] },
) {
  for (const line of params.lines) {
    const level = await inventoryRepository.lockLevel(params.warehouseId, line.variantId, executor);
    const sellable = (level?.availableQuantity ?? 0) - (level?.reservedQuantity ?? 0);
    if (sellable < line.quantity) throw new InsufficientStockError(line.variantId, line.quantity, Math.max(sellable, 0));

    await inventoryRepository.upsertLevel(params.warehouseId, line.variantId, 0, line.quantity, executor);
    await inventoryRepository.recordMovement(
      {
        storeId: params.storeId,
        warehouseId: params.warehouseId,
        variantId: line.variantId,
        type: "reserve",
        quantity: line.quantity,
        referenceType: "order",
        referenceId: params.orderId,
      },
      executor,
    );
  }
}
