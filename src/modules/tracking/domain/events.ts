/** الاسم الموحّد للحدث. المنصات تُترجم منه في adapters/. */
export const UNIFIED_EVENTS = [
  "page_view",
  "view_item",
  "search",
  "add_to_cart",
  "begin_checkout",
  "add_payment_info",
  "purchase",
  "sign_up",
  "add_to_wishlist",
  "remove_from_cart",
] as const;

export type UnifiedEventName = (typeof UNIFIED_EVENTS)[number];

export function isUnifiedEvent(value: string): value is UnifiedEventName {
  return (UNIFIED_EVENTS as readonly string[]).includes(value);
}

/** null = لا مقابل على المنصة؛ يُسجَّل داخلياً ولا يُرسل. */
export const EVENT_MAP: Record<UnifiedEventName, { ga4: string | null; meta: string | null; tiktok: string | null; snapchat: string | null }> = {
  page_view: { ga4: "page_view", meta: "PageView", tiktok: "Pageview", snapchat: "PAGE_VIEW" },
  view_item: { ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent", snapchat: "VIEW_CONTENT" },
  search: { ga4: "search", meta: "Search", tiktok: "Search", snapchat: "SEARCH" },
  add_to_cart: { ga4: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart", snapchat: "ADD_CART" },
  begin_checkout: { ga4: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout", snapchat: "START_CHECKOUT" },
  add_payment_info: { ga4: "add_payment_info", meta: "AddPaymentInfo", tiktok: "AddPaymentInfo", snapchat: "ADD_BILLING" },
  // انتبه: تيك توك يسمّيه CompletePayment لا Purchase.
  purchase: { ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment", snapchat: "PURCHASE" },
  sign_up: { ga4: "sign_up", meta: "CompleteRegistration", tiktok: "CompleteRegistration", snapchat: "SIGN_UP" },
  add_to_wishlist: { ga4: "add_to_wishlist", meta: "AddToWishlist", tiktok: "AddToWishlist", snapchat: "ADD_TO_WISHLIST" },
  // تحليل السلة المتروكة فقط. لا مقابل إعلانياً.
  remove_from_cart: { ga4: "remove_from_cart", meta: null, tiktok: null, snapchat: null },
};

export interface EventItem {
  id: string;
  name?: string;
  qty: number;
  /** بوحدة العملة الكبرى (ريال) بمنزلتين — لا هللة، المنصات تتوقع كسوراً عشرية. */
  price: number;
}

export interface EventConsent {
  analytics: boolean;
  marketing: boolean;
}

export interface EventUser {
  emailSha256?: string | null;
  phoneSha256?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  clickIds?: Partial<Record<"fbc" | "fbp" | "ttclid" | "sccid" | "gclid" | "ttp", string | null>>;
}

export interface EventData {
  currency?: string;
  /** قيمة المنتجات فقط: بدون شحن ولا ضريبة. قاعدة موحّدة عبر كل المنصات. */
  value?: number;
  orderId?: string;
  searchTerm?: string;
  items?: EventItem[];
}

/** payload واحد ← يترجمه Adapter لكل منصة. */
export interface UnifiedEvent {
  eventId: string;
  eventName: UnifiedEventName;
  /** unix seconds */
  eventTime: number;
  eventSourceUrl?: string | null;
  consent: EventConsent;
  user: EventUser;
  data: EventData;
}
