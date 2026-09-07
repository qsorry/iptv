import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { enqueueFullCatalog, listMerchantIssues, merchantConfig, merchantHealth, storeOrigin } from "@/modules/feeds";
import {
  type Platform,
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
import { CopyField } from "@/components/admin/copy-field";
import { PlatformIcon } from "@/components/admin/platform-icon";

export const metadata = { title: "التكاملات والتتبّع" };

const PATH = "/admin/settings/integrations";

/** المنصات مجمّعة بحسب دورها؛ كل مجموعة قائمة مطوية لا صفحة طويلة. */
const GROUPS: { title: string; note: string; platforms: Platform[] }[] = [
  { title: "منصات الإعلان", note: "بكسل في المتصفح + إرسال سيرفري بنفس event_id لإزالة التكرار.", platforms: ["meta", "tiktok", "snapchat"] },
  { title: "التحليلات", note: "قياس الأداء وسلوك الزوار. لا تحتاج موافقة تسويقية.", platforms: ["ga4", "clarity"] },
  { title: "جوجل: البحث والتسوّق", note: "أرشفة الصفحات ودفع الكتالوج إلى إعلانات التسوّق.", platforms: ["google", "merchant"] },
];

/** شارة محايدة: الحالة غير المفعّلة ليست تحذيراً، فلا تأخذ لون تنبيه. */
function MutedChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-secondary">{children}</span>;
}

/** حالة مختصرة تظهر في رأس القائمة المطوية بلا فتحها. */
function statusChip(enabled: boolean, hasData: boolean) {
  if (enabled) return <Badge variant="success">مفعّل</Badge>;
  return <MutedChip>{hasData ? "معطّل" : "غير مضبوط"}</MutedChip>;
}

const MINUTES = 60 * 1000;

