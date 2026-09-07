import type { ProductCardVariant } from "@/design-system/variants";
import { ProductGrid } from "@/components/commerce/product-grid";
import type { ProductCardData } from "@/components/commerce/product-card";
import { SectionHeading } from "./section-heading";

type Props = {
  title?: string;
  items: ProductCardData[];
  currency: string;
  variant?: ProductCardVariant;
  badge?: string;
  href?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
};

/** منتجات مميزة/الأكثر مبيعاً أو كل المنتجات، بشبكة موحّدة وعنوان مع "عرض الكل". */
export function FeaturedProducts({ title = "الأكثر مبيعاً", items, currency, variant = "default", badge, href, columns = 4 }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} href={href} />
      <ProductGrid items={items} currency={currency} variant={variant} columns={columns} badgeFirst={badge ? { count: items.length, label: badge } : undefined} />
    </section>
  );
}
