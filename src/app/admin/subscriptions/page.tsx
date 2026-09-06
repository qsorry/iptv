import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { ensureDefaultPlans, getStorePlan, HIGHEST_PLAN } from "@/modules/billing";
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
  subscriptionRepository,
  providerConfigSchema,
} from "@/modules/subscriptions";
import { PRESETS, MAPPING_PARAM_HINTS, type PresetId } from "@/infrastructure/integrations/subscriptions";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";

const PATH = "/admin/subscriptions";

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof AppError ? e.message : fallback;
}

function done(msg: string | null, ok = "1") {
  revalidatePath(PATH);
  redirect(msg ? `${PATH}?error=${encodeURIComponent(msg)}` : `${PATH}?ok=${encodeURIComponent(ok)}`);
}

const statusLabel: Record<string, string> = { pending: "قيد التنفيذ", succeeded: "ناجح", failed: "فشل" };
const statusClass: Record<string, string> = { pending: "text-[var(--muted)]", succeeded: "text-green-600", failed: "text-red-600" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; tab?: string }> }) {
  const ctx = await getAdminContext();
  await ensureDefaultPlans();
  const { error, ok, tab } = await searchParams;
  const allowed = await canUseSubscriptionsApi(ctx.storeId);
  const plan = await getStorePlan(ctx.storeId);

  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="الاشتراكات الرقمية (ربط API)" />
        <Card className="space-y-3">
          <p className="text-sm">
            هذه الخاصية تتيح ربط متجرك بلوحات الاشتراكات (Shebik، Falcon Panel، أو أي API آخر) لإنشاء الاشتراك
            تلقائياً وتسليمه للعميل فور نجاح الدفع، بلا تدخل يدوي.
          </p>
          <p className="text-sm font-medium">
            متاحة حصرياً لباقة «{HIGHEST_PLAN.name}». باقتك الحالية: {plan?.name ?? "بدون اشتراك"}.
          </p>
          <p className="text-xs text-[var(--muted)]">للترقية تواصل مع إدارة المنصة.</p>
        </Card>
      </div>
    );
  }

  const [providers, mappings, variants, provisions, counts] = await Promise.all([
    listProviders(ctx),
    listMappings(ctx),
    subscriptionRepository.listVariants(ctx.storeId),
    subscriptionRepository.listProvisions(ctx.storeId, 50),
    subscriptionRepository.countByStatus(ctx.storeId),
  ]);

  // ---------- server actions ----------
  async function addProvider(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const preset = String(formData.get("preset")) as PresetId;
      const configRaw = String(formData.get("config") || "").trim();
      await createProvider(c, {
        name: String(formData.get("name") || ""),
        preset,
        baseUrl: String(formData.get("baseUrl") || PRESETS[preset]?.baseUrl || ""),
        apiKey: String(formData.get("apiKey") || ""),
        config: configRaw ? providerConfigSchema.parse(JSON.parse(configRaw)) : undefined,
      });
    } catch (e) {
      msg = e instanceof SyntaxError ? "قالب JSON غير صالح" : errorMessage(e, "تعذّر إضافة المزوّد");
    }
    done(msg, "provider");
  }

  async function saveProviderConfig(formData: FormData) {
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
    done(msg, "provider");
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
    done(msg, "provider");
  }

  async function runTest(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    let okMsg = "test";
    try {
      const r = await testProvider(c, String(formData.get("id")));
      if (r.ok) okMsg = `test:${r.message}`;
      else msg = `فشل الاختبار: ${r.message}`;
    } catch (e) {
      msg = errorMessage(e, "تعذّر اختبار الاتصال");
    }
    done(msg, okMsg);
  }

  async function saveMapping(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const params: Record<string, unknown> = {};
      for (const [k, v] of formData.entries()) {
        if (!k.startsWith("param.")) continue;
        const val = String(v).trim();
        if (val) params[k.slice(6)] = /^\d+$/.test(val) ? Number(val) : val;
      }
      await upsertMapping(c, {
        variantId: String(formData.get("variantId")),
        providerId: String(formData.get("providerId")),
        packageId: String(formData.get("packageId") || ""),
        params,
        isActive: true,
      });
    } catch (e) {
      msg = errorMessage(e, "تعذّر حفظ الربط");
    }
    done(msg, "mapping");
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
    done(msg, "mapping");
  }

  async function retry(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    let msg: string | null = null;
    try {
      const r = await retryProvision(c, String(formData.get("id")));
      if (r.status !== "succeeded") msg = `فشلت إعادة المحاولة: ${r.lastError ?? ""}`;
    } catch (e) {
      msg = errorMessage(e, "تعذّرت إعادة المحاولة");
    }
    done(msg, "retry");
  }

  const okText =
    ok === "provider" ? "تم حفظ المزوّد." : ok === "mapping" ? "تم حفظ الربط." : ok === "retry" ? "تم إنشاء الاشتراك بنجاح." : ok?.startsWith("test:") ? ok.slice(5) : ok ? "تم." : null;
  const paramHints = (preset: string) => MAPPING_PARAM_HINTS[(preset in MAPPING_PARAM_HINTS ? preset : "generic") as PresetId];

  return (
    <div className="max-w-3xl">
      <PageHeader title="الاشتراكات الرقمية (ربط API)" />
      <p className="mb-4 text-sm text-[var(--muted)]">
        اربط لوحة اشتراكاتك بالمتجر: عند نجاح دفع أي طلب يحوي منتجاً مربوطاً، يُنشأ الاشتراك تلقائياً لدى المزوّد
        ويُرسل للعميل مع بقية الأكواد. إن كان للمنتج أكواد مخزّنة تُستخدم أولاً، ويُكمَّل الباقي من API.
      </p>

      {error && <p className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {okText && <p className="mb-4 rounded-[var(--radius)] border border-green-200 bg-green-50 p-3 text-sm text-green-700">{okText}</p>}

      <Tabs
        initial={tab ?? "providers"}
        items={[
          {
            key: "providers",
            label: `المزوّدون (${providers.length})`,
            content: (
              <div className="space-y-6">
                {providers.map((p) => (
                  <Card key={p.id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <p className="text-xs text-[var(--muted)]" dir="ltr">
                          {PRESETS[p.preset as PresetId]?.name ?? p.preset} · {p.baseUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={p.isActive ? "text-green-600" : "text-[var(--muted)]"}>{p.isActive ? "نشط" : "موقوف"}</span>
                        {p.lastTestedAt && (
                          <span className={p.lastError ? "text-red-600" : "text-green-600"} title={p.lastError ?? ""}>
                            {p.lastError ? "آخر اختبار فشل" : "الاتصال سليم"}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.lastError && <p className="text-xs text-red-600" dir="auto">{p.lastError}</p>}
                    <details>
                      <summary className="cursor-pointer text-sm text-[var(--brand)]">تعديل الإعدادات والقالب</summary>
                      <form action={saveProviderConfig} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={p.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm">الاسم<Input name="name" defaultValue={p.name} className="mt-1" /></label>
                          <label className="block text-sm">رابط API<Input name="baseUrl" defaultValue={p.baseUrl} dir="ltr" className="mt-1" /></label>
                          <label className="block text-sm sm:col-span-2">
                            مفتاح API (اتركه فارغاً للإبقاء على الحالي: <span dir="ltr">{p.apiKeyMasked}</span>)
                            <Input name="apiKey" dir="ltr" autoComplete="off" className="mt-1" />
                          </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="isActive" defaultChecked={p.isActive} /> نشط
                        </label>
                        <label className="block text-sm">
                          قالب الاتصال (JSON): المصادقة، مسار الإنشاء، خريطة النتيجة
                          <textarea name="config" rows={12} dir="ltr" defaultValue={JSON.stringify(p.config, null, 2)} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs" />
                        </label>
                        <p className="text-xs text-[var(--muted)]">
                          المتغيرات المتاحة داخل القالب: <span dir="ltr">{"{{packageId}} {{params.months}} {{order.number}} {{customer.email}} {{customer.phone}} {{sequence}} {{reference}} {{apiKey}}"}</span>.
                          خريطة النتيجة (result) تقرأ الحقول من استجابة المزوّد بمسارات نقطية مثل <span dir="ltr">data.username</span>.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm">حفظ</Button>
                        </div>
                      </form>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={runTest}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button type="submit" size="sm" variant="secondary">اختبار الاتصال</Button>
                        </form>
                        <form action={removeProvider}>
                          <input type="hidden" name="id" value={p.id} />
                          <Button type="submit" size="sm" variant="secondary" className="border-red-300 text-red-600">حذف</Button>
                        </form>
                      </div>
                    </details>
                  </Card>
                ))}

                <h2 className="text-sm font-semibold text-[var(--muted)]">إضافة مزوّد</h2>
                <Card>
                  <form action={addProvider} className="space-y-4">
                    <div>
                      <span className="mb-2 block text-sm">القالب</span>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {Object.values(PRESETS).map((preset, i) => (
                          <label key={preset.id} className="cursor-pointer">
                            <input type="radio" name="preset" value={preset.id} defaultChecked={i === 0} className="peer sr-only" />
                            <div className="h-full rounded-[var(--radius)] border-2 border-[var(--border)] p-3 peer-checked:border-[var(--brand)]">
                              <div className="text-sm font-medium">{preset.name}</div>
                              <div className="mt-1 text-xs text-[var(--muted)]">{preset.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">اسم المزوّد<Input name="name" required placeholder="مثال: لوحة Shebik الرئيسية" className="mt-1" /></label>
                      <label className="block text-sm">
                        رابط API (اختياري؛ الافتراضي حسب القالب)
                        <Input name="baseUrl" dir="ltr" placeholder="https://dash.falcon-panel.com/api/v1" className="mt-1" />
                      </label>
                      <label className="block text-sm sm:col-span-2">مفتاح API<Input name="apiKey" required dir="ltr" autoComplete="off" className="mt-1" /></label>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm text-[var(--brand)]">قالب مخصص (JSON، اختياري)</summary>
                      <textarea name="config" rows={10} dir="ltr" placeholder={JSON.stringify(PRESETS.generic.config, null, 2)} className="mt-2 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs" />
                      <p className="mt-1 text-xs text-[var(--muted)]">اتركه فارغاً لاستخدام قالب الـ preset المختار، ويمكنك تعديله لاحقاً.</p>
                    </details>
                    <Button type="submit" size="sm">إضافة المزوّد</Button>
                  </form>
                </Card>
              </div>
            ),
          },
          {
            key: "mappings",
            label: `ربط المنتجات (${mappings.length})`,
            content: (
              <div className="space-y-6">
                {mappings.length > 0 && (
                  <Card className="overflow-x-auto p-0 sm:p-0">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="p-3 text-start">المنتج</th>
                          <th className="p-3 text-start">المزوّد</th>
                          <th className="p-3 text-start">الباقة</th>
                          <th className="p-3 text-start">المعاملات</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m) => (
                          <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="p-3">{m.productName}{m.variantName && m.variantName !== m.productName ? ` — ${m.variantName}` : ""}</td>
                            <td className="p-3">{m.providerName}</td>
                            <td className="p-3" dir="ltr">{m.packageId}</td>
                            <td className="p-3 text-xs text-[var(--muted)]" dir="ltr">{Object.entries(m.params).map(([k, v]) => `${k}=${String(v)}`).join(", ") || "—"}</td>
                            <td className="p-3">
                              <form action={removeMapping}>
                                <input type="hidden" name="id" value={m.id} />
                                <button className="text-xs text-red-600 hover:underline">حذف</button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}

                <h2 className="text-sm font-semibold text-[var(--muted)]">ربط منتج بمزوّد</h2>
                {providers.length === 0 ? (
                  <Card><p className="text-sm text-[var(--muted)]">أضِف مزوّداً أولاً من تبويب «المزوّدون».</p></Card>
                ) : (
                  <Card>
                    <form action={saveMapping} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                          المنتج / المتغيّر
                          <select name="variantId" required className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base">
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>{v.productName}{v.name && v.name !== v.productName ? ` — ${v.name}` : ""}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          المزوّد
                          <select name="providerId" required className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base">
                            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          معرّف الباقة لدى المزوّد (package id)
                          <Input name="packageId" required dir="ltr" placeholder="12" className="mt-1" />
                        </label>
                        {paramHints(providers[0].preset).map((h) => (
                          <label key={h.key} className="block text-sm">
                            {h.label}
                            <Input name={`param.${h.key}`} dir="ltr" placeholder={h.placeholder} className="mt-1" />
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        المعاملات تُمرَّر للقالب كـ <span dir="ltr">{"{{params.<name>}}"}</span>. لإضافة معامل آخر عدّل قالب المزوّد ثم أضِفه هنا بنفس الاسم.
                      </p>
                      <Button type="submit" size="sm">حفظ الربط</Button>
                    </form>
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: "log",
            label: `سجل التزويد${counts.failed ? ` (${counts.failed} فشل)` : ""}`,
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>ناجح: <strong>{counts.succeeded}</strong></span>
                  <span>فشل: <strong className="text-red-600">{counts.failed}</strong></span>
                  <span>قيد التنفيذ: <strong>{counts.pending}</strong></span>
                </div>
                {provisions.length === 0 ? (
                  <Card><p className="text-sm text-[var(--muted)]">لا توجد عمليات بعد. ستظهر هنا عند دفع أول طلب لمنتج مربوط.</p></Card>
                ) : (
                  <ul className="space-y-2">
                    {provisions.map((p) => (
                      <li key={p.id}>
                        <Card className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Link href={`/admin/orders/${p.orderId}`} className="font-medium text-[var(--brand)] underline">الطلب</Link>
                            <span className={`text-xs ${statusClass[p.status]}`}>{statusLabel[p.status]} · محاولات {p.attempts}</span>
                          </div>
                          <div className="text-xs text-[var(--muted)]">{p.createdAt.toLocaleString("ar-SA")}</div>
                          {p.deliveredCode && <div className="break-all font-mono text-xs" dir="ltr">{p.deliveredCode}</div>}
                          {p.lastError && <div className="text-xs text-red-600" dir="auto">{p.lastError}</div>}
                          {p.status !== "succeeded" && (
                            <form action={retry}>
                              <input type="hidden" name="id" value={p.id} />
                              <Button type="submit" size="sm" variant="secondary">إعادة المحاولة</Button>
                            </form>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
