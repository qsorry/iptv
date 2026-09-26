import { pgTable, text, boolean, integer, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";

/**
 * مزوّدو المحتوى على مستوى المنصة (وليس المتجر): جهات تطلب ربط محتواها بتطبيق المشغّل.
 * لا يظهر أي مزوّد للمستخدمين قبل أن تصبح حالته `approved`. لا `store_id` لأنها جداول مركزية مثل `plans`.
 */

/** شروط القبول، يعدّلها مدير المنصة من /admin/platform/providers/requirements. */
export const providerRequirements = pgTable("provider_requirements", {
  id: id(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").default("document").notNull(), // document | verification | contract
  isRequired: boolean("is_required").default(true).notNull(),
  hasExpiry: boolean("has_expiry").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps(),
});

/** طلب انضمام مزوّد. الحالة تنتقل عبر providerStateMachine فقط. */
export const contentProviders = pgTable(
  "content_providers",
  {
    id: id(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    crNumber: text("cr_number"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: text("status").default("pending").notNull(), // pending | under_review | approved | rejected | suspended
    statusReason: text("status_reason"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("content_providers_status_idx").on(t.status)],
);

/** حالة كل شرط لكل مزوّد: ما قدّمه، ونتيجة المراجعة، وتاريخ انتهاء المستند إن وُجد. */
export const providerSubmissions = pgTable(
  "provider_submissions",
  {
    id: id(),
    providerId: uuid("provider_id").references(() => contentProviders.id, { onDelete: "cascade" }).notNull(),
    requirementId: uuid("requirement_id").references(() => providerRequirements.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("missing").notNull(), // missing | submitted | accepted | rejected
    reference: text("reference"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewerNote: text("reviewer_note"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("provider_submissions_provider_requirement_idx").on(t.providerId, t.requirementId)],
);
