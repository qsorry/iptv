/** طريقة تمرير مفتاح API للمزوّد. */
export type AuthSpec =
  | { type: "header"; name: string } // X-API-Key: <key>
  | { type: "bearer" } // Authorization: Bearer <key>
  | { type: "query"; name: string }; // ?api_key=<key>

/** مواصفة نداء HTTP واحد. المسار والقيم تقبل قوالب {{...}}. */
export interface EndpointSpec {
  method: "GET" | "POST" | "PUT";
  /** نسبي إلى baseUrl، أو مطلق. */
  path: string;
  query?: Record<string, string>;
  /** جسم الطلب (قوالب في القيم). */
  body?: Record<string, unknown>;
  contentType?: "json" | "form";
}

/** خريطة قراءة نتيجة الإنشاء من JSON عبر مسارات نقطية (data.user.username). */
export interface ResultMap {
  /** مسار حقل النجاح (قيمة truthy = نجاح). إن غاب: نجاح = HTTP 2xx. */
  okPath?: string;
  /** مسار رسالة الخطأ. */
  errorPath?: string;
  username?: string;
  password?: string;
  host?: string;
  expiresAt?: string;
  m3u?: string;
  /** حقول إضافية تُحفظ وتُعرض للعميل (اسم → مسار). */
  extra?: Record<string, string>;
}

export interface PackagesSpec extends EndpointSpec {
  /** مسار المصفوفة في الاستجابة (مثال: data). فارغ = الجذر. */
  listPath?: string;
  /** حقل المعرّف (يقبل بدائل مفصولة بـ |). */
  idField?: string;
  /** حقل الاسم (يقبل بدائل مفصولة بـ |). */
  nameField?: string;
  /** قالب اسم العرض من حقول الصف، مثال: "{{name}} ({{max_connections}} conn)". */
  nameTemplate?: string;
}

/**
 * قالب الاتصال الكامل بمزوّد. يُخزَّن في subscription_providers.config
 * ويمكن للتاجر تعديله لربط أي API لاشتراكات رقمية.
 */
export interface ProviderConfig {
  auth: AuthSpec;
  headers?: Record<string, string>;
  /** نداء خفيف لاختبار الاتصال. */
  test?: EndpointSpec;
  /** جلب قائمة الباقات (اختياري). */
  packages?: PackagesSpec;
  /** إنشاء الاشتراك؛ إلزامي. */
  create: EndpointSpec;
  result: ResultMap;
  /** حقول تُشتق بقالب من الحقول المقروءة إن لم يرجعها المزوّد (مثال: m3u من host/username/password). */
  derive?: Record<string, string>;
  /**
   * نص التسليم للعميل بصيغة digital_codes (أجزاء مفصولة بـ |).
   * المتغيرات: {{username}} {{password}} {{host}} {{expiresAt}} {{m3u}} و{{extra.<name>}}.
   */
  deliveryTemplate: string;
  /** مهلة النداء بالمللي ثانية. */
  timeoutMs?: number;
}

/** سياق يُستخدم لملء القوالب عند إنشاء اشتراك. */
export interface ProvisionContext {
  packageId: string;
  params: Record<string, unknown>;
  order: { id: string; number: string };
  customer: { email?: string | null; phone?: string | null; name?: string | null };
  sequence: number;
  /** مرجع فريد لهذه المحاولة (يفيد المزوّد كـ idempotency key). */
  reference: string;
}

export interface ProvisionResult {
  ok: boolean;
  error?: string;
  credentials: Record<string, unknown>;
  deliveredCode?: string;
  raw: unknown;
  httpStatus: number;
}

export interface PackageInfo {
  id: string;
  name: string;
  raw: unknown;
}
