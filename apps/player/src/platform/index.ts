/**
 * طبقة المنصة: نفس الكود يعمل على Samsung (Tizen) وLG (webOS) وVIDAA وغلاف Android/Android TV والمتصفح.
 * كل ما يخص جهازاً بعينه (أزرار الريموت، الخروج) هنا فقط.
 */

export type PlatformKind = "tizen" | "webos" | "android" | "vidaa" | "browser";

interface TizenApi {
  tvinputdevice?: { registerKey(name: string): void; getSupportedKeys?(): { name: string }[] };
  application?: { getCurrentApplication(): { exit(): void } };
}

interface WebOsApi {
  platformBack?: () => void;
}

/** الواجهة التي يحقنها غلاف Android (android/app/.../MainActivity.java). */
interface AndroidBridge {
  isTv(): boolean;
  exitApp(): void;
}

declare global {
  interface Window {
    tizen?: TizenApi;
    webOS?: WebOsApi;
    PalmSystem?: unknown;
    SsouqAndroid?: AndroidBridge;
  }
}

function detect(): PlatformKind {
  if (typeof window === "undefined") return "browser";
  if (window.tizen) return "tizen";
  if (window.webOS || window.PalmSystem) return "webos";
  if (window.SsouqAndroid) return "android";
  if (/VIDAA|Hisense/i.test(navigator.userAgent)) return "vidaa";
  return "browser";
}

export const platformKind: PlatformKind = detect();

/** جهاز يُتحكم به بالريموت (لا لمس): تلفزيونات، أو غلاف Android على Android TV. */
export function isTvDevice(): boolean {
  if (platformKind === "tizen" || platformKind === "webos" || platformKind === "vidaa") return true;
  if (platformKind === "android") {
    try {
      return window.SsouqAndroid!.isTv();
    } catch {
      return false;
    }
  }
  return /SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|Android TV|AFT|BRAVIA|GoogleTV/i.test(navigator.userAgent);
}

/** أزرار الوسائط تحتاج تسجيلاً صريحاً في Tizen، وإلا يستهلكها النظام. */
export function registerRemoteKeys() {
  const input = window.tizen?.tvinputdevice;
  if (!input) return;
  const wanted = ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop", "MediaFastForward", "MediaRewind", "ChannelUp", "ChannelDown", "Info", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let supported: Set<string> | null = null;
  try {
    supported = new Set((input.getSupportedKeys?.() ?? []).map((k) => k.name));
  } catch {
    supported = null;
  }
  for (const key of wanted) {
    if (supported && supported.size > 0 && !supported.has(key)) continue;
    try {
      input.registerKey(key);
    } catch {
      // مفتاح غير مدعوم في هذا الطراز.
    }
  }
}

/** الخروج من التطبيق عند الرجوع من الشاشة الرئيسية. */
export function exitApp() {
  try {
    if (platformKind === "tizen") return window.tizen!.application!.getCurrentApplication().exit();
    if (platformKind === "webos") return window.webOS!.platformBack?.();
    if (platformKind === "android") return window.SsouqAndroid!.exitApp();
  } catch {
    // نكمل للمحاولة العامة.
  }
  window.close();
}

/** هل يمكن الخروج فعلاً؟ في المتصفح لا نعرض خيار الخروج. */
export const canExit = platformKind !== "browser";

export type RemoteAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "ok"
  | "back"
  | "playpause"
  | "play"
  | "pause"
  | "stop"
  | "ff"
  | "rw"
  | "chup"
  | "chdown"
  | "info";

/** أكواد الريموت في Tizen وwebOS وAndroid WebView ولوحة المفاتيح. */
const KEYCODES: Record<number, RemoteAction> = {
  37: "left",
  38: "up",
  39: "right",
  40: "down",
  13: "ok",
  10009: "back", // Tizen
  461: "back", // webOS
  27: "back",
  166: "back", // BrowserBack
  10252: "playpause", // Tizen
  179: "playpause", // Android
  415: "play",
  19: "pause",
  413: "stop",
  417: "ff",
  412: "rw",
  427: "chup", // Tizen
  428: "chdown",
  33: "chup", // webOS/Android: PageUp
  34: "chdown",
  457: "info", // webOS
};

const KEYNAMES: Record<string, RemoteAction> = {
  ArrowLeft: "left",
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  Enter: "ok",
  Escape: "back",
  GoBack: "back",
  BrowserBack: "back",
  XF86Back: "back",
  MediaPlayPause: "playpause",
  MediaPlay: "play",
  MediaPause: "pause",
  MediaStop: "stop",
  MediaFastForward: "ff",
  MediaRewind: "rw",
  ChannelUp: "chup",
  ChannelDown: "chdown",
  PageUp: "chup",
  PageDown: "chdown",
  Info: "info",
};

export function remoteAction(e: Pick<KeyboardEvent, "key" | "keyCode">): RemoteAction | null {
  return KEYNAMES[e.key] ?? KEYCODES[e.keyCode] ?? null;
}
