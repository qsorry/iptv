# عقد `sections/promo-video`

## PromoVideo
- Purpose: فيديو ترويجي قصير (16 ثانية، حلقة) مولّد بالكود على Canvas 2D لاشتراكات IPTV الرقمية:
  مقدمة بعنوان يركّز بحدة → 4K بانحراف لوني → آلاف القنوات (بلاطات + عدّاد) → تفعيل فوري (صاعقة + شريط تقدّم) → شرائح مزايا متوهّجة ودعوة للإجراء.
- Variants (aspect): `landscape` (16:9، سطح المكتب) | `portrait` (9:16، جوال/قصص).
- Required: `ctaHref`.
- Optional: `script` (نصوص جزئية فوق `DEFAULT_PROMO_SCRIPT`)، `autoPlay`، `loop`، `controls`، `videoSrc` (فيديو خلفية اختياري يُرسم تحت المؤثرات)، `className`.
- Export: زر "تصدير فيديو" يسجّل حلقة كاملة عبر `MediaRecorder` (WebM/VP9 أو MP4 إن دعمه المتصفح) ويعرض رابط تنزيل؛ "حفظ صورة الغلاف" يصدّر PNG لإطار الدعوة للإجراء.
- Accessibility: الكانفاس `role="img"` بوصف نصي كامل؛ زر الدعوة رابط `<Link>` حقيقي فوق الكانفاس؛ `prefers-reduced-motion` = إطار ثابت مع تشغيل يدوي.
- Performance: Client Component (rAF)؛ يتوقف تلقائياً خارج الشاشة وعند إخفاء التبويب؛ DPR ≤ 2؛ لا مكتبات خارجية.
- Theming: الألوان تُحلّ من الرموز الدلالية (`--brand-primary/secondary/accent`, `--text-on-brand`, `--surface-primary`, `--badge-text`, `--font-family`) عند التركيب، وتُعاد قراءتها عند تبديل وضع الزائر. قاعدة الفيلم سوداء ثابتة تُعامل كصورة (لا كسطح واجهة).
- Must Not: يجلب بيانات · يعرف الثيم بالاسم · يُدرج في `layouts.ts` قبل اعتماد موضعه (يُعاين من `/preview/promo-video`).

## الملفات
- `promo-renderer.ts`: محرّك الرسم الخالص (مشاهد، جسيمات، نص متوهّج، شرائح، دعوة للإجراء). قابل للاختبار بلا React.
- `promo-video.tsx`: المكوّن (التحكم بالزمن، التصدير، الوصولية).
