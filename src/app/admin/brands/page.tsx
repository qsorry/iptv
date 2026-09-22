import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import {
  createBrand,
  listBrandsWithCounts,
  updateBrand,
  uploadBrandLogo,
  removeBrandLogo,
  deleteBrand,
  unbrandedCount,
} from "@/modules/catalog";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  const { error, ok } = await searchParams;
  const [rows, unbranded] = await Promise.all([listBrandsWithCounts(ctx.storeId), unbrandedCount(ctx.storeId)]);

  async function add(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await createBrand(c, String(formData.get("name")));
    } catch (e) {
      redirect(`/admin/brands?error=${encodeURIComponent(e instanceof AppError ? e.message : "خطأ")}`);
    }
    revalidatePath("/admin/brands");
    redirect("/admin/brands");
  }

  async function rename(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await updateBrand(c, String(formData.get("id")), { name: String(formData.get("name")) });
    } catch (e) {
      redirect(`/admin/brands?error=${encodeURIComponent(e instanceof AppError ? e.message : "تعذّر الحفظ")}`);
    }
    revalidatePath("/admin/brands");
    redirect(`/admin/brands?ok=${encodeURIComponent("تم حفظ الماركة")}`);
  }

  /** رفع شعار الماركة من الجهاز — هذا مصدر الصور التي تظهر في شريط الرئيسية. */
  async function setLogo(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const id = String(formData.get("id"));
    const file = formData.get("file");
    let msg: string;
    try {
      if (!(file instanceof File)) throw new AppError("اختر صورة أولاً", "EMPTY", 422);
      await uploadBrandLogo(c, id, file);
      msg = `ok=${encodeURIComponent("تم تحديث شعار الماركة")}`;
    } catch (e) {
      msg = `error=${encodeURIComponent(e instanceof AppError ? e.message : "تعذّر رفع الشعار")}`;
    }
    revalidatePath("/admin/brands");
    revalidatePath("/");
    redirect(`/admin/brands?${msg}`);
  }

  async function setLogoUrl(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string;
    try {
      await updateBrand(c, String(formData.get("id")), { logoUrl: String(formData.get("url") || "").trim() });
      msg = `ok=${encodeURIComponent("تم تحديث شعار الماركة")}`;
    } catch (e) {
      msg = `error=${encodeURIComponent(e instanceof AppError ? e.message : "تعذّر حفظ الرابط")}`;
    }
    revalidatePath("/admin/brands");
    revalidatePath("/");
    redirect(`/admin/brands?${msg}`);
  }

  async function clearLogo(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await removeBrandLogo(c, String(formData.get("id")));
    revalidatePath("/admin/brands");
    revalidatePath("/");
  }

  async function del(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await deleteBrand(c, String(formData.get("id")));
    revalidatePath("/admin/brands");
    revalidatePath("/");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="الماركات" />

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">{ok}</p>}

      <Card className="mb-4">
        <form action={add} className="flex flex-wrap items-center gap-2">
          <Input name="name" placeholder="اسم الماركة" className="min-w-0 flex-1" />
          <Button type="submit" size="sm" className="min-h-10">إضافة</Button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          شريط الماركات في الصفحة الرئيسية يعرض الماركات التي لها شعار ولها منتج منشور واحد على الأقل.
          اربط المنتج بماركته من <Link href="/admin/products" className="text-[var(--brand)] underline">صفحة المنتج</Link>.
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="لا توجد ماركات بعد" description="أضف ماركة، ارفع شعارها، ثم اربط بها منتجاتك لتظهر في الرئيسية." />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((b) => (
            /* الجوال: الشعار والاسم بسطر ثم الإجراءات تحته. الكمبيوتر: سطر واحد. */
            <li key={b.id} className="p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                <form action={setLogo} className="shrink-0">
                  <input type="hidden" name="id" value={b.id} />
                  <label
                    className="relative grid h-12 w-12 cursor-pointer place-items-center overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-black/5"
                    title="تغيير شعار الماركة"
                  >
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logoUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-lg leading-none text-[var(--muted)]">+</span>
                    )}
                    <input type="file" name="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" aria-label={`شعار ${b.name}`} />
                  </label>
                  <Button type="submit" size="sm" variant="secondary" className="mt-1 min-h-10 w-12 px-0 text-[11px]">رفع</Button>
                </form>

                <form action={rename} className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Input name="name" defaultValue={b.name} aria-label="اسم الماركة" className="min-w-0 flex-1" />
                  <Button type="submit" size="sm" variant="secondary" className="min-h-10 shrink-0">حفظ</Button>
                </form>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs sm:mt-0 sm:shrink-0">
                <span className="whitespace-nowrap text-[var(--muted)]">{b.productCount} منتج</span>
                {!b.logoUrl && <span className="whitespace-nowrap text-amber-600">بلا شعار</span>}
                {b.logoUrl && (
                  <form action={clearLogo}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="whitespace-nowrap text-[var(--muted)] hover:underline">إزالة الشعار</button>
                  </form>
                )}
                <form action={del}>
                  <input type="hidden" name="id" value={b.id} />
                  <button className="text-red-600 hover:underline">حذف</button>
                </form>
              </div>

              <details className="mt-1 w-full text-xs">
                <summary className="cursor-pointer text-[var(--muted)]">أو الصق رابط شعار</summary>
                <form action={setLogoUrl} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Input name="url" placeholder="https://.../logo.png" dir="ltr" className="min-w-0 flex-1" />
                  <Button type="submit" size="sm" variant="secondary" className="min-h-10 shrink-0">حفظ</Button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-[var(--muted)]">
        حذف الماركة لا يحذف منتجاتها؛ يفكّ ارتباطها بها فقط.
        {unbranded > 0 && <> لديك حالياً {unbranded} منتج بلا ماركة.</>}
      </p>
    </div>
  );
}
