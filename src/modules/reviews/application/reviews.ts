import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { reviews, products } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";

export const createReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  authorName: z.string().max(80).optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});

/** تقييم من زائر واجهة المتجر. يبدأ pending. */
export async function submitReview(storeId: string, raw: z.input<typeof createReviewSchema>) {
  const parsed = createReviewSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;

  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, storeId), eq(products.id, input.productId)) });
  if (!product) throw new NotFoundError("المنتج", input.productId);

  const [row] = await db
    .insert(reviews)
    .values({ storeId, productId: input.productId, rating: input.rating, authorName: input.authorName, title: input.title, body: input.body })
    .returning();
  return row;
}

/** التقييمات المنشورة لمنتج + المتوسط والعدد (للعرض العام). */
export async function productReviews(productId: string) {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt));
  const count = rows.length;
  const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return { rows, count, average };
}

/** قائمة تقييمات المتجر للوحة التحكم (حسب الحالة). */
export function listStoreReviews(storeId: string, status?: "pending" | "approved" | "rejected") {
  const where = status ? and(eq(reviews.storeId, storeId), eq(reviews.status, status)) : eq(reviews.storeId, storeId);
  return db
    .select({ review: reviews, productName: products.name })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(where)
    .orderBy(desc(reviews.createdAt));
}

export async function moderateReview(ctx: StoreContext, reviewId: string, status: "approved" | "rejected") {
  requireRole(ctx, "owner", "admin", "staff");
  await db.update(reviews).set({ status, updatedAt: new Date() }).where(and(eq(reviews.id, reviewId), eq(reviews.storeId, ctx.storeId)));
}

export async function pendingReviewCount(storeId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.storeId, storeId), eq(reviews.status, "pending")));
  return row?.count ?? 0;
}
