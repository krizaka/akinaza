import { accounts } from "@/app/accounts";
import { optionalSession } from "@/lib/access";
import { signupEnabled } from "@/lib/env";
import { handle } from "@/lib/http";
import type { Me } from "@/lib/me";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Who is looking, for the public pages' bar (a client island keeps those pages static). A hint only: it never authorises
 * anything, every page and route of the app checks the session itself. Never cached, never shared.
 */
export function GET(req: Request) {
  return handle(async () => {
    limit("me", req, null, [600, 3600]);
    const session = await optionalSession(req);
    const body: Me = { signedIn: !!session, signupOpen: signupEnabled() };
    if (session) {
      const profile = await accounts().profile(session.account.id);
      body.account = { id: profile.id, name: profile.name, email: profile.email, avatarSeed: profile.avatarSeed };
    }
    return Response.json(body, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  });
}
