import { pgTable, text, integer, boolean, timestamp, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps, money } from "./_shared";
import { stores } from "./stores";
import { orders } from "./orders";
import { customers } from "./customers";

export const discountType = pgEnum("discount_type", ["percentage", "fixed"]);

/**
 * كوبون خصم لكل متجر. نموذج مبسّط لكن قابل للتوسّع لاحقاً إلى promotions/rules/actions.
 * value: للنسبة رقم مئوي (مثل 20)، وللمبلغ الثابت بالعملة (numeric).
 */
export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    code: text("code").notNull(),
    discountType: discountType("discount_type").notNull(),
    value: money("value").notNull(),
    minOrderAmount: money("min_order_amount"),
    maxDiscount: money("max_discount"),
    usageLimit: integer("usage_limit"),
    usageLimitPerCustomer: integer("usage_limit_per_customer"),
    usedCount: integer("used_count").default(0).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("coupons_store_code_idx").on(t.storeId, t.code)],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "cascade" }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("coupon_redemptions_coupon_idx").on(t.couponId), index("coupon_redemptions_customer_idx").on(t.customerId)],
);
