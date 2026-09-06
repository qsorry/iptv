import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { customers, orders } from "@/infrastructure/database/schema";

/** عميل واحد بمعرّفه (لصفحة تفاصيل العميل). */
export function getCustomer(storeId: string, customerId: string) {
  return db.query.customers.findFirst({ where: and(eq(customers.storeId, storeId), eq(customers.id, customerId)) });
}

/** طلبات عميل بمعرّفه، الأحدث أولاً. */
export function customerOrders(storeId: string, customerId: string) {
  return db
    .select({ id: orders.id, orderNumber: orders.orderNumber, grandTotal: orders.grandTotal, currencyCode: orders.currencyCode, paymentStatus: orders.paymentStatus, status: orders.status, placedAt: orders.placedAt })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.placedAt));
}

/** يجد أو ينشئ عميلاً بالبريد (لكل متجر). */
export async function upsertCustomer(storeId: string, data: { email?: string; phone?: string; firstName?: string }) {
  const email = data.email?.trim().toLowerCase();
  if (email) {
    const existing = await db.query.customers.findFirst({ where: and(eq(customers.storeId, storeId), eq(customers.email, email)) });
    if (existing) {
      if (data.phone || data.firstName) {
        await db.update(customers).set({ phone: data.phone ?? existing.phone, firstName: data.firstName ?? existing.firstName, updatedAt: new Date() }).where(eq(customers.id, existing.id));
      }
      return existing.id;
    }
  }
  const [row] = await db.insert(customers).values({ storeId, email, phone: data.phone, firstName: data.firstName }).returning();
  return row.id;
}

/** طلبات عميل بالبريد (لصفحة "طلباتي"). */
export async function ordersByEmail(storeId: string, email: string) {
  const customer = await db.query.customers.findFirst({ where: and(eq(customers.storeId, storeId), eq(customers.email, email.trim().toLowerCase())) });
  if (!customer) return [];
  return db
    .select({ id: orders.id, orderNumber: orders.orderNumber, grandTotal: orders.grandTotal, paymentStatus: orders.paymentStatus, currencyCode: orders.currencyCode, placedAt: orders.placedAt })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.customerId, customer.id)))
    .orderBy(desc(orders.placedAt));
}

/** قائمة عملاء المتجر مع عدد الطلبات وإجمالي الإنفاق (من الطلبات المدفوعة). */
export async function listCustomers(storeId: string) {
  return db
    .select({
      id: customers.id,
      email: customers.email,
      phone: customers.phone,
      firstName: customers.firstName,
      lastName: customers.lastName,
      createdAt: customers.createdAt,
      orders: sql<number>`count(${orders.id}) filter (where ${orders.id} is not null)::int`,
      spent: sql<string>`coalesce(sum(${orders.grandTotal}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(eq(customers.storeId, storeId))
    .groupBy(customers.id)
    .orderBy(sql`max(${customers.createdAt}) desc`);
}
