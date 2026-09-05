import { pgTable, text, pgEnum, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";

export const memberRole = pgEnum("member_role", ["owner", "admin", "staff"]);
export const memberStatus = pgEnum("member_status", ["active", "invited", "disabled"]);

/** ملف المستخدم. id = auth.users.id في Supabase. لا نعدّل جدول auth مطلقاً. */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  ...timestamps(),
});

/** عضوية مستخدم في متجر. نظام الصلاحيات التفصيلي (permissions) يُضاف في مرحلة لاحقة. */
export const storeMembers = pgTable(
  "store_members",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
    role: memberRole("role").default("staff").notNull(),
    status: memberStatus("status").default("active").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("store_members_store_user_idx").on(t.storeId, t.userId)],
);
