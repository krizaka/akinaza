import { CalendarSourceError } from "@akinaza/core";

/** What a provider's HTTP answer means for a sync: the refusal worth a reconnection, the one worth waiting for, the outage worth a retry. */
export async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  if (res.ok) {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      throw new CalendarSourceError("AK_CAL_INVALID", false, "the provider's answer is not JSON");
    }
  }
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (res.status === 400 && (body.error === "invalid_grant" || (typeof body.error === "object" && body.error !== null))) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
  if (res.status === 401) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
  if (res.status === 403) throw new CalendarSourceError("AK_CAL_REFUSED", false);
  if (res.status === 429) throw new CalendarSourceError("AK_CAL_RATE_LIMITED", true);
  throw new CalendarSourceError("AK_CAL_UNREACHABLE", res.status >= 500);
}

/** A form-encoded POST (the token endpoints), network failures named as such. */
export async function postForm(doFetch: typeof fetch, url: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  try {
    return await jsonOf(await doFetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(15_000) }));
  } catch (error) {
    if (error instanceof CalendarSourceError) throw error;
    throw new CalendarSourceError("AK_CAL_UNREACHABLE", true);
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
