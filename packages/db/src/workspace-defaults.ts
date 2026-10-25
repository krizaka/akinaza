import { INVOICE_STATE } from "@akinaza/core";
import type { KindConfig, Label, Marker, StatusSet, TagPreset } from "@krizaka/organize/contract";

/**
 * The administrator's defaults for « the workspace, organised » (krizaka-ts ADR-003, akinaza#337), as DATA: a code constant only SEEDS
 * the database the first time (`config.seed`, never overwriting); afterwards the administrator edits it (`config.put`, versioned, audited).
 *
 *  - Tags are the shop's. The owner and the manager write them, staff only read (they do not reach Clients or Invoices at all);
 *    a client never sees them.
 *  - The default tag set depends on the trade (`ShopType`) and on the language of the owner: variant `salon` is French,
 *    `salon_en` English, `default` and `default_en` the fallback of a trade without a set.
 *  - An invoice's state is DERIVED from the ledger (`invoiceState`): same chip, order and filter as an editable set, no move.
 */
export const TAG_WRITERS = ["owner", "manager"] as const;

const tag = (name: string, marker: Marker): TagPreset => ({ name, marker });
const label = (fr: string, en: string): Label => ({ fr, en });

/** Presets by trade: [French name, English name, marker]. Demo trades only: never a restaurant, a bar or a café. */
const CLIENT_PRESETS: Record<string, readonly (readonly [string, string, Marker])[]> = {
  default: [["Fidèle", "Regular", "green"], ["Nouveau", "New", "blue"], ["À rappeler", "To call back", "amber"], ["Entreprise", "Business", "violet"], ["Référé", "Referred", "gray"]],
  salon: [["Fidèle", "Regular", "green"], ["Coloration", "Colour", "violet"], ["Nouveau", "New", "blue"], ["À rappeler", "To call back", "amber"], ["Événement", "Event", "red"]],
  coaching: [["Programme en cours", "Programme running", "green"], ["En pause", "On pause", "gray"], ["Entreprise", "Business", "violet"], ["À rappeler", "To call back", "amber"], ["Référé", "Referred", "blue"]],
  workshop: [["Soumission envoyée", "Quote sent", "amber"], ["Récurrent", "Recurring", "green"], ["Entreprise", "Business", "violet"], ["Urgent", "Urgent", "red"], ["Référé", "Referred", "blue"]],
  cleaning: [["Résidentiel", "Residential", "blue"], ["Commercial", "Commercial", "violet"], ["Hebdomadaire", "Weekly", "green"], ["Clés remises", "Keys handed over", "amber"], ["À rappeler", "To call back", "gray"]],
  pets: [["Chien", "Dog", "amber"], ["Chat", "Cat", "violet"], ["Fidèle", "Regular", "green"], ["Première visite", "First visit", "blue"], ["À rappeler", "To call back", "gray"]],
  consulting: [["Mandat en cours", "Engagement running", "green"], ["Entreprise", "Business", "violet"], ["Référé", "Referred", "blue"], ["À rappeler", "To call back", "amber"], ["Inactif", "Inactive", "gray"]],
};

/** What an invoice may be tagged with, whatever the trade. */
const INVOICE_PRESETS: readonly (readonly [string, string, Marker])[] = [["À relancer", "To chase", "amber"], ["Remis au comptable", "With the accountant", "blue"], ["Récurrent", "Recurring", "violet"], ["Litige", "Disputed", "red"], ["Entente de paiement", "Payment plan", "green"]];

/** The variants of a set: `<trade>` in French, `<trade>_en` in English. */
export const presetVariant = (trade: string, locale: "fr" | "en", has: (variant: string) => boolean): string => {
  const wanted = locale === "en" ? `${trade}_en` : trade;
  if (has(wanted)) return wanted;
  return locale === "en" ? "default_en" : "default";
};

function presetsOf(source: Record<string, readonly (readonly [string, string, Marker])[]>): Record<string, TagPreset[]> {
  const out: Record<string, TagPreset[]> = {};
  for (const [trade, rows] of Object.entries(source)) {
    out[trade] = rows.map(([fr, , marker]) => tag(fr, marker));
    out[`${trade}_en`] = rows.map(([, en, marker]) => tag(en, marker));
  }
  return out;
}

/** The states of an invoice, in the order of the column: what to collect first, what is settled last. */
export const INVOICE_STATUS_SET: StatusSet = {
  key: "invoice_state",
  label: label("État de la facture", "Invoice state"),
  mode: "derived",
  states: [
    { key: INVOICE_STATE.due, label: label("À payer", "Due"), tone: "neutral" },
    { key: INVOICE_STATE.partial, label: label("Payée en partie", "Partly paid"), tone: "accent" },
    { key: INVOICE_STATE.overdue, label: label("En retard", "Overdue"), tone: "danger" },
    { key: INVOICE_STATE.paid, label: label("Payée", "Paid"), tone: "success" },
    { key: INVOICE_STATE.cancelled, label: label("Annulée", "Cancelled"), tone: "neutral" },
    { key: INVOICE_STATE.credit, label: label("Note de crédit", "Credit note"), tone: "neutral" },
  ],
  transitions: [],
};

export const CLIENT_KIND: KindConfig = {
  kind: "client",
  tags: { writers: [...TAG_WRITERS], userTags: true, max: 50, presets: presetsOf(CLIENT_PRESETS) },
  status: null,
  views: [],
};

export const INVOICE_KIND: KindConfig = {
  kind: "invoice",
  tags: { writers: [...TAG_WRITERS], userTags: true, max: 50, presets: presetsOf({ default: INVOICE_PRESETS }) },
  status: INVOICE_STATUS_SET,
  views: [
    { key: "to_collect", label: label("À encaisser", "To collect"), filters: { status: [INVOICE_STATE.due, INVOICE_STATE.partial, INVOICE_STATE.overdue] } },
    { key: "overdue", label: label("En retard", "Overdue"), filters: { status: [INVOICE_STATE.overdue] } },
    { key: "paid", label: label("Payées", "Paid"), filters: { status: [INVOICE_STATE.paid] } },
  ],
};

export const KIND_DEFAULTS: readonly KindConfig[] = [CLIENT_KIND, INVOICE_KIND];
