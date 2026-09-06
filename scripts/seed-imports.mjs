/**
 * بذرة استيراد بيانات سلة عند إقلاع الحاوية (بعد الهجرات، قبل الخادم).
 * يقرأ ملفات JSON مُلتزمة في المستودع تحت data/salla-import ويُدرجها كسجلات تاريخية.
 * - لا يمسّ المخزون ولا آلة الحالة؛ مجرد لقطة (snapshot) للطلبات السابقة.
 * - Idempotent: يتخطّى الطلب إن وُجد بنفس رقم الطلب للمتجر.
 * - لا يُفشل الإقلاع أبداً: أي خطأ يُسجَّل ويُكمل إلى الخادم.
 *
 * يعتمد فقط على postgres (موجود وقت التشغيل، مثل migrate.mjs).
 */
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("seed: DATABASE_URL غير مضبوط — تخطّي");
  process.exit(0);
}

const ordersPath = new URL("../data/salla-import/orders.json", import.meta.url).pathname;

const money = (n) => Number(n || 0).toFixed(2);
const cleanEmail = (e) => {
  const v = String(e || "").trim().toLowerCase();
  return v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : null;
};
const cleanPhone = (p) => {
  let v = String(p || "").trim().replace(/[\s\-()]/g, "");
  const plus = v.startsWith("+");
  v = v.replace(/[^\d]/g, "");
  return v ? (plus ? "+" : "") + v : null;
};

const sql = postgres(url, { max: 1, prepare: false });

async function resolveStoreId() {
  const slug = process.env.DEFAULT_STORE_SLUG;
  if (slug) {
    const r = await sql`select id, currency_code from stores where slug = ${slug} and status = 'active' limit 1`;
    if (r.length) return r[0];
  }
  const active = await sql`select id, currency_code from stores where status = 'active' order by created_at asc limit 2`;
  if (active.length === 1) return active[0];
  if (active.length > 1) {
    console.error("seed: أكثر من متجر نشط ولا DEFAULT_STORE_SLUG — تخطّي الطلبات");
    return null;
  }
  return null;
}

async function upsertCustomer(storeId, c) {
  const email = cleanEmail(c?.email);
  const phone = cleanPhone(c?.phone);
  const firstName = (c?.first_name || c?.full_name || "").trim() || null;
  const lastName = (c?.last_name || "").trim() || null;
  if (!email && !phone) return null;

  let existing = [];
  if (email) existing = await sql`select id from customers where store_id = ${storeId} and email = ${email} limit 1`;
  if (!existing.length && phone) existing = await sql`select id from customers where store_id = ${storeId} and phone = ${phone} limit 1`;
  if (existing.length) return existing[0].id;

  const ins = await sql`
    insert into customers (store_id, email, phone, first_name, last_name)
    values (${storeId}, ${email}, ${phone}, ${firstName}, ${lastName})
    returning id`;
  return ins[0].id;
}

/** يُدرج كود اشتراك مُسلَّم مرتبطاً بالطلب (Idempotent بالمتجر+الكود). variant_id قد يكون null للمستورد. */
async function insertCode(storeId, orderId, orderItemId, code, deliveredAt) {
  const c = code.trim();
  if (!c) return;
  const exists = await sql`select id from digital_codes where store_id = ${storeId} and code = ${c} limit 1`;
  if (exists.length) {
    await sql`update digital_codes set order_id = ${orderId}, order_item_id = ${orderItemId}, status = 'delivered', delivered_at = ${deliveredAt} where id = ${exists[0].id}`;
    return;
  }
  await sql`
    insert into digital_codes (store_id, variant_id, code, status, order_id, order_item_id, delivered_at)
    values (${storeId}, null, ${c}, 'delivered', ${orderId}, ${orderItemId}, ${deliveredAt})`;
}

async function importOrders(store) {
  if (!existsSync(ordersPath)) return { created: 0, skipped: 0 };
  let orders;
  try {
    orders = JSON.parse(readFileSync(ordersPath, "utf8"));
  } catch (e) {
    console.error("seed: تعذّر قراءة orders.json —", e.message);
    return { created: 0, skipped: 0 };
  }
  if (!Array.isArray(orders) || orders.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;
  for (const o of orders) {
    const orderNumber = String(o.reference_id ?? o.order_number ?? "").trim();
    if (!orderNumber) {
      skipped++;
      continue;
    }
    try {
      const exists = await sql`select id from orders where store_id = ${store.id} and order_number = ${orderNumber} limit 1`;
      if (exists.length) {
        skipped++;
        continue;
      }
      const customerId = await upsertCustomer(store.id, o.customer);
      const currency = (o.currency || store.currency_code || "SAR").slice(0, 3);
      const grand = money(o.total);
      const placedAt = o.date ? new Date(o.date) : new Date();
      const status = o.status === "completed" ? "completed" : o.status === "cancelled" ? "cancelled" : "confirmed";
      const paymentStatus = o.payment_status === "paid" ? "paid" : "unpaid";

      const pm = String(o.payment_method || "").trim();
      const notes = pm ? `مستورد من سلة · طريقة الدفع: ${pm}` : "مستورد من سلة";
      const subtotal = money(o.subtotal ?? o.total);
      const tax = money(o.tax ?? 0);
      const orderRow = await sql`
        insert into orders (store_id, customer_id, order_number, currency_code, status, payment_status, fulfillment_status, subtotal, discount_total, shipping_total, tax_total, grand_total, placed_at, notes)
        values (${store.id}, ${customerId}, ${orderNumber}, ${currency}, ${status}, ${paymentStatus},
                ${paymentStatus === "paid" ? "fulfilled" : "unfulfilled"}, ${subtotal}, '0', '0', ${tax}, ${grand}, ${placedAt}, ${notes})
        returning id`;
      const orderId = orderRow[0].id;

      const items = Array.isArray(o.items) ? o.items : [];
      let firstItemId = null;
      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity || 1));
        const unit = money(it.unit_price ?? Number(o.total) / qty);
        const total = money(Number(unit) * qty);
        const itemRow = await sql`
          insert into order_items (order_id, product_name, unit_price, quantity, total)
          values (${orderId}, ${String(it.name || "منتج")}, ${unit}, ${qty}, ${total})
          returning id`;
        if (!firstItemId) firstItemId = itemRow[0].id;
        // كود الاشتراك على مستوى العنصر (إن وُجد).
        if (it.code) {
          await insertCode(store.id, orderId, itemRow[0].id, String(it.code), placedAt);
        }
      }
      // كود الاشتراك على مستوى الطلب (صيغة سلة الشائعة: كود واحد للطلب).
      if (o.code) await insertCode(store.id, orderId, firstItemId, String(o.code), placedAt);
      created++;
    } catch (e) {
      skipped++;
      console.error(`seed: فشل استيراد الطلب ${orderNumber} —`, e.message);
    }
  }
  return { created, skipped };
}

try {
  const store = await resolveStoreId();
  if (!store) {
    console.log("seed: لا يوجد متجر مستهدف — تخطّي");
  } else {
    const r = await importOrders(store);
    console.log(`✓ بذرة سلة: طلبات أُضيفت ${r.created}، تخطّي ${r.skipped}`);
  }
} catch (e) {
  console.error("seed: خطأ عام (تجاهُل ومتابعة) —", e?.message || e);
} finally {
  await sql.end();
}
