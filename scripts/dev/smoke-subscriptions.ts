/**
 * اختبار دخاني لأتمتة الاشتراكات الرقمية عبر API على قاعدة بيانات حقيقية.
 * يشغّل مزوّداً وهمياً محلياً (HTTP) ويتحقق من: حصر الميزة بالباقة الأعلى، إنشاء الاشتراك عند الدفع،
 * تسليمه ككود للعميل، وعدم تكرار التزويد عند إعادة المعالجة.
 * التشغيل: DATABASE_URL=... npx tsx scripts/dev/smoke-subscriptions.ts
 */
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { carts, cartItems, customers, digitalCodes, users } from "@/infrastructure/database/schema";
import { createStore } from "@/modules/stores";
import { createProduct } from "@/modules/catalog";
import { createOrder } from "@/modules/orders";
import { settlePayment } from "@/modules/payments";
import { setStorePlan, HIGHEST_PLAN } from "@/modules/billing";
import { createProvider, upsertMapping, testProvider, provisionSubscriptionsForOrder, subscriptionRepository, listProviders, listProviderPackages } from "@/modules/subscriptions";
import { ForbiddenError } from "@/core/errors";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`✓ ${msg}`);
};

/** مزوّد وهمي بنمط Falcon: Authorization: Bearer، POST /lines يرجّع بيانات الاشتراك. */
function startFakePanel(apiKey: string) {
  const calls: { path: string; body: string; auth: string | undefined }[] = [];
  let counter = 0;
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const auth = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || undefined;
      calls.push({ path: req.url ?? "", body: raw, auth });
      res.setHeader("Content-Type", "application/json");
      if (auth !== apiKey) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, error: "invalid_api_key" }));
      }
      if (req.url?.startsWith("/api/v1/me")) return res.end(JSON.stringify({ ok: true, data: { credits: 10 } }));
      if (req.url?.startsWith("/api/v1/packages")) return res.end(JSON.stringify({ ok: true, data: [{ id: 7, name: "3 Months" }, { id: 12, name: "12 Months" }] }));
      if (req.url?.startsWith("/api/v1/lines") && req.method === "POST") {
        const body = JSON.parse(raw) as Record<string, unknown>;
        counter++;
        return res.end(
          JSON.stringify({ ok: true, data: { username: `user${counter}`, password: `pass${counter}`, host: "http://panel.test:8080", exp_date: "2027-01-01", pkg: body.package_id, months: body.months } }),
        );
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: "not_found" }));
    });
  });
  return new Promise<{ url: string; calls: typeof calls; close: () => void }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}/api/v1`, calls, close: () => server.close() });
    });
  });
}

async function main() {
  const API_KEY = "test-key-123";
  const panel = await startFakePanel(API_KEY);

  const [owner] = await db.insert(users).values({ name: "Owner", email: `owner${Date.now()}@test.com` }).returning();
  const store = await createStore({ name: `متجر اشتراكات ${Date.now()}`, ownerUserId: owner.id });
  const ctx = { storeId: store.id, userId: owner.id, role: "owner" as const };

  // بلا باقة: الميزة مرفوضة.
  await createProvider(ctx, { name: "x", preset: "falcon", baseUrl: panel.url, apiKey: API_KEY })
    .then(() => assert(false, "يجب رفض إضافة مزوّد بلا الباقة الأعلى"))
    .catch((e) => assert(e instanceof ForbiddenError, "ربط API مرفوض للمتجر بلا الباقة الأعلى"));

  await setStorePlan(store.id, "pro");
  await createProvider(ctx, { name: "x", preset: "falcon", baseUrl: panel.url, apiKey: API_KEY })
    .then(() => assert(false, "يجب رفض الميزة لباقة pro"))
    .catch((e) => assert(e instanceof ForbiddenError, "ربط API مرفوض لباقة وسطى (pro)"));

  await setStorePlan(store.id, HIGHEST_PLAN.code);
  const provider = await createProvider(ctx, { name: "لوحة تجريبية", preset: "falcon", baseUrl: panel.url, apiKey: API_KEY });
  assert(provider.apiKeyMasked.endsWith("-123") && !("apiKeyEncrypted" in provider), `المفتاح مقنّع للعرض (${provider.apiKeyMasked})`);
  const [listed] = await listProviders(ctx);
  assert(listed.id === provider.id, "قائمة المزوّدين");

  const pkgs = await listProviderPackages(ctx, provider.id);
  assert(pkgs.length === 2 && pkgs[1].id === "12" && pkgs[1].name === "12 Months", "سحب الباقات من لوحة المزوّد");
  const test = await testProvider(ctx, provider.id);
  assert(test.ok, `اختبار الاتصال عبر Bearer (${test.message})`);

  const product = await createProduct(ctx, {
    name: "اشتراك IPTV سنة",
    productType: "digital",
    status: "active",
    variants: [{ name: "سنة", sku: "IPTV-12", price: "150.00", isDefault: true }],
  });
  const variant = product.variants[0];
  await upsertMapping(ctx, { variantId: variant.id, providerId: provider.id, packageId: "pkg-12", params: { months: 12, connections: 1 }, isActive: true });
  // كود واحد مخزّن مسبقاً: الطلب بكمية 3 يجب أن يأخذه ثم يُنشئ اثنين عبر API.
  await db.insert(digitalCodes).values({ storeId: store.id, variantId: variant.id, code: "HOST:stock|UserName:s|Password:s" });

  const [customer] = await db.insert(customers).values({ storeId: store.id, email: `c${Date.now()}@test.com`, firstName: "عميل" }).returning();
  const [cart] = await db.insert(carts).values({ storeId: store.id, customerId: customer.id, currencyCode: "SAR" }).returning();
  await db.insert(cartItems).values({ cartId: cart.id, variantId: variant.id, quantity: 3, unitPrice: "150.00" });
  const order = await createOrder({ storeId: store.id, cartId: cart.id, shippingAddress: { fullName: "عميل", country: "SA", city: "الرياض" } });

  const settled = await settlePayment({ storeId: store.id, orderId: order.id, provider: "test", amount: order.grandTotal, outcome: "succeeded" });
  assert(settled.paid && settled.assignments[0]?.codes.length === 1 && settled.assignments[0]?.shortBy === 2, "الدفع سلّم كود المخزون وسجّل نقص 2");

  const r1 = await provisionSubscriptionsForOrder(store.id, order.id);
  assert(r1.created === 2 && r1.succeeded === 2 && r1.failed === 0, `التزويد أنشأ اشتراكين عبر API (${JSON.stringify(r1)})`);
  const createCalls = panel.calls.filter((c) => c.path.endsWith("/lines"));
  assert(createCalls.length === 2 && createCalls.every((c) => c.auth === API_KEY), "نداءان للمزوّد بالمفتاح الصحيح (Bearer)");
  const sent = JSON.parse(createCalls[0].body) as Record<string, unknown>;
  assert(sent.package_id === "pkg-12" && String(sent.external_id).startsWith(order.orderNumber) && String(sent.note).includes(order.orderNumber), `القالب مرّر الباقة وexternal_id ورقم الطلب (${JSON.stringify(sent)})`);

  const delivered = await db.select().from(digitalCodes).where(eq(digitalCodes.orderId, order.id));
  assert(delivered.length === 3 && delivered.every((c) => c.status === "delivered"), "العميل يستلم 3 أكواد: 1 مخزون + 2 من API");
  const apiCode = delivered.find((c) => c.code.includes("user1"));
  assert(
    apiCode?.code === "HOST:http://panel.test:8080|UserName:user1|Password:pass1|Expires:2027-01-01|M3U:http://panel.test:8080/get.php?username=user1&password=pass1&type=m3u_plus&output=ts",
    `صيغة كود API مع رابط M3U مشتق (${apiCode?.code})`,
  );

  // إعادة المعالجة (worker أعاد الحدث) لا تُنشئ اشتراكات إضافية.
  const r2 = await provisionSubscriptionsForOrder(store.id, order.id);
  assert(r2.created === 0 && r2.succeeded === 0 && panel.calls.filter((c) => c.path.endsWith("/lines")).length === 2, "التزويد idempotent عند إعادة المعالجة");

  const log = await subscriptionRepository.provisionsForOrder(store.id, order.id);
  assert(log.length === 2 && log.every((p) => p.status === "succeeded" && p.credentials?.username), "سجل التزويد يحوي بيانات الاشتراك");

  panel.close();
  console.log("\nكل اختبارات الاشتراكات نجحت.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit());
