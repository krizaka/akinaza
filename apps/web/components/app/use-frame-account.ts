"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { languagesFor } from "@krizaka/ui/language-switch";
import { usePathname, useRouter } from "next/navigation";

import { avatarOf } from "@/lib/avatar";
import { useSay } from "@/lib/i18n-client";

/**
 * The signed-in person as the shared `AppFrame` wants them (one account menu for the family): the avatar the profile shows, the places
 * under it, the language row and Sign out. The two frames of the app (the shop's space, the administration) read it from here.
 */
export function useFrameAccount({ locale, id, email, name, avatarSeed, profileHref }: { locale: "en" | "fr"; id?: string; email: string; name?: string | null; avatarSeed?: string | null; profileHref: string }) {
  const router = useRouter();
  const { say } = useSay();
  const path = usePathname() ?? `/${locale}`;
  const languages = languagesFor(path);
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => {
      router.replace(`/${locale}/sign-in`);
      router.refresh();
    },
  });
  return {
    path,
    account: {
      // With no name the menu says « Your account » and shows the address as its identity line (CTO, #431 follow-up); the header never prints the address (docs/ux K6).
      name: name || say("shell.yourAccount"),
      email,
      avatar: { defaultAvatar: avatarOf({ id: id ?? email, avatarSeed }), alt: "", fallback: (name ?? email).slice(0, 1).toUpperCase() },
      links: { profile: { href: profileHref } },
      onSignOut: () => signOut.mutate(),
    },
    language: { value: locale, options: languages.map((l) => ({ value: l.code, label: l.name })), onChange: (code: string) => router.push(languages.find((l) => l.code === code)?.href ?? path) },
  };
}
