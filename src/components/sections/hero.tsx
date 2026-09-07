import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroVariant } from "@/design-system/variants";
import { buttonClasses } from "@/components/ui/button";

export interface HeroProps {
  title: string;
  subtitle?: string | null;
  /** نقاط قصيرة تحت العنوان (مثال: أسماء التصنيفات). */
  highlights?: string[];
  cta?: { label: string; href: string };
  /** صور تُعرض في جانب الـ split (حتى 3). */
  images?: string[];
  variant?: HeroVariant;
}

function Collage({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <div className="relative aspect-[4/3] w-full" aria-hidden="true">
        <div className="absolute end-4 top-4 h-40 w-40 rounded-full bg-brand-container opacity-80 blur-2xl sm:h-56 sm:w-56" />
        <div className="absolute bottom-4 start-8 h-32 w-32 rounded-full bg-[var(--secondary-container)] opacity-80 blur-2xl sm:h-44 sm:w-44" />
        <div className="absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-card bg-[var(--card-bg)] shadow-md" />
      </div>
    );
  }
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md" aria-hidden="true">
      {images.slice(0, 3).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src + i}
          src={src}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : undefined}
          className={cn(
            "absolute aspect-square w-[58%] rounded-card object-cover shadow-lg ring-4 ring-[var(--card-bg)]",
            i === 0 && "start-0 top-0 z-20",
            i === 1 && "end-0 top-[12%] z-10 w-[52%]",
            i === 2 && "bottom-0 start-[18%] w-[48%]",
          )}
        />
      ))}
    </div>
  );
}

/**
 * قسم البطل. يحمل h1 الوحيد للصفحة.
 * variants: centered (نص في المنتصف) | split (نص + صور) | banner (شريط مضغوط).
 */
export function Hero({ title, subtitle, highlights = [], cta, images = [], variant = "split" }: HeroProps) {
  const surface = "relative overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] shadow-card";
  const glow = (
    <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
      <div className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-brand-container opacity-70 blur-3xl" />
      <div className="absolute -bottom-20 -start-10 h-64 w-64 rounded-full bg-[var(--secondary-container)] opacity-70 blur-3xl" />
    </div>
  );
  const text = (
    <div className={cn("relative z-10 flex flex-col gap-4", variant === "centered" && "items-center text-center")}>
      <h1 className={cn("font-bold leading-tight", variant === "banner" ? "text-xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{title}</h1>
      {subtitle && <p className={cn("max-w-xl text-ink-secondary", variant === "banner" ? "text-sm" : "text-base sm:text-lg")}>{subtitle}</p>}
      {highlights.length > 0 && variant !== "banner" && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-secondary" aria-label="أبرز الأقسام">
          {highlights.slice(0, 5).map((h) => (
            <li key={h} className="before:me-2 before:content-['•'] first:before:content-none">
              {h}
            </li>
          ))}
        </ul>
      )}
      {cta && (
        <Link href={cta.href} className={buttonClasses({ variant: "primary", size: variant === "banner" ? "md" : "lg", className: "w-fit gap-2" })}>
          {cta.label}
          <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
      )}
    </div>
  );

  if (variant === "banner") {
    return (
      <section className={cn(surface, "px-5 py-6 sm:px-8")}>
        {glow}
        {text}
      </section>
    );
  }
  if (variant === "centered") {
    return (
      <section className={cn(surface, "px-5 py-10 sm:px-8 sm:py-16")}>
        {glow}
        {text}
      </section>
    );
  }
  return (
    <section className={cn(surface, "grid items-center gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-2 lg:gap-10 lg:px-12")}>
      {glow}
      {text}
      <div className="relative z-10">
        <Collage images={images} />
      </div>
    </section>
  );
}
