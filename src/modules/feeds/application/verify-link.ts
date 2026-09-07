import { and, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { merchantSyncState } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { contentApiClient, ContentApiError } from "../infrastructure/content-api";
import { listCatalogRows } from "./catalog-rows";
import { merchantConfig } from "./merchant-sync";

export interface LinkCheck {
  label: string;
  status: "ok" | "fail" | "warn";
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  checks: LinkCheck[];
}

/**
 * «التحقق من الربط» لا «اختبار الاتصال».
 * نجاح OAuth وحده لا يعني أن Merchant Center يعمل: قد يكون التوكن صالحاً
 * وحساب الخدمة غير مضاف كمستخدم، أو الحساب متصلاً والكتالوج فارغاً،
 * أو الرفع يعمل ونصف المنتجات مرفوضة. لذلك نفحص السلسلة كاملة ونعرض كل حلقة.
 */
export async function verifyMerchantLink(ctx: StoreContext): Promise<VerifyResult> {
  requireRole(ctx, "owner", "admin");
  const checks: LinkCheck[] = [];

  const config = await merchantConfig(ctx.storeId);
  if (!config) {
    return { ok: false, checks: [{ label: "الإعداد", status: "fail", detail: "التكامل غير مفعّل أو تنقصه بياناته" }] };
  }
  checks.push({ label: "الإعداد", status: "ok", detail: `Merchant ID ${config.merchantId} · ${config.target.contentLanguage}-${config.target.targetCountry}` });

  const client = contentApiClient(config.serviceAccountJson, config.merchantId);

  // حلقتان في طلب واحد: صلاحية التوكن، ثم صلاحية الوصول إلى هذا الحساب.
  let remoteCount: number | null = null;
  try {
    const ids = await client.listProductIds();
    remoteCount = ids.length;
    checks.push({ label: "حساب الخدمة", status: "ok", detail: "التوكن صالح والحساب يقبل الوصول" });
  } catch (e) {
    const error = e instanceof ContentApiError ? e : null;
    const forbidden = error?.statusCode === 401 || error?.statusCode === 403;
    checks.push({
      label: "حساب الخدمة",
      status: "fail",
      detail: forbidden
        ? "التوكن صالح لكن الحساب لا يملك صلاحية: أضف بريد حساب الخدمة كمستخدم في Merchant Center"
        : (error?.message ?? (e instanceof Error ? e.message : "تعذّر الوصول")).slice(0, 200),
    });
    return { ok: false, checks };
  }

  const local = await listCatalogRows(ctx.storeId);
  const [state] = await db
    .select({
      synced: sql<number>`count(*) filter (where ${merchantSyncState.status} = 'synced')::int`,
      pending: sql<number>`count(*) filter (where ${merchantSyncState.status} in ('pending','pending_delete'))::int`,
      disapproved: sql<number>`count(*) filter (where ${merchantSyncState.status} = 'disapproved')::int`,
      failed: sql<number>`count(*) filter (where ${merchantSyncState.status} = 'failed')::int`,
      lastSyncedAt: sql<Date | null>`max(${merchantSyncState.lastSyncedAt})`,
    })
    .from(merchantSyncState)
    .where(eq(merchantSyncState.storeId, ctx.storeId));

  checks.push({
    label: "الكتالوج",
    status: remoteCount === 0 && local.length > 0 ? "warn" : "ok",
    detail: `${local.length} منتجاً في المتجر · ${remoteCount} عند جوجل`,
  });

  if (state?.lastSyncedAt) {
    checks.push({ label: "آخر مزامنة", status: "ok", detail: new Date(state.lastSyncedAt).toISOString().slice(0, 16).replace("T", " ") });
  } else {
    checks.push({ label: "آخر مزامنة", status: "warn", detail: "لم يُرفع الكتالوج بعد — اضغط «رفع الكتالوج كاملاً»" });
  }

  if ((state?.pending ?? 0) > 0) {
    checks.push({ label: "الطابور", status: "warn", detail: `${state.pending} منتجاً ينتظر الإرسال — تأكّد أن المجدول يعمل` });
  }
  if ((state?.disapproved ?? 0) > 0 || (state?.failed ?? 0) > 0) {
    checks.push({ label: "المشاكل", status: "warn", detail: `${state?.disapproved ?? 0} مرفوض · ${state?.failed ?? 0} فشل إرسال` });
  }

  return { ok: checks.every((c) => c.status !== "fail"), checks };
}

/** ملخص سطري صالح للعرض بعد إعادة التوجيه. */
export function summarizeChecks(result: VerifyResult): string {
  const mark = { ok: "✓", warn: "!", fail: "✕" } as const;
  return result.checks.map((c) => `${mark[c.status]} ${c.label}: ${c.detail}`).join(" · ");
}

/** آخر مزامنة ناجحة للمتجر — يظهر في رأس صف المنصة. */
export async function lastMerchantSync(storeId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: sql<Date | null>`max(${merchantSyncState.lastSyncedAt})` })
    .from(merchantSyncState)
    .where(and(eq(merchantSyncState.storeId, storeId)));
  return row?.at ? new Date(row.at) : null;
}
