import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createIncidentRegister } from "@krizaka/privacy";
import { afterAll, beforeAll, expect, it } from "vitest";

import { queryOf } from "./privacy";
import { PRIVACY_INCIDENT_MIGRATION_SQL } from "./privacy-incident-migration";
import { freshDatabase } from "./test/db";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

it("the incident register migration file is exactly what the shared module generates (akinaza#392)", () => {
  expect(readFileSync(fileURLToPath(new URL("../drizzle/0043_privacy_incident_register.sql", import.meta.url)), "utf8")).toBe(PRIVACY_INCIDENT_MIGRATION_SQL);
});

it("keeps one register per scope on the real database, and an entry until its retention ends", async () => {
  const run = queryOf(t.db);
  const register = createIncidentRegister({ clock: { now: () => new Date() } });
  const actor = { id: null, label: "admin@akinaza.test" };
  const mine = await register.open(run, { scope: "akinaza", kind: "loss", description: "A laptop was lost.", information: ["invoice"] }, actor);
  await register.open(run, { scope: "yomizaka", kind: "access", description: "Another tenant.", information: ["lease"] }, actor);
  expect((await register.list(run, "akinaza")).map((i) => i.id)).toEqual([mine.id]);
  expect(await register.get(run, "yomizaka", mine.id)).toBeNull();
  await expect(register.close(run, "yomizaka", mine.id, actor)).rejects.toMatchObject({ code: "INCIDENT_UNKNOWN" });
  await expect(run("DELETE FROM privacy.incident WHERE id = $1", [mine.id])).rejects.toThrow(/retention/);
});
