import { cookies } from "next/headers";

import { sessionTokenOf } from "@/lib/access";
import { expiredCookie } from "@/lib/cookie";
import { handle } from "@/lib/http";
import { revokeSession, SESSION_COOKIE } from "@/lib/session";

export function POST(req: Request) {
  return handle(async () => {
    const jar = await cookies();
    // An app's bearer, else the web's cookie.
    await revokeSession(sessionTokenOf(req.headers) ?? jar.get(SESSION_COOKIE)?.value);
    jar.set(expiredCookie(SESSION_COOKIE));
    return new Response(null, { status: 204 });
  });
}
