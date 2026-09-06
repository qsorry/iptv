import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { formatMoney, toMinor } from "@/core/money";
import { Button } from "@/components/ui/button";

async function load(slug: string) {
  const store = await getStorefrontStore();
  if (!store) return null;
  const product = await productRepository.findBySlug(store.id, decodeURIComponent(slug));
  if (!product || product.status !== "active") return null;
  const full = await productRepository.findByIdWithVariants(store.id, product.id);
  const media = await productRepository.listMedia(product.id);
  return { store, product: full!, media };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "منتج غير متوفر" };
  const { store, product, media } = data;
  const title = product.seoTitle ?? product.name;
  const description = (product.seoDescription ?? product.shortDescription ?? "").replace(/<[^>]+>/g, "").slice(0, 160) || product.name;
  const images = media.filter((m) => m.type === "image").map((m) => m.url);
  return {
    title: `${title} — ${store.name}`,
    description,
    openGraph: { title, description, images: images.length ? images : store.logoUrl ? [store.logoUrl] : undefined, type: "website" },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { store, product, media } = data;
  const variant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const images = media.filter((m) => m.type === "image");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: (product.shortDescription ?? "").replace(/<[^>]+>/g, ""),
    image: images.map((m) => m.url),
    offers: {
      "@type": "Offer",
      price: variant?.price,
      priceCurrency: store.currencyCode,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0].url} alt={product.name} className="w-full rounded-[var(--radius)] border border-[var(--border)] object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-[var(--muted)]">لا صورة</div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {variant && <div className="mt-2 text-xl font-semibold text-[var(--brand)]" dir="ltr">{formatMoney(toMinor(variant.price), store.currencyCode)}</div>}
          {product.shortDescription && <p className="mt-3 text-sm text-[var(--muted)]">{product.shortDescription}</p>}
          <div className="mt-6">
            <Button className="w-full sm:w-auto">أضف إلى السلة</Button>
          </div>
          {product.description && (
            <div className="prose mt-6 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: product.description }} />
          )}
        </div>
      </div>
    </div>
  );
}
