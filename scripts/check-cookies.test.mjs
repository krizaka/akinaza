import assert from "node:assert/strict";
import { test } from "node:test";

import { cookieProblems } from "./check-cookies.mjs";

test("a host-locked cookie passes on https", () => {
  assert.deepEqual(cookieProblems(["__Host-akinaza_session=x; Path=/; Secure; HttpOnly; SameSite=lax"], { https: true }), []);
});
test("a Domain attribute is refused everywhere", () => {
  assert.equal(cookieProblems(["akinaza_session=x; Path=/; Domain=akinaza.com"], { https: false }).length, 1);
});
test("on https a cookie without the prefix or Secure is refused", () => {
  assert.equal(cookieProblems(["NEXT_LOCALE=fr; Path=/; SameSite=lax"], { https: true }).length, 2);
});
test("on plain http the plain names are fine, a path other than / is not", () => {
  assert.deepEqual(cookieProblems(["akinaza_session=x; Path=/; HttpOnly"], { https: false }), []);
  assert.equal(cookieProblems(["akinaza_shop=x; Path=/app"], { https: false }).length, 1);
});
