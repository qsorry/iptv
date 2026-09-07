import { headers } from "next/headers";
import { getStorefrontStore } from "@/core/tenancy/server";
import { productFeedItems, productFeedXml } from "@/modules/feeds";

/** خلاصة Merchant Center لكل متجر حسب مضيفه. تُبنى مع المتجر لا بعده. */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const origin = `${scheme}://${host}`;

  const store = await getStorefrontStore();
  if (!store) return new Response("not found", { status: 404 });

  const items = await productFeedItems(store.id, origin, store.name, store.currencyCode);
  return new Response(productFeedXml(store.name, origin, items), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}
