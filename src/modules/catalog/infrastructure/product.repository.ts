import { and, eq, ne, isNull, sql, desc } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { products, productVariants, productMedia } from "@/infrastructure/database/schema";
import { offsetOf, paginate, type Pagination } from "@/core/pagination";

/** أعمدة بطاقة المنتج العامة: السعر، الصورة، سعر المقارنة، ومتوسط/عدد التقييم. */
const publicCardColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  shortDescription: products.shortDescription,
  price: productVariants.price,
  compareAtPrice: productVariants.compareAtPrice,
  image: sql<string | null>`(select url from product_media pm where pm.product_id = ${products.id} order by pm.is_primary desc, pm.position asc limit 1)`,
  ratingAvg: sql<number>`coalesce((select round(avg(rating)::numeric, 1) from reviews rv where rv.product_id = ${products.id} and rv.status = 'approved'), 0)::float`,
  ratingCount: sql<number>`(select count(*)::int from reviews rv where rv.product_id = ${products.id} and rv.status = 'approved')`,
};

export const productRepository = {
  /** المنتجات المنشورة للعرض العام مع السعر والصورة الأولى والخصم والتقييم. */
  async listPublic(storeId: string, executor: DbExecutor = db) {
    const rows = await executor
      .select(publicCardColumns)
      .from(products)
      .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
      .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
      .orderBy(desc(products.publishedAt));
    return rows;
  },

  /** منتجات ذات صلة: من نفس التصنيف إن وُجد، وإلا الأحدث. تستثني المنتج الحالي. */
  async listRelated(storeId: string, productId: string, categoryId: string | null, limit = 4, executor: DbExecutor = db) {
    const base = and(
      eq(products.storeId, storeId),
      eq(products.status, "active"),
      isNull(products.deletedAt),
      ne(products.id, productId),
    );
    const select = executor
      .select(publicCardColumns)
      .from(products)
      .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)));

    if (categoryId) {
      const rows = await select.where(and(base, eq(products.categoryId, categoryId))).orderBy(desc(products.publishedAt)).limit(limit);
      if (rows.length >= limit) return rows;
      // أكمل من الأحدث إن لم يكفِ التصنيف.
      const extra = await select.where(and(base, isNull(products.categoryId))).orderBy(desc(products.publishedAt)).limit(limit - rows.length);
      const seen = new Set(rows.map((r) => r.id));
      return [...rows, ...extra.filter((r) => !seen.has(r.id))].slice(0, limit);
    }
    return select.where(base).orderBy(desc(products.publishedAt)).limit(limit);
  },

  /** بحث نصّي في المنتجات المنشورة (الاسم والوصف). */
  async search(storeId: string, q: string, limit = 40, executor: DbExecutor = db) {
    const term = `%${q.trim().replace(/[%_]/g, "")}%`;
    return executor
      .select(publicCardColumns)
      .from(products)
      .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
      .where(
        and(
          eq(products.storeId, storeId),
          eq(products.status, "active"),
          isNull(products.deletedAt),
          sql`(${products.name} ilike ${term} or coalesce(${products.shortDescription},'') ilike ${term} or coalesce(${products.description},'') ilike ${term})`,
        ),
      )
      .orderBy(desc(products.publishedAt))
      .limit(limit);
  },

  async findBySlug(storeId: string, slug: string, executor: DbExecutor = db) {
    return executor.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.slug, slug), isNull(products.deletedAt)),
    });
  },

  async findById(storeId: string, id: string, executor: DbExecutor = db) {
    return executor.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.id, id), isNull(products.deletedAt)),
    });
  },

  async listMedia(productId: string, executor: DbExecutor = db) {
    return executor.select().from(productMedia).where(eq(productMedia.productId, productId)).orderBy(desc(productMedia.isPrimary), productMedia.position);
  },

  async findByIdWithVariants(storeId: string, id: string, executor: DbExecutor = db) {
    const product = await executor.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.id, id), isNull(products.deletedAt)),
    });
    if (!product) return null;
    const variants = await executor.select().from(productVariants).where(eq(productVariants.productId, product.id));
    return { ...product, variants };
  },

  async list(storeId: string, p: Pagination, executor: DbExecutor = db) {
    const where = and(eq(products.storeId, storeId), isNull(products.deletedAt));
    const [rows, [{ count }]] = await Promise.all([
      executor.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(p.perPage).offset(offsetOf(p)),
      executor.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    return paginate(rows, count, p);
  },

  async insert(values: typeof products.$inferInsert, executor: DbExecutor = db) {
    const [row] = await executor.insert(products).values(values).returning();
    return row;
  },

  async insertVariants(values: (typeof productVariants.$inferInsert)[], executor: DbExecutor = db) {
    return executor.insert(productVariants).values(values).returning();
  },
};
