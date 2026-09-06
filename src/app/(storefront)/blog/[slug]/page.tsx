import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { getPublicPost } from "@/modules/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const store = await getStorefrontStore();
  const { slug } = await params;
  if (!store) return { title: "مقال" };
  const post = await getPublicPost(store.id, decodeURIComponent(slug));
  if (!post) return { title: "مقال غير موجود" };
  return {
    title: `${post.title} — ${store.name}`,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, images: post.coverImage ? [post.coverImage] : undefined, type: "article" },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const store = await getStorefrontStore();
  if (!store) notFound();
  const { slug } = await params;
  const post = await getPublicPost(store.id, decodeURIComponent(slug));
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
    image: post.coverImage ? [post.coverImage] : undefined, datePublished: post.publishedAt?.toISOString(),
  };
  return (
    <article className="mx-auto max-w-2xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt={post.title} className="mb-4 w-full rounded-[var(--radius)] object-cover" />
      )}
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{post.title}</h1>
      {post.body && <div className="prose max-w-none text-sm leading-7" dangerouslySetInnerHTML={{ __html: post.body }} />}
    </article>
  );
}
