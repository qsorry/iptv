import { z } from "zod";
import { ValidationError } from "@/core/errors";
import { REQUIREMENT_KINDS } from "../domain/labels";

/** حقول النماذج ترسل "" للحقل الفارغ؛ نعاملها كغير موجودة. */
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v instanceof Date ? v : new Date(String(v))),
  z.date({ invalid_type_error: "تاريخ غير صالح" }).optional(),
);

export const requirementSchema = z.object({
  title: z.string().trim().min(2, "عنوان الشرط مطلوب").max(200),
  description: optionalText(1000),
  kind: z.enum(REQUIREMENT_KINDS),
  isRequired: z.boolean(),
  hasExpiry: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type RequirementInput = z.infer<typeof requirementSchema>;

export const updateRequirementSchema = requirementSchema.extend({ isActive: z.boolean() });
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const createProviderSchema = z.object({
  name: z.string().trim().min(2, "اسم المزوّد مطلوب").max(120),
  legalName: optionalText(200),
  crNumber: optionalText(40),
  contactName: optionalText(120),
  contactEmail: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email("إيميل غير صالح").max(200).optional()),
  contactPhone: optionalText(40),
});
export type CreateProviderInput = z.infer<typeof createProviderSchema>;

export const reviewSubmissionSchema = z.object({
  status: z.enum(["missing", "submitted", "accepted", "rejected"]),
  reference: optionalText(500),
  expiresAt: optionalDate,
  note: optionalText(1000),
});
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

export const changeStatusSchema = z.object({
  to: z.enum(["pending", "under_review", "approved", "rejected", "suspended"]),
  reason: optionalText(500),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

/** يتحقق من المدخلات ويرمي ValidationError برسالة أول خطأ (تظهر كما هي في الواجهة). */
export function parseInput<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "بيانات غير صالحة", r.error.issues);
  return r.data;
}
