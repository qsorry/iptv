import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository, categoryById } from "@/modules/catalog";
import { inventoryRepository } from "@/modules/inventory";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TrackOnView } from "@/components/tracking/track-on-view";
import { Breadcrumbs, type Crumb } from "@/components/commerce/breadcrumbs";
import { RatingStars } from "@/components/commerce/rating-stars";
import { productReviews, submitReview } from "@/modules/reviews";
import { AppError } from "@/core/errors";
import { addToCart } from "@/modules/carts";
import { readCartId, writeCartId } from "@/core/tenancy/cart-cookie";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { BuyBox } from "@/components/storefront/buy-box";
import { ProductTabs } from "@/components/storefront/product-tabs";
import { ReviewForm } from "@/components/storefront/review-form";
import { ProductGrid } from "@/components/storefront/product-grid";

async function load(slug: string) {
  const store = await getStorefrontStore();
  if (!store) return null;
  const product = await productRepository.findBySlug(store.id, decodeURIComponent(slug));
  if (!product || product.status !== "active") return null;
  const full = await productRepository.findByIdWithVariants(store.id, product.id);
  const media = await productRepository.listMedia(product.id);
  const related = await productRepository.listRelated(store.id, product.id, product.categoryId, 4);
  const category = product.categoryId ? await categoryById(store.id, product.categoryId) : null;
  return { store, product: full!, media, related, category };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "منتج غير متوفر" };
  const { store, product, media } = data;
  const title = product.seoTitle ?? product.name;
  const description =
    (product.seoDescription ?? product.shortDescription ?? product.description ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || product.name;
  const images = media.filter((m) => m.type === "image").map((m) => m.url);
  return {
    title,
    description,
    alternates: { canonical: `/products/${encodeURIComponent(product.slug)}` },
    openGraph: {
      title,
      description,
      images: images.length ? images : store.logoUrl ? [store.logoUrl] : undefined,
      type: "website",
      siteName: store.name,
    },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description },
  };
}

