import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { createCategory, listCategoriesWithCounts, updateCategory, deleteCategory, UNCATEGORIZED } from "@/modules/catalog";
import { productRepository } from "@/modules/catalog";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  const { error, ok } = await searchParams;
  const [rows, categoryCounts] = await Promise.all([
    listCategoriesWithCounts(ctx.storeId),
    productRepository.countsByCategory(ctx.storeId),
  ]);
  const uncategorized = categoryCounts[UNCATEGORIZED] ?? 0;

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

  async function rename(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await updateCategory(c, String(formData.get("id")), { name: String(formData.get("name")) });
    } catch (e) {
      redirect(`/admin/categories?error=${encodeURIComponent(e instanceof AppError ? e.message : "تعذّر الحفظ")}`);
    }
    revalidatePath("/admin/categories");
    redirect(`/admin/categories?ok=${encodeURIComponent("تم حفظ التصنيف")}`);
  }

  async function toggleVisibility(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const next = String(formData.get("status")) === "active" ? "hidden" : "active";
    await updateCategory(c, String(formData.get("id")), { status: next });
    revalidatePath("/admin/categories");
  }

  async function del(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await deleteCategory(c, String(formData.get("id")));
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="التصنيفات" />

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">{ok}</p>}

      <Card className="mb-4">
        <form action={add} className="flex flex-wrap items-center gap-2">
          <Input name="name" placeholder="اسم التصنيف" className="min-w-0 flex-1" />
          <Button type="submit" size="sm">إضافة</Button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          اربط المنتجات بالتصنيف من صفحة المنتج، أو حدّد عدة منتجات دفعة واحدة من{" "}
          <Link href="/admin/products" className="text-[var(--brand)] underline">قائمة المنتجات</Link>.
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="لا توجد تصنيفات بعد" description="أضف تصنيفاً ثم اربط به منتجاتك ليظهر كقسم في المتجر." />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((c) => (
            /* الجوال: اسم التصنيف بسطر كامل ثم الإجراءات تحته. الكمبيوتر: سطر واحد. */
            <li key={c.id} className="p-3 sm:flex sm:items-center sm:gap-3">
              <form action={rename} className="flex min-w-0 items-center gap-2 sm:flex-1">
                <input type="hidden" name="id" value={c.id} />
                <Input name="name" defaultValue={c.name} aria-label="اسم التصنيف" className="min-w-0 flex-1" />
                <Button type="submit" size="sm" variant="secondary" className="shrink-0">حفظ</Button>
              </form>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs sm:mt-0 sm:shrink-0">
                <Link href={`/admin/products?category=${c.id}`} className="touch-target inline-flex items-center whitespace-nowrap text-[var(--brand)] hover:underline">
                  {c.productCount} منتج
                </Link>
                <form action={toggleVisibility}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value={c.status} />
                  <button className="whitespace-nowrap text-[var(--muted)] hover:underline">
                    {c.status === "active" ? "ظاهر — إخفاء" : "مخفي — إظهار"}
                  </button>
                </form>
                <form action={del}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-red-600 hover:underline">حذف</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--muted)]">
        التصنيف الفارغ لا يظهر في المتجر. وحذف التصنيف لا يحذف منتجاته؛ تصبح «بلا تصنيف» ويمكن نقلها لاحقاً.
        {uncategorized > 0 && (
          <>
            {" "}لديك حالياً{" "}
            <Link href={`/admin/products?category=${UNCATEGORIZED}`} className="text-[var(--brand)] underline">
              {uncategorized} منتج بلا تصنيف
            </Link>.
          </>
        )}
      </p>
    </div>
  );
}
