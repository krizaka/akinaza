import { createQueryClient, KrizakaQueryProvider, type QueryClient } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/native";
import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { I18nProvider } from "@/i18n";

import Today from "../../app/[locale]/app/[shop]/aujourdhui";
import Books from "../../app/[locale]/app/[shop]/books";
import Boutique from "../../app/[locale]/app/[shop]/boutique";
import Clients from "../../app/[locale]/app/[shop]/clients";
import Figures from "../../app/[locale]/app/[shop]/figures";
import Invoices from "../../app/[locale]/app/[shop]/invoices/index";
import Home from "../../app/[locale]/app/index";

const SHOP = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

const mockRouter = { navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  usePathname: () => `/fr/app/${SHOP}/aujourdhui`,
  useLocalSearchParams: () => mockParams,
  useGlobalSearchParams: () => ({ ...mockParams, shop: SHOP }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text testID="redirect">{href}</Text>;
  },
}));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));

/** The server, as the screens read it: one function per query, each test says what it answers. */
jest.mock("@/config", () => {
  const api = { day: jest.fn(), calendar: jest.fn(), clients: jest.fn(), invoices: jest.fn(), shop: jest.fn(), books: jest.fn(), figures: jest.fn(), me: jest.fn() };
  const q = (name: keyof typeof api) => (...args: unknown[]) => ({ queryKey: ["akinaza", name, ...args.map((a) => a ?? "-")], queryFn: () => (api[name] as (...a: unknown[]) => unknown)(...args) });
  return {
    api,
    akinaza: { checkIn: jest.fn(), checkOut: jest.fn() },
    webUrl: (path: string) => `https://www.akinaza.com${path}`,
    queries: { day: q("day"), calendar: q("calendar"), clients: q("clients"), invoices: q("invoices"), shop: q("shop"), books: q("books"), figures: q("figures"), me: q("me") },
  };
});
const { api } = jest.requireMock("@/config") as { api: Record<string, jest.Mock> };

