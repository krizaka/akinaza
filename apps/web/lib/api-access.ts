import { API_KEY_CODE, type ApiKeyCode, ApiKeyError, type ApiKeyRules, type ApiKeys, type Clock, createApiKeys, pgApiKeyStore } from "@krizaka/api-keys";

import { subscriptionOf } from "./billing";
import { query } from "./db";
import { refuse } from "./http";
import { limit } from "./rate-limit";

/** Akinaza's API-key rules — data. Keys are `akz_…`; each scope is read-only for now. */
export const AKINAZA_API_KEY_RULES: ApiKeyRules = {
  prefix: "akz",
  scopes: ["bookings:read", "clients:read", "invoices:read", "reports:read"],
  secretBytes: 24,
  maxExpiryDays: 365,
  rotationGraceHours: 24,
  lastUsedEveryMinutes: 5,
};

/** How many keys an owner may hold: the plan's data (a member of the paid offer holds more). */
// @fixed: the plan's quota of keys, a product decision until an administrator can set it per plan
export const KEYS_PER_PLAN = { free: 2, paid: 10 } as const;
// @fixed: requests per minute for one key — the ceiling of an integration, not a business parameter
const REQUESTS_PER_MINUTE = 120;

export const apiKeys = (clock: Clock): ApiKeys => createApiKeys({ store: pgApiKeyStore(query), rules: AKINAZA_API_KEY_RULES, clock });

/** The HTTP answer of each refusal of the module: stable codes the page translates and the API documents. */
const ANSWER: Record<ApiKeyCode, number> = {
  [API_KEY_CODE.missing]: 401,
  [API_KEY_CODE.invalid]: 401,
  [API_KEY_CODE.expired]: 401,
  [API_KEY_CODE.revoked]: 401,
  [API_KEY_CODE.superseded]: 401,
  [API_KEY_CODE.scope]: 403,
  [API_KEY_CODE.scopeUnknown]: 400,
  [API_KEY_CODE.name]: 400,
  [API_KEY_CODE.expiry]: 400,
  [API_KEY_CODE.limit]: 409,
  [API_KEY_CODE.notFound]: 404,
};

export const keyRefusal = (code: ApiKeyCode) => refuse(ANSWER[code], code, `API key refused: ${code}`);

/** Runs a key action; a refusal of the module becomes its stable HTTP answer. */
export async function keyAct<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiKeyError) throw keyRefusal(error.code);
    throw error;
  }
}

/** How many keys this owner's plan lets them hold. */
export async function maxActiveKeys(accountId: string, now: Date): Promise<number> {
  return (await subscriptionOf(query, accountId, now)).active ? KEYS_PER_PLAN.paid : KEYS_PER_PLAN.free;
}

/**
 * The caller of an API route that takes a key (`Authorization: Bearer akz_…`): its owner and key, or the refusal — 401 for a key
 * that is missing, wrong, expired, revoked or replaced, 403 for a scope it lacks, 429 past the per-minute limit. A refused key
 * costs a rate-limit hit on the caller's address, so guessing is slow.
 */
export async function requireApiKey(req: Request, scope: string, clock: Clock): Promise<{ ownerId: string; keyId: string }> {
  limit("api-key-auth", req, null, [REQUESTS_PER_MINUTE, 60]);
  const result = await apiKeys(clock).authenticate(req.headers.get("authorization"), scope);
  if (!result.ok) throw keyRefusal(result.code);
  const { ownerId, id } = result.key;
  limit("api-key", req, id, [REQUESTS_PER_MINUTE * 2, 60], [REQUESTS_PER_MINUTE, 60]);
  return { ownerId, keyId: id };
}
