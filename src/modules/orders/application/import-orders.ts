import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { orders, orderItems, customers, digitalCodes } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";

export interface OrderImportItem {
  name: string;
  quantity: number;
  unitPrice?: string;
  code?: string;
}

export interface OrderImportRow {
  orderNumber: string;
  date?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  total?: string;
  subtotal?: string;
  tax?: string;
  customer: { firstName?: string; lastName?: string; email?: string; phone?: string };
  items: OrderImportItem[];
  code?: string;
}

export interface OrderImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const money = (v?: string | number) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};
const cleanEmail = (e?: string) => {
  const v = (e ?? "").trim().toLowerCase();
  return v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : undefined;
};
const cleanPhone = (p?: string) => {
  let v = (p ?? "").trim().replace(/[\s\-()]/g, "");
  const plus = v.startsWith("+");
  v = v.replace(/[^\d]/g, "");
  return v ? (plus ? "+" : "") + v : undefined;
};

const mapStatus = (s?: string): "pending" | "confirmed" | "processing" | "completed" | "cancelled" => {
  const v = (s ?? "").toLowerCase();
  if (v.includes("cancel") || v.includes("ملغ") || v.includes("مسترجع") || v.includes("مرتجع")) return "cancelled";
  if (v.includes("complet") || v.includes("مكتمل") || v.includes("تم") || v.includes("منفذ") || v.includes("مؤكد") || v.includes("deliver")) return "completed";
  if (v.includes("process") || v.includes("تنفيذ") || v.includes("تجهيز")) return "processing";
  return "confirmed";
};
const mapPay = (s?: string, status?: string): "paid" | "unpaid" => {
  const v = `${s ?? ""} ${status ?? ""}`.toLowerCase();
  if (v.includes("unpaid") || v.includes("غير مدفوع") || v.includes("بانتظار") || v.includes("pending") || v.includes("لم يدفع")) return "unpaid";
  if (v.includes("paid") || v.includes("مدفوع") || v.includes("مكتمل") || v.includes("تم") || v.includes("مؤكد")) return "paid";
  return "paid"; // تصدير الطلبات التاريخية غالباً مدفوع
};

async function upsertCustomer(storeId: string, c: OrderImportRow["customer"]): Promise<string | null> {
  const email = cleanEmail(c.email);
  const phone = cleanPhone(c.phone);
  const firstName = (c.firstName ?? "").trim() || undefined;
  const lastName = (c.lastName ?? "").trim() || undefined;
  if (!email && !phone) return null;

  let existing = email ? await db.query.customers.findFirst({ where: and(eq(customers.storeId, storeId), eq(customers.email, email)) }) : undefined;
  if (!existing && phone) existing = await db.query.customers.findFirst({ where: and(eq(customers.storeId, storeId), eq(customers.phone, phone)) });
  if (existing) {
    await db.update(customers).set({ email: existing.email ?? email, phone: existing.phone ?? phone, firstName: firstName ?? existing.firstName, lastName: lastName ?? existing.lastName, updatedAt: new Date() }).where(eq(customers.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(customers).values({ storeId, email, phone, firstName, lastName }).returning();
  return row.id;
}

async function attachCode(storeId: string, orderId: string, orderItemId: string | null, code: string, deliveredAt: Date) {
  const c = code.trim();
  if (!c) return;
  const existing = await db.query.digitalCodes.findFirst({ where: and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.code, c)) });
  if (existing) {
    await db.update(digitalCodes).set({ orderId, orderItemId, status: "delivered", deliveredAt, updatedAt: new Date() }).where(eq(digitalCodes.id, existing.id));
    return;
  }
  await db.insert(digitalCodes).values({ storeId, variantId: null, code: c, status: "delivered", orderId, orderItemId, deliveredAt });
}

/** يستورد طلبات سلة التاريخية كسجلات (snapshot). لا يمسّ المخزون. Idempotent برقم الطلب. */
export async function importOrders(ctx: StoreContext, rows: OrderImportRow[]): Promise<OrderImportResult> {
  requireRole(ctx, "owner", "admin");
  const result: OrderImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of rows) {
    const orderNumber = String(row.orderNumber ?? "").trim();
    if (!orderNumber) {
      result.skipped++;
      continue;
    }
    try {
      const existing = await db.query.orders.findFirst({ where: and(eq(orders.storeId, ctx.storeId), eq(orders.orderNumber, orderNumber)) });
      if (existing) {
        result.skipped++;
        continue;
      }
      const customerId = await upsertCustomer(ctx.storeId, row.customer);
      const status = mapStatus(row.status);
      const paymentStatus = mapPay(row.paymentStatus, row.status);
      const grand = money(row.total);
      const subtotal = row.subtotal ? money(row.subtotal) : grand;
      const tax = money(row.tax);
      const placedAt = row.date ? new Date(row.date) : new Date();
      const pm = (row.paymentMethod ?? "").trim();
      const notes = pm ? `مستورد من سلة · طريقة الدفع: ${pm}` : "مستورد من سلة";

      const [orderRow] = await db
        .insert(orders)
        .values({
          storeId: ctx.storeId,
          customerId,
          orderNumber,
          currencyCode: "SAR",
          status,
          paymentStatus,
          fulfillmentStatus: paymentStatus === "paid" ? "fulfilled" : "unfulfilled",
          subtotal,
          taxTotal: tax,
          grandTotal: grand,
          placedAt: isNaN(placedAt.getTime()) ? new Date() : placedAt,
          notes,
        })
        .returning();

      let firstItemId: string | null = null;
      for (const it of row.items.length ? row.items : [{ name: "منتج", quantity: 1 }]) {
        const qty = Math.max(1, Number(it.quantity || 1));
        const unit = it.unitPrice ? money(it.unitPrice) : money(Number(grand) / qty);
        const [itemRow] = await db.insert(orderItems).values({ orderId: orderRow.id, productName: it.name || "منتج", unitPrice: unit, quantity: qty, total: money(Number(unit) * qty) }).returning();
        if (!firstItemId) firstItemId = itemRow.id;
        if (it.code) await attachCode(ctx.storeId, orderRow.id, itemRow.id, it.code, placedAt);
      }
      if (row.code) await attachCode(ctx.storeId, orderRow.id, firstItemId, row.code, placedAt);
      result.created++;
    } catch (e) {
      result.failed++;
      if (result.errors.length < 20) result.errors.push(`${orderNumber}: ${e instanceof Error ? e.message : "خطأ"}`);
    }
  }
  return result;
}

