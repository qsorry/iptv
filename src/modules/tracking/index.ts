export { trackEvent, type TrackEventInput, type TrackEventResult } from "./application/engine";
export { processTrackingQueue, trackingHealth } from "./application/queue";
export { listFailedEvents, retryTrackingEvent, type FailedEventView } from "./application/failures";
export {
  listIntegrations,
  publicIntegrations,
  runtimeIntegrations,
  saveIntegration,
  type IntegrationView,
  type SaveIntegrationInput,
} from "./application/settings";
export {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  DENIED,
  allowsAnything,
  allowsPlatform,
  consentModeState,
  consentOrDenied,
  parseConsent,
  serializeConsent,
} from "./application/consent";
export { recordConsent } from "./application/consent-record";
export { EVENT_MAP, UNIFIED_EVENTS, isUnifiedEvent, type UnifiedEvent, type UnifiedEventName, type EventConsent, type EventItem } from "./domain/events";
export { deterministicEventId, hashEmail, hashPhone, newEventId, sha256 } from "./domain/hash";
export { PLATFORMS, PLATFORM_DEFS, SERVER_PLATFORMS, isPlatform, type Platform, type PlatformDef } from "./domain/platforms";
export { ADAPTERS } from "./adapters";
export { encryptSecret, decryptSecret, maskSecret } from "./infrastructure/crypto";
