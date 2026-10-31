/**
 * Bot protection of the public forms: a CAPTCHA verified on the server (ABUSE context). The check itself is `@krizaka/rate-limit/turnstile`
 * (fail closed, single-use tokens, hostname check, timeout): nothing of it is copied here. Configured by `ABUSE_CAPTCHA_PROVIDER=turnstile` and the
 * widget's server key (`ABUSE_CAPTCHA_SECRET_KEY`); the browser widget reads `NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY`. Outside production an unconfigured
 * check is off (local dev, tests); in PRODUCTION it is a refusal: a widget that is not configured protects nothing.
 */
import { createTurnstileVerifier, type TurnstileFetch } from "@krizaka/rate-limit/turnstile";

type Env = Record<string, string | undefined>;

const isProduction = (env: Env): boolean => env.APP_ENVIRONMENT === "prod";

/**
 * Cloudflare's published TEST keys (1x = always passes, 2x = always fails, 3x = forced challenge): public, documented, used by the CI journeys
 * (krizaka-internal#1934). They verify nothing, so a deployment that declares itself production (`APP_ENVIRONMENT=prod`) refuses them.
 */
export const isTurnstileTestKey = (key: string | undefined): boolean => /^[123]x0{10,}/.test(key?.trim() ?? "");

export const captchaConfigured = (env: Env = process.env): boolean => {
  const key = env.ABUSE_CAPTCHA_SECRET_KEY?.trim();
  return env.ABUSE_CAPTCHA_PROVIDER?.trim().toLowerCase() === "turnstile" && Boolean(key) && !(isProduction(env) && isTurnstileTestKey(key));
};

/** Production without the check configured (or with a test key): the form refuses (503) rather than let every bot through. */
export const captchaMissing = (env: Env = process.env): boolean => (env.NODE_ENV === "production" || isProduction(env)) && !captchaConfigured(env);

// One verifier per key and process: it remembers the tokens it saw, so a replayed token is refused.
const verifiers = new Map<string, ReturnType<typeof createTurnstileVerifier>>();

/** The hostnames a token may have been solved on: the app's own, from its public address. */
const hostnamesOf = (env: Env): string[] => {
  try {
    // A test key's answers name example.com whatever the page: no hostname to check (production refuses such a key above).
    return env.NODE_ENV === "production" && env.APP_PUBLIC_URL && !isTurnstileTestKey(env.ABUSE_CAPTCHA_SECRET_KEY) ? [new URL(env.APP_PUBLIC_URL).hostname] : [];
  } catch {
    return [];
  }
};

/** True when the check is off (not production, not configured) or the token is valid. `ip` is the visitor's address ("unknown" is not sent). */
export async function verifyCaptcha(token: unknown, ip: string, env: Env, now: () => Date, fetchImpl?: TurnstileFetch): Promise<boolean> {
  if (!captchaConfigured(env)) {
    return !captchaMissing(env);
  }
  const key = env.ABUSE_CAPTCHA_SECRET_KEY!.trim();
  const options = { secret: key, hostnames: hostnamesOf(env), now };
  // A test key's widget hands out the same dummy token every time: no replay memory for it (production refuses such a key).
  const remembered = !isTurnstileTestKey(key);
  let verify = fetchImpl ? createTurnstileVerifier({ ...options, fetch: fetchImpl }) : undefined;
  if (!fetchImpl && remembered) verify = verifiers.get(key);
  if (!verify) {
    verify = createTurnstileVerifier(options);
    if (remembered) verifiers.set(key, verify);
  }
  return (await verify({ token, remoteIp: ip })).ok;
}
