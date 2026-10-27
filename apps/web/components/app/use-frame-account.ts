"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { languagesFor } from "@krizaka/ui/language-switch";
import { usePathname, useRouter } from "next/navigation";

import { avatarOf } from "@/lib/avatar";

/**
 * The signed-in person as the shared `AppFrame` wants them (one account menu for the family): the avatar the profile shows, the places
 * under it, the language row and Sign out. The two frames of the app (the shop's space, the administration) read it from here.
 */
export function useFrameAccount({ locale, id, email, name, avatarSeed, profileHref }: { locale: "en" | "fr"; id?: string; email: string; name?: string | null; avatarSeed?: string | null; profileHref: string }) {
  const router = useRouter();
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
      name: name ?? undefined,
      // The address is the identity line of the open menu; with no name the header would print it in the bar (docs/ux K6): it stays out.
      email: name ? email : undefined,
      avatar: { defaultAvatar: avatarOf({ id: id ?? email, avatarSeed }), alt: "", fallback: (name ?? email).slice(0, 1).toUpperCase() },
      links: { profile: { href: profileHref } },
      onSignOut: () => signOut.mutate(),
    },
    language: { value: locale, options: languages.map((l) => ({ value: l.code, label: l.name })), onChange: (code: string) => router.push(languages.find((l) => l.code === code)?.href ?? path) },
  };
}
