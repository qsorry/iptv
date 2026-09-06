import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { importProducts, mapCsvRows } from "@/modules/catalog";
import { csvToObjects } from "@/lib/csv";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ created?: string; skipped?: string; failed?: string; error?: string }> }) {
  await getAdminContext();
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const ctx = await getAdminContext();
    const csv = String(formData.get("csv") || "");
    try {
      const rows = mapCsvRows(csvToObjects(csv));
      if (rows.length === 0) throw new AppError("لا توجد صفوف صالحة. تأكد من وجود صف ترويسة.", "EMPTY", 422);
      const r = await importProducts(ctx, rows);
      redirect(`/admin/products/import?created=${r.created}&skipped=${r.skipped}&failed=${r.failed}`);
    } catch (e) {
      if (e instanceof AppError) redirect(`/admin/products/import?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="استيراد المنتجات" action={<Link href="/admin/products"><Button variant="secondary">رجوع</Button></Link>} />

      {sp.created !== undefined && (
        <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          تم الاستيراد: أُضيف {sp.created}، تم تخطي {sp.skipped} (مكرر)، فشل {sp.failed}.
        </p>
      )}
      {sp.error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <Card className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          صدّر منتجاتك من سلة كملف CSV، ثم افتحه والصق محتواه هنا. يجب أن يحتوي صف الترويسة على أعمدة
          مثل: <span dir="ltr">name, price, description, images, type, status</span> (يدعم الأسماء العربية أيضاً).
          روابط عدة صور تُفصل بـ <span dir="ltr">|</span> أو فاصلة.
        </p>
        <form action={action} className="space-y-3">
          <textarea
            name="csv"
            rows={12}
            dir="ltr"
            placeholder={"name,price,description,images,type\nاشتراك سنوي,99,أفضل باقة,https://.../a.png,digital"}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-xs"
          />
          <Button type="submit">استيراد</Button>
        </form>
      </Card>
    </div>
  );
}
