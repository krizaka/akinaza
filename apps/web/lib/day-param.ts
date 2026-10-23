import { z } from "zod";

/** A local day as the apps write it in a URL: `2026-10-20`, and a real calendar day. */
export const dayParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "not a day");

export const calendarQuery = z.object({ from: dayParam, to: dayParam });

/** The query string of a request as an object, for a schema. */
export const queryOf = (req: Request): Record<string, string> => Object.fromEntries(new URL(req.url).searchParams);
