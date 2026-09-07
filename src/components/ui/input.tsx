import { cn } from "@/lib/utils";

/** حقل إدخال متجاوب. حجم النص 16px يمنع تكبير الصفحة تلقائياً على iOS. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-ink placeholder:text-[var(--input-placeholder)]",
        "outline-none transition-colors duration-fast focus:border-[var(--input-focus-border)] focus:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

/** حقل نص متعدّد الأسطر بنفس رموز الحقل المفرد (لصق JSON، وصف طويل). */
export function Textarea({ className, rows = 4, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-ink placeholder:text-[var(--input-placeholder)]",
        "outline-none transition-colors duration-fast focus:border-[var(--input-focus-border)] focus:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}
