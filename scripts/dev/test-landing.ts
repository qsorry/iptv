/**
 * اختبار صفحة الهبوط التجارية بلا قاعدة بيانات: القائمة البيضاء،
 * التحرير السطري، والبيانات المهيكلة (FAQPage و ItemList).
 * يُشغَّل عبر `npm run test:landing`.
 */
import assert from "node:assert/strict";
import { readLanding, landingSchema, parseLines, parsePairs, formatPairs, faqJsonLd, packagesJsonLd, hasContent } from "@/modules/content/domain/landing";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

ok("القائمة البيضاء تُسقط الحقول المجهولة وتتسامح مع القيم التالفة", () => {
  const parsed = landingSchema.parse({ hero: { heading: "اشتراك IPTV", script: "<script>x</script>" }, ghost: { a: 1 } });
  assert.equal(parsed.hero.heading, "اشتراك IPTV");
  assert.ok(!("script" in parsed.hero));
  assert.ok(!("ghost" in parsed));
  // محتوى تالف لا يُسقط الصفحة.
  assert.deepEqual(readLanding("نص").faq.items, []);
  assert.deepEqual(readLanding(null).hero.badges, []);
});

ok("لا سعر داخل محتوى الصفحة: الباقات معرّفات منتجات فقط", () => {
  const parsed = landingSchema.parse({ packages: { productIds: ["11111111-2222-4333-8444-555555555555"], price: "349" } });
  assert.deepEqual(parsed.packages.productIds, ["11111111-2222-4333-8444-555555555555"]);
  assert.ok(!("price" in parsed.packages));
  // معرّف غير صالح يُرفض بدل أن يُخزَّن ويكسر الصفحة لاحقاً.
  assert.equal(landingSchema.safeParse({ packages: { productIds: ["ليس-uuid"] } }).success, false);
});

ok("التحرير السطري: سطر لكل عنصر و«العنوان | النص»", () => {
  assert.deepEqual(parseLines("Samsung\n\n  LG  \nAndroid"), ["Samsung", "LG", "Android"]);
  const pairs = parsePairs("ما هو IPTV؟ | خدمة بث\nسطر بلا فاصل");
  assert.deepEqual(pairs, [
    { first: "ما هو IPTV؟", second: "خدمة بث" },
    { first: "سطر بلا فاصل", second: "" },
  ]);
  // الجواب قد يحوي الفاصل نفسه: نقسم عند أول فاصل فقط.
  assert.deepEqual(parsePairs("سؤال | جواب فيه | فاصل"), [{ first: "سؤال", second: "جواب فيه | فاصل" }]);
  // ذهاب وإياب بلا فقد.
  const rows = [{ first: "تفعيل فوري", second: "خلال دقائق" }];
  assert.deepEqual(parsePairs(formatPairs(rows)), rows);
});

ok("بيانات FAQPage تُبنى من الأسئلة، ولا تُرسم بلا محتوى", () => {
  assert.equal(faqJsonLd([]), null);
  const ld = faqJsonLd([{ question: "ما هو IPTV؟", answer: "خدمة بث" }]) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(ld.mainEntity[0].name, "ما هو IPTV؟");
  assert.equal(ld.mainEntity[0].acceptedAnswer.text, "خدمة بث");
});

ok("ItemList للباقات يحمل السعر والتوفّر بترتيب العرض", () => {
  assert.equal(packagesJsonLd([]), null);
  const ld = packagesJsonLd([
    { name: "سنة", url: "https://x/products/y", price: "349.00", currency: "SAR", available: true },
    { name: "شهر", url: "https://x/products/z", price: "49.00", currency: "SAR", available: false },
  ]) as { itemListElement: { position: number; item: { name: string; offers: { price: string; availability: string } } }[] };
  assert.equal(ld.itemListElement[0].position, 1);
  assert.equal(ld.itemListElement[0].item.offers.price, "349.00");
  assert.match(ld.itemListElement[1].item.offers.availability, /OutOfStock$/);
});

ok("الأقسام الفارغة لا تُرسم", () => {
  const empty = readLanding({});
  assert.ok(!hasContent.hero(empty) && !hasContent.faq(empty) && !hasContent.packages(empty));
  assert.ok(hasContent.hero(readLanding({ hero: { heading: "عنوان" } })));
  assert.ok(hasContent.devices(readLanding({ devices: { items: ["Samsung"] } })));
});

console.log(`\nكل اختبارات صفحة الهبوط نجحت (${passed}).`);
