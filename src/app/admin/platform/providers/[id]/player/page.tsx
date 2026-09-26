import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/core/errors";
import type { ProviderStatus } from "@/core/state-machines";
import { PROVIDER_STATUS_LABELS } from "@/modules/providers";
import { createActivationCode, createProviderServer, deleteProviderServer, getPlayerSettings, revokeActivationCode, updateProviderServer } from "@/modules/player";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Flash, PlatformDenied, STATUS_VARIANT, errorMessage, formatDate, platformContext, requireActor, selectClass, withFlash } from "../../shared";

/** ينفّذ إجراء الصفحة ثم يعيد التوجيه برسالة نجاح (أو نص يعيده الإجراء) أو خطأ. */
async function runAction(path: string, action: (form: FormData) => Promise<unknown>, form: FormData, failure: string, success: string) {
  let msg: string | null = null;
  let okMsg = success;
  try {
    const result = await action(form);
    if (typeof result === "string") okMsg = result;
  } catch (e) {
    msg = errorMessage(e, failure);
  }
  revalidatePath(path);
  redirect(withFlash(path, msg, okMsg));
}

function serverInput(f: FormData) {
  return { label: f.get("label"), baseUrl: f.get("baseUrl"), prefixes: String(f.get("prefixes") ?? ""), isActive: f.get("isActive") === "on" };
}

const pathFor = (providerId: string) => `/admin/platform/providers/${providerId}/player`;
const providerOf = (f: FormData) => String(f.get("providerId") ?? "");

// إجراءات على مستوى الملف (لا closures): المعرّف من حقل مخفي، والصلاحية من requireActor في كل إجراء.
async function addServer(formData: FormData) {
  "use server";
  const id = providerOf(formData);
  await runAction(pathFor(id), async (f) => createProviderServer(id, serverInput(f), await requireActor()), formData, "تعذّر إضافة الخادم", "أُضيف الخادم.");
}

async function saveServer(formData: FormData) {
  "use server";
  await runAction(pathFor(providerOf(formData)), async (f) => updateProviderServer(String(f.get("serverId")), serverInput(f), await requireActor()), formData, "تعذّر حفظ الخادم", "حُفظ الخادم.");
}

async function removeServer(formData: FormData) {
  "use server";
  await runAction(pathFor(providerOf(formData)), async (f) => deleteProviderServer(String(f.get("serverId")), await requireActor()), formData, "تعذّر حذف الخادم", "حُذف الخادم وأكواده.");
}

async function issueCode(formData: FormData) {
  "use server";
  await runAction(
    pathFor(providerOf(formData)),
    async (f) => {
      const row = await createActivationCode(
        { serverId: f.get("serverId"), username: f.get("username"), password: f.get("password"), expiresAt: f.get("expiresAt"), note: f.get("note") },
        await requireActor(),
      );
      return `صدر الكود ${row.code} — سلّمه للمشترك.`;
    },
    formData,
    "تعذّر إصدار الكود",
    "صدر الكود.",
  );
}

async function revokeCode(formData: FormData) {
  "use server";
  await runAction(pathFor(providerOf(formData)), async (f) => revokeActivationCode(String(f.get("codeId")), await requireActor()), formData, "تعذّر إلغاء الكود", "أُلغي الكود.");
}

/**
 * إعدادات تطبيق المشغّل لمزوّد واحد: خوادم Xtream وبادئات أسماء المستخدمين (للتعرّف التلقائي)،
 * وأكواد التفعيل SN-XXXX-XXXX. لا يستخدمها التطبيق إلا بعد قبول المزوّد.
 */
