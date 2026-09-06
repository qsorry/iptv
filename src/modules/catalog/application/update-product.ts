import { eq, and } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { products, productVariants, productMedia } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { publishEvent } from "@/core/events";

const priceRe = /^\d+(\.\d{1,2})?$/;

export interface UpdateProductInput {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: "draft" | "active" | "archived";
  price?: string; // للمتغيّر الافتراضي
}

/** تعديل حقول المنتج الأساسية وسعر المتغيّر الافتراضي. */
export async function updateProduct(ctx: StoreContext, productId: string, input: UpdateProductInput) {
  requireRole(ctx, "owner", "admin", "staff");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.shortDescription !== undefined) patch.shortDescription = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === "active" && !product.publishedAt) patch.publishedAt = new Date();
  }

  await db.transaction(async (tx) => {
    await tx.update(products).set(patch).where(eq(products.id, productId));

    if (input.price !== undefined) {
      if (!priceRe.test(input.price)) throw new ValidationError("سعر غير صالح");
      await tx
        .update(productVariants)
        .set({ price: input.price, updatedAt: new Date() })
        .where(and(eq(productVariants.productId, productId), eq(productVariants.isDefault, true)));
    }

    if (input.status === "active" && !product.publishedAt) {
      await publishEvent(tx, { storeId: ctx.storeId, type: "product.published", aggregateType: "product", aggregateId: productId });
    }
  });
}

/** حذف ناعم (soft delete): يُخفى من القوائم لكن يبقى للحفاظ على تاريخ الطلبات. */
export async function deleteProduct(ctx: StoreContext, productId: string) {
  requireRole(ctx, "owner", "admin");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);
  await db.update(products).set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() }).where(eq(products.id, productId));
}

/** إضافة صورة بالرابط (تُستخدم أيضاً عند الاستيراد من سلة). */
export async function addProductImageUrl(ctx: StoreContext, productId: string, url: string, altText?: string) {
  requireRole(ctx, "owner", "admin", "staff");
  if (!/^https?:\/\/.+/i.test(url)) throw new ValidationError("رابط صورة غير صالح");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);
  const existing = await db.select({ id: productMedia.id }).from(productMedia).where(eq(productMedia.productId, productId));
  const [row] = await db
    .insert(productMedia)
    .values({ productId, type: "image", url, altText, position: existing.length, isPrimary: existing.length === 0 })
    .returning();
  return row;
}

export async function removeProductImage(ctx: StoreContext, productId: string, mediaId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await db.delete(productMedia).where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)));
}

/** يجعل صورة رئيسية ويلغي الرئيسية عن الباقي. */
export async function setPrimaryImage(ctx: StoreContext, productId: string, mediaId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await db.transaction(async (tx) => {
    await tx.update(productMedia).set({ isPrimary: false }).where(eq(productMedia.productId, productId));
    await tx.update(productMedia).set({ isPrimary: true }).where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)));
  });
}
