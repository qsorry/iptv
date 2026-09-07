/**
 * محوّل إعدادات المتجر إلى نظام الثيمات (src/design-system).
 * الثيم نفسه (القيم) يعيش في design-system؛ هنا فقط قراءة إعدادات المتجر
 * (ثيم، خط، استدارة، تجاوزات JSON) وتحويلها إلى CSS يُحقن خادمياً.
 */
import {
  THEME_REGISTRY,
  DEFAULT_THEME_KEY,
  THEME_VERSION,
  getTheme,
  resolveTheme,
  themeStyleCss,
  parseThemeOverrides,
  contrastOn,
  type ThemeDefinition,
  type ThemeOverrides,
  SELF_HOSTED_FONT_PRELOADS,
  type ResolvedTheme,
} from "@/design-system";

export { contrastOn, THEME_VERSION };

/** معاينة مختصرة للثيم في لوحة التحكم. */
export interface ThemePalette {
  bg: string;
  surface: string;
  fg: string;
  primary: string;
  secondary: string;
  accent: string;
  dark: boolean;
}

/** الثيمات المتاحة للتاجر: الاسم + معاينة. القيم الكاملة في design-system/themes.ts. */
export const THEMES: Record<string, { name: string; description: string; palette: ThemePalette }> = Object.fromEntries(
  Object.values(THEME_REGISTRY).map((t: ThemeDefinition) => {
    const p = t.prefersDark ? t.dark : t.light;
    return [
      t.key,
      {
        name: t.name,
        description: t.description,
        palette: { bg: p.canvas, surface: p.surface, fg: p.ink, primary: p.brandPrimary, secondary: p.brandSecondary, accent: p.brandAccent, dark: t.prefersDark },
      },
    ];
  }),
);

export const DEFAULT_THEME = DEFAULT_THEME_KEY;

export const PRODUCT_LAYOUTS: Record<string, string> = {
  grid: "شبكة",
  list: "قائمة",
  compact: "مضغوط",
};
export const DEFAULT_LAYOUT = "grid";

