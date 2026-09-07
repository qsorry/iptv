import { and, desc, eq, inArray, lte, lt, notInArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { merchantSyncState, stores } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";
import { runtimeIntegrations } from "@/modules/tracking";
import { buildMerchantProduct, googleProductId, offerIdFor, payloadHash, DEFAULT_TARGET, type CatalogRow, type MerchantTarget } from "../domain/product-payload";
import { contentApiClient, ContentApiError, type BatchEntry } from "../infrastructure/content-api";
import { storeOrigin } from "@/modules/stores";
import { catalogRowsByIds, listCatalogRows } from "./catalog-rows";

const MAX_ATTEMPTS = 5;
/** حد جوجل ١٠٠٠؛ نبقى عند ٥٠٠ احتياطاً لحجم الجسم. */
const BATCH_SIZE = 500;
const LEASE_MS = 5 * 60 * 1000;

const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** attempts, 60 * 60_000);

export interface MerchantConfig {
  merchantId: string;
  serviceAccountJson: string;
  target: MerchantTarget;
}

/** إعداد Merchant Center للمتجر، أو null إن لم يُفعَّل أو نقصت بياناته. */
export async function merchantConfig(storeId: string, executor: DbExecutor = db): Promise<MerchantConfig | null> {
  const integrations = await runtimeIntegrations(executor, storeId);
  const row = integrations.find((i) => i.platform === "merchant");
  if (!row?.enabled) return null;
  const merchantId = row.config.merchantId;
  const serviceAccountJson = row.secrets.serviceAccountJson;
  if (!merchantId || !serviceAccountJson) return null;
  return {
    merchantId,
    serviceAccountJson,
    target: {
      channel: "online",
      targetCountry: row.config.targetCountry || DEFAULT_TARGET.targetCountry,
      contentLanguage: row.config.contentLanguage || DEFAULT_TARGET.contentLanguage,
    },
  };
}

/** يصفّ منتجاً للمزامنة. يُستدعى من معالج أحداث outbox داخل مسار غير حرج. */
export async function markProductDirty(storeId: string, productId: string, executor: DbExecutor = db) {
  const rows = await catalogRowsByIds(storeId, [productId], executor);
  const row = rows[0];
  if (!row) return markProductRemoved(storeId, productId, executor);

  const target = (await merchantConfig(storeId, executor))?.target ?? DEFAULT_TARGET;
  const offerId = offerIdFor(row);
  await executor
    .insert(merchantSyncState)
    .values({
      storeId,
      productId,
      offerId,
      googleId: googleProductId(offerId, target),
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [merchantSyncState.storeId, merchantSyncState.productId],
      set: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() },
    });
}

