/**
 * اختبار محرك التتبّع والإسناد بلا قاعدة بيانات: جدول الأحداث، الهاش،
 * إزالة التكرار، الموافقة، بناء طلبات المنصات، تشفير التوكنات، والتقاط utm.
 * يُشغَّل عبر `npm run test:tracking`.
 */
import assert from "node:assert/strict";
import { EVENT_MAP, isUnifiedEvent, UNIFIED_EVENTS, type UnifiedEvent } from "@/modules/tracking/domain/events";
import { deterministicEventId, hashEmail, hashPhone } from "@/modules/tracking/domain/hash";
import { allowsAnything, allowsPlatform, consentModeState, consentOrDenied, parseConsent, serializeConsent } from "@/modules/tracking/application/consent";
import { ga4Adapter } from "@/modules/tracking/adapters/ga4";
import { metaAdapter } from "@/modules/tracking/adapters/meta";
import { tiktokAdapter } from "@/modules/tracking/adapters/tiktok";
import { snapchatAdapter } from "@/modules/tracking/adapters/snapchat";
import { encryptSecret, decryptSecret, maskSecret } from "@/modules/tracking/infrastructure/crypto";
import { parseTouch, hasSource, deviceFromUserAgent } from "@/modules/attribution/domain/touch";

process.env.INTEGRATIONS_SECRET_KEY ??= "test-key-for-tracking-suite";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const event: UnifiedEvent = {
  eventId: "8f3c1e2a-0000-4000-8000-000000000001",
  eventName: "purchase",
  eventTime: 1757260800,
  eventSourceUrl: "https://ssouq.com/checkout/success",
  consent: { analytics: true, marketing: true },
  user: {
    emailSha256: "a".repeat(64),
    phoneSha256: "b".repeat(64),
    externalId: "cus_1042",
    clientIp: "1.2.3.4",
    userAgent: "UA",
    clickIds: { fbc: "fb.1.1.abc", fbp: "fb.1.1.xyz", ttclid: "tt1", sccid: "sc1", gclid: "gc1" },
  },
  data: { currency: "SAR", value: 349, orderId: "SQ-10442", items: [{ id: "SKU-88", name: "باقة", qty: 1, price: 349 }] },
};

ok("جدول الأحداث يغطي كل حدث موحّد، والشراء اسمه CompletePayment في تيك توك", () => {
  for (const name of UNIFIED_EVENTS) assert.ok(EVENT_MAP[name], `لا مقابل معرّف لـ ${name}`);
  assert.equal(EVENT_MAP.purchase.tiktok, "CompletePayment");
  assert.equal(EVENT_MAP.purchase.snapchat, "PURCHASE");
  assert.equal(EVENT_MAP.purchase.meta, "Purchase");
  // remove_from_cart داخلي فقط: لا يُرسل لأي منصة إعلانية.
  assert.equal(EVENT_MAP.remove_from_cart.meta, null);
  assert.equal(EVENT_MAP.remove_from_cart.tiktok, null);
  assert.equal(EVENT_MAP.remove_from_cart.snapchat, null);
  assert.ok(isUnifiedEvent("add_to_cart"));
  assert.ok(!isUnifiedEvent("Purchase"));
});

ok("الهاش يُطبّع البريد والجوال قبل SHA-256", () => {
  assert.equal(hashEmail("  Ahmed@Example.COM "), hashEmail("ahmed@example.com"));
  assert.equal(hashEmail("لا-بريد"), null);
  // 05x محلي و+9665x و009665x كلها نفس الرقم بصيغة E.164 بلا +.
  const a = hashPhone("0512345678");
  assert.equal(a, hashPhone("+966512345678"));
  assert.equal(a, hashPhone("00966 512 345 678"));
  assert.equal(hashPhone(""), null);
  assert.match(a!, /^[0-9a-f]{64}$/);
});

