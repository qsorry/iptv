import type { MerchantProduct } from "./product-payload";

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  imageLink: string | null;
  price: string;
  salePrice: string | null;
  availability: "in_stock" | "out_of_stock";
  brand: string;
  condition: "new";
}

const priceText = (p: { value: string; currency: string }) => `${p.value} ${p.currency}`;

/** يحوّل حمولة Merchant Center إلى عنصر خلاصة — نفس المصدر، صيغتان لا تتباعدان. */
export function toFeedItem(product: MerchantProduct): FeedItem {
  return {
    id: product.offerId,
    title: product.title,
    description: product.description,
    link: product.link,
    imageLink: product.imageLink ?? null,
    price: priceText(product.price),
    salePrice: product.salePrice ? priceText(product.salePrice) : null,
    availability: product.availability === "in stock" ? "in_stock" : "out_of_stock",
    brand: product.brand,
    condition: "new",
  };
}

const escapeXml = (v: string) => v.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** خلاصة RSS 2.0 بمساحة أسماء Google — الصيغة التي تقبلها المنصات مباشرة. */
export function productFeedXml(storeName: string, storeUrl: string, items: FeedItem[]): string {
  const entries = items
    .map((i) =>
      [
        "    <item>",
        `      <g:id>${escapeXml(i.id)}</g:id>`,
        `      <g:title>${escapeXml(i.title)}</g:title>`,
        `      <g:description>${escapeXml(i.description)}</g:description>`,
        `      <g:link>${escapeXml(i.link)}</g:link>`,
        i.imageLink ? `      <g:image_link>${escapeXml(i.imageLink)}</g:image_link>` : "",
        `      <g:availability>${i.availability}</g:availability>`,
        `      <g:condition>${i.condition}</g:condition>`,
        `      <g:price>${escapeXml(i.price)}</g:price>`,
        i.salePrice ? `      <g:sale_price>${escapeXml(i.salePrice)}</g:sale_price>` : "",
        `      <g:brand>${escapeXml(i.brand)}</g:brand>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(storeName)}</title>\n` +
    `    <link>${escapeXml(storeUrl)}</link>\n` +
    `    <description>${escapeXml(`خلاصة منتجات ${storeName}`)}</description>\n` +
    `${entries}\n` +
    `  </channel>\n</rss>\n`
  );
}
