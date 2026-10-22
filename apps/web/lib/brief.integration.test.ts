import { unsubscribeBrief } from "@akinaza/db";
import { previousThursday, subDays } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BriefActionError, inviteRegulars, loadShopBrief, sendDueBriefs } from "./brief";
import { db } from "./db";
import { migrate, pool, query } from "./db";

/** The Monday brief's invitation over a real PostgreSQL (CI's service; locally `DATABASE_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;
const settings = { provider: "none" as const, apiUrl: "https://api.mailgun.net", appUrl: "https://www.akinaza.com" };

describe.runIf(enabled)("the Monday brief's invitation (#200)", () => {
  const stamp = Date.now();
  // A Thursday afternoon: the week's brief is due (Monday 7:00 has passed in Montréal), whatever day the test runs.
  const now = previousThursday(new Date());
  now.setUTCHours(16, 0, 0, 0);
  let shop: { id: string; name: string; slug: string | null; published: boolean; timezone: string };
  let regular: string;

  beforeAll(async () => {
    await migrate();
    const [s] = await query<{ id: string }>(
      "INSERT INTO shops (name, legal_name, kind, registrant, address, slug, published, timezone) VALUES ('Salon Brief', 'Salon Brief', 'services', false, '1 rue Test', $1, true, 'America/Montreal') RETURNING id",
      [`brief-${stamp}`],
    );
    shop = { id: s!.id, name: "Salon Brief", slug: `brief-${stamp}`, published: true, timezone: "America/Montreal" };
    const [st] = await query<{ id: string }>("INSERT INTO staff (shop_id, name) VALUES ($1, 'Julie') RETURNING id", [shop.id]);
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) await query("INSERT INTO schedules (staff_id, weekday, starts_at, ends_at) VALUES ($1, $2, '09:00', '17:00')", [st!.id, weekday]);
    const [svc] = await query<{ id: string }>("INSERT INTO services (shop_id, name_fr, name_en, duration_minutes, price_cents) VALUES ($1, 'Coupe', 'Cut', 60, 5000) RETURNING id", [shop.id]);
    const [c] = await query<{ id: string }>("INSERT INTO clients (shop_id, full_name, email, language) VALUES ($1, 'Camille Tremblay', $2, 'fr') RETURNING id", [shop.id, `camille-${stamp}@akinaza.test`]);
    regular = c!.id;
    await query("INSERT INTO client_consents (client_id, purpose, granted, text_version) VALUES ($1, 'marketing', true, '2026-10-01')", [regular]);
    // Twelve done visits 43 to 54 days ago: a regular who stopped coming, enough history to speak.
    for (let d = 43; d <= 54; d++) {
      const start = subDays(now, d);
      start.setUTCHours(15, 0, 0, 0);
      await query(
        "INSERT INTO appointments (shop_id, staff_id, client_id, service_id, during, status) VALUES ($1, $2, $3, $4, tstzrange($5::timestamptz, $5::timestamptz + interval '60 minutes'), 'done')",
        [shop.id, st!.id, regular, svc!.id, start.toISOString()],
      );
    }
  });
  afterAll(async () => pool().end());

  it("e-mails the owner the week's brief once, with a link that stops it", async () => {
    const [owner] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash, locale) VALUES ($1, 'x', 'fr') RETURNING id", [`owner-${stamp}@akinaza.test`]);
    await query("UPDATE shops SET owner_id = $1 WHERE id = $2", [owner!.id, shop.id]);
    const first = await sendDueBriefs(now, settings);
    expect(first.pending).toBeGreaterThanOrEqual(1);
    const mine = () => query<{ subject: string; body_text: string }>("SELECT subject, body_text FROM mail_outbox WHERE template = 'brief-weekly' AND related_id = $1", [shop.id]);
    const [mail] = await mine();
    expect(mail!.subject).toBe("Le point du lundi — Salon Brief");
    expect(mail!.body_text).toMatch(/créneaux libres dans les 7 prochains jours/);
    expect(mail!.body_text).toContain(`https://www.akinaza.com/fr/app/${shop.id}/aujourdhui`);
    await sendDueBriefs(now, settings); // the next tick: nothing more for this shop this week
    expect(await mine()).toHaveLength(1);
    const token = /\/fr\/brief\/stop\/([A-Za-z0-9_-]{43})/.exec(mail!.body_text)?.[1];
    expect(token).toBeTruthy();
    expect(await unsubscribeBrief(db(), token!)).toBe(true);
    const [off] = await query<{ brief_email: boolean }>("SELECT brief_email FROM shops WHERE id = $1", [shop.id]);
    expect(off!.brief_email).toBe(false);
  });

  it("offers the gaps card with the regular to invite, then invites once", async () => {
    const brief = await loadShopBrief(shop, now);
    const gaps = brief.items.find((i) => i.kind === "gaps");
    expect(gaps?.figures.invitees).toBe(1);
    const result = await inviteRegulars(shop, gaps!.id, now, settings);
    expect(result).toEqual({ sent: 0, pending: 1, failed: 0, skipped: 0 }); // no provider: the mail waits in the outbox
    const [mail] = await query<{ to_email: string; template: string; body_text: string }>("SELECT to_email, template, body_text FROM mail_outbox WHERE related_kind = 'brief' AND related_id = $1", [regular]);
    expect(mail).toMatchObject({ to_email: `camille-${stamp}@akinaza.test`, template: "brief-invite" });
    expect(mail!.body_text).toContain(`https://www.akinaza.com/fr/s/brief-${stamp}`);
    expect(mail!.body_text).toContain("Bonjour Camille");
    await expect(inviteRegulars(shop, gaps!.id, now, settings)).rejects.toMatchObject({ code: "BRIEF_DONE" });
    expect((await loadShopBrief(shop, now)).done[gaps!.id]).toEqual(result);
  });

  it("refuses an id the brief does not hold, and a shop without a public page", async () => {
    await expect(inviteRegulars(shop, "2026-W01:gaps:ahead", now, settings)).rejects.toBeInstanceOf(BriefActionError);
    const hidden = { ...shop, published: false };
    const gaps = (await loadShopBrief(hidden, now)).items.find((i) => i.kind === "gaps");
    expect(gaps).toBeDefined();
    await expect(inviteRegulars(hidden, gaps!.id, now, settings)).rejects.toMatchObject({ code: "SHOP_NOT_PUBLIC" });
  });
});
