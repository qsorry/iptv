/**
 * اكتمال شروط المزوّد: دالة نقية بلا قاعدة بيانات، يستخدمها القبول والإيقاف التلقائي وواجهة المراجعة.
 * الشرط المستوفى = مقبول، وإن كان له تاريخ انتهاء فيجب أن يكون محدداً ولم يمضِ.
 */

export type SubmissionStatus = "missing" | "submitted" | "accepted" | "rejected";
export type ItemState = "ok" | "missing" | "submitted" | "rejected" | "expired" | "no_expiry";

export interface RequirementLite {
  id: string;
  title: string;
  isRequired: boolean;
  hasExpiry: boolean;
  isActive: boolean;
}

export interface SubmissionLite {
  requirementId: string;
  status: string;
  expiresAt: Date | null;
}

export interface ReadinessItem {
  requirementId: string;
  title: string;
  required: boolean;
  state: ItemState;
  expiresAt: Date | null;
  expiringSoon: boolean;
}

export const EXPIRY_WARNING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function itemState(requirement: Pick<RequirementLite, "hasExpiry">, submission: SubmissionLite | undefined, now: Date): ItemState {
  if (!submission || submission.status === "missing") return "missing";
  if (submission.status === "submitted") return "submitted";
  if (submission.status === "rejected") return "rejected";
  if (!requirement.hasExpiry) return "ok";
  if (!submission.expiresAt) return "no_expiry";
  return submission.expiresAt.getTime() <= now.getTime() ? "expired" : "ok";
}

export function evaluateReadiness(requirements: RequirementLite[], submissions: SubmissionLite[], now = new Date()) {
  const byRequirement = new Map(submissions.map((s) => [s.requirementId, s]));
  const soonLimit = now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS;

  const items: ReadinessItem[] = requirements
    .filter((r) => r.isActive)
    .map((r) => {
      const submission = byRequirement.get(r.id);
      const state = itemState(r, submission, now);
      const expiresAt = submission?.expiresAt ?? null;
      return {
        requirementId: r.id,
        title: r.title,
        required: r.isRequired,
        state,
        expiresAt,
        expiringSoon: state === "ok" && expiresAt !== null && expiresAt.getTime() <= soonLimit,
      };
    });

  const required = items.filter((i) => i.required);
  const blocking = required.filter((i) => i.state !== "ok");
  return {
    items,
    ready: blocking.length === 0,
    blocking,
    requiredCount: required.length,
    doneCount: required.length - blocking.length,
    expiringSoon: items.filter((i) => i.expiringSoon),
  };
}

export type Readiness = ReturnType<typeof evaluateReadiness>;
