import { slugSchema } from "@akinaza/core";
import { addDependant, dependantsOf, guestAccountFor, joinShop, publicShop } from "@akinaza/db";
import { cookies } from "next/headers";

import { systemClock } from "@/app/system-clock";
import { audit } from "@/lib/audit";
import { bookAndAnnounce } from "@/lib/book-visit";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { codeRefusal, guestConfirm, type GuestHold,guestVerification } from "@/lib/guest-booking";
import { handle, readJson, refuse } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { createSession, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Step two of a guest booking: the code comes back. The right code (once, 5 tries) releases the held request: the visitor's account is made or
 * found (no password), their client file at this shop is opened with the consents they gave, the visit is booked through the same path as a
 * signed-in client's, and they are signed in. A person who already has a password is sent to sign in instead.
 */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const input = await readJson(req, guestConfirm);
    limit("guest-confirm", req, input.challengeId, [30, 900], [10, 900]);
    const slug = slugSchema.parse((await params).slug);
    const now = () => systemClock.now();
    const checked = await guestVerification(db(), now, sessionSecret()).confirm<GuestHold>({ challengeId: input.challengeId, address: input.email, code: input.code });
    if (!checked.ok) {
      const refusal = codeRefusal(checked);
      throw refuse(refusal.status, refusal.code, "The code was refused", refusal.attemptsLeft === undefined ? {} : { attemptsLeft: refusal.attemptsLeft });
    }
    const hold = checked.payload;
    if (hold.shopSlug !== slug) {
      throw refuse(404, "NOT_FOUND", "Not found");
    }
    const page = await publicShop(db(), slug);
    if (!page) {
      throw refuse(404, "NOT_FOUND", "Not found");
    }
    const account = await guestAccountFor(db(), { email: hold.email, locale: hold.language, name: hold.fullName }, now());
    if (!account.ok) {
      throw refuse(409, "SIGN_IN_REQUIRED", "This address has an account: sign in to book");
    }
    const { clientId } = await joinShop(db(), account.id, account.email, page.shop.id, { fullName: hold.fullName, phone: hold.phone, language: hold.language, consentService: true, consentReminders: hold.consentReminders });
    const dependantIds: string[] = [];
    if (hold.dependantName) {
      const wanted = hold.dependantName.toLowerCase();
      const known = (await dependantsOf(db(), clientId)).find((d) => d.name.toLowerCase() === wanted);
      dependantIds.push(known?.id ?? (await addDependant(db(), clientId, { kind: "dog", name: hold.dependantName, profile: {} })));
    }
    const booked = await bookAndAnnounce({ clientId, shopId: page.shop.id, serviceId: hold.serviceId, zoneId: hold.zoneId, dependantIds, startsAt: hold.startsAt, staffId: hold.staffId, receiptTo: { accountId: account.id, email: account.email, locale: asLocale(hold.language) } });
    const { token, expires } = await createSession(account.id, { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    (await cookies()).set(sessionCookie(token, expires));
    await audit({ action: "booking.guest_confirmed", actorId: account.id, actorLabel: account.email, targetId: booked.bookingIds[0] ?? clientId, detail: { shopId: page.shop.id }, headers: req.headers });
    return Response.json({ bookingId: booked.bookingIds[0], serviceId: hold.serviceId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
