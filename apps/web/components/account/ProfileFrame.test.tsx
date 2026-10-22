import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";

import { ProfileFrame } from "./ProfileFrame";

const account = { id: "a1", email: "eric@example.test" };
const html = (current: "profile" | "security", locale: "en" | "fr" = "fr") => renderToStaticMarkup(<ProfileFrame locale={locale} current={current} account={account}>contenu</ProfileFrame>);

describe("the account frame", () => {
  it("names the owner's role « Propriétaire » in French", () => {
    expect(fr.console.account.profile.roleOwner).toBe("Propriétaire");
  });

  it("gives each section its address and marks the current one", () => {
    const page = html("security");
    expect(page).toContain('href="/fr/app/profile"');
    expect(page).toMatch(/href="\/fr\/app\/profile\/security"[^>]*aria-current="page"/);
    expect(page).not.toMatch(/href="\/fr\/app\/profile"[^>]*aria-current/);
  });

  it("shows who the account is above the sections", () => {
    const page = html("profile", "en");
    expect(page).toContain("eric@example.test");
    expect(page).toContain("Your profile");
  });
});
