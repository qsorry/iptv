import { createStateMachine } from "./state-machine";

export type PaymentStatus = "unpaid" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";

export const paymentStateMachine = createStateMachine<PaymentStatus>("الدفع", {
  unpaid: ["authorized", "paid", "failed"],
  authorized: ["paid", "failed"],
  paid: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  failed: ["paid", "authorized"],
});
