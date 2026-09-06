import { pgTable, text, boolean, integer, timestamp, jsonb, pgEnum, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";
import { productVariants } from "./catalog";
import { orders, orderItems } from "./orders";

export const provisionStatus = pgEnum("provision_status", ["pending", "succeeded", "failed"]);

/**
 * مزوّد اشتراكات رقمية مرتبط بالمتجر عبر API (لوحة IPTV، مفاتيح، ...).
 * `preset` يحدد القالب الجاهز (shebik / falcon) أو `generic` لأي API آخر عبر `config`.
 * `apiKey` مُشفَّر (AES-GCM) بمفتاح مشتق من BETTER_AUTH_SECRET.
 */
export const subscriptionProviders = pgTable(
  "subscription_providers",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    preset: text("preset").notNull(), // shebik | falcon | generic
    baseUrl: text("base_url").notNull(),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    /** قالب الاتصال (المصادقة، مسارات الإنشاء والباقات، خرائط الحقول). انظر integrations/subscriptions. */
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [index("subscription_providers_store_idx").on(t.storeId)],
);

/** ربط variant بمزوّد وباقة: عند دفع طلب يحوي هذا الـ variant يُنشأ الاشتراك تلقائياً. */
export const subscriptionMappings = pgTable(
  "subscription_mappings",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
    providerId: uuid("provider_id").references(() => subscriptionProviders.id, { onDelete: "cascade" }).notNull(),
    /** معرّف الباقة لدى المزوّد (package_id / bouquet / plan). */
    packageId: text("package_id").notNull(),
    /** معاملات إضافية تُرسل للمزوّد (المدة بالأشهر، عدد الاتصالات، ...). */
    params: jsonb("params").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("subscription_mappings_variant_idx").on(t.variantId), index("subscription_mappings_store_idx").on(t.storeId)],
);

/**
 * سجل كل محاولة تزويد (Provisioning) لعنصر طلب. صف لكل وحدة كمية (sequence).
 * عند النجاح تُكتب بيانات الاشتراك في `credentials` وتُدرج ككود مُسلَّم في digital_codes.
 */
export const subscriptionProvisions = pgTable(
  "subscription_provisions",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }).notNull(),
    sequence: integer("sequence").default(1).notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    providerId: uuid("provider_id").references(() => subscriptionProviders.id, { onDelete: "set null" }),
    status: provisionStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    request: jsonb("request").$type<Record<string, unknown>>(),
    response: jsonb("response").$type<Record<string, unknown>>(),
    credentials: jsonb("credentials").$type<Record<string, unknown>>(),
    /** النص المُسلَّم للعميل (نفس صيغة digital_codes). */
    deliveredCode: text("delivered_code"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("subscription_provisions_item_seq_idx").on(t.orderItemId, t.sequence),
    index("subscription_provisions_store_status_idx").on(t.storeId, t.status, t.createdAt),
    index("subscription_provisions_order_idx").on(t.orderId),
  ],
);
