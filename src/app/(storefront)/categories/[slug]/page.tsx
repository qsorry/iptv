import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { categoryProducts } from "@/modules/catalog";
import { ProductGrid } from "@/components/commerce/product-grid";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  if (!store) return { title: "تصنيف" };
  const data = await categoryProducts(store.id, decodeURIComponent(slug));
  if (!data) return { title: "تصنيف غير موجود" };
  return { title: `${data.category.name} — ${store.name}`, description: `منتجات ${data.category.name}` };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const { slug } = await params;
  const data = await categoryProducts(store.id, decodeURIComponent(slug));
  if (!data) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{data.category.name}</h1>
      {data.products.length === 0 ? (
        <EmptyState title="لا توجد منتجات في هذا التصنيف" />
      ) : (
        <ProductGrid items={data.products} currency={store.currencyCode} />
      )}
    </div>
  );
}
