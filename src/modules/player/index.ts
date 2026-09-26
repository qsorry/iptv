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
  getPlayerSettings,
  InvalidActivationCodeError,
  type PlayerAccount,
} from "./application/codes";
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
