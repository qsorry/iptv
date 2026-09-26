/** توقيت المنصة (السعودية، بلا توقيت صيفي). */
export const PLATFORM_TZ = "Asia/Riyadh";
const PLATFORM_OFFSET = "+03:00";

/**
 * قيمة حقل <input type="date"> («2026-10-01») تعني «حتى نهاية ذلك اليوم» بتوقيت السعودية،
 * لا منتصف ليل UTC (الذي يوافق 03:00 صباحاً في الرياض فيقطع اليوم الأخير). أي قيمة أخرى تُقرأ كما هي.
 */
export function parseDateInput(v: unknown): Date | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59.999${PLATFORM_OFFSET}`);
  return new Date(s);
}
