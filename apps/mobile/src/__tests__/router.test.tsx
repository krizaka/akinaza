import { createQueryClient, KrizakaQueryProvider } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/native";
import { Slot } from "expo-router";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";

import { I18nProvider } from "@/i18n";

import AppLayout from "../../app/[locale]/app/_layout";
import ShopTabs from "../../app/[locale]/app/[shop]/_layout";
import Today from "../../app/[locale]/app/[shop]/aujourdhui";
import Books from "../../app/[locale]/app/[shop]/books";
import Figures from "../../app/[locale]/app/[shop]/figures";

const SHOP = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

jest.mock("@/auth", () => ({ AUTH: { signedOut: "signedOut", signedIn: "signedIn" }, useAuth: () => ({ status: "signedIn" }) }));
jest.mock("expo-linking", () => ({ ...jest.requireActual("expo-linking"), openURL: jest.fn() }));
jest.mock("@/config", () => {
  const api = { day: jest.fn(), calendar: jest.fn(), clients: jest.fn(), invoices: jest.fn(), shop: jest.fn(), books: jest.fn(), figures: jest.fn(), me: jest.fn() };
  const q = (name: keyof typeof api) => (...args: unknown[]) => ({ queryKey: ["akinaza", name, ...args.map((a) => a ?? "-")], queryFn: () => (api[name] as (...a: unknown[]) => unknown)(...args) });
  return {
    api,
    akinaza: {},
    webUrl: (path: string) => `https://www.akinaza.com${path}`,
    queries: { day: q("day"), calendar: q("calendar"), clients: q("clients"), invoices: q("invoices"), shop: q("shop"), books: q("books"), figures: q("figures"), me: q("me") },
  };
});
const { api } = jest.requireMock("@/config") as { api: Record<string, jest.Mock> };

const Provide = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <I18nProvider locale="fr">
      <KrizakaQueryProvider client={createQueryClient({ staleTime: 0, maxRetries: 0, throwOnError: false })}>{children}</KrizakaQueryProvider>
    </I18nProvider>
  </ThemeProvider>
);

// The router, not a mock of it: the shop's tabs must keep « Vos chiffres » as a place of their navigator (#433: undeclared, the router sent the phone back to Aujourd'hui).
it("Livres opens Vos chiffres, and stays there", async () => {
  api.me!.mockResolvedValue({ name: "Éric", email: "e@x.test", avatarSeed: null });
  api.calendar!.mockResolvedValue([]);
  api.day!.mockResolvedValue({ shopId: SHOP, timezone: "America/Toronto", day: "2026-10-20", visits: [] });
  api.books!.mockResolvedValue({ period: { id: "2026-Q3", start: "2026-07-01", end: "2026-09-30" }, choices: ["2026-Q3"], gst: { netCents: 1250, outcome: "remit" }, qst: { netCents: 2494, outcome: "claim" }, preparedOnly: true });
  api.figures!.mockResolvedValue({ period: { start: "2026-10-01", end: "2026-10-31" }, actions: [], figures: [] });
  const Root = () => (
    <Provide>
      <Slot />
    </Provide>
  );
  await renderRouter(
    {
      _layout: Root,
      "[locale]/app/_layout": AppLayout,
      "[locale]/app/[shop]/_layout": ShopTabs,
      "[locale]/app/[shop]/aujourdhui": Today,
      "[locale]/app/[shop]/clients": () => null,
      "[locale]/app/[shop]/invoices/index": () => null,
      "[locale]/app/[shop]/boutique": () => null,
      "[locale]/app/[shop]/books": Books,
      "[locale]/app/[shop]/figures": Figures,
    },
    { initialUrl: `/fr/app/${SHOP}/books` },
  );
  fireEvent.press(await screen.findByText("Voir vos chiffres"));
  expect(await screen.findByText("Vos chiffres")).toBeTruthy();
  expect((screen as unknown as { getPathname(): string }).getPathname()).toBe(`/fr/app/${SHOP}/figures`);
});
