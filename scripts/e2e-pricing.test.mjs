import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CARD, signIn, startTrialCheckout } from "./lib/e2e-pricing.mjs";

test("the persona walk uses the processor's test card and asks for the plan in the address", async () => {
  assert.match(CARD.number, /^4242 4242 4242 4242$/);
  const seen = [];
  await startTrialCheckout(async (bearer, path, init) => (seen.push([bearer, path, init.method]), { status: 200, body: {} }), "t", "association");
  assert.deepEqual(seen, [["t", "/api/billing/checkout?plan=association&locale=en", "POST"]]);
});

test("a refused sign-in throws without repeating the credential", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 401 });
  try {
    await assert.rejects(signIn("http://x", "a@b.test", "hunter2-hunter2"), (e) => !String(e.message).includes("hunter2"));
  } finally {
    globalThis.fetch = real;
  }
});

test("the script reads its personas from the environment and never prints a session", () => {
  const src = readFileSync(new URL("./e2e-pricing.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\$\{(owner|asso|admin)\}/);
  assert.match(src, /E2E_OWNER_EMAIL/);
});
