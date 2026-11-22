// <app> — time, injected.
//
// A layer that must be testable never reads the clock directly: it takes a
// `Clock`, and the composition root wires the system clock. All points in
// time are epoch milliseconds, UTC.

export interface Clock {
  /** The current time, epoch milliseconds, UTC. */
  now(): number;
}

/** The real clock, used by the composition root only. */
export const systemClock: Clock = { now: () => Date.now() };
