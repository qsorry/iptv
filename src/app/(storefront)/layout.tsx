import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId } from "@/core/tenancy/cart-cookie";
import { getCartView } from "@/modules/carts";
import { listPublicCategories } from "@/modules/catalog";
import { listFooterPages } from "@/modules/content";
import { themeVars } from "@/modules/stores";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

/** Layout واجهة المتجر. يُحدَّد المتجر من الدومين عبر middleware (core/tenancy). */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const store = await getStorefrontStore();
  const cartId = store ? await readCartId(store.id) : undefined;
  const cart = store && cartId ? await getCartView(store.id, cartId) : null;
  const count = cart?.count ?? 0;
  const brand = store?.brandColor ?? "#004d73";
  const settings = store ? await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) }) : null;
  const themeKey = (settings?.settings as Record<string, unknown> | undefined)?.theme as string | undefined;
  const vars = themeVars(themeKey, brand);
  const cats = store ? await listPublicCategories(store.id) : [];
  const footerPages = store ? await listFooterPages(store.id) : [];
  return (
    <div style={vars as React.CSSProperties}>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] pt-[var(--safe-top)]">
        <Container className="flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            {store?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} className="h-8 w-8 rounded object-cover" />
            ) : null}
            {store?.name ?? "المتجر"}
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            <Link href="/cart" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">السلة{count > 0 && <span className="ms-1 rounded-full bg-[var(--brand)] px-1.5 text-xs text-white" dir="ltr">{count}</span>}</Link>
            <Link href="/account" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">حسابي</Link>
          </nav>
        </Container>
        {cats.length > 0 && (
          <Container className="flex gap-4 overflow-x-auto pb-2 text-sm">
            {cats.map((c) => (
              <Link key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="whitespace-nowrap text-[var(--muted)] hover:text-[var(--fg)]">
                {c.name}
              </Link>
            ))}
          </Container>
        )}
      </header>
      <main className="pb-[calc(1.5rem+var(--safe-bottom))]">
        <Container className="py-4 sm:py-6">{children}</Container>
      </main>
      <footer className="mt-10 border-t border-[var(--border)] py-8">
        <Container className="flex flex-wrap items-center justify-between gap-4 text-sm text-[var(--muted)]">
          <div className="flex flex-wrap gap-4">
            <Link href="/blog" className="hover:text-[var(--fg)]">المدونة</Link>
            {footerPages.map((pg) => (
              <Link key={pg.slug} href={`/pages/${encodeURIComponent(pg.slug)}`} className="hover:text-[var(--fg)]">{pg.title}</Link>
            ))}
          </div>
          <span>© {new Date().getFullYear()} {store?.name}</span>
        </Container>
      </footer>
    </div>
  );
}
