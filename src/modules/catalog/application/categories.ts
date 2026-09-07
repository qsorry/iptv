import { and, eq, inArray, isNull, sql, asc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { Pagination } from "@/core/pagination";
import { productRepository } from "../infrastructure/product.repository";
import { categories, products } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";

/*
 * عمود العدّ مكتوب بـ `categories.id` نصاً لا بـ ${categories.id}:
 * Drizzle يُسقط اسم الجدول في استعلام بجدول واحد بلا join فيصير المرجع "id"
 * فيلتقطه الجدول الداخلي (p.id) ويعود العدّ صفراً دائماً.
 */

/** عدد المنتجات الحيّة (غير المحذوفة) المرتبطة بالتصنيف. */
const productCount = sql<number>`(select count(*)::int from products p where p.category_id = categories.id and p.deleted_at is null)`;

/** عدد المنتجات المنشورة فقط — لواجهة المتجر. */
const publishedCount = sql<number>`(select count(*)::int from products p where p.category_id = categories.id and p.deleted_at is null and p.status = 'active')`;

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
  db.select().from(categories).where(eq(categories.storeId, storeId)).orderBy(asc(categories.sortOrder), asc(categories.name));

/** تصنيفات لوحة التحكم مع عدد المنتجات المرتبطة بكل تصنيف. */
export const listCategoriesWithCounts = (storeId: string) =>
  db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      status: categories.status,
      sortOrder: categories.sortOrder,
      productCount,
    })
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

export interface UpdateCategoryInput {
  name?: string;
  status?: "active" | "hidden";
  sortOrder?: number;
}

/** تعديل تصنيف: الاسم (مع تحديث الـ slug) والظهور والترتيب. */
export async function updateCategory(ctx: StoreContext, categoryId: string, input: UpdateCategoryInput) {
  requireRole(ctx, "owner", "admin", "staff");
  const category = await db.query.categories.findFirst({ where: and(eq(categories.storeId, ctx.storeId), eq(categories.id, categoryId)) });
  if (!category) throw new NotFoundError("التصنيف", categoryId);

  const patch: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2) throw new ValidationError("اسم التصنيف قصير");
    if (trimmed !== category.name) {
      const slug = slugify(trimmed);
      const clash = await db.query.categories.findFirst({ where: and(eq(categories.storeId, ctx.storeId), eq(categories.slug, slug)) });
      if (clash && clash.id !== categoryId) throw new ConflictError("يوجد تصنيف بنفس الاسم");
      patch.name = trimmed;
      patch.slug = slug;
    }
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  await db.update(categories).set(patch).where(eq(categories.id, categoryId));
}

/**
 * حذف تصنيف. المنتجات المرتبطة لا تُحذف: يفكّ ارتباطها (category_id = null)
 * عبر `on delete set null` في المخطط، فلا يضيع أي منتج بحذف تصنيفه.
 */
export async function deleteCategory(ctx: StoreContext, categoryId: string) {
  requireRole(ctx, "owner", "admin");
  await db.delete(categories).where(and(eq(categories.id, categoryId), eq(categories.storeId, ctx.storeId)));
}

/**
 * ربط منتجات بتصنيف (أو فكّ الربط بتمرير null) في عملية واحدة.
 * يتحقق أن التصنيف والمنتجات كلها تخصّ نفس المتجر قبل أي كتابة.
 */
export async function setProductsCategory(ctx: StoreContext, productIds: string[], categoryId: string | null) {
  requireRole(ctx, "owner", "admin", "staff");
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) throw new ValidationError("لم تختر أي منتج");

  if (categoryId) {
    const category = await db.query.categories.findFirst({ where: and(eq(categories.storeId, ctx.storeId), eq(categories.id, categoryId)) });
    if (!category) throw new NotFoundError("التصنيف", categoryId);
  }

  const updated = await db
    .update(products)
    .set({ categoryId, updatedAt: new Date() })
    .where(and(eq(products.storeId, ctx.storeId), isNull(products.deletedAt), inArray(products.id, ids)))
    .returning({ id: products.id });

  return { updated: updated.length };
}

/**
 * تصنيفات المتجر الظاهرة على الواجهة، مع عدد المنتجات المنشورة في كل تصنيف.
 * التصنيف الفارغ لا يظهر افتراضياً حتى لا يصل الزائر لصفحة قسم بلا منتجات.
 */
export const listPublicCategories = (storeId: string, opts: { includeEmpty?: boolean } = {}) =>
  db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      productCount: publishedCount,
    })
    .from(categories)
    .where(
      and(
        eq(categories.storeId, storeId),
        eq(categories.status, "active"),
        opts.includeEmpty ? undefined : sql`${publishedCount} > 0`,
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name));

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
