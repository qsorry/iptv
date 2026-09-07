import { eq, and } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { categories, products, productVariants, productMedia } from "@/infrastructure/database/schema";
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
  productType?: "physical" | "digital" | "service";
  categoryId?: string | null; // null = بدون تصنيف
  price?: string; // للمتغيّر الافتراضي
}

/** تعديل حقول المنتج الأساسية وسعر المتغيّر الافتراضي. */
export async function updateProduct(ctx: StoreContext, productId: string, input: UpdateProductInput) {
  requireRole(ctx, "owner", "admin", "staff");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.storeId, ctx.storeId), eq(categories.id, input.categoryId)),
    });
    if (!category) throw new NotFoundError("التصنيف", input.categoryId);
  }

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.shortDescription !== undefined) patch.shortDescription = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  if (input.productType !== undefined) patch.productType = input.productType;
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

    // أي تغيير على منتج منشور يعني تحديث الخلاصات؛ سحبه من النشر يعني حذفه منها.
    const unpublished = input.status !== undefined && input.status !== "active";
    await publishEvent(tx, {
      storeId: ctx.storeId,
      type: unpublished ? "product.unpublished" : "product.updated",
      aggregateType: "product",
      aggregateId: productId,
    });
  });
}

/** حذف ناعم (soft delete): يُخفى من القوائم لكن يبقى للحفاظ على تاريخ الطلبات. */
export async function deleteProduct(ctx: StoreContext, productId: string) {
  requireRole(ctx, "owner", "admin");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);
  await db.transaction(async (tx) => {
    await tx.update(products).set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() }).where(eq(products.id, productId));
    await publishEvent(tx, { storeId: ctx.storeId, type: "product.unpublished", aggregateType: "product", aggregateId: productId });
  });
}

/** تغيير لا يمسّ صف المنتج نفسه (صورة، خيار) لكنه يغيّر الخلاصة. */
async function publishProductTouched(storeId: string, productId: string) {
  await publishEvent(db, { storeId, type: "product.updated", aggregateType: "product", aggregateId: productId });
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
  await publishProductTouched(ctx.storeId, productId);
  return row;
}

export async function removeProductImage(ctx: StoreContext, productId: string, mediaId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await db.delete(productMedia).where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)));
  await publishProductTouched(ctx.storeId, productId);
}

/** يجعل صورة رئيسية ويلغي الرئيسية عن الباقي. */
export async function setPrimaryImage(ctx: StoreContext, productId: string, mediaId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await db.transaction(async (tx) => {
    await tx.update(productMedia).set({ isPrimary: false }).where(eq(productMedia.productId, productId));
    await tx.update(productMedia).set({ isPrimary: true }).where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)));
    await publishEvent(tx, { storeId: ctx.storeId, type: "product.updated", aggregateType: "product", aggregateId: productId });
  });
}

const vPriceRe = /^\d+(\.\d{1,2})?$/;

/** إضافة متغيّر (خيار) للمنتج، مثل مدة مختلفة بسعر مختلف. */
export async function addVariant(ctx: StoreContext, productId: string, input: { name: string; price: string }) {
  requireRole(ctx, "owner", "admin", "staff");
  if (input.name.trim().length < 1) throw new ValidationError("اسم الخيار مطلوب");
  if (!vPriceRe.test(input.price)) throw new ValidationError("سعر غير صالح");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);
  const [row] = await db.insert(productVariants).values({ storeId: ctx.storeId, productId, name: input.name.trim(), price: input.price, isDefault: false }).returning();
  await publishProductTouched(ctx.storeId, productId);
  return row;
}

/** حذف متغيّر. يجب إبقاء متغيّر واحد على الأقل، ولا يُحذف الافتراضي. */
export async function removeVariant(ctx: StoreContext, productId: string, variantId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  const all = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  if (all.length <= 1) throw new ValidationError("يجب إبقاء خيار واحد على الأقل");
  const target = all.find((v) => v.id === variantId);
  if (target?.isDefault) throw new ValidationError("لا يمكن حذف الخيار الافتراضي");
  await db.delete(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, ctx.storeId)));
  await publishProductTouched(ctx.storeId, productId);
}
