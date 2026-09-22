import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import type { Pagination } from "@/core/pagination";
import { productRepository } from "../infrastructure/product.repository";
import { brands, products } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";
import { storage } from "@/infrastructure/storage";

/*
 * أعمدة العدّ مكتوبة بـ `brands.id` نصاً لا بـ ${brands.id}:
 * Drizzle يُسقط اسم الجدول في استعلام بجدول واحد بلا join فيصير المرجع "id"
 * فيلتقطه الجدول الداخلي (p.id) ويعود العدّ صفراً دائماً.
 */
const productCount = sql<number>`(select count(*)::int from products p where p.brand_id = brands.id and p.deleted_at is null)`;
const publishedCount = sql<number>`(select count(*)::int from products p where p.brand_id = brands.id and p.deleted_at is null and p.status = 'active')`;

export async function createBrand(ctx: StoreContext, name: string) {
  requireRole(ctx, "owner", "admin", "staff");
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new ValidationError("اسم الماركة قصير");
  const slug = slugify(trimmed);
  const existing = await db.query.brands.findFirst({ where: and(eq(brands.storeId, ctx.storeId), eq(brands.slug, slug)) });
  if (existing) throw new ConflictError("توجد ماركة بنفس الاسم");
  const [row] = await db.insert(brands).values({ storeId: ctx.storeId, name: trimmed, slug }).returning();
  return row;
}

/** ماركات لوحة التحكم مع عدد المنتجات المرتبطة بكل ماركة. */
export const listBrandsWithCounts = (storeId: string) =>
  db
    .select({ id: brands.id, name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl, productCount })
    .from(brands)
    .where(eq(brands.storeId, storeId))
    .orderBy(asc(brands.name));

/** ماركات لقوائم الاختيار (صفحة المنتج). */
export const listBrands = (storeId: string) =>
  db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.storeId, storeId)).orderBy(asc(brands.name));

export interface UpdateBrandInput {
  name?: string;
  logoUrl?: string | null; // null = إزالة الشعار
}

export async function updateBrand(ctx: StoreContext, brandId: string, input: UpdateBrandInput) {
  requireRole(ctx, "owner", "admin", "staff");
  const brand = await db.query.brands.findFirst({ where: and(eq(brands.storeId, ctx.storeId), eq(brands.id, brandId)) });
  if (!brand) throw new NotFoundError("الماركة", brandId);

  const patch: Partial<typeof brands.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2) throw new ValidationError("اسم الماركة قصير");
    if (trimmed !== brand.name) {
      const slug = slugify(trimmed);
      const clash = await db.query.brands.findFirst({ where: and(eq(brands.storeId, ctx.storeId), eq(brands.slug, slug)) });
      if (clash && clash.id !== brandId) throw new ConflictError("توجد ماركة بنفس الاسم");
      patch.name = trimmed;
      patch.slug = slug;
    }
  }
  if (input.logoUrl !== undefined) {
    if (input.logoUrl !== null && !/^https?:\/\/.+/i.test(input.logoUrl)) throw new ValidationError("رابط شعار غير صالح");
    patch.logoUrl = input.logoUrl;
  }
  await db.update(brands).set(patch).where(eq(brands.id, brandId));
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** رفع شعار الماركة إلى التخزين وربطه بها. يحلّ محل الشعار السابق. */
export async function uploadBrandLogo(ctx: StoreContext, brandId: string, file: File) {
  requireRole(ctx, "owner", "admin", "staff");
  const brand = await db.query.brands.findFirst({ where: and(eq(brands.storeId, ctx.storeId), eq(brands.id, brandId)) });
  if (!brand) throw new NotFoundError("الماركة", brandId);

  if (file.size === 0) throw new ValidationError("اختر صورة أولاً");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new ValidationError(`نوع ملف غير مدعوم: ${file.type || "غير معروف"}`);
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError("حجم الشعار يتجاوز 4MB");

  const ext = file.type === "image/svg+xml" ? "svg" : (file.type.split("/")[1] ?? "png");
  const key = `stores/${ctx.storeId}/brands/${brandId}/${crypto.randomUUID()}.${ext}`;
  const { url } = await storage.upload(key, Buffer.from(await file.arrayBuffer()), file.type);

  await db.update(brands).set({ logoUrl: url, updatedAt: new Date() }).where(eq(brands.id, brandId));
  return { url };
}

export async function removeBrandLogo(ctx: StoreContext, brandId: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await updateBrand(ctx, brandId, { logoUrl: null });
}

/** حذف ماركة. المنتجات لا تُحذف؛ يفكّ ارتباطها عبر `on delete set null`. */
export async function deleteBrand(ctx: StoreContext, brandId: string) {
  requireRole(ctx, "owner", "admin");
  await db.delete(brands).where(and(eq(brands.id, brandId), eq(brands.storeId, ctx.storeId)));
}

/**
 * ماركات واجهة المتجر: لها شعار ولها منتج منشور واحد على الأقل.
 * شريط الماركات بلا شعار لا معنى له، والماركة بلا منتجات تقود لصفحة فارغة.
 */
export const listPublicBrands = (storeId: string) =>
  db
    .select({ id: brands.id, name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl, productCount: publishedCount })
    .from(brands)
    .where(and(eq(brands.storeId, storeId), sql`${brands.logoUrl} is not null`, sql`${publishedCount} > 0`))
    .orderBy(asc(brands.name));

/** منتجات ماركة للعرض العام، مرقّمة، بأعمدة بطاقة المنتج. */
export async function brandProducts(storeId: string, slug: string, pagination: Pagination = { page: 1, perPage: 24 }) {
  const brand = await db.query.brands.findFirst({ where: and(eq(brands.storeId, storeId), eq(brands.slug, slug)) });
  if (!brand) return null;
  const result = await productRepository.listPublicByBrand(storeId, brand.id, pagination);
  return { brand, products: result.data, page: result.page, totalPages: result.totalPages, total: result.total };
}

/** عدد المنتجات بلا ماركة (لتنبيه التاجر في اللوحة). */
export async function unbrandedCount(storeId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), isNull(products.brandId)));
  return row?.n ?? 0;
}
