import { db } from "@/infrastructure/database/client";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";
import { inventoryRepository } from "../infrastructure/inventory.repository";

type MovementType = "initial" | "purchase" | "return" | "adjustment" | "damage" | "transfer_in" | "transfer_out";

export interface AdjustStockInput {
  warehouseId: string;
  variantId: string;
  type: MovementType;
  /** موجب للإضافة، سالب للخصم. */
  quantity: number;
  note?: string;
}

/** تعديل يدوي للمخزون. كل تعديل يترك حركة في السجل. */
export async function adjustStock(ctx: StoreContext, input: AdjustStockInput) {
  requireRole(ctx, "owner", "admin", "staff");
  if (!Number.isInteger(input.quantity) || input.quantity === 0) throw new ValidationError("الكمية يجب أن تكون عدداً صحيحاً غير صفري");

  return db.transaction(async (tx) => {
    const current = await inventoryRepository.lockLevel(input.warehouseId, input.variantId, tx);
    const nextAvailable = (current?.availableQuantity ?? 0) + input.quantity;
    if (nextAvailable < 0) throw new ValidationError("لا يمكن أن يصبح المخزون سالباً");

    const level = await inventoryRepository.upsertLevel(input.warehouseId, input.variantId, input.quantity, 0, tx);
    await inventoryRepository.recordMovement(
      {
        storeId: ctx.storeId,
        warehouseId: input.warehouseId,
        variantId: input.variantId,
        type: input.type,
        quantity: input.quantity,
        note: input.note,
        createdBy: ctx.userId,
      },
      tx,
    );
    return level;
  });
}
