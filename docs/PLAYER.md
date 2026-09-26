# تطبيق المشغّل — Ssouq Net Player

مشغّل وسائط لقوائم IPTV (Xtream Codes وM3U) للجوال والتلفاز: Samsung (Tizen)، LG (webOS)، VIDAA، Android TV وجوالات Android،
مبني على تصميم «Ssouq Net Player» (الدخول، الرئيسية، مباشر ودليل البرامج، الأفلام، المسلسلات، المكتبة).
**التطبيق لا يحتوي على أي محتوى**: يتصل بخادم المزوّد مباشرة، والمنصة لا ترى البث ولا تمرّره.

## الأجزاء

| الجزء | المكان | الدور |
|---|---|---|
| التطبيق | `apps/player` | React + TypeScript + Vite. حزمة واحدة لكل الأجهزة، تعمل من `file://` على التلفزيونات. |
| خادم المنصة | `src/modules/player` + `src/app/api/v1/player/*` | التعرّف على المزوّد، أكواد التفعيل، ربط التلفاز بالجوال. |
| لوحة المشغّل | `/admin/platform/player` (رابط «تطبيق المشغّل» في القائمة الجانبية لمديري المنصة) | المؤشرات، الدخول اليومي، المزوّدون، آخر العمليات، إصدار كود سريع، وتنزيل التطبيق. |
| إعدادات مزوّد | `/admin/platform/providers/[id]/player` | خوادم المزوّد وبادئات أسماء المستخدمين وأكواد التفعيل (لمدير المنصة). |
| ربط التلفاز | `/player/pair` | الصفحة التي يفتحها الجوال بعد مسح QR الظاهر على التلفاز. |

## كيف يسجّل المستخدم الدخول

1. **اسم المستخدم**: يكتب اسم المستخدم فيتعرّف التطبيق على المزوّد من أطول بادئة مسجّلة (`GET /api/v1/player/detect`)،
   ثم يتحقق من كلمة المرور لدى خادم المزوّد مباشرة (`player_api.php`).
2. **كود التفعيل** `SN-XXXX-XXXX`: أثناء الكتابة يتحقق التطبيق منه بلا أثر (`POST /api/v1/player/activate` مع `dryRun: true`: اسم المزوّد فقط)،
   وعند «دخول» يُستبدل ببيانات الحساب (بلا `dryRun`). يعمل على أكثر من جهاز حتى يُلغى أو ينتهي. تاريخ الانتهاء يعني نهاية ذلك اليوم بتوقيت السعودية.
3. **الربط بالجوال (التلفاز)**: التلفاز يعرض QR ورمزاً (`POST /api/v1/player/pairings`)، الجوال يفتح `/player/pair` ويرسل الكود
   أو البيانات، والتلفاز يستطلع (`GET /api/v1/player/pairings/:id` برمز Bearer) ويستلم الحساب **مرة واحدة** ثم تُمسح الحمولة.
4. **يدوياً**: خادم Xtream (رابط + مستخدم + كلمة مرور) أو رابط M3U. رابط `get.php?username=…` يُحوَّل تلقائياً إلى حساب Xtream.

لا يتعرّف التطبيق على مزوّد ولا تعمل أكواده إلا إن كان المزوّد `approved` والخادم مفعّلاً؛ إيقاف المزوّد يوقف التطبيق فوراً.
أطول بادئة تحدد المزوّد دائماً: إن كان صاحبها موقوفاً فلا تعرّف، ولا يسقط التطبيق أبداً إلى بادئة أقصر لمزوّد آخر
(وإلا أُرسلت بيانات مشتركي مزوّد إلى خادم غيره). داخل المزوّد نفسه يُستخدم خادم مفعّل آخر إن عُطّل الأطول.

## الخادم (`src/modules/player`)

