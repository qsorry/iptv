import { and, eq, gt, or, isNull } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { plans, storeSubscriptions, storeEntitlements } from "@/infrastructure/database/schema";
import { FREE_FEATURES, type Feature } from "../features";

/** كل الميزات المفعّلة لمتجر: المجانية ∪ ميزات باقته ∪ التفعيلات المفردة غير المنتهية. */
export async function getStoreFeatures(storeId: string): Promise<Set<string>> {
  const features = new Set<string>(FREE_FEATURES);

  const sub = await db
    .select({ planFeatures: plans.features, status: storeSubscriptions.status })
    .from(storeSubscriptions)
    .innerJoin(plans, eq(plans.id, storeSubscriptions.planId))
    .where(and(eq(storeSubscriptions.storeId, storeId), eq(storeSubscriptions.status, "active")))
    .limit(1);
  if (sub[0]) for (const f of sub[0].planFeatures) features.add(f);

  const now = new Date();
  const grants = await db
    .select({ feature: storeEntitlements.feature })
    .from(storeEntitlements)
    .where(
      and(
        eq(storeEntitlements.storeId, storeId),
        eq(storeEntitlements.enabled, true),
        or(isNull(storeEntitlements.expiresAt), gt(storeEntitlements.expiresAt, now)),
      ),
    );
  for (const g of grants) features.add(g.feature);

  return features;
}

export async function hasFeature(storeId: string, feature: Feature): Promise<boolean> {
  return (await getStoreFeatures(storeId)).has(feature);
}
