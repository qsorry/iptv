import { pgTable, text, boolean, timestamp, jsonb, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, money } from "./_shared";
import { stores } from "./stores";

/**
 * الباقات المركزية للمنصة. `features` قائمة مفاتيح الميزات التي تتضمنها الباقة
 * (مثل: notify.email, notify.whatsapp, notify.sms, salla.import).
 */
export const plans = pgTable("plans", {
  id: id(),
  code: text("code").notNull().unique(), // free, pro, business
  name: text("name").notNull(),
  price: money("price").default("0").notNull(),
  features: jsonb("features").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps(),
});

/** اشتراك المتجر في باقة. */
export const storeSubscriptions = pgTable(
  "store_subscriptions",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "restrict" }).notNull(),
    status: text("status").default("active").notNull(), // active, past_due, cancelled
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("store_subscriptions_store_idx").on(t.storeId)],
);

/**
 * تفعيل ميزة مفردة لمتجر بغض النظر عن الباقة (منح يدوي مركزي).
 * التحقق النهائي = ميزات الباقة ∪ التفعيلات المفردة المفعّلة.
 */
export const storeEntitlements = pgTable(
  "store_entitlements",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    feature: text("feature").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("store_entitlements_store_feature_idx").on(t.storeId, t.feature)],
);
