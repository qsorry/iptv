import { domainEvents } from "@/infrastructure/database/schema";
import type { DbExecutor } from "@/infrastructure/database/client";

export type DomainEventName =
  | "order.created"
  | "order.confirmed"
  | "order.cancelled"
  | "order.completed"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "inventory.low"
  | "inventory.out_of_stock"
  | "product.published"
  | "product.updated"
  | "product.unpublished"
  | "inventory.changed";

export interface DomainEvent {
  storeId: string | null;
  type: DomainEventName;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}

/**
 * يكتب الحدث في outbox ضمن نفس الـ transaction. المعالجة الفعلية (إيميل، إشعار، تحليلات)
 * تتم لاحقاً بواسطة worker يقرأ الأحداث المعلقة. إنشاء الطلب لا ينتظر إرسال الإيميل.
 */
export async function publishEvent(executor: DbExecutor, event: DomainEvent) {
  await executor.insert(domainEvents).values({
    storeId: event.storeId,
    eventType: event.type,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload ?? {},
  });
}
