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
