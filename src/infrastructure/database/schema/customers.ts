import { pgTable, text, integer, boolean, pgEnum, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, money } from "./_shared";
import { stores } from "./stores";

export const customerStatus = pgEnum("customer_status", ["active", "blocked"]);
export const addressType = pgEnum("address_type", ["shipping", "billing"]);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id"),
    email: text("email"),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    status: customerStatus("status").default("active").notNull(),
    totalOrders: integer("total_orders").default(0).notNull(),
    totalSpent: money("total_spent").default("0").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("customers_store_email_idx").on(t.storeId, t.email), uniqueIndex("customers_store_phone_idx").on(t.storeId, t.phone)],
);

export const customerAddresses = pgTable("customer_addresses", {
  id: id(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  type: addressType("type").default("shipping").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  country: text("country").notNull(),
  city: text("city").notNull(),
  district: text("district"),
  street: text("street"),
  postalCode: text("postal_code"),
  isDefault: boolean("is_default").default(false).notNull(),
  ...timestamps(),
});
