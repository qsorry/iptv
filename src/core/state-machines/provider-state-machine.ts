import { createStateMachine } from "./state-machine";

export type ProviderStatus = "pending" | "under_review" | "approved" | "rejected" | "suspended";

/**
 * دورة حياة مزوّد المحتوى. `approved` تحتاج أيضاً اكتمال الشروط (انظر modules/providers/domain/readiness).
 * under_review → pending تعني إعادته لاستكمال المستندات.
 */
export const providerStateMachine = createStateMachine<ProviderStatus>("المزوّد", {
  pending: ["under_review", "rejected"],
  under_review: ["approved", "rejected", "pending"],
  approved: ["suspended"],
  suspended: ["under_review", "approved", "rejected"],
  rejected: ["under_review"],
});
