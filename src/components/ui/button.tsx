import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
};

/** زر أساسي متجاوب. هدف اللمس مضمون عبر min-height في globals.css. */
export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius)] font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
        variant === "primary" && "bg-[var(--brand)] text-[var(--brand-fg)] hover:opacity-90",
        variant === "secondary" && "border border-[var(--border)] bg-[var(--surface)] hover:bg-black/5",
        variant === "ghost" && "hover:bg-black/5",
        className,
      )}
      {...props}
    />
  );
}
