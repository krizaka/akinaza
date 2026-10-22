import { accounts } from "@/app/accounts";
import { accountAct } from "@/lib/account-access";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Signs every other session out; this one stays. */
export const POST = (req: Request) =>
  accountAct(req, "sessions", async (s) => {
    const signedOut = await accounts().signOutOthers(s.account.id, s.id);
    await audit({ action: "account.sessions_signed_out", actorId: s.account.id, actorLabel: s.account.email, detail: { count: signedOut }, headers: req.headers });
    return { signedOut };
  });
