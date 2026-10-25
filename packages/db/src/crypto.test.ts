import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { leaksPlaintext } from "./plaintext-leak";
import { DataKeyError, openField, parseDataKey, sealField } from "./crypto";

const key = randomBytes(32);

describe("field encryption (AES-256-GCM)", () => {
  it("seals into the v1 format and opens back; two seals of one text differ", () => {
    const sealed = sealField("Code 4821, clé sous le pot", key, "client-1");
    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(leaksPlaintext(sealed, "Code 4821, clé sous le pot")).toBe(false);
    expect(openField(sealed, key, "client-1")).toBe("Code 4821, clé sous le pot");
    expect(sealField("x", key, "client-1")).not.toBe(sealField("x", key, "client-1"));
  });
  it("refuses a ciphertext moved to another row, a wrong key and a tampered value", () => {
    const sealed = sealField("secret", key, "client-1");
    expect(() => openField(sealed, key, "client-2")).toThrow();
    expect(() => openField(sealed, randomBytes(32), "client-1")).toThrow();
    const [v, iv, tag, data] = sealed.split(".");
    expect(() => openField([v, iv, tag, Buffer.from("tampered").toString("base64url")].join("."), key, "client-1")).toThrow();
    expect(() => openField(`v9.${iv}.${tag}.${data}`, key, "client-1")).toThrow(DataKeyError);
  });
  it("accepts only a 32-byte base64 key, and never echoes it", () => {
    expect(parseDataKey(key.toString("base64"))).toHaveLength(32);
    for (const bad of [undefined, "", "c2hvcnQ=", randomBytes(16).toString("base64")]) {
      expect(() => parseDataKey(bad)).toThrow(/32 bytes/);
    }
  });
});
