import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { coupons } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, ValidationError } from "@/core/errors";

const priceRe = /^\d+(\.\d{1,2})?$/;

export const createCouponSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "أحرف وأرقام وشرطات فقط"),
  discountType: z.enum(["percentage", "fixed"]),
  value: z.string().regex(priceRe),
  minOrderAmount: z.string().regex(priceRe).optional(),
  maxDiscount: z.string().regex(priceRe).optional(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  usageLimitPerCustomer: z.coerce.number().int().min(1).optional(),
});

export async function createCoupon(ctx: StoreContext, raw: z.input<typeof createCouponSchema>) {
  requireRole(ctx, "owner", "admin");
  const parsed = createCouponSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;
  if (input.discountType === "percentage" && Number(input.value) > 100) throw new ValidationError("النسبة لا تتجاوز 100");

  const existing = await db.query.coupons.findFirst({ where: and(eq(coupons.storeId, ctx.storeId), eq(coupons.code, input.code)) });
  if (existing) throw new ConflictError("يوجد كوبون بنفس الرمز");

  const [row] = await db
    .insert(coupons)
    .values({
      storeId: ctx.storeId,
      code: input.code,
      discountType: input.discountType,
      value: input.value,
      minOrderAmount: input.minOrderAmount,
      maxDiscount: input.maxDiscount,
      usageLimit: input.usageLimit,
      usageLimitPerCustomer: input.usageLimitPerCustomer,
    })
    .returning();
  return row;
}

export const listCoupons = (storeId: string) =>
  db.select().from(coupons).where(eq(coupons.storeId, storeId)).orderBy(desc(coupons.createdAt));

export async function toggleCoupon(ctx: StoreContext, couponId: string, isActive: boolean) {
  requireRole(ctx, "owner", "admin");
  await db.update(coupons).set({ isActive, updatedAt: new Date() }).where(and(eq(coupons.id, couponId), eq(coupons.storeId, ctx.storeId)));
}
