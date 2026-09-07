import Link from "next/link";
import { cn } from "@/lib/utils";
import { toMinor } from "@/core/money";
import type { ProductCardVariant } from "@/design-system/variants";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ProductPrice } from "./product-price";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  price: string;
  image?: string | null;
  compareAtPrice?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
}

type Props = {
  product: ProductCardData;
  currency: string;
  variant?: ProductCardVariant;
  /** شارة نصية (مثال: الأكثر مبيعاً). */
  badge?: string;
  /** الصورة فوق الطيّة (LCP): تحميل فوري بدل الكسول. */
  priority?: boolean;
};

function Rating({ avg, count }: { avg?: number; count?: number }) {
  if (typeof count !== "number" || count <= 0) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-ink-secondary">
      <span className="text-[var(--rating-color)]" aria-hidden="true">★</span>
      <span dir="ltr">
        {avg} ({count})
      </span>
    </div>
  );
}

/**
 * بطاقة منتج قابل للشراء. variants: default | featured | compact | horizontal.
 * الصورة تحجز مساحتها (aspect-ratio) لمنع القفز. الرابط الوحيد هو صفحة المنتج.
 */
export function ProductCard({ product: p, currency, variant = "default", badge, priority }: Props) {
  const price = toMinor(p.price);
  const compareAt = p.compareAtPrice ? toMinor(p.compareAtPrice) : 0;
  const hasDiscount = compareAt > price && price > 0;
  const discountPct = hasDiscount ? Math.round((1 - price / compareAt) * 100) : 0;
  const href = `/products/${encodeURIComponent(p.slug)}`;
  const horizontal = variant === "horizontal";
  const compact = variant === "compact";
  const featured = variant === "featured";

  const image = (
    <div className={cn("relative overflow-hidden bg-surface-muted", horizontal ? "aspect-square w-28 shrink-0 sm:w-36" : "aspect-square w-full")}>
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt={p.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-slow ease-standard group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs text-ink-secondary">لا صورة</div>
      )}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        <div className="flex flex-col gap-1">
          {badge && <Badge>{badge}</Badge>}
          {hasDiscount && (
            <Badge variant="error" dir="ltr">
              -{discountPct}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <article
      className={cn(
        "group relative flex h-full overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] shadow-card transition-all duration-base ease-standard hover:-translate-y-0.5 hover:shadow-md",
        horizontal ? "flex-row items-stretch" : "flex-col",
        featured && "sm:col-span-2",
      )}
    >
      {image}
      <div className={cn("flex flex-1 flex-col", compact ? "gap-1 p-2.5" : "gap-1.5 p-3 sm:p-4")}>
        <h3 className={cn("font-semibold leading-snug", compact ? "line-clamp-1 text-sm" : featured ? "line-clamp-2 text-base sm:text-lg" : "line-clamp-2 text-sm sm:text-base")}>
          <Link href={href} className="after:absolute after:inset-0 after:content-['']">
            {p.name}
          </Link>
        </h3>
        {!compact && p.shortDescription && <p className="line-clamp-2 text-xs text-ink-secondary">{p.shortDescription}</p>}
        <Rating avg={p.ratingAvg} count={p.ratingCount} />
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <ProductPrice price={price} compareAt={compareAt} currency={currency} size={compact ? "sm" : "md"} />
          {!compact && (
            <span aria-hidden="true" className={buttonClasses({ variant: "primary", size: "sm", className: "w-full" })}>
              عرض المنتج
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
