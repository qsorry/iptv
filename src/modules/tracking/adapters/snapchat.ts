import { EVENT_MAP } from "../domain/events";
import type { UnifiedEvent } from "../domain/events";
import { round2, type AdapterRequest, type TrackingAdapter } from "./types";

/** Snapchat Conversions API. أسماء الأحداث بحروف كبيرة (PURCHASE, ADD_CART...). */
export const snapchatAdapter: TrackingAdapter = {
  platform: "snapchat",
  build(event: UnifiedEvent, config, secrets): AdapterRequest | null {
    const name = EVENT_MAP[event.eventName].snapchat;
    const pixelId = config.pixelId;
    const token = secrets.accessToken;
    if (!name || !pixelId || !token) return null;

    const user: Record<string, unknown> = {};
    if (event.user.emailSha256) user.em = [event.user.emailSha256];
    if (event.user.phoneSha256) user.ph = [event.user.phoneSha256];
    if (event.user.externalId) user.external_id = [event.user.externalId];
    if (event.user.clientIp) user.client_ip_address = event.user.clientIp;
    if (event.user.userAgent) user.client_user_agent = event.user.userAgent;
    if (event.user.clickIds?.sccid) user.sc_click_id = event.user.clickIds.sccid;

    const custom: Record<string, unknown> = {};
    if (event.data.currency) custom.currency = event.data.currency;
    if (event.data.value !== undefined) custom.value = round2(event.data.value);
    if (event.data.orderId) custom.order_id = event.data.orderId;
    if (event.data.searchTerm) custom.search_string = event.data.searchTerm;
    if (event.data.items?.length) {
      custom.content_ids = event.data.items.map((i) => i.id);
      custom.num_items = event.data.items.reduce((n, i) => n + i.qty, 0);
      custom.content_type = "product";
    }

    return {
      url: `https://tr.snapchat.com/v3/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
      body: {
        data: [
          {
            event_name: name,
            event_time: event.eventTime * 1000,
            event_id: event.eventId,
            event_source_url: event.eventSourceUrl ?? undefined,
            action_source: "WEB",
            user_data: user,
            custom_data: custom,
          },
        ],
      },
    };
  },
};
