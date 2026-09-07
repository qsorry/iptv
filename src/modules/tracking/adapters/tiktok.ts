import { EVENT_MAP } from "../domain/events";
import type { UnifiedEvent } from "../domain/events";
import { round2, type AdapterRequest, type TrackingAdapter } from "./types";

/** TikTok Events API v1.3. الشراء اسمه CompletePayment لا Purchase. */
export const tiktokAdapter: TrackingAdapter = {
  platform: "tiktok",
  build(event: UnifiedEvent, config, secrets): AdapterRequest | null {
    const name = EVENT_MAP[event.eventName].tiktok;
    const pixelCode = config.pixelCode;
    const token = secrets.accessToken;
    if (!name || !pixelCode || !token) return null;

    const user: Record<string, unknown> = {};
    if (event.user.emailSha256) user.email = event.user.emailSha256;
    if (event.user.phoneSha256) user.phone = event.user.phoneSha256;
    if (event.user.externalId) user.external_id = event.user.externalId;
    if (event.user.clientIp) user.ip = event.user.clientIp;
    if (event.user.userAgent) user.user_agent = event.user.userAgent;
    if (event.user.clickIds?.ttclid) user.ttclid = event.user.clickIds.ttclid;

    const properties: Record<string, unknown> = {};
    if (event.data.currency) properties.currency = event.data.currency;
    if (event.data.value !== undefined) properties.value = round2(event.data.value);
    if (event.data.orderId) properties.order_id = event.data.orderId;
    if (event.data.searchTerm) properties.query = event.data.searchTerm;
    if (event.data.items?.length) {
      properties.contents = event.data.items.map((i) => ({
        content_id: i.id,
        content_name: i.name,
        quantity: i.qty,
        price: round2(i.price),
      }));
      properties.content_type = "product";
    }

    return {
      url: "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      headers: { "Access-Token": token },
      body: {
        event_source: "web",
        event_source_id: pixelCode,
        data: [
          {
            event: name,
            event_time: event.eventTime,
            event_id: event.eventId,
            user,
            page: event.eventSourceUrl ? { url: event.eventSourceUrl } : undefined,
            properties,
          },
        ],
      },
    };
  },
};
