import { z } from "zod";

/**
 * What the public pages may know about the visitor, answered by `GET /api/me` (a hint for the bar, never an authorisation:
 * the app and the API check the real session on every request). Signed out is a 200 with `signedIn: false`, not a 401 - a
 * public page asking who you are is not an error.
 */
export const meSchema = z.object({
  signedIn: z.boolean(),
  /** Whether sign-up is open (`AUTH_SIGNUP_ENABLED`): « Try Akinaza » is the primary action only then. */
  signupOpen: z.boolean(),
  account: z.object({ name: z.string().nullable(), email: z.string(), avatarSeed: z.string().nullable() }).optional(),
});
export type Me = z.infer<typeof meSchema>;
