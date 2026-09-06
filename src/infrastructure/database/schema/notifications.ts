import { pgTable, text, timestamp, jsonb, pgEnum, uuid, index } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { stores } from "./stores";

export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp", "sms"]);
export const notificationStatus = pgEnum("notification_status", ["pending", "sent", "failed", "skipped"]);

/**
 * سجل الإشعارات الصادرة. صف لكل محاولة إرسال عبر قناة.
 * القنوات المدفوعة (whatsapp/sms) تُسجَّل skipped إن لم يملك المتجر الميزة.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    channel: notificationChannel("channel").notNull(),
    type: text("type").notNull(), // order.codes_delivered ...
    recipient: text("recipient").notNull(), // email / phone
    subject: text("subject"),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    status: notificationStatus("status").default("pending").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notifications_store_idx").on(t.storeId, t.createdAt)],
);
