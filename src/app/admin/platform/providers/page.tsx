import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProvider, ensureDefaultRequirements, listProvidersWithReadiness, PROVIDER_STATUS_LABELS } from "@/modules/providers";
import type { ProviderStatus } from "@/core/state-machines";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flash, PlatformDenied, STATUS_VARIANT, errorMessage, platformContext, requireActor, withFlash } from "./shared";

const PATH = "/admin/platform/providers";

/** قائمة مزوّدي المحتوى وحالة اكتمال شروطهم (لمدير المنصة فقط). */
export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!(await platformContext())) return <PlatformDenied title="مزوّدو المحتوى" />;

  await ensureDefaultRequirements();
  const { error, ok } = await searchParams;
  const providers = await listProvidersWithReadiness();

  async function addProvider(formData: FormData) {
    "use server";
    let msg: string | null = null;
    let id: string | null = null;
    try {
      const actor = await requireActor();
      const row = await createProvider(Object.fromEntries(formData), actor);
      id = row.id;
    } catch (e) {
      msg = errorMessage(e, "تعذّر إضافة المزوّد");
    }
    revalidatePath(PATH);
    redirect(id ? `${PATH}/${id}?ok=${encodeURIComponent("أُضيف المزوّد. ابدأ بمراجعة شروطه.")}` : withFlash(PATH, msg, ""));
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="مزوّدو المحتوى"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/platform/providers/requirements" className={buttonClasses({ variant: "outline", size: "sm" })}>شروط القبول</Link>
            <Link href="/admin/platform" className={buttonClasses({ variant: "ghost", size: "sm" })}>باقات المتاجر</Link>
          </div>
        }
      />
      <Flash error={error} ok={ok} />

      <Card>
        <h2 className="mb-3 font-semibold">إضافة مزوّد</h2>
        <form action={addProvider} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="name" label="الاسم التجاري" required />
            <Field id="legalName" label="الاسم القانوني" />
            <Field id="crNumber" label="رقم السجل التجاري" ltr />
            <Field id="contactName" label="اسم المسؤول" />
            <Field id="contactEmail" label="إيميل التواصل" type="email" ltr />
            <Field id="contactPhone" label="جوال التواصل" type="tel" ltr />
          </div>
          <Button type="submit" size="sm">إضافة</Button>
        </form>
      </Card>

      {providers.length === 0 ? (
        <Card className="text-sm text-ink-secondary">لا يوجد مزوّدون بعد.</Card>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => {
            const status = p.status as ProviderStatus;
            const { readiness } = p;
            const pct = readiness.requiredCount ? Math.round((readiness.doneCount / readiness.requiredCount) * 100) : 100;
            return (
              <Link key={p.id} href={`${PATH}/${p.id}`} className="block rounded-card border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-card transition hover:border-brand sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    {p.legalName && <div className="truncate text-xs text-ink-secondary">{p.legalName}</div>}
                  </div>
                  <Badge variant={STATUS_VARIANT[status]}>{PROVIDER_STATUS_LABELS[status]}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-ink-secondary">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <span>الشروط المطلوبة: {readiness.doneCount} من {readiness.requiredCount}</span>
                </div>
                {(status === "approved" && !readiness.ready) || readiness.expiringSoon.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {status === "approved" && !readiness.ready && <Badge variant="error">مفعّل وينقصه: {readiness.blocking.map((b) => b.title).join("، ")}</Badge>}
                    {readiness.expiringSoon.length > 0 && <Badge variant="warning">ينتهي قريباً: {readiness.expiringSoon.map((b) => b.title).join("، ")}</Badge>}
                  </div>
                ) : null}
                {p.statusReason && (status === "rejected" || status === "suspended") && <p className="mt-2 text-xs text-ink-secondary">السبب: {p.statusReason}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ id, label, type = "text", required, ltr }: { id: string; label: string; type?: string; required?: boolean; ltr?: boolean }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}{required && <span className="text-ink-secondary"> *</span>}</label>
      <Input id={id} name={id} type={type} required={required} dir={ltr ? "ltr" : undefined} />
    </div>
  );
}
