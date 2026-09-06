import type { Metadata } from "next";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";

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
  const settings = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, store.id) });
  const layout = ((settings?.settings as Record<string, unknown> | undefined)?.productLayout as string | undefined) ?? "grid";
  const gridClass =
    layout === "list"
      ? "grid grid-cols-1 gap-3"
      : layout === "compact"
        ? "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
        : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{store.name}</h1>
      {items.length === 0 ? (
        <EmptyState title="لا توجد منتجات بعد" />
      ) : (
        <div className={gridClass}>
          {items.map((p) => (
            <Link key={p.id} href={`/products/${encodeURIComponent(p.slug)}`}>
              <Card className={`h-full overflow-hidden p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${layout === "list" ? "flex items-center gap-3" : ""}`}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className={layout === "list" ? "h-24 w-24 shrink-0 object-cover" : "aspect-square w-full object-cover"} />
                ) : (
                  <div className={`flex items-center justify-center bg-black/5 text-xs text-[var(--muted)] ${layout === "list" ? "h-24 w-24 shrink-0" : "aspect-square w-full"}`}>لا صورة</div>
                )}
                <div className={layout === "compact" ? "p-2" : "p-3"}>
                <div className={layout === "compact" ? "line-clamp-1 text-sm font-medium" : "font-medium"}>{p.name}</div>
                {p.shortDescription && <div className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{p.shortDescription}</div>}
                <div className="mt-2 font-semibold text-[var(--brand)]" dir="ltr">{formatMoney(toMinor(p.price), store.currencyCode)}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
