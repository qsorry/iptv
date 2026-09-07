import { EVENT_MAP } from "../domain/events";
import type { UnifiedEvent } from "../domain/events";
import { round2, type AdapterRequest, type TrackingAdapter } from "./types";

/** GA4 Measurement Protocol. سيرفري بالكامل — لا GTM ولا gtag في الصفحة. */
export const ga4Adapter: TrackingAdapter = {
  platform: "ga4",
  build(event: UnifiedEvent, config, secrets): AdapterRequest | null {
    const name = EVENT_MAP[event.eventName].ga4;
    const measurementId = config.measurementId;
    const apiSecret = secrets.apiSecret;
    if (!name || !measurementId || !apiSecret) return null;

    const params: Record<string, unknown> = {
      engagement_time_msec: 1,
      session_id: event.user.externalId ?? event.eventId,
      page_location: event.eventSourceUrl ?? undefined,
    };
    if (event.data.currency) params.currency = event.data.currency;
    if (event.data.value !== undefined) params.value = round2(event.data.value);
    if (event.data.orderId) params.transaction_id = event.data.orderId;
    if (event.data.searchTerm) params.search_term = event.data.searchTerm;
    if (event.data.items?.length) {
      params.items = event.data.items.map((i) => ({ item_id: i.id, item_name: i.name, quantity: i.qty, price: round2(i.price) }));
    }

    return {
      url: `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      body: {
        // client_id ثابت للزائر يجعل الجلسات متصلة؛ event_id يمنع ازدواج النسخة السيرفرية.
        client_id: event.user.externalId ?? event.eventId,
        timestamp_micros: event.eventTime * 1_000_000,
        non_personalized_ads: !event.consent.marketing,
        events: [{ name, params: { ...params, event_id: event.eventId } }],
      },
    };
  },
};
