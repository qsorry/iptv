import { createStateMachine } from "./state-machine";

export type FulfillmentStatus = "unfulfilled" | "partially_fulfilled" | "fulfilled";

export const fulfillmentStateMachine = createStateMachine<FulfillmentStatus>("التنفيذ", {
  unfulfilled: ["partially_fulfilled", "fulfilled"],
  partially_fulfilled: ["fulfilled"],
  fulfilled: [],
});
