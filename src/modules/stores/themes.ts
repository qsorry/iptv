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
};

export const DEFAULT_THEME = "modern";

export const PRODUCT_LAYOUTS: Record<string, string> = {
  grid: "شبكة",
  list: "قائمة",
  compact: "مضغوط",
};
export const DEFAULT_LAYOUT = "grid";

/** متغيرات CSS للثيم مع لون العلامة كـ accent. */
export function themeVars(themeKey: string | undefined, brandColor: string): Record<string, string> {
  const t = THEMES[themeKey ?? DEFAULT_THEME]?.palette ?? THEMES[DEFAULT_THEME].palette;
  return {
    "--brand": brandColor,
    "--brand-fg": "#ffffff",
    "--bg": t.bg,
    "--surface": t.surface,
    "--fg": t.fg,
    "--muted": t.muted,
    "--border": t.border,
    "--radius": t.radius,
  };
}
