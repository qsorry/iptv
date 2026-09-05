import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-[var(--brand)] text-white hover:opacity-90",
        variant === "secondary" && "border bg-white hover:bg-gray-50",
        variant === "ghost" && "hover:bg-gray-100",
        className,
      )}
      {...props}
    />
  );
}
