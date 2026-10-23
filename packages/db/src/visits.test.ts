import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dependants, mailOutbox, staff, visitReports } from "./schema";
import { addStaff, addWindow, bookVisit, ShopError, revealAccessNotes, setAccessNotes } from "./service-shop";
import { freshDatabase, refusal } from "./test/db";
import { account, NOW, walkerShop } from "./test/fixtures";
import { checkIn, checkOut, clientBookings, dayVisits, visitDays, enqueueMail, exportClient, issueReportLink, markMailAttempt, markMailSent, pendingMail, reportByToken, reportForClient, reportPhoto, saveReport, shopClients } from "./visits";
import { eraseClient, issueInvoice, recordConsent } from "./shop-ops";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ShopError ? e.code : String(e);
  }
  return null;
};
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(200)]);
const start = new Date("2026-10-20T13:00:00Z");
const afterWalk = new Date("2026-10-20T14:48:00Z");

async function walked(tag: string) {
  const w = await walkerShop(t.db, tag);
  const b = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.group, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: start, now: NOW });
  const b2 = await bookVisit(t.db, { clientId: w.jordan.clientId, serviceId: w.group, zoneId: w.zones.stHenri, dependantIds: [w.jordan.dogId], startsAt: start, now: NOW });
  return { w, appointmentId: b.appointmentId, rex: b.bookingIds[0]!, luna: b2.bookingIds[0]! };
}

describe("the walker's day", () => {
  it("lists the day's visits with the dogs, their owners and the zone, in the shop's time zone", async () => {
    const { w, appointmentId } = await walked("day");
    const day = await dayVisits(t.db, w.shopId, "2026-10-20");
    expect(day).toHaveLength(1);
    expect(day[0]).toMatchObject({ appointmentId, zone: "Saint-Henri", service: { fr: "Promenade en groupe", capacity: 3 }, checkedInAt: null });
    expect(day[0]!.bookings.map((b) => b.dependant.name).sort()).toEqual(["Luna", "Rex"]);
    expect(day[0]!.bookings[0]).toMatchObject({ clientPhone: "514-555-0100", hasAccessNotes: false, report: null });
    expect(await dayVisits(t.db, w.shopId, "2026-10-19")).toEqual([]);
  });

  it("checks in once, checks out only after a check-in, and a stranger's shop cannot touch the visit", async () => {
    const { w, appointmentId } = await walked("inout");
    expect(await code(checkOut(t.db, w.shopId, appointmentId, afterWalk))).toBe("AK_NOT_CHECKED_IN");
    const other = await walkerShop(t.db, "inout-other");
    expect(await code(checkIn(t.db, other.shopId, appointmentId, start))).toBe("AK_VISIT_UNKNOWN");
    await checkIn(t.db, w.shopId, appointmentId, start);
    expect(await code(checkIn(t.db, w.shopId, appointmentId, start))).toBe("AK_ALREADY_CHECKED_IN");
    expect(await checkOut(t.db, w.shopId, appointmentId, afterWalk)).toEqual({ minutes: 108 });
    expect(await code(checkOut(t.db, w.shopId, appointmentId, afterWalk))).toBe("AK_ALREADY_CHECKED_OUT");
    const [visit] = await dayVisits(t.db, w.shopId, "2026-10-20");
    expect(visit!.status).toBe("done");
  });
});

