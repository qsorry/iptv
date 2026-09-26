export {
  listProviderServers,
  createProviderServer,
  updateProviderServer,
  deleteProviderServer,
  detectServer,
  type DetectedServer,
} from "./application/servers";
export {
  createActivationCode,
  listActivationCodes,
  revokeActivationCode,
  redeemActivationCode,
  redeemCode,
  getPlayerSettings,
  InvalidActivationCodeError,
  type PlayerAccount,
  type Redemption,
} from "./application/codes";
export { getPlayerDashboard, platformDay, ACTIVITY_DAYS, PLATFORM_TZ, type PlayerDashboard, type DashboardProvider } from "./application/dashboard";
export { ACTIVITY_LABELS, type ActivityKind } from "./application/activity";
export { startPairing, findPendingPairing, completePairing, pollPairing, pairingUrl, PAIRING_TTL_MS, type PairingPoll } from "./application/pairings";
export {
  ACTIVATION_CODE_PATTERN,
  generateActivationCode,
  normalizeActivationCode,
  generatePairingCode,
  normalizePairingCode,
  normalizeServerUrl,
  parsePrefixes,
  toLatinDigits,
} from "./domain/codes";
export { readAppDownloads, DOWNLOADS_PATH, type AppDownloads, type DownloadFile } from "./infrastructure/downloads";
