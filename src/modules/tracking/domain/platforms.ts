/** المنصات المدعومة في الإطلاق. إضافة منصة = ملف في adapters/ وسطر هنا. */
export const PLATFORMS = ["ga4", "meta", "tiktok", "snapchat", "clarity", "google"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformField {
  name: string;
  label: string;
  /** السر يُشفَّر في القاعدة ولا يُعاد إلا مقنّعاً. */
  secret?: boolean;
  placeholder?: string;
}

export interface PlatformDef {
  key: Platform;
  label: string;
  note: string;
  /** الغرض الذي تفحصه الموافقة قبل الإرسال. */
  purpose: "analytics" | "marketing";
  /** هل له Adapter يرسل من السيرفر؟ */
  serverSide: boolean;
  config: PlatformField[];
  secrets: PlatformField[];
}

export const PLATFORM_DEFS: Record<Platform, PlatformDef> = {
  ga4: {
    key: "ga4",
    label: "Google Analytics 4",
    note: "سيرفري بالكامل عبر Measurement Protocol. لا نحتاج Google Tag Manager.",
    purpose: "analytics",
    serverSide: true,
    config: [{ name: "measurementId", label: "Measurement ID", placeholder: "G-XXXXXXX" }],
    secrets: [{ name: "apiSecret", label: "API Secret" }],
  },
  meta: {
    key: "meta",
    label: "Meta (Pixel + Conversions API)",
    note: "المتصفح والسيرفر معاً مع إزالة التكرار عبر event_id.",
    purpose: "marketing",
    serverSide: true,
    config: [{ name: "pixelId", label: "Pixel ID", placeholder: "1234567890" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok (Pixel + Events API)",
    note: "Purchase يقابله CompletePayment.",
    purpose: "marketing",
    serverSide: true,
    config: [{ name: "pixelCode", label: "Pixel Code" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
  },
  snapchat: {
    key: "snapchat",
    label: "Snapchat (Pixel + Conversions API)",
    note: "حصّة سناب في السوق السعودي تبرّر وجوده من اليوم الأول.",
    purpose: "marketing",
    serverSide: true,
    config: [{ name: "pixelId", label: "Pixel ID" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
  },
  clarity: {
    key: "clarity",
    label: "Microsoft Clarity",
    note: "سطر واحد، مجاني، ويكشف مشاكل تجربة الشراء.",
    purpose: "analytics",
    serverSide: false,
    config: [{ name: "projectId", label: "Project ID" }],
    secrets: [],
  },
  google: {
    key: "google",
    label: "Search Console + Merchant Center",
    note: "Search Console تحقّق ملكية فقط. خلاصة المنتجات على /feed/products.xml.",
    purpose: "analytics",
    serverSide: false,
    config: [
      { name: "siteVerification", label: "رمز تحقق Search Console", placeholder: "google-site-verification" },
      { name: "merchantId", label: "Merchant Center ID (اختياري)" },
    ],
    secrets: [],
  },
};

/** المنصات التي لها Adapter يرسل من الطابور. */
export const SERVER_PLATFORMS = PLATFORMS.filter((p) => PLATFORM_DEFS[p].serverSide);

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}
