import { accountData, accounts } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { accountAct } from "@/lib/account-access";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Everything Akinaza keeps about the member, as one JSON file: the profile, the sign-ins, the shops they run, their client files (Loi 25, access). */
export const GET = (req: Request) =>
  accountAct(req, "account-export", async (s) => {
    const data = await accounts().exportAccount(s.account.id, systemClock.now(), () => accountData(s.account.id));
    await audit({ action: "account.exported", actorId: s.account.id, actorLabel: s.account.email, headers: req.headers });
    return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="akinaza-account.json"', "Cache-Control": "private, no-store" } });
  });
