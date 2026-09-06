"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/shared/sign-out-button";

const nav = [
  { href: "/admin/dashboard", label: "الرئيسية" },
  { href: "/admin/products", label: "المنتجات" },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/inventory", label: "المخزون" },
  { href: "/admin/settings", label: "الإعدادات" },
];

/**
 * هيكل لوحة التحكم المتجاوب:
 * - كمبيوتر (md+): شريط جانبي ثابت.
 * - جوال: شريط علوي مع زر قائمة يفتح درج منزلق.
 */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const NavLinks = () => (
    <nav className="space-y-1 text-sm">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "block rounded-[var(--radius)] px-3 py-2.5 transition",
              active ? "bg-[var(--brand)] text-[var(--brand-fg)]" : "hover:bg-black/5",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex h-full flex-col p-4", mobile && "pt-[calc(1rem+var(--safe-top))]")}>
      <div className="mb-6 text-lg font-bold">لوحة التحكم</div>
      <NavLinks />
      <div className="mt-auto border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <div className="mb-1 truncate" dir="ltr">{email}</div>
        <SignOutButton />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* شريط علوي — الجوال فقط */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 pt-[calc(0.75rem+var(--safe-top))] md:hidden">
        <button
          aria-label="فتح القائمة"
          onClick={() => setOpen(true)}
          className="rounded-[var(--radius)] p-2 hover:bg-black/5"
        >
          <span className="block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
          <span className="mt-1.5 block h-0.5 w-6 bg-current" />
        </button>
        <span className="font-bold">لوحة التحكم</span>
      </header>

      {/* شريط جانبي — الكمبيوتر فقط */}
      <aside className="hidden w-60 shrink-0 border-l border-[var(--border)] bg-[var(--surface)] md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* درج منزلق — الجوال فقط */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85%] bg-[var(--surface)] shadow-xl">
            <Sidebar mobile />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 pb-[calc(1rem+var(--safe-bottom))] sm:p-6">{children}</main>
    </div>
  );
}
