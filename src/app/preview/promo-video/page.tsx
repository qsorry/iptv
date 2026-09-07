import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromoVideo, DEFAULT_PROMO_SCRIPT, SCENES, PROMO_DURATION_MS } from "@/components/sections/promo-video";

/** صفحة معاينة مستقلة (خارج واجهة المتجر وخارج الفهرسة) لتقرير موضع الفيديو لاحقاً. */
export const metadata: Metadata = {
  title: "معاينة الفيديو الترويجي — IPTV",
  robots: { index: false, follow: false },
};

const SCENE_LABELS: Record<keyof typeof SCENES, string> = {
  intro: "المقدمة: اسم المنتج، عنوان يركّز بحدة، مسح ضوئي",
  uhd: "4K: رقم ضخم بانحراف لوني + شريط ULTRA HD",
  channels: "آلاف القنوات: بلاطات تطير من العمق + عدّاد حتى +12,000",
  bolt: "تفعيل فوري: صاعقة، حلقات صدمة، شريط تفعيل يمتلئ",
  cta: "الخاتمة: ثلاث شرائح متوهّجة + زر «اشترك الآن» بلمعة نابضة",
};

export default function PromoVideoPreviewPage() {
  return (
    <div data-theme-scope="" className="min-h-screen bg-page py-6 text-ink sm:py-10">
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>معاينة داخلية</Badge>
            <Badge variant="warning">غير مُدرج في واجهة المتجر بعد</Badge>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">الفيديو الترويجي — اشتراك IPTV الرقمي</h1>
          <p className="max-w-2xl text-sm text-ink-secondary sm:text-base">
            فيديو مولّد بالكود بالكامل (Canvas 2D، بلا مكتبات) بألوان ثيم المتجر الحالي. المكوّن مستقل في{" "}
            <code className="rounded-sm bg-surface-muted px-1 py-0.5 text-xs">src/components/sections/promo-video</code> ويمكن لاحقاً إدراجه في أي موضع
            (بطل الرئيسية، صفحة المنتج، لافتة ترويجية) أو تصدير ملف الفيديو واستخدامه كوسائط عادية.
          </p>
        </header>

        <section aria-labelledby="landscape" className="flex flex-col gap-3">
          <h2 id="landscape" className="text-lg font-bold">
            نسخة سطح المكتب (16:9)
          </h2>
          <PromoVideo aspect="landscape" ctaHref="/products" />
        </section>

        <section aria-labelledby="portrait" className="flex flex-col gap-3">
          <h2 id="portrait" className="text-lg font-bold">
            نسخة الجوال / القصص (9:16)
          </h2>
          <div className="mx-auto w-full max-w-sm">
            <PromoVideo aspect="portrait" ctaHref="/products" />
          </div>
        </section>

        <section aria-labelledby="scenes" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 id="scenes" className="mb-3 text-base font-bold">
              الخط الزمني ({Math.round(PROMO_DURATION_MS / 1000)} ثانية، حلقة مستمرة)
            </h2>
            <ol className="flex flex-col gap-2 text-sm">
              {(Object.keys(SCENES) as (keyof typeof SCENES)[]).map((k) => (
                <li key={k} className="flex gap-3">
                  <span className="w-20 shrink-0 font-mono text-xs text-ink-secondary" dir="ltr">
                    {(SCENES[k][0] / 1000).toFixed(1)}s – {(SCENES[k][1] / 1000).toFixed(1)}s
                  </span>
                  <span>{SCENE_LABELS[k]}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-bold">التصدير والإدراج</h2>
            <ul className="flex list-disc flex-col gap-2 ps-5 text-sm">
              <li>«تصدير فيديو» يسجّل حلقة كاملة بدقة 1280×720 أو 720×1280 كملف WebM قابل للرفع إلى التخزين واستخدامه في أي مكان.</li>
              <li>«حفظ صورة الغلاف» يصدّر PNG لإطار الدعوة للإجراء (يصلح كـ poster أو صورة Open Graph).</li>
              <li>
                للإدراج في الواجهة: <code className="rounded-sm bg-surface-muted px-1 py-0.5 text-xs">{'<PromoVideo ctaHref="/products" controls={false} />'}</code> ثم
                تسجيله كنوع قسم في <code className="rounded-sm bg-surface-muted px-1 py-0.5 text-xs">layouts.ts</code> عند اعتماد الموضع.
              </li>
              <li>النصوص قابلة للتخصيص عبر خاصية <code className="rounded-sm bg-surface-muted px-1 py-0.5 text-xs">script</code>؛ الافتراضي: «{DEFAULT_PROMO_SCRIPT.title}».</li>
              <li>الألوان تتبع ثيم المتجر تلقائياً (فاتح/داكن)، والحركة تتوقف مع «تقليل الحركة» وخارج الشاشة.</li>
            </ul>
          </Card>
        </section>
      </Container>
    </div>
  );
}
