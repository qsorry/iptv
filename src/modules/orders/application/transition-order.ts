import { db } from "@/infrastructure/database/client";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError } from "@/core/errors";
import { publishEvent, type DomainEventName } from "@/core/events";
import { orderStateMachine, type OrderStatus } from "@/core/state-machines";
import { orderRepository } from "../infrastructure/order.repository";

const eventFor: Partial<Record<OrderStatus, DomainEventName>> = {
  confirmed: "order.confirmed",
  cancelled: "order.cancelled",
  completed: "order.completed",
};

/** نقل حالة الطلب عبر آلة الحالة فقط. لا انتقال عشوائي. */
export async function transitionOrder(ctx: StoreContext, orderId: string, to: OrderStatus, reason?: string) {
  requireRole(ctx, "owner", "admin", "staff");

  return db.transaction(async (tx) => {
    const order = await orderRepository.findById(ctx.storeId, orderId, tx);
    if (!order) throw new NotFoundError("الطلب", orderId);

    orderStateMachine.assertTransition(order.status, to);

    const updated = await orderRepository.updateStatus(
      order.id,
      { status: to, cancelledAt: to === "cancelled" ? new Date() : undefined },
      tx,
    );
    await orderRepository.addEvent(
      { orderId: order.id, eventType: `order.${to}`, description: reason, createdBy: ctx.userId, metadata: { from: order.status, to } },
      tx,
    );

    const event = eventFor[to];
    if (event) await publishEvent(tx, { storeId: ctx.storeId, type: event, aggregateType: "order", aggregateId: order.id });

    return updated;
  });
}
