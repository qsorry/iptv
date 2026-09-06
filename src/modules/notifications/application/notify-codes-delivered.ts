import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { orders, customers, stores } from "@/infrastructure/database/schema";
import { codeRepository } from "@/modules/codes";
import { dispatch } from "./dispatch";

/**
 * يُنشئ رسالة تسليم الأكواد ويرسلها عبر القنوات المتاحة للمتجر.
 * الإيميل للجميع؛ الواتساب/الرسائل حسب ميزات المتجر ووجود هاتف العميل.
 */
export async function notifyCodesDelivered(storeId: string, orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return;
  const codes = await codeRepository.deliveredForOrder(storeId, orderId);
  if (codes.length === 0) return;

  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  const customer = order.customerId ? await db.query.customers.findFirst({ where: eq(customers.id, order.customerId) }) : null;

  const codeList = codes.map((c) => c.code);
  const subject = `طلبك ${order.orderNumber} — بيانات الاشتراك`;
  const textBody = [
    `مرحباً،`,
    `تم تأكيد طلبك رقم ${order.orderNumber} في ${store?.name ?? "المتجر"}.`,
    ``,
    `بيانات الاشتراك / الأكواد:`,
    ...codeList.map((c) => `• ${c}`),
    ``,
    `شكراً لك.`,
  ].join("\n");
  const htmlBody = textBody.replace(/\n/g, "<br>");

  const results: Record<string, string> = {};

  if (customer?.email) {
    results.email = (await dispatch({ storeId, channel: "email", type: "order.codes_delivered", recipient: customer.email, subject, body: htmlBody, data: { orderId } })).status;
  }
  if (customer?.phone) {
    results.whatsapp = (await dispatch({ storeId, channel: "whatsapp", type: "order.codes_delivered", recipient: customer.phone, body: textBody, data: { orderId } })).status;
    results.sms = (await dispatch({ storeId, channel: "sms", type: "order.codes_delivered", recipient: customer.phone, body: textBody, data: { orderId } })).status;
  }
  return results;
}
