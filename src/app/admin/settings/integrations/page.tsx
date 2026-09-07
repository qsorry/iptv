import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { enqueueFullCatalog, listMerchantIssues, merchantConfig, merchantHealth } from "@/modules/feeds";
import {
  PLATFORMS,
  PLATFORM_DEFS,
  listFailedEvents,
  listIntegrations,
  retryTrackingEvent,
  saveIntegration,
  trackingHealth,
} from "@/modules/tracking";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "التكاملات والتتبّع" };

const PATH = "/admin/settings/integrations";

/**
 * صفحة إعدادات واحدة لكل التكاملات. التوكنات تُشفَّر في القاعدة
 * ولا تعود للواجهة إلا مقنّعة (آخر ٤ خانات).
 */
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  const [integrations, health, failed, merchant, merchantState, merchantIssues] = await Promise.all([
    listIntegrations(ctx.storeId),
    trackingHealth(ctx.storeId),
    listFailedEvents(ctx.storeId, 20),
    merchantConfig(ctx.storeId),
    merchantHealth(ctx.storeId),
    listMerchantIssues(ctx.storeId, 20),
  ]);
  const { error, ok } = await searchParams;
  const byPlatform = new Map(integrations.map((i) => [i.platform, i]));

  async function save(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const platform = String(formData.get("platform"));
    const def = PLATFORM_DEFS[platform as keyof typeof PLATFORM_DEFS];
    let msg: string | null = null;
    if (def) {
      const config: Record<string, string> = {};
      for (const f of def.config) config[f.name] = String(formData.get(`config.${f.name}`) ?? "");
      const secrets: Record<string, string> = {};
      for (const f of def.secrets) secrets[f.name] = String(formData.get(`secret.${f.name}`) ?? "");
      try {
        await saveIntegration(c, { platform, enabled: formData.get("enabled") === "on", config, secrets });
      } catch (e) {
        msg = e instanceof AppError ? e.message : "تعذّر حفظ التكامل";
      }
    }
    revalidatePath(PATH);
    redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?ok=1`);
  }

  async function uploadCatalog() {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    let done: string | null = null;
    try {
      const result = await enqueueFullCatalog(c);
      done = `صُفّ ${result.queued} منتجاً${result.removed > 0 ? ` وحُدّد ${result.removed} للحذف` : ""}`;
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر رفع الكتالوج";
    }
    revalidatePath(PATH);
    redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?ok=${encodeURIComponent(done ?? "1")}`);
  }

  async function retry(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    await retryTrackingEvent(c, String(formData.get("id")));
    revalidatePath(PATH);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="التكاملات والتتبّع"
        action={
          <Link href="/admin/settings" className="text-sm text-ink-secondary underline">
            رجوع للإعدادات
          </Link>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {ok && <Alert variant="success">{ok === "1" ? "تم الحفظ" : ok}</Alert>}

      <Card className="space-y-2">
        <h2 className="font-medium">حالة الطابور</h2>
        <p className="text-sm text-ink-secondary">
          الأحداث تُرسل خارج مسار الطلب: تأكيد الطلب لا ينتظر رد أي منصة. يشغّل المجدول
          <code className="mx-1 text-xs" dir="ltr">/api/internal/process-tracking</code>
          كل دقيقة.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge>معلّق: {health.pending}</Badge>
          <Badge variant="success">أُرسل: {health.sent}</Badge>
          <Badge variant="error">فشل نهائياً: {health.failed}</Badge>
          <Badge variant="warning">نجاح جزئي: {health.partial}</Badge>
        </div>
      </Card>

      {PLATFORMS.map((platform) => {
        const def = PLATFORM_DEFS[platform];
        const current = byPlatform.get(platform);
        return (
          <Card key={platform}>
            <form action={save} className="space-y-3">
              <input type="hidden" name="platform" value={platform} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{def.label}</h2>
                  <p className="text-sm text-ink-secondary">{def.note}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="enabled" defaultChecked={current?.enabled} className="h-5 w-5" />
                  مفعّل
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {def.config.map((field) => (
                  <label key={field.name} className="block text-sm">
                    {field.label}
                    <Input name={`config.${field.name}`} dir="ltr" placeholder={field.placeholder} defaultValue={current?.config[field.name] ?? ""} className="mt-1" />
                  </label>
                ))}
                {def.secrets.map((field) => (
                  <label key={field.name} className="block text-sm">
                    {field.label}
                    {field.multiline ? (
                      <Textarea
                        name={`secret.${field.name}`}
                        dir="ltr"
                        rows={4}
                        placeholder={current?.maskedSecrets[field.name] || "الصق محتوى الملف كاملاً"}
                        className="mt-1 font-mono text-sm"
                      />
                    ) : (
                      <Input
                        name={`secret.${field.name}`}
                        dir="ltr"
                        type="password"
                        autoComplete="new-password"
                        placeholder={current?.maskedSecrets[field.name] || "لم يُضبط بعد"}
                        className="mt-1"
                      />
                    )}
                    <span className="mt-1 block text-xs text-ink-secondary">اتركه فارغاً للإبقاء على القيمة المحفوظة.</span>
                  </label>
                ))}
              </div>

              <Button type="submit">حفظ</Button>
            </form>
          </Card>
        );
      })}

      {merchant && (
        <Card className="space-y-3">
          <h2 className="font-medium">مزامنة كتالوج Merchant Center</h2>
          <p className="text-sm text-ink-secondary">
            الرفع الأولي يصفّ الكتالوج كاملاً مرة واحدة، ثم يتكفّل العامل بالباقي: كل تغيير على منتج أو مخزونه
            يُزامَن خلال دقيقة، والمطابقة الليلية تلتقط الانحراف وتعيد رفع ما قارب انتهاء صلاحيته عند جوجل.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge>في الطابور: {merchantState.pending}</Badge>
            <Badge variant="success">مُزامَن: {merchantState.synced}</Badge>
            <Badge variant="warning">مرفوض: {merchantState.disapproved}</Badge>
            <Badge variant="error">فشل: {merchantState.failed}</Badge>
          </div>
          <form action={uploadCatalog}>
            <Button type="submit" variant="secondary">رفع الكتالوج كاملاً</Button>
          </form>

          {merchantIssues.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-ink-secondary">
                  <tr>
                    <th className="p-2 text-start">المنتج</th>
                    <th className="p-2 text-start">الحالة</th>
                    <th className="p-2 text-start">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {merchantIssues.map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="p-2" dir="ltr">{row.offerId}</td>
                      <td className="p-2">{row.status === "disapproved" ? "مرفوض من جوجل" : "فشل الإرسال"}</td>
                      <td className="p-2 text-ink-secondary">
                        {row.issues?.map((i) => i.description).join("، ") || row.lastError || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-medium">سجل الإرسال الفاشل</h2>
        {failed.length === 0 ? (
          <p className="text-sm text-ink-secondary">لا أحداث فاشلة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-start text-xs text-ink-secondary">
                <tr>
                  <th className="p-2 text-start">الحدث</th>
                  <th className="p-2 text-start">المنصات</th>
                  <th className="p-2 text-start">المحاولات</th>
                  <th className="p-2 text-start">السبب</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {failed.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="p-2" dir="ltr">{row.eventName}</td>
                    <td className="p-2" dir="ltr">{row.failedPlatforms.map((p) => p.platform).join("، ") || "—"}</td>
                    <td className="p-2" dir="ltr">{row.attempts}</td>
                    <td className="p-2 text-ink-secondary">{row.lastError ?? "—"}</td>
                    <td className="p-2">
                      <form action={retry}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="secondary" size="sm">إعادة المحاولة</Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
