import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { createProduct } from "@/modules/catalog";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await getAdminContext();
  const { error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const ctx = await getAdminContext();
    try {
      await createProduct(ctx, {
        name: String(formData.get("name")),
        productType: (String(formData.get("productType")) as "physical" | "digital" | "service") || "physical",
        status: formData.get("publish") ? "active" : "draft",
        shortDescription: String(formData.get("shortDescription") || "") || undefined,
        variants: [{ name: "الافتراضي", price: String(formData.get("price")), isDefault: true }],
      });
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "تعذّر إنشاء المنتج";
      redirect(`/admin/products/new?error=${encodeURIComponent(msg)}`);
    }
    redirect("/admin/products");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="منتج جديد" />

      {error && (
        <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <form action={action} className="space-y-4">
        <label className="block text-sm">
          اسم المنتج
          <Input name="name" required minLength={1} className="mt-1" />
        </label>

        <label className="block text-sm">
          السعر (ر.س)
          <Input name="price" type="number" step="0.01" min="0" required dir="ltr" className="mt-1" />
        </label>

        <label className="block text-sm">
          نوع المنتج
          <select
            name="productType"
            className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base"
          >
            <option value="physical">منتج مادي</option>
            <option value="digital">منتج رقمي</option>
            <option value="service">خدمة</option>
          </select>
        </label>

        <label className="block text-sm">
          وصف مختصر (اختياري)
          <Input name="shortDescription" className="mt-1" />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publish" className="h-4 w-4" />
          نشر المنتج مباشرة
        </label>

        <div className="flex gap-2">
          <Button type="submit">حفظ</Button>
          <Link href="/admin/products">
            <Button type="button" variant="secondary">إلغاء</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
