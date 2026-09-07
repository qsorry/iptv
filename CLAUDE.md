# CLAUDE.md

توجيهات لأي جلسة Claude Code تعمل على هذا المستودع.

## المشروع
منصة متاجر إلكترونية متعددة المستأجرين (Multi-tenant commerce platform) تُباع للتجار،
مبنية كـ Modular Monolith. اقرأ `docs/ARCHITECTURE.md` قبل أي تعديل معماري.

## الحزمة التقنية
- Next.js 15 (App Router) + TypeScript
- PostgreSQL عبر Drizzle ORM (مصدر مخطط قاعدة البيانات في `src/infrastructure/database/schema`)
- المصادقة: Better Auth (`src/lib/auth.ts`)
- التخزين: واجهة S3 (`src/infrastructure/storage`) — MinIO أو R2
- الاستضافة: Coolify + Docker (standalone build)

## بيئة النشر (Coolify)
- مشروع Coolify: `commerce-platform` → بيئة `production`
- التطبيق: `commerce` (المعرّف الثابت: `7r3guekc7ldbi6nm4iultqjf`)
- الدومين: https://com.ssouq.net
- الفرع المنشور: `claude/iptv-link-13fas8` (هو الفرع الافتراضي في GitHub)
- الدفع إلى الفرع يُطلق نشراً تلقائياً عبر GitHub webhook.

## إدارة المنصة
- مدير المنصة يُحدَّد بمتغير `PLATFORM_ADMIN_EMAILS` (إيميلات مفصولة بفاصلة) ويرى `/admin/platform` لتغيير باقات المتاجر.
- الباقات الافتراضية في `src/modules/billing/plans.ts` (free / pro / business)؛ الأعلى تنفرد بميزة `subscriptions.api`.

## الهجرات
- تُطبَّق تلقائياً عند إقلاع الحاوية عبر `scripts/migrate.mjs` قبل `server.js`.
- لإضافة/تعديل جدول: عدّل ملفات `src/infrastructure/database/schema/*.ts` ثم
  `npm run db:generate` لتوليد ملف SQL في `drizzle/`. لا تكتب SQL يدوياً ولا تعدّل ملفات `drizzle/` المولّدة.
- لا تصل إلى قاعدة بيانات الإنتاج مباشرة؛ الهجرة التلقائية تكفي.

## قبل كل دفعة (إلزامي)
شغّل كل هذه وتأكد من نجاحها:
```
npm run lint
npm run typecheck
npm run test:theme   # نظام الثيمات بلا قاعدة بيانات
npm run test:tracking # محرك التتبّع والإسناد بلا قاعدة بيانات
npm run test:smoke   # يحتاج قاعدة بيانات فارغة عبر DATABASE_URL (طبّق scripts/migrate.mjs أولاً)؛ يشغّل اختبار الثيمات ثم تدفق الطلب
```
للبناء الكامل: `next build` مع متغيرات وهمية (`DATABASE_URL`, `BETTER_AUTH_SECRET`).

## قواعد أساسية
- كل جدول تجاري يحمل `store_id`؛ كل حالة استخدام تستقبل `StoreContext`.
- المال بالهللة (أعداد صحيحة) في الكود و`numeric(12,2)` في القاعدة. لا float.
- لا تعديل مخزون بدون صف في `inventory_movements`. Snapshot في `order_items`.
- الحالات تنتقل عبر `core/state-machines` فقط. الأحداث عبر outbox (`domain_events`).
- لا تضع أسراراً في المستودع؛ كلها في متغيرات بيئة Coolify.

## نظام التصميم والثيمات (إلزامي)
- اقرأ `DESIGN_SYSTEM.md` و`AI_DESIGN_RULES.md` قبل أي واجهة. الرموز في `src/design-system/` (foundation → semantic → components).
- الثيم = قيم رموز فقط في `src/design-system/themes.ts` (`THEME_REGISTRY`، المرجعي `smartsouq`). يُحقن خادمياً عند `#sf-root[data-theme-scope]`. تجاوزات المتجر JSON بقائمة بيضاء؛ لا CSS مخصص للمتجر.
- الـ variants من `src/design-system/variants.ts` فقط. الرئيسية تُرسم من مصفوفة أقسام (`layouts.ts` + `SectionRenderer`).
- المكوّنات: `ui/` (Button, Input, Badge, Card, Modal, Skeleton, Container)، `commerce/` (ProductCard, ProductGrid, CategoryCard, ProductPrice)، `layout/` (Header, MobileNavigation)، `sections/`.

## التصميم المتجاوب (Mobile-first) — إلزامي لكل واجهة جديدة
- ابدأ بتصميم الجوال ثم أضف `sm: md: lg:` للأكبر. لا عرض ثابت بالبكسل.
- استخدم الرموز الدلالية عبر Tailwind: `bg-page`, `bg-surface`, `text-ink`, `text-ink-secondary`, `border-border`, `bg-brand`, `rounded-card`, `rounded-button`, `shadow-card`.
- عناصر الإدخال بحجم نص 16px على الأقل (مكوّن Input يضمنها) لمنع تكبير iOS.
- أهداف اللمس ≥ 40px (مضمونة في globals.css عبر min-height).
- الجداول توضع داخل حاوية `overflow-x-auto`، وعلى الجوال تُعرض كبطاقات (انظر `admin/products/page.tsx`).
- احترم مساحات الأمان: `var(--safe-top)` و`var(--safe-bottom)` في الأشرطة العلوية/السفلية.
- الوضع الداكن يعمل تلقائياً عبر الرموز؛ لا تكتب ألواناً ثابتة (hex) في المكوّنات.

## التتبّع والتكاملات
- محرك أحداث مركزي واحد: `src/modules/tracking` (اقرأ `docs/TRACKING.md` قبل أي تعديل).
- كل حدث له `event_id` واحد للمتصفح وللسيرفر؛ الشراء له `dedupe_key = purchase:<order_id>`.
- الإرسال دائماً عبر الطابور (`tracking_events`) وعامل `/api/internal/process-tracking`، لا داخل مسار الطلب.
- الموافقة تُفحص في المحرك قبل كل إرسال؛ لا بكسل قبل موافقة صريحة (PDPL).
- منصة جديدة = ملف في `adapters/` وسطر في `domain/platforms.ts`. لا كود متناثر في الصفحات.
- الإسناد (`src/modules/attribution`) يُلتقط من أول زيارة ويُنسخ إلى أعمدة `orders` — لا يمكن استرجاعه لاحقاً.

## الجاهزية لتطبيق جوال مستقبلي (API-first)
- منطق الأعمال كله في `src/modules/*` مستقل عن الواجهة، ويُستدعى من الصفحات ومن `src/app/api/v1/*`.
- أي ميزة جديدة: اكتب حالة الاستخدام في الموديول أولاً، ثم اعرضها في الويب و/أو في `api/v1`.
- تطبيق الجوال مستقبلاً سيستهلك نفس `api/v1` عبر Better Auth (bearer/session). لا تضع منطقاً داخل مكوّنات الواجهة.
