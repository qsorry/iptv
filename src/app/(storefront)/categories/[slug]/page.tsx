import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { categoryProducts } from "@/modules/catalog";
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

const categoryHref = (slug: string, page: number) => `/categories/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ""}`;

/**
 * الصفحة 1 canonical لنفسها؛ الصفحات 2+ ذاتية وقابلة للفهرسة (لا canonical نحو الصفحة 1).
 * أي معامل آخر (فلترة/ترتيب) يُعامل مستقبلاً كـ noindex مع canonical للتصنيف النظيف.
 */
export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  const page = pageNumber((await searchParams).page);
  if (!store) return { title: "تصنيف" };
  const data = await categoryProducts(store.id, decodeURIComponent(slug), { page, perPage: PER_PAGE });
  if (!data) return { title: "تصنيف غير موجود" };
  const suffix = page > 1 ? ` — صفحة ${page}` : "";
  const description = data.category.description ?? `تسوّق ${data.category.name} من ${store.name}`;
  return {
    title: `${data.category.name}${suffix}`,
    description,
    alternates: { canonical: categoryHref(data.category.slug, page) },
    openGraph: { title: `${data.category.name}${suffix}`, description, type: "website", siteName: store.name },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const { slug } = await params;
  const page = pageNumber((await searchParams).page);
  const data = await categoryProducts(store.id, decodeURIComponent(slug), { page, perPage: PER_PAGE });
  if (!data || (page > 1 && page > data.totalPages)) notFound();
  const { category, products, totalPages } = data;

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    numberOfItems: data.total,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: (page - 1) * PER_PAGE + i + 1,
      url: `/products/${encodeURIComponent(p.slug)}`,
      name: p.name,
    })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {page > 1 && <link rel="prev" href={categoryHref(category.slug, page - 1)} />}
      {page < totalPages && <link rel="next" href={categoryHref(category.slug, page + 1)} />}

      <Breadcrumbs items={[{ name: "الرئيسية", href: "/" }, { name: "الأقسام", href: "/categories" }, { name: category.name }]} />
      <h1 className="mb-1 text-2xl font-bold">{category.name}</h1>
      {category.description && <p className="mb-4 text-sm text-ink-secondary">{category.description}</p>}

      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات في هذا التصنيف" />
      ) : (
        <ProductGrid items={products} currency={store.currencyCode} className="mt-4" />
      )}

      {totalPages > 1 && (
        <nav aria-label="ترقيم الصفحات" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={categoryHref(category.slug, page - 1)} rel="prev" className={buttonClasses({ variant: "outline", size: "sm" })}>
              السابق
            </Link>
          ) : (
            <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>السابق</span>
          )}
          <span className="text-ink-secondary" dir="ltr">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={categoryHref(category.slug, page + 1)} rel="next" className={buttonClasses({ variant: "outline", size: "sm" })}>
              التالي
            </Link>
          ) : (
            <span className={buttonClasses({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>التالي</span>
          )}
        </nav>
      )}
    </div>
  );
}
