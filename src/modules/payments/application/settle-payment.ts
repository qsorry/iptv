import { db } from "@/infrastructure/database/client";
import { paymentTransactions } from "@/infrastructure/database/schema";
import { NotFoundError, ValidationError } from "@/core/errors";
import { publishEvent } from "@/core/events";
import { orderRepository } from "@/modules/orders";
import { assignCodesForOrder } from "@/modules/codes";
import { createInvoiceForOrder } from "@/modules/invoices";

export interface SettlePaymentInput {
  storeId: string;
  orderId: string;
  provider: string;
  amount: string;
  /** نتيجة بوابة الدفع. الأكواد تُسلَّم فقط عند "succeeded". */
  outcome: "succeeded" | "failed";
  providerTransactionId?: string;
  responseData?: Record<string, unknown>;
}

/**
 * تسوية دفعة إلكترونية. عند النجاح:
 * سجل معاملة ناجحة → paymentStatus=paid و status=confirmed → خصّص الأكواد الرقمية → أحداث.
 * عند الفشل: سجل معاملة فاشلة و paymentStatus=failed؛ لا تُسلَّم أي أكواد.
 * تُستدعى من webhook بوابة الدفع (idempotency يحميها عبر webhook_events).
 */
export async function settlePayment(input: SettlePaymentInput) {
  return db.transaction(async (tx) => {
    const order = await orderRepository.findById(input.storeId, input.orderId, tx);
    if (!order) throw new NotFoundError("الطلب", input.orderId);
    if (order.paymentStatus === "paid") throw new ValidationError("الطلب مدفوع مسبقاً");

    await tx.insert(paymentTransactions).values({
      storeId: input.storeId,
      orderId: order.id,
      provider: input.provider,
      transactionType: "sale",
      status: input.outcome === "succeeded" ? "succeeded" : "failed",
      amount: input.amount,
      currencyCode: order.currencyCode,
      providerTransactionId: input.providerTransactionId,
      responseData: input.responseData,
      paidAt: input.outcome === "succeeded" ? new Date() : null,
    });

    if (input.outcome === "failed") {
      await orderRepository.updateStatus(order.id, { paymentStatus: "failed" }, tx);
      await orderRepository.addEvent({ orderId: order.id, eventType: "payment.failed", description: "فشل الدفع" }, tx);
      await publishEvent(tx, { storeId: input.storeId, type: "payment.failed", aggregateType: "order", aggregateId: order.id });
      return { paid: false as const, assignments: [] };
    }

    // نجاح: الطلب مدفوع ومؤكَّد، ثم تُخصَّص الأكواد.
    await orderRepository.updateStatus(order.id, { paymentStatus: "paid", status: "confirmed" }, tx);
    const assignments = await assignCodesForOrder(tx, { storeId: input.storeId, orderId: order.id });
    await createInvoiceForOrder(tx, { storeId: input.storeId, orderId: order.id });

    await orderRepository.addEvent(
      { orderId: order.id, eventType: "payment.succeeded", description: "نجح الدفع", metadata: { assignments } },
      tx,
    );
    await publishEvent(tx, { storeId: input.storeId, type: "payment.succeeded", aggregateType: "order", aggregateId: order.id });

    const short = assignments.filter((a) => a.shortBy > 0);
    if (short.length > 0) {
      await orderRepository.addEvent(
        { orderId: order.id, eventType: "codes.shortage", description: "نقص في مخزون الأكواد", metadata: { short } },
        tx,
      );
    }

    return { paid: true as const, assignments };
  });
}
