import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ now: undefined as Date | undefined, mail: undefined as Record<string, unknown> | undefined }));
const STARTS_AT = new Date("2026-11-02T15:00:00.000Z");
const RUN_CLOCK = "2026-11-02T01:00:00.000Z"; // 14 h before the slot: inside the 24 h window
const HOURS = 24;

vi.mock("@akinaza/db", () => ({
  // The window is judged at the instant the caller passes, as the real query does.
  bookingDetail: vi.fn(async (_db: unknown, _account: string, id: string, now: Date) => {
    seen.now = now;
    return {
      id,
      startsAt: STARTS_AT,
      cancellable: STARTS_AT.getTime() - now.getTime() >= HOURS * 3_600_000,
      cancellationHours: HOURS,
      shop: { slug: "atelier", name: "Atelier" },
      service: { id: "svc", name: "Coupe" },
    };
  }),
  enqueueMail: vi.fn(async () => "mail-1"),
  mailById: vi.fn(async () => null),
}));
vi.mock("@krizaka/email", () => ({
  renderEmail: vi.fn(async (_template: string, data: Record<string, unknown>) => {
    seen.mail = data;
    return { subject: "s", html: "h", text: "t" };
  }),
}));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/mail", () => ({ deliver: vi.fn() }));
vi.mock("@/lib/journey", () => ({
  confirmationStep: ({ detail }: { detail: { cancellable: boolean; cancellationHours: number } }) => ({
    title: "Coupe",
    when: "when",
    who: "who",
    where: "where",
    price: "price",
    cancelRule: detail.cancellable ? `Free cancellation up to ${detail.cancellationHours} h before` : "Too late to cancel",
  }),
}));

import { sendBookingReceipt } from "./booking-receipt";

const recipient = { accountId: "acc", email: "a@example.test", locale: "en" as const, settings: { appUrl: "https://dev.akinaza.com" } as never };

describe("the booking receipt mail", () => {
  beforeEach(() => {
    seen.now = undefined;
    seen.mail = undefined;
    vi.stubEnv("APP_ENVIRONMENT", "dev");
    vi.stubEnv("APP_FIXED_NOW", RUN_CLOCK);
    // The wall clock is a week before the slot (outside the window): reading it instead of the run clock changes the rule.
    vi.useFakeTimers({ now: new Date("2026-10-25T00:00:00.000Z"), toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("judges the cancellation window at the injected run clock, not the wall clock", async () => {
    await sendBookingReceipt(recipient, "b1");
    expect(seen.now?.toISOString()).toBe(RUN_CLOCK);
  });

  it("keeps the cancellation rule for a slot under 24 h away", async () => {
    await sendBookingReceipt(recipient, "b1");
    // 14 h before the slot at the run clock: the rule is the page's, a free-cancellation window that closes 24 h before is already shut.
    expect(seen.mail?.cancelRule).toBe("Too late to cancel");
  });
});
