import { exportAppointments, exportClients, exportInvoices } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { refuse } from "@/lib/http";
import { resetRateLimits } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

import { GET } from "./route";

vi.mock("@/lib/access", async (original) => ({ ...(await original<typeof import("@/lib/access")>()), requireShop: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), exportAppointments: vi.fn(), exportClients: vi.fn(), exportInvoices: vi.fn() }));

async function* batches<T>(...all: T[][]): AsyncGenerator<T[]> {
  for (const b of all) yield b;
}
const appointment = (n: number) => ({ id: `a${n}`, startsAt: new Date(`2026-11-2${n}T15:00:00Z`), endsAt: new Date(`2026-11-2${n}T15:45:00Z`), status: "booked" as const, serviceFr: "Coupe", serviceEn: "Haircut", staff: "Julie", client: "=HYPERLINK(\"x\")", priceCents: 3800 });
const get = (file: string, query = "") => GET(new Request(`http://localhost/api/walker/exports/${file}${query}`), { params: Promise.resolve({ file }) });
const asOwner = () => vi.mocked(requireShop).mockResolvedValue({ role: "owner", shop: { id: "s1", name: "Salon Laurier", timezone: "America/Toronto" }, session: { account: { id: "acc", email: "o@example.com" } } } as never);

describe("the owner's data exports (#420)", () => {
  beforeEach(() => {
    resetRateLimits();
    asOwner();
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => true) } as never);
    vi.mocked(exportAppointments).mockReturnValue(batches([appointment(1)], [appointment(2)]));
    vi.mocked(exportClients).mockReturnValue(batches([{ id: "c1", fullName: "Camille Tremblay", email: "c@example.test", phone: "514", language: "fr" as const, createdAt: new Date("2026-10-01T12:00:00Z"), dependants: ["Rex", "Minou"] }]));
    vi.mocked(exportInvoices).mockReturnValue(batches([{ id: "i1", number: "AKI-00001", issuedOn: "2026-10-01", dueOn: "2026-10-31", language: "fr" as const, creditOf: null, client: "Camille Tremblay", subtotalCents: 3800, gstCents: 190, qstCents: 379, totalCents: 4369, paidCents: 4369, superseded: false }]));
  });
  afterEach(() => vi.clearAllMocks());

  it("streams the appointments as a CSV in the shop's clock, with the header in the asked language, and audits it", async () => {
    const res = await get("appointments.csv", "?locale=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain('attachment; filename="akinaza-appointments.csv"');
    expect(res.headers.get("cache-control")).toContain("no-store");
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await res.text();
    expect(text.startsWith("Id,Start,End,Status,Service,Staff,Client,Price\r\n")).toBe(true);
    expect(text).toContain("a1,2026-11-21 10:00,2026-11-21 10:45,Booked,Haircut,Julie,");
    expect(text.trim().split("\r\n")).toHaveLength(3);
    expect(requireShop).toHaveBeenCalledWith(expect.anything(), "privacy");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.data_exported", targetId: "s1", detail: { kind: "appointments", format: "csv" } }));
  });

  it("never lets a client's name run as a spreadsheet formula", async () => {
    const text = await (await get("appointments.csv")).text();
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(text).not.toMatch(/,=HYPERLINK/);
  });

  it("serves the appointments as an iCalendar file", async () => {
    const res = await get("appointments.ics", "?locale=fr");
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const text = await res.text();
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toContain("UID:a1@akinaza.com");
    expect(text).toContain("DTSTART:20261121T150000Z");
    expect(text).toContain("SUMMARY:Coupe");
  });

  it("serves the clients and the invoices as CSV, in French", async () => {
    const clients = await (await get("clients.csv", "?locale=fr")).text();
    expect(clients).toContain("Id,Nom,Courriel,Téléphone,Langue,Client depuis,Dépendants\r\n");
    expect(clients).toContain("c1,Camille Tremblay,c@example.test,514,fr,2026-10-01,Rex; Minou\r\n");
    const invoices = await (await get("invoices.csv", "?locale=fr")).text();
    expect(invoices).toContain("Numéro,Émise le,Échéance,Client,Sous-total,TPS,TVQ,Total,Payé,Note de crédit de,État,Langue\r\n");
    expect(invoices).toContain("AKI-00001,2026-10-01,2026-10-31,Camille Tremblay,38.00,1.90,3.79,43.69,43.69,,Payée,fr\r\n");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ detail: { kind: "invoices", format: "csv" } }));
  });

  it("is the owner's only: a role without the privacy permission reads and audits nothing", async () => {
    vi.mocked(requireShop).mockRejectedValue(refuse(403, "FORBIDDEN", "Your role does not allow this"));
    expect((await get("clients.csv")).status).toBe(403);
    expect(exportClients).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("answers 404 to a file that does not exist, and 403 when the administrator switched it off", async () => {
    expect((await get("../secrets.csv")).status).toBe(404);
    expect((await get("access-notes.csv")).status).toBe(404);
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => false) } as never);
    expect((await get("clients.csv")).status).toBe(403);
    expect(audit).not.toHaveBeenCalled();
  });
});
