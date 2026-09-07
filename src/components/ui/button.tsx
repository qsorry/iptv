import { cn } from "@/lib/utils";
import type { ButtonSize, ButtonVariant } from "@/design-system/variants";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `tonal` اسم قديم يُعامل كـ secondary (مُبقى للتوافق مع لوحة التحكم). */
  variant?: ButtonVariant | "tonal";
  size?: ButtonSize;
};

/** أصناف الزر حسب variant/size من السجل. تُستخدم أيضاً للروابط التي تبدو كأزرار. */
export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: ButtonVariant | "tonal"; size?: ButtonSize; className?: string }) {
  const v: ButtonVariant = variant === "tonal" ? "secondary" : variant;
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-all duration-base ease-standard active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
    size === "lg" && "min-h-12 px-7 py-3 text-base",
    size === "md" && "min-h-10 px-6 py-2.5 text-sm",
    size === "sm" && "min-h-9 px-4 py-1.5 text-xs",
    v === "primary" && "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--brand-primary-hover)] hover:shadow-md",
    v === "secondary" && "bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:brightness-95",
    v === "outline" && "border border-[var(--button-outline-border)] bg-surface text-[var(--button-outline-text)] hover:bg-surface-2",
    v === "ghost" && "text-[var(--button-ghost-text)] hover:bg-brand-container",
    className,
  );
}

/**
 * زر لتنفيذ إجراء. للتنقّل استخدم Link مع buttonClasses().
 * variants: primary | secondary | outline | ghost — sizes: sm | md | lg (انظر design-system/variants.ts).
 */
export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: Props) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
