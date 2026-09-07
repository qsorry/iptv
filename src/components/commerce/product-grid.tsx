import { cn } from "@/lib/utils";
import type { ProductCardVariant } from "@/design-system/variants";
import { ProductCard, type ProductCardData } from "./product-card";

export type { ProductCardData };

type Props = {
  items: ProductCardData[];
  currency: string;
  variant?: ProductCardVariant;
  /** عدد الأعمدة الأقصى على الشاشات الكبيرة (2–6). */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** شارة للبطاقات الأولى (مثال: الأكثر مبيعاً على أول 4). */
  badgeFirst?: { count: number; label: string };
  className?: string;
};

const COLS: Record<NonNullable<Props["columns"]>, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
};

/** شبكة منتجات موحّدة (رئيسية، بحث، تصنيف، ذات صلة). الجوال عمودان دائماً. */
export function ProductGrid({ items, currency, variant = "default", columns = 4, badgeFirst, className }: Props) {
  const grid = variant === "horizontal" ? "grid-cols-1 lg:grid-cols-2" : COLS[variant === "compact" ? 6 : columns];
  return (
    <div className={cn("grid gap-3 sm:gap-4", grid, className)}>
      {items.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          currency={currency}
          variant={variant}
          priority={i < 2}
          badge={badgeFirst && i < badgeFirst.count ? badgeFirst.label : undefined}
        />
      ))}
    </div>
  );
}
