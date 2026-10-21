import { z } from "zod";

/**
 * The words of a shop come from its business type, never from a guess (krizaka/akinaza#117). The model is
 * vertical-neutral (ADR-001: a shop sells time, takes bookings, and may report on a visit); what changes from one kind of
 * business to another is the vocabulary — « walk » and « dog » for a pet-care shop, « appointment » and « client » for a
 * studio, a consultant or a repairer — and whether a booking is made for a dependant (a dog) and ends with a report. Only
 * the flags are here; the words are messages (`console.vocabularies.<type>` in messages/{en,fr}.json).
 */
export const BUSINESS_TYPES = ["professional", "pets"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const businessTypeSchema = z.enum(BUSINESS_TYPES);

/** What a business type changes in the product beyond its words. */
export interface Vocabulary {
  /** A booking is made for something the client brings (a dog, a cat): the shop keeps its profile. Otherwise the client books for themselves. */
  dependants: boolean;
  /** A finished visit gets a note and a photo sent to the client (the walker's report). */
  visitReports: boolean;
}

export const VOCABULARY: Readonly<Record<BusinessType, Vocabulary>> = {
  professional: { dependants: false, visitReports: false },
  pets: { dependants: true, visitReports: true },
};

/** The vocabulary of a stored type; an unknown value reads as the neutral one. */
export function vocabularyOf(type: string): Vocabulary {
  return VOCABULARY[businessTypeSchema.safeParse(type).data ?? "professional"];
}
