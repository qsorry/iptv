import { pgTable, text, timestamp, pgEnum, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";
import { productVariants } from "./catalog";
import { orders, orderItems } from "./orders";

export const codeStatus = pgEnum("code_status", ["available", "reserved", "delivered", "disabled"]);

/**
 * مخزون أكواد رقمية لكل variant (اشتراك IPTV، مفتاح تفعيل، ...).
 * التاجر يلصق مجموعة أكواد؛ كل صف كود واحد. التخصيص للطلب يتم عند نجاح الدفع.
 */
export const digitalCodes = pgTable(
  "digital_codes",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
    code: text("code").notNull(),
    status: codeStatus("status").default("available").notNull(),
    // تُملأ عند التخصيص لطلب.
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    // نفس الكود لا يتكرر داخل نفس المتجر.
    uniqueIndex("digital_codes_store_code_idx").on(t.storeId, t.code),
    // البحث عن كود متاح لـ variant معيّن.
    index("digital_codes_variant_status_idx").on(t.variantId, t.status),
    index("digital_codes_order_idx").on(t.orderId),
  ],
);
