/** What the browser side needs to talk to the BFF: the stable error code of a refusal (the console translates it). */
export function errorKey(error: unknown): string {
  const e = error as { code?: unknown; status?: unknown; body?: { code?: unknown } } | null;
  for (const code of [e?.code, e?.body?.code]) if (typeof code === "string" && /^[A-Z_]+$/.test(code)) return code;
  if (e?.status === 0 || error instanceof TypeError) return "NETWORK";
  return "UNKNOWN";
}

/** The fields a refusal names (`{ fields: ["slug"] }` of a 400): the form can say which one to fix instead of « The request is not valid ». */
export function errorFields(error: unknown): string[] {
  const fields = (error as { body?: { fields?: unknown } } | null)?.body?.fields;
  return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === "string") : [];
}
