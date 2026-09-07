import { cn } from "@/lib/utils";

/** عنصر تحميل نابض يحجز مساحة المحتوى (يمنع القفز في التخطيط). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-muted", className)} {...props} />;
}
