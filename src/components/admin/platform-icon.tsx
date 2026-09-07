import type { Platform } from "@/modules/tracking";

/**
 * رموز المنصات ببطاقة بيضاء وألوان هويتها.
 * استثناء مقصود لقاعدة «لا ألوان ثابتة»: هذه ألوان علامات تجارية لا رموز ثيم —
 * أزرق ميتا أزرق في الوضعين، ولهذا البطاقة بيضاء دائماً كي يُقرأ الشعار صحيحاً.
 */
const TILE = "grid shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/5 shadow-sm";

function Meta() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M7.4 7.6c-2.4 0-3.9 2.1-3.9 4.4s1.5 4.4 3.9 4.4c3.5 0 5.1-8.8 9.3-8.8 2.4 0 3.8 2.1 3.8 4.4s-1.4 4.4-3.8 4.4c-3.5 0-5.1-8.8-9.3-8.8Z"
        stroke="#0081FB"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TikTok() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M15.6 3h-2.5v13.1a2.3 2.3 0 1 1-1.9-2.3v-2.5a4.8 4.8 0 1 0 4.4 4.8V9.4c.9.7 2 1.1 3.2 1.1V8a3.6 3.6 0 0 1-3.2-3.4V3Z" fill="#25F4EE" transform="translate(-1)" />
      <path d="M15.6 3h-2.5v13.1a2.3 2.3 0 1 1-1.9-2.3v-2.5a4.8 4.8 0 1 0 4.4 4.8V9.4c.9.7 2 1.1 3.2 1.1V8a3.6 3.6 0 0 1-3.2-3.4V3Z" fill="#FE2C55" transform="translate(1)" />
      <path d="M15.6 3h-2.5v13.1a2.3 2.3 0 1 1-1.9-2.3v-2.5a4.8 4.8 0 1 0 4.4 4.8V9.4c.9.7 2 1.1 3.2 1.1V8a3.6 3.6 0 0 1-3.2-3.4V3Z" fill="#010101" />
    </svg>
  );
}

function Snapchat() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M12 2.8c2.9 0 4.8 2.1 4.8 5 0 1.1-.1 2-.1 2.6.6.3 1.3.2 1.9 0 .7.7-.2 1.8-1.6 2.2.6 1.8 2.2 3.3 3.6 3.7.3.5-1.1 1.3-3 1.5-.2.4-.3 1-.5 1.3-.4.4-1.5-.2-2.7-.1-1.1.1-2 1.5-3.6 1.5s-2.5-1.4-3.6-1.5c-1.2-.1-2.3.5-2.7.1-.2-.3-.3-.9-.5-1.3-1.9-.2-3.3-1-3-1.5 1.4-.4 3-1.9 3.6-3.7-1.4-.4-2.3-1.5-1.6-2.2.6.2 1.3.3 1.9 0 0-.6-.1-1.5-.1-2.6 0-2.9 1.9-5 4.8-5Z"
        fill="#FFFC00"
        stroke="#111827"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Ga4() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect x="15.4" y="3" width="5.6" height="18" rx="2.8" fill="#F9AB00" />
      <rect x="9.2" y="8.6" width="5.6" height="12.4" rx="2.8" fill="#E37400" />
      <rect x="3" y="14.6" width="5.6" height="6.4" rx="2.8" fill="#E37400" opacity=".75" />
    </svg>
  );
}

function Clarity() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M12 3.5 21 20H3l9-16.5Z" fill="#3A6FD8" />
      <path d="M12 3.5 21 20h-9V3.5Z" fill="#5B8DEF" />
    </svg>
  );
}

/** حرف جوجل بألوانه الأربعة، مبسّطاً إلى حلقة وشريط. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z" fill="#EA4335" />
    </svg>
  );
}

function SearchConsole() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="#4285F4" strokeWidth="2" />
      <path d="M15.2 15.2 20 20" stroke="#34A853" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 11.5v2M10.5 8.5v5M13 10v3.5" stroke="#EA4335" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MerchantCenter() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M4 8.5 5.6 4h12.8L20 8.5v1.2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0V8.5Z" fill="#4285F4" />
      <path d="M5.5 12.6V20h13v-7.4" fill="none" stroke="#1A73E8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 20v-4.2h4V20" fill="none" stroke="#EA4335" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

const MARKS: Record<Platform, () => React.ReactElement> = {
  meta: Meta,
  tiktok: TikTok,
  snapchat: Snapchat,
  ga4: Ga4,
  clarity: Clarity,
  google: SearchConsole,
  merchant: MerchantCenter,
};

/**
 * التكامل غير المتصل يُخفَّف شعاره (رمادي وشفافية) بدل إخفاء لونه:
 * التعرّف البصري يبقى، والصف يقول «غير مفعّل» بلا كلمة.
 */
export function PlatformIcon({
  platform,
  className = "h-11 w-11",
  dimmed = false,
}: {
  platform: Platform;
  className?: string;
  dimmed?: boolean;
}) {
  const Mark = MARKS[platform];
  return (
    <span className={`${TILE} ${className} ${dimmed ? "opacity-55 grayscale" : ""}`}>
      <Mark />
    </span>
  );
}

export { GoogleMark };
