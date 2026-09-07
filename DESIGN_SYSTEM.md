# Smart Souq Design System

> اقرأ هذا الملف و`AI_DESIGN_RULES.md` قبل أي واجهة جديدة. الرموز في `src/design-system/`.

## A0. لغة التصميم
Bright · Modern · Premium · Clean · Arabic-first · RTL-first · E-commerce familiar.
ليس Material، ليس Bootstrap. مستدير بلا طفولية. الظلال تفصل المحتوى ولا تزيّنه.

## A1. تسلسل البناء الإلزامي
```
Foundation Tokens → Semantic Tokens → Components → Variants → Sections → Pages
```
لا صفحة بتصميم CSS خاص بها. الصفحة تركيب من Sections وComponents موجودة.

## A2. التعريفات
| المصطلح | التعريف | يحتوي |
|---|---|---|
| Design System | النظام كاملاً | Tokens, Components, Contracts, Variants, Rules |
| Theme | قيم رموز فقط | لا مكوّنات، لا صفحات، لا تخطيط |
| Variant | تغيير حقيقي في التخطيط/التسلسل/الغرض | مسجّل وموثّق فقط |

اللون والشكل مسؤولية الثيم. التخطيط مسؤولية الـ Variant.

## A3. الهيكل
```
src/design-system/
  foundation.css   قيم خام + خانات اللوحة (يضبطها الثيم)
  semantic.css     رموز المعنى — الطبقة الوحيدة للمكوّنات (+ أسماء قديمة للتوافق)
  variants.ts      سجل الـ variants
  themes.ts        سجل الثيمات + القائمة البيضاء + التحويل إلى CSS
  layouts.ts       Layout presets (مصفوفة أقسام الرئيسية)
src/components/
  ui/         Button, Input, Badge, Card, Modal, Skeleton, Container
  commerce/   ProductCard, ProductPrice, ProductGrid, CategoryCard
  layout/     Header, MobileNavigation (+ StoreFooter في storefront/)
  sections/   Hero, Benefits, CategorySection, FeaturedProducts, PromotionalBanner, Testimonials, SectionRenderer
```

## A4. الطبقات الثلاث
```
FOUNDATION  --color-gray-900, --space-4, --radius-lg, --color-canvas   (لا تُستخدم في المكوّنات)
SEMANTIC    --text-primary, --card-bg, --button-primary-bg              (المكوّنات تستهلكها فقط)
COMPONENTS  Tailwind: bg-surface, text-ink, border-border, rounded-card, shadow-card, bg-brand…
```
المقاييس: spacing 4→96px، font xs 12 → 5xl 52، radius sm 6 · md 12 · lg 18 · xl 24 · full، shadows sm/md/lg، breakpoints 640/768/1024/1280/1440، font IBM Plex Sans Arabic.

### كيف يعمل الثيم عبر النطاق (Scope)
- `foundation.css` و`semantic.css` تُعلَنان على `:root` **و** `[data-theme-scope]`.
- جذر واجهة المتجر (`#sf-root`) يحمل `data-theme-scope` و`data-theme-name="<key>"` و`data-theme-version`.
- الخادم يحقن `<style>` بقيم خانات اللوحة للثيم (فاتح + داكن) عند `#sf-root`، فتُعاد حسابة الرموز الدلالية منها.
- `data-theme="light|dark"` هو **وضع الزائر** (مبدّل الثيم)، لا هوية الثيم.

## A5. قواعد المكوّنات
مسؤولية واحدة · رموز دلالية فقط · لا يعرف الثيم · لا قيم بصرية ثابتة · لا جلب بيانات · لا منطق صفحة · قابل لإعادة الاستخدام، لوحة المفاتيح، RTL.
ممنوع: `if (theme === "x")`، وأسماء مثل `BlueButton`, `HeroButton`, `CheckoutButton`.

## A6. عقد المكوّن
كل مجلد مكوّنات يحمل `CONTRACT.md` (Component, Purpose, Variants, Sizes, Required, Optional, Must Not).