| الجدول | الغرض |
|---|---|
| `provider_servers` | خوادم Xtream لكل مزوّد: الاسم الظاهر («الخادم A») والأصل `http://host:port` |
| `provider_username_prefixes` | بادئات أسماء المستخدمين، فريدة على مستوى المنصة (أطول بادئة تفوز) |
| `player_activation_codes` | الأكواد: الخادم، اسم المستخدم، كلمة المرور **مشفّرة** (AES-GCM)، الحالة، الانتهاء، عدد الاستخدام |
| `player_pairings` | طلبات الربط: رمز قصير، بصمة رمز الاستطلاع، حمولة مشفّرة تُمسح بعد الاستلام، صلاحية 10 دقائق |
| `player_activity` | كل دخول مرّ عبر المنصة: `code_redeemed` (دخول التطبيق بكود، عند ضغط «دخول») أو `tv_paired` (ربط تلفاز، ولو بكود — يُحسب مرة واحدة، ولحظة استلام التلفاز للحساب لا لحظة إرسال الجوال). مصدر لوحة المشغّل |

- الحالات عبر `activationCodeStateMachine` (active → revoked) و`pairingStateMachine` (pending → completed → consumed / expired).
- كل إضافة/تعديل/حذف لخادم وإصدار/إلغاء كود يُسجَّل في `audit_logs` ويظهر في سجل صفحة المزوّد.
- الواجهات العامة ترسل `Access-Control-Allow-Origin: *` (لا كوكيز) ومحدودة المعدل لكل IP في الذاكرة (`src/lib/rate-limit.ts`).
- كل أسباب فشل الكود ترجع 404 برسالة واحدة حتى لا يُستدل منها على وجوده.

## التطبيق (`apps/player`)

```
src/catalog     عميل Xtream، محلل M3U، الدليل (EPG)، والنموذج الموحّد (CatalogSource)
src/lib         الحسابات، السجل والمفضلة، الإعدادات، التنسيق العربي، واجهة خادم المنصة
src/nav         الموجّه (hash)، التنقل بالأسهم (spatial)، معالجات الريموت
src/platform    Tizen / webOS / Android / VIDAA / المتصفح: أزرار الريموت والخروج
src/player      محرك التشغيل (أصلي / hls.js / mpegts.js) وشاشة التشغيل
src/screens     الشاشات
src/styles      الرموز (tokens.css) ثم الأساسيات والمكوّنات والشاشات
platforms/      Tizen (config.xml)، webOS (appinfo.json)، Android (غلاف WebView)
```

قواعد تحكم هذا الكود:
- **متوافق مع تلفزيونات 2018+ (Chromium 53)**: لا flex `gap` ولا CSS grid ولا `inset`/`aspect-ratio`/`:focus-visible` ولا hex بثمانية أرقام؛
  المسافات بأدوات `stack-*`/`row-*`، والطلبات عبر XHR لا fetch. البناء legacy فقط (بلا `type="module"`) و`cssTarget: chrome53`.
- **التلفاز يُكبَّر بالـ rem**: `html.tv { font-size: 1.25vw }` فتطابق شاشة 1920 تصميم 1280.
- **لا ألوان ثابتة في المكوّنات**: كلها في `src/styles/tokens.css`.
- **الريموت**: كل عنصر تفاعلي زر أو رابط حقيقي؛ `data-nav-region` يتذكر آخر عنصر في كل منطقة، و`data-nav-scope` يحصر التنقل داخل نافذة أو المشغّل،
  و`data-autofocus` أول ما يُركَّز عليه.
- **لا بيانات تجريبية داخل التطبيق**: الخادم الوهمي في `scripts/mock-xtream.mjs` للتطوير فقط.

## التطوير والاختبار

```bash
cd apps/player
npm install
npm test                 # اختبارات الوحدة (Xtream، M3U، الدليل، التنسيق، التنقل)
npm run typecheck
npm run mock             # خادم Xtream وهمي على :8090 (المستخدم 394218775 / demo-pass)
VITE_API_BASE=http://localhost:3000 npm run dev
```

للتجربة الكاملة مع خادم المنصة: شغّل `npm run dev` في الجذر، واقبل مزوّداً وأضف له خادماً `http://localhost:8090` ببادئة `394`
من `/admin/platform/providers/[id]/player`. لفرض واجهة التلفاز في المتصفح: الإعدادات → واجهة التلفاز → تشغيل (والتنقل بالأسهم وEnter وEsc).
اختبار الخادم: `npm run test:smoke` في الجذر يشغّل `scripts/dev/smoke-player.ts`.

