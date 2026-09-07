/** أدوات لون صغيرة تعمل على الخادم والعميل بلا تبعيات. */

const HEX6 = /^#([0-9a-f]{6})$/i;

/** هل النص لون hex من 6 خانات؟ */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX6.test(value.trim());
}

/** لون نص مناسب فوق لون معطى (أبيض أو غامق حسب السطوع). */
export function contrastOn(hex: string): string {
  const m = HEX6.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0F172A" : "#ffffff";
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** الإضاءة النسبية وفق WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const m = HEX6.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** نسبة التباين بين لونين (1 → 21) وفق WCAG. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
