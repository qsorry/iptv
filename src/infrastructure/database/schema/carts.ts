import { pgTable, text, integer, timestamp, pgEnum, uuid, index } from "drizzle-orm/pg-core";
import { id, timestamps, money, currencyCode } from "./_shared";
import { stores } from "./stores";
import { customers, customerAddresses } from "./customers";
import { productVariants } from "./catalog";

export const cartStatus = pgEnum("cart_status", ["active", "converted", "abandoned", "expired"]);
export const checkoutStatus = pgEnum("checkout_status", ["open", "completed", "expired", "cancelled"]);

export const carts = pgTable(
  "carts",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    currencyCode: currencyCode().notNull(),
    status: cartStatus("status").default("active").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("carts_store_session_idx").on(t.storeId, t.sessionId)],
);

/** unit_price هنا مرجعي فقط؛ يُعاد حساب كل شيء عند Checkout. */
export const cartItems = pgTable("cart_items", {
  id: id(),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: "cascade" }).notNull(),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: money("unit_price").notNull(),
  ...timestamps(),
});

export const checkoutSessions = pgTable("checkout_sessions", {
  id: id(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  email: text("email"),
  phone: text("phone"),
  shippingAddressId: uuid("shipping_address_id").references(() => customerAddresses.id, { onDelete: "set null" }),
  billingAddressId: uuid("billing_address_id").references(() => customerAddresses.id, { onDelete: "set null" }),
  shippingMethodId: uuid("shipping_method_id"),
  subtotal: money("subtotal").default("0").notNull(),
  discountTotal: money("discount_total").default("0").notNull(),
  shippingTotal: money("shipping_total").default("0").notNull(),
  taxTotal: money("tax_total").default("0").notNull(),
  grandTotal: money("grand_total").default("0").notNull(),
  status: checkoutStatus("status").default("open").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps(),
});
