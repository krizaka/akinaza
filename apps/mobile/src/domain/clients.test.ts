import { matchesClient } from "./clients";

const camille = { fullName: "Camille Côté", phone: "514-555-0100", email: "camille@example.test", dependants: [{ id: "d1", name: "Rex", kind: "dog" as const, profile: {} }] };

describe("finding a client", () => {
  it.each([
    ["", true],
    ["cote", true],
    ["CAMILLE cote", true],
    ["555-0100", true],
    ["rex", true],
    ["example.test", true],
    ["luna", false],
    ["camille luna", false],
  ])("search %j matches: %s", (search, expected) => expect(matchesClient(camille, search)).toBe(expected));
});
