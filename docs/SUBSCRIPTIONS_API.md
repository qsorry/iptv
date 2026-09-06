# ربط الاشتراكات الرقمية عبر API (أتمتة التزويد)

ميزة حصرية لباقة **أعمال** (`business`) — مفتاح الميزة `subscriptions.api`. تُمنح أيضاً لمتجر بعينه عبر `store_entitlements`.

## الفكرة
بدل لصق الأكواد يدوياً، يربط التاجر متجره بلوحة اشتراكات (Shebik، Falcon Panel، أو أي API آخر).
عند نجاح دفع طلب يحوي منتجاً مربوطاً:
1. تُسلَّم أكواد المخزون أولاً (`modules/codes`).
2. الباقي يُنشأ عبر API المزوّد (`modules/subscriptions`) ويُدرج ككود مُسلَّم في `digital_codes`.
3. يُرسل للعميل عبر الإشعارات المعتادة (`notifyCodesDelivered`).

التسلسل يحدث في معالج حدث `payment.succeeded` داخل `modules/system/process-events.ts`.

## الجداول
| الجدول | الغرض |
|---|---|
| `subscription_providers` | مزوّد لكل متجر: `preset` (shebik/falcon/generic)، `base_url`، `api_key_encrypted` (AES-GCM)، `config` (قالب الاتصال) |
| `subscription_mappings` | ربط `variant_id` بمزوّد + `package_id` + `params` (المدة، الاتصالات...) |
| `subscription_provisions` | سجل كل محاولة تزويد لكل وحدة كمية: الطلب، الحالة، الطلب/الاستجابة، بيانات الاشتراك، الخطأ |

## قالب الاتصال (`ProviderConfig`)
يُخزَّن في `config` ويحرَّر من لوحة التحكم كـ JSON، ما يتيح ربط أي API:
```json
{
  "auth": { "type": "header", "name": "X-API-Key" },
  "test": { "method": "GET", "path": "me" },
  "packages": { "method": "GET", "path": "packages", "listPath": "data", "idField": "id", "nameField": "name" },
  "create": { "method": "POST", "path": "lines", "body": { "package_id": "{{packageId}}", "months": "{{params.months}}" } },
  "result": { "okPath": "ok", "errorPath": "error", "username": "data.username", "password": "data.password", "host": "data.host", "expiresAt": "data.exp_date" },
  "deliveryTemplate": "HOST:{{host}}|UserName:{{username}}|Password:{{password}}|Expires:{{expiresAt}}"
}
```
- `auth`: `header` / `bearer` / `query`.
- المتغيرات في القوالب: `{{packageId}}`, `{{params.*}}`, `{{order.number}}`, `{{customer.email|phone|name}}`, `{{sequence}}`, `{{reference}}`, `{{apiKey}}`.
- `result`: مسارات نقطية لقراءة بيانات الاشتراك من استجابة المزوّد. `okPath` يحدد النجاح (وإلا HTTP 2xx).
- `deliveryTemplate`: نص التسليم بصيغة الأكواد (أجزاء مفصولة بـ `|`).

القوالب الجاهزة في `src/infrastructure/integrations/subscriptions/presets.ts`. مسارات Shebik وFalcon
مبنية على الشكل الشائع للوحات IPTV؛ عدّلها من لوحة التحكم إن اختلفت وثائق مزوّدك.

## واجهة API (`/api/v1/subscriptions/*`)
تتطلب جلسة Better Auth وهيدر `x-store-id` بعضوية نشطة.
- `GET/POST providers`, `PATCH/DELETE providers/:id`, `POST providers/:id/test`, `GET providers/:id/packages`
- `GET/PUT/DELETE mappings`
- `GET provisions?orderId=`, `POST provisions {orderId}`, `POST provisions/:id/retry`

## الاختبار
`npm run test:smoke` يشغّل `scripts/dev/smoke-subscriptions.ts` بمزوّد وهمي محلي ويتحقق من حصر الميزة بالباقة الأعلى،
التزويد عند الدفع، صيغة الكود المُسلَّم، وعدم التكرار عند إعادة معالجة الحدث.
