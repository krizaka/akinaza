// @vitest-environment jsdom
import { KrizakaQueryProvider } from "@krizaka/query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { avatarOptions } from "@/lib/avatar";
import { bindProduct } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n-client";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { ProfileSettings, type ProfileView } from "./ProfileSettings";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/profile" }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  // jsdom has no ResizeObserver (Radix measures the radios with it).
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
});

const PROFILE: ProfileView = { id: "a-1", email: "camille@example.test", name: "Camille", avatarSeed: null, emailVerified: true, pendingEmail: null, memberSince: null, role: "Member" };

let root: Root | null = null;
let host: HTMLElement | null = null;
async function mount(locale: "en" | "fr") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <I18nProvider locale={locale} messages={{ console: (locale === "en" ? en : fr).console } as never}>
        <KrizakaQueryProvider>
          <ProfileSettings profile={PROFILE} />
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
  });
  return host;
}
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

/** The accessible name of a control, the way a screen reader computes it: aria-labelledby, aria-label, a <label>, its text, its title. */
function nameOf(el: Element): string {
  const by = el.getAttribute("aria-labelledby");
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
  const label = el.getAttribute("aria-label")?.trim();
  if (label) return label;
  const id = el.getAttribute("id");
  const labelled = (id ? document.querySelector(`label[for="${id}"]`) : null) ?? el.closest("label");
  return (labelled?.textContent ?? el.textContent ?? el.getAttribute("title") ?? "").trim();
}

describe("the profile's controls all have an accessible name (akinaza#440)", () => {
  it.each(["en", "fr"] as const)("in %s: the name field, the six pictures and what mirrors them for the form, the e-mail change, the save", async (locale) => {
    const page = await mount(locale);
    const controls = [...page.querySelectorAll("input:not([type=hidden]), button, select, textarea")];
    expect(controls.length).toBeGreaterThanOrEqual(8);
    const unnamed = controls.filter((c) => !nameOf(c)).map((c) => c.outerHTML.slice(0, 90));
    expect(unnamed).toEqual([]);
  });

  it("names each of the org's person pictures once, in the group the picture row is named after", async () => {
    const page = await mount("en");
    const group = page.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe(en.console.account.avatar.label);
    const tiles = [...group.querySelectorAll('button[role="radio"]')];
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual(avatarOptions("en").map((o) => o.label));
    const mirrors = [...page.querySelectorAll('input[type="radio"]')];
    expect(mirrors.map((m) => m.getAttribute("aria-label"))).toEqual(tiles.map((t) => t.getAttribute("aria-label")));
  });

  it("labels the name field with its row", async () => {
    const page = await mount("fr");
    expect(nameOf(page.querySelector("#account-name")!)).toBe(fr.console.account.name.label);
  });
});
