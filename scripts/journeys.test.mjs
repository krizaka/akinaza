import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The critical journeys (krizaka-internal#1934): the org's required check `journeys / gate`, the guest booking behind Cloudflare's test keys.
describe("the critical journeys", () => {
  const workflow = read(".github/workflows/journeys.yml");
  const start = read("scripts/ci-journeys-start.sh");
  const spec = read("apps/web/e2e/journeys/guest-booking.critical.mjs");
  const config = read("apps/web/e2e/journeys/playwright.config.mjs");

  it("calls the org's journeys workflow under the job id `journeys` (the check is `journeys / gate`), pinned by SHA, on PR, queue and main", () => {
    expect(workflow).toMatch(/^ {2}journeys:\n {4}uses: krizaka\/\.github\/\.github\/workflows\/journeys\.yml@[0-9a-f]{40}/m);
    for (const trigger of ["pull_request", "merge_group", "push"]) expect(workflow).toContain(trigger);
    expect(workflow).toContain("--project=critical");
    expect(config).toContain('name: "critical"');
    expect(config).toContain('video: "on"');
    expect(config).toContain("retries: 0");
  });

  it("serves two builds on Cloudflare's published test keys: always pass for the journey, always fail for the refusal, never a real key", () => {
    expect(start).toContain("NEXT_PUBLIC_ABUSE_CAPTCHA_SITE_KEY=1x00000000000000000000AA");
    expect(start).toMatch(/1x0{31}AA[\s\S]*PORT=3000/);
    expect(start).toMatch(/2x0{31}AA[\s\S]*PORT=3001/);
    expect(start).toContain("APP_ENVIRONMENT=dev");
    expect(start).toContain("MAIL_API_URL=http://127.0.0.1:3299");
  });

  it("walks the guest booking in both languages and proves the refused check mails nothing", () => {
    for (const step of ["/slots", "/confirm?", "data-guest-summary", "codeFor(email)", "confirmation", "data-booked-stamp", "toBe(400)", 'for (const locale of ["en", "fr"])']) expect(spec).toContain(step);
    expect(spec).toContain("@akinaza.test");
  });
});
