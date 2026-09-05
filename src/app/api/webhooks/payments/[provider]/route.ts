import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/infrastructure/database/client";
import { webhookEvents } from "@/infrastructure/database/schema";

/**
 * Webhook Received → Verify Signature → Store Event (idempotent) → Process → Emit
 * التحقق من التوقيع خاص بكل مزود ويُضاف في infrastructure/integrations/<provider>.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const eventId = String(payload.id ?? payload.event_id ?? "");
  const eventType = String(payload.type ?? payload.event ?? "unknown");
  if (!eventId) return NextResponse.json({ error: "missing event id" }, { status: 400 });

  // unique(provider, event_id): التكرار يُتجاهل بصمت.
  const inserted = await db
    .insert(webhookEvents)
    .values({ provider, eventId, eventType, payload })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });

  return NextResponse.json({ received: true, duplicate: inserted.length === 0 });
}
