import { eq, and } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, customers, productVariants } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { createOrder } from "./create-order";

export interface ManualOrderInput {
  variantId: string;
  quantity: number;
  customerEmail?: string;
  customerName?: string;
  couponCode?: string;
}

/**
 * إنشاء طلب يدوي من لوحة التحكم (بيع مباشر / POS).
 * يبني سلة مؤقتة ثم يعيد استخدام createOrder ليمرّ بنفس منطق التسعير والحجز.
 */
export async function createManualOrder(ctx: StoreContext, input: ManualOrderInput) {
  requireRole(ctx, "owner", "admin", "staff");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new ValidationError("الكمية يجب أن تكون 1 أو أكثر");

  const variant = await db.query.productVariants.findFirst({
    where: and(eq(productVariants.id, input.variantId), eq(productVariants.storeId, ctx.storeId)),
  });
  if (!variant) throw new NotFoundError("المتغيّر", input.variantId);

  let customerId: string | undefined;
  if (input.customerEmail) {
    const [c] = await db
      .insert(customers)
      .values({ storeId: ctx.storeId, email: input.customerEmail, firstName: input.customerName })
      .returning();
    customerId = c.id;
  }

  const [cart] = await db.insert(carts).values({ storeId: ctx.storeId, customerId, currencyCode: "SAR" }).returning();
  await db.insert(cartItems).values({ cartId: cart.id, variantId: input.variantId, quantity: input.quantity, unitPrice: variant.price });

  return createOrder({
    storeId: ctx.storeId,
    cartId: cart.id,
    customerId,
    couponCode: input.couponCode,
    shippingAddress: { fullName: input.customerName ?? "عميل", country: "SA", city: "-" },
  });
}
