import { ForbiddenError } from "@/core/errors";

/** سياق المستأجر الذي تمرره كل حالة استخدام. لا استعلام تجاري بدون store_id. */
export interface StoreContext {
  storeId: string;
  userId?: string;
  role?: "owner" | "admin" | "staff";
}

export function requireRole(ctx: StoreContext, ...roles: NonNullable<StoreContext["role"]>[]) {
  if (!ctx.role || !roles.includes(ctx.role)) throw new ForbiddenError();
}

/** الهيدرات التي يضعها middleware بعد قراءة Host. */
export const TENANT_HEADERS = {
  slug: "x-store-slug",
  customDomain: "x-store-domain",
} as const;

export const ACTIVE_STORE_COOKIE = "active_store";

/**
 * يحدد المتجر من Host:
 *   shop.platform.com  → { slug: "shop" }
 *   platform.com       → null (الموقع الرئيسي / لوحة التحكم)
 *   www.myshop.com     → { customDomain: "www.myshop.com" }
 */
export function resolveTenantFromHost(host: string, platformDomain: string): { slug?: string; customDomain?: string } | null {
  const h = host.toLowerCase();
  const p = platformDomain.toLowerCase();
  if (h === p || h === `www.${p}`) return null;
  if (h.endsWith(`.${p}`)) {
    const slug = h.slice(0, -(p.length + 1));
    return slug && !slug.includes(".") ? { slug } : null;
  }
  return { customDomain: h };
}
