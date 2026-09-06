import type { Metadata } from "next";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  if (!store) return { title: "متجر غير متوفر" };
  const title = store.name;
  const description = `تسوّق من ${store.name}`;
  return {
    title,
    description,
    openGraph: { title, description, images: store.logoUrl ? [store.logoUrl] : undefined, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function StorefrontHome() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر على هذا العنوان" />;
  const items = await productRepository.listPublic(store.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{store.name}</h1>
      {items.length === 0 ? (
        <EmptyState title="لا توجد منتجات بعد" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`}>
              <Card className="h-full transition hover:border-[var(--brand)]">
                <div className="font-medium">{p.name}</div>
                {p.shortDescription && <div className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{p.shortDescription}</div>}
                <div className="mt-2 font-semibold text-[var(--brand)]" dir="ltr">{formatMoney(toMinor(p.price), store.currencyCode)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
