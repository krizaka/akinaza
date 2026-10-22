import type { Clock } from "@krizaka/api-keys";

/** The wall clock, given to the code that must not read it itself. Routes and pages pass this one. */
export const systemClock: Clock = { now: () => new Date() };
