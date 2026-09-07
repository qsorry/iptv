import { DEFAULT_HOME_LAYOUT, HOME_SECTION_TYPES, isVariant, type HomeLayout, type HomeSection } from "@/design-system";

/**
 * يحلّ تخطيط الصفحة الرئيسية للمتجر على الخادم.
 * إن وُجد `homeLayout` صالح في إعدادات المتجر يُستخدم، وإلا التخطيط الافتراضي.
 * الأقسام مجهولة النوع أو ذات variant غير مسجّل تُسقط بصمت.
 */
export function resolveHomeLayout(settings: Record<string, unknown> | undefined): HomeLayout {
  const raw = settings?.homeLayout as Partial<HomeLayout> | undefined;
  if (!raw || !Array.isArray(raw.sections) || raw.sections.length === 0) return DEFAULT_HOME_LAYOUT;
  const sections = raw.sections.filter((s): s is HomeSection => {
    if (!s || typeof s !== "object") return false;
    const o = s as { id?: unknown; type?: unknown; variant?: unknown };
    if (typeof o.id !== "string" || typeof o.type !== "string" || !(HOME_SECTION_TYPES as readonly string[]).includes(o.type)) return false;
    if (o.type === "hero" && !isVariant("hero", o.variant)) return false;
    if (o.type === "featured-products" && o.variant !== undefined && !isVariant("productCard", o.variant)) return false;
    return true;
  });
  return sections.length ? { version: typeof raw.version === "number" ? raw.version : 1, sections } : DEFAULT_HOME_LAYOUT;
}
