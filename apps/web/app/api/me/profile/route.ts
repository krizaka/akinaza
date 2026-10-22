import { z } from "zod";

import { accounts } from "@/app/accounts";
import { accountAct } from "@/lib/account-access";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The member's profile: name, language, theme, avatar seed, e-mail and whether it is verified, a change awaiting its link. */
export const GET = (req: Request) => accountAct(req, "profile", async (s) => ({ profile: await accounts().profile(s.account.id) }));

export const PATCH = (req: Request) =>
  accountAct(req, "profile", async (s) => {
    const patch = await readJson(req, z.object({ name: z.string().nullable().optional(), locale: z.enum(["en", "fr"]).optional(), theme: z.enum(["light", "dark", "system"]).nullable().optional(), avatarSeed: z.string().nullable().optional() }));
    return { profile: await accounts().updateProfile(s.account.id, patch) };
  });
