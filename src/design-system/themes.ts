/**
 * Smart Souq — THEME REGISTRY
 *
 * الثيم = قيم رموز فقط (خانات اللوحة + الشكل + الخط). لا مكوّنات، لا صفحات، لا تخطيط.
 * نفس المكوّنات تعمل مع كل ثيم بلا تغيير في الشيفرة.
 *
 * كل ثيم يحمل لوحتين: فاتحة وداكنة. الزائر يختار الوضع (فاتح/داكن/تلقائي)
 * والتاجر يختار الثيم. تُحقن القيم خادمياً كـ <style> داخلي عند جذر المتجر.
 *
 * تجاوزات المتجر (per-store overrides) تُخزَّن كـ JSON وتقتصر على
 * القائمة البيضاء THEME_OVERRIDE_WHITELIST. لا CSS مخصص للمتجر أبداً.
 */

import { contrastOn, isHexColor } from "./color";

/** إصدار نظام الثيمات. يُخزَّن مع كل متجر حتى لا تكسره الترقيات. */
export const THEME_VERSION = 1;

/** خانات اللوحة التي يضبطها الثيم (انظر foundation.css). */
export interface ThemePalette {
  brandPrimary: string;
  brandSecondary: string;
  brandAccent: string;
  canvas: string;
  surface: string;
  surfaceMuted: string;
  surfaceInverse: string;
  ink: string;
  inkMuted: string;
  inkDisabled: string;
  inkInverse: string;
  line: string;
  lineStrong: string;
  /** rgb triplet للظلال (مثال: "15 23 42"). */
  shadowColor: string;
}

/** الشكل: استدارة وظلال. قيم من مقياس foundation فقط. */
export interface ThemeShape {
  cardRadius: string;
  buttonRadius: string;
  inputRadius: string;
  cardShadow: string;
}

export interface ThemeDefinition {
  key: string;
  name: string;
  description: string;
  /** هل هوية الثيم داكنة أساساً؟ (يؤثر على الترتيب في اللوحة فقط). */
  prefersDark: boolean;
  fontFamily: string;
  /** معامل Google Fonts لتحميل خط الثيم (إن لم يكن خط نظام). */
  googleFont?: string;
  light: ThemePalette;
  dark: ThemePalette;
  shape: ThemeShape;
}

/* ---------- لوحات مشتركة تُشتق منها الثيمات ---------- */

const LIGHT_NEUTRALS: Omit<ThemePalette, "brandPrimary" | "brandSecondary" | "brandAccent"> = {
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  surfaceInverse: "#0F172A",
  ink: "#0F172A",
  inkMuted: "#64748B",
  inkDisabled: "#CBD5E1",
  inkInverse: "#FFFFFF",
  line: "#E2E8F0",
  lineStrong: "#CBD5E1",
  shadowColor: "15 23 42",
};

const DARK_NEUTRALS: Omit<ThemePalette, "brandPrimary" | "brandSecondary" | "brandAccent"> = {
  canvas: "#0B1220",
  surface: "#111A2B",
  surfaceMuted: "#182238",
  surfaceInverse: "#F8FAFC",
  ink: "#E5EAF3",
  inkMuted: "#9AA6BB",
  inkDisabled: "#4B5872",
  inkInverse: "#0F172A",
  line: "#223050",
  lineStrong: "#2E3D60",
  shadowColor: "0 0 0",
};

const SHAPE_SOFT: ThemeShape = { cardRadius: "var(--radius-lg)", buttonRadius: "var(--radius-full)", inputRadius: "var(--radius-md)", cardShadow: "var(--shadow-sm)" };
const SHAPE_ROUND: ThemeShape = { cardRadius: "var(--radius-xl)", buttonRadius: "var(--radius-full)", inputRadius: "var(--radius-lg)", cardShadow: "var(--shadow-sm)" };
const SHAPE_SHARP: ThemeShape = { cardRadius: "var(--radius-sm)", buttonRadius: "var(--radius-sm)", inputRadius: "var(--radius-sm)", cardShadow: "none" };
const SHAPE_MEDIUM: ThemeShape = { cardRadius: "var(--radius-md)", buttonRadius: "var(--radius-md)", inputRadius: "var(--radius-md)", cardShadow: "var(--shadow-sm)" };

const FONT_PLEX = "'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif";
const GOOGLE_PLEX = "IBM+Plex+Sans+Arabic:wght@400;500;600;700";
const FONT_TAJAWAL = "'Tajawal', system-ui, sans-serif";
const GOOGLE_TAJAWAL = "Tajawal:wght@400;500;700;800";

type Brand = Pick<ThemePalette, "brandPrimary" | "brandSecondary" | "brandAccent">;
const palette = (base: typeof LIGHT_NEUTRALS, brand: Brand, patch: Partial<ThemePalette> = {}): ThemePalette => ({ ...base, ...brand, ...patch });

