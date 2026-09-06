import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { listCustomers } from "@/modules/customers";
import { formatMoney, toMinor } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default async function CustomersPage() {
  const ctx = await getAdminContext();
  const rows = await listCustomers(ctx.storeId);

  return (
    <div>
      <PageHeader
        title="العملاء"
        action={
          <Link href="/admin/customers/import">
            <Button variant="secondary">استيراد العملاء</Button>
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="لا يوجد عملاء بعد" description="يظهر العملاء تلقائياً عند أول طلب." />
      ) : (
        <>
          {/* بطاقات على الجوال */}
          <div className="grid gap-3 sm:hidden">
            {rows.map((c) => (
              <div key={c.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-medium">{c.firstName || c.email || "عميل"}</div>
                {c.email && <div className="text-xs text-[var(--muted)]" dir="ltr">{c.email}</div>}
                {c.phone && <div className="text-xs text-[var(--muted)]" dir="ltr">{c.phone}</div>}
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-[var(--muted)]">الطلبات: {c.orders}</span>
                  <span className="font-medium" dir="ltr">{formatMoney(toMinor(c.spent), "SAR")}</span>
                </div>
              </div>
            ))}
          </div>
          {/* جدول على الكمبيوتر */}
          <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] sm:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-black/5 text-[var(--muted)]">
                <tr><th className="p-3 font-medium">العميل</th><th className="p-3 font-medium">التواصل</th><th className="p-3 font-medium">الطلبات</th><th className="p-3 font-medium">إجمالي الإنفاق</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border)]">
                    <td className="p-3 font-medium">{c.firstName || "عميل"}</td>
                    <td className="p-3 text-[var(--muted)]" dir="ltr">{c.email || c.phone || "—"}</td>
                    <td className="p-3" dir="ltr">{c.orders}</td>
                    <td className="p-3" dir="ltr">{formatMoney(toMinor(c.spent), "SAR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