/** الخطوط المتاحة. تجوّل وIBM بلكس مستضافان ذاتياً (public/fonts)؛ الباقي من Google Fonts. المفتاح يُخزَّن في الإعدادات؛ "" = خط الثيم. */
export const FONTS: Record<string, { name: string; stack: string; google?: string }> = {
  tajawal: { name: "تجوّل", stack: "'Tajawal', system-ui, sans-serif" },
  cairo: { name: "القاهرة", stack: "'Cairo', system-ui, sans-serif", google: "Cairo:wght@400;600;700;800" },
  almarai: { name: "المراعي", stack: "'Almarai', system-ui, sans-serif", google: "Almarai:wght@400;700;800" },
  ibmarabic: { name: "IBM بلكس", stack: "'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif" },
  rubik: { name: "روبيك", stack: "'Rubik', system-ui, sans-serif", google: "Rubik:wght@400;500;600;700" },
  notokufi: { name: "نوتو كوفي", stack: "'Noto Kufi Arabic', system-ui, sans-serif", google: "Noto+Kufi+Arabic:wght@400;500;700" },
  system: { name: "افتراضي النظام", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
};
/** "" تعني خط الثيم المختار. */
export const DEFAULT_FONT = "";

/** استدارة الحواف (تتجاوز شكل الثيم إن حُدِّدت). القيم من مقياس foundation. */
export const ROUNDNESS: Record<string, { name: string; radius: string; card: string; button: string }> = {
  sharp: { name: "حادّة", radius: "6px", card: "var(--radius-sm)", button: "var(--radius-sm)" },
  soft: { name: "ناعمة", radius: "12px", card: "var(--radius-md)", button: "var(--radius-md)" },
  round: { name: "دائرية", radius: "24px", card: "var(--radius-xl)", button: "var(--radius-full)" },
};

export interface ThemeConfig {
  theme?: string;
  font?: string;
  roundness?: string;
  /** لون علامة المتجر (من جدول stores). يُطبَّق كتجاوز ما لم يُفعَّل brandFromTheme. */
  brandColor?: string;
  /** true = استخدم ألوان الثيم كما هي وتجاهل brandColor. */
  brandFromTheme?: boolean;
  /** تجاوزات JSON (قائمة بيضاء فقط). */
  themeOverrides?: unknown;
}

/** يقرأ إعدادات المظهر من JSON إعدادات المتجر. */
export function readThemeConfig(settings: Record<string, unknown> | undefined, brandColor?: string): ThemeConfig {
  const s = settings ?? {};
  return {
    theme: typeof s.theme === "string" ? s.theme : undefined,
    font: typeof s.font === "string" ? s.font : undefined,
    roundness: typeof s.roundness === "string" ? s.roundness : undefined,
    brandColor,
    brandFromTheme: s.brandFromTheme === true,
    themeOverrides: s.themeOverrides,
  };
}

/** يجمع تجاوزات المتجر من الإعدادات القديمة (لون/خط/استدارة) ومن JSON الجديد. */
export function storeThemeOverrides(cfg: ThemeConfig): ThemeOverrides {
  const out: ThemeOverrides = {};
  if (!cfg.brandFromTheme && cfg.brandColor && /^#[0-9a-fA-F]{6}$/.test(cfg.brandColor)) out["--color-brand-primary"] = cfg.brandColor;
  const font = cfg.font ? FONTS[cfg.font] : undefined;
  if (font) out["--font-family"] = font.stack;
  const r = cfg.roundness ? ROUNDNESS[cfg.roundness] : undefined;
  if (r) {
    out["--card-radius"] = r.card;
    out["--button-radius"] = r.button;
  }
  // تجاوزات JSON الصريحة تعلو على القديمة.
  return { ...out, ...parseThemeOverrides(cfg.themeOverrides) };
}

/** الثيم المحلول لمتجر: القيم الفاتحة والداكنة بعد التجاوزات. */
export function storeTheme(cfg: ThemeConfig): ResolvedTheme {
  return resolveTheme(cfg.theme, storeThemeOverrides(cfg));
}

/** CSS الداخلي لجذر المتجر. */
export function storeThemeCss(rootSelector: string, cfg: ThemeConfig): string {
  return themeStyleCss(rootSelector, storeTheme(cfg));
}

/** رابط Google Fonts للخط الفعلي (خط المتجر أو خط الثيم)، أو undefined لخط النظام. */
export function googleFontHref(fontKey: string | undefined, themeKey?: string): string | undefined {
  const f = fontKey ? FONTS[fontKey] : undefined;
  const google = f ? f.google : getTheme(themeKey).googleFont;
  if (!google) return undefined;
  return `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
}

/** الخط الفعلي للمتجر (خط المتجر أو خط الثيم). */
export function effectiveFontFamily(fontKey: string | undefined, themeKey?: string): string {
  const f = fontKey ? FONTS[fontKey] : undefined;
  return f ? f.stack : getTheme(themeKey).fontFamily;
}

/** ملفات الخط المستضاف ذاتياً التي تستحق <link rel="preload"> لهذا المتجر (فارغة لخطوط Google/النظام). */
export function fontPreloads(fontKey: string | undefined, themeKey?: string): string[] {
  return SELF_HOSTED_FONT_PRELOADS[effectiveFontFamily(fontKey, themeKey)] ?? [];
}

/** هل هوية الثيم داكنة أساساً؟ */
export function isDarkTheme(themeKey: string | undefined): boolean {
  return getTheme(themeKey).prefersDark;
}

/** الثيم المقابل في الوضع الآخر — مُبقى للتوافق؛ كل ثيم يحمل الآن وضعيه بنفسه. */
export function counterpartTheme(themeKey: string | undefined): string {
  return getTheme(themeKey).key;
}

/** لوحتا الوضعين للزائر (للتوافق مع الشيفرة القديمة). */
export function themeModeVars(config: string | ThemeConfig | undefined, brandColor: string): { light: Record<string, string>; dark: Record<string, string> } {
  const cfg: ThemeConfig = typeof config === "string" ? { theme: config } : (config ?? {});
  const r = storeTheme({ ...cfg, brandColor: cfg.brandColor ?? brandColor });
  return { light: r.light, dark: r.dark };
}

/** متغيرات الوضع الفاتح (للتوافق). */
export function themeVars(config: string | ThemeConfig | undefined, brandColor: string): Record<string, string> {
  return themeModeVars(config, brandColor).light;
}
