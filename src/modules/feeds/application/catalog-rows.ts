import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { products, productVariants, storeDomains, stores } from "@/infrastructure/database/schema";
import type { CatalogRow } from "../domain/product-payload";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

const columns = {
  productId: products.id,
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
};

/**
 * صفوف الكتالوج المنشور — مصدر واحد لخلاصة XML ولحمولة Merchant Center،
 * حتى لا تختلف قيمة السعر أو التوفّر بين القناتين.
 */
export async function listCatalogRows(storeId: string, executor: DbExecutor = db): Promise<CatalogRow[]> {
  const rows = await executor
    .select(columns)
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.publishedAt));
  return rows as CatalogRow[];
}

/** نفس الأعمدة لمنتجات محدّدة — يستخدمها عامل المزامنة بعد حجز صفوفه. */
export async function catalogRowsByIds(storeId: string, productIds: string[], executor: DbExecutor = db): Promise<CatalogRow[]> {
  if (productIds.length === 0) return [];
  const rows = await executor
    .select(columns)
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .where(
      and(
        eq(products.storeId, storeId),
        inArray(products.id, productIds),
        eq(products.status, "active"),
        isNull(products.deletedAt),
      ),
    );
  return rows as CatalogRow[];
}

/**
 * عنوان المتجر كما يراه الزائر. العامل يعمل بلا طلب HTTP فلا يمكنه قراءة Host،
 * فنكرّر هنا نفس ترتيب الحسم في `getStorefrontStore`:
 *   دومين مخصّص رئيسي ← نطاق المنصة نفسه للمتجر الافتراضي أو الوحيد ← نطاق فرعي.
 * الخطأ هنا يعني روابط منتجات لا تعمل، وجوجل يرفض الكتالوج كله عليها.
 */
export async function storeOrigin(storeId: string, executor: DbExecutor = db): Promise<string | null> {
  const [store] = await executor.select({ slug: stores.slug }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;
  const scheme = PLATFORM_DOMAIN.includes("localhost") ? "http" : "https";

  const [custom] = await executor
    .select({ domain: storeDomains.domain })
    .from(storeDomains)
    .where(and(eq(storeDomains.storeId, storeId), eq(storeDomains.isPrimary, true)))
    .limit(1);
  if (custom) return `${scheme}://${custom.domain}`;

  // نشر أحادي المتجر: المتجر يُخدَم على جذر نطاق المنصة لا على نطاق فرعي.
  if (process.env.DEFAULT_STORE_SLUG === store.slug) return `${scheme}://${PLATFORM_DOMAIN}`;
  const activeStores = await executor.select({ id: stores.id }).from(stores).where(eq(stores.status, "active")).limit(2);
  if (activeStores.length === 1 && activeStores[0].id === storeId) return `${scheme}://${PLATFORM_DOMAIN}`;

  return `${scheme}://${store.slug}.${PLATFORM_DOMAIN}`;
}
