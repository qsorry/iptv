import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getAdminContext } from "@/core/tenancy/server";
import { orderRepository } from "@/modules/orders";
import { db } from "@/infrastructure/database/client";
import { customers } from "@/infrastructure/database/schema";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

const payLabel: Record<string, string> = { unpaid: "غير مدفوع", paid: "مدفوع", failed: "فشل", refunded: "مُسترجع", authorized: "مُصرّح", partially_refunded: "مُسترجع جزئياً" };
const payClass: Record<string, string> = { paid: "text-green-600", failed: "text-red-600" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const ctx = await getAdminContext();
  const { page, q } = await searchParams;
  const query = (q ?? "").trim();
  const pg = { page: Number(page) || 1, perPage: 20 };
  const result = query ? await orderRepository.search(ctx.storeId, query, pg) : await orderRepository.list(ctx.storeId, pg);

  // أسماء العملاء للصفحة الحالية (استعلام واحد).
  const custIds = [...new Set(result.data.map((o) => o.customerId).filter(Boolean) as string[])];
  const custRows = custIds.length
    ? await db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone }).from(customers).where(inArray(customers.id, custIds))
    : [];
  const custName = new Map(custRows.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "عميل"]));

  const fmtDate = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("ar-SA", { dateStyle: "medium" }) : "");

  return (
    <div>
      <PageHeader
        title="الطلبات"
        action={
          <div className="flex gap-2">
            <Link href="/admin/orders/import"><Button variant="secondary">استيراد</Button></Link>
            <Link href="/admin/orders/new"><Button>+ طلب يدوي</Button></Link>
          </div>
        }
      />

      {/* بحث */}
      <form action="/admin/orders" className="relative mb-4">
        <input
          name="q"
          defaultValue={query}
          placeholder="ابحث برقم الطلب، اسم/جوال/بريد العميل، أو كود الاشتراك…"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 pe-4 ps-10 text-sm outline-none focus:border-[var(--brand)]"
        />
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" style={{ insetInlineStart: "0.75rem" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </form>

      {query && (
        <p className="mb-3 text-sm text-[var(--muted)]">
          {result.total} نتيجة لـ «{query}» · <Link href="/admin/orders" className="text-[var(--brand)] hover:underline">مسح البحث</Link>
        </p>
      )}

      {result.data.length === 0 ? (
        <EmptyState title={query ? "لا نتائج مطابقة" : "لا توجد طلبات بعد"} action={!query ? <Link href="/admin/orders/new"><Button>+ طلب يدوي</Button></Link> : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/5 text-[var(--muted)]">
              <tr>
                <th className="p-3 font-medium">رقم</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="hidden p-3 font-medium sm:table-cell">التاريخ</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)] hover:bg-black/5">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline" dir="ltr">{o.orderNumber}</Link>
                  </td>
                  <td className="p-3">{o.customerId ? custName.get(o.customerId) ?? "عميل" : "—"}</td>
                  <td className="hidden p-3 text-[var(--muted)] sm:table-cell">{fmtDate(o.placedAt)}</td>
                  <td className="p-3" dir="ltr">{formatMoney(toMinor(o.grandTotal), o.currencyCode)}</td>
                  <td className={`p-3 ${payClass[o.paymentStatus] ?? "text-[var(--muted)]"}`}>{payLabel[o.paymentStatus] ?? o.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ترقيم الصفحات */}
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: Math.min(result.totalPages, 10) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/admin/orders?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${n}`}
              className={`rounded-full px-3 py-1 ${n === result.page ? "bg-[var(--brand)] text-[var(--brand-fg)]" : "border border-[var(--border)] hover:bg-black/5"}`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
