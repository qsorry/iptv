import { inArray, eq, and } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, productVariants, products, stores, storeSettings, warehouses } from "@/infrastructure/database/schema";
import { NotFoundError, ValidationError } from "@/core/errors";
import { publishEvent } from "@/core/events";
import { toMinor, toDecimal, multiply, sum, percentOf } from "@/core/money";
import { reserveStock } from "@/modules/inventory";
import { applyCoupon, recordRedemption } from "@/modules/promotions";
import { orderAttributionFor } from "@/modules/attribution";
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
  /** رمز كوبون اختياري يُطبَّق على المجموع الفرعي. */
  couponCode?: string;
  /** معرّف الزائر من الكوكي: تُنسخ منه قيم الإسناد إلى صف الطلب. */
  visitorKey?: string | null;
}

const DEFAULT_VAT_PERCENT = 15;

/** نسبة الضريبة للمتجر من إعداداته، وإلا 15%. */
function taxPercentFor(settings: Record<string, unknown> | null | undefined): number {
  const v = settings?.taxPercent;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_VAT_PERCENT;
}

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
      return { line, found, unit, lineTotal };
    });

    const subtotal = sum(...items.map((i) => i.lineTotal));
    const customerId = input.customerId ?? cart.customerId ?? undefined;

    // الخصم قبل الضريبة.
    let discountTotal = 0;
    let coupon: { couponId: string; code: string; discount: number } | null = null;
    if (input.couponCode) {
      coupon = await applyCoupon(tx, { storeId: input.storeId, code: input.couponCode, subtotal, customerId });
      discountTotal = coupon.discount;
    }

    const settings = await tx.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, input.storeId) });
    const taxPercent = taxPercentFor(settings?.settings);
    const taxableBase = subtotal - discountTotal;
    const taxTotal = percentOf(taxableBase, taxPercent);
    const grandTotal = taxableBase + taxTotal;

    const warehouse = await tx.query.warehouses.findFirst({
      where: and(eq(warehouses.storeId, input.storeId), eq(warehouses.isDefault, true)),
    });
    if (!warehouse) throw new ValidationError("لا يوجد مستودع افتراضي للمتجر");

    // الإسناد يُنسخ لا يُربط: حذف الزائر أو تغيّر جلسته لا يغيّر تاريخ الطلب.
    const attribution = input.visitorKey ? await orderAttributionFor(tx, input.storeId, input.visitorKey) : null;

    const order = await orderRepository.insert(
      {
        ...(attribution ?? {}),
        storeId: input.storeId,
        customerId,
        orderNumber: await orderRepository.nextOrderNumber(input.storeId, tx),
        currencyCode: store.currencyCode,
        subtotal: toDecimal(subtotal),
        discountTotal: toDecimal(discountTotal),
        taxTotal: toDecimal(taxTotal),
        grandTotal: toDecimal(grandTotal),
        notes: input.notes,
      },
      tx,
    );

    if (coupon) {
      await recordRedemption(tx, { couponId: coupon.couponId, orderId: order.id, customerId, amountMinor: discountTotal });
    }

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
        total: toDecimal(i.lineTotal),
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
