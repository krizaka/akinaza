import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { BarActionsView, type BarWords } from "./BarSession";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/en" }));

const wordsOf = (c: typeof en): BarWords => ({ signIn: c.chrome.signIn, tryIt: c.chrome.tryIt, openApp: c.chrome.openApp, account: c.chrome.account, settings: c.chrome.settings, language: c.chrome.languageLabel, theme: c.chrome.themeToggle, signOut: c.chrome.signOut });
const render = (me: Parameters<typeof BarActionsView>[0]["me"], locale: "en" | "fr" = "en", placement: "bar" | "panel" = "bar") =>
  renderToStaticMarkup(<BarActionsView me={me} locale={locale} words={wordsOf(locale === "en" ? en : (fr as typeof en))} placement={placement} onSignOut={() => undefined} />);
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the public bar knows who is there (krizaka/akinaza#255)", () => {
  it("signed out, sign-up closed: « Sign in » is the action, no sales call", () => {
    const html = render({ signedIn: false, signupOpen: false });
    expect(text(html)).toContain("Sign in");
    expect(text(html)).not.toContain("Open the app");
    expect(text(html)).not.toMatch(/Talk to us|Contact us/);
    expect(html).toContain('href="/en/sign-in"');
  });

  it("signed out, sign-up open: « Try Akinaza » leads to sign-up", () => {
    const html = render({ signedIn: false, signupOpen: true });
    expect(text(html)).toContain("Try Akinaza");
    expect(html).toContain('href="/en/sign-up"');
  });

  it("signed in: « Open the app » into the app and the avatar menu, not « Sign in »", () => {
    const html = render({ signedIn: true, signupOpen: false, account: { name: "Camille", email: "camille@example.com", avatarSeed: null } });
    expect(text(html)).toContain("Open the app");
    expect(html).toContain('href="/en/app"');
    expect(html).toContain('aria-label="Account"');
    expect(text(html)).not.toContain("Sign in");
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
});
