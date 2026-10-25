import { clientOverview } from "@akinaza/db";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { memberShop } from "@/lib/member-shop";

import Clients from "./page";

vi.mock("@akinaza/db", async (importOriginal) => ({ ...(await importOriginal<typeof import("@akinaza/db")>()), clientOverview: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/member-shop", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/member-shop")>()), memberShop: vi.fn() }));

describe("Clients without a client (D6): the beaver's empty state", () => {
  it("shows the beaver at 120 px and says what will fill the list", async () => {
    vi.mocked(memberShop).mockResolvedValue({ session: { account: { id: "a1" } }, shop: { id: "s1", timezone: "America/Toronto" }, role: "owner" } as Awaited<ReturnType<typeof memberShop>>);
    vi.mocked(clientOverview).mockResolvedValue([]);
    const html = renderToStaticMarkup(await Clients({ params: Promise.resolve({ locale: "fr", shop: "s1" }), searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/width="120"|size-\[120px\]|120px/);
    expect(html).toContain("clients");
  });
});
