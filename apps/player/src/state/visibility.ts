import { useEffect, useRef, useState } from "react";

/** هل العنصر ظاهر (أو قريب من الظهور)؟ بلا IntersectionObserver يُعدّ ظاهراً. */
export function useVisible<T extends Element>(margin = "200px") {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || visible || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, margin]);
  return [ref, visible] as const;
}

/** أقرب حاوية تمرير (overflow auto/scroll) حول العنصر، أو null إن كانت الصفحة نفسها. */
export function scrollParent(el: Element): Element | null {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const oy = window.getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * عرض تدريجي للقوائم الطويلة (آلاف القنوات والأفلام): دفعة أولى ثم دفعات كلما اقترب العنصر الحارس.
 * المراقبة نسبةً لحاوية التمرير الفعلية (القائمة الجانبية، المكتبة، لوحة القنوات): rootMargin لا يوسّع
 * قصّ الحاويات الوسيطة، فمراقبة الصفحة كلها لا ترى الحارس داخلها عند التنقل بالريموت.
 * يعود للدفعة الأولى عند تغيّر القائمة.
 */
export function useIncremental<T>(list: T[], pageSize = 60) {
  const [count, setCount] = useState(pageSize);
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => setCount(pageSize), [list, pageSize]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= list.length) return;
    if (typeof IntersectionObserver === "undefined") {
      setCount(list.length);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(list.length, c + pageSize));
      },
      { root: scrollParent(el), rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, list.length, pageSize]);
  return { items: list.slice(0, count), sentinel, hasMore: count < list.length };
}
