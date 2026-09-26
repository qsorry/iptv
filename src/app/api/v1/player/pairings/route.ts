import { NextResponse, type NextRequest } from "next/server";
import { startPairing } from "@/modules/player";
import { handleApiError } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/v1/player/pairings
 * التلفاز يطلب رمز ربط يعرضه مع QR: { data: { id, code, pollToken, expiresAt, pairUrl } }.
 * pollToken يبقى في التلفاز ويُرسل في Authorization عند الاستطلاع.
 */
export async function POST(request: NextRequest) {
  try {
    rateLimit(`player:pair:${clientIp(request)}`, 10, 60_000);
    return withCors(NextResponse.json({ data: await startPairing() }, { status: 201 }));
  } catch (error) {
    return withCors(handleApiError(error));
  }
}

export const OPTIONS = corsPreflight;
