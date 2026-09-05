# البنية المعمارية

**Multi-tenant Modular Monolith** على Next.js + PostgreSQL (Supabase).

```
Clients (Storefront / Admin / Mobile لاحقاً)
        │
   Next.js App Layer  (src/app)            ← لا Business Logic هنا
        │
   Commerce Modules   (src/modules)        ← حالات الاستخدام والمستودعات
        │
   Shared Core        (src/core)           ← أخطاء، مال، أحداث، آلات حالة، tenancy
        │
   Infrastructure     (src/infrastructure) ← Drizzle schema، DB client، storage، تكاملات
```

## الهيكل

```
src/
  app/
    (storefront)/     واجهة المتجر للعميل
    admin/            لوحة تحكم التاجر
    api/v1/           REST API
    api/webhooks/     Webhooks الواردة (دفع/شحن)
    auth/
  modules/<name>/
    application/      حالة استخدام لكل ملف: create-product.ts, create-order.ts
    infrastructure/   <entity>.repository.ts
    validations/      مخططات zod
    index.ts          الواجهة العامة للوحدة فقط
  core/
    errors/  money/  events/  pagination/  tenancy/  state-machines/
  infrastructure/
    database/schema/  مصدر الحقيقة لقاعدة البيانات (Drizzle)
    database/client.ts
    storage/
    integrations/salla/
  components/ ui/ shared/ storefront/ admin/
  lib/                env, utils, slugify, api helpers
drizzle/              هجرات SQL مولَّدة (لا تُعدَّل يدوياً)
supabase/             config + Edge Functions
```

## القواعد الذهبية
1. **UI لا يحتوي Business Logic.** الصفحات تستدعي حالات الاستخدام من `modules/*` فقط.
2. **كل جدول تجاري يحمل `store_id`** وكل حالة استخدام تستقبل `StoreContext`.
3. **الوصول لقاعدة البيانات من الخادم فقط** عبر Drizzle. المتصفح لا يتصل بـ Supabase مباشرة إلا للمصادقة.
4. **المال بالهللة كأعداد صحيحة** في الكود، و`numeric(12,2)` في القاعدة. لا float.
5. **لا تعديل مخزون بدون صف في `inventory_movements`.**
6. **Snapshot** في `order_items` و`order_addresses`. الطلب القديم لا يتأثر بتغير المنتج.
7. **الحالات تنتقل عبر `core/state-machines` فقط.**
8. **الأحداث عبر outbox** (`domain_events`) داخل نفس الـ transaction، ويعالجها worker مجدول.
9. **Webhooks idempotent** عبر `unique(provider, event_id)`.
10. **كل تغيير مخطط يمر عبر `npm run db:generate`** ثم مراجعة ملف SQL الناتج.

## تدفق إنشاء الطلب
```
Validate cart → Load current prices → Calculate tax → Lock store row
→ Reserve inventory (FOR UPDATE) → Insert order + items + address snapshot
→ order_events + domain_events(order.created) → Convert cart
```

## التسمية
| المكان | النمط | مثال |
|---|---|---|
| قاعدة البيانات | snake_case | `product_variants`, `is_active` |
| TypeScript | camelCase | `productId`, `isActive` |
| مكونات React | PascalCase | `ProductCard` |
| الملفات | kebab-case | `create-order.ts` |
