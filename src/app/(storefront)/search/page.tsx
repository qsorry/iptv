import type { Metadata } from "next";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { TrackOnView } from "@/components/tracking/track-on-view";

export const metadata: Metadata = { title: "البحث", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر على هذا العنوان" />;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const items = query.length >= 1 ? await productRepository.search(store.id, query) : [];

  return (
    <div>
      {query.length > 0 && <TrackOnView key={query} event="search" data={{ searchTerm: query }} />}
      <form action="/search" className="relative mb-6">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="ابحث عن منتج…"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-1)] py-3 pe-4 ps-11 text-base outline-none focus:border-[var(--brand)]"
        />
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" style={{ insetInlineStart: "0.9rem" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </form>

      {query.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">اكتب كلمة للبحث عن المنتجات.</p>
      ) : items.length === 0 ? (
        <EmptyState title={`لا نتائج لـ «${query}»`} description="جرّب كلمة أخرى أو تصفّح التصنيفات." />
      ) : (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">
            {items.length} نتيجة لـ «{query}»
          </p>
          <ProductGrid items={items} currency={store.currencyCode} />
        </>
      )}
    </div>
  );
}
