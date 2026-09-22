import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandCardData {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  productCount?: number;
}

/**
 * بطاقة ماركة: الشعار على سطح محايد + الاسم.
 * الشعار `object-contain` لا `cover`: شعار الماركة لا يُقصّ.
 */
export function BrandCard({ brand: b, className }: { brand: BrandCardData; className?: string }) {
  return (
    <Link
      href={`/brands/${encodeURIComponent(b.slug)}`}
      className={cn(
        "group flex shrink-0 flex-col items-center gap-2 rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-center shadow-card transition-transform duration-base ease-standard hover:-translate-y-0.5",
        className,
      )}
    >
      <span className="grid h-16 w-16 place-items-center overflow-hidden sm:h-20 sm:w-20">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt={b.name} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="text-lg font-bold text-ink-secondary">{b.name.slice(0, 1)}</span>
        )}
      </span>
      <span className="line-clamp-1 w-full text-xs font-medium sm:text-sm">{b.name}</span>
    </Link>
  );
}