function theme(
  key: string,
  name: string,
  description: string,
  brand: Brand,
  opts: { light?: Partial<ThemePalette>; dark?: Partial<ThemePalette>; shape?: ThemeShape; font?: string; google?: string; prefersDark?: boolean } = {},
): ThemeDefinition {
  return {
    key,
    name,
    description,
    prefersDark: opts.prefersDark ?? false,
    fontFamily: opts.font ?? FONT_TAJAWAL,
    googleFont: opts.font ? opts.google : GOOGLE_TAJAWAL,
    light: palette(LIGHT_NEUTRALS, brand, opts.light),
    dark: palette(DARK_NEUTRALS, brand, opts.dark),
    shape: opts.shape ?? SHAPE_SOFT,
  };
}

/* ---------- سجل الثيمات ---------- */

/**
 * Smart Souq Default — الهوية المرجعية في نموذج التصميم:
 * أزرق أساسي، بنفسجي ثانوي، كهرماني للتمييز، خلفية فاتحة جداً، حواف 18px، ظلال ناعمة، IBM Plex Sans Arabic.
 */
export const SMART_SOUQ_THEME: ThemeDefinition = theme(
  "smartsouq",
  "سمارت سوق",
  "مشرق · حديث · فاخر · نظيف. أزرق أساسي مع بنفسجي وكهرماني، حواف ناعمة وظلال خفيفة.",
  { brandPrimary: "#2563EB", brandSecondary: "#6D5BD0", brandAccent: "#F59E0B" },
  {
    font: FONT_PLEX,
    google: GOOGLE_PLEX,
    shape: SHAPE_SOFT,
    dark: { brandPrimary: "#3B82F6", brandSecondary: "#8B7CF0", brandAccent: "#FBBF24" },
  },
);

