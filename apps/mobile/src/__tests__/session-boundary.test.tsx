import { createQueryClient, KrizakaQueryProvider, type QueryClient } from "@krizaka/query";
import { ThemeProvider } from "@krizaka/ui/native";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { I18nProvider } from "@/i18n";
import { SessionBoundary } from "@/session-boundary";
import { AppHeader } from "@/ui/AppHeader";

jest.mock("expo-router", () => ({ useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }), usePathname: () => "/fr/app" }));
// The account the server answers, read through the real query client: what the header shows is what the cache holds.
jest.mock("@/config", () => {
  const fetchMe = jest.fn();
  return { fetchMe, queries: { me: () => ({ queryKey: ["akinaza", "me"], queryFn: fetchMe }) } };
});
const { fetchMe } = jest.requireMock("@/config") as { fetchMe: jest.Mock };

/** A session store as the boundary sees it: who listens, and a change to announce (a sign-out, a sign-in, a 401). */
function fakeSession() {
  const listeners = new Set<() => void>();
  return {
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    change() {
      listeners.forEach((listener) => listener());
    },
  };
}

const wrap = (client: QueryClient, session: ReturnType<typeof fakeSession>, node: React.ReactElement) => (
  <ThemeProvider>
    <I18nProvider locale="fr">
      <KrizakaQueryProvider client={client}>
        <SessionBoundary session={session}>{node}</SessionBoundary>
      </KrizakaQueryProvider>
    </I18nProvider>
  </ThemeProvider>
);

describe("one account's data never shows to the next", () => {
  // Each test's client is emptied after its screens are unmounted. Its garbage collection is off (`gcTime: Infinity`): a 5-minute
  // timer per query would otherwise outlive the suite and keep Jest alive. The cache is emptied by the boundary and the teardown.
  const clients: QueryClient[] = [];
  afterEach(() => {
    cleanup();
    for (const client of clients.splice(0)) client.clear();
  });

  it("drops the previous account from the header when the session changes, even when the next account's refresh fails", async () => {
    // The root layout's client: errors stay in the query (`throwOnError={false}`), nothing is retried here, nothing is fresh.
    const client = createQueryClient({ staleTime: 0, maxRetries: 0, throwOnError: false, defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    const session = fakeSession();
    // Mira's identity is cached; every refresh fails (the phone is offline): Query keeps her beside the error.
    client.setQueryData(["akinaza", "me"], { name: "Mira Lavoie", email: "mira@example.test", avatarSeed: null });
    fetchMe.mockRejectedValue(new Error("offline"));
    await render(wrap(client, session, <AppHeader title="Aujourd'hui" />));
    expect(await screen.findByRole("button", { name: "Votre compte : Mira Lavoie" })).toBeTruthy();

    // Mira signs out and the next owner signs in; their `/api/me` fails too. Nothing of Mira may remain on the screen.
    await act(async () => {
      session.change();
    });
    expect(await screen.findByRole("button", { name: "Votre compte" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mira/ })).toBeNull();
    expect(fetchMe.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
