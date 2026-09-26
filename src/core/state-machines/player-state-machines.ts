import { createStateMachine } from "./state-machine";

export type ActivationCodeStatus = "active" | "revoked";

/** كود التفعيل: الإلغاء نهائي؛ لإعادة الحساب يُصدر كود جديد. */
export const activationCodeStateMachine = createStateMachine<ActivationCodeStatus>("كود التفعيل", {
  active: ["revoked"],
  revoked: [],
});

export type PairingStatus = "pending" | "completed" | "consumed" | "expired";

/** ربط التلفاز: ينتظر الجوال، ثم يستلمه التلفاز مرة واحدة. */
export const pairingStateMachine = createStateMachine<PairingStatus>("طلب الربط", {
  pending: ["completed", "expired"],
  completed: ["consumed", "expired"],
  consumed: [],
  expired: [],
});
