import { headers } from "next/headers";
import { getStorefrontStore } from "@/core/tenancy/server";
import { canonicalOrigin } from "@/modules/stores";

/** robots لكل مضيف، يشير إلى sitemap على نفس النطاق. */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const scheme = host.includes("localhost") ? "http" : "https";
  const store = await getStorefrontStore();
  const origin = (store ? await canonicalOrigin(store.id, host) : null) ?? `${scheme}://${host}`;
  // صفحات لا قيمة لها في الفهرس ولا يجب أن تُهدر ميزانية الزحف:
  // حساب العميل وسلته وطلباته، والبحث الداخلي الذي يولّد روابط لا نهائية.
  const disallow = ["/account", "/cart", "/checkout", "/orders/", "/search", "/auth", "/admin"];
  const body =
    `User-agent: *\nAllow: /\n` +
    disallow.map((path) => `Disallow: ${path}\n`).join("") +
    `Sitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
