import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createRequirement, ensureDefaultRequirements, listRequirements, updateRequirement, REQUIREMENT_KINDS, REQUIREMENT_KIND_LABELS } from "@/modules/providers";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Flash, PlatformDenied, errorMessage, platformContext, requireActor, selectClass, withFlash } from "../shared";

const PATH = "/admin/platform/providers/requirements";

function readRequirementForm(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    kind: formData.get("kind"),
    sortOrder: formData.get("sortOrder"),
    isRequired: formData.get("isRequired") === "on",
    hasExpiry: formData.get("hasExpiry") === "on",
  };
}

/**
 * شروط قبول مزوّدي المحتوى (لمدير المنصة فقط). هذه الصفحة في لوحة الويب وليست في تطبيق المشغّل.
 * الشروط لا تُحذف بل تُعطَّل، حتى يبقى سجل المراجعات السابقة.
 */
export default async function RequirementsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!(await platformContext())) return <PlatformDenied title="شروط قبول المزوّدين" />;

  await ensureDefaultRequirements();
  const { error, ok } = await searchParams;
  const requirements = await listRequirements();

  async function addRequirement(formData: FormData) {
    "use server";
    let msg: string | null = null;
    try {
      await requireActor();
      await createRequirement(readRequirementForm(formData));
    } catch (e) {
      msg = errorMessage(e, "تعذّر إضافة الشرط");
    }
    revalidatePath(PATH);
    redirect(withFlash(PATH, msg, "أُضيف الشرط."));
  }

  async function saveRequirement(formData: FormData) {
    "use server";
    let msg: string | null = null;
    try {
      await requireActor();
      await updateRequirement(String(formData.get("id")), { ...readRequirementForm(formData), isActive: formData.get("isActive") === "on" });
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ الشرط");
    }
    revalidatePath(PATH);
    revalidatePath("/admin/platform/providers");
    redirect(withFlash(PATH, msg, "حُفظ الشرط."));
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="شروط قبول المزوّدين"
        action={<Link href="/admin/platform/providers" className={buttonClasses({ variant: "outline", size: "sm" })}>المزوّدون</Link>}
      />
      <Flash error={error} ok={ok} />

      <Card className="space-y-1 text-sm text-ink-secondary">
        <p>كل مزوّد يُراجع مقابل الشروط المفعّلة هنا، ولا يمكن قبوله قبل استيفاء كل شرط «مطلوب».</p>
        <p>الشرط ذو تاريخ الانتهاء يوقف المزوّد تلقائياً عند انتهائه. إضافة شرط مطلوب جديد لا توقف المزوّدين المفعّلين، بل تظهر عندهم كنقص يجب استكماله.</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">إضافة شرط</h2>
        <RequirementFields action={addRequirement} submitLabel="إضافة" />
      </Card>

      <div className="space-y-3">
        {requirements.map((r) => (
          <Card key={r.id} className={r.isActive ? undefined : "opacity-70"}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="flex-1 font-semibold">{r.title}</h2>
              <Badge>{REQUIREMENT_KIND_LABELS[r.kind as keyof typeof REQUIREMENT_KIND_LABELS] ?? r.kind}</Badge>
              {r.isRequired ? <Badge variant="warning">مطلوب</Badge> : <Badge>اختياري</Badge>}
              {r.hasExpiry && <Badge>له تاريخ انتهاء</Badge>}
              {!r.isActive && <Badge variant="error">معطّل</Badge>}
            </div>
            <RequirementFields
              action={saveRequirement}
              submitLabel="حفظ"
              defaults={{ id: r.id, title: r.title, description: r.description ?? "", kind: r.kind, sortOrder: r.sortOrder, isRequired: r.isRequired, hasExpiry: r.hasExpiry, isActive: r.isActive }}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

function RequirementFields({
  action,
  submitLabel,
  defaults,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaults?: { id: string; title: string; description: string; kind: string; sortOrder: number; isRequired: boolean; hasExpiry: boolean; isActive: boolean };
}) {
  const key = defaults?.id ?? "new";
  return (
    <form action={action} className="space-y-3">
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <div className="space-y-1">
        <label htmlFor={`title-${key}`} className="text-sm font-medium">عنوان الشرط</label>
        <Input id={`title-${key}`} name="title" required defaultValue={defaults?.title} placeholder="مثال: شهادة ضريبية" />
      </div>
      <div className="space-y-1">
        <label htmlFor={`desc-${key}`} className="text-sm font-medium">الشرح للمراجع</label>
        <Textarea id={`desc-${key}`} name="description" rows={2} defaultValue={defaults?.description} placeholder="ما الذي يُقبل وما الذي يُرفض" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`kind-${key}`} className="text-sm font-medium">النوع</label>
          <select id={`kind-${key}`} name="kind" defaultValue={defaults?.kind ?? "document"} className={selectClass}>
            {REQUIREMENT_KINDS.map((k) => (
              <option key={k} value={k}>{REQUIREMENT_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`order-${key}`} className="text-sm font-medium">الترتيب</label>
          <Input id={`order-${key}`} name="sortOrder" type="number" min={0} max={9999} defaultValue={defaults?.sortOrder ?? 100} dir="ltr" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isRequired" defaultChecked={defaults?.isRequired ?? true} className="h-4 w-4" />مطلوب للقبول</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="hasExpiry" defaultChecked={defaults?.hasExpiry ?? false} className="h-4 w-4" />له تاريخ انتهاء</label>
        {defaults && <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={defaults.isActive} className="h-4 w-4" />مفعّل</label>}
      </div>
      <Button type="submit" size="sm">{submitLabel}</Button>
    </form>
  );
}
