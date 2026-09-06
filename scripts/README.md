# Scripts

- `migrate.mjs` — يطبّق هجرات `drizzle/` عند إقلاع الحاوية (يُستدعى من Dockerfile).
- `dev/smoke-order-flow.ts` — اختبار دخاني للتدفق الكامل (متجر → منتج → مخزون → سلة → طلب → حالات).
  التشغيل على قاعدة بيانات فارغة بعد الهجرة: `npm run test:smoke`.
