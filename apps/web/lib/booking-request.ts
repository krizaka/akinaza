import { z } from "zod";

/**
 * The body of a client's booking. `dependantIds` is for the shops whose clients bring someone (a dog…); for the others it is
 * empty and the domain books the client themselves (`bookVisit`), so an empty list is valid here.
 */
export const bookingRequest = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  zoneId: z.string().uuid().nullable(),
  dependantIds: z.array(z.string().uuid()).max(50).default([]),
  startsAt: z.string().datetime(),
  staffId: z.string().uuid().nullish(),
});
