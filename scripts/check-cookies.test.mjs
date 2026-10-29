import { describe, expect, it } from "vitest";

import { cookieProblems } from "./check-cookies.mjs";

describe("check-cookies", () => {
  it("passes a host-locked cookie on https", () => {
    expect(cookieProblems(["__Host-akinaza_session=x; Path=/; Secure; HttpOnly; SameSite=lax"], { https: true })).toEqual([]);
  });
  it("refuses a Domain attribute everywhere", () => {
    expect(cookieProblems(["akinaza_session=x; Path=/; Domain=akinaza.com"], { https: false })).toHaveLength(1);
  });
  it("refuses on https a cookie without the prefix or Secure", () => {
    expect(cookieProblems(["NEXT_LOCALE=fr; Path=/; SameSite=lax"], { https: true })).toHaveLength(2);
  });
  it("accepts the plain names on plain http, but not a path other than /", () => {
    expect(cookieProblems(["akinaza_session=x; Path=/; HttpOnly"], { https: false })).toEqual([]);
    expect(cookieProblems(["akinaza_shop=x; Path=/app"], { https: false })).toHaveLength(1);
  });
});
