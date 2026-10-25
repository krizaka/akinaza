import type { InvoiceState } from "@akinaza/core";

/** The tone of an invoice's state chip, the same on the list, the invoice and the client's file (a value: never in a « use client » module). */
export const STATE_TONE: Record<InvoiceState, "neutral" | "success" | "warning" | "danger" | "accent"> = { credit: "warning", cancelled: "neutral", paid: "success", partial: "accent", overdue: "danger", due: "neutral" };
