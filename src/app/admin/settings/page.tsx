import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { updateSubdomain, listDomains, addDomain, removeDomain } from "@/modules/stores";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/core/errors";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

/** يحوّل خطأ حالة الاستخدام إلى رسالة على الصفحة. redirect() يُستدعى خارج أي try. */
function errorMessage(e: unknown, fallback: string): string {
  return e instanceof AppError ? e.message : fallback;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  const domains = await listDomains(ctx.storeId);
  const settingsRow = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, ctx.storeId) });
  const taxPercent = (settingsRow?.settings as Record<string, unknown> | undefined)?.taxPercent ?? 15;
  const { error, ok } = await searchParams;
  const scheme = PLATFORM_DOMAIN.includes("localhost") ? "http" : "https";
  const storeUrl = `${scheme}://${ctx.storeSlug}.${PLATFORM_DOMAIN}`;

  async function saveSubdomain(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await updateSubdomain(c, String(formData.get("subdomain")));
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ العنوان");
    }
    revalidatePath("/admin/settings");
    redirect(msg ? `/admin/settings?error=${encodeURIComponent(msg)}` : "/admin/settings?ok=1");
  }

  async function addCustomDomain(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await addDomain(c, String(formData.get("domain")));
    } catch (e) {
      msg = errorMessage(e, "تعذّر إضافة الدومين");
    }
    revalidatePath("/admin/settings");
    redirect(msg ? `/admin/settings?error=${encodeURIComponent(msg)}` : "/admin/settings?ok=1");
  }

  async function deleteDomain(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await removeDomain(c, String(formData.get("id")));
    revalidatePath("/admin/settings");
  }

  async function saveTax(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const pct = Math.max(0, Math.min(100, Number(formData.get("taxPercent")) || 0));
    const row = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, c.storeId) });
    const merged = { ...((row?.settings as Record<string, unknown>) ?? {}), taxPercent: pct };
    await db.update(storeSettings).set({ settings: merged, updatedAt: new Date() }).where(eq(storeSettings.storeId, c.storeId));
    revalidatePath("/admin/settings");
    redirect("/admin/settings?ok=1");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" />

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">تم الحفظ.</p>}

      {/* عنوان المتجر على المنصة */}
      <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">عنوان متجرك على المنصة</h2>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>متجرك متاح على:</span>
          <a href={storeUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand)] underline" dir="ltr">
            {storeUrl}
          </a>
        </div>

        <form action={saveSubdomain} className="space-y-2">
          <label className="block text-sm">العنوان الفرعي (subdomain)</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input name="subdomain" defaultValue={ctx.storeSlug} dir="ltr" className="max-w-[200px]" />
            <span className="text-sm text-[var(--muted)]" dir="ltr">.{PLATFORM_DOMAIN}</span>
            <Button type="submit" size="sm">حفظ</Button>
          </div>
          <p className="text-xs text-[var(--muted)]">أحرف إنجليزية وأرقام وشرطات فقط.</p>
        </form>
      </Card>

      {/* الضريبة */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-[var(--muted)]">الضريبة</h2>
      <Card>
        <form action={saveTax} className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            نسبة ضريبة القيمة المضافة (%)
            <Input name="taxPercent" type="number" step="0.01" min="0" max="100" defaultValue={String(taxPercent)} dir="ltr" className="mt-1 max-w-[140px]" />
          </label>
          <Button type="submit" size="sm">حفظ</Button>
        </form>
      </Card>

      {/* دومين مخصص */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-[var(--muted)]">دومين مخصص (اختياري)</h2>
      <Card className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          لربط دومينك الخاص، أضِفه هنا ثم وجّه سجل <span dir="ltr">CNAME</span> عند مزوّد دومينك إلى{" "}
          <span className="font-medium" dir="ltr">{PLATFORM_DOMAIN}</span>. سيُفعّل بعد التحقق.
        </p>

        <form action={addCustomDomain} className="flex flex-wrap items-center gap-2">
          <Input name="domain" placeholder="shop.example.com" dir="ltr" className="max-w-[260px]" />
          <Button type="submit" size="sm">إضافة</Button>
        </form>

        {domains.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm" dir="ltr">{d.domain}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${d.verifiedAt ? "text-green-600" : "text-[var(--muted)]"}`}>
                    {d.verifiedAt ? "موثّق" : "بانتظار التحقق"}
                  </span>
                  <form action={deleteDomain}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="text-xs text-red-600 hover:underline">حذف</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
