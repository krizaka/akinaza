import { listInvoices, type ShopRole } from "@akinaza/db";
import { Children, isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TodayInvoices } from "@/components/app/TodayInvoices";
import { db } from "@/lib/db";
import { memberShop } from "@/lib/member-shop";

import Today from "./page";

vi.mock("@akinaza/db", async (importOriginal) => ({ ...await importOriginal<typeof import("@akinaza/db")>(), listInvoices: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/member-shop", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/member-shop")>(), memberShop: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Today invoice permissions", () => {
  const page = async (role: ShopRole, businessType = "professional") => {
    vi.mocked(memberShop).mockResolvedValue({
      session: { account: { id: "a1" } },
      shop: { id: "s1", businessType, timezone: "America/Toronto" },
      role,
    } as Awaited<ReturnType<typeof memberShop>>);
    const result = await Today({ params: Promise.resolve({ locale: "en", shop: "s1" }), searchParams: Promise.resolve({ day: "2026-09-01" }) });
    return Children.toArray(result.props.children).filter(isValidElement) as ReactElement[];
  };

  it.each([
    ["owner", "professional"],
    ["manager", "professional"],
    ["owner", "pets"],
    ["manager", "pets"],
  ] as const)("loads the shop's invoices for a %s in a %s shop, using the shop's current day", async (role, businessType) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T02:00:00Z"));
    vi.mocked(listInvoices).mockResolvedValue([]);
    const children = await page(role, businessType);
    expect(memberShop).toHaveBeenCalledWith("s1", "agenda");
    expect(listInvoices).toHaveBeenCalledExactlyOnceWith(db(), "s1");
    expect(children.find((child) => child.type === TodayInvoices)?.props).toMatchObject({ invoices: [], shopId: "s1", today: "2026-10-22" });
  });

  it.each(["professional", "pets"])("does not load or show invoices to staff in a %s shop", async (businessType) => {
    const children = await page("staff", businessType);
    expect(listInvoices).not.toHaveBeenCalled();
    expect(children.some((child) => child.type === TodayInvoices)).toBe(false);
  });
});
