import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { SignInForm } from "./SignInForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

describe("sign-in offers the password reset, in both languages (krizaka/akinaza#299)", () => {
  it("« Mot de passe oublié ? » leads to the reset page of the same language", () => {
    const html = renderIn("fr", "professional", <SignInForm next="/fr/app" />);
    expect(html).toContain('href="/fr/forgot-password"');
    expect(html).toContain("Mot de passe oublié ?");
  });

  it("« Forgot your password? » in English", () => {
    const html = renderIn("en", "professional", <SignInForm next="/en/app" />);
    expect(html).toContain('href="/en/forgot-password"');
    expect(html).toContain("Forgot your password?");
  });
});
