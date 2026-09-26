import { pickNext, type Direction } from "./spatial";

/**
 * التنقل بالأسهم على DOM:
 * - النطاق: آخر عنصر [data-nav-scope] في الصفحة (نافذة منبثقة أو المشغّل)، وإلا الصفحة كلها.
 * - المناطق [data-nav-region]: العودة لمنطقة تعيد التركيز لآخر عنصر كان فيها (صفوف الملصقات، القائمة الجانبية).
 * - [data-autofocus]: أول ما يُركّز عليه عند فتح الشاشة.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const lastInRegion = new Map<string, HTMLElement>();

function activeScope(): ParentNode {
  const scopes = document.querySelectorAll<HTMLElement>("[data-nav-scope]");
  return scopes.length ? scopes[scopes.length - 1] : document.body;
}

function visible(el: HTMLElement): boolean {
  if (el.closest("[data-nav-skip]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

export function focusables(scope: ParentNode = activeScope()): HTMLElement[] {
  return Array.prototype.slice.call(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
}

function regionOf(el: Element | null): HTMLElement | null {
  return el ? (el.closest("[data-nav-region]") as HTMLElement | null) : null;
}

export function rememberFocus(el: HTMLElement) {
  const region = regionOf(el);
  if (region) lastInRegion.set(region.getAttribute("data-nav-region")!, el);
}

/** تمرير العنصر للمجال المرئي دون قفزات (scrollIntoViewIfNeeded متاح في Chromium القديم). */
export function reveal(el: HTMLElement) {
  const anyEl = el as HTMLElement & { scrollIntoViewIfNeeded?: (center?: boolean) => void };
  if (typeof anyEl.scrollIntoViewIfNeeded === "function") anyEl.scrollIntoViewIfNeeded(false);
  else el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function focusEl(el: HTMLElement) {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  reveal(el);
  rememberFocus(el);
}

/** يركّز على [data-autofocus] أو أول عنصر في النطاق. */
export function focusFirst(scope: ParentNode = activeScope()): boolean {
  const auto = scope.querySelector<HTMLElement>("[data-autofocus]");
  const target = auto && visible(auto) ? auto : focusables(scope)[0];
  if (!target) return false;
  focusEl(target);
  return true;
}

function inScope(el: Element | null, scope: ParentNode): el is HTMLElement {
  return !!el && el instanceof HTMLElement && el !== document.body && (scope === document.body || (scope as HTMLElement).contains(el));
}

/** ينقل التركيز في الاتجاه. يعيد false إن لم يوجد ما ينتقل إليه. */
export function moveFocus(dir: Direction): boolean {
  const scope = activeScope();
  const current = document.activeElement;
  if (!inScope(current, scope) || !visible(current)) return focusFirst(scope);

  const items = focusables(scope).filter((el) => el !== current);
  const from = current.getBoundingClientRect();
  const idx = pickNext(from, items.map((el) => el.getBoundingClientRect()), dir);
  if (idx < 0) return false;

  let target = items[idx];
  const fromRegion = regionOf(current);
  const toRegion = regionOf(target);
  if (toRegion && toRegion !== fromRegion) {
    const remembered = lastInRegion.get(toRegion.getAttribute("data-nav-region")!);
    // contains لا isConnected (غير موجودة في Chromium 53).
    if (remembered && document.body.contains(remembered) && toRegion.contains(remembered) && visible(remembered)) target = remembered;
  }
  focusEl(target);
  return true;
}

/** حقول النص: السهمان الأفقيان لتحريك المؤشر داخل النص لا للتنقل. */
export function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "submit", "range"].includes(type);
}
