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
npm run test:smoke   # يحتاج قاعدة بيانات فارغة عبر DATABASE_URL؛ يشغّل الهجرة ثم تدفق الطلب
```
للبناء الكامل: `next build` مع متغيرات وهمية (`DATABASE_URL`, `BETTER_AUTH_SECRET`).

## قواعد أساسية
- كل جدول تجاري يحمل `store_id`؛ كل حالة استخدام تستقبل `StoreContext`.
- المال بالهللة (أعداد صحيحة) في الكود و`numeric(12,2)` في القاعدة. لا float.
- لا تعديل مخزون بدون صف في `inventory_movements`. Snapshot في `order_items`.
- الحالات تنتقل عبر `core/state-machines` فقط. الأحداث عبر outbox (`domain_events`).
- لا تضع أسراراً في المستودع؛ كلها في متغيرات بيئة Coolify.
