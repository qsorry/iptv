import type { NextRequest } from "next/server";
import { AppError } from "@/core/errors";

export class RateLimitedError extends AppError {
  constructor() {
    super("محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى", "RATE_LIMITED", 429);
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * نافذة ثابتة في الذاكرة لكل مفتاح. يكفي لنسخة واحدة على Coolify؛ مع عدة نسخ يصبح الحد لكل نسخة.
 * الهدف إبطاء تخمين الأكواد، لا الحماية من هجوم موزّع.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) throw new RateLimitedError();
}

/** عنوان العميل خلف Traefik (Coolify)؛ أول قيمة في x-forwarded-for. */
export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
