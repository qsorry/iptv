import type { ProviderStatus } from "@/core/state-machines";
import type { ItemState, SubmissionStatus } from "./readiness";

export const REQUIREMENT_KINDS = ["document", "verification", "contract"] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_KIND_LABELS: Record<RequirementKind, string> = {
  document: "مستند",
  verification: "تحقق",
  contract: "عقد",
};

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  pending: "بانتظار المستندات",
  under_review: "قيد المراجعة",
  approved: "مفعّل",
  rejected: "مرفوض",
  suspended: "موقوف",
};

/** اسم زر الانتقال إلى كل حالة في صفحة المراجعة. */
export const PROVIDER_TRANSITION_LABELS: Record<ProviderStatus, string> = {
  pending: "إعادة لاستكمال المستندات",
  under_review: "بدء المراجعة",
  approved: "قبول وتفعيل",
  rejected: "رفض",
  suspended: "إيقاف",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  missing: "لم يُقدَّم",
  submitted: "مُقدَّم بانتظار المراجعة",
  accepted: "مقبول",
  rejected: "مرفوض",
};

export const ITEM_STATE_LABELS: Record<ItemState, string> = {
  ok: "مستوفى",
  missing: "لم يُقدَّم",
  submitted: "بانتظار المراجعة",
  rejected: "مرفوض",
  expired: "منتهي",
  no_expiry: "ينقصه تاريخ الانتهاء",
};
