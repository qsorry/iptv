import { EVENT_MAP } from "../domain/events";
import type { UnifiedEvent } from "../domain/events";
import { round2, type AdapterRequest, type TrackingAdapter } from "./types";

/** Meta Conversions API. نفس event_id المرسل من البكسل ← المنصة تدمج النسختين. */
export const metaAdapter: TrackingAdapter = {
  platform: "meta",
  build(event: UnifiedEvent, config, secrets): AdapterRequest | null {
    const name = EVENT_MAP[event.eventName].meta;
    const pixelId = config.pixelId;
    const token = secrets.accessToken;
    if (!name || !pixelId || !token) return null;

    const user: Record<string, unknown> = {};
    if (event.user.emailSha256) user.em = [event.user.emailSha256];
    if (event.user.phoneSha256) user.ph = [event.user.phoneSha256];
    if (event.user.externalId) user.external_id = [event.user.externalId];
    if (event.user.clientIp) user.client_ip_address = event.user.clientIp;
    if (event.user.userAgent) user.client_user_agent = event.user.userAgent;
    if (event.user.clickIds?.fbc) user.fbc = event.user.clickIds.fbc;
    if (event.user.clickIds?.fbp) user.fbp = event.user.clickIds.fbp;

    const custom: Record<string, unknown> = {};
    if (event.data.currency) custom.currency = event.data.currency;
    if (event.data.value !== undefined) custom.value = round2(event.data.value);
    if (event.data.orderId) custom.order_id = event.data.orderId;
    if (event.data.searchTerm) custom.search_string = event.data.searchTerm;
    if (event.data.items?.length) {
      custom.contents = event.data.items.map((i) => ({ id: i.id, quantity: i.qty, item_price: round2(i.price) }));
      custom.content_ids = event.data.items.map((i) => i.id);
      custom.content_type = "product";
    }

    return {
      url: `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
      body: {
        data: [
          {
            event_name: name,
            event_time: event.eventTime,
            event_id: event.eventId,
            event_source_url: event.eventSourceUrl ?? undefined,
            action_source: "website",
            user_data: user,
            custom_data: custom,
          },
        ],
      },
    };
  },
};
