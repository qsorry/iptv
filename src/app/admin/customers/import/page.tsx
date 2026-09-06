import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { importCustomers, mapCustomerCsvRows } from "@/modules/customers";
import { csvToObjects } from "@/lib/csv";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CustomerImportPage({
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
    let csv = "";
    if (file instanceof File && file.size > 0) {
      if (file.size > 15 * 1024 * 1024) redirect(`/admin/customers/import?error=${encodeURIComponent("حجم الملف كبير (الحد 15MB)")}`);
      csv = await file.text();
    } else {
      csv = String(formData.get("csv") || "");
    }
    try {
      const rows = mapCustomerCsvRows(csvToObjects(csv));
      if (rows.length === 0) throw new AppError("لا توجد صفوف صالحة. تأكد من صف الترويسة.", "EMPTY", 422);
      const r = await importCustomers(ctx, rows);
      redirect(`/admin/customers/import?created=${r.created}&updated=${r.updated}&skipped=${r.skipped}&failed=${r.failed}`);
    } catch (e) {
      if (e instanceof AppError) redirect(`/admin/customers/import?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="استيراد العملاء" action={<Link href="/admin/customers"><Button variant="secondary">رجوع</Button></Link>} />

      {sp.created !== undefined && (
        <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          تم الاستيراد: أُضيف {sp.created}، حُدِّث {sp.updated ?? 0}، تم تخطي {sp.skipped}، فشل {sp.failed}.
        </p>
      )}
      {sp.error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <Card className="mb-6 space-y-2 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--fg)]">كيف تنقل عملاءك من سلة؟</p>
        <p>١. من لوحة سلة: العملاء ← تصدير (Excel/CSV) لتنزيل كل عملائك في ملف واحد.</p>
        <p>٢. ارفع الملف هنا. نطابق العميل بالبريد ثم الجوال، فنضيف الجديد ونحدّث الموجود.</p>
        <p>الأعمدة المدعومة: <span dir="ltr">name/full_name, email, mobile/phone, mobile_code</span> (وتدعم الأسماء العربية).</p>
      </Card>

      <form action={action} className="space-y-6">
        <Card className="space-y-3">
          <h2 className="font-medium">رفع ملف CSV</h2>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:me-3 file:rounded-full file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-2 file:text-sm"
          />
        </Card>

        <div className="text-center text-xs text-[var(--muted)]">أو الصق المحتوى مباشرة</div>

        <Card className="space-y-3">
          <textarea
            name="csv"
            rows={8}
            dir="ltr"
            placeholder={"name,email,mobile,mobile_code\nعبدالله,a@mail.com,555000111,+966"}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs"
          />
        </Card>

        <Button type="submit">استيراد</Button>
      </form>
    </div>
  );
}
