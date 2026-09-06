import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ForbiddenError } from "@/core/errors";
import { FEATURES, hasFeature, HIGHEST_PLAN } from "@/modules/billing";

/** هل المتجر يملك ميزة ربط الاشتراكات عبر API (الباقة الأعلى أو منح مفرد). */
export async function canUseSubscriptionsApi(storeId: string): Promise<boolean> {
  return hasFeature(storeId, FEATURES.subscriptionsApi);
}

/** يمنع أي عملية إدارة للربط ما لم يكن المتجر مؤهلاً والمستخدم مديراً. */
export async function requireSubscriptionsApi(ctx: StoreContext) {
  requireRole(ctx, "owner", "admin");
  if (!(await canUseSubscriptionsApi(ctx.storeId))) {
    throw new ForbiddenError(`ربط الاشتراكات عبر API متاح لباقة «${HIGHEST_PLAN.name}» فقط`);
  }
}
