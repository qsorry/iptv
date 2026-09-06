import { and, eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { digitalCodes, orderItems, orders, customers, subscriptionProvisions } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { orderRepository } from "@/modules/orders";
import { canUseSubscriptionsApi, requireSubscriptionsApi } from "./access";
import { buildClient } from "./providers";
import { subscriptionRepository } from "../infrastructure/subscription.repository";

const MAX_ATTEMPTS = 3;

type ProvisionRow = typeof subscriptionProvisions.$inferSelect;

/**
 * ينفّذ محاولة تزويد واحدة لصف provision: ينادي المزوّد، وعند النجاح يحفظ البيانات
 * ويُدرج كوداً مُسلَّماً في digital_codes ليصل العميل عبر نفس مسار الأكواد.
 * لا يرمي عند فشل المزوّد؛ يحدّث الصف بالحالة والخطأ.
 */
export async function runProvision(row: ProvisionRow): Promise<ProvisionRow> {
  const provider = row.providerId ? await subscriptionRepository.findProvider(row.storeId, row.providerId) : null;
  const fail = async (error: string) => {
    const attempts = row.attempts + 1;
    const [updated] = await db
      .update(subscriptionProvisions)
      .set({ status: "failed", attempts, lastError: error, updatedAt: new Date() })
      .where(eq(subscriptionProvisions.id, row.id))
      .returning();
    return updated;
  };

  if (!provider) return fail("المزوّد غير موجود");
  if (!provider.isActive) return fail("المزوّد موقوف");
  const mapping = row.variantId ? await subscriptionRepository.findMappingByVariant(row.storeId, row.variantId) : null;
  if (!mapping || !mapping.isActive) return fail("لا يوجد ربط نشط لهذا المتغيّر");

  const order = await db.query.orders.findFirst({ where: eq(orders.id, row.orderId) });
  if (!order) return fail("الطلب غير موجود");
  const customer = order.customerId ? await db.query.customers.findFirst({ where: eq(customers.id, order.customerId) }) : null;

  const ctx = {
    packageId: mapping.packageId,
    params: mapping.params,
    order: { id: order.id, number: order.orderNumber },
    customer: {
      email: customer?.email,
      phone: customer?.phone,
      name: [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || null,
    },
    sequence: row.sequence,
    reference: `${order.orderNumber}-${row.sequence}-${row.id.slice(0, 8)}`,
  };

  let client;
  try {
    client = buildClient(provider);
  } catch (e) {
    return fail(`قالب المزوّد غير صالح: ${e instanceof Error ? e.message : String(e)}`);
  }
  const result = await client.createSubscription(ctx);
  const attempts = row.attempts + 1;

  if (!result.ok || !result.deliveredCode) {
    const [updated] = await db
      .update(subscriptionProvisions)
      .set({
        status: "failed",
        attempts,
        request: { packageId: ctx.packageId, params: ctx.params, reference: ctx.reference },
        response: { httpStatus: result.httpStatus, body: result.raw },
        lastError: result.error ?? "فشل غير معروف",
        updatedAt: new Date(),
      })
      .where(eq(subscriptionProvisions.id, row.id))
      .returning();
    return updated;
  }

  // النجاح: كتابة الكود المُسلَّم وبيانات الاشتراك في transaction واحد.
  return db.transaction(async (tx) => {
    // الكود فريد داخل المتجر؛ إن تكرر (نفس بيانات الاشتراك) نُميّزه بالمرجع.
    const code = result.deliveredCode!;
    const dup = await tx.query.digitalCodes.findFirst({ where: and(eq(digitalCodes.storeId, row.storeId), eq(digitalCodes.code, code)) });
    const finalCode = dup ? `${code}|Ref:${ctx.reference}` : code;
    await tx.insert(digitalCodes).values({
      storeId: row.storeId,
      variantId: row.variantId,
      code: finalCode,
      status: "delivered",
      orderId: row.orderId,
      orderItemId: row.orderItemId,
      deliveredAt: new Date(),
    });
    const [updated] = await tx
      .update(subscriptionProvisions)
      .set({
        status: "succeeded",
        attempts,
        request: { packageId: ctx.packageId, params: ctx.params, reference: ctx.reference },
        response: { httpStatus: result.httpStatus, body: result.raw },
        credentials: result.credentials,
        deliveredCode: finalCode,
        lastError: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionProvisions.id, row.id))
      .returning();
    await orderRepository.addEvent(
      { orderId: row.orderId, eventType: "subscription.provisioned", description: `تم إنشاء الاشتراك تلقائياً (${provider.name})`, metadata: { provisionId: row.id } },
      tx,
    );
    return updated;
  });
}

/**
 * يُنشئ صفوف التزويد لطلب مدفوع وينفّذها. Idempotent: unique(order_item_id, sequence).
 * لكل عنصر مرتبط بمزوّد: عدد الاشتراكات المطلوبة = الكمية − ما سُلِّم من مخزون الأكواد.
 * يُستدعى من معالج حدث payment.succeeded قبل إرسال الإشعار.
 */
export async function provisionSubscriptionsForOrder(storeId: string, orderId: string) {
  if (!(await canUseSubscriptionsApi(storeId))) return { created: 0, succeeded: 0, failed: 0, skipped: "feature" as const };

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  let created = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.variantId) continue;
    const mapping = await subscriptionRepository.findMappingByVariant(storeId, item.variantId);
    if (!mapping || !mapping.isActive) continue;

    const [{ delivered }] = await db
      .select({ delivered: sql<number>`count(*)::int` })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.orderItemId, item.id), eq(digitalCodes.status, "delivered")));
    const existing = await db.query.subscriptionProvisions.findMany({ where: eq(subscriptionProvisions.orderItemId, item.id) });
    const alreadySucceeded = existing.filter((p) => p.status === "succeeded").length;
    // الأكواد المُسلَّمة تشمل ما أنشأه التزويد سابقاً؛ لا نحسبها مرتين.
    const needed = item.quantity - (delivered - alreadySucceeded) - existing.length;

    for (let i = 0; i < needed; i++) {
      const sequence = existing.length + i + 1;
      const [row] = await db
        .insert(subscriptionProvisions)
        .values({ storeId, orderId, orderItemId: item.id, sequence, variantId: item.variantId, providerId: mapping.providerId })
        .onConflictDoNothing()
        .returning();
      if (row) {
        created++;
        existing.push(row);
      }
    }

    for (const row of existing) {
      if (row.status === "succeeded") continue;
      if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS) continue;
      const done = await runProvision(row);
      if (done.status === "succeeded") succeeded++;
      else failed++;
    }
  }

  return { created, succeeded, failed };
}

/** إعادة محاولة تزويد فاشل يدوياً من لوحة التحكم (تتجاوز حد المحاولات). */
export async function retryProvision(ctx: StoreContext, id: string) {
  await requireSubscriptionsApi(ctx);
  const row = await subscriptionRepository.findProvision(ctx.storeId, id);
  if (!row) throw new NotFoundError("عملية التزويد", id);
  if (row.status === "succeeded") throw new ValidationError("هذه العملية ناجحة مسبقاً");
  return runProvision(row);
}

/** إنشاء اشتراك يدوياً لطلب مدفوع (مثلاً بعد إضافة الربط لاحقاً). */
export async function provisionOrderNow(ctx: StoreContext, orderId: string) {
  await requireSubscriptionsApi(ctx);
  const order = await orderRepository.findById(ctx.storeId, orderId);
  if (!order) throw new NotFoundError("الطلب", orderId);
  if (order.paymentStatus !== "paid") throw new ValidationError("الطلب غير مدفوع");
  return provisionSubscriptionsForOrder(ctx.storeId, orderId);
}
