import { pgTable, text, integer, timestamp, jsonb, pgEnum, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { stores } from "./stores";

export const merchantSyncStatus = pgEnum("merchant_sync_status", [
  "pending",
  "pending_delete",
  "synced",
  "failed",
  "disapproved",
  "deleted",
]);

/**
 * حالة مزامنة كل منتج مع Merchant Center.
 * payload_hash يمنع الإرسال العبثي (تعديل لا يمسّ حقول الخلاصة لا يستهلك حصة)،
 * و last_synced_at يقود إعادة الرفع قبل انتهاء صلاحية المنتج عند جوجل (٣٠ يوماً).
 */
export const merchantSyncState = pgTable(
  "merchant_sync_state",
  {
    id: id(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }).notNull(),
    productId: uuid("product_id").notNull(),
    /** المعرّف الذي يراه التاجر في تقارير جوجل: الـ SKU لا الـ UUID. */
    offerId: text("offer_id").notNull(),
    /** المعرّف المركّب عند جوجل: online:ar:SA:<offer_id> — لا يتغيّر بعد أول رفع. */
    googleId: text("google_id").notNull(),
    status: merchantSyncStatus("status").default("pending").notNull(),
    payloadHash: text("payload_hash"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    /** أسباب الرفض والتحذيرات من productstatuses. */
    issues: jsonb("issues").$type<{ code: string; description: string; detail?: string }[]>(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("merchant_sync_store_product_idx").on(t.storeId, t.productId),
    index("merchant_sync_queue_idx").on(t.status, t.nextAttemptAt),
    index("merchant_sync_store_status_idx").on(t.storeId, t.status),
  ],
);
