# النشر على Coolify

## 1. قاعدة البيانات
1. في Coolify: **+ New Resource → Database → PostgreSQL** (الإصدار 17).
2. بعد التشغيل، انسخ **Internal Connection URL**. هذا هو `DATABASE_URL` للتطبيق.
3. لا تفعّل الوصول العام (Public Port) إلا مؤقتاً عند الحاجة لأداة خارجية.

## 2. التطبيق
1. **+ New Resource → Application → GitHub** واختر مستودع `qsorry/iptv` والفرع المطلوب.
2. **Build Pack: Dockerfile** (الملف في جذر المستودع).
3. **Port: 3000**.
4. أضف الدومين في **Domains** وسيصدر Coolify شهادة SSL تلقائياً.

## 3. متغيرات البيئة
في تبويب **Environment Variables**:

| المتغير | ملاحظة |
|---|---|
| `DATABASE_URL` | من الخطوة 1 |
| `NEXT_PUBLIC_APP_URL` | فعّل **Build Variable** لأنه يُدمج وقت البناء |
| `NEXT_PUBLIC_SUPABASE_URL` | Build Variable |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build Variable |
| `SUPABASE_SERVICE_ROLE_KEY` | وقت التشغيل فقط |

## 4. الهجرات
تُطبَّق تلقائياً عند إقلاع الحاوية (`scripts/migrate.mjs` قبل `server.js`).
إذا فشلت الهجرة لا يبدأ التطبيق، وستجد السبب في Logs.

## 5. المتاجر على subdomains
لتشغيل `*.platform.com`:
- أضف سجل DNS من نوع A لـ `*` يشير إلى خادم Coolify.
- في Domains أضف `https://*.platform.com` بجانب الدومين الرئيسي.
- Traefik داخل Coolify يوجّه كل الطلبات للتطبيق، وmiddleware يحدد المتجر من الـ Host.

## التطوير المحلي
```bash
docker compose up -d        # PostgreSQL محلي
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```
