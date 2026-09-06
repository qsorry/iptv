import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { plans, storeSubscriptions } from "@/infrastructure/database/schema";
import { FEATURES, type Feature } from "./features";

/**
 * الباقات الافتراضية مرتبة تصاعدياً. الأخيرة هي "الباقة الأعلى" وتنفرد بميزة ربط الاشتراكات عبر API.
 * الأسعار بالريال كنص numeric.
 */
export const DEFAULT_PLANS: { code: string; name: string; price: string; features: Feature[] }[] = [
  { code: "free", name: "مجانية", price: "0", features: [] },
  { code: "pro", name: "احترافية", price: "99.00", features: [FEATURES.notifyWhatsapp, FEATURES.notifySms, FEATURES.customDomain] },
  {
    code: "business",
    name: "أعمال",
    price: "249.00",
    features: [FEATURES.notifyWhatsapp, FEATURES.notifySms, FEATURES.customDomain, FEATURES.sallaImport, FEATURES.subscriptionsApi],
  },
];

export const HIGHEST_PLAN = DEFAULT_PLANS[DEFAULT_PLANS.length - 1];

/** يضمن وجود الباقات الافتراضية (idempotent). لا يعدّل الأسعار الموجودة لكنه يضيف مفاتيح الميزات الجديدة. */
export async function ensureDefaultPlans() {
  for (const p of DEFAULT_PLANS) {
    const existing = await db.query.plans.findFirst({ where: eq(plans.code, p.code) });
    if (!existing) {
      await db.insert(plans).values({ code: p.code, name: p.name, price: p.price, features: p.features });
      continue;
    }
    const merged = Array.from(new Set([...existing.features, ...p.features]));
    if (merged.length !== existing.features.length) {
      await db.update(plans).set({ features: merged, updatedAt: new Date() }).where(eq(plans.id, existing.id));
    }
  }
}

/** باقة المتجر الحالية (أو null إن لم يكن مشتركاً). */
export async function getStorePlan(storeId: string) {
  const [row] = await db
    .select({ code: plans.code, name: plans.name, status: storeSubscriptions.status, currentPeriodEnd: storeSubscriptions.currentPeriodEnd })
    .from(storeSubscriptions)
    .innerJoin(plans, eq(plans.id, storeSubscriptions.planId))
    .where(eq(storeSubscriptions.storeId, storeId))
    .limit(1);
  return row ?? null;
}

/** يضع المتجر على باقة (upsert). للاستخدام المركزي/الاختبارات. */
export async function setStorePlan(storeId: string, planCode: string, currentPeriodEnd?: Date) {
  await ensureDefaultPlans();
  const plan = await db.query.plans.findFirst({ where: eq(plans.code, planCode) });
  if (!plan) throw new Error(`الباقة ${planCode} غير موجودة`);
  await db
    .insert(storeSubscriptions)
    .values({ storeId, planId: plan.id, status: "active", currentPeriodEnd })
    .onConflictDoUpdate({ target: storeSubscriptions.storeId, set: { planId: plan.id, status: "active", currentPeriodEnd, updatedAt: new Date() } });
}
