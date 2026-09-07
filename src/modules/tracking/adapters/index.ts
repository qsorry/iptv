import { ga4Adapter } from "./ga4";
import { metaAdapter } from "./meta";
import { tiktokAdapter } from "./tiktok";
import { snapchatAdapter } from "./snapchat";
import type { TrackingAdapter } from "./types";

/** سجل الـ adapters. إضافة بنترست أو لينكدإن = ملف واحد وسطر هنا. */
export const ADAPTERS: TrackingAdapter[] = [ga4Adapter, metaAdapter, tiktokAdapter, snapchatAdapter];

export { ga4Adapter, metaAdapter, tiktokAdapter, snapchatAdapter };
export type { TrackingAdapter, AdapterRequest, AdapterResult } from "./types";
