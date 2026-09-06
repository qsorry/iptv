import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Container } from "@/components/ui/container";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId } from "@/core/tenancy/cart-cookie";
import { getCartView } from "@/modules/carts";
import { listPublicCategories } from "@/modules/catalog";
import { listFooterPages } from "@/modules/content";
import { themeModeVars, googleFontHref, readFooterSettings } from "@/modules/stores";
import { StoreFooter } from "@/components/storefront/store-footer";
import { ThemeToggle } from "@/components/storefront/theme-toggle";
import { THEME_INIT_SCRIPT, THEME_MODE_KEY, THEME_ROOT_ID, isThemeMode, type ThemeMode } from "@/components/storefront/theme-mode";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

/** بيانات SEO على مستوى المتجر: عنوان بلا لاحقة المنصة، وقاعدة عنوان مطلقة. */
export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const base = host ? new URL(`${scheme}://${host}`) : undefined;
  const name = store?.name ?? "المتجر";
  return {
    metadataBase: base,
    applicationName: name,
    title: { default: name, template: `%s — ${name}` },
    description: store?.description ?? `تسوّق من ${name}`,
    icons: store?.logoUrl ? { icon: store.logoUrl } : undefined,
    openGraph: { siteName: name, type: "website" },
  };
}

/** يحوّل متغيرات الثيم إلى تصريحات CSS. القيم من ثوابت الكود ولون العلامة المُتحقَّق منه. */
function cssDecls(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/**
 * CSS الثيم لجذر المتجر: لوحة الوضع الفاتح افتراضياً، الداكن عند `data-theme="dark"`
 * أو عند تفضيل النظام للداكن ما لم يختر الزائر الفاتح صراحةً (اختيار الزائر من مبدّل الثيم).
 */
function themeCss(light: Record<string, string>, dark: Record<string, string>): string {
  const root = `#${THEME_ROOT_ID}`;
  return [
    `${root}{${cssDecls(light)};color-scheme:light}`,
    `${root}[data-theme="dark"]{${cssDecls(dark)};color-scheme:dark}`,
    `@media (prefers-color-scheme: dark){${root}:not([data-theme="light"]){${cssDecls(dark)};color-scheme:dark}}`,
  ].join("\n");
}

/** Layout واجهة المتجر. يُحدَّد المتجر من الدومين عبر middleware (core/tenancy). */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const store = await getStorefrontStore();
  const cartId = store ? await readCartId(store.id) : undefined;
  const cart = store && cartId ? await getCartView(store.id, cartId) : null;
  const count = cart?.count ?? 0;
  const rawBrand = store?.brandColor ?? "#004d73";
  const brand = /^#[0-9a-fA-F]{6}$/.test(rawBrand) ? rawBrand : "#004d73";
  const settings = store ? await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) }) : null;
  const s = (settings?.settings as Record<string, unknown> | undefined) ?? {};
  const palettes = themeModeVars(
    { theme: s.theme as string | undefined, font: s.font as string | undefined, roundness: s.roundness as string | undefined },
    brand,
  );
  const fontHref = googleFontHref(s.font as string | undefined);
  // وضع الزائر المحفوظ في الكوكي يُرسَم من الخادم لتفادي وميض الثيم؛ السكربت أدناه يراعي localStorage أيضاً.
  const cookieMode = (await cookies()).get(THEME_MODE_KEY)?.value;
  const mode: ThemeMode = isThemeMode(cookieMode) ? cookieMode : "system";
  const cats = store ? await listPublicCategories(store.id) : [];
  const footerPages = store ? await listFooterPages(store.id) : [];
  return (
    <div
      id={THEME_ROOT_ID}
      data-theme={mode === "system" ? undefined : mode}
      suppressHydrationWarning
      className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]"
      style={{ fontFamily: "var(--font)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: themeCss(palettes.light, palettes.dark) }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] pt-[var(--safe-top)] backdrop-blur-md">
        <Container className="flex items-center gap-3 py-3 sm:py-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold sm:text-xl">
            {store?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} className="h-9 w-9 rounded-full object-cover" />
            ) : null}
            <span className="max-w-[40vw] truncate sm:max-w-none">{store?.name ?? "المتجر"}</span>
          </Link>

          {/* بحث */}
          <form action="/search" className="relative hidden flex-1 sm:block">
            <input
              name="q"
              placeholder="ابحث عن منتج…"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-1)] py-2.5 pe-4 ps-10 text-sm outline-none focus:border-[var(--brand)]"
            />
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" style={{ insetInlineStart: "0.75rem" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </form>

          <nav className="ms-auto flex items-center gap-1 text-sm sm:ms-0">
            <Link href="/search" aria-label="بحث" className="touch-target grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)] sm:hidden">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </Link>
            <ThemeToggle initialMode={mode} />
            <Link href="/cart" className="touch-target relative grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)]" aria-label="السلة">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0" /></svg>
              {count > 0 && <span className="absolute -top-0.5 -start-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]" dir="ltr">{count}</span>}
            </Link>
            <Link href="/account" aria-label="حسابي" className="touch-target grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--surface-2)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>
            </Link>
          </nav>
        </Container>
        {cats.length > 0 && (
          <Container className="flex gap-2 overflow-x-auto pb-2 text-sm">
            {cats.map((c) => (
              <Link key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="whitespace-nowrap rounded-full bg-[var(--surface-1)] px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--brand-container)] hover:text-[var(--brand-container-fg)]">
                {c.name}
              </Link>
            ))}
          </Container>
        )}
      </header>
      <main className="flex-1 pb-[calc(1.5rem+var(--safe-bottom))]">
        <Container className="py-4 sm:py-6">{children}</Container>
      </main>
      <StoreFooter
        store={{ name: store?.name ?? "المتجر", logoUrl: store?.logoUrl, description: store?.description }}
        footer={readFooterSettings(s)}
        vatNumber={typeof s.vatNumber === "string" ? s.vatNumber : ""}
        pages={footerPages}
      />
    </div>
  );
}
