import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { enqueueFullCatalog, lastMerchantSync, listMerchantIssues, merchantConfig, merchantHealth, summarizeChecks, verifyMerchantLink } from "@/modules/feeds";
import { storeOrigin } from "@/modules/stores";
import {
  type Platform,
  PLATFORM_DEFS,
  listFailedEvents,
  listIntegrations,
  platformActivity,
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
import { relativeTime } from "@/lib/format-time";
import { PlatformIcon, GoogleMark } from "@/components/admin/platform-icon";

export const metadata = { title: "التكاملات والتتبّع" };

const PATH = "/admin/settings/integrations";

/** رموز المجموعات: بوق للإعلان، مخطط للتحليلات، وشعار جوجل. */
const GROUP_ICONS = {
  ads: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />
    </svg>
  ),
  google: <GoogleMark />,
} as const;

/** المنصات مجمّعة بحسب دورها؛ كل مجموعة قائمة مطوية لا صفحة طويلة. */
const GROUPS: { title: string; note: string; icon: keyof typeof GROUP_ICONS; platforms: Platform[] }[] = [
  {
    title: "منصات الإعلان",
    note: "ربط متجرك بمنصات الإعلانات: بكسل في المتصفح وإرسال سيرفري بنفس event_id لإزالة التكرار.",
    icon: "ads",
    platforms: ["meta", "tiktok", "snapchat"],
  },
  {
    title: "التحليلات",
    note: "متابعة أداء متجرك وسلوك العملاء. لا تحتاج موافقة تسويقية.",
    icon: "analytics",
    platforms: ["ga4", "clarity"],
  },
  {
    title: "جوجل: البحث والتسوّق",
    note: "تحسين ظهور متجرك في نتائج البحث ودفع الكتالوج إلى إعلانات التسوّق.",
    icon: "google",
    platforms: ["google", "merchant"],
  },
];

/** سهم يشير إلى بداية السطر وهو مطوي، وينقلب لأسفل عند الفتح. */
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 rotate-90 text-ink-secondary transition-transform group-open:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** إحصاءة واحدة في بطاقة نقاط الأحداث: نقطة ملوّنة + وصف + رقم. */
function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "busy" | "bad" }) {
  const dot = tone === "ok" ? "bg-[var(--color-success)]" : tone === "busy" ? "bg-brand" : "bg-[var(--color-error)]";
  return (
    <div className="min-w-0 flex-1 px-2 text-center sm:px-4">
      <div className="flex items-center justify-center gap-1.5 text-xs text-ink-secondary">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="whitespace-nowrap">{label}</span>
      </div>
      <div className="mt-0.5 text-lg font-bold sm:text-xl" dir="ltr">{value}</div>
    </div>
  );
}

/**
 * ثلاث حالات فقط أمام التاجر: يحتاج إعداد · يعمل · يحتاج انتباه.
 * ما تحته من تفاصيل تقنية (طابور، محاولات، أخطاء المنصة) يظهر عند فتح الصف —
 * الصفحة لوحة تاجر لا لوحة مراقبة تشغيل.
 */
function rowState(input: { enabled: boolean; hasData: boolean; failed: number; needsReview: number }) {
  if (input.enabled && (input.failed > 0 || input.needsReview > 0)) {
    return {
      label: "يحتاج انتباه",
      sub: input.needsReview > 0 ? `${input.needsReview} منتجاً بحاجة مراجعة` : `${input.failed} محاولة إرسال فاشلة`,
      chip: "bg-[var(--accent-container)] text-[var(--accent-container-text)]",
      dot: "bg-[var(--color-warning)]",
      dimmed: false,
    };
  }
  if (input.enabled) {
    return { label: "متصل", sub: "يعمل بشكل طبيعي", chip: "bg-[var(--success-container)] text-[var(--success-container-text)]", dot: "bg-[var(--color-success)]", dimmed: false };
  }
  return {
    label: "غير متصل",
    sub: input.hasData ? "مضبوط لكنه متوقف" : "يحتاج إعداد",
    chip: "bg-surface-muted text-ink-secondary",
    dot: "bg-[var(--text-disabled)]",
    dimmed: true,
  };
}

/** شارة محايدة: الحالة غير المفعّلة ليست تحذيراً، فلا تأخذ لون تنبيه. */
function MutedChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-secondary">{children}</span>;
}

const MINUTES = 60 * 1000;

