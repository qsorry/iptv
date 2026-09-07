import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/design-system/variants";

type Props = React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant };

/** شارة نصية قصيرة (حالة، تمييز). variants: default | success | warning | error. */
export function Badge({ className, variant = "default", ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5",
        variant === "default" && "bg-[var(--badge-bg)] text-[var(--badge-text)]",
        variant === "success" && "bg-[var(--success-container)] text-[var(--success-container-text)]",
        variant === "warning" && "bg-[var(--accent-container)] text-[var(--accent-container-text)]",
        variant === "error" && "bg-[var(--discount-bg)] text-[var(--discount-text)]",
        className,
      )}
      {...props}
    />
  );
}
