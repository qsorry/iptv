import { desc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { plans, stores, storeSubscriptions } from "@/infrastructure/database/schema";
import { env } from "@/lib/env";
import { ForbiddenError } from "@/core/errors";

/** مدير المنصة = إيميله ضمن PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function requirePlatformAdmin(email: string | null | undefined) {
  if (!isPlatformAdmin(email)) throw new ForbiddenError("هذه الصفحة لمديري المنصة فقط");
}

/** كل متاجر المنصة مع باقتها الحالية (للوحة إدارة المنصة). */
export async function listStoresWithPlans() {
  return db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      status: stores.status,
      createdAt: stores.createdAt,
      planCode: plans.code,
      planName: plans.name,
      subscriptionStatus: storeSubscriptions.status,
      currentPeriodEnd: storeSubscriptions.currentPeriodEnd,
    })
    .from(stores)
    .leftJoin(storeSubscriptions, eq(storeSubscriptions.storeId, stores.id))
    .leftJoin(plans, eq(plans.id, storeSubscriptions.planId))
    .orderBy(desc(stores.createdAt));
}
