import crypto from "node:crypto";

import { shopRolesOver } from "@akinaza/db";
import { RolesError } from "@krizaka/auth";

import { query } from "./db";
import { refuse } from "./http";

/** A token is kept as its plain SHA-256: it is 256 bits of randomness, a keyed hash adds nothing. */
const inviteHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** The shop's roles over the app's pool: members, invitations, who may hand which role. */
export const team = () => shopRolesOver(async (sql, params) => query(sql, params as unknown[]), inviteHash);

/** Runs a team action; a refusal of the roles block is its stable `{ code }` answer. */
export async function teamAct<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof RolesError) throw refuse(error.status, error.code, error.message);
    throw error;
  }
}
