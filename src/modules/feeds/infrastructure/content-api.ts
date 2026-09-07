import { createSign } from "node:crypto";
import type { MerchantProduct } from "../domain/product-payload";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/content";
const BASE = "https://shoppingcontent.googleapis.com/content/v2.1";
const TIMEOUT_MS = 20_000;

/** حساب الخدمة كما يُنزَّل من Google Cloud (نخزّن الملف كاملاً مشفّراً). */
interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export class ContentApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    /** 429 و5xx تعني «أعد المحاولة»؛ 4xx غيرها خطأ بيانات لا يُصلحه التكرار. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ContentApiError";
  }
}

export interface BatchEntry {
  batchId: number;
  method: "insert" | "delete";
  product?: MerchantProduct;
  productId?: string;
}

export interface BatchEntryResult {
  batchId: number;
  ok: boolean;
  error?: string;
  retryable: boolean;
}

export interface ProductStatus {
  productId: string;
  itemLevelIssues: { code: string; description: string; detail?: string; servability?: string }[];
}

function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContentApiError("ملف حساب الخدمة ليس JSON صالحاً");
  }
  const sa = parsed as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key) throw new ContentApiError("ملف حساب الخدمة ينقصه client_email أو private_key");
  return { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") };
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** التوكن صالح ساعة؛ نحتفظ به في الذاكرة ونجدّده قبل انتهائه بدقيقة. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function accessToken(sa: ServiceAccount): Promise<string> {
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign("RSA-SHA256").update(unsigned);
  const jwt = `${unsigned}.${signer.sign(sa.private_key, "base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new ContentApiError(body.error_description ?? `فشل الحصول على توكن (${res.status})`, res.status, res.status >= 500);
  }

  tokenCache.set(sa.client_email, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}

/**
 * عميل Content API for Shopping v2.1.
 * كل ما يخص إصدار واجهة جوجل محبوس في هذا الملف؛ الانتقال إلى Merchant API
 * الأحدث يمسّه وحده ولا يمسّ منطق المزامنة.
 */
export function contentApiClient(serviceAccountJson: string, merchantId: string) {
  const sa = parseServiceAccount(serviceAccountJson);

  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const token = await accessToken(sa);
    const res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 500);
      throw new ContentApiError(text || `HTTP ${res.status}`, res.status, res.status === 429 || res.status >= 500);
    }
    return (await res.json()) as T;
  }

  return {
    /**
     * دفعة واحدة حتى ١٠٠٠ عنصر. الاستجابة تُقرأ عنصراً عنصراً:
     * الدفعة تنجح جزئياً، فمعاملتها كوحدة واحدة تُسقط منتجات سليمة.
     */
    async batch(entries: BatchEntry[]): Promise<BatchEntryResult[]> {
      if (entries.length === 0) return [];
      const body = {
        entries: entries.map((e) => ({
          batchId: e.batchId,
          merchantId,
          method: e.method,
          ...(e.method === "insert" ? { product: e.product } : { productId: e.productId }),
        })),
      };
      const result = await call<{
        entries?: { batchId: number; errors?: { errors?: { reason?: string; message?: string }[] } }[];
      }>("/products/batch", { method: "POST", body });

      return (result.entries ?? []).map((entry) => {
        const errors = entry.errors?.errors ?? [];
        if (errors.length === 0) return { batchId: entry.batchId, ok: true, retryable: false };
        const message = errors.map((e) => `${e.reason ?? ""}: ${e.message ?? ""}`.trim()).join(" | ");
        // internalError و rateLimitExceeded عابران؛ ما عداهما خطأ بيانات.
        const retryable = errors.some((e) => /internalError|rateLimitExceeded|backendError|quotaExceeded/i.test(e.reason ?? ""));
        return { batchId: entry.batchId, ok: false, error: message.slice(0, 500), retryable };
      });
    },

    /** كل المنتجات المرفوعة فعلاً عند جوجل — أساس كشف الانحراف. */
    async listProductIds(): Promise<string[]> {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ maxResults: "250", ...(pageToken ? { pageToken } : {}) });
        const page = await call<{ resources?: { id: string }[]; nextPageToken?: string }>(
          `/${encodeURIComponent(merchantId)}/products?${query}`,
        );
        for (const r of page.resources ?? []) ids.push(r.id);
        pageToken = page.nextPageToken;
      } while (pageToken);
      return ids;
    },

    /** حالات الموافقة والرفض — بدونها تكتشف تعليق نصف الكتالوج بعد أسبوعين. */
    async listProductStatuses(): Promise<ProductStatus[]> {
      const statuses: ProductStatus[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ maxResults: "250", ...(pageToken ? { pageToken } : {}) });
        const page = await call<{ resources?: ProductStatus[]; nextPageToken?: string }>(
          `/${encodeURIComponent(merchantId)}/productstatuses?${query}`,
        );
        statuses.push(...(page.resources ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return statuses;
    },
  };
}

export type ContentApiClient = ReturnType<typeof contentApiClient>;
