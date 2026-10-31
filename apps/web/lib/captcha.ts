/**
 * Bot protection of the public forms: a CAPTCHA verified on the server (ABUSE context). The check itself is `@krizaka/rate-limit/turnstile`
 * (fail closed, single-use tokens, hostname check, timeout): nothing of it is copied here. Configured by `ABUSE_CAPTCHA_PROVIDER=turnstile` and the
 * widget's server key (`ABUSE_CAPTCHA_SECRET_KEY`); the browser widget reads `NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY`. Outside production an unconfigured
 * check is off (local dev, tests); in PRODUCTION it is a refusal: a widget that is not configured protects nothing.
 */
import { createTurnstileVerifier, type TurnstileFetch } from "@krizaka/rate-limit/turnstile";

type Env = Record<string, string | undefined>;

export const captchaConfigured = (env: Env = process.env): boolean => env.ABUSE_CAPTCHA_PROVIDER?.trim().toLowerCase() === "turnstile" && Boolean(env.ABUSE_CAPTCHA_SECRET_KEY?.trim());

/** Production without the check configured: the form refuses (503) rather than let every bot through. */
export const captchaMissing = (env: Env = process.env): boolean => env.NODE_ENV === "production" && !captchaConfigured(env);

// One verifier per key and process: it remembers the tokens it saw, so a replayed token is refused.
const verifiers = new Map<string, ReturnType<typeof createTurnstileVerifier>>();

/** The hostnames a token may have been solved on: the app's own, from its public address. */
const hostnamesOf = (env: Env): string[] => {
  try {
    return env.NODE_ENV === "production" && env.APP_PUBLIC_URL ? [new URL(env.APP_PUBLIC_URL).hostname] : [];
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
  let verify = fetchImpl ? createTurnstileVerifier({ ...options, fetch: fetchImpl }) : verifiers.get(key);
  if (!verify) {
    verify = createTurnstileVerifier(options);
    verifiers.set(key, verify);
  }
  return (await verify({ token, remoteIp: ip })).ok;
}
