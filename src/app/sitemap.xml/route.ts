import { headers } from "next/headers";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productRepository } from "@/modules/catalog";

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
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
