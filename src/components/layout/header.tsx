import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeaderVariant } from "@/design-system/variants";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/storefront/theme-toggle";
import type { ThemeMode } from "@/components/storefront/theme-mode";

export interface HeaderProps {
  store: { name: string; logoUrl?: string | null };
  categories: { id: string; name: string; slug: string }[];
  cartCount: number;
  themeMode: ThemeMode;
  /** standard: بحث + تصنيفات؛ minimal: الشعار والأيقونات فقط (سلة/دفع). */
  variant?: HeaderVariant;
}

const ICON = "h-5 w-5";
const ICON_BTN = "touch-target relative grid h-10 w-10 place-items-center rounded-full transition-colors duration-fast hover:bg-surface-2";

function SearchIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * الشريط العلوي اللاصق لواجهة المتجر. variants: standard | minimal.
 * لا يجلب بيانات؛ كل شيء يأتي من layout الخادم.
 */
export function Header({ store, categories, cartCount, themeMode, variant = "standard" }: HeaderProps) {
  const minimal = variant === "minimal";
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--header-border)] bg-[var(--header-bg)] pt-[var(--safe-top)] text-[var(--header-text)] backdrop-blur-md">
      <Container className="flex items-center gap-3 py-3 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold sm:text-xl">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-base text-brand-fg" aria-hidden="true">
              {store.name.slice(0, 1)}
            </span>
          )}
          <span className="max-w-[40vw] truncate sm:max-w-none">{store.name}</span>
        </Link>

        {!minimal && (
          <form action="/search" role="search" className="relative hidden flex-1 sm:block">
            <label htmlFor="header-search" className="sr-only">ابحث عن منتج أو خدمة</label>
            <input
              id="header-search"
              name="q"
              placeholder="ابحث عن منتج أو خدمة…"
              className="w-full rounded-full border border-[var(--input-border)] bg-surface-1 py-2.5 pe-4 ps-10 text-base outline-none transition-colors duration-fast focus:border-[var(--input-focus-border)]"
            />
            <SearchIcon className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" style={{ insetInlineStart: "0.75rem" }} />
          </form>
        )}

        <nav aria-label="حساب وسلة" className="ms-auto flex items-center gap-1 text-sm sm:ms-0">
          {!minimal && (
            <Link href="/search" aria-label="بحث" className={cn(ICON_BTN, "sm:hidden")}>
              <SearchIcon className={ICON} />
            </Link>
          )}
          <ThemeToggle initialMode={themeMode} />
          <Link href="/cart" className={ICON_BTN} aria-label={cartCount > 0 ? `السلة، ${cartCount} عناصر` : "السلة"}>
            <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -start-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-fg" dir="ltr">
                {cartCount}
              </span>
            )}
          </Link>
          <Link href="/account" aria-label="حسابي" className={cn(ICON_BTN, "hidden sm:grid")}>
            <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            </svg>
          </Link>
        </nav>
      </Container>
      {!minimal && categories.length > 0 && (
        <nav aria-label="التصنيفات" className="hidden sm:block">
          <Container className="scrollbar-none flex gap-1 overflow-x-auto pb-2 text-sm">
            <Link href="/" className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-brand">الرئيسية</Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${encodeURIComponent(c.slug)}`}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-ink-secondary transition-colors duration-fast hover:bg-brand-container hover:text-brand-container-fg"
              >
                {c.name}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
