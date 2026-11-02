import { describe, expect, it } from "vitest";

import { bindProduct } from "@/lib/brand";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

/** Akinaza holds no client money: no message may speak of an escrow (krizaka/akinaza#372). */
const ESCROW = /sous séquestre|séquestre|held in escrow|escrow/i;

const strings = (value: unknown, path = ""): string[] =>
  typeof value === "string" ? [`${path} = ${value}`] : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k)) : [];

describe.each([["en", en], ["fr", fr]])("the %s messages", (_locale, messages) => {
  it("never mention an escrow", () => {
    expect(strings(messages).filter((s) => ESCROW.test(s))).toEqual([]);
  });
});
