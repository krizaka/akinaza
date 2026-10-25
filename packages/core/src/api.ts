import { z } from "zod";

import { DEPENDANT_KINDS } from "./service-shop";

/**
 * What the owner's API answers and the apps read (iPhone, Android, Mac), validated on both sides. Structure only: the words
 * are messages. The server builds these answers from `@akinaza/db`; an app parses them at the edge and trusts the types.
 */
export const VISIT_STATUSES = ["booked", "done", "cancelled", "noShow"] as const;

const dependant = z.object({ name: z.string(), kind: z.enum(DEPENDANT_KINDS), profile: z.unknown() });

export const dayBooking = z.object({
  bookingId: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  clientPhone: z.string().nullable(),
  dependant,
  hasAccessNotes: z.boolean(),
  report: z.object({ id: z.string(), note: z.string(), hasPhoto: z.boolean(), durationMinutes: z.number(), sentAt: z.string().nullable() }).nullable(),
});
export type DayBooking = z.infer<typeof dayBooking>;

export const dayVisit = z.object({
  appointmentId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(VISIT_STATUSES),
  service: z.object({ fr: z.string(), en: z.string(), capacity: z.number() }),
  zone: z.string().nullable(),
  checkedInAt: z.string().nullable(),
  checkedOutAt: z.string().nullable(),
  bookings: z.array(dayBooking),
});
export type DayVisit = z.infer<typeof dayVisit>;

/** The shop the day belongs to and its time zone (D8): an app opens on that shop's own address, as the web, and draws its clock. */
export const dayAnswer = z.object({ shopId: z.string(), timezone: z.string(), day: z.string(), visits: z.array(dayVisit) });
export const calendarDay = z.object({ day: z.string(), visits: z.number(), bookings: z.number() });
export const calendarAnswer = z.object({ days: z.array(calendarDay) });

export const shopClient = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  hasNotes: z.boolean(),
  dependants: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(DEPENDANT_KINDS), profile: z.unknown() })),
});
export type ShopClient = z.infer<typeof shopClient>;
export const clientsAnswer = z.object({ clients: z.array(shopClient) });

export const invoiceSummary = z.object({
  id: z.string(),
  number: z.string().or(z.number()),
  issuedOn: z.string(),
  dueOn: z.string().nullable(),
  language: z.enum(["fr", "en"]),
  creditOf: z.string().nullable(),
  subtotalCents: z.number(),
  gstCents: z.number(),
  qstCents: z.number(),
  totalCents: z.number(),
  client: z.string().nullable(),
});
export type InvoiceSummary = z.infer<typeof invoiceSummary>;
export const invoicesAnswer = z.object({ invoices: z.array(invoiceSummary) });

export const shopAnswer = z.object({
  shop: z.object({ id: z.string(), name: z.string(), registrant: z.boolean(), timezone: z.string(), paymentTermsDays: z.number() }),
  services: z.array(z.object({ id: z.string(), nameFr: z.string(), nameEn: z.string(), priceCents: z.number(), taxCategory: z.enum(["standard", "zeroRated", "exempt"]) })),
});
export type ShopAnswer = z.infer<typeof shopAnswer>;

/**
 * « Livres » for the apps (`GET /api/walker/books?period=`, D8): the period's combined GST/QST return as the web prepares it — what
 * each net comes to and whether it is to remit or to claim. Prepared only: the merchant files it, never Akinaza.
 */
const netAnswer = z.object({ netCents: z.number().int().nonnegative(), outcome: z.enum(["remit", "claim", "zero"]) });
export const booksAnswer = z.object({
  period: z.object({ id: z.string(), start: z.string(), end: z.string() }),
  /** The periods to choose from, the latest completed quarter first. */
  choices: z.array(z.string()),
  gst: netAnswer,
  qst: netAnswer,
  preparedOnly: z.literal(true),
});
export type BooksAnswer = z.infer<typeof booksAnswer>;

export const issuedInvoice = z.object({ id: z.string(), number: z.string().or(z.number()), subtotalCents: z.number(), gstCents: z.number(), qstCents: z.number(), totalCents: z.number() });

/**
 * Who is looking (`GET /api/me`): the public pages' bar and the apps' header read it. A hint only, never an authorisation:
 * every page and route checks the real session. Signed out is a 200 with `signedIn: false`, not a 401.
 */
export const meAnswer = z.object({
  signedIn: z.boolean(),
  /** Whether sign-up is open (`AUTH_SIGNUP_ENABLED`): « Try Akinaza » is the primary action only then. */
  signupOpen: z.boolean(),
  /** `id` draws the same default picture as the app's header when no tone was chosen. */
  account: z.object({ id: z.string().optional(), name: z.string().nullable(), email: z.string(), avatarSeed: z.string().nullable() }).optional(),
});
export type MeAnswer = z.infer<typeof meAnswer>;
