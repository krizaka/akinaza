import { invoiceMailSettings, listInvoices } from "@akinaza/db";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { memberShop } from "@/lib/member-shop";

import Invoices from "./page";

vi.mock("@akinaza/db", async (importOriginal) => ({ ...(await importOriginal<typeof import("@akinaza/db")>()), listInvoices: vi.fn(), invoiceMailSettings: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/member-shop", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/member-shop")>()), memberShop: vi.fn() }));

describe("Factures without an invoice (D6): the beaver's empty state, what will fill it, one way forward", () => {
  it("shows the beaver at 120 px, says what will fill the list and leads to a new invoice", async () => {
    vi.mocked(memberShop).mockResolvedValue({ session: { account: { id: "a1" } }, shop: { id: "s1", timezone: "America/Toronto" }, role: "owner" } as Awaited<ReturnType<typeof memberShop>>);
    vi.mocked(listInvoices).mockResolvedValue([]);
    vi.mocked(invoiceMailSettings).mockResolvedValue(null as never);
    const html = renderToStaticMarkup(await Invoices({ params: Promise.resolve({ locale: "fr", shop: "s1" }) }));
    expect(html).toMatch(/width="120"|size-\[120px\]|120px/);
    expect(html).toContain("Aucune facture pour l");
    expect(html).toContain('href="/fr/app/s1/invoices/new"');
  });
});