const trustFor = (digital: boolean) => [
  digital
    ? { icon: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z", title: "تسليم فوري", sub: "الكود يصلك مباشرة بعد الدفع" }
    : { icon: "M3 7h13v8H3zM16 10h3l2 3v2h-5M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", title: "شحن سريع", sub: "نوصّل طلبك إلى عنوانك" },
  { icon: "M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Zm0 6 3 3-4 4-2-2", title: "دفع آمن", sub: "بوابات دفع موثوقة ومشفّرة" },
  { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z", title: "دعم متواصل", sub: "فريقنا جاهز لمساعدتك" },
];

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviewed?: string; review_error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  const { store, product, media, related, category } = data;
  const variant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  // التوفر الحقيقي: الرقمي/الخدمي متاح دائماً؛ المادي حسب المخزون (null = لا يتتبّع المخزون).
  const sellable = variant ? await inventoryRepository.sellableForVariant(variant.id) : null;
  const inStock = product.productType !== "physical" || sellable === null || sellable > 0;
  const crumbs: Crumb[] = [
    { name: "الرئيسية", href: "/" },
    ...(category ? [{ name: category.name, href: `/categories/${encodeURIComponent(category.slug)}` }] : []),
    { name: product.name },
  ];
  const images = media.filter((m) => m.type === "image").map((m) => ({ url: m.url, altText: m.altText }));
  const { rows: reviewRows, count: reviewCount, average, breakdown } = await productReviews(product.id);
  const isDigital = product.productType === "digital";

  async function addReview(formData: FormData) {
    "use server";
    const target = `/products/${encodeURIComponent(product!.slug)}`;
    let err: string | null = null;
    try {
      const s = await getStorefrontStore();
      if (!s) throw new AppError("تعذّر تحديد المتجر", "NO_STORE", 400);
      await submitReview(s.id, {
        productId: product!.id,
        rating: Number(formData.get("rating")) || 5,
        authorName: String(formData.get("authorName") || "") || undefined,
        email: String(formData.get("email") || "") || undefined,
        body: String(formData.get("body") || "") || undefined,
      });
    } catch (e) {
      err = e instanceof AppError ? e.message : "تعذّر إرسال التقييم، حاول مرة أخرى";
    }
    revalidatePath(target);
    redirect(err ? `${target}?review_error=${encodeURIComponent(err)}` : `${target}?reviewed=1`);
  }

  async function addToCartAction(formData: FormData) {
    "use server";
    const s = await getStorefrontStore();
    if (!s || !variant) return;
    const chosen = String(formData.get("variantId") || variant.id);
    const qty = Math.max(1, Math.min(99, Number(formData.get("quantity")) || 1));
    const current = await readCartId(s.id);
    const cartId = await addToCart(s.id, current, chosen, qty);
    await writeCartId(s.id, cartId);
    redirect("/cart");
  }

  const metaDesc = (product.seoDescription ?? product.shortDescription ?? product.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: metaDesc,
    image: images.map((m) => m.url),
    sku: variant?.sku ?? undefined,
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      price: variant?.price,
      priceCurrency: store.currencyCode,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(reviewCount > 0
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: average, reviewCount, bestRating: 5, worstRating: 1 },
          review: reviewRows.slice(0, 5).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            author: { "@type": "Person", name: r.authorName ?? "زائر" },
            ...(r.body ? { reviewBody: r.body } : {}),
          })),
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-5xl pb-24 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackOnView
        event="view_item"
        data={{
          currency: store.currencyCode,
          value: variant ? Number(variant.price) : undefined,
          items: [{ id: variant?.sku ?? variant?.id ?? product.id, name: product.name, qty: 1, price: variant ? Number(variant.price) : 0 }],
        }}
      />

      {sp.reviewed && <Alert variant="success" className="mb-4">شكراً لك! تم استلام تقييمك وسيظهر بعد مراجعته من المتجر.</Alert>}
      {sp.review_error && <Alert variant="error" className="mb-4">{sp.review_error}</Alert>}

      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} alt={product.name} />

        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{product.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {reviewCount > 0 && (
              <a href="#reviews" className="flex items-center gap-2">
                <RatingStars value={average} />
                <span className="text-ink-secondary" dir="ltr">{average} ({reviewCount} تقييم)</span>
              </a>
            )}
            {inStock ? <Badge variant="success">متوفر</Badge> : <Badge variant="error">غير متوفر حالياً</Badge>}
          </div>

          {product.shortDescription && <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{product.shortDescription}</p>}

          <div className="mt-6">
            <BuyBox
              variants={product.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, compareAtPrice: v.compareAtPrice, sku: v.sku }))}
              productName={product.name}
              currency={store.currencyCode}
              action={addToCartAction}
              digital={isDigital}
            />
          </div>

          {/* شارات الثقة */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {trustFor(isDigital).map((t) => (
              <div key={t.title} className="flex items-start gap-2 rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                <div>
                  <div className="text-xs font-semibold">{t.title}</div>
                  <div className="text-[11px] leading-tight text-ink-secondary">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <section className="mt-12">
        <ProductTabs
          reviewCount={reviewCount}
          description={
            product.description ? (
              <div className="prose max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : null
          }
          reviews={
            <div id="reviews" className="grid gap-6 md:grid-cols-[280px_1fr]">
              {/* ملخص + نموذج */}
              <div className="space-y-4">
                <Card className="text-center">
                  <div className="text-4xl font-bold" dir="ltr">{average || "—"}</div>
                  <RatingStars value={average} className="mt-1 text-lg" />
                  <div className="mt-1 text-xs text-ink-secondary">{reviewCount} تقييم</div>
                  <div className="mt-4 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const c = breakdown[n as 1 | 2 | 3 | 4 | 5];
                      const pct = reviewCount ? Math.round((c / reviewCount) * 100) : 0;
                      return (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="w-3 text-ink-secondary" dir="ltr">{n}</span>
                          <span className="text-[var(--rating-color)]" aria-hidden="true">★</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                            <span className="block h-full rounded-full bg-[var(--rating-color)]" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="w-6 text-left text-ink-secondary" dir="ltr">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
                <ReviewForm action={addReview} />
              </div>

              {/* قائمة التقييمات */}
              <div className="space-y-3">
                {reviewRows.length === 0 ? (
                  <p className="text-sm text-ink-secondary">لا توجد تقييمات بعد. كن أول من يقيّم هذا المنتج.</p>
                ) : (
                  reviewRows.map((r) => (
                    <Card key={r.id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{r.authorName ?? "زائر"}</span>
                          {r.verified && <Badge variant="success">شراء موثّق</Badge>}
                        </div>
                        <RatingStars value={r.rating} className="text-sm" />
                      </div>
                      {r.title && <div className="text-sm font-medium">{r.title}</div>}
                      {r.body && <p className="text-sm leading-relaxed text-ink-secondary">{r.body}</p>}
                    </Card>
                  ))
                )}
              </div>
            </div>
          }
        />
      </section>

      {/* منتجات ذات صلة */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">منتجات ذات صلة</h2>
          <ProductGrid items={related} currency={store.currencyCode} />
        </section>
      )}
    </div>
  );
}
