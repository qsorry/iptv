import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PromoTint } from "@/design-system/layouts";
import { buttonClasses } from "@/components/ui/button";

export interface PromoItem {
  title: string;
  subtitle?: string;
  href: string;
  tint: PromoTint;
  image?: string | null;
}

const TINT: Record<PromoTint, string> = {
  primary: "bg-brand-container text-brand-container-fg",
  secondary: "bg-[var(--secondary-container)] text-[var(--secondary-container-text)]",
  accent: "bg-[var(--accent-container)] text-[var(--accent-container-text)]",
  success: "bg-[var(--success-container)] text-[var(--success-container-text)]",
};

/** لافتتان ترويجيتان جنباً إلى جنب بحاويات لونية من الرموز. */
export function PromotionalBanner({ items }: { items: PromoItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="عروض" className="grid gap-4 sm:grid-cols-2">
      {items.slice(0, 2).map((it) => (
        <div key={it.href + it.title} className={cn("relative flex min-h-40 items-center overflow-hidden rounded-card p-6 sm:min-h-48 sm:p-8", TINT[it.tint])}>
          <div className="relative z-10 flex max-w-[65%] flex-col gap-2">
            <h2 className="text-xl font-bold sm:text-2xl">{it.title}</h2>
            {it.subtitle && <p className="text-sm opacity-80">{it.subtitle}</p>}
            <Link href={it.href} className={buttonClasses({ variant: "primary", size: "sm", className: "mt-2 w-fit" })}>
              تسوّق الآن
            </Link>
          </div>
          {it.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image} alt="" loading="lazy" className="absolute end-4 top-1/2 h-28 w-28 -translate-y-1/2 rounded-card object-cover shadow-md sm:h-36 sm:w-36" />
          ) : (
            <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-[var(--card-bg)] opacity-40 blur-2xl" aria-hidden="true" />
          )}
        </div>
      ))}
    </section>
  );
}
