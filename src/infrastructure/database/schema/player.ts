import { pgTable, text, boolean, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { contentProviders } from "./providers";

/**
 * جداول تطبيق المشغّل (Ssouq Net Player) على مستوى المنصة، مثل جداول المزوّدين: لا `store_id`.
 * لا يستخدم التطبيق أي خادم أو كود إلا إن كان مزوّده `approved` والخادم مفعّلاً.
 */

/** خوادم Xtream Codes لكل مزوّد، يتصل بها التطبيق مباشرة. */
export const providerServers = pgTable(
  "provider_servers",
  {
    id: id(),
    providerId: uuid("provider_id").references(() => contentProviders.id, { onDelete: "cascade" }).notNull(),
    /** الاسم الظاهر للمستخدم عند التعرّف: «الخادم A». */
    label: text("label").notNull(),
    /** أصل الخادم بلا مسار: http://host:port */
    baseUrl: text("base_url").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps(),
  },
  (t) => [index("provider_servers_provider_idx").on(t.providerId)],
);

/** بادئات أسماء المستخدمين. أطول بادئة مطابقة تحدد الخادم، وكل بادئة فريدة على مستوى المنصة. */
export const providerUsernamePrefixes = pgTable(
  "provider_username_prefixes",
  {
    id: id(),
    serverId: uuid("server_id").references(() => providerServers.id, { onDelete: "cascade" }).notNull(),
    /** بأحرف صغيرة دائماً. */
    prefix: text("prefix").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("provider_username_prefixes_server_idx").on(t.serverId)],
);

/** أكواد التفعيل SN-XXXX-XXXX: تغني عن كتابة اسم المستخدم وكلمة المرور. الحالة عبر activationCodeStateMachine. */
export const playerActivationCodes = pgTable(
  "player_activation_codes",
  {
    id: id(),
    code: text("code").notNull().unique(),
    serverId: uuid("server_id").references(() => providerServers.id, { onDelete: "cascade" }).notNull(),
    username: text("username").notNull(),
    passwordEncrypted: text("password_encrypted").notNull(),
    status: text("status").default("active").notNull(), // active | revoked
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    note: text("note"),
    redemptionCount: integer("redemption_count").default(0).notNull(),
    lastRedeemedAt: timestamp("last_redeemed_at", { withTimezone: true }),
    createdBy: text("created_by"),
    ...timestamps(),
  },
  (t) => [index("player_activation_codes_server_idx").on(t.serverId)],
);

/**
 * ربط التلفاز بالجوال: التلفاز يعرض QR، والجوال يرسل الحساب، والتلفاز يستلمه مرة واحدة.
 * الحالة عبر pairingStateMachine. الحمولة مشفّرة وتُمسح عند الاستلام.
 */
export const playerPairings = pgTable(
  "player_pairings",
  {
    id: id(),
    code: text("code").notNull().unique(),
    pollTokenHash: text("poll_token_hash").notNull(),
    status: text("status").default("pending").notNull(), // pending | completed | consumed | expired
    payloadEncrypted: text("payload_encrypted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("player_pairings_expires_idx").on(t.expiresAt)],
);

/**
 * سجل ما يمر عبر المنصة من دخول للتطبيق (للوحة المشغّل): استبدال كود، أو إكمال ربط تلفاز.
 * الدخول باسم المستخدم يتحقق منه خادم المزوّد مباشرة فلا يمر هنا.
 */
export const playerActivity = pgTable(
  "player_activity",
  {
    id: id(),
    kind: text("kind").notNull(), // code_redeemed | tv_paired
    providerId: uuid("provider_id").references(() => contentProviders.id, { onDelete: "cascade" }).notNull(),
    serverId: uuid("server_id").references(() => providerServers.id, { onDelete: "set null" }),
    codeId: uuid("code_id").references(() => playerActivationCodes.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("player_activity_created_idx").on(t.createdAt), index("player_activity_provider_idx").on(t.providerId)],
);
