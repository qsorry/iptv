import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CategoryCardVariant } from "@/design-system/variants";
import { Icon, MDI } from "@/components/icons/mdi";

export interface CategoryCardData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
}

/** درجات لونية تُدوَّر على البطاقات لتنويع الإيقاع البصري؛ كلها حاويات من الرموز الدلالية. */
const TINTS = [
  "bg-[var(--secondary-container)] text-[var(--secondary-container-text)]",
  "bg-brand-container text-brand-container-fg",
  "bg-[var(--accent-container)] text-[var(--accent-container-text)]",
  "bg-[var(--success-container)] text-[var(--success-container-text)]",
] as const;

type Props = { category: CategoryCardData; variant?: CategoryCardVariant; index?: number };

/** بطاقة تصنيف: أيقونة/صورة + اسم (+ وصف في default). variants: default | compact. */
export function CategoryCard({ category: c, variant = "default", index = 0 }: Props) {
  const tint = TINTS[index % TINTS.length];
  const href = `/categories/${encodeURIComponent(c.slug)}`;
  const icon = (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--card-bg)] shadow-sm", variant === "compact" ? "h-12 w-12" : "h-14 w-14")}>
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <Icon path={MDI.StoreOutline} className="h-6 w-6" />
      )}
    </span>
  );

  if (variant === "compact") {
    return (
      <Link href={href} className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
        <span className={cn("grid h-16 w-16 place-items-center rounded-card", tint)}>{icon}</span>
        <span className="line-clamp-1 w-full text-xs font-medium">{c.name}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-2 rounded-card p-4 text-center transition-transform duration-base ease-standard hover:-translate-y-0.5",
        tint,
      )}
    >
      {icon}
      <span className="text-base font-bold">{c.name}</span>
      {c.description && <span className="line-clamp-1 text-xs opacity-80">{c.description}</span>}
    </Link>
  );
}
