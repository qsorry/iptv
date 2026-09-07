import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { domainEvents } from "@/infrastructure/database/schema";
import { notifyCodesDelivered } from "@/modules/notifications";
import { provisionSubscriptionsForOrder } from "@/modules/subscriptions";
import { markProductDirty, markProductRemoved, merchantConfig } from "@/modules/feeds";

const MAX_ATTEMPTS = 5;

/** معالجة حدث واحد حسب نوعه. أضف الأنواع الجديدة هنا. */
async function handle(event: typeof domainEvents.$inferSelect) {
  switch (event.eventType) {
    case "payment.succeeded":
      if (event.storeId) {
        // أولاً: إنشاء الاشتراكات المرتبطة بمزوّدي API (إن كان المتجر مؤهلاً)، ثم إشعار العميل بكل ما سُلِّم.
        await provisionSubscriptionsForOrder(event.storeId, event.aggregateId);
        await notifyCodesDelivered(event.storeId, event.aggregateId);
      }
      break;

    // مزامنة الكتالوج مع Merchant Center: الحدث يصفّ المنتج، والعامل يرسله.
    // لا استدعاء خارجي داخل مسار حفظ المنتج.
    case "product.published":
    case "product.updated":
    case "inventory.changed":
      if (event.storeId && (await merchantConfig(event.storeId))) {
        await markProductDirty(event.storeId, event.aggregateId);
      }
      break;
    case "product.unpublished":
      if (event.storeId && (await merchantConfig(event.storeId))) {
        await markProductRemoved(event.storeId, event.aggregateId);
      }
      break;

    default:
      // نوع بلا معالج: يُعتبر مُعالَجاً (لا شيء يُفعل).
      break;
  }
}

/**
 * يعالج دفعة من أحداث outbox المعلّقة. يقفل الصفوف (FOR UPDATE SKIP LOCKED)
 * فلا يعالج عاملان نفس الحدث. يُستدعى دورياً (Cron / Scheduled Task).
 */
export async function processPendingEvents(limit = 20) {
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const done = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.status, "pending"), lt(domainEvents.attempts, MAX_ATTEMPTS)))
        .orderBy(domainEvents.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!event) return false;

      try {
        await handle(event);
        await tx.update(domainEvents).set({ status: "processed", processedAt: new Date() }).where(eq(domainEvents.id, event.id));
        processed++;
      } catch (e) {
        const attempts = event.attempts + 1;
        await tx
          .update(domainEvents)
          .set({
            status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts,
            lastError: e instanceof Error ? e.message : String(e),
          })
          .where(eq(domainEvents.id, event.id));
        failed++;
      }
      return true;
    });
    if (!done) break;
  }

  void sql; // (مُستخدم ضمنياً في drizzle)
  return { processed, failed };
}
