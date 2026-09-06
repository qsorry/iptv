import { eq } from "drizzle-orm";
import type { DbExecutor } from "@/infrastructure/database/client";
import { orderItems, productVariants } from "@/infrastructure/database/schema";
import { codeRepository } from "../infrastructure/code.repository";

export interface CodeAssignment {
  orderItemId: string;
  productName: string;
  requested: number;
  codes: string[];
  shortBy: number; // كم كود نقص عن المطلوب (0 يعني اكتمل)
}

/**
 * يخصّص أكواداً لكل عنصر طلب مرتبط بـ variant له أكواد رقمية.
 * يُستدعى داخل transaction تسوية الدفع الناجح فقط.
 * لا يفشل الطلب عند نقص الأكواد؛ يرجّع shortBy ليتابعه التاجر يدوياً.
 */
export async function assignCodesForOrder(executor: DbExecutor, params: { storeId: string; orderId: string }): Promise<CodeAssignment[]> {
  const items = await executor.select().from(orderItems).where(eq(orderItems.orderId, params.orderId));
  const assignments: CodeAssignment[] = [];

  for (const item of items) {
    if (!item.variantId) continue;
    // نعتبر المتغيّر "برموز" إذا كان له مخزون أكواد.
    const available = await codeRepository.availableCount(params.storeId, item.variantId, executor);
    const variant = await executor.query.productVariants.findFirst({ where: eq(productVariants.id, item.variantId) });
    // تخطَّ العناصر التي ليست من نوع الأكواد (لا يوجد لها أي كود مطلقاً ولا حاجة).
    if (available === 0) {
      const summary = await codeRepository.summary(params.storeId, item.variantId);
      const isCodeBased = summary.available + summary.reserved + summary.delivered + summary.disabled > 0;
      if (!isCodeBased) continue;
    }

    const codes = await codeRepository.claimForOrder(executor, {
      storeId: params.storeId,
      variantId: item.variantId,
      quantity: item.quantity,
      orderId: params.orderId,
      orderItemId: item.id,
    });

    assignments.push({
      orderItemId: item.id,
      productName: item.productName,
      requested: item.quantity,
      codes,
      shortBy: Math.max(item.quantity - codes.length, 0),
    });
    void variant;
  }

  return assignments;
}
