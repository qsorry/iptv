/**
 * Smart Souq — LAYOUT PRESETS
 * طبقة مستقلة عن الثيم: ترتيب الأقسام + الـ variants المسموحة لكل قسم.
 * الصفحة الرئيسية تُرسم من هذه المصفوفة على الخادم (لا جلب من العميل).
 * الآن: مصفوفة افتراضية واحدة ثابتة. لاحقاً: تُخزَّن لكل متجر كـ JSON.
 */
import type { HeroVariant, ProductCardVariant } from "./variants";

export type PromoTint = "primary" | "secondary" | "accent" | "success";

export type HomeSection =
  | { id: string; type: "hero"; variant: HeroVariant }
  | { id: string; type: "benefits" }
  | { id: string; type: "categories"; title?: string }
  | { id: string; type: "featured-products"; title?: string; limit?: number; badge?: string; variant?: ProductCardVariant }
  | { id: string; type: "promo-banners"; items?: { title: string; subtitle?: string; href: string; tint: PromoTint }[] }
  | { id: string; type: "all-products"; title?: string }
  | { id: string; type: "testimonials"; title?: string };

export type HomeSectionType = HomeSection["type"];

export const HOME_SECTION_TYPES: readonly HomeSectionType[] = ["hero", "benefits", "categories", "featured-products", "promo-banners", "all-products", "testimonials"];

export interface HomeLayout {
  version: number;
  sections: HomeSection[];
}

/**
 * الإيقاع الافتراضي لسطح المكتب:
 * Header → Hero → Benefits → Categories → Featured → Promo → All products → Testimonials → Footer
 */
export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  version: 1,
  sections: [
    { id: "hero", type: "hero", variant: "split" },
    { id: "benefits", type: "benefits" },
    { id: "categories", type: "categories", title: "تسوّق حسب الفئة" },
    { id: "featured", type: "featured-products", title: "الأكثر مبيعاً", limit: 4, badge: "الأكثر مبيعاً" },
    { id: "promo", type: "promo-banners" },
    { id: "products", type: "all-products", title: "جميع المنتجات" },
    { id: "testimonials", type: "testimonials", title: "آراء عملائنا" },
  ],
};
