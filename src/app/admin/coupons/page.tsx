import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { listCoupons, toggleCoupon } from "@/modules/promotions";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default async function CouponsPage() {
  const ctx = await getAdminContext();
  const rows = await listCoupons(ctx.storeId);

  async function toggle(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await toggleCoupon(c, String(formData.get("id")), formData.get("active") === "1");
    revalidatePath("/admin/coupons");
  }

  return (
    <div>
      <PageHeader title="الكوبونات" action={<Link href="/admin/coupons/new"><Button>+ كوبون</Button></Link>} />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد كوبونات" action={<Link href="/admin/coupons/new"><Button>+ كوبون</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
          <table className="w-full text-right text-sm">
            <thead className="bg-black/5 text-[var(--muted)]">
              <tr><th className="p-3 font-medium">الرمز</th><th className="p-3 font-medium">الخصم</th><th className="p-3 font-medium">الاستخدام</th><th className="p-3 font-medium">الحالة</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="p-3 font-mono" dir="ltr">{c.code}</td>
                  <td className="p-3" dir="ltr">{c.discountType === "percentage" ? `${c.value}%` : `${c.value} ر.س`}</td>
                  <td className="p-3" dir="ltr">{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}</td>
                  <td className="p-3">
                    <form action={toggle}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                      <button className={c.isActive ? "text-green-600" : "text-[var(--muted)]"}>{c.isActive ? "مفعّل" : "موقوف"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