describe("a staff member's own agenda (the apps' day and calendar)", () => {
  it("narrows the day and the calendar to the appointments assigned to that person; the shop's agenda keeps them all", async () => {
    const w = await walkerShop(t.db, "own-agenda");
    const noeAccount = await account(t.db, "noe-own-agenda@example.test");
    const noe = await addStaff(t.db, w.shopId, "Noé");
    await t.db.update(staff).set({ accountId: noeAccount.id }).where(eq(staff.id, noe));
    await addWindow(t.db, w.shopId, { weekday: 2, startsAt: "13:00", endsAt: "17:00" }, noe);
    await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: start, now: NOW });
    await bookVisit(t.db, { clientId: w.jordan.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.jordan.dogId], startsAt: new Date("2026-10-20T18:00:00Z"), now: NOW, staffId: noe });

    const names = (visits: Awaited<ReturnType<typeof dayVisits>>) => visits.flatMap((v) => v.bookings.map((b) => b.clientName)).sort();
    expect(names(await dayVisits(t.db, w.shopId, "2026-10-20"))).toEqual(["Camille Tremblay", "Jordan Lee"]);
    expect(names(await dayVisits(t.db, w.shopId, "2026-10-20", { staffAccountId: noeAccount.id }))).toEqual(["Jordan Lee"]);
    expect(await dayVisits(t.db, w.shopId, "2026-10-20", { staffAccountId: w.camille.account.id })).toEqual([]);

    expect(await visitDays(t.db, w.shopId, "2026-10-19", "2026-10-21")).toEqual([{ day: "2026-10-20", visits: 2, bookings: 2 }]);
    expect(await visitDays(t.db, w.shopId, "2026-10-19", "2026-10-21", { staffAccountId: noeAccount.id })).toEqual([{ day: "2026-10-20", visits: 1, bookings: 1 }]);
  });
});

describe("the walker's calendar", () => {
  it("counts the visits of each local day of a range, cancelled ones excluded, a day with none absent", async () => {
    const { w } = await walked("calendar");
    expect(await visitDays(t.db, w.shopId, "2026-10-19", "2026-10-21")).toEqual([{ day: "2026-10-20", visits: 1, bookings: 2 }]);
    expect(await visitDays(t.db, w.shopId, "2026-10-21", "2026-10-25")).toEqual([]);
    const other = await walkerShop(t.db, "calendar-other");
    expect(await visitDays(t.db, other.shopId, "2026-10-19", "2026-10-21")).toEqual([]);
  });

  it("refuses a range that is not days in order, or longer than a quarter", async () => {
    const w = await walkerShop(t.db, "calendar-range");
    expect(await code(visitDays(t.db, w.shopId, "2026-10-21", "2026-10-19"))).toBe("AK_RANGE_INVALID");
    expect(await code(visitDays(t.db, w.shopId, "2026-01-01", "2026-12-31"))).toBe("AK_RANGE_INVALID");
  });
});

