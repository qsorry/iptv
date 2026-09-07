import type { HomeSection } from "@/design-system/layouts";
import type { ProductCardData } from "@/components/commerce/product-card";
import type { CategoryCardData } from "@/components/commerce/category-card";
import { Hero } from "./hero";
import { Benefits } from "./benefits";
import { CategorySection } from "./category-section";
import { FeaturedProducts } from "./featured-products";
import { PromotionalBanner, type PromoItem } from "./promotional-banner";
import { Testimonials, type Testimonial } from "./testimonials";

/** البيانات المحلولة على الخادم مرة واحدة وتُمرَّر لكل الأقسام. */
export interface HomeData {
  store: { name: string; description?: string | null; logoUrl?: string | null };
  currency: string;
  products: ProductCardData[];
  categories: CategoryCardData[];
  testimonials: Testimonial[];
}

const TINTS: PromoItem["tint"][] = ["secondary", "success"];

/** العمل الفني للبطل (public/media/store)، مصدره docs/previews/hero-artboard.html. */
const HERO_ARTWORK = { wide: "/media/store/hero-art-wide.jpg", square: "/media/store/hero-art-square.jpg" };

/**
 * يحوّل عنصر مصفوفة التخطيط إلى قسم. النوع غير المعروف لا يرسم شيئاً.
 * الخريطة type → component ثابتة هنا؛ لا أقسام خارجها.
 */
export function SectionRenderer({ section, data }: { section: HomeSection; data: HomeData }) {
  switch (section.type) {
    case "hero":
      return (
        <Hero
          variant={section.variant}
          title={data.store.name}
          subtitle={data.store.description}
          cta={data.products.length > 0 ? { label: "تسوّق الآن", href: "#products" } : undefined}
          artwork={HERO_ARTWORK}
        />
      );
    case "benefits":
      return <Benefits />;
    case "categories":
      return <CategorySection title={section.title} categories={data.categories} />;
    case "featured-products": {
      const items = data.products.slice(0, section.limit ?? 4);
      return <FeaturedProducts title={section.title} items={items} currency={data.currency} variant={section.variant} badge={section.badge} href="#products" />;
    }
    case "promo-banners": {
      const items: PromoItem[] =
        section.items ??
        data.categories.slice(0, 2).map((c, i) => ({
          title: c.name,
          subtitle: c.description ?? "كل ما تحتاجه في مكان واحد",
          href: `/categories/${encodeURIComponent(c.slug)}`,
          tint: TINTS[i % TINTS.length],
          image: c.imageUrl,
        }));
      return <PromotionalBanner items={items} />;
    }
    case "all-products":
      return (
        <div id="products" className="scroll-mt-24">
          <FeaturedProducts title={section.title ?? "جميع المنتجات"} items={data.products} currency={data.currency} />
        </div>
      );
    case "testimonials":
      return <Testimonials title={section.title} items={data.testimonials} />;
    default:
      return null;
  }
}
