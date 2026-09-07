import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";

export const trackingEventStatus = pgEnum("tracking_event_status", ["pending", "sent", "partial", "failed"]);
export const trackingDeliveryStatus = pgEnum("tracking_delivery_status", ["sent", "failed", "skipped"]);

/**
 * الزائر: مصدر الإسناد. first touch لا يُكتب فوقه أبداً، last touch يُحدَّث كل زيارة.
 * الإسناد يُلتقط من الزيارة الأولى أو لا يُلتقط أبداً — لا يمكن استرجاعه بأثر رجعي.
 */
export const visitors = pgTable(
  "visitors",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    /** معرّف عشوائي في كوكي الزائر. */
    visitorKey: text("visitor_key").notNull(),
    customerId: uuid("customer_id"),
    /** utm_* + click ids + referrer/landing/device — انظر modules/attribution/domain/touch.ts */
    firstTouch: jsonb("first_touch").$type<Record<string, string | null>>().default({}).notNull(),
    lastTouch: jsonb("last_touch").$type<Record<string, string | null>>().default({}).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("visitors_store_key_idx").on(t.storeId, t.visitorKey), index("visitors_store_seen_idx").on(t.storeId, t.lastSeenAt)],
);

/** سجل الموافقة بختم زمني (PDPL). كل تغيير يُسجَّل صفاً جديداً، لا تحديثاً. */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    visitorKey: text("visitor_key").notNull(),
    analytics: boolean("analytics").default(false).notNull(),
    marketing: boolean("marketing").default(false).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("consent_records_store_visitor_idx").on(t.storeId, t.visitorKey, t.createdAt)],
);

/**
 * طابور أحداث التتبّع. المحرك يكتب هنا ويردّ فوراً؛ عامل منفصل يرسل للمنصات.
 * تأكيد الطلب لا ينتظر رد Meta.
 * dedupe_key يمنع تكرار الحدث على مستوى السيرفر (إعادة تحميل صفحة النجاح).
 */
export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    /** UUID v4 يُرسل من المتصفح ومن السيرفر معاً — بدونه يُحتسب كل Purchase مرتين. */
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    dedupeKey: text("dedupe_key"),
    eventTime: timestamp("event_time", { withTimezone: true }).defaultNow().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    status: trackingEventStatus("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tracking_events_dedupe_idx").on(t.storeId, t.dedupeKey),
    index("tracking_events_queue_idx").on(t.status, t.nextAttemptAt),
    index("tracking_events_store_idx").on(t.storeId, t.createdAt),
  ],
);

/** سجل إرسال لكل منصة على حدة مع سبب الفشل — أساس شاشة إعادة المحاولة. */
export const trackingDeliveries = pgTable(
  "tracking_deliveries",
  {
    id: id(),
    trackingEventId: uuid("tracking_event_id").references(() => trackingEvents.id, { onDelete: "cascade" }).notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    platform: text("platform").notNull(),
    status: trackingDeliveryStatus("status").notNull(),
    statusCode: integer("status_code"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tracking_deliveries_event_platform_idx").on(t.trackingEventId, t.platform),
    index("tracking_deliveries_store_idx").on(t.storeId, t.createdAt),
  ],
);

/**
 * إعدادات التكامل لكل متجر ومنصة.
 * config: معرّفات عامة تظهر في المتصفح (Pixel ID / Measurement ID).
 * secrets: توكنات مشفّرة (AES-256-GCM) — لا تُعاد للواجهة إلا مقنّعة.
 */
export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    platform: text("platform").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    config: jsonb("config").$type<Record<string, string>>().default({}).notNull(),
    secrets: jsonb("secrets").$type<Record<string, string>>().default({}).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("integration_settings_store_platform_idx").on(t.storeId, t.platform)],
);
