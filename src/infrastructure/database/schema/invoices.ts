import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, money, currencyCode } from "./_shared";
import { stores } from "./stores";
import { orders } from "./orders";

/** فاتورة ضريبية مبسّطة (ZATCA المرحلة الأولى) لكل طلب مدفوع. */
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "restrict" }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }).notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    sellerName: text("seller_name").notNull(),
    vatNumber: text("vat_number"),
    subtotal: money("subtotal").notNull(),
    taxTotal: money("tax_total").notNull(),
    total: money("total").notNull(),
    currencyCode: currencyCode().notNull(),
    /** بيانات QR بترميز TLV base64 (ZATCA). */
    qrData: text("qr_data").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("invoices_order_idx").on(t.orderId), uniqueIndex("invoices_store_number_idx").on(t.storeId, t.invoiceNumber)],
);