/** منتج حُذف أو أُلغي نشره: يُحذف من جوجل، ولا يُترك معلّقاً على سعر لم يعد قائماً. */
export async function markProductRemoved(storeId: string, productId: string, executor: DbExecutor = db) {
  await executor
    .update(merchantSyncState)
    .set({ status: "pending_delete", attempts: 0, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(
      and(
        eq(merchantSyncState.storeId, storeId),
        eq(merchantSyncState.productId, productId),
        notInArray(merchantSyncState.status, ["deleted", "pending_delete"]),
      ),
    );
}

/**
 * الرفع الأولي: يصفّ الكتالوج كاملاً مرة واحدة.
 * لا يرسل بنفسه — يمرّ عبر نفس الطابور والعامل، فيرث التراجع الأُسّي وسجل الأخطاء.
 */
export async function enqueueFullCatalog(ctx: StoreContext): Promise<{ queued: number; removed: number }> {
  requireRole(ctx, "owner", "admin");
  const config = await merchantConfig(ctx.storeId);
  if (!config) throw new ValidationError("فعّل Merchant Center وأكمل بياناته أولاً");

  const rows = await listCatalogRows(ctx.storeId);
  const now = new Date();
  let queued = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(merchantSyncState)
      .values(
        chunk.map((row) => {
          const offerId = offerIdFor(row);
          return {
            storeId: ctx.storeId,
            productId: row.productId,
            offerId,
            googleId: googleProductId(offerId, config.target),
            status: "pending" as const,
            nextAttemptAt: now,
          };
        }),
      )
      .onConflictDoUpdate({
        target: [merchantSyncState.storeId, merchantSyncState.productId],
        // payload_hash يبقى كما هو: منتج لم يتغيّر لن يُرسل مرة أخرى بلا داعٍ.
        set: { status: "pending", attempts: 0, nextAttemptAt: now, lastError: null, updatedAt: now },
      });
    queued += chunk.length;
  }

  // ما لم يعد في الكتالوج يُصفّ للحذف بدل أن يبقى معروضاً في إعلانات جوجل.
  const liveIds = rows.map((r) => r.productId);
  const removed = await db
    .update(merchantSyncState)
    .set({ status: "pending_delete", attempts: 0, nextAttemptAt: now, updatedAt: now })
    .where(
      and(
        eq(merchantSyncState.storeId, ctx.storeId),
        notInArray(merchantSyncState.status, ["deleted", "pending_delete"]),
        liveIds.length > 0 ? notInArray(merchantSyncState.productId, liveIds) : sql`true`,
      ),
    )
    .returning({ id: merchantSyncState.id });

  return { queued, removed: removed.length };
}

type SyncRow = typeof merchantSyncState.$inferSelect;

/** يحجز دفعة من صفوف متجر واحد. لا عاملان على نفس الصف. */
async function claim(storeId: string, limit: number): Promise<SyncRow[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(merchantSyncState)
      .where(
        and(
          eq(merchantSyncState.storeId, storeId),
          inArray(merchantSyncState.status, ["pending", "pending_delete"]),
          lte(merchantSyncState.nextAttemptAt, new Date()),
          lt(merchantSyncState.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(merchantSyncState.nextAttemptAt)
      .limit(limit)
      .for("update", { skipLocked: true });
    if (rows.length === 0) return [];
    await tx
      .update(merchantSyncState)
      .set({ nextAttemptAt: new Date(Date.now() + LEASE_MS) })
      .where(inArray(merchantSyncState.id, rows.map((r) => r.id)));
    return rows;
  });
}

async function markSuccess(row: SyncRow, hash: string | null, deleted: boolean) {
  await db
    .update(merchantSyncState)
    .set({
      status: deleted ? "deleted" : "synced",
      payloadHash: hash,
      lastSyncedAt: new Date(),
      attempts: 0,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(merchantSyncState.id, row.id));
}

async function markFailure(row: SyncRow, error: string, retryable: boolean) {
  const attempts = row.attempts + 1;
  const giveUp = !retryable || attempts >= MAX_ATTEMPTS;
  await db
    .update(merchantSyncState)
    .set({
      // خطأ بيانات (سعر مخالف، حقل ناقص) لا يُصلحه التكرار: يُعرض للتاجر فوراً.
      status: giveUp ? "failed" : row.status,
      attempts,
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      updatedAt: new Date(),
    })
    .where(eq(merchantSyncState.id, row.id));
}

async function syncStore(storeId: string, config: MerchantConfig, limit: number) {
  const rows = await claim(storeId, limit);
  if (rows.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const origin = await storeOrigin(storeId);
  const [store] = await db.select({ name: stores.name, currencyCode: stores.currencyCode }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!origin || !store) return { sent: 0, skipped: 0, failed: 0 };

  const catalog = new Map<string, CatalogRow>();
  for (const row of await catalogRowsByIds(storeId, rows.filter((r) => r.status === "pending").map((r) => r.productId))) {
    catalog.set(row.productId, row);
  }

  const entries: BatchEntry[] = [];
  const byBatchId = new Map<number, { row: SyncRow; hash: string | null; deleted: boolean }>();
  let skipped = 0;

  for (const row of rows) {
    if (row.status === "pending_delete") {
      entries.push({ batchId: entries.length + 1, method: "delete", productId: row.googleId });
      byBatchId.set(entries.length, { row, hash: row.payloadHash, deleted: true });
      continue;
    }
    const catalogRow = catalog.get(row.productId);
    if (!catalogRow) {
      // اختفى من الكتالوج بين الحجز والبناء: يتحوّل إلى حذف في الدورة القادمة.
      await markProductRemoved(storeId, row.productId);
      skipped++;
      continue;
    }
    const product = buildMerchantProduct(catalogRow, {
      origin,
      brand: store.name,
      currency: store.currencyCode,
      target: config.target,
    });
    const hash = payloadHash(product);
    if (hash === row.payloadHash) {
      // لا شيء تغيّر فعلياً: لا نستهلك حصة، ونكتفي بتحديث الحالة.
      await markSuccess(row, hash, false);
      skipped++;
      continue;
    }
    entries.push({ batchId: entries.length + 1, method: "insert", product });
    byBatchId.set(entries.length, { row, hash, deleted: false });
  }

  if (entries.length === 0) return { sent: 0, skipped, failed: 0 };

  const client = contentApiClient(config.serviceAccountJson, config.merchantId);
  let sent = 0;
  let failed = 0;

  try {
    const results = await client.batch(entries);
    for (const result of results) {
      const target = byBatchId.get(result.batchId);
      if (!target) continue;
      if (result.ok) {
        await markSuccess(target.row, target.hash, target.deleted);
        sent++;
      } else {
        await markFailure(target.row, result.error ?? "خطأ غير معروف", result.retryable);
        failed++;
      }
    }
  } catch (e) {
    // فشل الدفعة كلها (توكن، شبكة، حصة): كل صفوفها تعود للطابور.
    const retryable = e instanceof ContentApiError ? e.retryable : true;
    const message = e instanceof Error ? e.message : String(e);
    for (const { row } of byBatchId.values()) await markFailure(row, message, retryable);
    failed += byBatchId.size;
  }

  return { sent, skipped, failed };
}

/**
 * عامل المزامنة. يمرّ على المتاجر التي فعّلت Merchant Center ويصرّف طابورها.
 * يُستدعى دورياً (كل دقيقة) — فالمزامنة «اللحظية» تعني خلال دقيقة، بلا استدعاء
 * خارجي داخل مسار حفظ المنتج.
 */
export async function processMerchantQueue(limitPerStore = BATCH_SIZE) {
  const pending = await db
    .selectDistinct({ storeId: merchantSyncState.storeId })
    .from(merchantSyncState)
    .where(
      and(
        inArray(merchantSyncState.status, ["pending", "pending_delete"]),
        lte(merchantSyncState.nextAttemptAt, new Date()),
        lt(merchantSyncState.attempts, MAX_ATTEMPTS),
      ),
    );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { storeId } of pending) {
    const config = await merchantConfig(storeId);
    if (!config) continue;
    const result = await syncStore(storeId, config, limitPerStore);
    sent += result.sent;
    skipped += result.skipped;
    failed += result.failed;
  }
  return { stores: pending.length, sent, skipped, failed };
}

/** ملخص لشاشة الإعدادات. */
export async function merchantHealth(storeId: string) {
  const rows = await db
    .select({ status: merchantSyncState.status, count: sql<number>`count(*)::int` })
    .from(merchantSyncState)
    .where(eq(merchantSyncState.storeId, storeId))
    .groupBy(merchantSyncState.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  return {
    pending: (by.pending ?? 0) + (by.pending_delete ?? 0),
    synced: by.synced ?? 0,
    failed: by.failed ?? 0,
    disapproved: by.disapproved ?? 0,
    deleted: by.deleted ?? 0,
  };
}

/** المنتجات المرفوضة أو الفاشلة مع سببها — أهم شاشة في التكامل كله. */
export async function listMerchantIssues(storeId: string, limit = 50) {
  return db
    .select()
    .from(merchantSyncState)
    .where(and(eq(merchantSyncState.storeId, storeId), inArray(merchantSyncState.status, ["failed", "disapproved"])))
    .orderBy(desc(merchantSyncState.updatedAt))
    .limit(limit);
}
