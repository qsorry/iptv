import { useEffect, useRef } from "react";
import { remoteAction, type RemoteAction } from "../platform";
import { isTextInput, moveFocus, rememberFocus } from "./focus";

/**
 * مكدّس معالجات الريموت: الأحدث (المشغّل، نافذة منبثقة) يأخذ الزر أولاً، ويعيد true إن استهلكه.
 * ما لم يُستهلك: الأسهم للتنقل، والرجوع لآخر معالج «back» مسجّل (الموجّه).
 */
type Handler = (action: RemoteAction, e: KeyboardEvent) => boolean;

const handlers: Handler[] = [];

export function pushHandler(h: Handler) {
  handlers.push(h);
  return () => {
    const i = handlers.lastIndexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** يسجّل معالجاً طوال عمر المكوّن (يُقرأ أحدث fn دائماً). */
export function useRemote(fn: Handler, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    return pushHandler((a, e) => ref.current(a, e));
  }, [enabled]);
}

const ARROWS: RemoteAction[] = ["up", "down", "left", "right"];

export function installRemote(onUnhandledBack: () => void) {
  const onKey = (e: KeyboardEvent) => {
    const action = remoteAction(e);
    document.documentElement.classList.add("using-keys");
    if (!action) return;

    const inText = isTextInput(document.activeElement);
    // Backspace/Escape داخل حقل نص للحذف أو لإغلاق لوحة المفاتيح، لا للرجوع.
    if (action === "back" && inText && e.key !== "Escape" && e.keyCode !== 10009 && e.keyCode !== 461) return;
    if (inText && (action === "left" || action === "right")) return;

    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i](action, e)) {
        e.preventDefault();
        return;
      }
    }

    if (ARROWS.includes(action)) {
      e.preventDefault();
      moveFocus(action as "up" | "down" | "left" | "right");
      return;
    }
    if (action === "back") {
      e.preventDefault();
      onUnhandledBack();
    }
  };

  const onPointer = () => document.documentElement.classList.remove("using-keys");
  const onFocusIn = (e: FocusEvent) => {
    if (e.target instanceof HTMLElement) rememberFocus(e.target);
  };
  // غلاف Android يرسل زر الرجوع كحدث مخصص.
  const onNativeBack = () => {
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i]("back", new KeyboardEvent("keydown"))) return;
    }
    onUnhandledBack();
  };

  document.addEventListener("keydown", onKey);
  document.addEventListener("mousedown", onPointer);
  document.addEventListener("touchstart", onPointer, { passive: true });
  document.addEventListener("focusin", onFocusIn);
  window.addEventListener("ssouq:back", onNativeBack);
  return () => {
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("mousedown", onPointer);
    document.removeEventListener("touchstart", onPointer);
    document.removeEventListener("focusin", onFocusIn);
    window.removeEventListener("ssouq:back", onNativeBack);
  };
}