ok("event_id المشتق ثابت وبصيغة UUID صالحة", () => {
  const id = deterministicEventId("purchase:order-1");
  assert.equal(id, deterministicEventId("purchase:order-1"));
  assert.notEqual(id, deterministicEventId("purchase:order-2"));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

ok("الموافقة تُقرأ وتُكتب وتحجب المنصات التسويقية", () => {
  assert.deepEqual(parseConsent(serializeConsent({ analytics: true, marketing: false })), { analytics: true, marketing: false });
  assert.equal(parseConsent("خطأ"), null);
  // لا موافقة مخزّنة = رفض.
  assert.deepEqual(consentOrDenied(undefined), { analytics: false, marketing: false });
  const analyticsOnly = { analytics: true, marketing: false };
  assert.ok(allowsPlatform(analyticsOnly, "ga4"));
  assert.ok(allowsPlatform(analyticsOnly, "clarity"));
  assert.ok(!allowsPlatform(analyticsOnly, "meta"));
  assert.ok(!allowsPlatform(analyticsOnly, "snapchat"));
  assert.ok(!allowsAnything({ analytics: false, marketing: false }));
  assert.equal(consentModeState(analyticsOnly).ad_storage, "denied");
  assert.equal(consentModeState(analyticsOnly).analytics_storage, "granted");
});

ok("GA4 يبني طلب Measurement Protocol مع event_id", () => {
  const req = ga4Adapter.build(event, { measurementId: "G-123" }, { apiSecret: "s3cret" })!;
  assert.ok(req.url.includes("measurement_id=G-123"));
  assert.ok(req.url.includes("api_secret=s3cret"));
  const body = req.body as { events: { name: string; params: Record<string, unknown> }[] };
  assert.equal(body.events[0].name, "purchase");
  assert.equal(body.events[0].params.event_id, event.eventId);
  assert.equal(body.events[0].params.transaction_id, "SQ-10442");
  assert.equal(body.events[0].params.value, 349);
  // إعداد ناقص ← لا إرسال بدل إرسال مشوّه.
  assert.equal(ga4Adapter.build(event, { measurementId: "G-123" }, {}), null);
});

ok("Meta يرسل بيانات المستخدم مهشّرة ومعها event_id لإزالة التكرار", () => {
  const req = metaAdapter.build(event, { pixelId: "999" }, { accessToken: "tok" })!;
  assert.ok(req.url.startsWith("https://graph.facebook.com/"));
  const data = (req.body as { data: Record<string, never>[] }).data[0] as unknown as {
    event_name: string;
    event_id: string;
    user_data: Record<string, unknown>;
    custom_data: Record<string, unknown>;
  };
  assert.equal(data.event_name, "Purchase");
  assert.equal(data.event_id, event.eventId);
  assert.deepEqual(data.user_data.em, ["a".repeat(64)]);
  assert.equal(data.user_data.fbc, "fb.1.1.abc");
  assert.equal(data.custom_data.value, 349);
  // لا مقابل للحدث ← يُتخطّى.
  assert.equal(metaAdapter.build({ ...event, eventName: "remove_from_cart" }, { pixelId: "999" }, { accessToken: "tok" }), null);
});

ok("TikTok يرسل CompletePayment بالتوكن في الترويسة", () => {
  const req = tiktokAdapter.build(event, { pixelCode: "PX" }, { accessToken: "tok" })!;
  assert.equal(req.headers?.["Access-Token"], "tok");
  const d = (req.body as { data: unknown[] }).data[0] as { event: string; event_id: string; user: Record<string, unknown> };
  assert.equal(d.event, "CompletePayment");
  assert.equal(d.event_id, event.eventId);
  assert.equal(d.user.ttclid, "tt1");
});

ok("Snapchat يرسل PURCHASE بالتوقيت بالملّي ثانية", () => {
  const req = snapchatAdapter.build(event, { pixelId: "SNAP" }, { accessToken: "tok" })!;
  const d = (req.body as { data: unknown[] }).data[0] as { event_name: string; event_time: number; user_data: Record<string, unknown> };
  assert.equal(d.event_name, "PURCHASE");
  assert.equal(d.event_time, event.eventTime * 1000);
  assert.equal(d.user_data.sc_click_id, "sc1");
});

ok("التوكنات تُشفَّر وتُفكّ ولا تعود للواجهة إلا مقنّعة", () => {
  const stored = encryptSecret("EAAG-super-secret-token");
  assert.notEqual(stored, "EAAG-super-secret-token");
  assert.equal(decryptSecret(stored), "EAAG-super-secret-token");
  // نفس النص يعطي نصاً مخزّناً مختلفاً (IV عشوائي).
  assert.notEqual(encryptSecret("x"), encryptSecret("x"));
  assert.equal(maskSecret("EAAG-super-secret-token"), "••••oken");
  assert.throws(() => decryptSecret("not-a-secret"));
});

ok("الإسناد يلتقط utm والـ click ids ويهمل referrer الداخلي", () => {
  const touch = parseTouch({
    url: "https://ssouq.com/products/x?utm_source=snap&utm_medium=cpc&utm_campaign=eid&gclid=G1&ttclid=T1",
    referrer: "https://www.snapchat.com/",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
  });
  assert.equal(touch.utmSource, "snap");
  assert.equal(touch.utmMedium, "cpc");
  assert.equal(touch.utmCampaign, "eid");
  assert.equal(touch.gclid, "G1");
  assert.equal(touch.ttclid, "T1");
  assert.equal(touch.landingPage, "https://ssouq.com/products/x");
  assert.equal(touch.device, "mobile");
  assert.ok(hasSource(touch));

  const internal = parseTouch({ url: "https://ssouq.com/cart", referrer: "https://ssouq.com/products/x", userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
  assert.equal(internal.referrer, null);
  assert.equal(internal.device, "desktop");
  // زيارة مباشرة بلا مصدر لا تستحق الكتابة فوق آخر حملة.
  assert.ok(!hasSource(internal));
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0)"), "tablet");
});

console.log(`\nكل اختبارات التتبّع نجحت (${passed}).`);
