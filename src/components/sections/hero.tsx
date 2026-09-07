import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroVariant } from "@/design-system/variants";
import { buttonClasses } from "@/components/ui/button";

export interface HeroProps {
  title: string;
  /** سطر تعريفي قصير تحت العنوان. */
  subtitle?: string | null;
  cta?: { label: string; href: string };
  /** صورة غلاف المنتج الفعلية تُعرض في جانب الـ split وتملأ ارتفاع البطاقة. */
  image?: string | null;
  variant?: HeroVariant;
}

/**
 * قسم البطل. بطاقة أفقية عريضة واحدة تحمل h1 الوحيد للصفحة.
 * variants: centered (نص في المنتصف) | split (نص + صورة منتج جنباً إلى جنب حتى على الجوال) | banner (شريط مضغوط).
 */
export function Hero({ title, subtitle, cta, image, variant = "split" }: HeroProps) {
  const surface = "overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] shadow-card";
  const split = variant === "split";
  const text = (
    <div className={cn("flex flex-col", split ? "gap-3 sm:gap-5" : "gap-5", variant === "centered" && "items-center text-center")}>
      <h1
        className={cn(
          "font-bold leading-tight text-ink",
          variant === "banner" && "text-xl sm:text-3xl",
          variant === "centered" && "text-3xl sm:text-4xl lg:text-5xl",
          split && "text-2xl sm:text-4xl lg:text-5xl",
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p className={cn("max-w-lg leading-relaxed text-ink-secondary", variant === "banner" ? "text-sm" : "text-sm sm:text-lg", split && "line-clamp-3 sm:line-clamp-none")}>
          {subtitle}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className={buttonClasses({ variant: "primary", size: variant === "banner" ? "md" : "lg", className: cn("mt-1 w-fit gap-2", split && "min-h-10 px-5 text-sm sm:min-h-12 sm:px-7 sm:text-base") })}
        >
          {cta.label}
          <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
      )}
    </div>
  );

  if (variant === "banner") {
    return <section className={cn(surface, "px-5 py-6 sm:px-8")}>{text}</section>;
  }
  if (variant === "centered") {
    return <section className={cn(surface, "px-5 py-10 sm:px-8 sm:py-16")}>{text}</section>;
  }
  if (!image) {
    return <section className={cn(surface, "px-5 py-8 sm:px-10 sm:py-12 lg:px-14")}>{text}</section>;
  }
  return (
    <section className={cn(surface, "grid grid-cols-[minmax(0,1fr)_minmax(0,40%)] items-center sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]")}>
      <div className="min-w-0 py-5 ps-5 pe-3 sm:py-10 sm:ps-10 sm:pe-6 lg:py-14 lg:ps-14 lg:pe-8">{text}</div>
      <div className="flex min-w-0 items-center justify-center p-3 sm:p-6 lg:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="eager" fetchPriority="high" className="max-h-40 w-full rounded-card object-contain sm:max-h-72 lg:max-h-80" />
      </div>
    </section>
  );
}
