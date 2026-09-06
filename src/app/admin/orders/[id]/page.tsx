import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { orderRepository } from "@/modules/orders";
import { settlePayment } from "@/modules/payments";
import { codeRepository } from "@/modules/codes";
import { AppError } from "@/core/errors";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { codeLines } from "@/lib/format-code";
import { Button } from "@/components/ui/button";

const payLabel: Record<string, string> = { unpaid: "غير مدفوع", paid: "مدفوع", failed: "فشل", refunded: "مُسترجع", authorized: "مُصرّح", partially_refunded: "مُسترجع جزئياً" };

export default async function AdminOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const { error, ok } = await searchParams;
  const order = await orderRepository.findById(ctx.storeId, id);
  if (!order) notFound();
  const items = await orderRepository.itemsFor(order.id);
  const customer = await orderRepository.customerFor(ctx.storeId, order.customerId);
  const paid = order.paymentStatus === "paid";
  const codes = await codeRepository.deliveredForOrder(ctx.storeId, order.id);
  const placed = order.placedAt ? new Date(order.placedAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }) : null;
  const statusLabel: Record<string, string> = { pending: "قيد الانتظار", confirmed: "مؤكد", processing: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي" };

  async function markPaid() {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await settlePayment({ storeId: c.storeId, orderId: id, provider: "manual", amount: order!.grandTotal, outcome: "succeeded" });
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّرت العملية";
    }
    revalidatePath(`/admin/orders/${id}`);
    redirect(msg ? `/admin/orders/${id}?error=${encodeURIComponent(msg)}` : `/admin/orders/${id}?ok=1`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`طلب ${order.orderNumber}`}
        action={
          <div className="flex gap-2">
            {paid && <Link href={`/admin/orders/${id}/invoice`}><Button variant="secondary" size="sm">الفاتورة</Button></Link>}
            <Link href="/admin/orders"><Button variant="secondary">رجوع</Button></Link>
          </div>
        }
      />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">تم تعليم الطلب كمدفوع وتسليم الأكواد.</p>}

      <Card className="space-y-2">
        <Row label="رقم الطلب" value={order.orderNumber} />
        {placed && <Row label="التاريخ" value={placed} />}
        <Row label="حالة الطلب" value={statusLabel[order.status] ?? order.status} />
        <Row label="حالة الدفع" value={payLabel[order.paymentStatus] ?? order.paymentStatus} strong={paid} />
        <Row label="الإجمالي" value={formatMoney(toMinor(order.grandTotal), order.currencyCode)} />
        {order.notes && <Row label="ملاحظات" value={order.notes} />}
      </Card>

      {/* بيانات العميل */}
      {customer && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">العميل</h2>
          <Card className="space-y-2">
            {(customer.firstName || customer.lastName) && (
              <Row label="الاسم" value={[customer.firstName, customer.lastName].filter(Boolean).join(" ")} />
            )}
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
          </Card>
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">العناصر</h2>
      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id} className="flex items-center justify-between">
            <span>{it.productName} <span className="text-[var(--muted)]" dir="ltr">×{it.quantity}</span></span>
            <span dir="ltr">{formatMoney(toMinor(it.total), order.currencyCode)}</span>
          </Card>
        ))}
      </div>

      {codes.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">معلومات الاشتراك (الكود)</h2>
          <Card>
            <ul className="space-y-2">
              {codes.map((c, i) => (
                <li key={i} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] p-3 font-mono text-sm" dir="ltr">
                  {codeLines(c.code).map((line, j) => (
                    <div key={j} className="break-all">{line}</div>
                  ))}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {!paid && order.paymentStatus !== "failed" && (
        <div className="mt-6">
          <form action={markPaid}>
            <Button type="submit">تعليم كمدفوع (تسليم يدوي)</Button>
          </form>
          <p className="mt-2 text-xs text-[var(--muted)]">للاختبار والدفع اليدوي. يُخصّص الأكواد ويظهرها للمشتري، تماماً كبوابة الدفع.</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className={`text-sm ${strong ? "font-semibold text-green-600" : ""}`} dir="ltr">{value}</span>
    </div>
  );
}
