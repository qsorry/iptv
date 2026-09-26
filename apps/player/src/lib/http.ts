/**
 * طلبات HTTP عبر XMLHttpRequest لا fetch: تلفزيونات Chromium 53–65 بلا AbortController،
 * وXHR يدعم المهلة والإلغاء في كل المنصات.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly kind: "status" | "network" | "timeout" | "parse" | "aborted",
    public readonly status = 0,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: { aborted: boolean; onabort?: (() => void) | null };
}

export function request(url: string, opts: RequestOptions = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method ?? "GET", url, true);
    xhr.timeout = opts.timeoutMs ?? 20000;
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v);
    let body: string | undefined;
    if (opts.body !== undefined) {
      xhr.setRequestHeader("Content-Type", "application/json");
      body = JSON.stringify(opts.body);
    }
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new HttpError("تعذّر الاتصال بالخادم. تحقق من الإنترنت.", "network"));
    xhr.ontimeout = () => reject(new HttpError("انتهت مهلة الاتصال بالخادم.", "timeout"));
    xhr.onabort = () => reject(new HttpError("أُلغي الطلب.", "aborted"));
    if (opts.signal) {
      if (opts.signal.aborted) return xhr.abort();
      opts.signal.onabort = () => xhr.abort();
    }
    xhr.send(body);
  });
}

/** JSON مع رسالة الخادم إن أرسل { error: { message } }. */
export async function requestJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, opts);
  let data: unknown;
  try {
    data = res.text ? JSON.parse(res.text) : null;
  } catch {
    throw new HttpError(res.status >= 400 ? `خطأ من الخادم (${res.status})` : "رد غير متوقع من الخادم.", res.status >= 400 ? "status" : "parse", res.status);
  }
  if (res.status >= 400) {
    const msg = (data as { error?: { message?: string } } | null)?.error?.message;
    throw new HttpError(msg || `خطأ من الخادم (${res.status})`, "status", res.status);
  }
  return data as T;
}

/** إشارة إلغاء بسيطة متوافقة مع كل المتصفحات. */
export function createAbort() {
  const signal: { aborted: boolean; onabort: (() => void) | null } = { aborted: false, onabort: null };
  return {
    signal,
    abort() {
      if (signal.aborted) return;
      signal.aborted = true;
      signal.onabort?.();
    },
  };
}