## البناء والحزم

```bash
cd apps/player
npm run build                   # dist/ (الافتراضي VITE_API_BASE=https://com.ssouq.net)
npm run package:tizen           # release/tizen + SsouqNet-<v>-unsigned.wgt
npm run package:webos           # release/webos (+ ipk إن وُجد ares-package)
ANDROID_HOME=… npm run package:android   # APK للجوال وAndroid TV
```

| المنصة | الحزمة | التوقيع/النشر |
|---|---|---|
| Samsung Tizen | `.wgt` | وقّع بشهادة Samsung من Tizen Studio: `tizen package -t wgt -s <profile> -- release/tizen`، ثم Seller Office. |
| LG webOS | `.ipk` | `npx -p @webos-tools/cli ares-package release/webos -o release`، ثم LG Seller Lounge (أو وضع المطوّر للتجربة). |
| Android / Android TV | `.apk` | debug افتراضياً؛ للإصدار عرّف `SSOUQ_KEYSTORE` و`SSOUQ_KEYSTORE_PASSWORD` و`SSOUQ_KEY_ALIAS` و`SSOUQ_KEY_PASSWORD`. |
| VIDAA / المتصفح | موقع | `apps/player/Dockerfile` (nginx) كتطبيق Coolify منفصل بـ Base Directory = `apps/player`. |

الإصدار واحد لكل المنصات من `apps/player/package.json` (يُكتب في config.xml وappinfo.json وversionName/versionCode).

### نشر التنزيلات على موقع المنصة

لوحة المشغّل تعرض روابط التنزيل من `public/downloads/player/` (روابط ثابتة: `/downloads/player/ssouq-net.apk`
و`/downloads/player/ssouq-net-webos.ipk`، مع `manifest.json` بالإصدار والحجم وSHA-256). لتحديثها:

```bash
cd apps/player
npm version patch --no-git-tag-version       # رفع الإصدار
npm run build
SSOUQ_KEYSTORE=/مسار/ssouq-net-release.jks SSOUQ_KEYSTORE_PASSWORD=… SSOUQ_KEY_ALIAS=ssouq-net SSOUQ_KEY_PASSWORD=… \
  ANDROID_HOME=… npm run package:android
npm run package:webos && npx -p @webos-tools/cli ares-package release/webos -o release
npm run publish:downloads                    # يرفض نسخة debug
```

**مفتاح توقيع Android** (`ssouq-net-release.jks`) خارج المستودع ويحتفظ به صاحب المنصة. كل تحديث يجب أن يُوقَّع بنفس المفتاح،
وإلا يرفض Android تثبيته فوق النسخة القديمة (على المستخدم حذف التطبيق أولاً). بصمة الشهادة الحالية (SHA-256):
`45:7D:35:7C:66:65:A8:25:4F:3D:C7:97:AC:F2:E2:44:F9:89:10:A7:E4:D4:E4:01:F8:4D:1F:6F:AE:E2:1D:B2`.

## حدود معروفة

- **المتصفح (https)**: المتصفح يمنع تشغيل خوادم `http://` داخل صفحة https (المحتوى المختلط)، وخوادم كثيرة بلا CORS.
  التطبيقات المحزومة (Tizen/webOS/Android) لا تتأثر لأنها تعمل من `file://`. نسخة الويب مناسبة لمزوّدي https فقط،
  أو تُستضاف على دومين http خاص بتلفزيونات VIDAA.
- **الترميزات**: التشغيل يعتمد على ما يدعمه الجهاز (H.264/HEVC/AC3 تختلف بين الطرازات). عند تعذّر البث المباشر يعرض المشغّل
  خيار التبديل بين HLS وTS.
- **الدليل**: من `get_short_epg` لكل قناة (Xtream). قوائم M3U بلا دليل حالياً (XMLTV غير مدعوم بعد).
- **iOS**: غير محزوم بعد؛ نسخة الويب تعمل في Safari لمزوّدي https.
