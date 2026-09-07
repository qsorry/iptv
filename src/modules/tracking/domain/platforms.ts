/** المنصات المدعومة في الإطلاق. إضافة منصة = ملف في adapters/ وسطر هنا. */
export const PLATFORMS = ["ga4", "meta", "tiktok", "snapchat", "clarity", "google", "merchant"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformField {
  name: string;
  label: string;
  /** السر يُشفَّر في القاعدة ولا يُعاد إلا مقنّعاً. */
  secret?: boolean;
  placeholder?: string;
  /** حقل طويل يُعرض كمساحة نص (ملف JSON مثلاً). */
  multiline?: boolean;
}

/** رابط عام للمتجر يُعرض داخل بطاقة المنصة جاهزاً للنسخ. */
export interface PlatformLink {
  path: string;
  label: string;
  /** أين يُلصق بالضبط في لوحة المنصة. */
  hint: string;
}

export interface PlatformDef {
  key: Platform;
  label: string;
  note: string;
  /** الغرض الذي تفحصه الموافقة قبل الإرسال. */
  purpose: "analytics" | "marketing";
  /** هل له Adapter يرسل من السيرفر؟ */
  serverSide: boolean;
  /** هل يحتاج المتصفح قراءة `config`؟ ما عداه لا يغادر الخادم. */
  publicConfig?: boolean;
  config: PlatformField[];
  secrets: PlatformField[];
  links?: PlatformLink[];
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
    publicConfig: true,
    config: [{ name: "pixelId", label: "Pixel ID", placeholder: "1234567890" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
    links: [
      {
        path: "/feed/products.xml",
        label: "رابط خلاصة المنتجات",
        hint: "Commerce Manager ← الكتالوجات ← مصادر البيانات ← إضافة عناصر ← خلاصة مجدولة",
      },
    ],
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok (Pixel + Events API)",
    note: "Purchase يقابله CompletePayment.",
    purpose: "marketing",
    serverSide: true,
    publicConfig: true,
    config: [{ name: "pixelCode", label: "Pixel Code" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
    links: [
      {
        path: "/feed/products.xml",
        label: "رابط خلاصة المنتجات",
        hint: "TikTok Ads Manager ← الأصول ← الكتالوجات ← إضافة منتجات ← خلاصة مجدولة",
      },
    ],
  },
  snapchat: {
    key: "snapchat",
    label: "Snapchat (Pixel + Conversions API)",
    note: "حصّة سناب في السوق السعودي تبرّر وجوده من اليوم الأول.",
    purpose: "marketing",
    serverSide: true,
    publicConfig: true,
    config: [{ name: "pixelId", label: "Pixel ID" }],
    secrets: [{ name: "accessToken", label: "Access Token" }],
    links: [
      {
        path: "/feed/products.xml",
        label: "رابط خلاصة المنتجات",
        hint: "Snapchat Ads ← الأصول ← الكتالوجات ← إضافة كتالوج ← خلاصة",
      },
    ],
  },
  clarity: {
    key: "clarity",
    label: "Microsoft Clarity",
    note: "سطر واحد، مجاني، ويكشف مشاكل تجربة الشراء.",
    purpose: "analytics",
    serverSide: false,
    publicConfig: true,
    config: [{ name: "projectId", label: "Project ID" }],
    secrets: [],
  },
  google: {
    key: "google",
    label: "Google Search Console",
    note: "تحقّق ملكية فقط: يُحقن الرمز في وسم <meta> على واجهة المتجر.",
    purpose: "analytics",
    serverSide: false,
    publicConfig: true,
    config: [{ name: "siteVerification", label: "رمز تحقق Search Console", placeholder: "google-site-verification" }],
    secrets: [],
    links: [
      {
        path: "/sitemap.xml",
        label: "خريطة الموقع",
        hint: "Search Console ← Sitemaps ← أدخل sitemap.xml ثم إرسال. تتحدّث تلقائياً مع كل منتج.",
      },
      {
        path: "/robots.txt",
        label: "robots.txt",
        hint: "يشير إلى خريطة الموقع تلقائياً — للاطلاع فقط، لا يحتاج ضبطاً.",
      },
    ],
  },
  merchant: {
    key: "merchant",
    label: "Google Merchant Center",
    note: "دفع الكتالوج بالـ Content API: رفع أولي، مزامنة لحظية عند كل تغيير، ومطابقة ليلية. لا تربط خلاصة مجدولة على نفس المنتجات حتى لا تتنازع مع الـ API.",
    purpose: "analytics",
    serverSide: false,
    config: [
      { name: "merchantId", label: "Merchant Center ID", placeholder: "1234567" },
      { name: "targetCountry", label: "بلد الاستهداف", placeholder: "SA" },
      { name: "contentLanguage", label: "لغة المحتوى", placeholder: "ar" },
    ],
    secrets: [{ name: "serviceAccountJson", label: "ملف حساب الخدمة (JSON)", multiline: true }],
  },
};

/** المنصات التي لها Adapter يرسل من الطابور. */
export const SERVER_PLATFORMS = PLATFORMS.filter((p) => PLATFORM_DEFS[p].serverSide);

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}