describe("the visit report", () => {
  it("needs a finished visit, a note, and a photo that really is an image", async () => {
    const { w, appointmentId, rex } = await walked("report");
    expect(await code(saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Bien marché" }))).toBe("AK_VISIT_NOT_DONE");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    expect(await code(saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "   " }))).toBe("AK_NOTE_INVALID");
    expect(await code(saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "ok", photo: { bytes: Buffer.from("<svg onload=alert(1)>") } }))).toBe("AK_PHOTO_INVALID");
    expect(await code(saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "ok", photo: { bytes: Buffer.concat([JPEG, Buffer.alloc(1_600_000)]) } }))).toBe("AK_PHOTO_TOO_LARGE");
    expect(await code(saveReport(t.db, { shopId: "00000000-0000-4000-8000-000000000000", bookingId: rex, note: "ok" }))).toBe("AK_BOOKING_UNKNOWN");
    const first = await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Rex a bien marché, pipi ✓", photo: { bytes: JPEG } });
    expect(first.created).toBe(true);
    const again = await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Rex a très bien marché" });
    expect(again).toEqual({ reportId: first.reportId, created: false });
    const [row] = await t.db.select().from(visitReports).where(eq(visitReports.id, first.reportId));
    expect(row).toMatchObject({ note: "Rex a très bien marché", durationMinutes: 108, photoType: "jpeg" }); // the photo is kept when none is sent
    expect(await refusal(t.db.update(visitReports).set({ photoType: "gif" as never }).where(eq(visitReports.id, first.reportId)))).toMatch(/visit_reports_photo_type/);
  });

  it("makes a private link that opens the report and the photo, expires, and is replaced by the next one", async () => {
    const { w, appointmentId, rex } = await walked("link");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    const { reportId } = await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Superbe sortie", photo: { bytes: JPEG } });
    const ctx = await issueReportLink(t.db, w.shopId, rex, NOW);
    expect(ctx).toMatchObject({ to: "camille-link@example.test", dependantName: "Rex", shopName: "Pattes de Saint-Henri", language: "fr", hasPhoto: true, durationMinutes: 108 });
    expect(ctx.token).toMatch(/^rp1\.[A-Za-z0-9_-]{43}$/);
    const seen = await reportByToken(t.db, ctx.token, NOW);
    expect(seen).toMatchObject({ id: reportId, note: "Superbe sortie", dependantName: "Rex", startsAt: "2026-10-20T13:00:00.000Z" });
    expect((await reportPhoto(t.db, { token: ctx.token, now: NOW }))?.type).toBe("jpeg");
    expect(await reportByToken(t.db, ctx.token, new Date("2026-12-01T00:00:00Z"))).toBeNull(); // 30 days
    expect(await reportByToken(t.db, "rp1.not-a-token", NOW)).toBeNull();
    const next = await issueReportLink(t.db, w.shopId, rex, NOW);
    expect(await reportByToken(t.db, ctx.token, NOW)).toBeNull(); // the earlier link stopped working
    expect(await reportByToken(t.db, next.token, NOW)).not.toBeNull();
    // The client who owns the booking reads it too; nobody else does.
    expect((await reportForClient(t.db, w.camille.clientId, reportId))?.note).toBe("Superbe sortie");
    expect(await reportForClient(t.db, w.jordan.clientId, reportId)).toBeNull();
    expect(await reportPhoto(t.db, { clientId: w.jordan.clientId, reportId })).toBeNull();
    expect((await reportPhoto(t.db, { clientId: w.camille.clientId, reportId }))?.bytes.equals(JPEG)).toBe(true);
    const mine = await clientBookings(t.db, w.camille.clientId);
    expect(mine[0]).toMatchObject({ dependantName: "Rex", status: "booked", visitStatus: "done", report: { id: reportId } });
  });

  it("sends nothing to a client who withdrew the service consent or erased their file (Loi 25)", async () => {
    const { w, appointmentId, rex, luna } = await walked("consent");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "ok" });
    await saveReport(t.db, { shopId: w.shopId, bookingId: luna, note: "ok" });
    await recordConsent(t.db, w.camille.clientId, "service", false, "2026-10-17");
    expect(await code(issueReportLink(t.db, w.shopId, rex, NOW))).toBe("AK_NO_CONSENT");
    await eraseClient(t.db, w.jordan.clientId, "2026-10-17");
    expect(await code(issueReportLink(t.db, w.shopId, luna, NOW))).toBe("AK_CLIENT_UNREACHABLE");
  });
});

describe("outgoing mail", () => {
  it("queues the rendered mail, stays pending while unconfigured, then is marked sent with its report", async () => {
    const { w, appointmentId, rex } = await walked("mail");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    const { reportId } = await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "ok" });
    const id = await enqueueMail(t.db, { to: "camille-mail@example.test", locale: "fr", template: "walk-report", subject: "Rex", html: "<p>x</p>", text: "x", relatedKind: "visit_report", relatedId: reportId });
    expect((await pendingMail(t.db)).map((m) => m.id)).toContain(id);
    await markMailAttempt(t.db, id, "MAIL_NOT_CONFIGURED", 5);
    const [pending] = await t.db.select().from(mailOutbox).where(eq(mailOutbox.id, id));
    expect(pending).toMatchObject({ status: "pending", attempts: 1, lastError: "MAIL_NOT_CONFIGURED" });
    await markMailSent(t.db, id, NOW);
    const [sent] = await t.db.select().from(mailOutbox).where(eq(mailOutbox.id, id));
    expect(sent!.status).toBe("sent");
    const [report] = await t.db.select().from(visitReports).where(eq(visitReports.id, reportId));
    expect(report!.sentAt?.toISOString()).toBe(NOW.toISOString());
    for (let i = 0; i < 4; i++) await markMailAttempt(t.db, id, "boom", 2);
    expect((await t.db.select().from(mailOutbox).where(eq(mailOutbox.id, id)))[0]!.status).toBe("failed");
  });
});

