import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { categoryProducts } from "@/modules/catalog";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.products.map((p) => (
            <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`}>
              <Card className="h-full shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="font-medium">{p.name}</div>
                <div className="mt-2 font-semibold text-[var(--brand)]" dir="ltr">{formatMoney(toMinor(p.price), store.currencyCode)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
