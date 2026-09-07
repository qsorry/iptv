import { and, eq, desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { Pagination } from "@/core/pagination";
import { productRepository } from "../infrastructure/product.repository";
import { categories } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";

export async function createCategory(ctx: StoreContext, name: string) {
  requireRole(ctx, "owner", "admin", "staff");
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new ValidationError("اسم التصنيف قصير");
  const slug = slugify(trimmed);
  const existing = await db.query.categories.findFirst({ where: and(eq(categories.storeId, ctx.storeId), eq(categories.slug, slug)) });
  if (existing) throw new ConflictError("يوجد تصنيف بنفس الاسم");
  const [row] = await db.insert(categories).values({ storeId: ctx.storeId, name: trimmed, slug }).returning();
  return row;
}

export const listCategories = (storeId: string) =>
  db.select().from(categories).where(eq(categories.storeId, storeId)).orderBy(desc(categories.createdAt));

export async function deleteCategory(ctx: StoreContext, categoryId: string) {
  requireRole(ctx, "owner", "admin");
  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.storeId, ctx.storeId)));
}

/** تصنيفات المتجر الظاهرة على الواجهة (لها منتجات منشورة أو كلها). */
export const listPublicCategories = (storeId: string) =>
  db.select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, imageUrl: categories.imageUrl }).from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.status, "active"))).orderBy(categories.sortOrder);

/** تصنيف واحد بالمعرّف (للـ breadcrumbs في صفحة المنتج). */
export const categoryById = (storeId: string, id: string) =>
  db.query.categories.findFirst({ where: and(eq(categories.storeId, storeId), eq(categories.id, id)), columns: { id: true, name: true, slug: true } });

/** منتجات تصنيف للعرض العام، مرقّمة، بأعمدة بطاقة المنتج (صورة، خصم، تقييم). */
export async function categoryProducts(storeId: string, slug: string, pagination: Pagination = { page: 1, perPage: 24 }) {
  const category = await db.query.categories.findFirst({ where: and(eq(categories.storeId, storeId), eq(categories.slug, slug)) });
  if (!category) return null;
  const result = await productRepository.listPublicByCategory(storeId, category.id, pagination);
  return { category, products: result.data, page: result.page, totalPages: result.totalPages, total: result.total };
}
