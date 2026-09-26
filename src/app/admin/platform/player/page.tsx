import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import type { ProviderStatus } from "@/core/state-machines";
import { PROVIDER_STATUS_LABELS } from "@/modules/providers";
import { ACTIVITY_LABELS, DOWNLOADS_PATH, PLATFORM_TZ, createActivationCode, getPlayerDashboard, readAppDownloads, type PlayerDashboard } from "@/modules/player";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Flash, PlatformDenied, STATUS_VARIANT, errorMessage, platformContext, requireActor, selectClass, withFlash } from "../providers/shared";

const PATH = "/admin/platform/player";

/** إصدار كود سريع من اللوحة لأي خادم مفعّل لمزوّد مقبول. */
async function issueCode(formData: FormData) {
  "use server";
  let msg: string | null = null;
  let ok = "صدر الكود.";
  try {
    const row = await createActivationCode(
      { serverId: formData.get("serverId"), username: formData.get("username"), password: formData.get("password"), expiresAt: formData.get("expiresAt"), note: formData.get("note") },
      await requireActor(),
    );
    ok = `صدر الكود ${row.code} — سلّمه للمشترك.`;
  } catch (e) {
    msg = errorMessage(e, "تعذّر إصدار الكود");
  }
  revalidatePath(PATH);
  redirect(withFlash(PATH, msg, ok));
}

const dateTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: PLATFORM_TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "UTC", day: "numeric", month: "short" });

function when(d: Date | null) {
  return d ? dateTime.format(d) : "—";
}

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * لوحة تطبيق المشغّل (Ssouq Net) لمدير المنصة: هل التطبيق جاهز للمشتركين، من يستخدمه،
 * وما يلزم لإصلاحه، مع إصدار الأكواد وروابط تنزيل التطبيق.
 */
