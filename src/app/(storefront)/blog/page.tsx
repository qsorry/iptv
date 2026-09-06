import type { Metadata } from "next";
import Link from "next/link";
import { getStorefrontStore } from "@/core/tenancy/server";
import { listPublishedPosts } from "@/modules/content";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStorefrontStore();
  return { title: store ? `المدونة — ${store.name}` : "المدونة" };
}

export default async function BlogIndex() {
  const store = await getStorefrontStore();
  if (!store) return <EmptyState title="لا يوجد متجر" />;
  const posts = await listPublishedPosts(store.id);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">المدونة</h1>
      {posts.length === 0 ? <EmptyState title="لا توجد مقالات بعد" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${encodeURIComponent(p.slug)}`}>
              <Card className="h-full overflow-hidden p-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                {p.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt={p.title} className="aspect-video w-full object-cover" />
                )}
                <div className="p-4">
                  <h2 className="font-semibold">{p.title}</h2>
                  {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{p.excerpt}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
