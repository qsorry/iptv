import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { DEFAULT_PLANS, ensureDefaultPlans, isPlatformAdmin, listStoresWithPlans, requirePlatformAdmin, setStorePlan } from "@/modules/billing";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PATH = "/admin/platform";
const selectClass = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base";

/**
 * لوحة إدارة المنصة (لمديري المنصة فقط عبر PLATFORM_ADMIN_EMAILS):
 * عرض كل المتاجر وتغيير باقة أي متجر.
 */
export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  if (!isPlatformAdmin(ctx.userEmail)) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="إدارة المنصة" />
        <Card>
          <p className="text-sm">هذه الصفحة لمديري المنصة فقط.</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            لتفعيلها أضِف إيميلك إلى متغير البيئة <span dir="ltr">PLATFORM_ADMIN_EMAILS</span> في Coolify ثم أعد النشر.
          </p>
        </Card>
      </div>
    );
  }

  await ensureDefaultPlans();
  const { error, ok } = await searchParams;
  const rows = await listStoresWithPlans();

  async function changePlan(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      requirePlatformAdmin(c.userEmail);
      const months = Number(formData.get("months")) || 0;
      const end = months > 0 ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000) : undefined;
      await setStorePlan(String(formData.get("storeId")), String(formData.get("planCode")), end);
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر تغيير الباقة";
    }
    revalidatePath(PATH);
    revalidatePath("/admin/subscriptions");
    redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?ok=1`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="إدارة المنصة: باقات المتاجر" />
      {error && <p className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">تم تحديث الباقة.</p>}

      <Card className="text-sm">
        <div className="flex flex-wrap gap-4">
          {DEFAULT_PLANS.map((p) => (
            <div key={p.code}>
              <div className="font-medium">{p.name} <span className="text-xs text-[var(--muted)]" dir="ltr">({p.code})</span></div>
              <div className="text-xs text-[var(--muted)]">{p.features.length === 0 ? "الأساسيات فقط" : p.features.join("، ")}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-[var(--border)] p-0 sm:p-0">
        {rows.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {s.name} {s.id === ctx.storeId && <span className="text-xs text-[var(--brand)]">(متجرك الحالي)</span>}
              </div>
              <div className="text-xs text-[var(--muted)]" dir="ltr">
                /s/{s.slug} · {s.planName ?? "بدون باقة"}
                {s.currentPeriodEnd ? ` · حتى ${s.currentPeriodEnd.toLocaleDateString("ar-SA")}` : ""}
              </div>
            </div>
            <form action={changePlan} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="storeId" value={s.id} />
              <select name="planCode" defaultValue={s.planCode ?? "free"} className={selectClass}>
                {DEFAULT_PLANS.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <select name="months" defaultValue="0" className={selectClass}>
                <option value="0">بلا انتهاء</option>
                <option value="1">شهر</option>
                <option value="3">3 أشهر</option>
                <option value="12">سنة</option>
              </select>
              <Button type="submit" size="sm">تطبيق</Button>
            </form>
          </div>
        ))}
      </Card>
    </div>
  );
}
