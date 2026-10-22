import { API_KEY_CODE, type ApiKeyCode, ApiKeyError, type ApiKeyRules, type ApiKeys, type Clock, createApiKeys, pgApiKeyStore } from "@krizaka/api-keys";

import { subscriptionOf } from "./billing";
import { query } from "./db";
import { refuse } from "./http";
import { limit } from "./rate-limit";
import { appSettings, assertFeature } from "./settings";

/** Akinaza's API-key rules — data. Keys are `akz_…`; each scope is read-only for now. */
export const AKINAZA_API_KEY_RULES: ApiKeyRules = {
  prefix: "akz",
  scopes: ["bookings:read", "clients:read", "invoices:read", "reports:read"],
  secretBytes: 24,
  maxExpiryDays: 365,
  rotationGraceHours: 24,
  lastUsedEveryMinutes: 5,
};


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

/** How many keys this owner's plan lets them hold (an administrator sets it per plan; 0 = the plan has no API). */
export async function maxActiveKeys(accountId: string, now: Date): Promise<number> {
  const paid = (await subscriptionOf(query, accountId, now)).active;
  return appSettings().get(paid ? "plans.paid.apiKeys" : "plans.free.apiKeys", { userId: accountId });
}

/** The owner may manage keys: the global switch is on, and the plan holds at least one. Returns the plan's quota. */
export async function assertKeysAllowed(accountId: string, now: Date): Promise<number> {
  await assertFeature("apiKeys", accountId);
  const max = await maxActiveKeys(accountId, now);
  if (max < 1) throw refuse(403, "API_PLAN", "Your plan does not include API keys");
  return max;
}

/**
 * The caller of an API route that takes a key (`Authorization: Bearer akz_…`): its owner and key, or the refusal — 401 for a key
 * that is missing, wrong, expired, revoked or replaced, 403 for a scope it lacks, 429 past the per-minute limit. A refused key
 * costs a rate-limit hit on the caller's address, so guessing is slow.
 */
export async function requireApiKey(req: Request, scope: string, clock: Clock): Promise<{ ownerId: string; keyId: string }> {
  limit("api-key-auth", req, null, [120, 60]); // a refused key costs its address a hit: guessing is slow
  const result = await apiKeys(clock).authenticate(req.headers.get("authorization"), scope);
  if (!result.ok) throw keyRefusal(result.code);
  const { ownerId, id } = result.key;
  await assertFeature("apiKeys", ownerId);
  if ((await maxActiveKeys(ownerId, clock.now())) < 1) throw refuse(403, "API_PLAN", "Your plan does not include API keys");
  const perMinute = await appSettings().get("limits.apiRequestsPerMinute", { userId: ownerId });
  limit("api-key", req, id, [perMinute * 2, 60], [perMinute, 60]);
  return { ownerId, keyId: id };
}
