import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { categories } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, ValidationError } from "@/core/errors";
import { publishEvent } from "@/core/events";
import { slugify } from "@/lib/slugify";
import { createProductSchema, type CreateProductInput } from "../validations/product.schema";
import { productRepository } from "../infrastructure/product.repository";

const categoryBelongsToStore = async (storeId: string, categoryId: string) =>
  Boolean(await db.query.categories.findFirst({ where: and(eq(categories.storeId, storeId), eq(categories.id, categoryId)) }));

/**
 * إنشاء منتج مع variants داخل transaction واحد.
 * Input → Validation → Business Rules → Transaction → Domain Event → Result
 */
export async function createProduct(ctx: StoreContext, rawInput: CreateProductInput) {
  requireRole(ctx, "owner", "admin", "staff");

  const parsed = createProductSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;

  const slug = input.slug ?? slugify(input.name);
  if (await productRepository.findBySlug(ctx.storeId, slug)) {
    throw new ConflictError(`يوجد منتج آخر بنفس الرابط: ${slug}`);
  }

  if (input.categoryId && !(await categoryBelongsToStore(ctx.storeId, input.categoryId))) {
    throw new ValidationError("التصنيف غير موجود في هذا المتجر");
  }

  const defaults = input.variants.filter((v) => v.isDefault).length;
  if (defaults > 1) throw new ValidationError("لا يمكن أن يكون هناك أكثر من variant افتراضي");

  return db.transaction(async (tx) => {
    const product = await productRepository.insert(
      {
        storeId: ctx.storeId,
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.name,
        slug,
        shortDescription: input.shortDescription,
        description: input.description,
        productType: input.productType,
        status: input.status,
        publishedAt: input.status === "active" ? new Date() : null,
      },
      tx,
    );

    const variants = await productRepository.insertVariants(
      input.variants.map((v, i) => ({
        storeId: ctx.storeId,
        productId: product.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        isDefault: defaults === 0 ? i === 0 : v.isDefault,
      })),
      tx,
    );

    if (product.status === "active") {
      await publishEvent(tx, {
        storeId: ctx.storeId,
        type: "product.published",
        aggregateType: "product",
        aggregateId: product.id,
      });
    }

    return { ...product, variants };
  });
}
