import { slugSchema } from "@akinaza/core";
import { publicShop } from "@akinaza/db";
import { verificationMail } from "@krizaka/email-verification";

import { systemClock } from "@/app/system-clock";
import { captchaMissing, verifyCaptcha } from "@/lib/captcha";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { mailSettings, sessionSecret } from "@/lib/env";
import { type GuestHold,guestStart, guestVerification } from "@/lib/guest-booking";
import { handle, readJson, refuse } from "@/lib/http";
import { mailConfigured, sendCodeMail } from "@/lib/mail";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Step one of a guest booking: the request is held and a 6-digit code goes to the visitor's address (nothing is booked, no account exists yet).
 * Behind a CAPTCHA, and limited per address (so the code mail cannot flood a mailbox) and per IP. Without a mail channel it fails closed (503).
 */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const { captchaToken, ...input } = await readJson(req, guestStart);
    limit("guest-code", req, input.email, [10, 900], [3, 900]);
    const now = () => systemClock.now();
    if (captchaMissing()) throw refuse(503, "CAPTCHA_UNAVAILABLE", "The security check is not configured");
    if (!(await verifyCaptcha(captchaToken, clientIp(req.headers) ?? "unknown", process.env, now))) throw refuse(400, "CAPTCHA_FAILED", "The security check failed");
    const settings = mailSettings();
    if (!mailConfigured(settings)) throw refuse(503, "MAIL_UNAVAILABLE", "The code cannot be mailed right now");
    const slug = slugSchema.parse((await params).slug);
    const page = await publicShop(db(), slug);
    if (!page || !page.services.some((s) => s.id === input.serviceId)) throw refuse(404, "NOT_FOUND", "Not found");
    const hold: GuestHold = { ...input, shopSlug: slug };
    const verification = guestVerification(db(), now, sessionSecret());
    await verification.purge();
    const issued = await verification.issue({ address: input.email, payload: hold });
    const sent = await sendCodeMail(db(), input.email, verificationMail({ locale: input.language, code: issued.code, ttlMinutes: issued.ttlMinutes }), input.language, now(), settings);
    if (!sent) throw refuse(502, "MAIL_FAILED", "The code could not be mailed");
    return Response.json({ challengeId: issued.challengeId, ttlMinutes: issued.ttlMinutes }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
