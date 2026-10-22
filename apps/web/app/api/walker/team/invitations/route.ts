import { enqueueMail } from "@akinaza/db";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { team, teamAct } from "@/lib/team";

export const dynamic = "force-dynamic";

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Invites an e-mail address with a role the inviter may hand out (an owner any, a manager only staff). The link is mailed (queued in the
 * outbox until a provider is configured) and also in this answer, to the inviter, so it can be passed on by hand: sign-up stays by invitation.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const { session, shop } = await requireShop(req, "team");
    limit("invite", req, session.account.id, [30, 3600]);
    const input = await readJson(req, z.object({ email: z.string().max(320), role: z.string().max(20) }));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) return Response.json({ error: "Not an e-mail address", code: "BAD_REQUEST" }, { status: 400 });
    const { token, invitation } = await teamAct(() => team().invite(shop.id, { id: session.account.id }, input, systemClock.now()));
    const link = `${new URL(req.url).origin}/fr/accept-invite?token=${encodeURIComponent(token)}`;
    const text = `Bonjour,\n\nOn vous invite à rejoindre « ${shop.name} » sur Akinaza (rôle : ${invitation.role}). Ouvrez ce lien, connecté à ${invitation.email}, pour accepter :\n${link}\n\nHello — you are invited to join “${shop.name}” on Akinaza (role: ${invitation.role}). Open this link, signed in as ${invitation.email}:\n${link}\n`;
    await enqueueMail(db(), { to: invitation.email, locale: "fr", template: "team-invitation", subject: `Invitation — ${shop.name}`, text, html: `<p>${escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>` });
    await audit({ action: "team.invited", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { email: invitation.email, role: invitation.role }, headers: req.headers });
    return Response.json({ invitation, link }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  });
