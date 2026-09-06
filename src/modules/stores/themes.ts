/** ثيمات جاهزة: لوحات ألوان حديثة (فاتحة/داكنة). لون العلامة (accent) يأتي من هوية المتجر. */
export interface ThemePalette {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  border: string;
  radius: string;
  dark: boolean;
}

export const THEMES: Record<string, { name: string; palette: ThemePalette }> = {
  modern: {
    name: "حديث",
    palette: { bg: "#f7f8fa", surface: "#ffffff", fg: "#0f172a", muted: "#64748b", border: "#e5e7eb", radius: "0.75rem", dark: false },
  },
  midnight: {
    name: "ليلي فاخر",
    palette: { bg: "#0b0f14", surface: "#141b24", fg: "#e6edf3", muted: "#8b98a5", border: "#232c38", radius: "0.75rem", dark: true },
  },
  sand: {
    name: "رملي دافئ",
    palette: { bg: "#faf7f2", surface: "#ffffff", fg: "#2b2420", muted: "#8a7d70", border: "#eadfd2", radius: "1rem", dark: false },
  },
  ocean: {
    name: "محيطي",
    palette: { bg: "#f0f9ff", surface: "#ffffff", fg: "#0c2a3e", muted: "#5b7c93", border: "#d6eaf5", radius: "0.75rem", dark: false },
  },
  minimal: {
    name: "أبيض وأسود",
    palette: { bg: "#ffffff", surface: "#ffffff", fg: "#111111", muted: "#777777", border: "#eaeaea", radius: "0.375rem", dark: false },
  },
  grape: {
    name: "عنبي",
    palette: { bg: "#faf5ff", surface: "#ffffff", fg: "#2a1b3d", muted: "#7c6a90", border: "#ece0f7", radius: "1rem", dark: false },
  },
  emerald: {
    name: "زمردي",
    palette: { bg: "#f0fdf6", surface: "#ffffff", fg: "#08312a", muted: "#5c8377", border: "#d2efe0", radius: "0.875rem", dark: false },
  },
  rose: {
    name: "وردي أنيق",
    palette: { bg: "#fff5f7", surface: "#ffffff", fg: "#3a1220", muted: "#9a6b78", border: "#f6dbe2", radius: "1rem", dark: false },
  },
  graphite: {
    name: "رمادي فحمي",
    palette: { bg: "#f4f5f7", surface: "#ffffff", fg: "#1b2027", muted: "#6b7480", border: "#e0e3e8", radius: "0.5rem", dark: false },
  },
  carbon: {
    name: "كربوني داكن",
    palette: { bg: "#111214", surface: "#1b1d21", fg: "#f2f3f5", muted: "#9a9ea6", border: "#2b2e34", radius: "0.5rem", dark: true },
  },
};

export const DEFAULT_THEME = "modern";

export const PRODUCT_LAYOUTS: Record<string, string> = {
  grid: "شبكة",
  list: "قائمة",
  compact: "مضغوط",
};
export const DEFAULT_LAYOUT = "grid";

/** خطوط عربية من Google Fonts. المفتاح يُخزَّن في إعدادات المتجر. */
export const FONTS: Record<string, { name: string; stack: string; google?: string }> = {
  tajawal: { name: "تجوّل", stack: "'Tajawal', system-ui, sans-serif", google: "Tajawal:wght@400;500;700;800" },
  cairo: { name: "القاهرة", stack: "'Cairo', system-ui, sans-serif", google: "Cairo:wght@400;600;700;800" },
  almarai: { name: "المراعي", stack: "'Almarai', system-ui, sans-serif", google: "Almarai:wght@400;700;800" },
  ibmarabic: { name: "IBM بلكس", stack: "'IBM Plex Sans Arabic', system-ui, sans-serif", google: "IBM+Plex+Sans+Arabic:wght@400;500;600;700" },
  rubik: { name: "روبيك", stack: "'Rubik', system-ui, sans-serif", google: "Rubik:wght@400;500;600;700" },
  notokufi: { name: "نوتو كوفي", stack: "'Noto Kufi Arabic', system-ui, sans-serif", google: "Noto+Kufi+Arabic:wght@400;500;700" },
  system: { name: "افتراضي النظام", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
};
export const DEFAULT_FONT = "tajawal";

/** استدارة الحواف (تتجاوز radius الثيم إن حُدِّدت). */
export const ROUNDNESS: Record<string, { name: string; radius: string }> = {
  sharp: { name: "حادّة", radius: "0.25rem" },
  soft: { name: "ناعمة", radius: "0.75rem" },
  round: { name: "دائرية", radius: "1.25rem" },
};

/** رابط Google Fonts للخط المختار (أو undefined لخط النظام). */
export function googleFontHref(fontKey: string | undefined): string | undefined {
  const f = FONTS[fontKey ?? DEFAULT_FONT] ?? FONTS[DEFAULT_FONT];
  if (!f.google) return undefined;
  return `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
}

/** لون نص مناسب فوق لون العلامة (أبيض أو أسود حسب السطوع). */
export function contrastOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  // معادلة السطوع النسبي المبسّطة.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}

export interface ThemeConfig {
  theme?: string;
  font?: string;
  roundness?: string;
}

/** هل الثيم المختار داكن؟ (لضبط color-scheme في واجهة المتجر). */
export function isDarkTheme(themeKey: string | undefined): boolean {
  return THEMES[themeKey ?? DEFAULT_THEME]?.palette.dark ?? false;
}

/**
 * متغيرات CSS للثيم (Material 3): لون العلامة، أسطح متدرّجة اللون (surface containers)،
 * الخط، والاستدارة. أدوار الألوان تُشتق عبر color-mix لتناسق الوضعين الفاتح/الداكن.
 */
export function themeVars(config: string | ThemeConfig | undefined, brandColor: string): Record<string, string> {
  const cfg: ThemeConfig = typeof config === "string" ? { theme: config } : (config ?? {});
  const t = THEMES[cfg.theme ?? DEFAULT_THEME]?.palette ?? THEMES[DEFAULT_THEME].palette;
  const font = FONTS[cfg.font ?? DEFAULT_FONT] ?? FONTS[DEFAULT_FONT];
  const radius = cfg.roundness && ROUNDNESS[cfg.roundness] ? ROUNDNESS[cfg.roundness].radius : t.radius;
  return {
    "--brand": brandColor,
    "--brand-fg": contrastOn(brandColor),
    "--bg": t.bg,
    "--surface": t.surface,
    // أسطح Material 3 المتدرّجة (elevation عبر اللون لا الظل فقط).
    "--surface-1": `color-mix(in srgb, ${t.surface} 97%, ${t.fg})`,
    "--surface-2": `color-mix(in srgb, ${t.surface} 94%, ${t.fg})`,
    "--surface-3": `color-mix(in srgb, ${t.surface} 90%, ${t.fg})`,
    // حاويات لونية بلون العلامة (tonal containers).
    "--brand-container": `color-mix(in srgb, ${brandColor} 14%, ${t.surface})`,
    "--brand-container-fg": `color-mix(in srgb, ${brandColor} 78%, ${t.fg})`,
    "--fg": t.fg,
    "--muted": t.muted,
    "--border": t.border,
    "--radius": radius,
    "--font": font.stack,
  };
}
