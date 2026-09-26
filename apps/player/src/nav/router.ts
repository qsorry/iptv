import { useEffect, useState } from "react";

/**
 * موجّه بالـ hash (يعمل من file:// على التلفزيونات). كل انتقال يحمل رقماً متزايداً في history.state
 * لنعرف إن كان الرجوع ممكناً أم أننا في أول شاشة (فيسأل التطبيق عن الخروج).
 */

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = hash.split("?");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return { path: clean, parts: clean.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs) };
}

const listeners = new Set<() => void>();
let current = parse();
/** رقم آخر إدخال معروف؛ روابط <a href="#…"> تضيف إدخالاً بلا رقم فنعطيه التالي. */
let lastIdx = 0;

function index(): number {
  const s = window.history.state as { idx?: number } | null;
  return typeof s?.idx === "number" ? s.idx : -1;
}

function onLocationChange() {
  if (index() < 0) window.history.replaceState({ idx: lastIdx + 1 }, "", window.location.href);
  lastIdx = index();
  current = parse();
  listeners.forEach((fn) => fn());
}

export function initRouter() {
  if (index() < 0) window.history.replaceState({ idx: 0 }, "", window.location.href);
  lastIdx = index();
  window.addEventListener("popstate", onLocationChange);
  window.addEventListener("hashchange", onLocationChange);
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const url = `#${to}`;
  if (opts.replace) window.history.replaceState({ idx: Math.max(0, index()) }, "", url);
  else window.history.pushState({ idx: Math.max(0, index()) + 1 }, "", url);
  onLocationChange();
}

export function canGoBack(): boolean {
  return index() > 0;
}

export function goBack(fallback = "/") {
  if (canGoBack()) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const fn = () => setRoute(current);
    listeners.add(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return route;
}

/** رابط داخلي لخاصية href: <a href={href("/movies")}>. */
export function href(to: string) {
  return `#${to}`;
}
