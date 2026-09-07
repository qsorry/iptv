import Link from "next/link";

const ITEMS: { href: string; label: string; path: string }[] = [
  { href: "/", label: "الرئيسية", path: "M3 11 12 3l9 8v10h-6v-6H9v6H3z" },
  { href: "/categories", label: "الأقسام", path: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
  { href: "/cart", label: "السلة", path: "M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0" },
  { href: "/account", label: "حسابي", path: "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
];

/**
 * شريط تنقّل سفلي للجوال فقط (الرئيسية / الأقسام / السلة / الحساب).
 * ارتفاع ثابت + مساحة الأمان السفلية؛ الصفحة تحجز له مساحة في padding بلا قفز.
 */
export function MobileNavigation({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <nav
      aria-label="التنقّل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--header-border)] bg-[var(--mobilenav-bg)] pb-[var(--safe-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-ink-secondary hover:text-[var(--mobilenav-active)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={it.path} />
              </svg>
              <span>{it.label}</span>
              {it.href === "/cart" && cartCount > 0 && (
                <span className="absolute start-1/2 top-1.5 ms-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-fg" dir="ltr">
                  {cartCount}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
