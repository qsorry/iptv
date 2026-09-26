import { z } from "zod";
import { normalizeServerUrl, parsePrefixes, PREFIX_PATTERN } from "../domain/codes";

/** حقول النماذج ترسل "" للحقل الفارغ؛ نعاملها كغير موجودة. */
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v instanceof Date ? v : new Date(String(v))),
  z.date({ invalid_type_error: "تاريخ غير صالح" }).optional(),
);

const serverUrl = z.string().trim().min(1, "رابط الخادم مطلوب").transform((v, ctx) => {
  try {
    return normalizeServerUrl(v);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "رابط الخادم غير صالح؛ مثال: http://host:8080" });
    return z.NEVER;
  }
});

const prefixes = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => parsePrefixes(v))
  .superRefine((list, ctx) => {
    if (list.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "أضف بادئة واحدة على الأقل لأسماء المستخدمين" });
    const bad = list.find((p) => !PREFIX_PATTERN.test(p));
    if (bad) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `البادئة «${bad}» غير صالحة (٢–٣٢ حرفاً: أرقام أو حروف إنجليزية)` });
  });

export const serverSchema = z.object({
  label: z.string().trim().min(1, "اسم الخادم مطلوب").max(60),
  baseUrl: serverUrl,
  prefixes,
  isActive: z.boolean().default(true),
});
export type ServerInput = z.infer<typeof serverSchema>;

export const createCodeSchema = z.object({
  serverId: z.string().uuid("اختر الخادم"),
  username: z.string().trim().min(1, "اسم المستخدم مطلوب").max(120),
  password: z.string().min(1, "كلمة المرور مطلوبة").max(200),
  expiresAt: optionalDate,
  note: optionalText(300),
});
export type CreateCodeInput = z.infer<typeof createCodeSchema>;

/** ما يرسله الجوال لإكمال ربط التلفاز: كود تفعيل، أو اسم مستخدم وكلمة مرور. */
export const completePairingSchema = z
  .object({
    pairCode: z.string().trim().min(1, "رمز الربط الظاهر على التلفاز مطلوب").max(20),
    activationCode: optionalText(30),
    username: optionalText(120),
    password: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(200).optional()),
  })
  .superRefine((v, ctx) => {
    if (!v.activationCode && !(v.username && v.password)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "أدخل كود التفعيل، أو اسم المستخدم وكلمة المرور" });
    }
  });
export type CompletePairingInput = z.infer<typeof completePairingSchema>;
