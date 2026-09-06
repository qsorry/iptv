import { pgTable, text, boolean, timestamp, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";

export const memberRole = pgEnum("member_role", ["owner", "admin", "staff"]);
export const memberStatus = pgEnum("member_status", ["active", "invited", "disabled"]);

/**
 * جداول المصادقة (Better Auth). أسماء الخصائص camelCase كما يتوقعها المحوّل،
 * وأسماء الأعمدة snake_case حسب اصطلاح المشروع.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  phone: text("phone"),
  ...timestamps(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** عضوية مستخدم في متجر. نظام الصلاحيات التفصيلي (permissions) يُضاف في مرحلة لاحقة. */
export const storeMembers = pgTable(
  "store_members",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: memberRole("role").default("staff").notNull(),
    status: memberStatus("status").default("active").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("store_members_store_user_idx").on(t.storeId, t.userId)],
);
