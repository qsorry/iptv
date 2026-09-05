import { createStateMachine } from "./state-machine";

export type OrderStatus = "pending" | "confirmed" | "processing" | "completed" | "cancelled";

export const orderStateMachine = createStateMachine<OrderStatus>("الطلب", {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
});
