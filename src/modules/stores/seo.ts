import { z } from "zod";

/**
 * عنوان الصفحة الرئيسية ووصفها في نتائج البحث.
 * اسم المتجر وحده عنوانٌ لا يبحث عنه أحد؛ هذان الحقلان هما ما يظهر في جوجل.
 * الحدود مطابقة لما يعرضه جوجل فعلاً قبل القص: ~٦٠ حرفاً للعنوان و~١٦٠ للوصف.
 */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

const trimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v.replace(/\s+/g, " "));

export const seoSettingsSchema = z.object({
  title: trimmed(SEO_TITLE_MAX),
  description: trimmed(SEO_DESCRIPTION_MAX),
});

export type SeoSettings = z.infer<typeof seoSettingsSchema>;

const EMPTY: SeoSettings = { title: "", description: "" };

/** يقرأ إعدادات SEO من كائن settings (متسامح مع القيم الناقصة أو التالفة). */
export function readSeoSettings(settings: Record<string, unknown> | undefined | null): SeoSettings {
  const raw = settings?.seo;
  if (!raw || typeof raw !== "object") return EMPTY;
  const parsed = seoSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY;
}

/** العنوان والوصف الفعليان: إعداد التاجر، وإلا اسم المتجر ووصفه. */
export function resolveSeo(settings: Record<string, unknown> | undefined | null, store: { name: string; description?: string | null }) {
  const seo = readSeoSettings(settings);
  return {
    title: seo.title || store.name,
    description: seo.description || store.description || `تسوّق من ${store.name}`,
  };
}
