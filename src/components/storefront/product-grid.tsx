import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney, toMinor } from "@/core/money";

export interface GridProduct {
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

/** شبكة منتجات موحّدة لواجهة المتجر (رئيسية، بحث، تصنيف). تعرض الخصم والتقييم إن توفّرا. */
export function ProductGrid({
  items,
  currency,
  layout = "grid",
}: {
  items: GridProduct[];
  currency: string;
  layout?: "grid" | "list" | "compact";
}) {
  const gridClass =
    layout === "list"
      ? "grid grid-cols-1 gap-3"
      : layout === "compact"
        ? "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
        : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={gridClass}>
      {items.map((p) => {
        const price = toMinor(p.price);
        const compareAt = p.compareAtPrice ? toMinor(p.compareAtPrice) : 0;
        const hasDiscount = compareAt > price && price > 0;
        const discountPct = hasDiscount ? Math.round((1 - price / compareAt) * 100) : 0;
        const isList = layout === "list";
        const isCompact = layout === "compact";
        return (
          <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`}>
            <Card className={`h-full overflow-hidden p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isList ? "flex items-center gap-3" : ""}`}>
              <div className={`relative ${isList ? "h-24 w-24 shrink-0" : "aspect-square w-full"}`}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/5 text-xs text-[var(--muted)]">لا صورة</div>
                )}
                {hasDiscount && (
                  <span className="absolute start-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white" dir="ltr">
                    -{discountPct}%
                  </span>
                )}
              </div>
              <div className={isCompact ? "p-2" : "p-3"}>
                <div className={isCompact ? "line-clamp-1 text-sm font-medium" : "line-clamp-1 font-medium"}>{p.name}</div>
                {!isCompact && p.shortDescription && (
                  <div className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{p.shortDescription}</div>
                )}
                {typeof p.ratingCount === "number" && p.ratingCount > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    <span className="text-yellow-400">★</span>
                    <span dir="ltr" className="text-[var(--muted)]">{p.ratingAvg} ({p.ratingCount})</span>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-semibold text-[var(--brand)]" dir="ltr">{formatMoney(price, currency)}</span>
                  {hasDiscount && <span className="text-xs text-[var(--muted)] line-through" dir="ltr">{formatMoney(compareAt, currency)}</span>}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
