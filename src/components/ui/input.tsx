import { cn } from "@/lib/utils";

/** حقل إدخال متجاوب. حجم النص 16px يمنع تكبير الصفحة تلقائياً على iOS. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base",
        "outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}
