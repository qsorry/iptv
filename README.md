# IPTV System

نظام جديد مبني بـ **Next.js 15 + Supabase** لإدارة أعمال IPTV الخاصة بمتجر [سمارت سوق](https://ssouq.com).

## المتطلبات
- Node.js 22+
- حساب Supabase
- (اختياري) Supabase CLI للتطوير المحلي

## البدء
```bash
cp .env.example .env.local   # ثم عبّئ المفاتيح
npm install
npm run dev
```
افتح http://localhost:3000

## الأوامر
| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل بيئة التطوير |
| `npm run build` | بناء نسخة الإنتاج |
| `npm run lint` | فحص الكود |
| `npm run typecheck` | فحص الأنواع |
| `npm run db:types` | توليد أنواع قاعدة البيانات من Supabase |

## هيكل المشروع
راجع [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
