import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { getPublicPage } from "@/modules/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  if (!store) return { title: "صفحة" };
  const page = await getPublicPage(store.id, decodeURIComponent(slug));
  if (!page) return { title: "صفحة غير موجودة" };
  return { title: `${page.title} — ${store.name}`, description: page.seoDescription ?? undefined };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getStorefrontStore();
  if (!store) notFound();
  const { slug } = await params;
  const page = await getPublicPage(store.id, decodeURIComponent(slug));
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{page.title}</h1>
      {page.body && <div className="prose max-w-none text-sm leading-7" dangerouslySetInnerHTML={{ __html: page.body }} />}
    </article>
  );
}
