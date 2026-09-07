"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_CHANGED, readConsentCookie, type ConsentState } from "./consent-client";

export interface PixelConfig {
  meta?: string;
  tiktok?: string;
  snapchat?: string;
  clarity?: string;
}

/** أسماء الأحداث في كل بكسل — نسخة المتصفح من جدول الأحداث الموحّد. */
const BROWSER_MAP: Record<string, { meta?: string; tiktok?: string; snapchat?: string }> = {
  page_view: { meta: "PageView", tiktok: "Pageview", snapchat: "PAGE_VIEW" },
  view_item: { meta: "ViewContent", tiktok: "ViewContent", snapchat: "VIEW_CONTENT" },
  search: { meta: "Search", tiktok: "Search", snapchat: "SEARCH" },
  add_to_cart: { meta: "AddToCart", tiktok: "AddToCart", snapchat: "ADD_CART" },
  begin_checkout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout", snapchat: "START_CHECKOUT" },
  add_payment_info: { meta: "AddPaymentInfo", tiktok: "AddPaymentInfo", snapchat: "ADD_BILLING" },
  purchase: { meta: "Purchase", tiktok: "CompletePayment", snapchat: "PURCHASE" },
  sign_up: { meta: "CompleteRegistration", tiktok: "CompleteRegistration", snapchat: "SIGN_UP" },
  add_to_wishlist: { meta: "AddToWishlist", tiktok: "AddToWishlist", snapchat: "ADD_TO_WISHLIST" },
  remove_from_cart: {},
};

type Fn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fn & { callMethod?: Fn; queue?: unknown[]; loaded?: boolean; version?: string; push?: Fn };
    _fbq?: unknown;
    ttq?: Record<string, unknown> & { track?: Fn; page?: Fn; load?: Fn };
    TiktokAnalyticsObject?: string;
    snaptr?: Fn & { queue?: unknown[]; handleRequest?: Fn };
    clarity?: Fn & { q?: unknown[] };
    dataLayer?: unknown[];
    /** واجهة الصفحة لإطلاق حدث: نفس event_id للمتصفح وللسيرفر. */
    sqTrack?: (name: string, data?: Record<string, unknown>, options?: { eventId?: string; serverSide?: boolean }) => void;
  }
}

function injectScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.id = id;
  el.async = true;
  el.src = src;
  document.head.appendChild(el);
}

function loadMeta(pixelId: string) {
  if (window.fbq) return;
  const fbq: Window["fbq"] = function (...args: unknown[]) {
    if (fbq!.callMethod) fbq!.callMethod(...args);
    else fbq!.queue!.push(args);
  } as NonNullable<Window["fbq"]>;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  injectScript("sq-meta-pixel", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", pixelId);
}

function loadTikTok(pixelCode: string) {
  if (window.ttq) return;
  window.TiktokAnalyticsObject = "ttq";
  const queue: unknown[] = [];
  const ttq: Record<string, unknown> = { _i: {}, _t: {}, _o: {}, _q: queue };
  for (const method of ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"]) {
    ttq[method] = (...args: unknown[]) => queue.push([method, ...args]);
  }
  window.ttq = ttq as Window["ttq"];
  injectScript("sq-tiktok-pixel", `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelCode)}&lib=ttq`);
}

function loadSnapchat(pixelId: string) {
  if (window.snaptr) return;
  const snaptr: Window["snaptr"] = function (...args: unknown[]) {
    if (snaptr!.handleRequest) snaptr!.handleRequest(...args);
    else snaptr!.queue!.push(args);
  } as NonNullable<Window["snaptr"]>;
  snaptr.queue = [];
  window.snaptr = snaptr;
  injectScript("sq-snap-pixel", "https://sc-static.net/scevent.min.js");
  window.snaptr("init", pixelId);
}

function loadClarity(projectId: string) {
  if (window.clarity) return;
  const clarity: Window["clarity"] = function (...args: unknown[]) {
    clarity!.q!.push(args);
  } as NonNullable<Window["clarity"]>;
  clarity.q = [];
  window.clarity = clarity;
  injectScript("sq-clarity", `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`);
}

/** Google Consent Mode v2: الحالة الافتراضية denied حتى يوافق الزائر. */
function setConsentMode(consent: ConsentState) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push([
    "consent",
    "update",
    {
      ad_storage: consent.marketing ? "granted" : "denied",
      ad_user_data: consent.marketing ? "granted" : "denied",
      ad_personalization: consent.marketing ? "granted" : "denied",
      analytics_storage: consent.analytics ? "granted" : "denied",
    },
  ]);
}

/**
 * يحمّل البكسلات بعد الموافقة فقط، ويعرّف window.sqTrack.
 * كل حدث يولّد event_id واحداً يُرسل للبكسل وللسيرفر معاً — بدونه يُحتسب Purchase مرتين.
 */
export function TrackingScripts({ pixels, autoPageView = true }: { pixels: PixelConfig; autoPageView?: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    const apply = (consent: ConsentState | null) => {
      if (!consent) return;
      setConsentMode(consent);
      if (consent.analytics && pixels.clarity) loadClarity(pixels.clarity);
      if (!consent.marketing) return;
      if (pixels.meta) loadMeta(pixels.meta);
      if (pixels.tiktok) loadTikTok(pixels.tiktok);
      if (pixels.snapchat) loadSnapchat(pixels.snapchat);
    };

    apply(readConsentCookie());
    const onChange = (e: Event) => apply((e as CustomEvent<ConsentState>).detail);
    window.addEventListener(CONSENT_CHANGED, onChange);

    window.sqTrack = (name, data = {}, options = {}) => {
      const eventId = options.eventId ?? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      const consent = readConsentCookie();
      const map = BROWSER_MAP[name] ?? {};

      if (consent?.marketing) {
        if (map.meta && window.fbq) window.fbq("track", map.meta, data, { eventID: eventId });
        if (map.tiktok && window.ttq?.track) window.ttq.track(map.tiktok, data, { event_id: eventId });
        if (map.snapchat && window.snaptr) window.snaptr("track", map.snapchat, { ...data, client_dedup_id: eventId });
      }

      if (options.serverSide === false) return;
      // المحرك المركزي يفحص الموافقة مرة أخرى على الخادم؛ لا نعتمد على المتصفح.
      void fetch("/api/v1/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ event: name, eventId, url: window.location.href, referrer: document.referrer, data }),
      }).catch(() => undefined);
    };

    return () => {
      window.removeEventListener(CONSENT_CHANGED, onChange);
    };
  }, [pixels]);

  useEffect(() => {
    if (autoPageView) window.sqTrack?.("page_view");
  }, [pathname, autoPageView]);

  return null;
}
