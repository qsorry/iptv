import type { EndpointSpec, ProviderConfig, ProvisionContext, ProvisionResult, PackageInfo } from "./types";

function getSinglePath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * قراءة مسار نقطي من كائن: getPath({a:{b:1}}, "a.b") → 1. يدعم فهارس المصفوفات (items.0.id)،
 * وعدة بدائل مفصولة بـ | ("rows|data|packages"): أول مسار له قيمة يفوز.
 */
export function getPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  for (const alt of path.split("|")) {
    const v = getSinglePath(obj, alt.trim());
    if (v != null && v !== "") return v;
  }
  return undefined;
}

/** يستبدل {{a.b}} بقيم من الكائن. القيم غير الموجودة تصبح فارغة. */
export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = getPath(vars, key);
    return v == null ? "" : String(v);
  });
}

function renderDeep(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    // قيمة كاملة عبارة عن قالب واحد → نُبقي النوع الأصلي (رقم/منطقي).
    const m = value.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (m) {
      const v = getPath(vars, m[1]);
      return v === undefined ? "" : v;
    }
    return renderTemplate(value, vars);
  }
  if (Array.isArray(value)) return value.map((v) => renderDeep(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, renderDeep(v, vars)]));
  }
  return value;
}

function joinUrl(base: string, path: string): URL {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  const b = base.endsWith("/") ? base : `${base}/`;
  return new URL(path.replace(/^\//, ""), b);
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** يستخرج المدة وعدد الاتصالات والكريدت من صف باقة بأسماء الحقول الشائعة في لوحات IPTV. */
export function extractPackageMeta(row: Record<string, unknown>): PackageInfo["meta"] {
  const meta: PackageInfo["meta"] = {};
  const dur = num(getPath(row, "official_duration|duration"));
  const unit = String(getPath(row, "official_duration_in|duration_in|duration_unit") ?? "").toLowerCase();
  if (dur != null && dur > 0) {
    if (/year/.test(unit)) meta.months = dur * 12;
    else if (/month/.test(unit)) meta.months = dur;
    else if (/day/.test(unit)) meta.days = dur;
    else if (/hour/.test(unit)) meta.days = Math.max(1, Math.round(dur / 24));
  }
  const months = num(getPath(row, "months|duration_months"));
  if (meta.months == null && meta.days == null && months) meta.months = months;
  const days = num(getPath(row, "days|duration_days"));
  if (meta.months == null && meta.days == null && days) meta.days = days;
  const cons = num(getPath(row, "max_connections|connections|max_cons|devices"));
  if (cons != null) meta.connections = cons;
  const credits = num(getPath(row, "credits|price|cost"));
  if (credits != null) meta.credits = credits;
  return meta;
}

/** اسم عربي موحّد للباقة: "15 شهر · جهازين". يرجع الاسم الأصلي إن لم تتوفر مدة. */
export function packageLabel(pkg: Pick<PackageInfo, "name" | "meta">): string {
  const parts: string[] = [];
  const m = pkg.meta.months;
  const d = pkg.meta.days;
  if (m != null) parts.push(m === 1 ? "شهر واحد" : m === 2 ? "شهرين" : m >= 3 && m <= 10 ? `${m} أشهر` : `${m} شهر`);
  else if (d != null) parts.push(d === 1 ? "يوم واحد" : d === 2 ? "يومين" : d >= 3 && d <= 10 ? `${d} أيام` : `${d} يوم`);
  else parts.push("مدة غير محددة");
  const c = pkg.meta.connections;
  if (c != null) parts.push(c === 1 ? "جهاز واحد" : c === 2 ? "جهازين" : c >= 3 && c <= 10 ? `${c} أجهزة` : `${c} جهاز`);
  // لا مدة ولا أجهزة: لا معلومات كافية، نعرض الاسم الأصلي.
  if (parts.length === 1 && pkg.meta.connections == null) return pkg.name;
  return parts.join(" · ");
}

export interface HttpCall {
  url: string;
  status: number;
  body: unknown;
  text: string;
}

/**
 * مزوّد عام يعمل بأي API عبر قالب ProviderConfig. القوالب الجاهزة (shebik/falcon) مجرد إعدادات له.
 * لا يحتفظ بحالة؛ آمن للاستدعاء من أي مكان في الخادم.
 */
export class HttpSubscriptionProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly config: ProviderConfig,
  ) {}

  private async call(spec: EndpointSpec, vars: Record<string, unknown>): Promise<HttpCall> {
    const allVars = { ...vars, apiKey: this.apiKey };
    const url = joinUrl(this.baseUrl, renderTemplate(spec.path, allVars));
    for (const [k, v] of Object.entries(spec.query ?? {})) url.searchParams.set(k, renderTemplate(v, allVars));
    const headers: Record<string, string> = { Accept: "application/json", ...(this.config.headers ?? {}) };

    const auth = this.config.auth;
    if (auth.type === "header") headers[auth.name] = this.apiKey;
    else if (auth.type === "bearer") headers.Authorization = `Bearer ${this.apiKey}`;
    else url.searchParams.set(auth.name, this.apiKey);

    let body: string | undefined;
    if (spec.method !== "GET" && spec.body) {
      const rendered = renderDeep(spec.body, allVars) as Record<string, unknown>;
      if ((spec.contentType ?? "json") === "form") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        body = new URLSearchParams(Object.entries(rendered).map(([k, v]) => [k, v == null ? "" : String(v)])).toString();
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(rendered);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 20_000);
    try {
      const res = await fetch(url, { method: spec.method, headers, body, signal: controller.signal, cache: "no-store" });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }
      return { url: url.toString(), status: res.status, body: parsed, text };
    } finally {
      clearTimeout(timer);
    }
  }

  /** يُخفي المفتاح من أي نص قد يُخزَّن أو يُعرض. */
  private redact(s: string): string {
    return this.apiKey ? s.split(this.apiKey).join("***") : s;
  }

  private readError(call: HttpCall): string {
    const fromPath = this.config.result.errorPath ? getPath(call.body, this.config.result.errorPath) : undefined;
    if (fromPath) return String(fromPath);
    const b = call.body as Record<string, unknown> | null;
    const generic = b?.error ?? b?.message ?? b?.msg;
    if (generic) return typeof generic === "string" ? generic : JSON.stringify(generic);
    return `HTTP ${call.status}: ${this.redact(call.text.slice(0, 200))}`;
  }

  private isOk(call: HttpCall): boolean {
    if (call.status < 200 || call.status >= 300) return false;
    if (this.config.result.okPath) return Boolean(getPath(call.body, this.config.result.okPath));
    return true;
  }

  /** اختبار الاتصال: نداء test إن وُجد، وإلا نداء الباقات. */
  async test(): Promise<{ ok: boolean; message: string }> {
    const spec = this.config.test ?? this.config.packages;
    if (!spec) return { ok: false, message: "لا يوجد نداء اختبار مُعرَّف في القالب" };
    try {
      const call = await this.call(spec, {});
      if (this.isOk(call)) return { ok: true, message: `الاتصال ناجح (HTTP ${call.status})` };
      // المزوّد قبل المفتاح (لم يرد 401/403) لكن مسار الاختبار غير موجود: المفتاح صحيح والقالب يحتاج ضبط المسار.
      if (call.status === 404) return { ok: true, message: "المفتاح مقبول، لكن مسار الاختبار في القالب غير موجود لدى المزوّد (404). راجع مسارات القالب قبل أول طلب." };
      return { ok: false, message: this.readError(call) };
    } catch (e) {
      return { ok: false, message: this.redact(e instanceof Error ? e.message : String(e)) };
    }
  }

  async listPackages(): Promise<PackageInfo[]> {
    const spec = this.config.packages;
    if (!spec) return [];
    const call = await this.call(spec, {});
    if (!this.isOk(call)) throw new Error(this.readError(call));
    const list = getPath(call.body, spec.listPath) ?? (Array.isArray(call.body) ? call.body : undefined);
    if (list == null || typeof list !== "object") {
      throw new Error(`لم أجد قائمة الباقات في استجابة المزوّد (المسار: ${spec.listPath ?? "الجذر"}). الاستجابة: ${this.redact(call.text.slice(0, 300))}`);
    }
    const rows: unknown[] = Array.isArray(list) ? list : Object.values(list as object);
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      const id = String(getPath(row, spec.idField ?? "id|package_id|pid") ?? "");
      // قالب الاسم يُقسَّم عند "·"؛ يُحذف أي مقطع لم تُملأ فيه أي قيمة (مثل "· conn" بلا رقم).
      let name = spec.nameTemplate
        ? spec.nameTemplate
            .split("·")
            .filter((seg) => {
              const vars = [...seg.matchAll(/\{\{\s*([\w.|]+)\s*\}\}/g)].map((m) => m[1]);
              return vars.length === 0 || vars.some((v) => getPath(row, v) != null && getPath(row, v) !== "");
            })
            .map((seg) => renderTemplate(seg, row).replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .join(" · ")
        : "";
      if (!name) name = String(getPath(row, spec.nameField ?? "name|title|label|package_name|pkg_name|plan_name") ?? "");
      if (!name) {
        // تركيب اسم مقروء من حقول المدة/الاتصالات الشائعة في لوحات IPTV.
        const dur = getPath(row, "official_duration|duration|months|days");
        const unit = getPath(row, "official_duration_in|duration_in|duration_unit") ?? (getPath(row, "months") != null ? "months" : getPath(row, "days") != null ? "days" : "");
        const cons = getPath(row, "max_connections|connections|max_cons");
        name = [dur != null ? `${dur} ${unit}` : "", cons != null ? `${cons} conn` : ""].filter(Boolean).join(" · ").trim();
      }
      return { id, name: name || id, meta: extractPackageMeta(row), raw: r };
    });
  }

  /** إنشاء اشتراك واحد. لا يرمي عند فشل المزوّد؛ يرجّع ok=false مع السبب. */
  async createSubscription(ctx: ProvisionContext): Promise<ProvisionResult> {
    const vars: Record<string, unknown> = { ...ctx, packageId: ctx.packageId, params: ctx.params };
    let call: HttpCall;
    try {
      call = await this.call(this.config.create, vars);
    } catch (e) {
      return { ok: false, error: this.redact(e instanceof Error ? e.message : String(e)), credentials: {}, raw: null, httpStatus: 0 };
    }
    const raw = call.body ?? this.redact(call.text.slice(0, 2000));
    if (!this.isOk(call)) return { ok: false, error: this.readError(call), credentials: {}, raw, httpStatus: call.status };

    const r = this.config.result;
    const credentials: Record<string, unknown> = {};
    for (const key of ["username", "password", "host", "expiresAt", "m3u"] as const) {
      const v = r[key] ? getPath(call.body, r[key]) : undefined;
      if (v != null && v !== "") credentials[key] = v;
    }
    const extra: Record<string, unknown> = {};
    for (const [name, path] of Object.entries(r.extra ?? {})) {
      const v = getPath(call.body, path);
      if (v != null && v !== "") extra[name] = v;
    }
    if (Object.keys(extra).length) credentials.extra = extra;
    // حقول مشتقة (مثل رابط M3U من الهوست واسم المستخدم) عندما لا يرجعها المزوّد مباشرة.
    for (const [key, tpl] of Object.entries(this.config.derive ?? {})) {
      if (credentials[key] != null) continue;
      const needed = [...tpl.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
      if (needed.every((k) => getPath(credentials, k) != null)) credentials[key] = renderTemplate(tpl, credentials);
    }

    const deliveredCode = renderTemplate(this.config.deliveryTemplate, credentials)
      .split("|")
      .map((s) => s.trim())
      // أزل الأجزاء التي بقيت بلا قيمة (مثل "M3U:").
      .filter((s) => s && !/:\s*$/.test(s))
      .join("|");

    if (!deliveredCode) {
      return { ok: false, error: "نجح النداء لكن لم تُقرأ بيانات الاشتراك من الاستجابة؛ راجع خريطة النتيجة (result)", credentials, raw, httpStatus: call.status };
    }
    return { ok: true, credentials, deliveredCode, raw, httpStatus: call.status };
  }
}