describe("Loi 25 — access and erasure", () => {
  it("exports everything held about a client, access notes opened, photos included", async () => {
    const { w, appointmentId, rex } = await walked("export");
    const key = randomBytes(32);
    await setAccessNotes(t.db, key, w.camille.clientId, "Code 1234");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Belle sortie", photo: { bytes: JPEG } });
    const data = await exportClient(t.db, key, w.camille.clientId);
    expect(data.file).toMatchObject({ fullName: "Camille Tremblay", email: "camille-export@example.test", accessNotes: "Code 1234" });
    expect(data.dependants).toEqual([{ kind: "dog", name: "Rex", profile: { breed: "Labrador", size: "large" } }]);
    expect(data.consents.map((c) => c.purpose)).toEqual(["service", "reminders"]);
    expect(data.bookings[0]).toMatchObject({ dependant: "Rex", report: { note: "Belle sortie", durationMinutes: 108 } });
    expect(Buffer.from(data.photos[0]!.base64, "base64").equals(JPEG)).toBe(true);
    // Not another client's data.
    expect(JSON.stringify(data)).not.toContain("Luna");
  });

  it("erases the file, the dogs, the notes, the photos and the mails — and keeps the invoices tax law requires", async () => {
    const { w, appointmentId, rex, luna } = await walked("erase");
    const key = randomBytes(32);
    await setAccessNotes(t.db, key, w.camille.clientId, "Code 1234");
    await checkIn(t.db, w.shopId, appointmentId, start);
    await checkOut(t.db, w.shopId, appointmentId, afterWalk);
    const { reportId } = await saveReport(t.db, { shopId: w.shopId, bookingId: rex, note: "Belle sortie", photo: { bytes: JPEG } });
    await saveReport(t.db, { shopId: w.shopId, bookingId: luna, note: "Luna aussi" });
    await enqueueMail(t.db, { to: "camille-erase@example.test", locale: "fr", template: "walk-report", subject: "Rex", html: "<p>Rex</p>", text: "Rex", relatedKind: "visit_report", relatedId: reportId });
    const invoice = await issueInvoice(t.db, { shopId: w.shopId, clientId: w.camille.clientId, language: "fr", issuedOn: "2026-10-20", lines: [{ description: "Promenade en groupe", quantity: 1, unitPriceCents: 2_000, category: "standard" }] });
    expect(await eraseClient(t.db, w.camille.clientId, "2026-10-17")).toBe(true);
    expect(await eraseClient(t.db, w.camille.clientId, "2026-10-17")).toBe(false);
    expect(await code(revealAccessNotes(t.db, key, w.camille.clientId))).toBeNull(); // nothing left to open
    expect(await revealAccessNotes(t.db, key, w.camille.clientId)).toBeNull();
    const [dog] = await t.db.select().from(dependants).where(eq(dependants.id, w.camille.dogId));
    expect(dog).toMatchObject({ name: "—", profile: {} });
    expect(dog!.erasedAt).not.toBeNull();
    const [report] = await t.db.select().from(visitReports).where(eq(visitReports.id, reportId));
    expect(report).toMatchObject({ note: "—", photo: null, photoType: null, sentAt: null });
    expect(await t.db.select().from(mailOutbox).where(eq(mailOutbox.relatedId, reportId))).toHaveLength(0);
    expect(await reportForClient(t.db, w.camille.clientId, reportId)).toMatchObject({ note: "—" });
    // The invoice stays; the other client's data is untouched.
    expect(invoice.invoice.number).toBe("F-00001");
    const leftover = await t.db.execute(sql`SELECT count(*)::int AS n FROM invoices WHERE client_id = ${w.camille.clientId}`);
    expect((leftover.rows[0] as { n: number }).n).toBe(1);
    expect((await shopClients(t.db, w.shopId)).map((c) => c.fullName)).toEqual(["Jordan Lee"]);
    const [other] = await t.db.select().from(visitReports).where(eq(visitReports.bookingId, luna));
    expect(other!.note).toBe("Luna aussi");
    await expect(exportClient(t.db, key, w.camille.clientId)).rejects.toThrow();
  });
});
