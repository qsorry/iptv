import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroVariant } from "@/design-system/variants";
import { buttonClasses } from "@/components/ui/button";

export interface HeroProps {
  title: string;
  /** سطر تعريفي قصير تحت العنوان. */
  subtitle?: string | null;
  cta?: { label: string; href: string };
  /** صورة منتج واحدة تُعرض في جانب الـ split. بدونها يُرسم عمل فني هادئ من الرموز. */
  image?: string | null;
  variant?: HeroVariant;
}

/**
 * عمل فني احتياطي للاشتراكات الرقمية (شاشة + زر تشغيل) بألوان الرموز فقط.
 * يُستخدم عندما لا تتوفر صورة منتج؛ لا صور متراكبة ولا توهجات.
 */
function Artwork() {
  return (
    <svg viewBox="0 0 320 240" className="h-full w-full" fill="none" aria-hidden="true" focusable="false">
      <rect x="28" y="36" width="264" height="152" rx="18" className="fill-[var(--card-bg)] stroke-[var(--card-border)]" strokeWidth="2" />
      <rect x="44" y="52" width="232" height="120" rx="10" className="fill-brand-container" />
      <circle cx="160" cy="112" r="30" className="fill-brand" />
      <path d="M152 98v28l22-14z" className="fill-[var(--text-on-brand)]" />
      <rect x="132" y="196" width="56" height="8" rx="4" className="fill-[var(--card-border)]" />
      <rect x="112" y="208" width="96" height="8" rx="4" className="fill-[var(--card-border)]" />
    </svg>
  );
}

function Visual({ image }: { image?: string | null }) {
  return (
    <div className="overflow-hidden rounded-card bg-surface-muted">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="eager" fetchPriority="high" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full p-6 sm:p-8">
          <Artwork />
        </div>
      )}
    </div>
  );
}

/**
 * قسم البطل. بطاقة أفقية واحدة نظيفة تحمل h1 الوحيد للصفحة.
 * variants: centered (نص في المنتصف) | split (نص + صورة منتج واحدة) | banner (شريط مضغوط).
 */
export function Hero({ title, subtitle, cta, image, variant = "split" }: HeroProps) {
  const surface = "overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] shadow-card";
  const text = (
    <div className={cn("flex flex-col gap-5", variant === "centered" && "items-center text-center")}>
      <h1 className={cn("font-bold leading-tight text-ink", variant === "banner" ? "text-xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl")}>{title}</h1>
      {subtitle && <p className={cn("max-w-lg leading-relaxed text-ink-secondary", variant === "banner" ? "text-sm" : "text-base sm:text-lg")}>{subtitle}</p>}
      {cta && (
        <Link href={cta.href} className={buttonClasses({ variant: "primary", size: variant === "banner" ? "md" : "lg", className: "mt-1 w-fit gap-2" })}>
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
  return (
    <section className={cn(surface, "grid items-center gap-8 p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-12")}>
      {text}
      <Visual image={image} />
    </section>
  );
}
