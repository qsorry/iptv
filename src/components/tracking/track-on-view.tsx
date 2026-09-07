"use client";

import { useEffect, useRef } from "react";

/**
 * يطلق حدثاً واحداً عند ظهور الصفحة. يُستخدم لـ view_item و begin_checkout و purchase.
 * purchase يُمرَّر له eventId من الخادم (مشتق من رقم الطلب) مع serverSide=false،
 * لأن النسخة السيرفرية أُرسلت من outbox — نفس event_id يجعل المنصة تدمج النسختين.
 */
export function TrackOnView({
  event,
  data,
  eventId,
  serverSide = true,
}: {
  event: string;
  data?: Record<string, unknown>;
  eventId?: string;
  serverSide?: boolean;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const fire = () => window.sqTrack?.(event, data, { eventId, serverSide });
    if (window.sqTrack) fire();
    else {
      // sqTrack يُعرَّف في نفس دورة التركيب؛ محاولة تالية تكفي.
      const t = setTimeout(fire, 300);
      return () => clearTimeout(t);
    }
  }, [event, data, eventId, serverSide]);
  return null;
}
