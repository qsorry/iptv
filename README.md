# Commerce Platform

منصة متاجر إلكترونية **متعددة المستأجرين** تُباع للتجار، مبنية كـ Modular Monolith على
**Next.js 15 + PostgreSQL + Drizzle ORM + Better Auth + تخزين S3**، مستضافة على Coolify، مع استيراد بيانات التاجر من سلة.

## المتطلبات
- Node.js 22+
- Docker (لتشغيل PostgreSQL و MinIO محلياً)
- الاستضافة: Coolify (راجع docs/DEPLOYMENT.md)

## البدء
```bash
docker compose up -d           # PostgreSQL + MinIO محلياً
cp .env.example .env.local     # عدّل BETTER_AUTH_SECRET
npm install
npm run db:migrate             # ينشئ الجداول
npm run dev
```

## الأوامر
| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل التطوير |
| `npm run build` | بناء الإنتاج |
| `npm run lint` / `npm run typecheck` | الفحوصات |
| `npm run db:generate` | توليد هجرة من تغييرات schema |
| `npm run db:migrate` | تطبيق الهجرات |
| `npm run db:studio` | متصفح قاعدة البيانات |
| `npm run test:smoke` | اختبار دخاني لتدفق الطلب على قاعدة فارغة |

## التوثيق
- [البنية المعمارية](docs/ARCHITECTURE.md)
- [قاعدة البيانات](docs/DATABASE.md)
- [خارطة الطريق](docs/ROADMAP.md)
- [النشر على Coolify](docs/DEPLOYMENT.md)
