import { pgTable, text, integer, timestamp, jsonb, pgEnum, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, money, currencyCode } from "./_shared";
import { stores } from "./stores";
import { orders, orderItems } from "./orders";

export const transactionType = pgEnum("transaction_type", ["authorization", "capture", "sale", "refund", "void"]);
export const transactionStatus = pgEnum("transaction_status", ["pending", "processing", "succeeded", "failed", "cancelled"]);
export const refundStatus = pgEnum("refund_status", ["pending", "approved", "processed", "rejected"]);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "restrict" }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }).notNull(),
    provider: text("provider").notNull(),
    transactionType: transactionType("transaction_type").notNull(),
    status: transactionStatus("status").default("pending").notNull(),
    amount: money("amount").notNull(),
    currencyCode: currencyCode().notNull(),
    providerTransactionId: text("provider_transaction_id"),
    requestData: jsonb("request_data").$type<Record<string, unknown>>(),
    responseData: jsonb("response_data").$type<Record<string, unknown>>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("payment_transactions_order_idx").on(t.orderId), uniqueIndex("payment_transactions_provider_tx_idx").on(t.provider, t.providerTransactionId)],
);

export const refunds = pgTable("refunds", {
  id: id(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "restrict" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "restrict" }).notNull(),
  paymentTransactionId: uuid("payment_transaction_id").references(() => paymentTransactions.id, { onDelete: "set null" }),
  amount: money("amount").notNull(),
  reason: text("reason"),
  status: refundStatus("status").default("pending").notNull(),
  createdBy: uuid("created_by"),
  ...timestamps(),
});

export const refundItems = pgTable("refund_items", {
  id: id(),
  refundId: uuid("refund_id").references(() => refunds.id, { onDelete: "cascade" }).notNull(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "restrict" }).notNull(),
  quantity: integer("quantity").notNull(),
  amount: money("amount").notNull(),
});
