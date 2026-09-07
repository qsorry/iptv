import { db, type DbExecutor } from "@/infrastructure/database/client";
import { buildMerchantProduct } from "../domain/product-payload";
import { toFeedItem, type FeedItem } from "../domain/feed-xml";
import { listCatalogRows } from "./catalog-rows";

/**
 * المنتجات المنشورة بصيغة خلاصة.
 * Merchant Center يُغذّى بالـ Content API لا بهذه الخلاصة (خلطهما يجعلهما تتنازعان)؛
 * هذه لكتالوجات Meta وTikTok وSnap التي تقبل السحب المجدول.
 */
export async function productFeedItems(
  storeId: string,
  origin: string,
  brand: string,
  currency: string,
  executor: DbExecutor = db,
): Promise<FeedItem[]> {
  const rows = await listCatalogRows(storeId, executor);
  return rows.map((row) => toFeedItem(buildMerchantProduct(row, { origin, brand, currency })));
}
