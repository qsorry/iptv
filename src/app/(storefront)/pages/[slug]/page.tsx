import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { getPublicPage, readLanding } from "@/modules/content";
import { productRepository } from "@/modules/catalog";
import { canonicalOrigin } from "@/modules/stores";
import { headers } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  if (!store) return { title: "صفحة" };
  const page = await getPublicPage(store.id, decodeURIComponent(slug));
  if (!page) return { title: "صفحة غير موجودة" };
  return {
    // القالب في الـ layout يضيف اسم المتجر؛ تكراره هنا يعطي «العنوان — المتجر — المتجر».
    title: page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/pages/${encodeURIComponent(page.slug)}` },
    openGraph: { title: page.title, description: page.seoDescription ?? undefined, type: "article" },
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getStorefrontStore();
  if (!store) notFound();
  const { slug } = await params;
  const page = await getPublicPage(store.id, decodeURIComponent(slug));
  if (!page) notFound();

  // قالب صفحة الهبوط: أقسام مهيكلة وبيانات Schema، لا نصّ حرّ.
  if (page.template === "landing") {
    const content = readLanding(page.landing);
    const packages = await productRepository.listPublicByIds(store.id, content.packages.productIds);
    const host = (await headers()).get("host");
    const origin = (await canonicalOrigin(store.id, host)) ?? "";
    return <LandingPage content={content} packages={packages} currency={store.currencyCode} origin={origin} title={page.title} />;
  }

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{page.title}</h1>
      {page.body && <div className="prose max-w-none text-sm leading-7" dangerouslySetInnerHTML={{ __html: page.body }} />}
    </article>
  );
}