export default async function PlayerDashboardPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!(await platformContext())) return <PlatformDenied title="تطبيق المشغّل" />;
  const { error, ok } = await searchParams;
  const [data, downloads] = await Promise.all([getPlayerDashboard(), readAppDownloads()]);
  const { kpis } = data;
  const site = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const apkUrl = downloads?.files.android ? `${site}${DOWNLOADS_PATH}/${downloads.files.android.file}` : null;
  const apkQr = apkUrl ? await QRCode.toDataURL(apkUrl, { margin: 1, width: 240 }) : null;

  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader
        title="تطبيق المشغّل Ssouq Net"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/platform/providers" className={buttonClasses({ variant: "outline", size: "sm" })}>مزوّدو المحتوى</Link>
            <Link href="/admin/platform/providers/requirements" className={buttonClasses({ variant: "ghost", size: "sm" })}>شروط القبول</Link>
          </div>
        }
      />
      <Flash error={error} ok={ok} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="مزوّدون في التطبيق" value={kpis.liveProviders} hint={`${kpis.approvedProviders} مقبول · ${kpis.awaitingReview} بانتظار المراجعة`} href="/admin/platform/providers" />
        <Kpi label="خوادم مفعّلة" value={kpis.activeServers} hint={`${kpis.prefixes} بادئة للتعرّف التلقائي`} />
        <Kpi label="أكواد تفعيل صالحة" value={kpis.activeCodes} hint={`تعمل الآن · من ${kpis.totalCodes} كوداً صادراً`} />
        <Kpi label="دخول عبر المنصة (٧ أيام)" value={kpis.week.total} hint={`${kpis.week.codes} بكود · ${kpis.week.pairings} ربط تلفاز · اليوم ${kpis.today.total}`} />
      </div>

      <Warnings data={data} />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">الدخول عبر المنصة — آخر ١٤ يوماً</h2>
          {kpis.pendingPairings > 0 && <span className="text-sm text-ink-secondary">{kpis.pendingPairings} تلفاز ينتظر الربط الآن</span>}
        </div>
        <ActivityChart daily={data.daily} />
        <p className="text-xs text-ink-secondary">يشمل الدخول بكود التفعيل وربط التلفاز بالجوال. الدخول باسم المستخدم يتحقق منه خادم المزوّد مباشرة فلا يظهر هنا.</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-labelledby="providers-h">
          <h2 id="providers-h" className="font-semibold">المزوّدون</h2>
          {data.providers.length === 0 ? (
            <Card className="text-sm text-ink-secondary">
              لا يوجد مزوّدون بعد. <Link href="/admin/platform/providers" className="text-brand">أضف مزوّداً</Link> ثم اقبله وأضف خادمه.
            </Card>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-card border border-border sm:block">
                <table className="w-full text-right text-sm">
                  <thead className="bg-surface-2 text-ink-secondary">
                    <tr>
                      <th className="p-3 font-medium">المزوّد</th>
                      <th className="p-3 font-medium">الخوادم</th>
                      <th className="p-3 font-medium">البادئات</th>
                      <th className="p-3 font-medium">الأكواد</th>
                      <th className="p-3 font-medium">الاستخدام</th>
                      <th className="p-3 font-medium">آخر نشاط</th>
                      <th className="p-3 font-medium"><span className="sr-only">إدارة</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providers.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3">
                          <div className="font-medium">{p.name}</div>
                          <Badge variant={STATUS_VARIANT[p.status]}>{PROVIDER_STATUS_LABELS[p.status as ProviderStatus]}</Badge>
                        </td>
                        <td className="p-3" dir="ltr">{p.activeServers}/{p.servers}</td>
                        <td className="p-3" dir="ltr">{p.prefixes}</td>
                        <td className="p-3" dir="ltr">{p.activeCodes}/{p.totalCodes}</td>
                        <td className="p-3" dir="ltr">{p.redemptions}</td>
                        <td className="p-3 text-ink-secondary">{when(p.lastActivityAt)}</td>
                        <td className="p-3">
                          <Link href={`/admin/platform/providers/${p.id}/player`} className={buttonClasses({ variant: "secondary", size: "sm" })}>إدارة</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-2 sm:hidden">
                {data.providers.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/platform/providers/${p.id}/player`} className="block rounded-card border border-border bg-surface p-4 shadow-card">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">{p.name}</span>
                        <Badge variant={STATUS_VARIANT[p.status]}>{PROVIDER_STATUS_LABELS[p.status as ProviderStatus]}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-secondary">
                        <span>الخوادم: <span dir="ltr">{p.activeServers}/{p.servers}</span></span>
                        <span>البادئات: <span dir="ltr">{p.prefixes}</span></span>
                        <span>الأكواد: <span dir="ltr">{p.activeCodes}/{p.totalCodes}</span></span>
                        <span>الاستخدام: <span dir="ltr">{p.redemptions}</span></span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="pt-2 font-semibold">آخر العمليات</h2>
          {data.recent.length === 0 ? (
            <Card className="text-sm text-ink-secondary">لم يسجّل أحد الدخول عبر كود أو ربط تلفاز بعد.</Card>
          ) : (
            <Card>
              <ul className="divide-y divide-border text-sm">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Badge>{ACTIVITY_LABELS[r.kind]}</Badge>
                    <Link href={`/admin/platform/providers/${r.providerId}/player`} className="font-medium">{r.providerName}</Link>
                    {r.serverLabel && <span className="text-ink-secondary">{r.serverLabel}</span>}
                    {r.code && <span className="font-mono text-xs text-ink-secondary" dir="ltr">{r.code}</span>}
                    <span className="ms-auto text-xs text-ink-secondary">{when(r.at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold">إصدار كود تفعيل</h2>
            {data.issuableServers.length === 0 ? (
              <p className="text-sm text-ink-secondary">يحتاج مزوّداً مقبولاً له خادم مفعّل.</p>
            ) : (
              <form action={issueCode} className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="q-server" className="text-sm font-medium">الخادم</label>
                  <select id="q-server" name="serverId" className={selectClass} required>
                    {groupByProvider(data.issuableServers).map((g) => (
                      <optgroup key={g.providerId} label={g.providerName}>
                        {g.servers.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-user" className="text-sm font-medium">اسم المستخدم</label>
                  <Input id="q-user" name="username" required dir="ltr" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-pass" className="text-sm font-medium">كلمة المرور</label>
                  <Input id="q-pass" name="password" required dir="ltr" autoComplete="new-password" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-exp" className="text-sm font-medium">ينتهي في (اختياري)</label>
                  <Input id="q-exp" name="expiresAt" type="date" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="q-note" className="text-sm font-medium">ملاحظة (اختياري)</label>
                  <Input id="q-note" name="note" placeholder="مثال: طلب رقم 1042" />
                </div>
                <Button type="submit" size="sm" className="w-full">إصدار</Button>
              </form>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold">تنزيل التطبيق</h2>
            {!downloads ? (
              <p className="text-sm text-ink-secondary">لم تُنشر حزم بعد. راجع «البناء والحزم» في docs/PLAYER.md.</p>
            ) : (
              <>
                <p className="text-sm text-ink-secondary">الإصدار <span dir="ltr">{downloads.version}</span></p>
                {downloads.files.android && apkUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium">{downloads.files.android.label}</span>
                      <span className="text-xs text-ink-secondary" dir="ltr">{megabytes(downloads.files.android.bytes)}</span>
                    </div>
                    <a href={apkUrl} download className={buttonClasses({ size: "sm", className: "w-full" })}>تنزيل APK</a>
                    {apkQr && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={apkQr} alt="رمز QR لتنزيل تطبيق Android" width={120} height={120} className="mx-auto rounded-md bg-surface" />
                    )}
                    <p className="text-xs text-ink-secondary">
                      على Android TV: ثبّت تطبيق Downloader واكتب الرابط <span className="break-all" dir="ltr">{apkUrl}</span>
                    </p>
                  </div>
                )}
                {downloads.files.webos && (
                  <div className="flex items-center gap-2 border-t border-border pt-3">
                    <span className="flex-1 text-sm">{downloads.files.webos.label}</span>
                    <a href={`${DOWNLOADS_PATH}/${downloads.files.webos.file}`} download className={buttonClasses({ variant: "outline", size: "sm" })}>IPK</a>
                  </div>
                )}
                <p className="border-t border-border pt-3 text-xs text-ink-secondary">
                  Samsung (Tizen): الحزمة تحتاج توقيعاً بشهادة Samsung قبل التثبيت أو النشر في متجرها.
                </p>
              </>
            )}
            <p className="text-xs text-ink-secondary">
              صفحة ربط التلفاز للمشتركين: <a href="/player/pair" className="text-brand" dir="ltr">{site}/player/pair</a>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, href }: { label: string; value: number; hint: string; href?: string }) {
  const body = (
    <Card className="h-full">
      <div className="text-2xl font-bold sm:text-3xl" dir="ltr">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-ink-secondary">{hint}</div>
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function Warnings({ data }: { data: PlayerDashboard }) {
  const { approvedWithoutServer, blockedWithCodes, codesOnDisabledServers } = data.warnings;
  if (approvedWithoutServer.length === 0 && blockedWithCodes.length === 0 && codesOnDisabledServers.length === 0) return null;
  return (
    <div className="space-y-2">
      {approvedWithoutServer.length > 0 && (
        <Alert variant="warning">
          مقبول بلا خادم مفعّل، فلا يظهر في التطبيق:{" "}
          {approvedWithoutServer.map((p, i) => (
            <span key={p.id}>
              {i > 0 && "، "}
              <Link href={`/admin/platform/providers/${p.id}/player`} className="underline">{p.name}</Link>
            </span>
          ))}
        </Alert>
      )}
      {blockedWithCodes.length > 0 && (
        <Alert variant="warning">
          أكواد فعّالة لا تعمل لأن مزوّدها غير مقبول:{" "}
          {blockedWithCodes.map((p, i) => (
            <span key={p.id}>
              {i > 0 && "، "}
              <Link href={`/admin/platform/providers/${p.id}`} className="underline">{p.name}</Link> ({p.activeCodes})
            </span>
          ))}
        </Alert>
      )}
      {codesOnDisabledServers.length > 0 && (
        <Alert variant="warning">
          أكواد فعّالة على خادم معطّل لا تعمل حتى تفعيله:{" "}
          {codesOnDisabledServers.map((p, i) => (
            <span key={p.id}>
              {i > 0 && "، "}
              <Link href={`/admin/platform/providers/${p.id}/player`} className="underline">{p.name}</Link> ({p.codesOnDisabledServers})
            </span>
          ))}
        </Alert>
      )}
    </div>
  );
}

/** أعمدة يومية بلون العلامة؛ كل عمود قابل للتركيز ويعرض رقمه، مع جدول مخفي لقارئات الشاشة. */
function ActivityChart({ daily }: { daily: PlayerDashboard["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.total));
  const label = (day: string) => dayLabel.format(new Date(`${day}T00:00:00Z`));
  const dayOfMonth = (day: string) => String(Number(day.slice(8)));
  return (
    <>
      {/* منطقة الرسم منفصلة عن تسميات الأيام حتى تبقى الأطوال متناسبة؛ مساحة علوية للتلميح، وoverflow مخفي للجوال. */}
      <div className="overflow-hidden" aria-hidden="true">
        <div className="flex h-44 items-stretch gap-0.5 pt-8 sm:gap-1">
          {daily.map((d, i) => (
            <div key={d.day} className="group relative min-w-0 flex-1">
              {/* RTL: أول الأيام على اليمين؛ التلميح يُثبَّت نحو الداخل حتى لا يُقص عند الحافتين. */}
              <span className={`pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-surface-inverse px-2 py-1 text-xs text-ink-inverse shadow-card group-hover:block ${i < daily.length / 2 ? "right-0" : "left-0"}`}>
                {label(d.day)}: {d.total} ({d.codes} بكود · {d.pairings} ربط)
              </span>
              <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-brand transition-all" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total > 0 ? "4px" : "0" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5 sm:gap-1">
          {daily.map((d) => (
            <span key={d.day} className="min-w-0 flex-1 truncate text-center text-[10px] text-ink-secondary">
              <span className="sm:hidden">{dayOfMonth(d.day)}</span>
              <span className="hidden sm:inline">{label(d.day)}</span>
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>الدخول عبر المنصة يومياً</caption>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>بكود التفعيل</th>
            <th>ربط تلفاز</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.codes}</td>
              <td>{d.pairings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function groupByProvider(servers: PlayerDashboard["issuableServers"]) {
  const groups = new Map<string, { providerId: string; providerName: string; servers: typeof servers }>();
  for (const s of servers) {
    const g = groups.get(s.providerId) ?? { providerId: s.providerId, providerName: s.providerName, servers: [] };
    g.servers.push(s);
    groups.set(s.providerId, g);
  }
  return [...groups.values()];
}
