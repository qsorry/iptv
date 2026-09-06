/** مفاتيح الميزات المعروفة في المنصة. */
export const FEATURES = {
  notifyEmail: "notify.email",
  notifyWhatsapp: "notify.whatsapp",
  notifySms: "notify.sms",
  sallaImport: "salla.import",
  customDomain: "domain.custom",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

/** الميزات المجانية المتاحة لكل المتاجر بلا اشتراك. */
export const FREE_FEATURES: Feature[] = [FEATURES.notifyEmail];
