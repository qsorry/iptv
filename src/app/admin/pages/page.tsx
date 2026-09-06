import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { listPages, deletePage } from "@/modules/content";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default async function PagesList() {
  const ctx = await getAdminContext();
  const rows = await listPages(ctx.storeId);
  async function del(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await deletePage(c, String(formData.get("id")));
    revalidatePath("/admin/pages");
  }
  return (
    <div className="max-w-xl">
      <PageHeader title="الصفحات" action={<Link href="/admin/pages/new"><Button>+ صفحة</Button></Link>} />
      {rows.length === 0 ? <EmptyState title="لا توجد صفحات" description="مثل: من نحن، الشروط، سياسة الاسترجاع." /> : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-3">
              <Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)]">{p.status === "published" ? "منشور" : "مسودة"}</span>
                <form action={del}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-red-600 hover:underline">حذف</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
