import { getAdminContext } from "@/core/tenancy/server";
import { storeReport } from "@/modules/reports";
import { formatMoney } from "@/core/money";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";

export default async function ReportsPage() {
  const ctx = await getAdminContext();
  const r = await storeReport(ctx.storeId);
  const max = Math.max(1, ...r.daily.map((d) => d.revenue));

  return (
    <div>
      <PageHeader title="التقارير" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="الإيرادات" value={formatMoney(r.revenue, "SAR")} />
        <Stat label="طلبات مدفوعة" value={String(r.paidCount)} />
        <Stat label="بانتظار الدفع" value={String(r.pendingCount)} />
        <Stat label="إجمالي الطلبات" value={String(r.ordersCount)} />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">الإيرادات (آخر ١٤ يوماً)</h2>
      <Card>
        <div className="flex h-40 items-end gap-1">
          {r.daily.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${formatMoney(d.revenue, "SAR")}`}>
              <div className="w-full rounded-t bg-[var(--brand)] transition-all" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? "4px" : "0" }} />
              <span className="mt-1 text-[9px] text-[var(--muted)]" dir="ltr">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-[var(--muted)]">أفضل المنتجات</h2>
      {r.topProducts.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">لا توجد مبيعات بعد.</p></Card>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/5 text-[var(--muted)]"><tr><th className="p-3 font-medium">المنتج</th><th className="p-3 font-medium">الكمية</th><th className="p-3 font-medium">الإيراد</th></tr></thead>
            <tbody>
              {r.topProducts.map((t, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="p-3">{t.name}</td>
                  <td className="p-3" dir="ltr">{t.quantity}</td>
                  <td className="p-3" dir="ltr">{formatMoney(t.revenue, "SAR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xl font-bold sm:text-2xl" dir="ltr">{value}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
    </Card>
  );
}
