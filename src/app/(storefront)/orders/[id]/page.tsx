import { notFound } from "next/navigation";
import { getStorefrontStore } from "@/core/tenancy/server";
import { orderRepository } from "@/modules/orders";
import { codeRepository } from "@/modules/codes";
import { db } from "@/infrastructure/database/client";
import { orderItems } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
import { codeLines } from "@/lib/format-code";

const payLabel: Record<string, string> = {
  unpaid: "بانتظار الدفع",
  authorized: "مُصرّح",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refunded: "مُسترجع",
  partially_refunded: "مُسترجع جزئياً",
};

/** صفحة الطلب للمشتري. الأكواد تظهر فقط إذا كان الدفع ناجحاً (paid). */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const store = await getStorefrontStore();
  if (!store) notFound();
  const { id } = await params;
  const order = await orderRepository.findById(store.id, id);
  if (!order) notFound();

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const paid = order.paymentStatus === "paid";
  const codes = paid ? await codeRepository.deliveredForOrder(store.id, order.id) : [];
  const codesByItem = new Map<string, string[]>();
  for (const c of codes) {
    if (!c.orderItemId) continue;
    codesByItem.set(c.orderItemId, [...(codesByItem.get(c.orderItemId) ?? []), c.code]);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold sm:text-2xl">طلب رقم {order.orderNumber}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        حالة الدفع: <span className={paid ? "text-green-600" : ""}>{payLabel[order.paymentStatus] ?? order.paymentStatus}</span>
      </p>

      <div className="mt-4 space-y-3">
        {items.map((it) => {
          const itemCodes = codesByItem.get(it.id) ?? [];
          return (
            <Card key={it.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{it.productName}</span>
                <span dir="ltr">×{it.quantity}</span>
              </div>
              <div className="text-sm text-[var(--muted)]" dir="ltr">{formatMoney(toMinor(it.total), order.currencyCode)}</div>

              {paid && itemCodes.length > 0 && (
                <div className="mt-2 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3">
                  <div className="mb-1 text-xs font-semibold text-green-700">أكوادك:</div>
                  <ul className="space-y-1">
                    {itemCodes.map((code, i) => (
                      <li key={i} className="select-all rounded bg-white p-2 font-mono text-sm" dir="ltr">
                        {codeLines(code).map((line, j) => (
                          <div key={j}>{line}</div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4 font-semibold">
        <span>الإجمالي</span>
        <span dir="ltr">{formatMoney(toMinor(order.grandTotal), order.currencyCode)}</span>
      </div>

      {!paid && (
        <p className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
          ستظهر بيانات الاشتراك أو الأكواد هنا فور نجاح الدفع.
        </p>
      )}
    </div>
  );
}
