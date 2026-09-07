/**
 * اختبار نظام الثيمات بلا قاعدة بيانات: القائمة البيضاء، الحل، التباين، وتخطيط الرئيسية.
 * يُشغَّل عبر `npm run test:theme` ويُنفَّذ قبل اختبارات الدخان.
 */
import assert from "node:assert/strict";
import { parseThemeOverrides, resolveTheme, themeStyleCss, THEME_REGISTRY, contrastOn, contrastRatio, isVariant, DEFAULT_HOME_LAYOUT } from "@/design-system";
import { resolveHomeLayout } from "@/modules/stores/application/home-layout";
import { storeThemeOverrides, fontPreloads, googleFontHref } from "@/modules/stores/themes";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

ok("القائمة البيضاء تهمل المفاتيح والقيم غير الصالحة", () => {
  const o = parseThemeOverrides({
    "--color-brand-primary": "#123456",
    "--color-brand-accent": "red",
    "--page-bg": "#FFFFFF",
    "--card-radius": "var(--radius-xl)",
    "--button-radius": "13px",
    "--font-family": "'Cairo', system-ui, sans-serif",
    "--text-primary": "#000000",
    "--surface-primary": "url(javascript:alert(1))",
  });
  assert.deepEqual(o, {
    "--color-brand-primary": "#123456",
    "--page-bg": "#FFFFFF",
    "--card-radius": "var(--radius-xl)",
    "--button-radius": "13px",
    "--font-family": "'Cairo', system-ui, sans-serif",
  });
  assert.deepEqual(parseThemeOverrides(null), {});
  assert.deepEqual(parseThemeOverrides("x"), {});
});

ok("كل ثيم في السجل يحلّ إلى لوحتين كاملتين", () => {
  for (const key of Object.keys(THEME_REGISTRY)) {
    const r = resolveTheme(key);
    assert.equal(r.key, key);
    for (const mode of [r.light, r.dark]) {
      assert.match(mode["--color-brand-primary"], /^#/);
      assert.match(mode["--color-canvas"], /^#/);
      assert.ok(mode["--card-radius"]);
      assert.ok(mode["--font-family"]);
      assert.ok(contrastRatio(mode["--color-ink"], mode["--color-canvas"]) >= 4.5, `${key}: تباين النص/الخلفية`);
      assert.ok(contrastRatio(mode["--color-brand-primary"], mode["--color-on-brand"]) >= 3, `${key}: تباين النص فوق العلامة`);
    }
  }
});

ok("ثيم سمارت سوق يحمل هوية النموذج", () => {
  const r = resolveTheme("smartsouq");
  assert.equal(r.light["--color-brand-primary"], "#2563EB");
  assert.equal(r.light["--color-brand-accent"], "#F59E0B");
  assert.equal(r.light["--color-canvas"], "#F8FAFC");
  assert.equal(r.light["--card-radius"], "var(--radius-lg)");
  assert.match(r.light["--font-family"], /IBM Plex Sans Arabic/);
});

ok("تجاوز اللون الأساسي يعيد حساب لون النص فوقه ويُطبَّق على الوضعين", () => {
  const r = resolveTheme("smartsouq", { "--color-brand-primary": "#FFFF00", "--page-bg": "#FFFFFF" });
  assert.equal(r.light["--color-on-brand"], contrastOn("#FFFF00"));
  assert.equal(r.dark["--color-brand-primary"], "#FFFF00");
  assert.equal(r.light["--page-bg"], "#FFFFFF");
  assert.equal(r.dark["--page-bg"], undefined, "تجاوز الخلفية لا يمس الوضع الداكن");
});

ok("ثيم مجهول يعود إلى الافتراضي", () => {
  assert.equal(resolveTheme("nope").key, "modern");
});

ok("CSS المحقون يحوي الفاتح والداكن وتفضيل النظام", () => {
  const css = themeStyleCss("#sf-root", resolveTheme("smartsouq"));
  assert.match(css, /^#sf-root\{/);
  assert.match(css, /#sf-root\[data-theme="dark"\]/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.doesNotMatch(css, /</, "لا وسوم داخل CSS");
});

ok("إعدادات المتجر القديمة تُترجم إلى القائمة البيضاء", () => {
  const o = storeThemeOverrides({ brandColor: "#004d73", font: "cairo", roundness: "round", themeOverrides: { "--color-brand-accent": "#111111" } });
  assert.equal(o["--color-brand-primary"], "#004d73");
  assert.match(o["--font-family"]!, /Cairo/);
  assert.equal(o["--card-radius"], "var(--radius-xl)");
  assert.equal(o["--color-brand-accent"], "#111111");
  assert.equal(storeThemeOverrides({ brandColor: "#004d73", brandFromTheme: true })["--color-brand-primary"], undefined);
});

ok("الخطوط المستضافة ذاتياً تُحمَّل مسبقاً ولا تُطلب من Google", () => {
  assert.equal(fontPreloads(undefined, "smartsouq").length, 2);
  assert.equal(googleFontHref(undefined, "smartsouq"), undefined);
  assert.equal(googleFontHref("tajawal"), undefined);
  assert.equal(fontPreloads("cairo").length, 0);
  assert.match(googleFontHref("cairo")!, /fonts\.googleapis\.com/);
});

ok("سجل الـ variants يرفض غير المسجّل", () => {
  assert.ok(isVariant("hero", "split"));
  assert.ok(!isVariant("hero", "modern-v2"));
  assert.ok(!isVariant("button", "purple"));
});

ok("تخطيط الرئيسية يُصفّى من الأقسام المجهولة ويعود للافتراضي عند الفراغ", () => {
  assert.equal(resolveHomeLayout(undefined), DEFAULT_HOME_LAYOUT);
  const l = resolveHomeLayout({ homeLayout: { sections: [{ id: "h", type: "hero", variant: "banner" }, { id: "x", type: "carousel" }, { id: "y", type: "hero", variant: "big" }] } });
  assert.deepEqual(l.sections, [{ id: "h", type: "hero", variant: "banner" }]);
  assert.equal(resolveHomeLayout({ homeLayout: { sections: [{ id: "x", type: "carousel" }] } }), DEFAULT_HOME_LAYOUT);
});

console.log(`\nكل اختبارات الثيمات نجحت (${passed}).`);
