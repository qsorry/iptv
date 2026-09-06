import type { Metadata } from "next";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository, listPublicCategories } from "@/modules/catalog";
import { storeTestimonials } from "@/modules/reviews";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductGrid } from "@/components/storefront/product-grid";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  if (!store) return { title: "متجر غير متوفر" };
  const title = store.name;
  const description = store.description ?? `تسوّق من ${store.name}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, images: store.logoUrl ? [store.logoUrl] : undefined, type: "website", siteName: store.name },
    twitter: { card: "summary", title, description },
  };
}

const FEATURES = [
  { icon: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z", title: "تسليم فوري", sub: "استلم كودك مباشرة بعد الدفع" },
  { icon: "M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z", title: "دفع آمن", sub: "بوابات دفع موثوقة ومشفّرة" },
  { icon: "M20 6 9 17l-5-5", title: "جودة مضمونة", sub: "منتجات أصلية وخدمة موثوقة" },
  { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z", title: "دعم متواصل", sub: "فريقنا جاهز لمساعدتك دائماً" },
];

export default async function StorefrontHome() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر على هذا العنوان" />;
  const items = await productRepository.listPublic(store.id);
  const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) });
  const layout = ((settings?.settings as Record<string, unknown> | undefined)?.productLayout as string | undefined) ?? "grid";
  const cats = await listPublicCategories(store.id);
  const testimonials = await storeTestimonials(store.id, 6);

  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name,
    ...(store.description ? { description: store.description } : {}),
    ...(store.logoUrl ? { logo: store.logoUrl } : {}),
  };
  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: store.name,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "/search?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }} />

      {/* بطل الصفحة */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[var(--brand)] to-[color-mix(in_srgb,var(--brand)_55%,#000)] p-8 text-[var(--brand-fg)] shadow-sm sm:p-12">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold sm:text-4xl">{store.name}</h1>
          {store.description && <p className="mt-3 max-w-xl text-sm opacity-90 sm:text-lg">{store.description}</p>}
          {items.length > 0 && (
            <Link
              href="#products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--brand-fg)] px-6 py-2.5 text-sm font-semibold text-[var(--brand)] shadow-sm transition hover:brightness-105"
            >
              تسوّق الآن
            </Link>
          )}
        </div>
        <div className="pointer-events-none absolute -end-10 -top-10 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -start-6 h-56 w-56 rounded-full bg-black/10" />
      </section>

      {/* مميزات */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand-container)] text-[var(--brand-container-fg)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
            </span>
            <div>
              <div className="text-sm font-semibold">{f.title}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">{f.sub}</div>
            </div>
          </Card>
        ))}
      </section>

      {/* التصنيفات */}
      {cats.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold">تسوّق حسب التصنيف</h2>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${encodeURIComponent(c.slug)}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2 text-sm transition hover:bg-[var(--brand-container)] hover:text-[var(--brand-container-fg)]"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* المنتجات */}
      <section id="products">
        <h2 className="mb-4 text-lg font-bold">منتجاتنا</h2>
        {items.length === 0 ? (
          <EmptyState title="لا توجد منتجات بعد" />
        ) : (
          <ProductGrid items={items} currency={store.currencyCode} layout={layout as "grid" | "list" | "compact"} />
        )}
      </section>

      {/* آراء العملاء */}
      {testimonials.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold">آراء عملائنا</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-yellow-400" dir="ltr">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</span>
                  {t.verified && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">شراء موثّق</span>
                  )}
                </div>
                {t.body && <p className="line-clamp-4 text-sm leading-relaxed">{t.body}</p>}
                <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>{t.authorName ?? "عميل"}</span>
                  <Link href={`/products/${encodeURIComponent(t.productSlug)}`} className="hover:text-[var(--fg)]">{t.productName}</Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
