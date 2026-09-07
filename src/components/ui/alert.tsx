import { cn } from "@/lib/utils";
import type { AlertVariant } from "@/design-system/variants";

type Props = React.HTMLAttributes<HTMLParagraphElement> & { variant?: AlertVariant };

/** رسالة حالة مضمّنة (نجاح/خطأ/تنبيه/معلومة). variants: info | success | warning | error. */
export function Alert({ className, variant = "info", role, ...props }: Props) {
  return (
    <p
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cn(
        "rounded-input border p-3 text-sm",
        variant === "info" && "border-[var(--border-default)] bg-brand-container text-brand-container-fg",
        variant === "success" && "border-[var(--success-container-text)]/20 bg-[var(--success-container)] text-[var(--success-container-text)]",
        variant === "warning" && "border-[var(--accent-container-text)]/20 bg-[var(--accent-container)] text-[var(--accent-container-text)]",
        variant === "error" && "border-[var(--error-bg)]/30 bg-[color-mix(in_srgb,var(--error-bg)_12%,var(--surface-primary))] text-[color-mix(in_srgb,var(--error-bg)_75%,var(--text-primary))]",
        className,
      )}
      {...props}
    />
  );
}