/**
 * صفحة إعدادات واحدة لكل التكاملات. التوكنات تُشفَّر في القاعدة
 * ولا تعود للواجهة إلا مقنّعة (آخر ٤ خانات).
 */
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; verify?: string }> }) {
  const ctx = await getAdminContext();
  const [integrations, health, failed, merchant, merchantState, merchantIssues, origin, activity, merchantSyncedAt] = await Promise.all([
    listIntegrations(ctx.storeId),
    trackingHealth(ctx.storeId),
    listFailedEvents(ctx.storeId, 20),
    merchantConfig(ctx.storeId),
    merchantHealth(ctx.storeId),
    listMerchantIssues(ctx.storeId, 20),
    storeOrigin(ctx.storeId),
    platformActivity(ctx.storeId),
    lastMerchantSync(ctx.storeId),
  ]);
  const { error, ok, verify } = await searchParams;
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

  async function verifyLink() {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    let summary: string | null = null;
    try {
      const result = await verifyMerchantLink(c);
      summary = summarizeChecks(result);
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر التحقق من الربط";
    }
    redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?verify=${encodeURIComponent(summary ?? "")}`);
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

  const platformRow = (platform: Platform) => {
    const def = PLATFORM_DEFS[platform];
    const current = byPlatform.get(platform);
    // قيمة فارغة محفوظة ليست ضبطاً.
    const hasData = Object.values(current?.config ?? {}).some((v) => v.trim().length > 0);
    const enabled = current?.enabled ?? false;
    const stats = activity[platform];
    const needsReview = platform === "merchant" ? merchantState.disapproved + merchantState.failed : 0;
    const state = rowState({ enabled, hasData, failed: stats?.failed ?? 0, needsReview });
    // آخر نشاط: مزامنة الكتالوج لـ Merchant Center، وآخر إرسال ناجح لما عداه.
    const lastActivity = relativeTime(platform === "merchant" ? merchantSyncedAt : (stats?.lastSentAt ?? null));

    return (
      <details key={platform} className="group border-b border-border last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
          <PlatformIcon platform={platform} dimmed={state.dimmed} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{def.label}</span>
            <span className="line-clamp-2 text-xs leading-5 text-ink-secondary">{def.note}</span>
          </span>
          <span className="shrink-0 text-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${state.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
              {state.label}
            </span>
            <span className="mt-1 hidden text-[11px] text-ink-secondary sm:block">
              {lastActivity && enabled ? `آخر نشاط ${lastActivity}` : state.sub}
            </span>
          </span>
          <Chevron />
        </summary>

        <div className="space-y-3 pb-4 sm:ps-14">
          <form action={save} className="space-y-3">
            <input type="hidden" name="platform" value={platform} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5" />
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
              <p className="text-xs leading-5 text-ink-secondary">
                الرفع الأولي مرة واحدة، ثم كل تغيير على منتج أو مخزونه يُزامَن خلال دقيقة،
                والمطابقة الليلية تعيد الرفع قبل انتهاء الصلاحية عند جوجل.
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={uploadCatalog}>
                  <Button type="submit" variant="secondary">رفع الكتالوج كاملاً</Button>
                </form>
                <form action={verifyLink}>
                  <Button type="submit" variant="outline">التحقق من الربط</Button>
                </form>
              </div>

              {/* نتيجة التحقق: كل حلقة على حدة. نجاح OAuth وحده لا يعني أن
                  Merchant Center يعمل، فلا نكتفي بـ «تم الاتصال بنجاح». */}
              {verify && (
                <ul className="space-y-1 rounded-card border border-border bg-surface-muted p-3 text-xs leading-6">
                  {verify.split(" · ").map((line) => {
                    const failed = line.startsWith("✕");
                    const warned = line.startsWith("!");
                    return (
                      <li key={line} className={failed ? "text-[var(--color-error)]" : warned ? "text-[var(--color-warning)]" : "text-ink"}>
                        {line}
                      </li>
                    );
                  })}
                </ul>
              )}

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
    <div className="mx-auto max-w-3xl space-y-5">
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

      {/* نبض الطابور: ما أُرسل، ما ينتظر، وما فشل. */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-container)] text-[var(--brand-container-text)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12h3.5l2-6 3.5 12 2.5-8 1.5 2H21" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="font-semibold">نقاط الأحداث</div>
            <div className="text-xs text-ink-secondary">أحداث التتبّع المرسلة إلى كل المنصات</div>
          </div>
        </div>
        <div className="flex items-stretch divide-x divide-x-reverse divide-border border-t border-border pt-3 sm:ms-auto sm:border-0 sm:pt-0">
          <Stat label="مكتملة" value={health.sent} tone="ok" />
          <Stat label="قيد المعالجة" value={health.pending} tone="busy" />
          <Stat label="فاشلة" value={health.failed + health.partial} tone="bad" />
        </div>
      </Card>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <div className="flex items-center gap-2">
            {GROUP_ICONS[group.icon]}
            <h2 className="font-semibold">{group.title}</h2>
          </div>
          <p className="text-xs leading-5 text-ink-secondary">{group.note}</p>
          <Card className="py-0">{group.platforms.map(platformRow)}</Card>
        </section>
      ))}

      <Card className="py-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-secondary">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 7.5h18v12H3z" />
                <path d="m3 8 9 6.5L21 8" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">سجل الإرسال الفاشل</span>
              <span className="line-clamp-2 text-xs leading-5 text-ink-secondary">المحاولات التي لم تصل إلى المنصات، مع سببها وإعادة المحاولة يدوياً.</span>
            </span>
            {failed.length > 0 ? <Badge variant="error">{failed.length}</Badge> : <MutedChip>0</MutedChip>}
            <Chevron />
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
