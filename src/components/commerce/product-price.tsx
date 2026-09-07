import { cn } from "@/lib/utils";
import { formatMoney } from "@/core/money";

type Props = { price: number; compareAt?: number; currency: string; size?: "sm" | "md" | "lg"; className?: string };

/** سعر المنتج بالهللة مع سعر المقارنة إن وُجد خصم. الأرقام بالاتجاه LTR دائماً. */
export function ProductPrice({ price, compareAt = 0, currency, size = "md", className }: Props) {
  const hasDiscount = compareAt > price && price > 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn("font-bold text-[var(--price-color)]", size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm")}
        dir="ltr"
      >
        {formatMoney(price, currency)}
      </span>
      {hasDiscount && (
        <span className={cn("text-[var(--price-old-color)] line-through", size === "lg" ? "text-base" : "text-xs")} dir="ltr">
          {formatMoney(compareAt, currency)}
        </span>
      )}
    </div>
  );
}
