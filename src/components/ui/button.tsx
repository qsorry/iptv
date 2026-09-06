import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "tonal";
  size?: "md" | "sm";
};

/**
 * زر بأسلوب Material 3: شكل حبّة (pill)، طبقة حالة عند التمرير، وارتفاع لوني للأساسي.
 * هدف اللمس مضمون عبر min-height في globals.css.
 */
export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "px-6 py-2.5 text-sm" : "px-4 py-1.5 text-xs",
        variant === "primary" && "bg-[var(--brand)] text-[var(--brand-fg)] shadow-sm hover:shadow-md hover:brightness-110",
        variant === "tonal" && "bg-[var(--brand-container)] text-[var(--brand-container-fg)] hover:brightness-105",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]",
        variant === "ghost" && "text-[var(--brand)] hover:bg-[var(--brand-container)]",
        className,
      )}
      {...props}
    />
  );
}
