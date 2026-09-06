import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5", className)}>
      {children}
    </div>
  );
}
