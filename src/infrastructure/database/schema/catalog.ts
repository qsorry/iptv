import { pgTable, text, integer, boolean, timestamp, pgEnum, uuid, uniqueIndex, index, primaryKey, numeric, foreignKey } from "drizzle-orm/pg-core";
import { id, timestamps, money } from "./_shared";
import { stores } from "./stores";

export const productType = pgEnum("product_type", ["physical", "digital", "service"]);
export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);
export const categoryStatus = pgEnum("category_status", ["active", "hidden"]);
export const mediaType = pgEnum("media_type", ["image", "video"]);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    status: categoryStatus("status").default("active").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("categories_store_slug_idx").on(t.storeId, t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const brands = pgTable(
  "brands",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("brands_store_slug_idx").on(t.storeId, t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    productType: productType("product_type").default("physical").notNull(),
    status: productStatus("status").default("draft").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("products_store_slug_idx").on(t.storeId, t.slug), index("products_store_status_idx").on(t.storeId, t.status)],
);

/** السعر والمخزون على مستوى الـ Variant دائماً، حتى للمنتج البسيط (variant افتراضي واحد). */
export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    name: text("name").notNull(),
    price: money("price").notNull(),
    compareAtPrice: money("compare_at_price"),
    costPrice: money("cost_price"),
    weight: numeric("weight", { precision: 10, scale: 3 }),
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("product_variants_store_sku_idx").on(t.storeId, t.sku), index("product_variants_product_idx").on(t.productId)],
);

export const productOptions = pgTable("product_options", {
  id: id(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  position: integer("position").default(0).notNull(),
});

export const productOptionValues = pgTable("product_option_values", {
  id: id(),
  optionId: uuid("option_id").references(() => productOptions.id, { onDelete: "cascade" }).notNull(),
  value: text("value").notNull(),
  position: integer("position").default(0).notNull(),
});

export const variantOptionValues = pgTable(
  "variant_option_values",
  {
    variantId: uuid("variant_id").notNull(),
    optionValueId: uuid("option_value_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.variantId, t.optionValueId] }),
    // أسماء صريحة قصيرة: Postgres يقتطع المعرفات فوق 63 حرفاً.
    foreignKey({ name: "vov_variant_fk", columns: [t.variantId], foreignColumns: [productVariants.id] }).onDelete("cascade"),
    foreignKey({ name: "vov_option_value_fk", columns: [t.optionValueId], foreignColumns: [productOptionValues.id] }).onDelete("cascade"),
  ],
);

export const productMedia = pgTable("product_media", {
  id: id(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  type: mediaType("type").default("image").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  position: integer("position").default(0).notNull(),
  ...timestamps(),
});
