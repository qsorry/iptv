import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { orderRepository } from "@/modules/orders";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

const payLabel: Record<string, string> = { unpaid: "غير مدفوع", paid: "مدفوع", failed: "فشل", refunded: "مُسترجع", authorized: "مُصرّح", partially_refunded: "مُسترجع جزئياً" };
const payClass: Record<string, string> = { paid: "text-green-600", failed: "text-red-600" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const ctx = await getAdminContext();
  const { page } = await searchParams;
  const result = await orderRepository.list(ctx.storeId, { page: Number(page) || 1, perPage: 20 });

  return (
    <div>
      <PageHeader title="الطلبات" action={<Link href="/admin/orders/new"><Button>+ طلب يدوي</Button></Link>} />
      {result.data.length === 0 ? (
        <EmptyState title="لا توجد طلبات بعد" action={<Link href="/admin/orders/new"><Button>+ طلب يدوي</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/5 text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">رقم</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)] hover:bg-black/5">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">{o.orderNumber}</Link>
                  </td>
                  <td className="p-3" dir="ltr">{formatMoney(toMinor(o.grandTotal), o.currencyCode)}</td>
                  <td className={`p-3 ${payClass[o.paymentStatus] ?? "text-[var(--muted)]"}`}>{payLabel[o.paymentStatus] ?? o.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
