import { NextResponse, type NextRequest } from "next/server";
import { pollPairing } from "@/modules/player";
import { handleApiError } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/player/pairings/:id  (Authorization: Bearer <pollToken>)
 * { data: { status: "pending" | "expired" | "consumed" } } أو { data: { status: "completed", account } } مرة واحدة.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(`player:poll:${clientIp(request)}`, 90, 60_000);
    const { id } = await params;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    return withCors(NextResponse.json({ data: await pollPairing(id, token) }));
  } catch (error) {
    return withCors(handleApiError(error));
  }
}

export const OPTIONS = corsPreflight;