/**
 * يحوّل صفوف CSV (تصدير سلة) إلى طلبات، مع تجميع الصفوف حسب رقم الطلب
 * (قد يكون للطلب عدة صفوف منتجات). يطابق أسماء الأعمدة الشائعة عربي/إنجليزي.
 */
export function mapOrderCsvRows(objects: Record<string, string>[]): OrderImportRow[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, "");
  const pick = (o: Record<string, string>, keys: string[]) => {
    const map = new Map(Object.keys(o).map((k) => [norm(k), o[k]]));
    for (const k of keys) {
      const v = map.get(norm(k));
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return undefined;
  };

    // الكود قد يكون في «الملاحظات الداخلية» بصيغ متعددة؛ نتحقق أنه فعلاً كود.
  const codeFrom = (o: Record<string, string>) => {
    const raw = pick(o, ["الكود", "كود الاشتراك", "كود المنتج", "الكود الرقمي", "بيانات المنتج", "محتوى المنتج", "البطاقة", "code", "digital", "card", "الملاحظات الداخلية", "internal notes"]);
    if (!raw) return undefined;
    if (!/(user\s*name|username|اسم المستخدم|password|كلمة السر|host|الهوست|http|xtream|m3u|mac\s*:)/i.test(raw)) return undefined;
    const parts = raw
      .split(/[\n|]+/)
      .map((p) => p.trim().replace(/^[-—•\s]+|[-—•\s]+$/g, ""))
      .filter((p) => p && !/^[-—=_\s]+$/.test(p) && !p.includes("بيانات الاشتراك"));
    return parts.length ? parts.join(" | ") : undefined;
  };

  const byOrder = new Map<string, OrderImportRow>();
  for (const o of objects) {
    const orderNumber =
      pick(o, ["رقم الطلب", "order number", "order_id", "order id", "reference_id", "reference id", "رقم مرجع الطلب", "الطلب", "رقم", "id", "order"]) ?? "";
    if (!orderNumber) continue;

    const item: OrderImportItem = {
      name: pick(o, ["المنتج", "المنتجات", "اسم المنتج", "اسماء المنتجات مع sku", "product", "product name", "products", "item"]) ?? "منتج",
      quantity: Number(pick(o, ["الكمية", "إجمالي كمية الطلب", "quantity", "qty", "الكميه"]) ?? 1) || 1,
      unitPrice: pick(o, ["سعر المنتج", "سعر الوحدة", "السعر", "price", "unit price", "product price"]),
      code: codeFrom(o),
    };

    let row = byOrder.get(orderNumber);
    if (!row) {
      row = {
        orderNumber,
        date: pick(o, ["تاريخ الطلب", "التاريخ", "date", "created at", "created_at", "order date"]),
        status: pick(o, ["حالة الطلب", "الحالة", "status", "order status"]),
        paymentStatus: pick(o, ["حالة الدفع", "الدفع", "payment status", "payment_status"]),
        paymentMethod: pick(o, ["طريقة الدفع", "payment method", "payment_method", "وسيلة الدفع"]),
        total: pick(o, ["إجمالي المبيعات", "إجمالي الطلب", "الإجمالي", "المجموع", "الاجمالي", "صافي المبيعات", "مجموع السلة", "total", "grand total", "order total", "amount"]),
        subtotal: pick(o, ["المجموع الفرعي", "الإجمالي الفرعي", "صافي المبيعات", "subtotal", "sub total", "sub_total"]),
        tax: pick(o, ["الضريبة", "ضريبة القيمة المضافة", "tax", "vat"]),
        customer: {
          firstName: pick(o, ["اسم العميل", "العميل", "الاسم", "customer", "customer name", "name", "الاسم الأول", "first name"]),
          lastName: pick(o, ["اسم العائلة", "last name"]),
          email: pick(o, ["بريد العميل", "البريد الإلكتروني", "البريد", "email", "e-mail", "customer email"]),
          phone: pick(o, ["رقم الجوال", "الجوال", "الهاتف", "mobile", "phone", "customer mobile"]),
        },
        items: [],
        code: codeFrom(o),
      };
      // فصل الاسم الكامل إلى أول/أخير إن لزم.
      if (row.customer.firstName && !row.customer.lastName && /\s/.test(row.customer.firstName)) {
        const parts = row.customer.firstName.split(/\s+/);
        row.customer.firstName = parts.shift();
        row.customer.lastName = parts.join(" ");
      }
      byOrder.set(orderNumber, row);
    }
    if (item.name || item.code) row.items.push(item);
  }
  return [...byOrder.values()];
}
