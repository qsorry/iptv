import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/core/tenancy/server";
import { AppError } from "@/core/errors";
import { getPageById, updateLanding, readLanding, parseLines, parsePairs, formatPairs } from "@/modules/content";
import { productRepository } from "@/modules/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "محرّر صفحة الهبوط" };

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/**
 * محرّر صفحة الهبوط التجارية.
 * التحرير سطري («عنوان | نص» في كل سطر) عن قصد: يعطي التاجر بنية حقيقية
 * بنموذج بسيط، بدل محرّر بصري بآلاف الأسطر أو JSON خام لا يقرؤه أحد.
 */
export default async function LandingEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const { error, ok } = await searchParams;
  const page = await getPageById(ctx.storeId, id);
  if (!page) notFound();

  const content = readLanding(page.landing);
  const products = await productRepository.listPublic(ctx.storeId);
  const selected = new Set(content.packages.productIds);

  async function save(formData: FormData) {
    "use server";
    const c = await getAdminContext();
    const { id: pageId } = await params;
    let msg: string | null = null;
    try {
      await updateLanding(c, pageId, {
        hero: {
          heading: field(formData, "heroHeading"),
          subheading: field(formData, "heroSub"),
          ctaLabel: field(formData, "ctaLabel"),
          ctaHref: field(formData, "ctaHref"),
          badges: parseLines(field(formData, "badges")),
        },
        packages: {
          heading: field(formData, "packagesHeading"),
          note: field(formData, "packagesNote"),
          productIds: formData.getAll("productIds").map(String),
        },
        devices: { heading: field(formData, "devicesHeading"), items: parseLines(field(formData, "devices")) },
        why: {
          heading: field(formData, "whyHeading"),
          items: parsePairs(field(formData, "why")).map((p) => ({ title: p.first, body: p.second })),
        },
        faq: {
          heading: field(formData, "faqHeading"),
          items: parsePairs(field(formData, "faq"))
            .filter((p) => p.second.length > 0)
            .map((p) => ({ question: p.first, answer: p.second })),
        },
        related: {
          heading: field(formData, "relatedHeading"),
          links: parsePairs(field(formData, "related"))
            .filter((p) => p.second.length > 0)
            .map((p) => ({ label: p.first, href: p.second })),
        },
      });
    } catch (e) {
      msg = e instanceof AppError ? e.message : "تعذّر الحفظ";
    }
    redirect(msg ? `/admin/pages/${pageId}/landing?error=${encodeURIComponent(msg)}` : `/admin/pages/${pageId}/landing?ok=1`);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={`صفحة هبوط: ${page.title}`}
        action={
          <div className="flex gap-2">
            <Link href={`/pages/${encodeURIComponent(page.slug)}`} target="_blank">
              <Button variant="secondary">معاينة</Button>
            </Link>
            <Link href={`/admin/pages/${page.id}`}>
              <Button variant="secondary">رجوع</Button>
            </Link>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {ok && <Alert variant="success">تم الحفظ</Alert>}

      <form action={save} className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">الواجهة (Hero)</h2>
          <label className="block text-sm">
            العنوان الرئيسي (H1)
            <Input name="heroHeading" defaultValue={content.hero.heading} placeholder="اشتراك IPTV" className="mt-1" />
            <span className="mt-1 block text-xs text-ink-secondary">اجعله الكلمة التي يبحث بها الناس فعلاً، لا شعاراً.</span>
          </label>
          <label className="block text-sm">
            وصف مختصر
            <Textarea name="heroSub" rows={2} defaultValue={content.hero.subheading} className="mt-1" />
          </label>
          <label className="block text-sm">
            نقاط سريعة — سطر لكل نقطة
            <Textarea name="badges" rows={3} defaultValue={content.hero.badges.join("\n")} placeholder={"تفعيل فوري\nدعم فني\nضمان استبدال"} className="mt-1" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              نص زر الإجراء
              <Input name="ctaLabel" defaultValue={content.hero.ctaLabel} placeholder="اشترك الآن" className="mt-1" />
            </label>
            <label className="block text-sm">
              رابط الزر
              <Input name="ctaHref" dir="ltr" defaultValue={content.hero.ctaHref} placeholder="#packages" className="mt-1" />
            </label>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">الباقات</h2>
          <p className="text-xs text-ink-secondary">
            تُختار من منتجات المتجر، ويُقرأ السعر والتوفّر منها مباشرة — سعر مكتوب في الصفحة سيخالف صفحة المنتج يوماً ما، وجوجل يزحف للاثنين ويقارن.
          </p>
          <label className="block text-sm">
            عنوان القسم
            <Input name="packagesHeading" defaultValue={content.packages.heading} placeholder="اختر مدة اشتراكك" className="mt-1" />
          </label>
          <label className="block text-sm">
            سطر توضيحي
            <Input name="packagesNote" defaultValue={content.packages.note} className="mt-1" />
          </label>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-card border border-border p-2">
            {products.length === 0 ? (
              <p className="p-2 text-sm text-ink-secondary">لا منتجات منشورة بعد.</p>
            ) : (
              products.map((product) => (
                <label key={product.id} className="flex items-center gap-2 rounded-button p-1.5 text-sm hover:bg-surface-muted">
                  <input type="checkbox" name="productIds" value={product.id} defaultChecked={selected.has(product.id)} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="shrink-0 text-xs text-ink-secondary" dir="ltr">{product.price}</span>
                </label>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">الأجهزة المدعومة</h2>
          <label className="block text-sm">
            عنوان القسم
            <Input name="devicesHeading" defaultValue={content.devices.heading} placeholder="يعمل على أجهزتك" className="mt-1" />
          </label>
          <label className="block text-sm">
            سطر لكل جهاز
            <Textarea name="devices" rows={5} defaultValue={content.devices.items.join("\n")} placeholder={"Samsung\nLG\nAndroid\niPhone\nFire Stick"} className="mt-1" />
          </label>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">لماذا نحن</h2>
          <label className="block text-sm">
            عنوان القسم
            <Input name="whyHeading" defaultValue={content.why.heading} placeholder="لماذا سمارت سوق" className="mt-1" />
          </label>
          <label className="block text-sm">
            سطر لكل ميزة بصيغة: العنوان | الشرح
            <Textarea
              name="why"
              rows={5}
              defaultValue={formatPairs(content.why.items.map((i) => ({ first: i.title, second: i.body })))}
              placeholder={"تفعيل فوري | يصلك الاشتراك خلال دقائق من الدفع\nدعم فني | نرد على واتساب طوال اليوم"}
              className="mt-1"
            />
          </label>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">الأسئلة الشائعة</h2>
          <p className="text-xs text-ink-secondary">تُترجم إلى بيانات FAQPage المهيكلة، وقد تظهر أسئلتك مباشرة في نتيجة جوجل.</p>
          <label className="block text-sm">
            عنوان القسم
            <Input name="faqHeading" defaultValue={content.faq.heading} placeholder="أسئلة شائعة" className="mt-1" />
          </label>
          <label className="block text-sm">
            سطر لكل سؤال بصيغة: السؤال | الجواب
            <Textarea
              name="faq"
              rows={6}
              defaultValue={formatPairs(content.faq.items.map((i) => ({ first: i.question, second: i.answer })))}
              placeholder={"ما هو IPTV؟ | خدمة بث القنوات والأفلام عبر الإنترنت بدل الأطباق\nكيف يتم التفعيل؟ | يصلك الكود فور تأكيد الدفع"}
              className="mt-1"
            />
          </label>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">صفحات ذات صلة</h2>
          <label className="block text-sm">
            عنوان القسم
            <Input name="relatedHeading" defaultValue={content.related.heading} className="mt-1" />
          </label>
          <label className="block text-sm">
            سطر لكل رابط بصيغة: النص | الرابط
            <Textarea
              name="related"
              rows={4}
              defaultValue={formatPairs(content.related.links.map((l) => ({ first: l.label, second: l.href })))}
              placeholder={"تشغيل IPTV على Samsung | /pages/iptv-samsung"}
              className="mt-1"
            />
          </label>
        </Card>

        <Button type="submit">حفظ صفحة الهبوط</Button>
      </form>
    </div>
  );
}
