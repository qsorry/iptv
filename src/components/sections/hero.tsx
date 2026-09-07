import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroVariant } from "@/design-system/variants";
import { buttonClasses } from "@/components/ui/button";

/** عمل فني للبطل: نسخة عريضة (8:3) لسطح المكتب ونسخة مربعة للجوال. */
export interface HeroArtwork {
  wide: string;
  square: string;
}

export interface HeroProps {
  title: string;
  /** سطر تعريفي قصير تحت العنوان. */
  subtitle?: string | null;
  cta?: { label: string; href: string };
  /** عمل فني متكامل (خلفية + المنتج) لـ variant=artwork؛ النص الحي يُرسم فوقه ليبدو قطعة واحدة. */
  artwork?: HeroArtwork | null;
  /** صورة غلاف المنتج لـ variant=split (نص على جهة وصورة على الأخرى). */
  image?: string | null;
  variant?: HeroVariant;
}

/**
 * قسم البطل. يحمل h1 الوحيد للصفحة.
 * variants: artwork (لوحة إعلانية: عمل فني + نص حي فوقه) | split (نص + صورة أول منتج) | centered | banner.
 * يهبط artwork إلى split عند غياب العمل الفني، وsplit إلى نص فقط عند غياب الصورة.
 */
export function Hero({ title, subtitle, cta, artwork, image, variant = "artwork" }: HeroProps) {
  const surface = "overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] shadow-card";
  const onArt = variant === "artwork" && Boolean(artwork);
  const text = (
    <div className={cn("flex flex-col gap-4 sm:gap-5", variant === "centered" && "items-center text-center", onArt && "gap-2.5 items-center text-center sm:items-start sm:text-start")}>
      <h1
        className={cn(
          "font-bold leading-tight",
          onArt ? "text-brand-fg text-2xl sm:text-4xl lg:text-5xl" : "text-ink",
          variant === "banner" && "text-xl sm:text-3xl",
          variant === "centered" && "text-3xl sm:text-4xl lg:text-5xl",
          variant === "split" && "text-2xl sm:text-4xl lg:text-5xl",
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={cn(
            "max-w-lg leading-relaxed",
            onArt ? "text-brand-fg/80 text-xs sm:text-lg" : "text-ink-secondary",
            variant === "banner" && "text-sm",
            variant === "centered" && "text-base sm:text-lg",
            variant === "split" && "text-sm sm:text-lg",
            variant === "split" && "line-clamp-3 sm:line-clamp-none",
            onArt && "line-clamp-3",
          )}
        >
          {subtitle}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className={buttonClasses({
            variant: "primary",
            size: variant === "banner" ? "md" : "lg",
            className: cn(
              "mt-1 w-fit gap-2",
              onArt && "min-h-10 bg-surface px-5 text-sm text-ink shadow-lg hover:bg-surface hover:brightness-95 sm:min-h-12 sm:px-7 sm:text-base",
              variant === "split" && "min-h-10 px-5 text-sm sm:min-h-12 sm:px-7 sm:text-base",
            ),
          })}
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
  if (onArt && artwork) {
    return (
      <section className={cn(surface, "relative aspect-square sm:aspect-[8/3]")}>
        <picture>
          <source media="(min-width: 640px)" srcSet={artwork.wide} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artwork.square} alt="" loading="eager" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        </picture>
        {/* منطقة النص تطابق الفراغ المتروك في العمل الفني: أعلى المربع، وجهة البداية في العريض */}
        <div className="absolute inset-x-0 top-0 flex h-[56%] items-start justify-center px-5 pt-5 sm:inset-y-0 sm:start-0 sm:h-auto sm:w-[52%] sm:items-center sm:justify-start sm:ps-12 sm:pe-6 sm:pt-0 lg:ps-16">
          {text}
        </div>
      </section>
    );
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
