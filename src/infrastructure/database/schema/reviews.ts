import { pgTable, text, integer, boolean, pgEnum, uuid, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";
import { products } from "./catalog";
import { customers } from "./customers";
import { orders } from "./orders";

export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);

/** تقييم منتج. يبدأ pending ويُنشر بعد موافقة التاجر. */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    rating: integer("rating").notNull(), // 1..5
    title: text("title"),
    body: text("body"),
    verified: boolean("verified").default(false).notNull(),
    status: reviewStatus("status").default("pending").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("reviews_product_status_idx").on(t.productId, t.status),
    index("reviews_store_status_idx").on(t.storeId, t.status),
  ],
);
