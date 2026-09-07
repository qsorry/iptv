import { cn } from "@/lib/utils";

/** حاوية متمركزة بعرض أقصى (--container-max) وحواف متجاوبة. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-container px-4 sm:px-6", className)}>{children}</div>;
}
