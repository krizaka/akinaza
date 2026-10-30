// The small, testable parts of scripts/e2e-pricing.mjs.

/** The processor's documented TEST card (never a real one). */
export const CARD = Object.freeze({ number: "4242 4242 4242 4242", expiry: "12 / 34", cvc: "123" });

/** A bearer for an account (the native client of the sign-in route); it is returned, never printed. */
export async function signIn(base, email, pass) {
  const res = await fetch(`${base}/api/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pass, client: "native" }) });
  if (res.status !== 200) throw new Error(`sign-in refused for a persona (${res.status})`);
  const answer = await res.json();
  if (typeof answer.token !== "string") throw new Error("sign-in gave no session");
  return answer.token;
}

/** Opens the checkout of a plan (the address carries the plan). */
export async function startTrialCheckout(api, bearer, plan) {
  return api(bearer, `/api/billing/checkout?plan=${encodeURIComponent(plan)}&locale=en`, { method: "POST" });
}
