import { describe, expect, it } from "vitest";

import { settle } from "./settle";

describe("settle: one failing section never blanks the page (D6)", () => {
  it("gives the value of a section that loaded", async () => {
    expect(await settle(Promise.resolve(3))).toEqual({ ok: true, value: 3 });
  });

  it("gives a failure, never the error's words, for a section that failed", async () => {
    expect(await settle(Promise.reject(new Error("select * from secrets")))).toEqual({ ok: false });
  });
});
