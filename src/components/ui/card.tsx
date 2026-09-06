import { cn } from "@/lib/utils";

/** بطاقة بأسلوب Material 3: سطح بحاوية لونية خفيفة، حواف مستديرة، وظل ناعم. */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)+0.25rem)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
