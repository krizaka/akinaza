import { describe, expect, it } from "vitest";

import { CLIENT_PLACES, placesFor } from "./app-nav";

describe("what each role sees in the bar", () => {
  it.each([
    ["owner", ["today", "clients", "invoices", "books", "team", "shop", "profile"]],
    ["manager", ["today", "clients", "invoices", "books", "team", "profile"]],
    ["staff", ["today", "profile"]],
  ] as const)("%s", (role, places) => expect(placesFor(role)).toEqual(places));

  it("gives someone who works in no shop the client's three places", () => {
    expect(CLIENT_PLACES).toEqual(["bookings", "shop", "profile"]);
  });
});
