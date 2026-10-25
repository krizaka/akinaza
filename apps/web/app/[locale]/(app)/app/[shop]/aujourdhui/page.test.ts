import { type ShopRole, todayBoard } from "@akinaza/db";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { memberShop } from "@/lib/member-shop";

import Today from "./page";

vi.mock("@akinaza/db", async (importOriginal) => ({ ...await importOriginal<typeof import("@akinaza/db")>(), todayBoard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/member-shop", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/member-shop")>(), memberShop: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Today's board: the shop's money for who may see the invoices (D4)", () => {
  const page = async (role: ShopRole, businessType = "professional", period?: string) => {
    vi.mocked(memberShop).mockResolvedValue({
      session: { account: { id: "a1" } },
      shop: { id: "s1", businessType, timezone: "America/Toronto" },
      role,
    } as Awaited<ReturnType<typeof memberShop>>);
    // The page decides who sees the invoices and returns the day's element with them (or null): nothing below it is rendered here.
    return (await Today({ params: Promise.resolve({ locale: "en", shop: "s1" }), searchParams: Promise.resolve({ day: "2026-09-01", period }) })) as ReactElement<{ board?: unknown; period?: number }>;
  };

  it.each([
    ["owner", "professional"],
    ["manager", "professional"],
    ["owner", "pets"],
    ["manager", "pets"],
  ] as const)("loads the board for a %s in a %s shop, on the shop's current day", async (role, businessType) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T02:00:00Z"));
    const board = { week: 0 } as Awaited<ReturnType<typeof todayBoard>>;
    vi.mocked(todayBoard).mockResolvedValue(board);
    const day = await page(role, businessType);
    expect(memberShop).toHaveBeenCalledWith("s1", "agenda");
    expect(todayBoard).toHaveBeenCalledExactlyOnceWith(db(), "s1", { day: "2026-10-22", period: 7 });
    expect(day.props).toMatchObject({ board, period: 7 });
  });

  it("reads the period from the address, and falls back to 7 days for anything else", async () => {
    vi.mocked(todayBoard).mockResolvedValue({ week: 0 } as Awaited<ReturnType<typeof todayBoard>>);
    expect((await page("owner", "professional", "30")).props.period).toBe(30);
    expect((await page("owner", "professional", "365")).props.period).toBe(7);
  });

  it.each(["professional", "pets"])("does not load or show the board to staff in a %s shop", async (businessType) => {
    const day = await page("staff", businessType);
    expect(todayBoard).not.toHaveBeenCalled();
    expect(day.props.board ?? null).toBeNull();
  });
});
