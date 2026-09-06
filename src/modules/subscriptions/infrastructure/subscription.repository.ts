import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { subscriptionProviders, subscriptionMappings, subscriptionProvisions, productVariants, products, orders, orderItems } from "@/infrastructure/database/schema";

export const subscriptionRepository = {
  listProviders(storeId: string) {
    return db.query.subscriptionProviders.findMany({ where: eq(subscriptionProviders.storeId, storeId), orderBy: [desc(subscriptionProviders.createdAt)] });
  },

  findProvider(storeId: string, id: string, executor: DbExecutor = db) {
    return executor.query.subscriptionProviders.findFirst({ where: and(eq(subscriptionProviders.id, id), eq(subscriptionProviders.storeId, storeId)) });
  },

  /** الربط مع اسم المنتج/المتغيّر والمزوّد للعرض في لوحة التحكم. */
  async listMappings(storeId: string) {
    return db
      .select({
        id: subscriptionMappings.id,
        variantId: subscriptionMappings.variantId,
        providerId: subscriptionMappings.providerId,
        packageId: subscriptionMappings.packageId,
        params: subscriptionMappings.params,
        isActive: subscriptionMappings.isActive,
        productName: products.name,
        variantName: productVariants.name,
        providerName: subscriptionProviders.name,
      })
      .from(subscriptionMappings)
      .innerJoin(productVariants, eq(productVariants.id, subscriptionMappings.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(subscriptionProviders, eq(subscriptionProviders.id, subscriptionMappings.providerId))
      .where(eq(subscriptionMappings.storeId, storeId))
      .orderBy(products.name, productVariants.name);
  },

  findMappingByVariant(storeId: string, variantId: string, executor: DbExecutor = db) {
    return executor.query.subscriptionMappings.findFirst({
      where: and(eq(subscriptionMappings.storeId, storeId), eq(subscriptionMappings.variantId, variantId)),
    });
  },

  /** كل المتغيّرات النشطة في المتجر (لقائمة اختيار الربط). */
  listVariants(storeId: string) {
    return db
      .select({ id: productVariants.id, name: productVariants.name, productName: products.name })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.storeId, storeId), eq(productVariants.isActive, true)))
      .orderBy(products.name, productVariants.name);
  },

  listProvisions(storeId: string, limit = 50) {
    return db.query.subscriptionProvisions.findMany({
      where: eq(subscriptionProvisions.storeId, storeId),
      orderBy: [desc(subscriptionProvisions.createdAt)],
      limit,
    });
  },

  /** سجل التزويد مع رقم الطلب واسم المنتج والمزوّد (للعرض في لوحة التحكم). */
  listProvisionsDetailed(storeId: string, limit = 50) {
    return db
      .select({
        id: subscriptionProvisions.id,
        orderId: subscriptionProvisions.orderId,
        orderNumber: orders.orderNumber,
        productName: orderItems.productName,
        variantName: orderItems.variantName,
        providerName: subscriptionProviders.name,
        status: subscriptionProvisions.status,
        attempts: subscriptionProvisions.attempts,
        deliveredCode: subscriptionProvisions.deliveredCode,
        lastError: subscriptionProvisions.lastError,
        createdAt: subscriptionProvisions.createdAt,
      })
      .from(subscriptionProvisions)
      .innerJoin(orders, eq(orders.id, subscriptionProvisions.orderId))
      .innerJoin(orderItems, eq(orderItems.id, subscriptionProvisions.orderItemId))
      .leftJoin(subscriptionProviders, eq(subscriptionProviders.id, subscriptionProvisions.providerId))
      .where(eq(subscriptionProvisions.storeId, storeId))
      .orderBy(desc(subscriptionProvisions.createdAt))
      .limit(limit);
  },

  findProvision(storeId: string, id: string, executor: DbExecutor = db) {
    return executor.query.subscriptionProvisions.findFirst({ where: and(eq(subscriptionProvisions.id, id), eq(subscriptionProvisions.storeId, storeId)) });
  },

  provisionsForOrder(storeId: string, orderId: string) {
    return db.query.subscriptionProvisions.findMany({
      where: and(eq(subscriptionProvisions.storeId, storeId), eq(subscriptionProvisions.orderId, orderId)),
      orderBy: [subscriptionProvisions.createdAt],
    });
  },

  async countByStatus(storeId: string) {
    const rows = await db
      .select({ status: subscriptionProvisions.status, count: sql<number>`count(*)::int` })
      .from(subscriptionProvisions)
      .where(eq(subscriptionProvisions.storeId, storeId))
      .groupBy(subscriptionProvisions.status);
    const out = { pending: 0, succeeded: 0, failed: 0 };
    for (const r of rows) out[r.status] = r.count;
    return out;
  },
};
