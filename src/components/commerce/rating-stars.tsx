import { cn } from "@/lib/utils";

/** نجوم عرض فقط بلون التقييم من الرموز. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={cn("text-[var(--rating-color)]", className)} dir="ltr" aria-label={`${value} من 5`}>
      {"★".repeat(full)}
      <span className="text-[var(--border-strong)]">{"★".repeat(5 - full)}</span>
    </span>
  );
}
