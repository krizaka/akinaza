import { calendarAnswer, clientsAnswer, dayAnswer, invoicesAnswer, issuedInvoice, shopAnswer } from "@akinaza/core";
import type { ApiClient, SessionStore } from "@krizaka/app-client";
import { z } from "zod";

const accountAnswer = z.object({ account: z.object({ email: z.string(), locale: z.enum(["fr", "en"]) }), token: z.string() });

/** One line of a quick invoice: a service of the shop (its price and tax category apply) or a free line with its own price. */
export type InvoiceLine = { serviceId: string; quantity: number } | { description: string; quantity: number; unitPriceCents: number; category?: "standard" | "zeroRated" | "exempt" };

export interface InvoiceRequest {
  clientId?: string | null;
  language: "fr" | "en";
  /** The local day, `2026-10-20`. */
  issuedOn: string;
  lines: InvoiceLine[];
}

/**
 * The owner's API as the apps use it. Every answer is parsed at the edge: a shape the server did not promise stops here, never
 * inside a screen. `api` is `createApiClient` of `@krizaka/app-client`; `session` its session store.
 */
export function createAkinazaApi(api: Pick<ApiClient, "call">, session: Pick<SessionStore, "saveToken" | "clearToken">) {
  const get = <T extends z.ZodType>(schema: T, path: string): Promise<z.infer<T>> => api.call<unknown>(path).then((value) => schema.parse(value));
  const post = (path: string, body?: unknown) => api.call<unknown>(path, { method: "POST", ...(body === undefined ? {} : { body }) });
  return {
    async signIn(email: string, password: string) {
      const answer = accountAnswer.parse(await post("/api/auth/sign-in", { email, password, client: "native" }));
      await session.saveToken(answer.token);
      return answer.account;
    },
    async signOut(): Promise<void> {
      await post("/api/auth/sign-out").catch(() => undefined);
      await session.clearToken();
    },
    /** The owner's day (today in the shop's time zone when `date` is omitted). */
    day: (date?: string) => get(dayAnswer, `/api/walker/day${date ? `?date=${date}` : ""}`),
    calendar: (from: string, to: string) => get(calendarAnswer, `/api/walker/calendar?from=${from}&to=${to}`).then((r) => r.days),
    clients: () => get(clientsAnswer, "/api/walker/clients").then((r) => r.clients),
    invoices: () => get(invoicesAnswer, "/api/walker/invoices").then((r) => r.invoices),
    shop: () => get(shopAnswer, "/api/walker/shop"),
    async issueInvoice(request: InvoiceRequest) {
      return issuedInvoice.parse(await post("/api/walker/invoices", request));
    },
    async checkIn(appointmentId: string) {
      await post(`/api/walker/visits/${appointmentId}/check-in`);
    },
    async checkOut(appointmentId: string) {
      await post(`/api/walker/visits/${appointmentId}/check-out`);
    },
  };
}

export type AkinazaApi = ReturnType<typeof createAkinazaApi>;
