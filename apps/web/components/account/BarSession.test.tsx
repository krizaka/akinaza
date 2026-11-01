import { QueryClient, QueryClientProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { BarActionsView, type BarWords, Island, ME_KEY, settleSignOut } from "./BarSession";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("next/link", () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: React.ReactNode }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/en" }));

const wordsOf = (c: typeof en): BarWords => ({ signIn: c.chrome.signIn, tryIt: c.chrome.tryIt, openApp: c.chrome.openApp, account: c.chrome.account, settings: c.chrome.settings, subscription: c.chrome.subscription, language: c.chrome.languageLabel, theme: c.chrome.themeToggle, signOut: c.chrome.signOut });
const render = (me: Parameters<typeof BarActionsView>[0]["me"], locale: "en" | "fr" = "en", placement: "bar" | "panel" = "bar") =>
  renderToStaticMarkup(<BarActionsView me={me} locale={locale} words={wordsOf(locale === "en" ? en : (fr as typeof en))} placement={placement} onSignOut={() => undefined} />);
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the public bar knows who is there (krizaka/akinaza#255)", () => {
  it("the signed-out actions carry data-signed-out-only, so html[data-session] hides them from the first paint (krizaka-ui#827)", () => {
    for (const placement of ["bar", "panel"] as const) {
      const html = render({ signedIn: false, signupOpen: true }, "en", placement);
      expect(html).toMatch(/<a[^>]*data-signed-out-only[^>]*href="\/en\/sign-in"|<a[^>]*href="\/en\/sign-in"[^>]*data-signed-out-only/);
    }
  });
  it("signed out, sign-up closed: « Sign in » is the action, no sales call", () => {
    const html = render({ signedIn: false, signupOpen: false });
    expect(text(html)).toContain("Sign in");
    expect(text(html)).not.toContain("Open the app");
    expect(text(html)).not.toMatch(/Talk to us|Contact us/);
    expect(html).toContain('href="/en/sign-in"');
  });

  it("signed out, sign-up open: « Try Folioviv » leads to sign-up", () => {
    const html = render({ signedIn: false, signupOpen: true });
    expect(text(html)).toContain("Try Folioviv");
    expect(html).toContain('href="/en/sign-up"');
  });

  it("signed in: the avatar menu is the one entry (no second « Open the app »), never « Sign in »", () => {
    const html = render({ signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: null } });
    expect(html).toContain('aria-label="Account"');
    expect(text(html)).not.toContain("Open the app");
    expect(text(html)).not.toContain("Sign in");
  });

  it("signed in: the bar never prints an e-mail", () => {
    const html = render({ signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: null } });
    expect(html).not.toContain("camille@example.com");
  });

  it("the avatar menu is in the bar at every width (never inside the phone's panel), « Open the app » also in the panel", () => {
    const me = { signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: null } };
    const bar = render(me, "en", "bar");
    expect(bar).toContain('aria-label="Account"');
    expect(bar).not.toContain("camille@example.com");
    expect(bar.match(/<[^>]*aria-label="Account"[^>]*>/)![0]).not.toMatch(/class="[^"]*(^|[\s"])(max-\w+:)?hidden\b/);
    const panel = render(me, "en", "panel");
    expect(panel).not.toContain('aria-label="Account"');
    expect(text(panel)).toContain("Open the app");
    // The production CSP upgrades insecure requests: a prefetch of /app would go to https on a plain-http server and fail (check:hydration).
    expect(panel).toContain('data-prefetch="false"');
  });

  it("speaks French from the catalogue, in the phone's panel too", () => {
    const html = render({ signedIn: true, signupOpen: false, account: { name: null, email: "c@example.com", avatarSeed: null } }, "fr", "panel");
    expect(text(html)).toContain("Ouvrir l&#x27;app");
    expect(html).toContain('href="/fr/app"');
    expect(text(render({ signedIn: false, signupOpen: false }, "fr"))).toContain("Se connecter");
  });

  it("no « Talk to us » word is left in the bar's catalogue", () => {
    expect(Object.keys(en.chrome)).not.toContain("talk");
    expect(Object.keys(fr.chrome)).not.toContain("talk");
  });

  it("after a sign-out the bar is the signed-out one AND the page's server components render again, so the hero follows the session (#300 review)", () => {
    const calls: string[] = [];
    const queryClient = { setQueryData: vi.fn((_key: unknown, value: unknown): void => void calls.push(`data:${JSON.stringify(value)}`)) };
    const router = { refresh: vi.fn(() => calls.push("refresh")) };
    settleSignOut(queryClient as unknown as Parameters<typeof settleSignOut>[0], router, true);
    expect(queryClient.setQueryData).toHaveBeenCalledWith(ME_KEY, { signedIn: false, signupOpen: true });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['data:{"signedIn":false,"signupOpen":true}', "refresh"]);
  });
});

describe("the bar's first render matches the session (krizaka-ui#800)", () => {
  const island = (prime?: (client: QueryClient) => void) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    prime?.(client);
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Island locale="en" words={wordsOf(en)} placement="bar" />
      </QueryClientProvider>,
    );
  };

  it("the session is not known yet: neither « Sign in » nor the avatar (a signed-in person never sees « Sign in » flash)", () => {
    const html = island();
    expect(html).toContain('data-session="pending"');
    expect(text(html)).not.toContain("Sign in");
    expect(html).not.toContain('aria-label="Account"');
  });

  it("the session is known and signed in: the very first render is the avatar menu", () => {
    const html = island((c) => c.setQueryData(ME_KEY, { signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: null } }));
    expect(html).toContain('aria-label="Account"');
    expect(text(html)).not.toContain("Sign in");
  });

  it("the session is known and signed out: the very first render is « Sign in »", () => {
    const html = island((c) => c.setQueryData(ME_KEY, { signedIn: false, signupOpen: false }));
    expect(text(html)).toContain("Sign in");
    expect(html).not.toContain('aria-label="Account"');
  });
});
