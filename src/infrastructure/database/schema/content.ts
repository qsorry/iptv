import { pgTable, text, timestamp, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";

export const contentStatus = pgEnum("content_status", ["draft", "published"]);

/** صفحات ثابتة لكل متجر (من نحن، الشروط، سياسة الاسترجاع). */
export const pages = pgTable(
  "pages",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body"),
    seoDescription: text("seo_description"),
    status: contentStatus("status").default("draft").notNull(),
    showInFooter: text("show_in_footer"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("pages_store_slug_idx").on(t.storeId, t.slug)],
);

/** مقالات المدونة لكل متجر (لتحسين SEO). */
export const posts = pgTable(
  "posts",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    body: text("body"),
    coverImage: text("cover_image"),
    seoDescription: text("seo_description"),
    status: contentStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("posts_store_slug_idx").on(t.storeId, t.slug), index("posts_store_status_idx").on(t.storeId, t.status)],
);
