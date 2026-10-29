"use client";

import { krizakaFetch, QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { sessionKey, useNavSession } from "@krizaka/ui/nav-bar";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { type AccountMenuWords,AkinazaAccountMenu } from "@/components/account/AkinazaAccountMenu";
import { SignedOutActions } from "@/components/account/SignedOutActions";
import type { Me } from "@/lib/me";

export const ME_ENDPOINT = "/api/me";
/** The bar reads the family's one session query (`@krizaka/ui/nav-bar`), so a hero or a closing call that reads it never disagrees (krizaka-ui#800). */
export const ME_KEY = sessionKey(ME_ENDPOINT);
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

/**
 * Once the sign-out request settles: the bar is the signed-out one, and the page's server components render again (the hero follows
 * the session), so the route is refreshed too — the query cache alone leaves the server-rendered hero on its old state.
 */
export function settleSignOut(queryClient: Pick<QueryClient, "setQueryData">, router: { refresh: () => void }, signupOpen: boolean): void {
  queryClient.setQueryData(ME_KEY, { ...SIGNED_OUT, signupOpen });
  router.refresh();
}

/** The bar's actions for a state we know: pure, so each state is tested without a network. */
export function BarActionsView({ me, locale, words, placement, onSignOut }: Readonly<{ me: Me; locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel"; onSignOut: () => void }>) {
  if (me.signedIn && me.account) {
    return (
      <>
        {/* The bar has the account menu only (one entry, no second « Open the app »); the phone's panel has no menu, so it keeps the action. */}
        {placement === "panel" ? (
          <Button asChild variant="primary" size="md" className="mt-2 font-bold">
            <Link href={`/${locale}/app`}>{words.openApp}</Link>
          </Button>
        ) : (
          <AkinazaAccountMenu locale={locale} accountId={me.account.id} name={me.account.name} avatarSeed={me.account.avatarSeed} settingsHref={`/${locale}/app/profile`} words={words} onSignOut={onSignOut} />
        )}
      </>
    );
  }
  return <SignedOutActions locale={locale} placement={placement} signupOpen={me.signupOpen} signIn={words.signIn} tryIt={words.tryIt} />;
}

export function Island({ locale, words, placement }: Readonly<{ locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel" }>) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = useNavSession<NonNullable<Me["account"]>>(ME_ENDPOINT);
  const signupOpen = session.status === "pending" ? false : session.signupOpen;
  const signOut = useMutation({
    mutationFn: () => krizakaFetch("/api/auth/sign-out", { method: "POST" }),
    onSettled: () => settleSignOut(queryClient, router, signupOpen),
  });
  // The public page stays static and never waits for the session; until the answer comes the bar reserves its place and draws NEITHER
  // state (a signed-in person never sees « Sign in » flash), and a failed refetch keeps the last known state (krizaka-ui#800).
  if (session.status === "pending") return <span data-testid="bar-session" data-session="pending" aria-hidden="true" className="inline-block h-9 min-w-24" />;
  const me: Me = session.status === "in" ? { signedIn: true, signupOpen, account: session.account } : { signedIn: false, signupOpen };
  return <BarActionsView me={me} locale={locale} words={words} placement={placement} onSignOut={() => signOut.mutate()} />;
}

/** The public bar's account state: « Sign in » / « Try Akinaza », or « Open the app » and the avatar when a session is open. */
export function BarSession(props: Readonly<{ locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel" }>) {
  return (
    <QueryClientProvider client={barClient()}>
      <Island {...props} />
    </QueryClientProvider>
  );
}
