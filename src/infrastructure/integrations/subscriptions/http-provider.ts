import type { EndpointSpec, ProviderConfig, ProvisionContext, ProvisionResult, PackageInfo } from "./types";

/** قراءة مسار نقطي من كائن: getPath({a:{b:1}}, "a.b") → 1. يدعم فهارس المصفوفات (items.0.id). */
export function getPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
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
    const list = getPath(call.body, spec.listPath);
    const rows: unknown[] = Array.isArray(list) ? list : list && typeof list === "object" ? Object.values(list as object) : [];
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row[spec.idField ?? "id"] ?? ""),
        name: String(row[spec.nameField ?? "name"] ?? row[spec.idField ?? "id"] ?? ""),
        raw: r,
      };
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
