import { booksAnswer, calendarAnswer, clientsAnswer, dayAnswer, figuresAnswer, invoicesAnswer, issuedInvoice, meAnswer, shopAnswer } from "@akinaza/core";
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
/**
 * The shop of the address (`/fr/app/<shop>/…`, as the web's): the walker routes pick it with `?shopId=`; without one, the server
 * answers for the member's default shop (the app's first screen, before it knows which).
 */
export const inShop = (path: string, shopId?: string): string => (shopId ? `${path}${path.includes("?") ? "&" : "?"}shopId=${encodeURIComponent(shopId)}` : path);

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
    /** Who is signed in (`GET /api/me`, the bearer): what the header's account button shows. */
    me: () => get(meAnswer, "/api/me").then((r) => r.account ?? null),
    /** The owner's day (today in the shop's time zone when `date` is omitted). */
    day: (date?: string, shopId?: string) => get(dayAnswer, inShop(date ? `/api/walker/day?date=${date}` : "/api/walker/day", shopId)),
    calendar: (from: string, to: string, shopId?: string) => get(calendarAnswer, inShop(`/api/walker/calendar?from=${from}&to=${to}`, shopId)).then((r) => r.days),
    clients: (shopId?: string) => get(clientsAnswer, inShop("/api/walker/clients", shopId)).then((r) => r.clients),
    invoices: (shopId?: string) => get(invoicesAnswer, inShop("/api/walker/invoices", shopId)).then((r) => r.invoices),
    shop: (shopId?: string) => get(shopAnswer, inShop("/api/walker/shop", shopId)),
    /** « Livres »: the period's prepared GST/QST (`2026-Q3`, `2026-02`; the latest completed quarter by default). */
    books: (period?: string, shopId?: string) => get(booksAnswer, inShop(period ? `/api/walker/books?period=${encodeURIComponent(period)}` : "/api/walker/books", shopId)),
    /** « Vos chiffres » (#260): each figure with its value, formula as data, sources and state, and « que faire maintenant ». */
    figures: (shopId?: string) => get(figuresAnswer, inShop("/api/walker/figures", shopId)),
    async issueInvoice(request: InvoiceRequest, shopId?: string) {
      return issuedInvoice.parse(await post(inShop("/api/walker/invoices", shopId), request));
    },
    async checkIn(appointmentId: string, shopId?: string) {
      await post(inShop(`/api/walker/visits/${appointmentId}/check-in`, shopId));
    },
    async checkOut(appointmentId: string, shopId?: string) {
      await post(inShop(`/api/walker/visits/${appointmentId}/check-out`, shopId));
    },
  };
}

export type AkinazaApi = ReturnType<typeof createAkinazaApi>;
