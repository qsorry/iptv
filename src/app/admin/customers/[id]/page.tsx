import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/core/tenancy/server";
import { getCustomer, customerOrders } from "@/modules/customers";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const payLabel: Record<string, string> = { unpaid: "غير مدفوع", paid: "مدفوع", failed: "فشل", refunded: "مُسترجع", authorized: "مُصرّح", partially_refunded: "مُسترجع جزئياً" };
const payClass: Record<string, string> = { paid: "text-green-600", failed: "text-red-600" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const customer = await getCustomer(ctx.storeId, id);
  if (!customer) notFound();
  const orders = await customerOrders(ctx.storeId, id);

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || customer.phone || "عميل";
  const paidTotal = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + toMinor(o.grandTotal), 0);
  const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("ar-SA", { dateStyle: "medium" }) : "");

  return (
    <div className="max-w-3xl">
      <PageHeader title={name} action={<Link href="/admin/customers"><Button variant="secondary">رجوع</Button></Link>} />

      <Card className="space-y-2">
        {customer.email && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">البريد</span>
            <a href={`mailto:${customer.email}`} className="text-sm text-[var(--brand)] underline" dir="ltr">{customer.email}</a>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted)]">الجوال</span>
            <a href={`https://wa.me/${customer.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--brand)] underline" dir="ltr">{customer.phone}</a>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted)]">عدد الطلبات</span>
          <span className="text-sm font-medium" dir="ltr">{orders.length}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted)]">إجمالي الإنفاق (المدفوع)</span>
          <span className="text-sm font-semibold text-green-600" dir="ltr">{formatMoney(paidTotal, "SAR")}</span>
        </div>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">الطلبات</h2>
      {orders.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">لا توجد طلبات لهذا العميل.</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/5 text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">رقم</th>
                <th className="hidden p-3 font-medium sm:table-cell">التاريخ</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)] hover:bg-black/5">
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline" dir="ltr">{o.orderNumber}</Link></td>
                  <td className="hidden p-3 text-[var(--muted)] sm:table-cell">{fmtDate(o.placedAt)}</td>
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
