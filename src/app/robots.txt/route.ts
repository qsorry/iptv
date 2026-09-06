import { headers } from "next/headers";

/** robots لكل مضيف، يشير إلى sitemap على نفس النطاق. */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const body = `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /checkout\nDisallow: /orders/\nSitemap: ${scheme}://${host}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
