import { and, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { storeDomains, stores } from "@/infrastructure/database/schema";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

const scheme = () => (PLATFORM_DOMAIN.includes("localhost") ? "http" : "https");

/** الدومين المخصّص الرئيسي للمتجر إن وُجد. */
export async function primaryDomain(storeId: string, executor: DbExecutor = db): Promise<string | null> {
  const [row] = await executor
    .select({ domain: storeDomains.domain })
    .from(storeDomains)
    .where(and(eq(storeDomains.storeId, storeId), eq(storeDomains.isPrimary, true)))
    .limit(1);
  return row?.domain ?? null;
}

/**
 * العنوان المعياري للمتجر كما يجب أن يظهر في canonical وog:url والخلاصات.
 * متجر واحد قد يُخدَم من أكثر من مضيف (نطاق فرعي + دومين مخصّص + جذر المنصة)،
 * وترك canonical يتبع مضيف الطلب يجعل جوجل يرى ثلاث نسخ من كل صفحة.
 *
 * الدومين المخصّص الرئيسي يحسم؛ وبدونه نُبقي مضيف الطلب لأنه المضيف الذي
 * وصل منه الزائر فعلاً — تخمين نطاق فرعي قد لا يكون مُعرَّفاً في DNS
 * يعني canonical إلى عنوان ميت، وهو أسوأ من التكرار.
 */
export async function canonicalOrigin(storeId: string, requestHost: string | null, executor: DbExecutor = db): Promise<string | null> {
  const domain = await primaryDomain(storeId, executor);
  if (domain) return `${scheme()}://${domain}`;
  if (requestHost) return `${requestHost.includes("localhost") ? "http" : "https"}://${requestHost}`;
  return null;
}

/**
 * العنوان بلا سياق طلب — للعمّال الخلفية (مزامنة Merchant Center مثلاً).
 * الترتيب نفسه في `getStorefrontStore`: دومين مخصّص، ثم جذر المنصة للمتجر
 * الافتراضي أو الوحيد، ثم النطاق الفرعي.
 */
export async function storeOrigin(storeId: string, executor: DbExecutor = db): Promise<string | null> {
  const [store] = await executor.select({ slug: stores.slug }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;

  const domain = await primaryDomain(storeId, executor);
  if (domain) return `${scheme()}://${domain}`;

  if (process.env.DEFAULT_STORE_SLUG === store.slug) return `${scheme()}://${PLATFORM_DOMAIN}`;
  const activeStores = await executor.select({ id: stores.id }).from(stores).where(eq(stores.status, "active")).limit(2);
  if (activeStores.length === 1 && activeStores[0].id === storeId) return `${scheme()}://${PLATFORM_DOMAIN}`;

  return `${scheme()}://${store.slug}.${PLATFORM_DOMAIN}`;
}
