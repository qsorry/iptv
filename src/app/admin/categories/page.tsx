import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { createCategory, listCategories, deleteCategory } from "@/modules/catalog";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAdminContext();
  const { error } = await searchParams;
  const rows = await listCategories(ctx.storeId);

  async function add(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await createCategory(c, String(formData.get("name")));
    } catch (e) {
      redirect(`/admin/categories?error=${encodeURIComponent(e instanceof AppError ? e.message : "خطأ")}`);
    }
    revalidatePath("/admin/categories");
    redirect("/admin/categories");
  }
  async function del(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await deleteCategory(c, String(formData.get("id")));
    revalidatePath("/admin/categories");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="التصنيفات" />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Card className="mb-4">
        <form action={add} className="flex flex-wrap items-center gap-2">
          <Input name="name" placeholder="اسم التصنيف" className="min-w-0 flex-1" />
          <Button type="submit" size="sm">إضافة</Button>
        </form>
      </Card>
      {rows.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-3">
              <span>{c.name}</span>
              <form action={del}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-red-600 hover:underline">حذف</button></form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
