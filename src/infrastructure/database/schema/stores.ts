import { pgTable, text, boolean, timestamp, jsonb, pgEnum, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, currencyCode } from "./_shared";

export const storeStatus = pgEnum("store_status", ["active", "suspended", "closed"]);

/** المتجر = المستأجر (Tenant). كل جدول تجاري يحمل store_id. */
export const stores = pgTable("stores", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: storeStatus("status").default("active").notNull(),
  currencyCode: currencyCode().default("SAR").notNull(),
  timezone: text("timezone").default("Asia/Riyadh").notNull(),
  locale: text("locale").default("ar").notNull(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#004d73").notNull(),
  description: text("description"),
  ...timestamps(),
});

export const storeDomains = pgTable(
  "store_domains",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    domain: text("domain").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("store_domains_domain_idx").on(t.domain)],
);

export const storeSettings = pgTable("store_settings", {
  storeId: uuid("store_id").primaryKey().references(() => stores.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps(),
});
