import { pgTable, text, integer, timestamp, jsonb, pgEnum, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id } from "./_shared";
import { stores } from "./stores";

export const eventStatus = pgEnum("event_status", ["pending", "processing", "processed", "failed"]);

/**
 * Outbox للأحداث. يُكتب داخل نفس الـ transaction الذي غيّر البيانات،
 * ثم يعالجه Worker مجدول (Cron / Edge Function). Next.js لا يحتفظ بذاكرة بين الطلبات.
 */
export const domainEvents = pgTable(
  "domain_events",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    status: eventStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("domain_events_status_idx").on(t.status, t.createdAt)],
);

/** Webhooks الواردة من مزودي الدفع/الشحن. unique(provider, event_id) يمنع المعالجة المكررة. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: eventStatus("status").default("pending").notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_idx").on(t.provider, t.eventId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    oldValues: jsonb("old_values").$type<Record<string, unknown>>(),
    newValues: jsonb("new_values").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId), index("audit_logs_store_idx").on(t.storeId, t.createdAt)],
);
