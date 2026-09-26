import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NotFoundError } from "@/core/errors";
import type { ProviderStatus } from "@/core/state-machines";
import {
  changeProviderStatus,
  getProviderReview,
  reviewSubmission,
  ITEM_STATE_LABELS,
  PROVIDER_STATUS_LABELS,
  PROVIDER_TRANSITION_LABELS,
  REQUIREMENT_KIND_LABELS,
  SUBMISSION_STATUS_LABELS,
  type SubmissionStatus,
} from "@/modules/providers";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Flash, ITEM_VARIANT, PlatformDenied, STATUS_VARIANT, errorMessage, formatDate, platformContext, requireActor, selectClass, withFlash } from "../shared";

const SUBMISSION_STATUSES: SubmissionStatus[] = ["missing", "submitted", "accepted", "rejected"];

/** مراجعة مزوّد واحد: الشروط بنداً بنداً، ثم القبول أو الرفض أو الإيقاف. */
export default async function ProviderReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!(await platformContext())) return <PlatformDenied title="مراجعة مزوّد" />;

  const { id } = await params;
  const { error, ok } = await searchParams;
  const path = `/admin/platform/providers/${id}`;

  let review;
  try {
    review = await getProviderReview(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { provider, readiness, rows, nextStates, history } = review;
  const status = provider.status as ProviderStatus;

  async function saveItem(formData: FormData) {
    "use server";
    let msg: string | null = null;
    let suspended = false;
    try {
      const actor = await requireActor();
      const result = await reviewSubmission(id, String(formData.get("requirementId")), {
        status: formData.get("status"),
        reference: formData.get("reference"),
        expiresAt: formData.get("expiresAt"),
        note: formData.get("note"),
      }, actor);
      suspended = result.suspended;
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ المراجعة");
    }
    revalidatePath(path);
    revalidatePath("/admin/platform/providers");
    redirect(withFlash(path, msg, suspended ? "حُفظت المراجعة، وأُوقف المزوّد لأن شرطاً مطلوباً لم يعد مستوفى." : "حُفظت المراجعة."));
  }

  async function moveTo(formData: FormData) {
    "use server";
    let msg: string | null = null;
    try {
      const actor = await requireActor();
      await changeProviderStatus(id, { to: formData.get("to"), reason: formData.get("reason") }, actor);
    } catch (e) {
      msg = errorMessage(e, "تعذّر تغيير الحالة");
    }
    revalidatePath(path);
    revalidatePath("/admin/platform/providers");
    redirect(withFlash(path, msg, "تم تحديث حالة المزوّد."));
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={provider.name}
        action={<Link href="/admin/platform/providers" className={buttonClasses({ variant: "outline", size: "sm" })}>كل المزوّدين</Link>}
      />
      <Flash error={error} ok={ok} />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[status]}>{PROVIDER_STATUS_LABELS[status]}</Badge>
          <span className="text-sm text-ink-secondary">الشروط المطلوبة: {readiness.doneCount} من {readiness.requiredCount}</span>
        </div>
        {provider.statusReason && <p className="text-sm text-ink-secondary">السبب: {provider.statusReason}</p>}
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <Info label="الاسم القانوني" value={provider.legalName} />
          <Info label="السجل التجاري" value={provider.crNumber} ltr />
          <Info label="المسؤول" value={provider.contactName} />
          <Info label="الإيميل" value={provider.contactEmail} ltr />
          <Info label="الجوال" value={provider.contactPhone} ltr />
          <Info label="تاريخ التفعيل" value={provider.approvedAt ? formatDate(provider.approvedAt) : null} />
        </dl>
      </Card>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1">
          <h2 className="font-semibold">تطبيق المشغّل</h2>
          <p className="text-sm text-ink-secondary">خوادم المزوّد وبادئات أسماء المستخدمين للتعرّف التلقائي، وأكواد التفعيل.</p>
        </div>
        <Link href={`${path}/player`} className={buttonClasses({ variant: "secondary", size: "sm" })}>الخوادم والأكواد</Link>
      </Card>

      {nextStates.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-semibold">القرار</h2>
          {nextStates.includes("approved") && !readiness.ready && (
            <Alert variant="warning">لا يمكن القبول قبل استيفاء: {readiness.blocking.map((b) => b.title).join("، ")}</Alert>
          )}
          <div className="space-y-2">
            {nextStates.map((to) => {
              const needsReason = to === "rejected" || to === "suspended";
              const blocked = to === "approved" && !readiness.ready;
              return (
                <form key={to} action={moveTo} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="hidden" name="to" value={to} />
                  <label htmlFor={`reason-${to}`} className="sr-only">سبب {PROVIDER_TRANSITION_LABELS[to]}</label>
                  <Input id={`reason-${to}`} name="reason" required={needsReason} placeholder={needsReason ? "السبب (مطلوب)" : "ملاحظة (اختياري)"} className="sm:flex-1" />
                  <Button type="submit" size="sm" variant={to === "approved" ? "primary" : "outline"} disabled={blocked}>{PROVIDER_TRANSITION_LABELS[to]}</Button>
                </form>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">الشروط</h2>
          <Link href="/admin/platform/providers/requirements" className="text-sm text-brand">تعديل الشروط</Link>
        </div>
        {rows.map(({ requirement: r, submission: s, state }) => (
          <Card key={r.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 font-medium">{r.title}</h3>
              <Badge>{REQUIREMENT_KIND_LABELS[r.kind as keyof typeof REQUIREMENT_KIND_LABELS] ?? r.kind}</Badge>
              {!r.isRequired && <Badge>اختياري</Badge>}
              <Badge variant={ITEM_VARIANT[state]}>{ITEM_STATE_LABELS[state]}</Badge>
            </div>
            {r.description && <p className="text-sm text-ink-secondary">{r.description}</p>}
            {s?.reviewedAt && (
              <p className="text-xs text-ink-secondary">
                آخر مراجعة: <span dir="ltr">{s.reviewedBy}</span> · {formatDate(s.reviewedAt)}
                {s.expiresAt && <> · ينتهي {formatDate(s.expiresAt)}</>}
              </p>
            )}
            <form action={saveItem} className="space-y-3">
              <input type="hidden" name="requirementId" value={r.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={`status-${r.id}`} className="text-sm font-medium">النتيجة</label>
                  <select id={`status-${r.id}`} name="status" defaultValue={s?.status ?? "missing"} className={selectClass}>
                    {SUBMISSION_STATUSES.map((st) => (
                      <option key={st} value={st}>{SUBMISSION_STATUS_LABELS[st]}</option>
                    ))}
                  </select>
                </div>
                {r.hasExpiry && (
                  <div className="space-y-1">
                    <label htmlFor={`exp-${r.id}`} className="text-sm font-medium">تاريخ الانتهاء</label>
                    <Input id={`exp-${r.id}`} name="expiresAt" type="date" dir="ltr" defaultValue={s?.expiresAt ? s.expiresAt.toISOString().slice(0, 10) : undefined} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor={`ref-${r.id}`} className="text-sm font-medium">المرجع</label>
                <Input id={`ref-${r.id}`} name="reference" defaultValue={s?.reference ?? undefined} placeholder="رقم المستند أو رابط الملف" />
              </div>
              <div className="space-y-1">
                <label htmlFor={`note-${r.id}`} className="text-sm font-medium">ملاحظة المراجع</label>
                <Input id={`note-${r.id}`} name="note" defaultValue={s?.reviewerNote ?? undefined} placeholder="مثال: تم التأكد هاتفياً مع قسم الحقوق" />
              </div>
              <Button type="submit" size="sm" variant="secondary">حفظ</Button>
            </form>
          </Card>
        ))}
      </div>

      {history.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">السجل</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-2 text-ink-secondary">
                <span>{formatDate(h.createdAt)}</span>
                <span className="text-ink">{describe(h.action, h.newValues)}</span>
                <span dir="ltr">{String(h.newValues?.by ?? "")}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function describe(action: string, v: Record<string, unknown> | null) {
  const values = v ?? {};
  if (action === "provider.created") return "إضافة المزوّد";
  if (action === "provider.status_changed") {
    const to = values.status as ProviderStatus;
    return `الحالة: ${PROVIDER_STATUS_LABELS[to] ?? to}${values.reason ? ` (${values.reason})` : ""}`;
  }
  if (action === "provider.requirement_reviewed") {
    const st = values.status as SubmissionStatus;
    return `${values.requirement}: ${SUBMISSION_STATUS_LABELS[st] ?? st}`;
  }
  if (action === "player.server_created") return `إضافة خادم المشغّل: ${values.label}`;
  if (action === "player.server_updated") return `تعديل خادم المشغّل: ${values.label}`;
  if (action === "player.server_deleted") return `حذف خادم المشغّل: ${values.label}`;
  if (action === "player.code_created") return `إصدار كود تفعيل ${values.code}`;
  if (action === "player.code_revoked") return `إلغاء كود التفعيل ${values.code}`;
  return action;
}

function Info({ label, value, ltr }: { label: string; value: string | null; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-secondary">{label}:</dt>
      <dd dir={ltr && value ? "ltr" : undefined}>{value || "—"}</dd>
    </div>
  );
}
