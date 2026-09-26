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

/**
 * عرض تدريجي للقوائم الطويلة (آلاف القنوات والأفلام): دفعة أولى ثم دفعات كلما ظهر العنصر الحارس.
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
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(list.length, c + pageSize));
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [count, list.length, pageSize]);
  return { items: list.slice(0, count), sentinel, hasMore: count < list.length };
}
