/**
 * اختبار دخاني لتدفق الطلب الكامل على قاعدة بيانات حقيقية.
 * التشغيل: DATABASE_URL=... npx tsx scripts/dev/smoke-order-flow.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, customers, domainEvents, inventoryLevels, orderItems, users, warehouses } from "@/infrastructure/database/schema";
import { createStore } from "@/modules/stores";
import { createProduct } from "@/modules/catalog";
import { adjustStock } from "@/modules/inventory";
import { createOrder, transitionOrder } from "@/modules/orders";
import { InsufficientStockError, InvalidStateTransitionError } from "@/core/errors";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`✓ ${msg}`);
};

async function main() {
  const [owner] = await db.insert(users).values({ name: "Owner", email: `owner${Date.now()}@test.com` }).returning();
  const store = await createStore({ name: `متجر تجريبي ${Date.now()}`, ownerUserId: owner.id });
  const ctx = { storeId: store.id, userId: owner.id, role: "owner" as const };
  assert(store.currencyCode === "SAR", "إنشاء المتجر بعملة SAR");

  const wh = await db.query.warehouses.findFirst({ where: eq(warehouses.storeId, store.id) });
  assert(wh?.isDefault, "المستودع الافتراضي أُنشئ مع المتجر");

  const product = await createProduct(ctx, {
    name: "قميص قطني",
    productType: "physical",
    status: "active",
    variants: [
      { name: "أبيض / M", sku: "TS-W-M", price: "100.00", isDefault: true },
      { name: "أبيض / L", sku: "TS-W-L", price: "120.50", isDefault: false },
    ],
  });
  assert(product.variants.length === 2 && product.slug === "قميص-قطني", "إنشاء منتج مع variants وslug عربي");

  const [m, l] = product.variants;
  await adjustStock(ctx, { warehouseId: wh!.id, variantId: m.id, type: "initial", quantity: 5 });
  await adjustStock(ctx, { warehouseId: wh!.id, variantId: l.id, type: "initial", quantity: 1 });

  const [customer] = await db.insert(customers).values({ storeId: store.id, email: `c${Date.now()}@test.com` }).returning();
  const [cart] = await db.insert(carts).values({ storeId: store.id, customerId: customer.id, currencyCode: "SAR" }).returning();
  // سعر السلة عمداً خاطئ (1.00) للتأكد أن الطلب يعيد التسعير من الـ variant.
  await db.insert(cartItems).values([
    { cartId: cart.id, variantId: m.id, quantity: 2, unitPrice: "1.00" },
    { cartId: cart.id, variantId: l.id, quantity: 1, unitPrice: "1.00" },
  ]);

  const order = await createOrder({
    storeId: store.id,
    cartId: cart.id,
    shippingAddress: { fullName: "عميل", country: "SA", city: "الرياض" },
  });
  // 2×100 + 120.50 = 320.50 ; ضريبة 15% = 48.08 (48.075 → 48.08) ; الإجمالي 368.58
  assert(order.subtotal === "320.50", `المجموع الفرعي من أسعار الـ variant لا السلة (${order.subtotal})`);
  assert(order.taxTotal === "48.08" && order.grandTotal === "368.58", `الضريبة 15% والإجمالي (${order.taxTotal} / ${order.grandTotal})`);
  assert(order.orderNumber === "1001", `رقم الطلب المتسلسل (${order.orderNumber})`);

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  assert(items.length === 2 && items.every((i) => i.productName === "قميص قطني"), "snapshot عناصر الطلب");

  const lvl = await db.query.inventoryLevels.findFirst({ where: eq(inventoryLevels.variantId, m.id) });
  assert(lvl?.availableQuantity === 5 && lvl?.reservedQuantity === 2, "حجز المخزون (available 5 / reserved 2)");

  const convertedCart = await db.query.carts.findFirst({ where: eq(carts.id, cart.id) });
  assert(convertedCart?.status === "converted", "تحويل حالة السلة");

  // محاولة طلب ثانٍ لنفس L (متبقٍ 0 قابل للبيع) يجب أن تفشل.
  const [cart2] = await db.insert(carts).values({ storeId: store.id, currencyCode: "SAR" }).returning();
  await db.insert(cartItems).values({ cartId: cart2.id, variantId: l.id, quantity: 1, unitPrice: "0" });
  await createOrder({ storeId: store.id, cartId: cart2.id, shippingAddress: { fullName: "x", country: "SA", city: "جدة" } })
    .then(() => assert(false, "يجب رفض الطلب عند نفاد المخزون"))
    .catch((e) => assert(e instanceof InsufficientStockError, "رفض الطلب عند نفاد المخزون القابل للبيع"));

  const confirmed = await transitionOrder(ctx, order.id, "confirmed");
  assert(confirmed.status === "confirmed", "pending → confirmed");
  await transitionOrder(ctx, order.id, "completed")
    .then(() => assert(false, "يجب منع confirmed → completed"))
    .catch((e) => assert(e instanceof InvalidStateTransitionError, "آلة الحالة تمنع confirmed → completed"));

  const events = await db.query.domainEvents.findMany({ where: eq(domainEvents.storeId, store.id) });
  assert(events.some((e) => e.eventType === "order.created") && events.some((e) => e.eventType === "order.confirmed"), "أحداث outbox مكتوبة");

  console.log("\nكل الاختبارات نجحت.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit());
