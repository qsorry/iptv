import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { brandProducts } from "@/modules/catalog";
import { ProductGrid } from "@/components/commerce/product-grid";
import { Breadcrumbs } from "@/components/commerce/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

const PER_PAGE = 24;
type Params = Promise<{ slug: string }>;
type Search = Promise<{ page?: string }>;

function pageNumber(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

const brandHref = (slug: string, page: number) => `/brands/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ""}`;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  const page = pageNumber((await searchParams).page);
  if (!store) return { title: "ماركة" };
  const data = await brandProducts(store.id, decodeURIComponent(slug), { page, perPage: PER_PAGE });
  if (!data) return { title: "ماركة غير موجودة" };
  const suffix = page > 1 ? ` — صفحة ${page}` : "";
  const description = `تسوّق منتجات ${data.brand.name} من ${store.name}`;
  return {
    title: `${data.brand.name}${suffix}`,
    description,
    alternates: { canonical: brandHref(data.brand.slug, page) },
    openGraph: { title: `${data.brand.name}${suffix}`, description, type: "website", siteName: store.name },
  };
}

export default async function BrandPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const { slug } = await params;
  const page = pageNumber((await searchParams).page);
  const data = await brandProducts(store.id, decodeURIComponent(slug), { page, perPage: PER_PAGE });
  if (!data || (page > 1 && page > data.totalPages)) notFound();
  const { brand, products, totalPages } = data;

  const brandLd = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(brandLd) }} />
      {page > 1 && <link rel="prev" href={brandHref(brand.slug, page - 1)} />}
      {page < totalPages && <link rel="next" href={brandHref(brand.slug, page + 1)} />}

      <Breadcrumbs items={[{ name: "الرئيسية", href: "/" }, { name: brand.name }]} />

      <div className="mb-4 flex items-center gap-3">
        {brand.logoUrl && (
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt={brand.name} className="h-full w-full object-contain" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold">{brand.name}</h1>
          <p className="text-sm text-ink-secondary">{data.total} منتج</p>
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات لهذه الماركة" />
      ) : (
        <ProductGrid items={products} currency={store.currencyCode} className="mt-4" />
      )}

      {totalPages > 1 && (
        <nav aria-label="ترقيم الصفحات" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={brandHref(brand.slug, page - 1)} rel="prev" className={buttonClasses({ variant: "outline", size: "sm" })}>السابق</Link>
          ) : (
            <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>السابق</span>
          )}
          <span className="text-ink-secondary" dir="ltr">{page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={brandHref(brand.slug, page + 1)} rel="next" className={buttonClasses({ variant: "outline", size: "sm" })}>التالي</Link>
          ) : (
            <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>التالي</span>
          )}
        </nav>
      )}
    </div>
  );
}
