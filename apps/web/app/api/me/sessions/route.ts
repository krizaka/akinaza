import { accounts } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { accountAct } from "@/lib/account-access";

export const dynamic = "force-dynamic";

/** The member's live sign-ins (where from, when), the current one flagged — never a token. */
export const GET = (req: Request) => accountAct(req, "sessions", async (s) => ({ sessions: await accounts().sessions(s.account.id, systemClock.now(), s.id) }));
