import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { AddressPreview, TermForm, TermItem } from "./SlugHoldsView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// Built from pieces: the pattern the page must refuse, kept out of the static analysers' sight as a regular expression.
const NESTED_QUANTIFIER = ["/(", "a+", ")+$/"].join("");
const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const wrap = (node: React.ReactNode, locale: "en" | "fr" = "en") => renderToStaticMarkup(<I18nProvider locale={locale} messages={MESSAGES[locale] as never}>{node}</I18nProvider>);
const form = (initial: string, locale: "en" | "fr" = "en") => wrap(<TermForm label="Add" submit="Add" initial={initial} busy={false} onSubmit={async () => true} />, locale);

describe("the protected terms form checks the line where it is typed (ADR-005, #537)", () => {
  it("accepts a word and a safe pattern: the hint, no error, the button enabled", () => {
    for (const line of ["paypal", "/^pay.?pal$/"]) {
      const html = form(line);
      expect(html).not.toContain('role="alert"');
      expect(html).toContain("A word (login) or a pattern between slashes");
      expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    }
  });

  it("shows why a pattern is refused, in the page's language, and disables the button", () => {
    const unsafe = form(NESTED_QUANTIFIER);
    expect(unsafe).toContain('role="alert"');
    expect(unsafe).toContain("could take very long");
    expect(unsafe).toContain("aria-invalid");
    expect(unsafe).toMatch(/<button[^>]*\sdisabled=""/);
    expect(form("/(/")).toContain("not a valid regular expression");
    expect(form("two words")).toContain("letters, digits and hyphens");
    expect(form(NESTED_QUANTIFIER, "fr")).toContain("très long");
  });

  it("lists a stored line that cannot be kept with its reason, and a comment without an edit button", () => {
    const bad = wrap(<TermItem row={{ index: 4, text: NESTED_QUANTIFIER, kind: "pattern", issue: "unsafe" }} busy={false} onEdit={async () => true} onRemove={() => undefined} />);
    expect(bad).toContain("could take very long");
    expect(bad).toContain("Edit");
    const comment = wrap(<TermItem row={{ index: 0, text: "# brands", kind: "comment" }} busy={false} onEdit={async () => true} onRemove={() => undefined} />);
    expect(comment).not.toContain("Edit");
    expect(comment).toContain("Remove");
  });
});

describe("the address preview marks the term that matched", () => {
  it("wraps the matched part and shows the shop domain", () => {
    const html = renderToStaticMarkup(<AddressPreview slug="mon-login-page" term="login" />);
    expect(html).toContain("mon-");
    expect(html).toContain(">login</mark>");
    expect(html).toContain(".akinaza.shop");
  });

  it("shows the plain address when the term cannot be located (a pattern, or a look-alike)", () => {
    expect(renderToStaticMarkup(<AddressPreview slug="l0gin-page" term="login" />)).not.toContain("<mark");
  });
});