/**
 * صفحة إعدادات واحدة لكل التكاملات. التوكنات تُشفَّر في القاعدة
 * ولا تعود للواجهة إلا مقنّعة (آخر ٤ خانات).
 */
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  const [integrations, health, failed, merchant, merchantState, merchantIssues, origin] = await Promise.all([
    listIntegrations(ctx.storeId),
    trackingHealth(ctx.storeId),
    listFailedEvents(ctx.storeId, 20),
    merchantConfig(ctx.storeId),
    merchantHealth(ctx.storeId),
    listMerchantIssues(ctx.storeId, 20),
    storeOrigin(ctx.storeId),
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

  // أقدم حدث معلّق يتجاوز عشر دقائق = المجدول لا يعمل. بدون هذا التنبيه
  // تبقى الأحداث في الطابور صامتة إلى الأبد بعد نسيان إعداد Cron.
  const stalled = health.oldestPendingAt && Date.now() - health.oldestPendingAt.getTime() > 10 * MINUTES;

  const platformCard = (platform: Platform) => {
    const def = PLATFORM_DEFS[platform];
    const current = byPlatform.get(platform);
    // قيمة فارغة محفوظة ليست ضبطاً.
    const hasData = Object.values(current?.config ?? {}).some((v) => v.trim().length > 0);

    return (
      <details key={platform} className="group border-b border-border last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-button bg-surface-muted text-ink">
            <PlatformIcon platform={platform} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{def.label}</span>
            <span className="line-clamp-2 text-xs text-ink-secondary">{def.note}</span>
          </span>
          {statusChip(current?.enabled ?? false, hasData)}
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div className="space-y-3 pb-4 ps-12">
          <form action={save} className="space-y-3">
            <input type="hidden" name="platform" value={platform} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={current?.enabled} className="h-5 w-5" />
              تفعيل التكامل
            </label>

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
                      placeholder={current?.maskedSecrets[field.name] ? "محفوظ ومشفّر — اتركه فارغاً للإبقاء عليه" : "الصق محتوى الملف كاملاً"}
                      className="mt-1 text-sm"
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
                  {!(field.multiline && current?.maskedSecrets[field.name]) && (
                    <span className="mt-1 block text-xs text-ink-secondary">اتركه فارغاً للإبقاء على القيمة المحفوظة.</span>
                  )}
                </label>
              ))}
            </div>

            {/* الروابط العامة حيث تُلصق فعلاً: خلاصة المنتجات مع كل منصة كتالوج،
                وخريطة الموقع مع Search Console. مشتقة من نطاق المتجر، لا تُحفظ. */}
            {def.links && origin && (
              <div className="space-y-2">
                {def.links.map((link) => (
                  <CopyField key={link.path} value={`${origin}${link.path}`} label={link.label} hint={link.hint} />
                ))}
              </div>
            )}

            <Button type="submit">حفظ</Button>
          </form>

          {/* حالة الكتالوج تخصّ Merchant Center وحده، فمكانها داخل بطاقته. */}
          {platform === "merchant" && merchant && (
            <div className="space-y-3 rounded-card border border-border p-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {merchantState.pending > 0 ? <Badge>في الطابور: {merchantState.pending}</Badge> : <MutedChip>في الطابور: 0</MutedChip>}
                {merchantState.synced > 0 ? <Badge variant="success">مُزامَن: {merchantState.synced}</Badge> : <MutedChip>مُزامَن: 0</MutedChip>}
                {merchantState.disapproved > 0 ? <Badge variant="warning">مرفوض: {merchantState.disapproved}</Badge> : <MutedChip>مرفوض: 0</MutedChip>}
                {merchantState.failed > 0 ? <Badge variant="error">فشل: {merchantState.failed}</Badge> : <MutedChip>فشل: 0</MutedChip>}
              </div>
              <p className="text-xs text-ink-secondary">
                الرفع الأولي مرة واحدة، ثم كل تغيير على منتج أو مخزونه يُزامَن خلال دقيقة،
                والمطابقة الليلية تعيد الرفع قبل انتهاء الصلاحية عند جوجل.
              </p>
              <form action={uploadCatalog}>
                <Button type="submit" variant="secondary">رفع الكتالوج كاملاً</Button>
              </form>

              {merchantIssues.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
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
            </div>
          )}
        </div>
      </details>
    );
  };

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
      {stalled && (
        <Alert variant="error">
          هناك أحداث تنتظر منذ أكثر من عشر دقائق: تأكّد أن المجدول يستدعي
          <code className="mx-1 text-xs" dir="ltr">/api/internal/process-tracking</code>
          كل دقيقة بترويسة <code className="text-xs" dir="ltr">x-cron-secret</code>.
        </Alert>
      )}

      <Card className="flex flex-wrap items-center gap-2">
        <span className="me-auto text-sm font-medium">طابور الأحداث</span>
        {health.pending > 0 ? <Badge>معلّق: {health.pending}</Badge> : <MutedChip>معلّق: 0</MutedChip>}
        {health.sent > 0 ? <Badge variant="success">أُرسل: {health.sent}</Badge> : <MutedChip>أُرسل: 0</MutedChip>}
        {health.partial > 0 ? <Badge variant="warning">جزئي: {health.partial}</Badge> : <MutedChip>جزئي: 0</MutedChip>}
        {health.failed > 0 ? <Badge variant="error">فشل: {health.failed}</Badge> : <MutedChip>فشل: 0</MutedChip>}
      </Card>

      {GROUPS.map((group) => (
        <Card key={group.title} className="py-1">
          <div className="border-b border-border pb-2 pt-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <p className="text-xs text-ink-secondary">{group.note}</p>
          </div>
          {group.platforms.map(platformCard)}
        </Card>
      ))}

      <Card className="py-1">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1 text-sm font-medium">سجل الإرسال الفاشل</span>
            {failed.length > 0 ? <Badge variant="error">{failed.length}</Badge> : <MutedChip>0</MutedChip>}
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-secondary transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="pb-4">
            {failed.length === 0 ? (
              <p className="text-sm text-ink-secondary">لا أحداث فاشلة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs text-ink-secondary">
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
          </div>
        </details>
      </Card>
    </div>
  );
}
