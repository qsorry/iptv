/** دمج أسماء الـ classes مع تجاهل القيم الفارغة. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
