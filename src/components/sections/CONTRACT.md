# عقود الأقسام `sections/`

الأقسام تركّب مكوّنات `ui/` و`commerce/` فقط. لا تجلب بيانات؛ تستقبلها من الصفحة (خادم).

| Section | Purpose | Variants | Required |
|---|---|---|---|
| Hero | بطل الصفحة، يحمل h1 الوحيد | `centered \| split \| banner` | `title` |
| Benefits | مزايا المتجر (4 عناصر) | — | — |
| CategorySection | التصنيفات (شريط جوال / شبكة) | — | `categories` |
| FeaturedProducts | منتجات بشبكة وعنوان | يمرّر variant بطاقة المنتج | `items`, `currency` |
| PromotionalBanner | لافتتان ترويجيتان | tint: primary/secondary/accent/success | `items` |
| Testimonials | آراء العملاء | — | `items` |
| SectionRenderer | خريطة `type → component` ثابتة | — | `section`, `data` |

مصفوفة التخطيط الافتراضية في `src/design-system/layouts.ts` وتُحلّ عبر `resolveHomeLayout` (modules/stores) على الخادم.