export const THEME_REGISTRY: Record<string, ThemeDefinition> = {
  smartsouq: SMART_SOUQ_THEME,
  modern: theme("modern", "حديث", "لوحة محايدة نظيفة مع لون علامة المتجر.", { brandPrimary: "#004D73", brandSecondary: "#3B82F6", brandAccent: "#F59E0B" }, {
    light: { canvas: "#F7F8FA", line: "#E5E7EB" },
    shape: SHAPE_MEDIUM,
  }),
  midnight: theme("midnight", "ليلي فاخر", "هوية داكنة أنيقة مع تباين هادئ.", { brandPrimary: "#3B82F6", brandSecondary: "#8B7CF0", brandAccent: "#FBBF24" }, {
    prefersDark: true,
    dark: { canvas: "#0B0F14", surface: "#141B24", surfaceMuted: "#1B2430", ink: "#E6EDF3", inkMuted: "#8B98A5", inkDisabled: "#3D4A59", line: "#232C38", lineStrong: "#2E3947" },
    shape: SHAPE_MEDIUM,
  }),
  sand: theme("sand", "رملي دافئ", "درجات دافئة ومريحة للعين.", { brandPrimary: "#B45309", brandSecondary: "#9A3412", brandAccent: "#D97706" }, {
    light: { canvas: "#FAF7F2", surfaceMuted: "#F3EDE4", ink: "#2B2420", inkMuted: "#8A7D70", line: "#EADFD2", lineStrong: "#DCCDBB", shadowColor: "43 36 32" },
    dark: { canvas: "#171310", surface: "#211B17", surfaceMuted: "#2B231E", ink: "#F1E9E0", inkMuted: "#B2A395", line: "#352C26", lineStrong: "#463A32" },
    shape: SHAPE_ROUND,
  }),
  ocean: theme("ocean", "محيطي", "أزرق بحري هادئ.", { brandPrimary: "#0369A1", brandSecondary: "#0E7490", brandAccent: "#F59E0B" }, {
    light: { canvas: "#F0F9FF", surfaceMuted: "#E6F3FB", ink: "#0C2A3E", inkMuted: "#5B7C93", line: "#D6EAF5", lineStrong: "#BBDCEE", shadowColor: "12 42 62" },
    dark: { canvas: "#07141D", surface: "#0E1E2B", surfaceMuted: "#14293A", line: "#1E3648", lineStrong: "#2A465C" },
    shape: SHAPE_MEDIUM,
  }),
  minimal: theme("minimal", "أبيض وأسود", "حدّة وبساطة: بلا ظلال وحواف صغيرة.", { brandPrimary: "#111111", brandSecondary: "#444444", brandAccent: "#111111" }, {
    light: { canvas: "#FFFFFF", surfaceMuted: "#F5F5F5", ink: "#111111", inkMuted: "#777777", line: "#EAEAEA", lineStrong: "#D4D4D4", shadowColor: "0 0 0" },
    dark: { brandPrimary: "#F5F5F5", brandSecondary: "#BBBBBB", brandAccent: "#F5F5F5", canvas: "#0A0A0A", surface: "#141414", surfaceMuted: "#1E1E1E", ink: "#F2F2F2", inkMuted: "#9A9A9A", line: "#262626", lineStrong: "#333333" },
    shape: SHAPE_SHARP,
  }),
  grape: theme("grape", "عنبي", "بنفسجي راقٍ.", { brandPrimary: "#7C3AED", brandSecondary: "#A855F7", brandAccent: "#F59E0B" }, {
    light: { canvas: "#FAF5FF", surfaceMuted: "#F3EBFD", ink: "#2A1B3D", inkMuted: "#7C6A90", line: "#ECE0F7", lineStrong: "#DCCBF0", shadowColor: "42 27 61" },
    dark: { canvas: "#130D1C", surface: "#1C1427", surfaceMuted: "#261B34", line: "#33264A", lineStrong: "#43335E" },
    shape: SHAPE_ROUND,
  }),
  emerald: theme("emerald", "زمردي", "أخضر طبيعي منعش.", { brandPrimary: "#059669", brandSecondary: "#0D9488", brandAccent: "#F59E0B" }, {
    light: { canvas: "#F0FDF6", surfaceMuted: "#E5F8EE", ink: "#08312A", inkMuted: "#5C8377", line: "#D2EFE0", lineStrong: "#B7E3CE", shadowColor: "8 49 42" },
    dark: { canvas: "#07160F", surface: "#0E2118", surfaceMuted: "#152B21", line: "#1F3A2D", lineStrong: "#2A4D3C" },
    shape: SHAPE_SOFT,
  }),
  rose: theme("rose", "وردي أنيق", "وردي ناعم للعلامات اللطيفة.", { brandPrimary: "#E11D48", brandSecondary: "#DB2777", brandAccent: "#F59E0B" }, {
    light: { canvas: "#FFF5F7", surfaceMuted: "#FCEAEE", ink: "#3A1220", inkMuted: "#9A6B78", line: "#F6DBE2", lineStrong: "#EFC3CF", shadowColor: "58 18 32" },
    dark: { canvas: "#1A0B10", surface: "#25131A", surfaceMuted: "#301A23", line: "#402431", lineStrong: "#553142" },
    shape: SHAPE_ROUND,
  }),
  graphite: theme("graphite", "رمادي فحمي", "محايد رسمي بحواف صغيرة.", { brandPrimary: "#1F2937", brandSecondary: "#4B5563", brandAccent: "#F59E0B" }, {
    light: { canvas: "#F4F5F7", ink: "#1B2027", inkMuted: "#6B7480", line: "#E0E3E8", lineStrong: "#CDD2D9" },
    dark: { brandPrimary: "#CBD5E1", brandSecondary: "#94A3B8" },
    shape: { ...SHAPE_MEDIUM, cardRadius: "var(--radius-sm)", buttonRadius: "var(--radius-sm)", inputRadius: "var(--radius-sm)" },
  }),
  carbon: theme("carbon", "كربوني داكن", "داكن حادّ للعلامات التقنية.", { brandPrimary: "#E5E7EB", brandSecondary: "#9CA3AF", brandAccent: "#F59E0B" }, {
    prefersDark: true,
    light: { brandPrimary: "#1B1D21", brandSecondary: "#4B5563", canvas: "#F4F5F7", ink: "#1B2027", inkMuted: "#6B7480", line: "#E0E3E8", lineStrong: "#CDD2D9" },
    dark: { canvas: "#111214", surface: "#1B1D21", surfaceMuted: "#24272C", ink: "#F2F3F5", inkMuted: "#9A9EA6", inkDisabled: "#4A4F57", line: "#2B2E34", lineStrong: "#3A3E45" },
    shape: { ...SHAPE_MEDIUM, cardRadius: "var(--radius-sm)", buttonRadius: "var(--radius-sm)", inputRadius: "var(--radius-sm)" },
  }),
};

export const DEFAULT_THEME_KEY = "modern";

export function getTheme(key: string | undefined): ThemeDefinition {
  return (key && THEME_REGISTRY[key]) || THEME_REGISTRY[DEFAULT_THEME_KEY];
}

/* ---------- تجاوزات المتجر (JSON) ---------- */

/** الرموز الوحيدة المسموح للمتجر بتجاوزها. كل ما عداها مملوك للنظام. */
export const THEME_OVERRIDE_WHITELIST = [
  "--color-brand-primary",
  "--color-brand-accent",
  "--page-bg",
  "--card-radius",
  "--button-radius",
  "--font-family",
] as const;

export type ThemeOverrideToken = (typeof THEME_OVERRIDE_WHITELIST)[number];
export type ThemeOverrides = Partial<Record<ThemeOverrideToken, string>>;

