import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { ensureDefaultPlans, getStorePlan, HIGHEST_PLAN, isPlatformAdmin } from "@/modules/billing";
import {
  canUseSubscriptionsApi,
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  listMappings,
  upsertMapping,
  deleteMapping,
  retryProvision,
  resetProviderConfig,
  listProviderPackages,
  suggestPackage,
  subscriptionRepository,
  providerConfigSchema,
} from "@/modules/subscriptions";
import { PRESETS, MAPPING_PARAM_HINTS, packageLabel, type PresetId } from "@/infrastructure/integrations/subscriptions";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { codeLines } from "@/lib/format-code";

const PATH = "/admin/subscriptions";

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof AppError ? e.message : fallback;
}

function finish(msg: string | null, ok: string) {
  revalidatePath(PATH);
  redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?ok=${encodeURIComponent(ok)}`);
}

const OK_TEXT: Record<string, string> = {
  provider: "تمت إضافة المزوّد. اضغط «اختبار الاتصال» للتأكد من المفتاح.",
  saved: "تم الحفظ.",
  mapping: "تم ربط المنتج. من الآن يُنشأ الاشتراك تلقائياً عند الدفع.",
  retry: "تم إنشاء الاشتراك بنجاح.",
};

const selectClass = "mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const ctx = await getAdminContext();
  await ensureDefaultPlans();
  const { error, ok } = await searchParams;
  const allowed = await canUseSubscriptionsApi(ctx.storeId);
  const plan = await getStorePlan(ctx.storeId);

  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="الاشتراكات التلقائية" />
        <Card className="space-y-3">
          <p className="text-sm">
            اربط متجرك بلوحة الاشتراكات (Shebik، Falcon Panel، أو أي لوحة أخرى) ليُنشأ الاشتراك ويصل للعميل تلقائياً فور الدفع، بلا لصق أكواد يدوياً.
          </p>
          <p className="text-sm font-medium">
            الخاصية متاحة لباقة «{HIGHEST_PLAN.name}» فقط. باقتك الحالية: {plan?.name ?? "بدون اشتراك"}.
          </p>
          {isPlatformAdmin(ctx.userEmail) ? (
            <Link href="/admin/platform" className="inline-block text-sm font-medium text-[var(--brand)] underline">أنت مدير المنصة: رقِّ هذا المتجر من صفحة إدارة المنصة</Link>
          ) : (
            <p className="text-xs text-[var(--muted)]">للترقية تواصل مع إدارة المنصة.</p>
          )}
        </Card>
      </div>
    );
  }

  const [providers, mappings, variants, provisions, counts] = await Promise.all([
    listProviders(ctx),
    listMappings(ctx),
    subscriptionRepository.listVariants(ctx.storeId),
    subscriptionRepository.listProvisionsDetailed(ctx.storeId, 30),
    subscriptionRepository.countByStatus(ctx.storeId),
  ]);
  const mappedVariantIds = new Set(mappings.map((m) => m.variantId));

  // الباقات تُسحب من كل لوحة نشطة؛ فشل لوحة واحدة لا يعطّل الصفحة.
  const packagesByProvider = new Map<string, { packages: { id: string; name: string }[]; error?: string }>();
  await Promise.all(
    providers
      .filter((p) => p.isActive)
      .map(async (p) => {
        try {
          const list = await listProviderPackages(ctx, p.id);
          packagesByProvider.set(p.id, { packages: list.map((x) => ({ id: x.id, name: packageLabel(x) })) });
        } catch (e) {
          packagesByProvider.set(p.id, { packages: [], error: e instanceof Error ? e.message : String(e) });
        }
      }),
  );
  const hasAnyPackages = [...packagesByProvider.values()].some((v) => v.packages.length > 0);
  // إن كانت كل اللوحات تحدد المدة/الاتصالات داخل الباقة نفسها فلا داعي لحقلي الأشهر والأجهزة.
  const needsParams = providers.some((p) => p.isActive && (MAPPING_PARAM_HINTS[(p.preset in MAPPING_PARAM_HINTS ? p.preset : "generic") as PresetId].length > 0));
  const unmappedVariants = variants.filter((v) => !mappedVariantIds.has(v.id));

  // ---------- server actions ----------
  async function addProvider(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const preset = String(formData.get("preset")) as PresetId;
      const p = PRESETS[preset] ?? PRESETS.generic;
      const configRaw = String(formData.get("config") || "").trim();
      await createProvider(c, {
        name: String(formData.get("name") || "").trim() || p.name,
        preset,
        baseUrl: String(formData.get("baseUrl") || "").trim() || p.baseUrl,
        apiKey: String(formData.get("apiKey") || ""),
        config: configRaw ? providerConfigSchema.parse(JSON.parse(configRaw)) : undefined,
      });
    } catch (e) {
      msg = e instanceof SyntaxError ? "قالب JSON غير صالح" : errorMessage(e, "تعذّر إضافة المزوّد");
    }
    finish(msg, "provider");
  }

  async function saveProvider(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const apiKey = String(formData.get("apiKey") || "").trim();
      const configRaw = String(formData.get("config") || "").trim();
      await updateProvider(c, String(formData.get("id")), {
        name: String(formData.get("name") || ""),
        baseUrl: String(formData.get("baseUrl") || ""),
        apiKey: apiKey || undefined,
        config: configRaw ? providerConfigSchema.parse(JSON.parse(configRaw)) : undefined,
        isActive: formData.get("isActive") === "on",
      });
    } catch (e) {
      msg = e instanceof SyntaxError ? "قالب JSON غير صالح" : errorMessage(e, "تعذّر حفظ المزوّد");
    }
    finish(msg, "saved");
  }

  async function removeProvider(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await deleteProvider(c, String(formData.get("id")));
    } catch (e) {
      msg = errorMessage(e, "تعذّر حذف المزوّد");
    }
    finish(msg, "saved");
  }

  async function resetConfig(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await resetProviderConfig(c, String(formData.get("id")));
    } catch (e) {
      msg = errorMessage(e, "تعذّرت استعادة القالب");
    }
    finish(msg, "saved");
  }

  async function runTest(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    let okMsg = "saved";
    try {
      const r = await testProvider(c, String(formData.get("id")));
      if (r.ok) okMsg = `الاتصال بالمزوّد يعمل بنجاح.`;
      else msg = `فشل الاتصال: ${r.message}`;
    } catch (e) {
      msg = errorMessage(e, "تعذّر اختبار الاتصال");
    }
    finish(msg, okMsg);
  }

  async function saveMapping(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const params: Record<string, unknown> = {};
      const months = Number(formData.get("months"));
      const connections = Number(formData.get("connections"));
      if (months > 0) params.months = months;
      if (connections > 0) params.connections = connections;
      // من القائمة: "providerId|packageId|اسم الباقة"؛ يدوياً: حقلا providerId وpackageId.
      const pick = String(formData.get("pkg") || "");
      const [pickProvider, pickPackage, ...nameParts] = pick.split("|");
      const providerId = pickProvider || String(formData.get("providerId") || "");
      const packageId = pickPackage || String(formData.get("packageId") || "");
      const packageName = nameParts.join("|");
      if (packageName) params.packageName = packageName;
      await upsertMapping(c, { variantId: String(formData.get("variantId")), providerId, packageId, params, isActive: true });
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ الربط");
    }
    finish(msg, "mapping");
  }

  async function removeMapping(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      await deleteMapping(c, String(formData.get("id")));
    } catch (e) {
      msg = errorMessage(e, "تعذّر حذف الربط");
    }
    finish(msg, "saved");
  }

  async function retry(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const r = await retryProvision(c, String(formData.get("id")));
      if (r.status !== "succeeded") msg = `لم تنجح المحاولة: ${r.lastError ?? ""}`;
    } catch (e) {
      msg = errorMessage(e, "تعذّرت إعادة المحاولة");
    }
    finish(msg, "retry");
  }

  const okText = ok ? (OK_TEXT[ok] ?? ok) : null;
  const step1 = providers.length > 0;
  const step2 = mappings.length > 0;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="الاشتراكات التلقائية" />

      {error && <p className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {okText && <p className="rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">{okText}</p>}

      {/* دليل الخطوات */}
      <Card className="p-3 sm:p-4">
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          <Step n={1} done={step1} title="أضِف لوحة الاشتراكات" desc="اسم اللوحة ومفتاح API فقط." />
          <Step n={2} done={step2} title="اربط منتجاً بباقة" desc="اختر المنتج والباقة لدى اللوحة." />
          <Step n={3} done={step1 && step2} title="يعمل تلقائياً" desc="عند الدفع يُنشأ الاشتراك ويصل للعميل." />
        </ol>
      </Card>

      {/* 1) المزوّدون */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">١. لوحات الاشتراكات</h2>

        {providers.map((p) => (
          <Card key={p.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <StatusPill ok={p.isActive && !p.lastError} label={!p.isActive ? "موقوف" : p.lastError ? "خطأ في الاتصال" : p.lastTestedAt ? "متصل" : "لم يُختبر"} />
                </div>
                <p className="truncate text-xs text-[var(--muted)]" dir="ltr">{p.baseUrl}</p>
              </div>
              <form action={runTest}>
                <input type="hidden" name="id" value={p.id} />
                <Button type="submit" size="sm" variant="secondary">اختبار الاتصال</Button>
              </form>
            </div>
            {p.lastError && <p className="text-xs text-red-600" dir="auto">{p.lastError}</p>}

            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--muted)]">تعديل</summary>
              <form action={saveProvider} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <label className="block">الاسم<Input name="name" defaultValue={p.name} className="mt-1" /></label>
                <label className="block">
                  مفتاح API الجديد <span className="text-xs text-[var(--muted)]">(الحالي: <span dir="ltr">{p.apiKeyMasked}</span> — اتركه فارغاً للإبقاء عليه)</span>
                  <Input name="apiKey" dir="ltr" autoComplete="off" className="mt-1" />
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p.isActive} /> مفعّل</label>
                <details>
                  <summary className="cursor-pointer text-xs text-[var(--muted)]">خيارات متقدمة (للمطوّرين)</summary>
                  <div className="mt-2 space-y-2">
                    <label className="block">رابط API<Input name="baseUrl" defaultValue={p.baseUrl} dir="ltr" className="mt-1" /></label>
                    <label className="block">
                      قالب الاتصال (JSON)
                      <textarea name="config" rows={10} dir="ltr" defaultValue={JSON.stringify(p.config, null, 2)} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs" />
                    </label>
                    <p className="text-xs text-[var(--muted)]">عدّله فقط إذا اختلفت وثائق مزوّدك عن القالب الجاهز. التفاصيل في docs/SUBSCRIPTIONS_API.md.</p>
                  </div>
                </details>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" size="sm">حفظ</Button>
                </div>
              </form>
              <form action={resetConfig} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-[var(--brand)] hover:underline">استعادة القالب الافتراضي لهذه اللوحة</button>
              </form>
              <form action={removeProvider} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-red-600 hover:underline">حذف هذه اللوحة</button>
              </form>
            </details>
          </Card>
        ))}

        <details open={providers.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">+ إضافة لوحة</summary>
          <Card className="mt-3">
            <form action={addProvider} className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.values(PRESETS).map((preset, i) => (
                  <label key={preset.id} className="cursor-pointer">
                    <input type="radio" name="preset" value={preset.id} defaultChecked={i === 0} className="peer sr-only" />
                    <div className="h-full rounded-[var(--radius)] border-2 border-[var(--border)] p-3 text-center text-sm font-medium peer-checked:border-[var(--brand)] peer-checked:text-[var(--brand)]">
                      {preset.name}
                    </div>
                  </label>
                ))}
              </div>
              <label className="block text-sm">
                مفتاح API
                <Input name="apiKey" required dir="ltr" autoComplete="off" placeholder="انسخه من لوحة المزوّد" className="mt-1" />
              </label>
              <label className="block text-sm">
                اسم للتمييز <span className="text-xs text-[var(--muted)]">(اختياري)</span>
                <Input name="name" placeholder="مثال: لوحتي الرئيسية" className="mt-1" />
              </label>
              <details>
                <summary className="cursor-pointer text-xs text-[var(--muted)]">خيارات متقدمة: لوحة مخصصة / رابط مختلف</summary>
                <div className="mt-2 space-y-2">
                  <label className="block text-sm">رابط API<Input name="baseUrl" dir="ltr" placeholder="يُملأ تلقائياً حسب اللوحة المختارة" className="mt-1" /></label>
                  <label className="block text-sm">
                    قالب الاتصال (JSON)
                    <textarea name="config" rows={8} dir="ltr" placeholder={JSON.stringify(PRESETS.generic.config, null, 2)} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs" />
                  </label>
                </div>
              </details>
              <Button type="submit" size="sm">إضافة</Button>
            </form>
          </Card>
        </details>
      </section>

      {/* 2) الربط */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">٢. المنتجات المربوطة</h2>

        {mappings.length > 0 && (
          <Card className="divide-y divide-[var(--border)] p-0 sm:p-0">
            {mappings.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-medium">{m.productName}{m.variantName && m.variantName !== m.productName ? ` — ${m.variantName}` : ""}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {m.providerName} · {m.params.packageName ? String(m.params.packageName) : <>باقة <span dir="ltr">{m.packageId}</span></>}
                    {m.params.months ? ` · ${String(m.params.months)} شهر` : ""}
                    {m.params.connections ? ` · ${String(m.params.connections)} جهاز` : ""}
                  </div>
                </div>
                <form action={removeMapping}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-xs text-red-600 hover:underline">فك الربط</button>
                </form>
              </div>
            ))}
          </Card>
        )}

        {providers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">أضِف لوحة أولاً ثم اربط منتجاتك.</p>
        ) : unmappedVariants.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">كل منتجاتك مربوطة. <Link href="/admin/products/new" className="text-[var(--brand)] underline">أضِف منتجاً جديداً</Link>.</p>
        ) : (
          <details open={mappings.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-[var(--brand)]">+ ربط منتج ({unmappedVariants.length} غير مربوط)</summary>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {hasAnyPackages
                ? "الباقات مسحوبة من لوحتك، والاقتراح الأقرب مُحدَّد مسبقاً حسب عنوان المنتج. راجع ثم اضغط «ربط»."
                : "تعذّر جلب الباقات من اللوحة؛ أدخل رقم الباقة يدوياً."}
            </p>
            {providers.map((p) => {
              const st = packagesByProvider.get(p.id);
              const msg = !p.isActive ? "اللوحة موقوفة" : !st ? null : st.error ? st.error : st.packages.length === 0 ? "اللوحة أرجعت قائمة باقات فارغة" : null;
              return msg ? (
                <p key={p.id} className="mt-1 break-all text-xs text-red-600" dir="auto">
                  «{p.name}»: {msg}
                </p>
              ) : null;
            })}
            <Card className="mt-3 divide-y divide-[var(--border)] p-0 sm:p-0">
              {unmappedVariants.map((v) => {
                const title = `${v.productName} ${v.name && v.name !== v.productName ? v.name : ""}`;
                const all = providers.flatMap((p) => (packagesByProvider.get(p.id)?.packages ?? []).map((pkg) => ({ id: pkg.id, name: pkg.name, providerId: p.id, providerName: p.name })));
                const sug = suggestPackage(title, all);
                const preselect = sug.pkg && sug.score > 0 ? `${sug.pkg.providerId}|${sug.pkg.id}|${sug.pkg.name}` : "";
                return (
                  <form key={v.id} action={saveMapping} className="grid gap-2 p-3 text-sm sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end">
                    <input type="hidden" name="variantId" value={v.id} />
                    <div className="sm:col-span-5 font-medium">{title.trim()}</div>
                    {hasAnyPackages ? (
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-[var(--muted)]">الباقة {preselect ? "(مقترحة)" : ""}</span>
                        <select name="pkg" required defaultValue={preselect} className={selectClass}>
                          {!preselect && <option value="">اختر الباقة…</option>}
                          {providers
                            .filter((p) => (packagesByProvider.get(p.id)?.packages.length ?? 0) > 0)
                            .map((p) => (
                              <optgroup key={p.id} label={p.name}>
                                {packagesByProvider.get(p.id)!.packages.map((pkg) => (
                                  <option key={`${p.id}|${pkg.id}`} value={`${p.id}|${pkg.id}|${pkg.name}`}>{pkg.name}</option>
                                ))}
                              </optgroup>
                            ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <label className="block">
                          <span className="text-xs text-[var(--muted)]">اللوحة</span>
                          <select name="providerId" required className={selectClass}>
                            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs text-[var(--muted)]">رقم الباقة</span>
                          <Input name="packageId" required dir="ltr" placeholder="12" className="mt-1" />
                        </label>
                      </>
                    )}
                    {needsParams ? (
                      <>
                        <label className="block">
                          <span className="text-xs text-[var(--muted)]">أشهر</span>
                          <Input name="months" type="number" min="1" dir="ltr" defaultValue={sug.months ?? ""} placeholder="12" className="mt-1 sm:w-20" />
                        </label>
                        <label className="block">
                          <span className="text-xs text-[var(--muted)]">أجهزة</span>
                          <Input name="connections" type="number" min="1" dir="ltr" defaultValue={sug.connections ?? ""} placeholder="1" className="mt-1 sm:w-20" />
                        </label>
                      </>
                    ) : (
                      <div className="hidden sm:col-span-2 sm:block" />
                    )}
                    <Button type="submit" size="sm">ربط</Button>
                  </form>
                );
              })}
            </Card>
          </details>
        )}
      </section>

      {/* 3) السجل */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">٣. الاشتراكات المُنشأة</h2>
          <div className="flex gap-3 text-xs text-[var(--muted)]">
            <span>ناجح <strong className="text-green-600">{counts.succeeded}</strong></span>
            <span>فشل <strong className="text-red-600">{counts.failed}</strong></span>
          </div>
        </div>
        {provisions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">لا شيء بعد. أول اشتراك سيظهر هنا عند دفع طلب لمنتج مربوط.</p>
        ) : (
          <Card className="divide-y divide-[var(--border)] p-0 sm:p-0">
            {provisions.map((p) => (
              <div key={p.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/admin/orders/${p.orderId}`} className="font-medium text-[var(--brand)] hover:underline">طلب #{p.orderNumber}</Link>
                    <span className="text-[var(--muted)]"> · {p.productName}{p.variantName && p.variantName !== p.productName ? ` — ${p.variantName}` : ""}</span>
                  </div>
                  <StatusPill ok={p.status === "succeeded"} label={p.status === "succeeded" ? "تم التسليم" : p.status === "failed" ? "فشل" : "قيد التنفيذ"} />
                </div>
                {p.deliveredCode && (
                  <div className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 font-mono text-xs" dir="ltr">
                    {codeLines(p.deliveredCode).map((l) => <div key={l}>{l}</div>)}
                  </div>
                )}
                {p.status !== "succeeded" && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-red-600" dir="auto">{p.lastError ?? "—"}</span>
                    <form action={retry}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" size="sm" variant="secondary">إعادة المحاولة</Button>
                    </form>
                  </div>
                )}
                <div className="text-xs text-[var(--muted)]">{p.providerName ?? ""} · {p.createdAt.toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Step({ n, done, title, desc }: { n: number; done: boolean; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-600 text-white" : "bg-[var(--brand)] text-[var(--brand-fg)]"}`}>
        {done ? "✓" : n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-[var(--muted)]">{desc}</div>
      </div>
    </li>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-green-50 text-green-700" : "border border-[var(--border)] text-[var(--muted)]"}`}>{label}</span>
  );
}
