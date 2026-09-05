# البنية المعمارية

```
src/
  app/            صفحات ومسارات Next.js (App Router)
    (dashboard)/  مجموعة مسارات لوحة التحكم مع Layout مشترك
    api/          Route Handlers (REST endpoints, webhooks)
  components/     مكونات React
  hooks/          React hooks مخصصة
  lib/
    supabase/     عملاء Supabase (browser / server / admin)
    salla/        تكامل متجر سلة
    env.ts        التحقق من متغيرات البيئة
  types/          أنواع TypeScript (database.ts مولَّد)
supabase/
  migrations/     هجرات SQL
  functions/      Edge Functions
docs/             التوثيق
scripts/          سكربتات مساعدة
```

## القواعد
- الوصول لقاعدة البيانات من الخادم فقط عبر `lib/supabase/server.ts` أو `admin.ts`.
- لا تُخزَّن مفاتيح سرية في الكود؛ كلها في `.env.local`.
- كل تغيير في قاعدة البيانات يمر عبر ملف هجرة.
