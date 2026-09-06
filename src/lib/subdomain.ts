/**
 * يحوّل نصاً إلى subdomain صالح كاسم مضيف (ASCII، a-z 0-9 وشرطة).
 * الأسماء العربية بالكامل لا تصلح كاسم مضيف، لذا نرجع سلسلة فارغة ليتولّى المنادي التوليد البديل.
 */
export function subdomainize(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\x20-\x7E]/g, "") // إزالة غير ASCII (بما فيه العربية)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export const isValidSubdomain = (s: string) => HOSTNAME_LABEL.test(s);

const RESERVED = new Set([
  "www", "api", "admin", "app", "mail", "smtp", "ftp", "ns1", "ns2",
  "cdn", "static", "assets", "auth", "dashboard",
]);
export const isReservedSubdomain = (s: string) => RESERVED.has(s);

/** subdomain احتياطي عشوائي عندما لا يمكن اشتقاقه من الاسم. */
export const randomSubdomain = () => "store-" + Math.random().toString(36).slice(2, 8);

/** التحقق من دومين مخصص كامل (hostname). */
const HOSTNAME = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
export const isValidHostname = (s: string) => HOSTNAME.test(s.toLowerCase());
