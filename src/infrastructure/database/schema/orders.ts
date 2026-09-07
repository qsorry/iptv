import { pgTable, text, integer, timestamp, jsonb, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps, money, currencyCode } from "./_shared";
import { stores } from "./stores";
import { customers } from "./customers";
import { addressType } from "./customers";

export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "processing", "completed", "cancelled"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "authorized", "paid", "partially_refunded", "refunded", "failed"]);
export const fulfillmentStatus = pgEnum("fulfillment_status", ["unfulfilled", "partially_fulfilled", "fulfilled"]);

/** ثلاث حالات مستقلة: الطلب، الدفع، التنفيذ. لا حالة واحدة مدمجة. */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "restrict" }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderNumber: text("order_number").notNull(),
    currencyCode: currencyCode().notNull(),
    status: orderStatus("status").default("pending").notNull(),
    paymentStatus: paymentStatus("payment_status").default("unpaid").notNull(),
    fulfillmentStatus: fulfillmentStatus("fulfillment_status").default("unfulfilled").notNull(),
    subtotal: money("subtotal").notNull(),
    discountTotal: money("discount_total").default("0").notNull(),
    shippingTotal: money("shipping_total").default("0").notNull(),
    taxTotal: money("tax_total").default("0").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    // إسناد الطلب: نسخة لا ربط. لو حُذف الزائر أو تغيّرت جلسته يبقى تاريخ الطلب كما هو.
    visitorKey: text("visitor_key"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    gclid: text("gclid"),
    fbclid: text("fbclid"),
    ttclid: text("ttclid"),
    sccid: text("sccid"),
    msclkid: text("msclkid"),
    referrer: text("referrer"),
    landingPage: text("landing_page"),
    device: text("device"),
    /** لقطة first touch كاملة إلى جانب last touch أعلاه. */
    firstTouch: jsonb("first_touch").$type<Record<string, string | null>>(),
    placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("orders_store_number_idx").on(t.storeId, t.orderNumber),
    index("orders_store_status_idx").on(t.storeId, t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_store_source_idx").on(t.storeId, t.utmSource),
  ],
);

/** Snapshot كامل. لا يُعتمد على المنتج الحالي بعد إنشاء الطلب. */
export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id"),
  variantId: uuid("variant_id"),
  productName: text("product_name").notNull(),
  variantName: text("variant_name"),
  sku: text("sku"),
  unitPrice: money("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  discountTotal: money("discount_total").default("0").notNull(),
  taxTotal: money("tax_total").default("0").notNull(),
  total: money("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderAddresses = pgTable("order_addresses", {
  id: id(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  type: addressType("type").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  country: text("country").notNull(),
  city: text("city").notNull(),
  district: text("district"),
  street: text("street"),
  postalCode: text("postal_code"),
});

/** Timeline الطلب: order.created, payment.completed, shipment.created ... */
export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);
