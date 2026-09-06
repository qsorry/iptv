/** وضع العرض الذي يختاره الزائر في واجهة المتجر. يُحفظ في localStorage وكوكي بنفس المفتاح. */
export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODE_KEY = "sf-theme";
export const THEME_ROOT_ID = "sf-root";

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * سكربت يُنفَّذ قبل الرسم لتطبيق الوضع المحفوظ فوراً (بلا وميض).
 * يقرأ localStorage ثم الكوكي، ويضع data-theme على <html> وعلى جذر المتجر.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_MODE_KEY}";var m=null;try{m=localStorage.getItem(k)}catch(e){}if(m!=="light"&&m!=="dark"&&m!=="system"){var c=document.cookie.match(/(?:^|; )${THEME_MODE_KEY}=(light|dark|system)/);m=c?c[1]:null}var h=document.documentElement,r=document.getElementById("${THEME_ROOT_ID}");if(m==="light"||m==="dark"){h.setAttribute("data-theme",m);if(r)r.setAttribute("data-theme",m)}else{h.removeAttribute("data-theme");if(r)r.removeAttribute("data-theme")}}catch(e){}})();`;