export default async function ProviderPlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string; q?: string | string[] }> }) {
  if (!(await platformContext())) return <PlatformDenied title="تطبيق المشغّل" />;

  const { id } = await params;
  const sp = await searchParams;
  const { error, ok } = sp;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";

  let settings;
  try {
    settings = await getPlayerSettings(id, { q });
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { provider, servers, codes, codeCounts, codesLimited } = settings;
  const status = provider.status as ProviderStatus;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={`تطبيق المشغّل: ${provider.name}`}
        action={<Link href={`/admin/platform/providers/${id}`} className={buttonClasses({ variant: "outline", size: "sm" })}>صفحة المزوّد</Link>}
      />
      <Flash error={error} ok={ok} />

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[status]}>{PROVIDER_STATUS_LABELS[status]}</Badge>
          <span className="text-sm text-ink-secondary">{servers.length} خادم · {codeCounts.usable} كود صالح من {codeCounts.total}</span>
        </div>
        <p className="text-sm text-ink-secondary">
          يتعرّف التطبيق على المزوّد من أول حروف اسم المستخدم (البادئة) ويتصل بخادمه مباشرة. كود التفعيل يغني المشترك عن كتابة اسم المستخدم وكلمة المرور.
        </p>
        {status !== "approved" && <Alert variant="warning">لن يتعرّف التطبيق على هذا المزوّد ولن تعمل أكواده قبل قبوله وتفعيله.</Alert>}
      </Card>

      <section className="space-y-3" aria-labelledby="servers-h">
        <h2 id="servers-h" className="font-semibold">الخوادم والبادئات</h2>
        {servers.map((s) => (
          <Card key={s.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 font-medium">{s.label}</h3>
              <Badge variant={s.isActive ? "success" : "default"}>{s.isActive ? "مفعّل" : "معطّل"}</Badge>
            </div>
            <form action={saveServer} className="space-y-3">
              <input type="hidden" name="providerId" value={id} />
              <input type="hidden" name="serverId" value={s.id} />
              <ServerFields idPrefix={s.id} label={s.label} baseUrl={s.baseUrl} prefixes={s.prefixes.join(", ")} isActive={s.isActive} />
              <Button type="submit" size="sm" variant="secondary">حفظ</Button>
            </form>
            <form action={removeServer}>
              <input type="hidden" name="providerId" value={id} />
              <input type="hidden" name="serverId" value={s.id} />
              <Button type="submit" size="sm" variant="ghost">حذف الخادم وأكواده</Button>
            </form>
          </Card>
        ))}
        <Card className="space-y-3">
          <h3 className="font-medium">إضافة خادم</h3>
          <form action={addServer} className="space-y-3">
            <input type="hidden" name="providerId" value={id} />
            <ServerFields idPrefix="new" isActive />
            <Button type="submit" size="sm">إضافة</Button>
          </form>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="codes-h">
        <h2 id="codes-h" className="font-semibold">أكواد التفعيل</h2>
        {servers.length === 0 ? (
          <Card className="text-sm text-ink-secondary">أضف خادماً أولاً لإصدار الأكواد.</Card>
        ) : (
          <Card className="space-y-3">
            <h3 className="font-medium">إصدار كود</h3>
            <form action={issueCode} className="space-y-3">
              <input type="hidden" name="providerId" value={id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="code-server" className="text-sm font-medium">الخادم</label>
                  <select id="code-server" name="serverId" className={selectClass} required>
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="code-exp" className="text-sm font-medium">ينتهي في (اختياري)</label>
                  <Input id="code-exp" name="expiresAt" type="date" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="code-user" className="text-sm font-medium">اسم المستخدم</label>
                  <Input id="code-user" name="username" required dir="ltr" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="code-pass" className="text-sm font-medium">كلمة المرور</label>
                  <Input id="code-pass" name="password" required dir="ltr" autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="code-note" className="text-sm font-medium">ملاحظة (اختياري)</label>
                <Input id="code-note" name="note" placeholder="مثال: طلب رقم 1042" />
              </div>
              <Button type="submit" size="sm">إصدار</Button>
            </form>
          </Card>
        )}

        {codeCounts.total > 0 && (
          <form method="get" className="flex gap-2" role="search">
            <label htmlFor="code-q" className="sr-only">ابحث بالكود أو اسم المستخدم</label>
            <Input id="code-q" name="q" defaultValue={q} dir="ltr" placeholder="SN-… أو اسم المستخدم" className="flex-1" />
            <Button type="submit" size="sm" variant="secondary">بحث</Button>
            {q && <Link href={`/admin/platform/providers/${id}/player`} className={buttonClasses({ variant: "ghost", size: "sm" })}>الكل</Link>}
          </form>
        )}
        {q && codes.length === 0 && <Card className="text-sm text-ink-secondary">لا أكواد تطابق «{q}».</Card>}
        {codesLimited && <p className="text-xs text-ink-secondary">تظهر أحدث {codes.length} نتيجة؛ ابحث بالكود أو اسم المستخدم للوصول إلى الأقدم.</p>}
        {codes.length > 0 && (
          <ul className="space-y-2">
            {codes.map((c) => (
              <li key={c.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-mono font-semibold" dir="ltr">{c.code}</span>
                    <Badge variant={codeVariant(c)}>{codeLabel(c)}</Badge>
                  </div>
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2"><dt className="text-ink-secondary">المستخدم:</dt><dd dir="ltr">{c.username}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-secondary">الخادم:</dt><dd>{c.serverLabel}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-secondary">الاستخدام:</dt><dd>{c.redemptionCount} مرة{c.lastRedeemedAt ? ` · آخرها ${formatDate(c.lastRedeemedAt)}` : ""}</dd></div>
                    <div className="flex gap-2"><dt className="text-ink-secondary">الانتهاء:</dt><dd>{c.expiresAt ? formatDate(c.expiresAt) : "بلا انتهاء"}</dd></div>
                  </dl>
                  {c.note && <p className="text-sm text-ink-secondary">{c.note}</p>}
                  {c.status === "active" && (
                    <form action={revokeCode}>
                      <input type="hidden" name="providerId" value={id} />
                      <input type="hidden" name="codeId" value={c.id} />
                      <Button type="submit" size="sm" variant="ghost">إلغاء الكود</Button>
                    </form>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type CodeRow = { status: string; expiresAt: Date | null; serverActive: boolean };

function codeExpired(c: CodeRow) {
  return c.expiresAt !== null && c.expiresAt.getTime() <= Date.now();
}

function codeLabel(c: CodeRow) {
  if (c.status === "revoked") return "ملغى";
  if (codeExpired(c)) return "منتهٍ";
  return c.serverActive ? "فعّال" : "خادمه معطّل";
}

function codeVariant(c: CodeRow) {
  if (c.status === "revoked" || codeExpired(c)) return "error" as const;
  return c.serverActive ? ("success" as const) : ("warning" as const);
}

function ServerFields({ idPrefix, label, baseUrl, prefixes, isActive }: { idPrefix: string; label?: string; baseUrl?: string; prefixes?: string; isActive?: boolean }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-label`} className="text-sm font-medium">الاسم الظاهر</label>
          <Input id={`${idPrefix}-label`} name="label" required defaultValue={label} placeholder="الخادم A" />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-url`} className="text-sm font-medium">رابط الخادم</label>
          <Input id={`${idPrefix}-url`} name="baseUrl" required dir="ltr" defaultValue={baseUrl} placeholder="http://host:8080" />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-prefixes`} className="text-sm font-medium">بادئات أسماء المستخدمين</label>
        <Input id={`${idPrefix}-prefixes`} name="prefixes" required dir="ltr" defaultValue={prefixes} placeholder="394, 3950" />
        <p className="text-xs text-ink-secondary">مفصولة بفاصلة. أطول بادئة مطابقة تحدد الخادم، ولا تتكرر بادئة بين خادمين.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="size-4" />
        مفعّل في التطبيق
      </label>
    </>
  );
}