## A7. سجل الـ Variants (القائمة البيضاء) — `src/design-system/variants.ts`
| Component | Variants |
|---|---|
| Button | `primary` `secondary` `outline` `ghost` (sizes `sm` `md` `lg`) |
| Card | `default` `elevated` `flat` |
| Badge | `default` `success` `warning` `error` |
| ProductCard | `default` `featured` `compact` `horizontal` |
| CategoryCard | `default` `compact` |
| Hero | `centered` `split` `banner` |
| Header | `standard` `minimal` |

ممنوع: `modern-v2`, `premium-new`, `special-card`, `gradient-style`, `custom-layout`, `purple`, `rounded`, `modern`.

## A8. القيم الثابتة
يجب أن تكون رموزاً: الألوان، المسافات، أحجام الخط وأوزانه، الاستدارة، الظلال، نقاط التوقف، مدد الحركة.
مسموح كـ CSS محلي: `display`, `position`, `flex`, `grid`, `transform`, `overflow`, `opacity`.

## A9. Mobile · RTL · Arabic first
الجوال أولاً. خصائص منطقية (`ms-`, `pe-`, `inset-inline`). الرئيسية على الجوال: هيدر لاصق، بحث، شريط تصنيفات أفقي، شبكة عمودين، تنقّل سفلي (الرئيسية/الأقسام/السلة/الحساب)، أهداف لمس ≥ 44px.
إيقاع سطح المكتب: `Header → Hero → Benefits → Categories → Featured → Promo → Products → Testimonials → Footer`.

## A10. تركيب الصفحات
الرئيسية تُرسم من مصفوفة (`src/design-system/layouts.ts`) عبر `SectionRenderer`، محلولة على الخادم في `resolveHomeLayout` (modules/stores). نوع مجهول = لا شيء. لا جلب من العميل.

## A11. نظام الثيمات — `src/design-system/themes.ts`
الثيم = `ThemeDefinition { key, name, fontFamily, light: ThemePalette, dark: ThemePalette, shape }`.
الثيم المرجعي: **`smartsouq` (سمارت سوق)**: أزرق `#2563EB`، بنفسجي `#6D5BD0`، كهرماني `#F59E0B`، خلفية `#F8FAFC`، حواف 18px، ظلال ناعمة، IBM Plex Sans Arabic. باقي الثيمات القديمة (modern, midnight, sand, …) حُوِّلت إلى نفس النموذج.

ثيم جديد = هوية مختلفة فعلاً، لا مجرد لون. يُضاف في `THEME_REGISTRY` فقط.

### A11.1 الجاهزية لتعدد المتاجر
| الطبقة | تتحكم في | تُخزَّن كـ |
|---|---|---|
| Theme | قيم رموز | `settings.theme` + `settings.themeOverrides` (JSON) |
| Layout Preset | ترتيب الأقسام + variants | `settings.homeLayout` (JSON، مصفوفة أقسام) |
| Template | تركيب صفحة كامل | على مستوى المسار |

- تجاوزات المتجر JSON فقط، تُحقن خادمياً، **لا حقل CSS مخصص أبداً**.
- كل متجر يحمل `themeVersion` (`THEME_VERSION`).
- القائمة البيضاء للتجاوز: `--color-brand-primary`, `--color-brand-accent`, `--page-bg`, `--card-radius`, `--button-radius`, `--font-family`. الباقي مملوك للنظام (`parseThemeOverrides` يهمل ما عداها).
- الإعدادات القديمة (لون العلامة، الخط، الاستدارة) تُترجم إلى نفس القائمة في `storeThemeOverrides`.

## A12–A14
SEO (انظر `SEO_RULES.md`)، الوصولية (تركيز مرئي موحّد في `globals.css`، `<button>` للإجراء و`<a>` للتنقّل، تسميات للحقول)، الحركة عبر `--duration-*`/`--ease-*` مع احترام `prefers-reduced-motion`.

## القاعدة الذهبية
> كل قرار واجهة جديد إمّا يعيد استخدام النظام أو يوسّعه عمداً وبتوثيق. لا تجاوز أبداً.
