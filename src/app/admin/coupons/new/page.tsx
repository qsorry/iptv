import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { createCoupon } from "@/modules/promotions";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default async function NewCouponPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await getAdminContext();
  const { error } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    try {
      await createCoupon(c, {
        code: String(formData.get("code")),
        discountType: String(formData.get("discountType")) as "percentage" | "fixed",
        value: String(formData.get("value")),
        minOrderAmount: String(formData.get("minOrderAmount") || "") || undefined,
        maxDiscount: String(formData.get("maxDiscount") || "") || undefined,
        usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : undefined,
        usageLimitPerCustomer: formData.get("perCustomer") ? Number(formData.get("perCustomer")) : undefined,
      });
    } catch (e) {
      const msg = e instanceof AppError ? e.message : "تعذّر إنشاء الكوبون";
      redirect(`/admin/coupons/new?error=${encodeURIComponent(msg)}`);
    }
    redirect("/admin/coupons");
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="كوبون جديد" action={<Link href="/admin/coupons"><Button variant="secondary">رجوع</Button></Link>} />
      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={action} className="space-y-4">
        <label className="block text-sm">الرمز<Input name="code" required dir="ltr" placeholder="SUMMER20" className="mt-1" /></label>
        <label className="block text-sm">
          نوع الخصم
          <Select
            name="discountType"
            title="نوع الخصم"
            required
            className="mt-1"
            options={[
              { value: "percentage", label: "نسبة %" },
              { value: "fixed", label: "مبلغ ثابت" },
            ]}
          />
        </label>
        <label className="block text-sm">القيمة<Input name="value" type="number" step="0.01" min="0" required dir="ltr" className="mt-1" /></label>
        <label className="block text-sm">الحد الأدنى للطلب (اختياري)<Input name="minOrderAmount" type="number" step="0.01" min="0" dir="ltr" className="mt-1" /></label>
        <label className="block text-sm">أقصى خصم (اختياري)<Input name="maxDiscount" type="number" step="0.01" min="0" dir="ltr" className="mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">حد الاستخدام الكلي<Input name="usageLimit" type="number" min="1" dir="ltr" className="mt-1" /></label>
          <label className="block text-sm">حد لكل عميل<Input name="perCustomer" type="number" min="1" dir="ltr" className="mt-1" /></label>
        </div>
        <Button type="submit">إنشاء</Button>
      </form>
    </div>
  );
}
