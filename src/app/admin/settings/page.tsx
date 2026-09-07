import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { updateSubdomain, listDomains, addDomain, removeDomain, updateBranding, updateFooterSettings, readFooterSettings, PAYMENT_METHODS, THEMES, PRODUCT_LAYOUTS, FONTS, ROUNDNESS, updateAppearance, readAppearance, type PaymentMethodId } from "@/modules/stores";
import { stores } from "@/infrastructure/database/schema";
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
  const storeRow = await db.query.stores.findFirst({ where: eq(stores.id, ctx.storeId) });
  const taxPercent = (settingsRow?.settings as Record<string, unknown> | undefined)?.taxPercent ?? 15;
  const vatNumber = (settingsRow?.settings as Record<string, unknown> | undefined)?.vatNumber ?? "";
  const curSettings = (settingsRow?.settings as Record<string, unknown> | undefined) ?? {};
  const appearance = readAppearance(curSettings);
  const curTheme = appearance.theme;
  const curLayout = appearance.productLayout;
  const curFont = appearance.font;
  const curRoundness = appearance.roundness;
  const curBrandFromTheme = appearance.brandFromTheme;
  const curAccent = appearance.themeOverrides["--color-brand-accent"] ?? "";
  const footer = readFooterSettings(curSettings);
  const { error, ok } = await searchParams;
  const scheme = PLATFORM_DOMAIN.includes("localhost") ? "http" : "https";
  const storeUrl = `${scheme}://${PLATFORM_DOMAIN}/s/${ctx.storeSlug}`;

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
    const vatNumber = String(formData.get("vatNumber") || "").trim();
    const row = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, c.storeId) });
    const merged = { ...((row?.settings as Record<string, unknown>) ?? {}), taxPercent: pct, vatNumber };
    await db.update(storeSettings).set({ settings: merged, updatedAt: new Date() }).where(eq(storeSettings.storeId, c.storeId));
    revalidatePath("/admin/settings");
    redirect("/admin/settings?ok=1");
  }

  async function saveBranding(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await updateBranding(c, {
        name: String(formData.get("name")),
        brandColor: String(formData.get("brandColor")),
        logoUrl: String(formData.get("logoUrl") || ""),
        description: String(formData.get("description") || ""),
      });
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ الهوية");
    }
    revalidatePath("/admin/settings");
    redirect(msg ? `/admin/settings?error=${encodeURIComponent(msg)}` : "/admin/settings?ok=1");
  }

  async function saveFooter(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const str = (k: string) => String(formData.get(k) || "").trim();
    let msg: string | null = null;
    try {
      await updateFooterSettings(c, {
        legalName: str("legalName"), phone: str("phone"), whatsapp: str("whatsapp"), email: str("email"), address: str("address"),
        instagram: str("instagram"), snapchat: str("snapchat"), facebook: str("facebook"), twitter: str("twitter"), youtube: str("youtube"),
        commercialNumber: str("commercialNumber"), certificateId: str("certificateId"), certificateImage: str("certificateImage"), certificateUrl: str("certificateUrl"),
        payments: formData.getAll("payments").map(String).filter((p): p is PaymentMethodId => p in PAYMENT_METHODS),
      });
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ بيانات الذيل");
    }
    revalidatePath("/admin/settings");
    redirect(msg ? `/admin/settings?error=${encodeURIComponent(msg)}` : "/admin/settings?ok=1");
  }

  async function saveAppearance(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const storeRow = await db.query.stores.findFirst({ where: eq(stores.id, c.storeId), columns: { brandColor: true } });
    const accent = String(formData.get("accentColor") || "").trim();
    let msg: string | null = null;
    try {
      await updateAppearance(
        c,
        {
          theme: String(formData.get("theme") || ""),
          productLayout: String(formData.get("productLayout") || ""),
          font: String(formData.get("font") || ""),
          roundness: String(formData.get("roundness") || ""),
          brandFromTheme: formData.get("brandFromTheme") === "on",
          themeOverrides: formData.get("useAccent") === "on" && accent ? { "--color-brand-accent": accent } : {},
        },
        storeRow?.brandColor,
      );
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ المظهر");
    }
    revalidatePath("/admin/settings");
    redirect(msg ? `/admin/settings?error=${encodeURIComponent(msg)}` : "/admin/settings?ok=1");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" />

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {ok && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">تم الحفظ.</p>}

      {/* هوية المتجر */}
      <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">هوية المتجر</h2>
      <Card className="mb-8">
        <form action={saveBranding} className="space-y-4">
          <label className="block text-sm">اسم المتجر<Input name="name" defaultValue={storeRow?.name ?? ""} required className="mt-1" /></label>
          <label className="block text-sm">
            لون العلامة
            <div className="mt-1 flex items-center gap-2">
              <input type="color" name="brandColor" defaultValue={storeRow?.brandColor ?? "#004d73"} className="h-10 w-14 rounded border border-[var(--border)]" />
              <span className="text-xs text-[var(--muted)]" dir="ltr">{storeRow?.brandColor}</span>
            </div>
          </label>
          <label className="block text-sm">رابط الشعار (اختياري)<Input name="logoUrl" defaultValue={storeRow?.logoUrl ?? ""} dir="ltr" placeholder="https://.../logo.png" className="mt-1" /></label>
          <label className="block text-sm">وصف المتجر (اختياري)<Input name="description" defaultValue={storeRow?.description ?? ""} className="mt-1" /></label>
          <Button type="submit" size="sm">حفظ الهوية</Button>
        </form>
      </Card>

      {/* المظهر: الثيم وطريقة العرض */}
      <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">مظهر المتجر</h2>
      <Card className="mb-8">
        <form action={saveAppearance} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm">الثيم</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(THEMES).map(([key, t]) => (
                <label key={key} className="cursor-pointer">
                  <input type="radio" name="theme" value={key} defaultChecked={curTheme === key} className="peer sr-only" />
                  <div className="h-full rounded-card border-2 border-border p-2 peer-checked:border-brand">
                    <div className="mb-2 flex h-10 items-end gap-1 rounded-md border border-border p-1.5" style={{ background: t.palette.bg }}>
                      <span className="h-5 flex-1 rounded-sm" style={{ background: t.palette.primary }} />
                      <span className="h-4 w-4 rounded-sm" style={{ background: t.palette.secondary }} />
                      <span className="h-4 w-4 rounded-sm" style={{ background: t.palette.accent }} />
                      <span className="h-4 w-4 rounded-sm border" style={{ background: t.palette.surface, borderColor: t.palette.fg }} />
                    </div>
                    <span className="block text-xs font-medium">{t.name}</span>
                    <span className="block text-[11px] text-muted">{t.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-card border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="brandFromTheme" defaultChecked={curBrandFromTheme} className="h-4 w-4" />
              استخدم ألوان الثيم كما هي (تجاهل لون العلامة من هوية المتجر)
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" name="useAccent" defaultChecked={Boolean(curAccent)} className="h-4 w-4" />
              لون تمييز مخصص (accent)
              <input type="color" name="accentColor" defaultValue={curAccent || "#F59E0B"} className="h-9 w-12 rounded border border-border" />
            </label>
          </div>
          <div>
            <label className="mb-2 block text-sm">الخط</label>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input type="radio" name="font" value="" defaultChecked={!curFont} className="peer sr-only" />
                <span className="inline-block rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]">حسب الثيم</span>
              </label>
              {Object.entries(FONTS).map(([key, f]) => (
                <label key={key} className="cursor-pointer">
                  <input type="radio" name="font" value={key} defaultChecked={curFont === key} className="peer sr-only" />
                  <span className="inline-block rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]" style={{ fontFamily: f.stack }}>{f.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm">استدارة الحواف</label>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input type="radio" name="roundness" value="" defaultChecked={!curRoundness} className="peer sr-only" />
                <span className="inline-block rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]">حسب الثيم</span>
              </label>
              {Object.entries(ROUNDNESS).map(([key, r]) => (
                <label key={key} className="cursor-pointer">
                  <input type="radio" name="roundness" value={key} defaultChecked={curRoundness === key} className="peer sr-only" />
                  <span className="inline-block border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]" style={{ borderRadius: r.radius }}>{r.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm">طريقة عرض المنتجات</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRODUCT_LAYOUTS).map(([key, label]) => (
                <label key={key} className="cursor-pointer">
                  <input type="radio" name="productLayout" value={key} defaultChecked={curLayout === key} className="peer sr-only" />
                  <span className="inline-block rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" size="sm">حفظ المظهر</Button>
        </form>
      </Card>

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
          <label className="block text-sm">
            الرقم الضريبي (للفاتورة)
            <Input name="vatNumber" defaultValue={String(vatNumber)} dir="ltr" className="mt-1 max-w-[240px]" />
          </label>
          <Button type="submit" size="sm">حفظ</Button>
        </form>
      </Card>

      {/* ذيل الصفحة: التواصل والسجلات وطرق الدفع */}
      <h2 className="mb-2 mt-8 text-sm font-semibold text-[var(--muted)]">ذيل الصفحة: التواصل والسجلات النظامية</h2>
      <Card className="mb-8">
        <form action={saveFooter} className="space-y-5">
          <p className="text-xs text-[var(--muted)]">تظهر هذه البيانات في ذيل كل صفحات المتجر. اترك أي حقل فارغاً لإخفائه.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">الاسم النظامي للمنشأة<Input name="legalName" defaultValue={footer.legalName} placeholder="مؤسسة … التجارية" className="mt-1" /></label>
            <label className="block text-sm">العنوان<Input name="address" defaultValue={footer.address} className="mt-1" /></label>
            <label className="block text-sm">الجوال<Input name="phone" defaultValue={footer.phone} dir="ltr" placeholder="+9665xxxxxxxx" className="mt-1" /></label>
            <label className="block text-sm">واتساب<Input name="whatsapp" defaultValue={footer.whatsapp} dir="ltr" placeholder="+9665xxxxxxxx" className="mt-1" /></label>
            <label className="block text-sm sm:col-span-2">البريد الإلكتروني<Input name="email" type="email" defaultValue={footer.email} dir="ltr" className="mt-1" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">إنستغرام<Input name="instagram" defaultValue={footer.instagram} dir="ltr" placeholder="https://instagram.com/…" className="mt-1" /></label>
            <label className="block text-sm">سناب شات<Input name="snapchat" defaultValue={footer.snapchat} dir="ltr" placeholder="https://snapchat.com/add/…" className="mt-1" /></label>
            <label className="block text-sm">فيسبوك<Input name="facebook" defaultValue={footer.facebook} dir="ltr" placeholder="https://facebook.com/…" className="mt-1" /></label>
            <label className="block text-sm">إكس (تويتر)<Input name="twitter" defaultValue={footer.twitter} dir="ltr" placeholder="https://x.com/…" className="mt-1" /></label>
            <label className="block text-sm sm:col-span-2">يوتيوب<Input name="youtube" defaultValue={footer.youtube} dir="ltr" placeholder="https://youtube.com/@…" className="mt-1" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">رقم السجل التجاري<Input name="commercialNumber" defaultValue={footer.commercialNumber} dir="ltr" className="mt-1" /></label>
            <label className="block text-sm">رقم شهادة المركز السعودي للأعمال<Input name="certificateId" defaultValue={footer.certificateId} dir="ltr" className="mt-1" /></label>
            <label className="block text-sm">رابط التحقق من الشهادة<Input name="certificateUrl" defaultValue={footer.certificateUrl} dir="ltr" placeholder="https://eauthenticate.saudibusiness.gov.sa/certificate-details/…" className="mt-1" /></label>
            <label className="block text-sm">صورة الشهادة (رابط)<Input name="certificateImage" defaultValue={footer.certificateImage} dir="ltr" placeholder="/media/store/certificate.jpg" className="mt-1" /></label>
          </div>
          <p className="text-xs text-[var(--muted)]">الرقم الضريبي يُؤخذ من قسم «الضريبة» أعلاه ويظهر في الذيل عند تعبئته.</p>
          <div>
            <span className="mb-2 block text-sm">طرق الدفع المعروضة</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PAYMENT_METHODS).map(([key, pm]) => (
                <label key={key} className="cursor-pointer">
                  <input type="checkbox" name="payments" value={key} defaultChecked={footer.payments.includes(key as PaymentMethodId)} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-[var(--border)] px-3 py-1.5 text-sm peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand)] peer-checked:text-[var(--brand-fg)]">{pm.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" size="sm">حفظ بيانات الذيل</Button>
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
