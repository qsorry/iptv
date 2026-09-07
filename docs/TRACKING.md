# التكاملات ومحرك التتبّع المركزي

المبدأ الحاكم: **محرك أحداث واحد** يستقبل فعل العميل مرة واحدة ويوزّعه على كل المنصات.
لا كود منفصل لكل منصة، ولا انتظار لرد أي منصة داخل مسار الطلب.

```
فعل العميل
   ↓
Central Event Engine   (event_id · consent · enrich)   src/modules/tracking/application/engine.ts
   ↓
Queue + Retry          (tracking_events)               src/modules/tracking/application/queue.ts
   ↓
GA4 MP · Meta CAPI · TikTok Events · Snap CAPI         src/modules/tracking/adapters/*
```

المتصفح يرسل **نفس** `event_id` مباشرة للبكسل، فتدمج المنصة النسختين.

## القرارات الملزِمة
- **إزالة التكرار عبر `event_id`**: كل حدث يحمل UUID واحداً للمتصفح وللسيرفر. الشراء يستخدم
  `deterministicEventId("purchase:<order_id>")` فتتطابق النسختان رغم توليدهما في طلبين مختلفين.
- **`dedupe_key` على مستوى السيرفر**: `purchase:<order_id>` بفهرس فريد — إعادة تحميل صفحة النجاح
  لا ترسل Purchase مرتين.
- **الإرسال خارج مسار الطلب**: المحرك يكتب في `tracking_events` ويردّ فوراً؛ عامل منفصل يرسل
  مع تراجع أُسّي (1د → 32د، ست محاولات) وسجل فشل لكل منصة.
- **الموافقة تُفحص داخل المحرك**: `allowsPlatform` نقطة واحدة تقرر ما يُرسل وما يُحجب.
  المتصفح يفحصها أيضاً قبل تحميل البكسل، لكن القرار الملزم على الخادم.
- **قيمة الحدث بلا شحن ولا ضريبة** في كل المنصات (`subtotal - discount`).

## البنية
```
src/modules/tracking/
├── domain/       events.ts (الجدول الموحّد) · hash.ts · platforms.ts
├── application/  engine.ts · consent.ts · queue.ts · settings.ts · failures.ts
├── adapters/     ga4.ts · meta.ts · tiktok.ts · snapchat.ts   ← منصة جديدة = ملف واحد
└── infrastructure/crypto.ts (تشفير التوكنات AES-256-GCM)

src/modules/attribution/   التقاط utm والـ click ids (first/last touch)
src/modules/feeds/         خلاصة Merchant Center
```

إضافة منصة (بنترست، لينكدإن…) = ملف في `adapters/` + سطر في `domain/platforms.ts` + تسجيله في
`adapters/index.ts`. لا شيء آخر يتغيّر.

## الإسناد
عند أول زيارة يُنشأ صف في `visitors` يحمل `first_touch` (لا يُكتب فوقها أبداً) و`last_touch`
(تُحدَّث مع كل زيارة تحمل مصدراً؛ الزيارة المباشرة لا تمحو حملة سابقة). عند إنشاء الطلب تُنسخ
القيم إلى أعمدة `orders` — **نسخ لا ربط**، حتى لا يتغيّر تاريخ الطلب لو حُذف الزائر.
ROAS و CAC ومصدر الطلبات استعلامات فوق هذه الأعمدة، لا تكامل جديد.

## الامتثال (PDPL)
- لافتة موافقة بخيارين حقيقيين (قبول / رفض)، والاختيار يُخزَّن في `consent_records` بختم زمني.
- البكسلات لا تُحمَّل قبل موافقة صريحة، ومعها يُضبط Google Consent Mode v2.
- البريد والجوال يُهشّران SHA-256 على الخادم فقط ولا يغادران نصاً صريحاً.
- توكنات المنصات مشفّرة في القاعدة بمفتاح خارجها، ولا تعود للواجهة إلا مقنّعة (آخر ٤ خانات).

## التشغيل
| متغير البيئة | الغرض |
| --- | --- |
| `INTEGRATIONS_SECRET_KEY` | مفتاح تشفير توكنات التكاملات (يعود إلى `BETTER_AUTH_SECRET` إن غاب) |
| `CRON_SECRET` | حماية مسارات العامل الداخلية |

مجدولان في Coolify كل دقيقة:
```
POST /api/internal/process-events     x-cron-secret: $CRON_SECRET   # outbox الأعمال
POST /api/internal/process-tracking   x-cron-secret: $CRON_SECRET   # طابور التتبّع
```
فصلهما مقصود: بطء منصة إعلانية يجب ألا يؤخّر تسليم أكواد الاشتراك.

## الإعداد من لوحة التحكم
`/admin/settings/integrations`: تفعيل كل منصة ببياناتها، حالة الطابور، وسجل الإرسال الفاشل
مع إعادة محاولة يدوية. لا يمكن تفعيل تكامل قبل إكمال بياناته.

## نقاط الويب
| المسار | الوظيفة |
| --- | --- |
| `POST /api/v1/track` | حدث من المتصفح (purchase مرفوض هنا: قيمته تُنتج على الخادم) |
| `POST /api/v1/consent` | حفظ اختيار الموافقة بختم زمني |
| `GET /feed/products.xml` | خلاصة Merchant Center |

## الاختبار
```
npm run test:tracking   # بلا قاعدة بيانات: الجدول، الهاش، الموافقة، بناء طلبات المنصات، التشفير، الإسناد
```
التحقق النهائي يكون عبر Meta Events Manager وTikTok Test Events: نسبة تطابق سليمة وبلا تكرار.
