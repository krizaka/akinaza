"use client";

import { krizakaFetch, QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { ProductBarActions } from "@krizaka/ui/nav-bar";
import Link from "next/link";

import { type AccountMenuWords,AkinazaAccountMenu } from "@/components/account/AkinazaAccountMenu";
import { type Me, meSchema } from "@/lib/me";

export const ME_KEY = ["me"] as const;
const SIGNED_OUT: Me = { signedIn: false, signupOpen: false };

/**
 * One client per browser tab for the bar's two places (the bar and the phone's panel): one request answers both. Created on
 * first use in the browser, never at module load: a module-level client would be shared by every request the server renders.
 */
let browserClient: QueryClient | undefined;
function barClient(): QueryClient {
  const make = () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: true } } });
  if (typeof window === "undefined") return make();
  return (browserClient ??= make());
}

export interface BarWords extends AccountMenuWords {
  signIn: string;
  tryIt: string;
  openApp: string;
}

/** The bar's actions for a state we know: pure, so each state is tested without a network. */
export function BarActionsView({ me, locale, words, placement, onSignOut }: { me: Me; locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel"; onSignOut: () => void }) {
  if (me.signedIn && me.account) {
    return (
      <>
        {/* The bar has the account menu only (one entry, no second « Open the app »); the phone's panel has no menu, so it keeps the action. */}
        {placement === "panel" ? (
          <Button asChild variant="primary" size="md" className="mt-2 font-bold">
            <Link href={`/${locale}/app`}>{words.openApp}</Link>
          </Button>
        ) : (
          <AkinazaAccountMenu locale={locale} name={me.account.name} avatarSeed={me.account.avatarSeed} settingsHref={`/${locale}/app/profile`} words={words} onSignOut={onSignOut} />
        )}
      </>
    );
  }
  return <ProductBarActions placement={placement} signupOpen={me.signupOpen} linkAs={Link} signIn={{ href: `/${locale}/sign-in`, label: words.signIn }} tryIt={{ href: `/${locale}/sign-up`, label: words.tryIt }} />;
}

function Island({ locale, words, placement }: { locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel" }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ME_KEY, queryFn: () => krizakaFetch("/api/me", { schema: meSchema }) });
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => queryClient.setQueryData(ME_KEY, { ...SIGNED_OUT, signupOpen: data?.signupOpen ?? false }),
  });
  // Until the answer comes the bar is the signed-out one: the public page stays static and never waits for the session.
  return <BarActionsView me={data ?? SIGNED_OUT} locale={locale} words={words} placement={placement} onSignOut={() => signOut.mutate()} />;
}

/** The public bar's account state: « Sign in » / « Try Akinaza », or « Open the app » and the avatar when a session is open. */
export function BarSession(props: { locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel" }) {
  return (
    <QueryClientProvider client={barClient()}>
      <Island {...props} />
    </QueryClientProvider>
  );
}