const clients: QueryClient[] = [];
function show(node: React.ReactElement) {
  const client = createQueryClient({ staleTime: 0, maxRetries: 0, throwOnError: false, defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(client);
  return render(
    <ThemeProvider>
      <I18nProvider locale="fr">
        <KrizakaQueryProvider client={client}>{node}</KrizakaQueryProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
}

const visit = { appointmentId: "a1", startsAt: "2026-10-20T13:00:00.000Z", endsAt: "2026-10-20T14:00:00.000Z", status: "booked", service: { fr: "Coupe", en: "Haircut", capacity: 1 }, zone: null, checkedInAt: null, checkedOutAt: null, bookings: [] };
const day = (visits: unknown[]) => ({ shopId: SHOP, timezone: "America/Toronto", day: "2026-10-20", visits });

beforeEach(() => {
  mockParams = {};
  for (const fn of Object.values(api)) fn.mockReset();
  api.me!.mockResolvedValue({ name: "Éric", email: "eric@example.test", avatarSeed: null });
  api.calendar!.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  jest.clearAllMocks();
});

describe("the phone app's five tabs, each with its three states (D8)", () => {
  it("opens /fr/app at the shop's own Aujourd'hui, the web's address", async () => {
    api.day!.mockResolvedValue(day([]));
    await show(<Home />);
    expect((await screen.findByTestId("redirect")).props.children).toBe(`/fr/app/${SHOP}/aujourdhui`);
  });

  it("Aujourd'hui: the day strip holds the calendar, the day's visits of the shop of the address, a day pressed goes in the URL", async () => {
    mockParams = { day: "2026-10-20" };
    api.day!.mockResolvedValue(day([visit]));
    await show(<Today />);
    expect(await screen.findByText(/Coupe/)).toBeTruthy();
    expect(api.day).toHaveBeenCalledWith("2026-10-20", SHOP);
    expect(api.calendar).toHaveBeenCalledWith("2026-10-17", "2026-10-30", SHOP);
    expect(screen.getByLabelText("Jour affiché")).toBeTruthy();
  });

  it("Aujourd'hui: a visit opens into its detail in the URL, and the detail begins it", async () => {
    mockParams = { day: "2026-10-20", visit: "a1" };
    api.day!.mockResolvedValue(day([{ ...visit, zone: "Saint-Henri", bookings: [{ bookingId: "b1", clientId: "c1", clientName: "Camille", clientPhone: "514-555-0199", dependant: { name: "Nelson", kind: "dog", profile: null }, hasAccessNotes: false, report: null }] }]));
    await show(<Today />);
    expect(await screen.findByText("Saint-Henri")).toBeTruthy();
    expect(screen.getByText("Nelson · Camille")).toBeTruthy();
    await fireEvent.press(screen.getByText("Commencer"));
    const { akinaza } = jest.requireMock("@/config") as { akinaza: Record<string, jest.Mock> };
    expect(akinaza.checkIn).toHaveBeenCalledWith("a1", SHOP);
  });

  it("Aujourd'hui: pressing a row of the list opens it (visit in the URL)", async () => {
    mockParams = { day: "2026-10-20" };
    api.day!.mockResolvedValue(day([visit]));
    await show(<Today />);
    await fireEvent.press(await screen.findByRole("button", { name: /Coupe/ }));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ visit: "a1" });
  });

  it("Vos chiffres: what to do now and each figure with its meaning, formula and sources; nothing is filed", async () => {
    mockParams = {};
    api.figures!.mockResolvedValue({
      period: { start: "2026-07-01", end: "2026-09-30" },
      figures: [{ id: "invoiced", value: 100_000, unit: "cents", rate: null, formula: [{ label: "invoicesSubtotal", value: 100_000, unit: "cents" }], lexicon: [], sources: [{ kind: "invoice", ids: ["i1"], count: 3 }], period: { start: "2026-07-01", end: "2026-09-30" }, computedAt: "2026-10-20T12:00:00.000Z", cadence: "onChange", staleAfterHours: 24, state: "good" }],
      actions: [{ kind: "chase", urgency: "now", impactCents: 5_000, why: { number: "F-12", days: 9, amountCents: 5_000, others: 0, totalCents: 5_000 }, target: { route: "invoice", invoiceId: "i9" }, evidence: ["i9"] }],
    });
    await show(<Figures />);
    expect(await screen.findByText("Relancer la facture F-12")).toBeTruthy();
    expect(screen.getByText("Facturé")).toBeTruthy();
    expect(screen.getByText("Sur la bonne voie")).toBeTruthy();
    expect(screen.getByText(/3 factures/)).toBeTruthy();
    expect(screen.getByText(/vous produisez vos déclarations vous-même/)).toBeTruthy();
    expect(api.figures).toHaveBeenCalledWith(SHOP);
  });

  it("Vos chiffres: nothing to do says so", async () => {
    api.figures!.mockResolvedValue({ period: { start: "2026-07-01", end: "2026-09-30" }, figures: [], actions: [] });
    await show(<Figures />);
    expect(await screen.findByText("Rien ne vous attend pour l'instant.")).toBeTruthy();
  });

  it("Aujourd'hui: empty says what will fill it", async () => {
    api.day!.mockResolvedValue(day([]));
    await show(<Today />);
    expect(await screen.findByText("Aucune visite ce jour-là.")).toBeTruthy();
    expect(screen.getByText("Les rendez-vous réservés s'affichent ici, jour par jour.")).toBeTruthy();
  });

  it("Aujourd'hui: the error in place with « Réessayer », which reads again", async () => {
    api.day!.mockRejectedValue(new Error("offline"));
    await show(<Today />);
    const retry = await screen.findByRole("button", { name: "Réessayer" });
    expect(screen.getByText("Akinaza ne répond pas. Vérifiez votre connexion.")).toBeTruthy();
    api.day!.mockResolvedValue(day([visit]));
    await fireEvent.press(retry);
    expect(await screen.findByText(/Coupe/)).toBeTruthy();
  });

  it("Clients: the files of the shop, the search in the URL, « Facturer » at the shop's new invoice", async () => {
    api.clients!.mockResolvedValue([{ id: "c1", fullName: "Studio Lumen inc. (démo)", phone: null, email: null, hasNotes: false, dependants: [] }]);
    await show(<Clients />);
    expect(await screen.findByText("Studio Lumen inc. (démo)")).toBeTruthy();
    expect(api.clients).toHaveBeenCalledWith(SHOP);
    await fireEvent.press(screen.getByRole("button", { name: "Facturer" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(`/fr/app/${SHOP}/invoices/new?client=c1`);
  });

  it("Clients: empty says what will fill it", async () => {
    api.clients!.mockResolvedValue([]);
    await show(<Clients />);
    expect(await screen.findByText("Un client qui réserve, ou que vous ajoutez sur le Web, a son dossier ici.")).toBeTruthy();
  });

  it("Factures: the invoices, the one primary « Nouvelle facture » at the shop's address, and the loading state", async () => {
    let answer: (v: unknown) => void = () => undefined;
    api.invoices!.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    await show(<Invoices />);
    expect(await screen.findByText("Chargement…")).toBeTruthy();
    answer([{ id: "i1", number: "F-00001", issuedOn: "2026-10-20", dueOn: null, language: "fr", creditOf: null, subtotalCents: 4500, gstCents: 225, qstCents: 449, totalCents: 5174, client: null }]);
    expect(await screen.findByText("F-00001")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Nouvelle facture" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(`/fr/app/${SHOP}/invoices/new`);
  });

  it("Livres: the period's nets, to remit or to claim, the period in the URL — prepared, never filed", async () => {
    mockParams = { period: "2026-Q3" };
    api.books!.mockResolvedValue({ period: { id: "2026-Q3", start: "2026-07-01", end: "2026-09-30" }, choices: ["2026-Q3", "2026-Q2"], gst: { netCents: 1250, outcome: "remit" }, qst: { netCents: 2494, outcome: "claim" }, preparedOnly: true });
    await show(<Books />);
    expect(await screen.findByText("À remettre")).toBeTruthy();
    expect(screen.getByText("À réclamer")).toBeTruthy();
    expect(api.books).toHaveBeenCalledWith("2026-Q3", SHOP);
    expect(screen.getByText(/vous la vérifiez et la produisez vous-même/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Voir vos chiffres" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(`/fr/app/${SHOP}/figures`);
    await fireEvent.press(screen.getByText("2026 Q2"));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ period: "2026-Q2" });
  });

  it("Boutique: the shop, its tax status, its services; the long forms on the web", async () => {
    api.shop!.mockResolvedValue({ shop: { id: SHOP, name: "Studio Lumen inc. (démo)", registrant: true, timezone: "America/Toronto", paymentTermsDays: 30 }, services: [{ id: "v1", nameFr: "Coupe", nameEn: "Haircut", priceCents: 4500, taxCategory: "standard" }] });
    await show(<Boutique />);
    expect(await screen.findByText("Studio Lumen inc. (démo)")).toBeTruthy();
    expect(screen.getByText("Coupe")).toBeTruthy();
    expect(screen.getByText("Paiement à 30 jours")).toBeTruthy();
    expect(api.shop).toHaveBeenCalledWith(SHOP);
  });
});
