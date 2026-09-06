# قاعدة البيانات (المرحلة الأولى)

المصدر: `src/infrastructure/database/schema/*.ts`. الهجرات في `drizzle/`.

| المجموعة | الجداول |
|---|---|
| STORES | stores, store_domains, store_settings |
| IDENTITY | users, sessions, accounts, verifications (Better Auth), store_members |
| CATALOG | categories, brands, products, product_variants, product_options, product_option_values, variant_option_values, product_media |
| INVENTORY | warehouses, inventory_levels, inventory_movements |
| CUSTOMERS | customers, customer_addresses |
| CART | carts, cart_items, checkout_sessions |
| ORDERS | orders, order_items, order_addresses, order_events |
| PAYMENTS | payment_transactions, refunds, refund_items |
| SYSTEM | domain_events, webhook_events, audit_logs |

## مؤجل للمرحلة الثانية
shipping_zones, shipping_methods, shipments, promotions (+rules/actions/coupons), tax_rates,
invoices (مع متطلبات فاتورة/ZATCA)، return_requests، notifications، pages، roles/permissions التفصيلية.

## أوامر
```bash
npm run db:generate   # توليد هجرة من تغييرات الـ schema
npm run db:migrate    # تطبيق الهجرات على DATABASE_URL
npm run db:studio     # متصفح بيانات محلي
```

## عزل المستأجرين
كل الوصول من الخادم عبر Drizzle، وعزل المستأجرين مسؤولية طبقة التطبيق:
`StoreContext` إلزامي في كل حالة استخدام، وكل استعلام تجاري مقيد بـ `store_id`.
