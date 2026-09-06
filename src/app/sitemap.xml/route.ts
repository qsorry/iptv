import { headers } from "next/headers";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";
import { listPublishedPosts, listFooterPages } from "@/modules/content";

/** sitemap لكل متجر حسب مضيفه. يشمل الرئيسية وصفحات المنتجات المنشورة. */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const origin = `${scheme}://${host}`;

  const store = await getStorefrontStore();
  const urls: string[] = [`${origin}/`];
  if (store) {
    const products = await productRepository.listPublic(store.id);
    for (const p of products) urls.push(`${origin}/products/${encodeURIComponent(p.slug)}`);
    urls.push(`${origin}/blog`);
    for (const post of await listPublishedPosts(store.id)) urls.push(`${origin}/blog/${encodeURIComponent(post.slug)}`);
    for (const pg of await listFooterPages(store.id)) urls.push(`${origin}/pages/${encodeURIComponent(pg.slug)}`);
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
