import { and, eq, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { merchantSyncState } from "@/infrastructure/database/schema";
import { contentApiClient } from "../infrastructure/content-api";
import { googleProductId, offerIdFor } from "../domain/product-payload";
import { listCatalogRows } from "./catalog-rows";
import { merchantConfig, type MerchantConfig } from "./merchant-sync";

/**
 * منتجات Merchant Center تنتهي صلاحيتها بعد ٣٠ يوماً من آخر رفع.
 * نعيد رفع ما مضى عليه ٢٥ يوماً — هامش خمسة أيام يكفي لعدة دورات فاشلة.
 */
const EXPIRY_REFRESH_DAYS = 25;
const DELETE_CHUNK = 500;

export interface ReconcileResult {
  expiring: number;
  missingAtGoogle: number;
  orphansDeleted: number;
  disapproved: number;
}

/** يُعيد رفع ما اقترب من الانتهاء. تفريغ البصمة يجبر العامل على الإرسال فعلاً. */
async function refreshExpiring(storeId: string): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRY_REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .update(merchantSyncState)
    .set({ status: "pending", payloadHash: null, attempts: 0, nextAttemptAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(merchantSyncState.storeId, storeId),
        eq(merchantSyncState.status, "synced"),
        isNotNull(merchantSyncState.lastSyncedAt),
        lt(merchantSyncState.lastSyncedAt, cutoff),
      ),
    )
    .returning({ id: merchantSyncState.id });
  return rows.length;
}

/** كل ما هو منشور محلياً ويجب أن يكون عند جوجل. */
async function desiredIds(storeId: string, config: MerchantConfig): Promise<Map<string, string>> {
  const rows = await listCatalogRows(storeId);
  return new Map(rows.map((row) => [googleProductId(offerIdFor(row), config.target), row.productId]));
}

/**
 * المطابقة الليلية: تلتقط ما ضاع بسبب فشل شبكة أو حدث سقط من الطابور،
 * وتحذف ما بقي معروضاً عند جوجل بلا مقابل محلي، وتجلب أسباب الرفض.
 */
export async function reconcileMerchant(storeId: string): Promise<ReconcileResult | null> {
  const config = await merchantConfig(storeId);
  if (!config) return null;

  const client = contentApiClient(config.serviceAccountJson, config.merchantId);
  const expiring = await refreshExpiring(storeId);

  const [remoteIds, desired] = await Promise.all([client.listProductIds(), desiredIds(storeId, config)]);
  const remote = new Set(remoteIds);

  // موجود محلياً ومفقود عند جوجل ← أعِد الرفع.
  const missing = [...desired.entries()].filter(([googleId]) => !remote.has(googleId));
  if (missing.length > 0) {
    await db
      .update(merchantSyncState)
      .set({ status: "pending", payloadHash: null, attempts: 0, nextAttemptAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(merchantSyncState.storeId, storeId),
          inArray(merchantSyncState.productId, missing.map(([, productId]) => productId)),
        ),
      );
  }

  // موجود عند جوجل بلا مقابل محلي ← حذف مباشر: لا صف محلياً يمرّ عبر الطابور.
  const orphans = remoteIds.filter((id) => !desired.has(id));
  let orphansDeleted = 0;
  for (let i = 0; i < orphans.length; i += DELETE_CHUNK) {
    const chunk = orphans.slice(i, i + DELETE_CHUNK);
    const results = await client.batch(chunk.map((productId, index) => ({ batchId: index + 1, method: "delete" as const, productId })));
    orphansDeleted += results.filter((r) => r.ok).length;
  }
  if (orphans.length > 0) {
    await db
      .update(merchantSyncState)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(and(eq(merchantSyncState.storeId, storeId), inArray(merchantSyncState.googleId, orphans)));
  }

  const disapproved = await syncStatuses(storeId, client);
  return { expiring, missingAtGoogle: missing.length, orphansDeleted, disapproved };
}

/** أسباب الرفض من جوجل تُكتب على الصف فيراها التاجر في لوحة التحكم. */
async function syncStatuses(storeId: string, client: ReturnType<typeof contentApiClient>): Promise<number> {
  const statuses = await client.listProductStatuses();
  let disapproved = 0;

  for (const status of statuses) {
    const blocking = (status.itemLevelIssues ?? []).filter((i) => i.servability === "disapproved");
    const issues = blocking.map((i) => ({ code: i.code, description: i.description, detail: i.detail }));
    if (blocking.length === 0) continue;
    disapproved++;
    await db
      .update(merchantSyncState)
      .set({ status: "disapproved", issues, updatedAt: new Date() })
      .where(and(eq(merchantSyncState.storeId, storeId), eq(merchantSyncState.googleId, status.productId)));
  }

  // ما لم يعد مرفوضاً تُمسح مشاكله حتى لا تبقى معروضة بعد إصلاحها.
  const stillDisapproved = statuses
    .filter((s) => (s.itemLevelIssues ?? []).some((i) => i.servability === "disapproved"))
    .map((s) => s.productId);
  await db
    .update(merchantSyncState)
    .set({ status: "synced", issues: null, updatedAt: new Date() })
    .where(
      and(
        eq(merchantSyncState.storeId, storeId),
        eq(merchantSyncState.status, "disapproved"),
        stillDisapproved.length > 0 ? notInArray(merchantSyncState.googleId, stillDisapproved) : sql`true`,
      ),
    );

  return disapproved;
}

/** يشغّل المطابقة لكل متجر لديه صفوف مزامنة. */
export async function reconcileAllStores() {
  const rows = await db.selectDistinct({ storeId: merchantSyncState.storeId }).from(merchantSyncState);
  const results: { storeId: string; result: ReconcileResult | null }[] = [];
  for (const { storeId } of rows) {
    try {
      results.push({ storeId, result: await reconcileMerchant(storeId) });
    } catch (e) {
      results.push({ storeId, result: null });
      console.error(`reconcileMerchant failed for ${storeId}:`, e instanceof Error ? e.message : e);
    }
  }
  return results;
}
