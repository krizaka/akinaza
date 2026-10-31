import { createHmac } from "node:crypto";

import { type Db,dbCodeStore } from "@akinaza/db";
import { createEmailVerification, VERIFY_FAILURE, type VerifyResult } from "@krizaka/email-verification";
import { z } from "zod";

/**
 * A visitor books without an account (krizaka-internal#1909). Step one holds the request and mails a 6-digit code to the address
 * (`@krizaka/email-verification`: 15 minutes, 5 tries, single use, a salted hash in `booking_codes`); step two, the code back, opens the
 * client file of that shop, books, and signs the visitor in. This file is the shape of both bodies and the verification bound to the database.
 */
export const guestStart = z.object({
  serviceId: z.string().uuid(),
  zoneId: z.string().uuid().nullable(),
  staffId: z.string().uuid().nullish(),
  startsAt: z.string().datetime(),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().min(7).max(40),
  language: z.enum(["fr", "en"]).default("fr"),
  /** The name of the dog (or other dependant) for a shop that books for one. */
  dependantName: z.string().trim().min(1).max(80).optional(),
  /** The one consent without which there is no file: the booking itself. Never pre-ticked. */
  consentService: z.literal(true),
  consentReminders: z.boolean().default(false),
  captchaToken: z.string().max(2048).optional(),
});
export type GuestStart = z.infer<typeof guestStart>;

export const guestConfirm = z.object({
  challengeId: z.string().min(8).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  code: z.string().trim().regex(/^\d{6}$/),
});

/** What is held until the address answers: the request without the CAPTCHA token, and the shop it was made at. */
export type GuestHold = Omit<GuestStart, "captchaToken"> & { shopSlug: string };

/** The verification of an address for the booking pages, over the database store (any instance confirms what another issued). The salt is derived from `secret` (the app's session secret, passed by the route). */
export function guestVerification(db: Db, now: () => Date, secret: string) {
  const salt = createHmac("sha256", secret).update("guest-booking-verification").digest("hex");
  return createEmailVerification({ store: dbCodeStore(db), secret: salt, now });
}

/** Why a code was refused, as the API says it (the page translates the code). */
export function codeRefusal(result: Extract<VerifyResult<unknown>, { ok: false }>): { status: number; code: string; attemptsLeft?: number } {
  if (result.reason === VERIFY_FAILURE.invalid) return { status: 400, code: "CODE_INVALID", ...(result.attemptsLeft === undefined ? {} : { attemptsLeft: result.attemptsLeft }) };
  if (result.reason === VERIFY_FAILURE.locked) return { status: 429, code: "CODE_LOCKED" };
  return { status: 410, code: "CODE_EXPIRED" };
}
