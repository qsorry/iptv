import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { importOrders, mapOrderCsvRows } from "@/modules/orders";
import { parseSpreadsheet } from "@/lib/spreadsheet";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OrderImportPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; skipped?: string; failed?: string; error?: string }>;
}) {
  await getAdminContext();
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const ctx = await getAdminContext();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      redirect(`/admin/orders/import?error=${encodeURIComponent("اختر ملفاً أولاً")}`);
    }
    const f = file as File;
    if (f.size > 30 * 1024 * 1024) {
      redirect(`/admin/orders/import?error=${encodeURIComponent("حجم الملف كبير (الحد 30MB). قسّم الملف إلى أجزاء.")}`);
    }
    try {
      const buf = await f.arrayBuffer();
      const objects = parseSpreadsheet(buf);
      const rows = mapOrderCsvRows(objects);
      if (rows.length === 0) throw new AppError("لا توجد طلبات صالحة. تأكد أن العمود «رقم الطلب» موجود.", "EMPTY", 422);
      const r = await importOrders(ctx, rows);
      redirect(`/admin/orders/import?created=${r.created}&updated=${r.updated}&skipped=${r.skipped}&failed=${r.failed}`);
    } catch (e) {
      if (e instanceof AppError) redirect(`/admin/orders/import?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="استيراد الطلبات" action={<Link href="/admin/orders"><Button variant="secondary">رجوع</Button></Link>} />

      {sp.created !== undefined && (
        <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          تم الاستيراد: أُضيف {sp.created}، تم تخطي {sp.skipped} (مكرر)، فشل {sp.failed}.
        </p>
      )}
      {sp.error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <Card className="mb-6 space-y-2 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--fg)]">كيف تنقل طلباتك من سلة؟</p>
        <p>١. من لوحة سلة: الطلبات ← تصدير (Excel). لو كان الملف كبيراً، سلة يقسّمه إلى أجزاء.</p>
        <p>٢. ارفع كل جزء هنا (يقبل <span dir="ltr">.xlsx</span> و<span dir="ltr">.csv</span>). نطابق الطلب برقمه فلا يتكرر، وننشئ العميل تلقائياً.</p>
        <p>٣. أي كود اشتراك في «الملاحظات الداخلية» يُدمج في الطلب ويصبح قابلاً للبحث.</p>
      </Card>

      <form action={action} className="space-y-6">
        <Card className="space-y-3">
          <h2 className="font-medium">رفع ملف Excel أو CSV</h2>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="block w-full text-sm file:me-3 file:rounded-full file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-2 file:text-sm"
          />
          <p className="text-xs text-[var(--muted)]">الحد الأقصى 30MB للملف الواحد. للملفات الأكبر، قسّمها.</p>
        </Card>

        <Button type="submit">استيراد</Button>
      </form>
    </div>
  );
}
