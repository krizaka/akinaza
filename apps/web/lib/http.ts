import { ShopError } from "@akinaza/db";
import { z, ZodError } from "zod";

/** An error the API answers with: a status, a stable code (the client translates it), a message for logs. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const refuse = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => new HttpError(status, message, { code, ...extra });

/** What each refusal of the service-shop operations means on the wire: its status; the code is the name without `AK_`. */
const SHOP_STATUS: Record<string, number> = {
  AK_SLUG_TAKEN: 409, AK_NOT_PUBLISHABLE: 409, AK_ZONE_EXISTS: 409, AK_WINDOW_OVERLAP: 409, AK_WINDOW_ORDER: 400, AK_SLOT_UNAVAILABLE: 409, AK_CAPACITY_FULL: 409,
  AK_BOOKING_OWNERSHIP: 403, AK_ZONE_REQUIRED: 400, AK_DEPENDANTS_REQUIRED: 400, AK_CANCEL_TOO_LATE: 409, AK_BOOKING_UNKNOWN: 404, AK_VISIT_UNKNOWN: 404,
  AK_SHOP_UNKNOWN: 404, AK_SERVICE_UNKNOWN: 404, AK_CLIENT_UNKNOWN: 404, AK_STAFF_UNKNOWN: 409, AK_ALREADY_CHECKED_IN: 409, AK_NOT_CHECKED_IN: 409, AK_ALREADY_CHECKED_OUT: 409,
  AK_VISIT_CANCELLED: 409, AK_VISIT_NOT_DONE: 409, AK_NOTE_INVALID: 400, AK_PHOTO_INVALID: 400, AK_PHOTO_TOO_LARGE: 413, AK_NO_CONSENT: 409, AK_CLIENT_UNREACHABLE: 409, AK_NO_REPORT: 409,
};

/** Runs a route handler: an HttpError becomes its JSON answer; anything else is a 500 that leaks nothing. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const response = await dispatch(run, requestId);
  // Every answer says which request it was: the run of a journey can be traced (and quoted in a pull request).
  response.headers.set("x-request-id", requestId);
  return response;
}

async function dispatch(run: () => Promise<Response>, requestId: string): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError) {
      return Response.json({ error: error.message, ...error.body }, { status: error.status, headers: error.headers });
    }
    if (error instanceof ShopError) {
      return Response.json({ error: error.code, code: error.code.replace(/^AK_/, "") }, { status: SHOP_STATUS[error.code] ?? 400 });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid body", code: "BAD_REQUEST", fields: error.issues.map((i) => i.path.join(".")) }, { status: 400 });
    }
    console.error(`api: unexpected error (request ${requestId})`, error);
    return Response.json({ error: "Something went wrong", code: "INTERNAL" }, { status: 500 });
  }
}

/** Reads a JSON body against a schema: a malformed body is a 400 with the field names, never the values. */
export async function readJson<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[] }[] } } }): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw refuse(400, "BAD_REQUEST", "The body is not JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw refuse(400, "BAD_REQUEST", "Invalid body", { fields: parsed.error.issues.map((i) => i.path.join(".")) });
  return parsed.data;
}

/** A path parameter that must be an id: anything else is a 400, never a database error. */
export const idParam = (value: string): string => z.string().uuid().parse(value);
