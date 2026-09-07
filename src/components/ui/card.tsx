import { cn } from "@/lib/utils";
import type { CardVariant } from "@/design-system/variants";

type Props = React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; children: React.ReactNode };

/** حاوية محتوى بسطح وحدود واستدارة من رموز البطاقة. variants: default | elevated | flat. */
export function Card({ className, variant = "default", children, ...props }: Props) {
  return (
    <div
      className={cn(
        "rounded-card bg-[var(--card-bg)] p-4 sm:p-5",
        variant === "default" && "border border-[var(--card-border)] shadow-card",
        variant === "elevated" && "shadow-md",
        variant === "flat" && "border border-[var(--card-border)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