const RADIUS_TOKEN = /^var\(--radius-(sm|md|lg|xl|full)\)$/;
const RADIUS_PX = /^(0|[1-9]\d?)px$/;
const FONT_STACK = /^[\w\s'",\-]{1,160}$/;

function isValidOverride(token: ThemeOverrideToken, value: string): boolean {
  switch (token) {
    case "--color-brand-primary":
    case "--color-brand-accent":
    case "--page-bg":
      return isHexColor(value);
    case "--card-radius":
    case "--button-radius":
      return RADIUS_TOKEN.test(value) || RADIUS_PX.test(value);
    case "--font-family":
      return FONT_STACK.test(value);
  }
}

/**
 * يقرأ تجاوزات الثيم من JSON غير موثوق (إعدادات المتجر) ويُبقي المسموح والصحيح فقط.
 * القيم غير الصالحة تُهمل بصمت حتى لا تكسر واجهة المتجر.
 */
export function parseThemeOverrides(input: unknown): ThemeOverrides {
  const out: ThemeOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const token of THEME_OVERRIDE_WHITELIST) {
    const v = (input as Record<string, unknown>)[token];
    if (typeof v === "string" && isValidOverride(token, v.trim())) out[token] = v.trim();
  }
  return out;
}

/* ---------- التحويل إلى CSS ---------- */

export type CssVars = Record<string, string>;

/** خانات اللوحة كمتغيرات CSS (foundation) + الشكل والخط. */
function paletteVars(p: ThemePalette): CssVars {
  return {
    "--color-brand-primary": p.brandPrimary,
    "--color-brand-secondary": p.brandSecondary,
    "--color-brand-accent": p.brandAccent,
    "--color-on-brand": contrastOn(p.brandPrimary),
    "--color-canvas": p.canvas,
    "--color-surface": p.surface,
    "--color-surface-muted": p.surfaceMuted,
    "--color-surface-inverse": p.surfaceInverse,
    "--color-ink": p.ink,
    "--color-ink-muted": p.inkMuted,
    "--color-ink-disabled": p.inkDisabled,
    "--color-ink-inverse": p.inkInverse,
    "--color-line": p.line,
    "--color-line-strong": p.lineStrong,
    "--shadow-color": p.shadowColor,
  };
}

function shapeVars(t: ThemeDefinition): CssVars {
  return {
    "--card-radius": t.shape.cardRadius,
    "--button-radius": t.shape.buttonRadius,
    "--input-radius": t.shape.inputRadius,
    "--card-shadow": t.shape.cardShadow,
    "--font-family": t.fontFamily,
  };
}

export interface ResolvedTheme {
  key: string;
  version: number;
  light: CssVars;
  dark: CssVars;
}

/**
 * يحلّ الثيم + تجاوزات المتجر إلى مجموعتي متغيرات (فاتح/داكن).
 * تجاوز `--page-bg` يُطبَّق على الفاتح فقط (الداكن يحتفظ بلوحة الثيم لضمان التباين).
 * تجاوز اللون الأساسي يُعيد حساب لون النص فوقه.
 */
export function resolveTheme(key: string | undefined, overrides: ThemeOverrides = {}): ResolvedTheme {
  const t = getTheme(key);
  const light: CssVars = { ...paletteVars(t.light), ...shapeVars(t) };
  const dark: CssVars = { ...paletteVars(t.dark), ...shapeVars(t) };
  for (const [token, value] of Object.entries(overrides) as [ThemeOverrideToken, string][]) {
    if (token === "--page-bg") {
      light[token] = value;
      continue;
    }
    light[token] = value;
    dark[token] = value;
    if (token === "--color-brand-primary") {
      light["--color-on-brand"] = contrastOn(value);
      dark["--color-on-brand"] = contrastOn(value);
    }
  }
  return { key: t.key, version: THEME_VERSION, light, dark };
}

function decls(vars: CssVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/**
 * CSS داخلي لجذر المتجر (`rootSelector` مثل `#sf-root`): الفاتح افتراضياً، الداكن عند
 * `data-theme="dark"` أو عند تفضيل النظام ما لم يُختر الفاتح صراحةً.
 * يُحقن خادمياً بلا وميض وبلا بناء لكل متجر.
 */
export function themeStyleCss(rootSelector: string, resolved: ResolvedTheme): string {
  const r = rootSelector;
  return [
    `${r}{${decls(resolved.light)};color-scheme:light}`,
    `${r}[data-theme="dark"]{${decls(resolved.dark)};color-scheme:dark}`,
    `@media (prefers-color-scheme: dark){${r}:not([data-theme="light"]){${decls(resolved.dark)};color-scheme:dark}}`,
  ].join("\n");
}
