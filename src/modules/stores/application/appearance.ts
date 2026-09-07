import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { ValidationError } from "@/core/errors";
import type { StoreContext } from "@/core/tenancy";
import { THEME_REGISTRY, THEME_VERSION, contrastRatio, contrastOn, getTheme, parseThemeOverrides, type ThemeOverrides } from "@/design-system";
import { FONTS, ROUNDNESS, PRODUCT_LAYOUTS, DEFAULT_THEME, DEFAULT_LAYOUT } from "../themes";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const appearanceSchema = z.object({
  theme: z.string().refine((v) => v in THEME_REGISTRY, "ثيم غير معروف").default(DEFAULT_THEME),
  productLayout: z.string().refine((v) => v in PRODUCT_LAYOUTS, "طريقة عرض غير معروفة").default(DEFAULT_LAYOUT),
  font: z.string().refine((v) => v === "" || v in FONTS, "خط غير معروف").default(""),
  roundness: z.string().refine((v) => v === "" || v in ROUNDNESS, "استدارة غير معروفة").default(""),
  brandFromTheme: z.boolean().default(false),
  /** تجاوزات JSON بمفاتيح الرموز؛ تُرشَّح بالقائمة البيضاء. */
  themeOverrides: z.record(z.string(), z.string()).default({}),
});

export type AppearanceInput = z.input<typeof appearanceSchema>;

/** الحد الأدنى للتباين: النص العادي 4.5:1 (WCAG AA)، والعناصر الكبيرة/الأزرار 3:1. */
const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST = 3;

/**
 * يتحقق أن تجاوزات الألوان لا تكسر القراءة على لوحة الثيم الفاتحة.
 * لا نعرض منتقي ألوان حراً للنص أو الأسطح؛ نتحقق فقط مما تسمح به القائمة البيضاء.
 */
function assertContrast(themeKey: string, overrides: ThemeOverrides, brandColor?: string) {
  const t = getTheme(themeKey);
  const pageBg = overrides["--page-bg"] ?? t.light.canvas;
  const primary = overrides["--color-brand-primary"] ?? brandColor ?? t.light.brandPrimary;
  if (overrides["--page-bg"] && contrastRatio(t.light.ink, pageBg) < MIN_TEXT_CONTRAST) {
    throw new ValidationError("لون الخلفية المختار يجعل النص غير مقروء؛ اختر لوناً أفتح");
  }
  if (contrastRatio(primary, pageBg) < MIN_UI_CONTRAST) {
    throw new ValidationError("لون العلامة قريب جداً من لون الخلفية؛ الأزرار لن تظهر بوضوح");
  }
  if (contrastRatio(primary, contrastOn(primary)) < MIN_UI_CONTRAST) {
    throw new ValidationError("لون العلامة لا يعطي تبايناً كافياً للنص فوقه");
  }
}

/** يقرأ إعدادات المظهر الحالية بشكل آمن للنموذج. */
export function readAppearance(settings: Record<string, unknown> | undefined) {
  const parsed = appearanceSchema.safeParse({
    theme: settings?.theme,
    productLayout: settings?.productLayout ?? settings?.layout,
    font: settings?.font,
    roundness: settings?.roundness,
    brandFromTheme: settings?.brandFromTheme,
    themeOverrides: settings?.themeOverrides,
  });
  return parsed.success ? parsed.data : appearanceSchema.parse({});
}

/**
 * حالة استخدام: حفظ مظهر المتجر (ثيم، خط، استدارة، تجاوزات) مع التحقق والتباين،
 * وتثبيت `themeVersion` حتى لا تكسر ترقيات النظام المتجر لاحقاً.
 */
export async function updateAppearance(ctx: StoreContext, input: AppearanceInput, brandColor?: string) {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "بيانات المظهر غير صالحة");
  const data = parsed.data;
  const overrides = parseThemeOverrides(data.themeOverrides);
  const effectiveBrand = data.brandFromTheme ? undefined : brandColor && HEX.test(brandColor) ? brandColor : undefined;
  assertContrast(data.theme, overrides, effectiveBrand);

  const row = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, ctx.storeId) });
  const prev = (row?.settings as Record<string, unknown>) ?? {};
  const merged = {
    ...prev,
    theme: data.theme,
    productLayout: data.productLayout,
    font: data.font,
    roundness: data.roundness,
    brandFromTheme: data.brandFromTheme,
    themeOverrides: overrides,
    themeVersion: THEME_VERSION,
  };
  if (row) await db.update(storeSettings).set({ settings: merged, updatedAt: new Date() }).where(eq(storeSettings.storeId, ctx.storeId));
  else await db.insert(storeSettings).values({ storeId: ctx.storeId, settings: merged });
  return merged;
}
