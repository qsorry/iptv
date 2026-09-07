const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** «منذ ١٢ دقيقة» بالعربية، بدقة تكفي لوحة تحكم: دقائق ثم ساعات ثم أيام. */
export function relativeTime(date: Date | null | undefined, now = Date.now()): string | null {
  if (!date) return null;
  const diff = now - date.getTime();
  if (diff < 0) return "الآن";
  if (diff < MINUTE) return "قبل ثوانٍ";
  if (diff < HOUR) return `منذ ${Math.round(diff / MINUTE)} دقيقة`;
  if (diff < DAY) return `منذ ${Math.round(diff / HOUR)} ساعة`;
  if (diff < 30 * DAY) return `منذ ${Math.round(diff / DAY)} يوم`;
  return date.toISOString().slice(0, 10);
}
