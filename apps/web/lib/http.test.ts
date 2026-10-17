import { ShopError } from "@akinaza/db";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { handle, idParam, refuse } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("the API's answers", () => {
  it("carry a request id on success and on every kind of refusal, so a run can be traced", async () => {
    const ids = new Set<string>();
    for (const run of [
      async () => Response.json({ ok: true }),
      async () => {
        throw refuse(403, "FORBIDDEN", "no");
      },
      async () => {
        throw new ShopError("AK_SLOT_UNAVAILABLE");
      },
      async () => z.string().uuid().parse("nope") as never,
      async () => {
        throw new Error("boom");
      },
    ]) {
      const res = await handle(run);
      const id = res.headers.get("x-request-id");
      expect(id).toMatch(UUID);
      ids.add(id!);
    }
    expect(ids.size).toBe(5);
  });

  it("answers a service-shop refusal with its status and a stable code, never the internals", async () => {
    const res = await handle(async () => {
      throw new ShopError("AK_CANCEL_TOO_LATE");
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "AK_CANCEL_TOO_LATE", code: "CANCEL_TOO_LATE" });
    const unknown = await handle(async () => {
      throw new Error("select * from secrets");
    });
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain("secrets");
  });

  it("refuses an id that is not one with a 400, not a database error", async () => {
    expect(() => idParam("1; drop table")).toThrow();
    expect((await handle(async () => Response.json({ id: idParam("1; drop table") }))).status).toBe(400);
  });
});
