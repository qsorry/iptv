import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { products, productVariants } from "@/infrastructure/database/schema";

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

/** المنتجات المنشورة بصيغة خلاصة Merchant Center. الرقمي متوفر دائماً (بلا مخزون). */
export async function productFeedItems(
  storeId: string,
  origin: string,
  brand: string,
  currency: string,
  executor: DbExecutor = db,
): Promise<FeedItem[]> {
  const rows = await executor
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      description: products.description,
      productType: products.productType,
      sku: productVariants.sku,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      image: sql<string | null>`(select url from product_media pm where pm.product_id = ${products.id} order by pm.is_primary desc, pm.position asc limit 1)`,
      onHand: sql<number>`coalesce((select sum(il.available_quantity)::int from inventory_levels il where il.variant_id = ${productVariants.id}), 0)`,
    })
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.publishedAt));

  return rows.map((r) => {
    const hasSale = r.compareAtPrice != null && Number(r.compareAtPrice) > Number(r.price);
    return {
      id: r.sku ?? r.id,
      title: r.name,
      description: (r.shortDescription ?? r.description ?? r.name).slice(0, 5000),
      link: `${origin}/products/${encodeURIComponent(r.slug)}`,
      imageLink: r.image ? (r.image.startsWith("http") ? r.image : `${origin}${r.image}`) : null,
      // السعر المعروض في الخلاصة: compare_at كسعر أساسي والسعر الحالي كعرض.
      price: `${Number(hasSale ? r.compareAtPrice : r.price).toFixed(2)} ${currency}`,
      salePrice: hasSale ? `${Number(r.price).toFixed(2)} ${currency}` : null,
      availability: r.productType === "physical" && r.onHand <= 0 ? "out_of_stock" : "in_stock",
      brand,
      condition: "new" as const,
    };
  });
}

const escapeXml = (v: string) => v.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** خلاصة RSS 2.0 بمساحة أسماء Google — الصيغة التي يقبلها Merchant Center مباشرة. */
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
