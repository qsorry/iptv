import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "@/infrastructure/database/client";
import { db } from "@/infrastructure/database/client";
import { invoices, orders, stores, storeSettings } from "@/infrastructure/database/schema";
import { zatcaQrBase64 } from "./zatca";

/**
 * ينشئ فاتورة لطلب مدفوع (idempotent عبر قيد order). يُستدعى داخل transaction تسوية الدفع.
 */
export async function createInvoiceForOrder(executor: DbExecutor, params: { storeId: string; orderId: string }) {
  const existing = await executor.select({ id: invoices.id }).from(invoices).where(eq(invoices.orderId, params.orderId));
  if (existing.length > 0) return;

  const order = await executor.query.orders.findFirst({ where: eq(orders.id, params.orderId) });
  if (!order) return;
  const store = await executor.query.stores.findFirst({ where: eq(stores.id, params.storeId) });
  const settings = await executor.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, params.storeId) });
  const vatNumber = ((settings?.settings as Record<string, unknown> | undefined)?.vatNumber as string | undefined) ?? "";
  const sellerName = store?.name ?? "المتجر";

  const [{ count }] = await executor.select({ count: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.storeId, params.storeId));
  const invoiceNumber = `INV-${1000 + count + 1}`;
  const issuedAt = new Date();

  const qrData = zatcaQrBase64({
    sellerName,
    vatNumber,
    timestamp: issuedAt.toISOString(),
    total: order.grandTotal,
    vatTotal: order.taxTotal,
  });

  await executor.insert(invoices).values({
    storeId: params.storeId,
    orderId: order.id,
    invoiceNumber,
    sellerName,
    vatNumber: vatNumber || null,
    subtotal: order.subtotal,
    taxTotal: order.taxTotal,
    total: order.grandTotal,
    currencyCode: order.currencyCode,
    qrData,
    issuedAt,
  });
}

export const getInvoiceByOrder = (storeId: string, orderId: string) =>
  db.query.invoices.findFirst({ where: and(eq(invoices.storeId, storeId), eq(invoices.orderId, orderId)) });
