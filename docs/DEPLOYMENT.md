# النشر على Coolify

## 1. قاعدة البيانات
1. **+ New Resource → Database → PostgreSQL** (الإصدار 17).
2. انسخ **Internal Connection URL** → هذا هو `DATABASE_URL`.
3. لا تفعّل الوصول العام (Public Port) إلا مؤقتاً.

## 2. التخزين (MinIO)
1. **+ New Resource → Service → MinIO**.
2. أنشئ bucket باسم `commerce` واجعل سياسته `public-read` (للصور).
3. أنشئ Access Key، وضع القيم في `S3_*`. `S3_ENDPOINT` هو رابط الـ API (المنفذ 9000) وليس الـ Console.

## 3. التطبيق
1. **+ New Resource → Application → GitHub** واختر المستودع والفرع.
2. **Build Pack: Dockerfile**، **Port: 3000**.
3. **Domains**: الدومين الرئيسي + `https://*.platform.com` للمتاجر (انظر §5).

## 4. متغيرات البيئة

| المتغير | ملاحظة |
|---|---|
| `DATABASE_URL` | من §1 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://platform.com` — فعّل **Build Variable** |
| `PLATFORM_DOMAIN` | `platform.com` بدون بروتوكول |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_URL` | من §2 |

## 5. المتاجر على subdomains
- سجل DNS من نوع A لـ `*.platform.com` يشير إلى خادم Coolify.
- Traefik داخل Coolify يوجّه كل الطلبات للتطبيق؛ `middleware.ts` يقرأ Host ويحدد المتجر.
- الدومينات المخصصة للتجار (`www.myshop.com`) تُسجَّل في جدول `store_domains` ويوجّه التاجر CNAME إلى `platform.com`.

## 6. فحص الصحة (مهم)
إعداد Coolify الافتراضي يفحص المنفذ 80 والمسار `/`، بينما التطبيق يعمل على 3000. إن بقي الافتراضي
تُعلَّم الحاوية unhealthy ويعرض Traefik «no available server». في قسم **Healthcheck** بالتطبيق:
**Port: 3000**، **Path: /api/health**. أو عطّل فحص Coolify واعتمد على `HEALTHCHECK` في الـ Dockerfile.

## 7. الهجرات
تُطبَّق تلقائياً عند إقلاع الحاوية (`scripts/migrate.mjs` قبل `server.js`). إن فشلت لا يبدأ التطبيق.

## التطوير المحلي
```bash
docker compose up -d        # PostgreSQL + MinIO
cp .env.example .env.local  # عدّل BETTER_AUTH_SECRET ومفاتيح MinIO (minio / minio12345)
npm install
npm run db:migrate
npm run dev
```
لاختبار subdomains محلياً: `PLATFORM_DOMAIN=localhost:3000` وافتح `http://shop.localhost:3000` (المتصفحات الحديثة تحلّ `*.localhost` تلقائياً).
