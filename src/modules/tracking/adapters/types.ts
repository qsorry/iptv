import type { UnifiedEvent } from "../domain/events";
import type { Platform } from "../domain/platforms";

export interface AdapterRequest {
  url: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface AdapterResult {
  status: "sent" | "failed" | "skipped";
  statusCode?: number;
  error?: string;
}

/**
 * منصة جديدة = ملف واحد هنا يحقّق هذه الواجهة + سطر في domain/platforms.ts.
 * build نقي (قابل للاختبار بلا شبكة)؛ الإرسال في queue.ts.
 */
export interface TrackingAdapter {
  platform: Platform;
  /** null = لا مقابل للحدث على هذه المنصة أو الإعداد ناقص ← يُتخطّى. */
  build(event: UnifiedEvent, config: Record<string, string>, secrets: Record<string, string>): AdapterRequest | null;
}

/** المنصات تتوقع القيمة بوحدة العملة الكبرى بمنزلتين. */
export const round2 = (n: number | undefined): number => Math.round((n ?? 0) * 100) / 100;
