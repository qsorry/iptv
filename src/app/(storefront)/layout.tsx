import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Container } from "@/components/ui/container";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId } from "@/core/tenancy/cart-cookie";
import { getCartView } from "@/modules/carts";
import { listPublicCategories } from "@/modules/catalog";
import { listFooterPages } from "@/modules/content";
import { resolveSeo, readThemeConfig, storeThemeCss, googleFontHref, fontPreloads, readFooterSettings, DEFAULT_THEME, THEME_VERSION } from "@/modules/stores";
import { StoreFooter } from "@/components/storefront/store-footer";
import { Header } from "@/components/layout/header";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { THEME_INIT_SCRIPT, THEME_MODE_KEY, THEME_ROOT_ID, isThemeMode, type ThemeMode } from "@/components/storefront/theme-mode";
import { TrackingScripts } from "@/components/tracking/tracking-scripts";
import { ConsentBanner } from "@/components/tracking/consent-banner";
import { publicIntegrations } from "@/modules/tracking";
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
  const settingsRow = store ? await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) }) : null;
  const seo = store ? resolveSeo(settingsRow?.settings as Record<string, unknown> | undefined, store) : null;
  const integrations = store ? await publicIntegrations(store.id) : {};
  const googleVerification = integrations.google?.siteVerification;
  return {
    verification: googleVerification ? { google: googleVerification } : undefined,
    metadataBase: base,
    applicationName: name,
    title: { default: name, template: `%s — ${name}` },
    description: seo?.description ?? `تسوّق من ${name}`,
    icons: store?.logoUrl ? { icon: store.logoUrl } : undefined,
    openGraph: { siteName: name, type: "website" },
  };
}

/**
 * Layout واجهة المتجر. يُحدَّد المتجر من الدومين عبر middleware (core/tenancy).
 * الثيم (قيم رموز فقط) يُحقن خادمياً كـ <style> داخلي عند الجذر `data-theme-scope`
 * فتُعاد حسابة الرموز الدلالية منه (انظر src/design-system). لا وميض، لا بناء لكل متجر.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const store = await getStorefrontStore();
  const cartId = store ? await readCartId(store.id) : undefined;
  const cart = store && cartId ? await getCartView(store.id, cartId) : null;
  const count = cart?.count ?? 0;
  const settings = store ? await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) }) : null;
  const s = (settings?.settings as Record<string, unknown> | undefined) ?? {};
  const themeCfg = readThemeConfig(s, store?.brandColor);
  const themeKey = themeCfg.theme ?? DEFAULT_THEME;
  const fontHref = googleFontHref(themeCfg.font, themeKey);
  const preloads = fontPreloads(themeCfg.font, themeKey);
  // وضع الزائر المحفوظ في الكوكي يُرسَم من الخادم لتفادي وميض الثيم؛ السكربت أدناه يراعي localStorage أيضاً.
  const cookieMode = (await cookies()).get(THEME_MODE_KEY)?.value;
  const mode: ThemeMode = isThemeMode(cookieMode) ? cookieMode : "system";
  const integrations = store ? await publicIntegrations(store.id) : {};
  const pixels = {
    meta: integrations.meta?.pixelId,
    tiktok: integrations.tiktok?.pixelCode,
    snapchat: integrations.snapchat?.pixelId,
    clarity: integrations.clarity?.projectId,
  };
  const cats = store ? await listPublicCategories(store.id) : [];
  const footerPages = store ? await listFooterPages(store.id) : [];
  const storeInfo = { name: store?.name ?? "المتجر", logoUrl: store?.logoUrl, description: store?.description };
  return (
    <div
      id={THEME_ROOT_ID}
      data-theme-scope=""
      data-theme-name={themeKey}
      data-theme-version={THEME_VERSION}
      data-theme={mode === "system" ? undefined : mode}
      suppressHydrationWarning
      className="flex min-h-screen flex-col bg-page font-sans text-ink"
    >
      <style dangerouslySetInnerHTML={{ __html: storeThemeCss(`#${THEME_ROOT_ID}`, themeCfg) }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {preloads.map((href) => (
        <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
      ))}
      {fontHref && (
        <>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontHref} />
        </>
      )}
      <Header store={storeInfo} categories={cats} cartCount={count} themeMode={mode} />
      <main className="flex-1 pb-[calc(4.5rem+var(--safe-bottom))] sm:pb-[calc(1.5rem+var(--safe-bottom))]">
        <Container className="py-4 sm:py-6">{children}</Container>
      </main>
      <StoreFooter store={storeInfo} footer={readFooterSettings(s)} vatNumber={typeof s.vatNumber === "string" ? s.vatNumber : ""} pages={footerPages} />
      <MobileNavigation cartCount={count} />
      <TrackingScripts pixels={pixels} />
      <ConsentBanner />
    </div>
  );
}
