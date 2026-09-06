import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";

/**
 * بيانات ذيل الصفحة (التواصل، الحسابات الاجتماعية، السجلات النظامية، طرق الدفع).
 * تُخزَّن داخل store_settings.settings تحت المفتاح `footer` لكل متجر على حدة.
 */

/** طرق الدفع المدعومة في الذيل؛ المعرّفات مطابقة لما تعرضه سلة (salla-payments) مع إضافات شائعة في السعودية. */
export const PAYMENT_METHODS = {
  mada: { name: "مدى", icon: "CreditCardChipOutline" },
  credit_card: { name: "فيزا / ماستركارد", icon: "CreditCardOutline" },
  apple_pay: { name: "Apple Pay", icon: "Apple" },
  stc_pay: { name: "STC Pay", icon: "Cellphone" },
  bank_transfer: { name: "تحويل بنكي", icon: "BankOutline" },
  cod: { name: "الدفع عند الاستلام", icon: "CashMultiple" },
} as const;
export type PaymentMethodId = keyof typeof PAYMENT_METHODS;

const optionalUrl = z.string().trim().url().optional().or(z.literal(""));
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const footerSettingsSchema = z.object({
  legalName: optionalText(160),
  phone: optionalText(32),
  whatsapp: optionalText(32),
  email: z.string().trim().email("بريد غير صالح").optional().or(z.literal("")),
  address: optionalText(240),
  instagram: optionalUrl,
  snapchat: optionalUrl,
  facebook: optionalUrl,
  twitter: optionalUrl,
  youtube: optionalUrl,
  commercialNumber: optionalText(32),
  certificateId: optionalText(32),
  certificateImage: optionalText(500),
  certificateUrl: optionalUrl,
  payments: z.array(z.enum(Object.keys(PAYMENT_METHODS) as [PaymentMethodId, ...PaymentMethodId[]])).default([]),
});
export type FooterSettings = z.infer<typeof footerSettingsSchema>;

const EMPTY: FooterSettings = {
  legalName: "", phone: "", whatsapp: "", email: "", address: "",
  instagram: "", snapchat: "", facebook: "", twitter: "", youtube: "",
  commercialNumber: "", certificateId: "", certificateImage: "", certificateUrl: "", payments: [],
};

/** يقرأ إعدادات الذيل من كائن settings (متسامح مع القيم الناقصة أو التالفة). */
export function readFooterSettings(settings: Record<string, unknown> | undefined | null): FooterSettings {
  const raw = settings?.footer;
  if (!raw || typeof raw !== "object") return EMPTY;
  const parsed = footerSettingsSchema.safeParse(raw);
  return parsed.success ? { ...EMPTY, ...parsed.data } : EMPTY;
}

export async function updateFooterSettings(ctx: StoreContext, raw: z.input<typeof footerSettingsSchema>) {
  requireRole(ctx, "owner", "admin");
  const parsed = footerSettingsSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const row = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, ctx.storeId) });
  const merged = { ...((row?.settings as Record<string, unknown>) ?? {}), footer: parsed.data };
  if (row) {
    await db.update(storeSettings).set({ settings: merged, updatedAt: new Date() }).where(eq(storeSettings.storeId, ctx.storeId));
  } else {
    await db.insert(storeSettings).values({ storeId: ctx.storeId, settings: merged });
  }
  return parsed.data;
}

/** رابط واتساب من رقم دولي (+9665…) */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, "")}`;
}

/** أيقونة ومجموعة كل صفحة ثابتة في الذيل حسب slug (المجموعة: الشركة / السياسات). */
export const FOOTER_PAGE_META: Record<string, { icon: string; group: "company" | "policies" }> = {
  about: { icon: "InformationOutline", group: "company" },
  contact: { icon: "Headset", group: "company" },
  faq: { icon: "HelpCircleOutline", group: "company" },
  terms: { icon: "FileDocumentOutline", group: "policies" },
  "shipping-payment": { icon: "TruckDeliveryOutline", group: "policies" },
  shipping: { icon: "TruckDeliveryOutline", group: "policies" },
  "return-policy": { icon: "PackageVariantClosed", group: "policies" },
  refund: { icon: "PackageVariantClosed", group: "policies" },
  "privacy-policy": { icon: "ShieldLockOutline", group: "policies" },
  privacy: { icon: "ShieldLockOutline", group: "policies" },
};

/** يستنتج المجموعة والأيقونة لصفحة من slug أو من كلمات العنوان (للصفحات المُنشأة يدوياً). */
export function footerPageMeta(slug: string, title: string): { icon: string; group: "company" | "policies" } {
  const known = FOOTER_PAGE_META[slug];
  if (known) return known;
  const t = title;
  if (/سياس|شروط|أحكام|خصوص|استرجاع|إرجاع|استبدال|شحن|توصيل|policy|terms|privacy|refund|return|shipping/i.test(t)) {
    if (/خصوص|privacy/i.test(t)) return { icon: "ShieldLockOutline", group: "policies" };
    if (/استرجاع|إرجاع|استبدال|refund|return/i.test(t)) return { icon: "PackageVariantClosed", group: "policies" };
    if (/شحن|توصيل|shipping/i.test(t)) return { icon: "TruckDeliveryOutline", group: "policies" };
    return { icon: "FileDocumentOutline", group: "policies" };
  }
  if (/تواصل|اتصل|contact/i.test(t)) return { icon: "Headset", group: "company" };
  if (/أسئلة|اسئلة|faq/i.test(t)) return { icon: "HelpCircleOutline", group: "company" };
  return { icon: "InformationOutline", group: "company" };
}
