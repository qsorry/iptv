import { InvalidStateTransitionError } from "@/core/errors";

export type Transitions<S extends string> = Record<S, readonly S[]>;

export function createStateMachine<S extends string>(entity: string, transitions: Transitions<S>) {
  return {
    canTransition: (from: S, to: S) => transitions[from].includes(to),
    assertTransition(from: S, to: S) {
      if (!transitions[from].includes(to)) throw new InvalidStateTransitionError(entity, from, to);
    },
    nextStates: (from: S) => transitions[from],
  };
}
