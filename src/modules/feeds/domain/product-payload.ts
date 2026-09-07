import { createHash } from "node:crypto";

/** إعدادات الوجهة عند جوجل. تتغيّر معها معرّفات المنتجات، فلا تُعدَّل بعد أول رفع. */
export interface MerchantTarget {
  channel: "online";
  contentLanguage: string;
  targetCountry: string;
}

export const DEFAULT_TARGET: MerchantTarget = { channel: "online", contentLanguage: "ar", targetCountry: "SA" };

/** الصف كما يخرج من قاعدة البيانات قبل التحويل. */
export interface CatalogRow {
  productId: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  productType: "physical" | "digital" | "service";
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  image: string | null;
  extraImages?: string[];
  onHand: number;
}

/** مورد المنتج بصيغة Content API. */
export interface MerchantProduct {
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink?: string;
  additionalImageLinks?: string[];
  contentLanguage: string;
  targetCountry: string;
  channel: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: { value: string; currency: string };
  salePrice?: { value: string; currency: string };
  brand: string;
  identifierExists: boolean;
  mpn?: string;
}

/**
 * المعرّف المركّب: channel:contentLanguage:targetCountry:offerId.
 * جوجل يعامله كمفتاح أساسي — تغييره يعني منتجاً جديداً وفقدان تاريخ الأداء.
 */
export function googleProductId(offerId: string, target: MerchantTarget = DEFAULT_TARGET): string {
  return `${target.channel}:${target.contentLanguage}:${target.targetCountry}:${offerId}`;
}

/** معرّف العرض: الـ SKU إن وُجد (يقرأه بشر في تقارير جوجل)، وإلا معرّف المنتج. */
export function offerIdFor(row: Pick<CatalogRow, "sku" | "productId">): string {
  return (row.sku ?? row.productId).trim();
}

const absolute = (url: string | null, origin: string): string | undefined => {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

const money = (value: string, currency: string) => ({ value: Number(value).toFixed(2), currency });

/**
 * يبني منتج جوجل من صف الكتالوج.
 * السعر هنا يجب أن يطابق صفحة المنتج بالضبط — جوجل يزحف للصفحة ويقارن،
 * والاختلاف رفضٌ فوري. المصدر واحد (`product_variants.price`) في الحالتين.
 */
export function buildMerchantProduct(
  row: CatalogRow,
  options: { origin: string; brand: string; currency: string; target?: MerchantTarget },
): MerchantProduct {
  const target = options.target ?? DEFAULT_TARGET;
  const offerId = offerIdFor(row);
  const hasSale = row.compareAtPrice != null && Number(row.compareAtPrice) > Number(row.price);
  // الرقمي بلا مخزون: متوفر دائماً. المادي يتبع الكمية الفعلية.
  const inStock = row.productType !== "physical" || row.onHand > 0;

  return {
    offerId,
    title: row.name.slice(0, 150),
    description: (row.shortDescription ?? row.description ?? row.name).slice(0, 5000),
    link: `${options.origin}/products/${encodeURIComponent(row.slug)}`,
    imageLink: absolute(row.image, options.origin),
    additionalImageLinks: row.extraImages?.map((u) => absolute(u, options.origin)!).filter(Boolean).slice(0, 10),
    contentLanguage: target.contentLanguage,
    targetCountry: target.targetCountry,
    channel: target.channel,
    availability: inStock ? "in stock" : "out of stock",
    condition: "new",
    // السعر الأساسي هو compare_at إن وُجد خصم، والسعر الحالي يصبح sale_price.
    price: money(hasSale ? row.compareAtPrice! : row.price, options.currency),
    salePrice: hasSale ? money(row.price, options.currency) : undefined,
    brand: options.brand.slice(0, 70),
    // لا GTIN لمنتجات المتجر الرقمية أو الخاصة؛ التصريح بذلك يمنع رفض «معرّف ناقص».
    identifierExists: false,
    mpn: row.sku ?? undefined,
  };
}

/**
 * بصمة الحمولة: إن لم تتغيّر لا يُرسل شيء.
 * تعديل وصف داخلي أو حقل لا يظهر في الخلاصة لا يستهلك حصة عند جوجل.
 */
export function payloadHash(product: MerchantProduct): string {
  return createHash("sha256").update(JSON.stringify(sortKeys(product))).digest("hex");
}

/** ترتيب المفاتيح يجعل البصمة مستقرة مهما تغيّر ترتيب البناء. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}
