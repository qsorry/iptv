/**
 * اختبار خلاصة المنتجات وحمولة Merchant Center بلا قاعدة بيانات:
 * المعرّف المركّب، التسعير والخصم، التوفّر، بصمة الحمولة، وصياغة XML.
 * يُشغَّل عبر `npm run test:feeds`.
 */
import assert from "node:assert/strict";
import { buildMerchantProduct, googleProductId, offerIdFor, payloadHash, DEFAULT_TARGET, type CatalogRow } from "@/modules/feeds/domain/product-payload";
import { productFeedXml, toFeedItem } from "@/modules/feeds/domain/feed-xml";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const row: CatalogRow = {
  productId: "11111111-2222-4333-8444-555555555555",
  name: "اشتراك IPTV سنوي",
  slug: "iptv-yearly",
  shortDescription: "باقة سنوية بجودة 4K",
  description: null,
  productType: "digital",
  sku: "IPTV-12M",
  price: "349.00",
  compareAtPrice: "499.00",
  image: "/media/iptv.jpg",
  onHand: 0,
};

const options = { origin: "https://com.ssouq.net", brand: "سمارت سوق", currency: "SAR" };

ok("المعرّف المركّب يتبع channel:lang:country:offerId ويستخدم الـ SKU", () => {
  assert.equal(offerIdFor(row), "IPTV-12M");
  assert.equal(googleProductId(offerIdFor(row)), "online:ar:SA:IPTV-12M");
  assert.equal(googleProductId("X", { ...DEFAULT_TARGET, targetCountry: "AE" }), "online:ar:AE:X");
  // بلا SKU يعود لمعرّف المنتج بدل أن يُرسل معرّفاً فارغاً.
  assert.equal(offerIdFor({ ...row, sku: null }), row.productId);
});

ok("الخصم يُرسل كـ sale_price والسعر الأساسي هو compare_at", () => {
  const p = buildMerchantProduct(row, options);
  assert.deepEqual(p.price, { value: "499.00", currency: "SAR" });
  assert.deepEqual(p.salePrice, { value: "349.00", currency: "SAR" });
  // بلا خصم: سعر واحد فقط.
  const noSale = buildMerchantProduct({ ...row, compareAtPrice: null }, options);
  assert.deepEqual(noSale.price, { value: "349.00", currency: "SAR" });
  assert.equal(noSale.salePrice, undefined);
  // compare_at أقل من السعر ليس خصماً.
  assert.equal(buildMerchantProduct({ ...row, compareAtPrice: "300.00" }, options).salePrice, undefined);
});

ok("التوفّر: الرقمي متاح دائماً والمادي يتبع المخزون", () => {
  assert.equal(buildMerchantProduct(row, options).availability, "in stock");
  assert.equal(buildMerchantProduct({ ...row, productType: "physical", onHand: 0 }, options).availability, "out of stock");
  assert.equal(buildMerchantProduct({ ...row, productType: "physical", onHand: 3 }, options).availability, "in stock");
});

ok("الروابط تُجعل مطلقة والمعرّفات العالمية تُنفى صراحة", () => {
  const p = buildMerchantProduct(row, options);
  assert.equal(p.link, "https://com.ssouq.net/products/iptv-yearly");
  assert.equal(p.imageLink, "https://com.ssouq.net/media/iptv.jpg");
  // رابط مطلق أصلاً يبقى كما هو.
  assert.equal(buildMerchantProduct({ ...row, image: "https://cdn.x/a.jpg" }, options).imageLink, "https://cdn.x/a.jpg");
  // بلا GTIN: التصريح يمنع رفض «معرّف ناقص».
  assert.equal(p.identifierExists, false);
  assert.equal(p.mpn, "IPTV-12M");
});

ok("البصمة مستقرة وتتغيّر مع السعر أو التوفّر فقط", () => {
  const a = payloadHash(buildMerchantProduct(row, options));
  assert.equal(a, payloadHash(buildMerchantProduct(row, options)));
  // حقل داخلي لا يظهر في الخلاصة لا يغيّر البصمة ← لا استهلاك حصة.
  assert.equal(a, payloadHash(buildMerchantProduct({ ...row, description: "وصف داخلي مختلف" }, options)));
  assert.notEqual(a, payloadHash(buildMerchantProduct({ ...row, price: "299.00" }, options)));
  assert.notEqual(a, payloadHash(buildMerchantProduct({ ...row, productType: "physical", onHand: 0 }, options)));
});

ok("XML يهرّب الرموز ويحذف الحقول الفارغة", () => {
  const item = toFeedItem(buildMerchantProduct({ ...row, name: 'باقة "4K" & أكثر' }, options));
  assert.equal(item.availability, "in_stock");
  assert.equal(item.price, "499.00 SAR");
  assert.equal(item.salePrice, "349.00 SAR");

  const xml = productFeedXml("سمارت سوق", options.origin, [item]);
  assert.ok(xml.includes("&quot;4K&quot; &amp; أكثر"));
  assert.ok(xml.includes("<g:sale_price>349.00 SAR</g:sale_price>"));
  assert.ok(!xml.includes("undefined"));

  const noImage = productFeedXml("م", options.origin, [{ ...item, imageLink: null, salePrice: null }]);
  assert.ok(!noImage.includes("image_link"));
  assert.ok(!noImage.includes("sale_price"));
});

console.log(`\nكل اختبارات الخلاصات نجحت (${passed}).`);
