"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/shared/sign-out-button";

type Badges = { pendingOrders: number; pendingReviews: number };

const nav: { href: string; label: string; icon: keyof typeof icons; badge?: keyof Badges }[] = [
  { href: "/admin/dashboard", label: "الرئيسية", icon: "home" },
  { href: "/admin/products", label: "المنتجات", icon: "box" },
  { href: "/admin/categories", label: "التصنيفات", icon: "tag" },
  { href: "/admin/orders", label: "الطلبات", icon: "bag", badge: "pendingOrders" },
  { href: "/admin/customers", label: "العملاء", icon: "users" },
  { href: "/admin/inventory", label: "المخزون", icon: "layers" },
  { href: "/admin/subscriptions", label: "الاشتراكات", icon: "plug" },
  { href: "/admin/coupons", label: "الكوبونات", icon: "ticket" },
  { href: "/admin/reviews", label: "التقييمات", icon: "chat", badge: "pendingReviews" },
  { href: "/admin/reports", label: "التقارير", icon: "chart" },
  { href: "/admin/pages", label: "الصفحات", icon: "page" },
  { href: "/admin/blog", label: "المدونة", icon: "megaphone" },
  { href: "/admin/team", label: "الفريق", icon: "users" },
  { href: "/admin/settings", label: "الإعدادات", icon: "gear" },
];

const icons = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10",
  box: "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5 12 12l9-4.5M12 12v9",
  tag: "M20 12 12 4H5v7l8 8 7-7ZM7.5 7.5h.01",
  bag: "M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0",
  users: "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 10v-1a4 4 0 0 0-3-3.87",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5",
  ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z",
  chat: "M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z",
  chart: "M4 20V10M10 20V4M16 20v-7M20 20H3",
  page: "M6 3h9l5 5v13H6V3Zm9 0v5h5M9 12h6M9 16h6",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Zm12-4v10a4 4 0 0 0 0-10Z",
  plug: "M9 3v4m6-4v4M6 7h12v3a6 6 0 0 1-12 0V7Zm6 9v5",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2l-.4-2.6H9.5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z",
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d={d} />
    </svg>
  );
}

export function AdminShell({
  storeName,
  logoUrl,
  email,
  storeUrl,
  badges,
  children,
}: {
  storeName: string;
  logoUrl: string | null;
  email: string;
  storeUrl: string;
  badges: Badges;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const Sidebar = () => (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0b3b45] to-[#062830] text-white/90">
      {/* رأس المتجر */}
      <div className="p-4 pt-[calc(1rem+var(--safe-top))]">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold">{storeName.slice(0, 1)}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-bold">{storeName}</div>
            <div className="text-xs text-white/50">لوحة التحكم</div>
          </div>
        </div>
        <a
          href={storeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/20"
        >
          زيارة المتجر
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>

      {/* التنقل */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active ? "bg-white/15 font-medium text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon d={icons[item.icon]} />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white" dir="ltr">{count > 99 ? "99+" : count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* المستخدم */}
      <div className="border-t border-white/10 p-3 text-xs text-white/60">
        <div className="mb-1 truncate" dir="ltr">{email}</div>
        <SignOutButton />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] md:flex">
      {/* شريط علوي — الجوال */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 pt-[calc(0.75rem+var(--safe-top))] md:hidden">
        <button aria-label="القائمة" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-black/5">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="font-bold">{storeName}</span>
      </header>

      {/* شريط جانبي — الكمبيوتر */}
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* درج — الجوال */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85%] shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 pb-[calc(1.5rem+var(--safe-bottom))] sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
