import { headers } from "next/headers";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { listPublishedPosts, listFooterPages } from "@/modules/content";

interface SitemapUrl {
  loc: string;
  lastmod?: Date | null;
}

/** تاريخ W3C (YYYY-MM-DD) — الدقة اليومية كافية لـ lastmod وتتفادى تقلّب الملف كل طلب. */
const w3cDate = (d: Date) => d.toISOString().slice(0, 10);

const newest = (dates: (Date | null | undefined)[]): Date | undefined => {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length > 0 ? new Date(Math.max(...valid.map((d) => d.getTime()))) : undefined;
};

/**
 * sitemap لكل متجر حسب مضيفه. يشمل الرئيسية وصفحات المنتجات المنشورة.
 * `lastmod` يُشتق من آخر تعديل فعلي على الصف — لا قيمة ثابتة ولا `now()`،
 * وإلا فقد الوسم معناه وتجاهله الزاحف.
 */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const origin = `${scheme}://${host}`;

  const store = await getStorefrontStore();
  const urls: SitemapUrl[] = [];

  if (store) {
    const [products, posts, pages] = await Promise.all([
      productRepository.listSitemapEntries(store.id),
      listPublishedPosts(store.id),
      listFooterPages(store.id),
    ]);

    // الرئيسية تتغيّر مع أي منتج جديد أو معدّل.
    urls.push({ loc: `${origin}/`, lastmod: newest(products.map((p) => p.updatedAt)) });
    for (const p of products) urls.push({ loc: `${origin}/products/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt });
    urls.push({ loc: `${origin}/blog`, lastmod: newest(posts.map((p) => p.updatedAt)) });
    for (const post of posts) urls.push({ loc: `${origin}/blog/${encodeURIComponent(post.slug)}`, lastmod: post.updatedAt });
    for (const pg of pages) urls.push({ loc: `${origin}/pages/${encodeURIComponent(pg.slug)}`, lastmod: pg.updatedAt });
  } else {
    urls.push({ loc: `${origin}/` });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${w3cDate(u.lastmod)}</lastmod>` : ""}</url>`)
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
