# عقود الأقسام `sections/`

الأقسام تركّب مكوّنات `ui/` و`commerce/` فقط. لا تجلب بيانات؛ تستقبلها من الصفحة (خادم).

| Section | Purpose | Variants | Required |
|---|---|---|---|
| Hero | بطل الصفحة، لوحة إعلانية واحدة تحمل h1 الوحيد: عمل فني متكامل بالمنتج الفعلي (`artwork` عريض/مربع) والنص الحي فوقه | `centered \| split \| banner` | `title` |
| Benefits | مزايا المتجر (4 عناصر) | — | — |
| CategorySection | التصنيفات (شريط جوال / شبكة) | — | `categories` |
| FeaturedProducts | منتجات بشبكة وعنوان | يمرّر variant بطاقة المنتج | `items`, `currency` |
| PromotionalBanner | لافتتان ترويجيتان | tint: primary/secondary/accent/success | `items` |
| Testimonials | آراء العملاء | — | `items` |
| SectionRenderer | خريطة `type → component` ثابتة | — | `section`, `data` |
| PromoVideo (`promo-video/`) | فيديو ترويجي مولّد بالكود (Canvas 2D) لاشتراكات IPTV، مع تصدير WebM/PNG | aspect: `landscape \| portrait` | `ctaHref` — انظر `promo-video/CONTRACT.md`؛ غير مُدرج في `SectionRenderer` بعد |

مصفوفة التخطيط الافتراضية في `src/design-system/layouts.ts` وتُحلّ عبر `resolveHomeLayout` (modules/stores) على الخادم.
