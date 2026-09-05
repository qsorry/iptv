import { pgTable, text, integer, boolean, timestamp, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";
import { productVariants } from "./catalog";

export const inventoryMovementType = pgEnum("inventory_movement_type", [
  "initial",
  "purchase",
  "sale",
  "return",
  "adjustment",
  "damage",
  "transfer_in",
  "transfer_out",
  "reserve",
  "release",
]);

export const warehouses = pgTable(
  "warehouses",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("warehouses_store_code_idx").on(t.storeId, t.code)],
);

/** المخزون القابل للبيع = available - reserved. */
export const inventoryLevels = pgTable(
  "inventory_levels",
  {
    id: id(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
    availableQuantity: integer("available_quantity").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("inventory_levels_wh_variant_idx").on(t.warehouseId, t.variantId)],
);

/** سجل حركات. لا يُعدَّل المخزون أبداً بدون صف هنا. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }).notNull(),
    type: inventoryMovementType("type").notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("inventory_movements_variant_idx").on(t.variantId), index("inventory_movements_ref_idx").on(t.referenceType, t.referenceId)],
);
