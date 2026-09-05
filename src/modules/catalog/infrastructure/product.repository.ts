import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { products, productVariants } from "@/infrastructure/database/schema";
import { offsetOf, paginate, type Pagination } from "@/core/pagination";

export const productRepository = {
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
