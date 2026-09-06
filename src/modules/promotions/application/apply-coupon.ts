import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "@/infrastructure/database/client";
import { db } from "@/infrastructure/database/client";
import { coupons, couponRedemptions } from "@/infrastructure/database/schema";
import { ValidationError } from "@/core/errors";
import { toMinor, percentOf, type Minor } from "@/core/money";

export interface CouponResult {
  couponId: string;
  code: string;
  discount: Minor;
}

/**
 * يتحقق من كوبون على مجموع فرعي (بالهللة) ويحسب الخصم. لا يعدّل شيئاً.
 * يُستدعى داخل transaction الطلب (executor) أو منفرداً للمعاينة.
 */
export async function applyCoupon(
  executor: DbExecutor,
  params: { storeId: string; code: string; subtotal: Minor; customerId?: string },
): Promise<CouponResult> {
  const code = params.code.trim();
  const coupon = await executor.query.coupons.findFirst({
    where: and(eq(coupons.storeId, params.storeId), eq(coupons.code, code)),
  });
  if (!coupon || !coupon.isActive) throw new ValidationError("كوبون غير صالح");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new ValidationError("الكوبون لم يبدأ بعد");
  if (coupon.endsAt && coupon.endsAt < now) throw new ValidationError("انتهت صلاحية الكوبون");
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw new ValidationError("انتهى عدد استخدامات الكوبون");

  if (coupon.minOrderAmount && params.subtotal < toMinor(coupon.minOrderAmount)) {
    throw new ValidationError(`الحد الأدنى للطلب ${coupon.minOrderAmount}`);
  }

  if (coupon.usageLimitPerCustomer !== null && params.customerId) {
    const used = await executor
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.customerId, params.customerId)));
    if (used.length >= coupon.usageLimitPerCustomer) throw new ValidationError("استنفدت استخداماتك لهذا الكوبون");
  }

  let discount = coupon.discountType === "percentage" ? percentOf(params.subtotal, Number(coupon.value)) : toMinor(coupon.value);
  if (coupon.maxDiscount) discount = Math.min(discount, toMinor(coupon.maxDiscount));
  discount = Math.min(discount, params.subtotal); // لا يتجاوز الخصم المجموع

  return { couponId: coupon.id, code: coupon.code, discount };
}

/** يسجّل استخدام كوبون ويزيد العدّاد. يُستدعى بعد إنشاء الطلب داخل نفس الـ transaction. */
export async function recordRedemption(
  executor: DbExecutor,
  params: { couponId: string; orderId: string; customerId?: string; amountMinor: Minor },
) {
  await executor.insert(couponRedemptions).values({
    couponId: params.couponId,
    orderId: params.orderId,
    customerId: params.customerId,
    amount: (params.amountMinor / 100).toFixed(2),
  });
  const { sql } = await import("drizzle-orm");
  await executor.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, params.couponId));
}

/** معاينة كوبون خارج الطلب (للواجهة). */
export const previewCoupon = (p: { storeId: string; code: string; subtotal: Minor; customerId?: string }) => applyCoupon(db, p);
