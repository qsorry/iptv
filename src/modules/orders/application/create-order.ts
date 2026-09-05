import { inArray, eq, and } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, productVariants, products, stores, warehouses } from "@/infrastructure/database/schema";
import { NotFoundError, ValidationError } from "@/core/errors";
import { publishEvent } from "@/core/events";
import { toMinor, toDecimal, multiply, sum, percentOf } from "@/core/money";
import { reserveStock } from "@/modules/inventory";
import { orderRepository } from "../infrastructure/order.repository";

export interface CreateOrderInput {
  storeId: string;
  cartId: string;
  customerId?: string;
  shippingAddress: {
    fullName: string;
    phone?: string;
    country: string;
    city: string;
    district?: string;
    street?: string;
    postalCode?: string;
  };
  notes?: string;
}

const VAT_PERCENT = 15;

/**
 * CreateOrder
 * ├── Validate cart
 * ├── Validate stock
 * ├── Calculate pricing (from current variant prices, NOT cart prices)
 * ├── Calculate tax
 * ├── Reserve inventory
 * ├── Create order + items + address snapshots
 * └── Emit order.created
 */
export async function createOrder(input: CreateOrderInput) {
  return db.transaction(async (tx) => {
    // قفل صف المتجر يجعل توليد order_number متسلسلاً وآمناً تحت التزامن.
    const [store] = await tx.select().from(stores).where(eq(stores.id, input.storeId)).for("update");
    if (!store) throw new NotFoundError("المتجر", input.storeId);

    const cart = await tx.query.carts.findFirst({
      where: and(eq(carts.id, input.cartId), eq(carts.storeId, input.storeId), eq(carts.status, "active")),
    });
    if (!cart) throw new NotFoundError("السلة", input.cartId);

    const lines = await tx.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    if (lines.length === 0) throw new ValidationError("السلة فارغة");

    const variantRows = await tx
      .select({ variant: productVariants, product: products })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, lines.map((l) => l.variantId)));
    const byId = new Map(variantRows.map((r) => [r.variant.id, r]));

    // التسعير يُعاد حسابه من الأسعار الحالية، لا من السلة.
    const items = lines.map((line) => {
      const found = byId.get(line.variantId);
      if (!found || !found.variant.isActive || found.product.status !== "active") {
        throw new ValidationError("أحد المنتجات لم يعد متاحاً", { variantId: line.variantId });
      }
      const unit = toMinor(found.variant.price);
      const lineTotal = multiply(unit, line.quantity);
      const tax = percentOf(lineTotal, VAT_PERCENT);
      return { line, found, unit, lineTotal, tax };
    });

    const subtotal = sum(...items.map((i) => i.lineTotal));
    const taxTotal = sum(...items.map((i) => i.tax));
    const grandTotal = subtotal + taxTotal;

    const warehouse = await tx.query.warehouses.findFirst({
      where: and(eq(warehouses.storeId, input.storeId), eq(warehouses.isDefault, true)),
    });
    if (!warehouse) throw new ValidationError("لا يوجد مستودع افتراضي للمتجر");

    const order = await orderRepository.insert(
      {
        storeId: input.storeId,
        customerId: input.customerId ?? cart.customerId,
        orderNumber: await orderRepository.nextOrderNumber(input.storeId, tx),
        currencyCode: store.currencyCode,
        subtotal: toDecimal(subtotal),
        taxTotal: toDecimal(taxTotal),
        grandTotal: toDecimal(grandTotal),
        notes: input.notes,
      },
      tx,
    );

    // حجز المخزون للمنتجات المادية فقط.
    const physical = items.filter((i) => i.found.product.productType === "physical");
    if (physical.length > 0) {
      await reserveStock(tx, {
        storeId: input.storeId,
        warehouseId: warehouse.id,
        orderId: order.id,
        lines: physical.map((i) => ({ variantId: i.line.variantId, quantity: i.line.quantity })),
      });
    }

    await orderRepository.insertItems(
      items.map((i) => ({
        orderId: order.id,
        productId: i.found.product.id,
        variantId: i.found.variant.id,
        productName: i.found.product.name,
        variantName: i.found.variant.name,
        sku: i.found.variant.sku,
        unitPrice: toDecimal(i.unit),
        quantity: i.line.quantity,
        taxTotal: toDecimal(i.tax),
        total: toDecimal(i.lineTotal + i.tax),
      })),
      tx,
    );

    await orderRepository.insertAddresses([{ orderId: order.id, type: "shipping", ...input.shippingAddress }], tx);
    await orderRepository.addEvent({ orderId: order.id, eventType: "order.created", description: "تم إنشاء الطلب" }, tx);
    await tx.update(carts).set({ status: "converted", updatedAt: new Date() }).where(eq(carts.id, cart.id));

    await publishEvent(tx, {
      storeId: input.storeId,
      type: "order.created",
      aggregateType: "order",
      aggregateId: order.id,
      payload: { orderNumber: order.orderNumber, grandTotal: order.grandTotal },
    });

    return order;
  });
}
