import type { Platform } from "@/modules/tracking";

/**
 * رمز لكل منصة. أشكال مبسّطة بلون النص الحالي (currentColor) فتعمل في
 * الوضعين الفاتح والداكن بلا صور ولا طلبات شبكة.
 */
const PATHS: Record<Platform, { d: string; fill?: boolean }[]> = {
  // مخطط أعمدة: التحليلات
  ga4: [{ d: "M4 20h16M7 20V11M12 20V5M17 20v-6" }],
  // حلقتان متشابكتان
  meta: [{ d: "M4 15c0-4 2-7 4.2-7 3.4 0 4 8 7.6 8C17.9 16 20 13.4 20 10.5 20 7.6 18.2 6 16.2 6 12.6 6 11 14 7.4 14 5.6 14 4 12.4 4 10.4" }],
  // علامة موسيقية
  tiktok: [{ d: "M14 4v9.5a3.5 3.5 0 1 1-2.6-3.4M14 4c.4 2.2 2.1 3.8 4.3 4" }],
  // شبح سناب
  snapchat: [{ d: "M12 3.5c2.6 0 4.3 1.9 4.3 4.5 0 1-.1 1.9-.1 2.4.5.3 1.2.2 1.7 0 .6.6-.2 1.6-1.4 2 .5 1.6 2 3 3.2 3.3.3.4-1 1.2-2.7 1.4-.2.3-.2.9-.4 1.1-.3.3-1.3-.2-2.4-.1-1 .1-1.8 1.4-3.2 1.4s-2.2-1.3-3.2-1.4c-1.1-.1-2.1.4-2.4.1-.2-.2-.2-.8-.4-1.1-1.7-.2-3-1-2.7-1.4 1.2-.3 2.7-1.7 3.2-3.3-1.2-.4-2-1.4-1.4-2 .5.2 1.2.3 1.7 0 0-.5-.1-1.4-.1-2.4C7.7 5.4 9.4 3.5 12 3.5Z" }],
  // عين: تسجيل الجلسات
  clarity: [{ d: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" }, { d: "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" }],
  // عدسة بحث: Search Console
  google: [{ d: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l4.5 4.5" }],
  // حقيبة تسوّق: Merchant Center
  merchant: [{ d: "M5 8h14l-1 12H6L5 8Z" }, { d: "M9 8V6a3 3 0 0 1 6 0v2" }],
};

export function PlatformIcon({ platform, className = "h-5 w-5" }: { platform: Platform; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[platform].map((p, i) => (
        <path key={i} d={p.d} />
      ))}
    </svg>
  );
}
