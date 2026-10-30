"use client";

import { useSessionHint } from "@krizaka/ui/nav-bar";
import { lazy, Suspense, useSyncExternalStore } from "react";

import type { BarWords } from "@/components/account/BarSession";
import { SignedOutActions } from "@/components/account/SignedOutActions";

// The session island (the account menu, the query client, the schema of `/api/me`) is a chunk of its own: it is fetched once the page has loaded, never in the way of the first screen.
const BarSession = lazy(() => import("@/components/account/BarSession").then((m) => ({ default: m.BarSession })));

const subscribeLoad = (notify: () => void) => {
  window.addEventListener("load", notify);
  return () => window.removeEventListener("load", notify);
};
const loaded = () => document.readyState === "complete";

/**
 * The public bar's account state for a visitor who may have a session. Until the page has loaded (and always on the server) it is the signed-out bar —
 * what the island showed before its answer came — so the first screen carries no script of the session and nothing moves when the answer arrives.
 */
export function LazyBarSession(props: { locale: "en" | "fr"; words: BarWords; placement: "bar" | "panel" }) {
  const ready = useSyncExternalStore(subscribeLoad, loaded, () => false);
  // With the proxy's hint (a session exists, krizaka-ui#827) the reserved place is the account's own size: « Sign in » never shows for an instant.
  const hinted = useSessionHint();
  const waiting = hinted ? <span data-testid="bar-session" data-session="pending" data-hint="signed-in" aria-hidden="true" className="inline-block size-9 rounded-full bg-surface-2" /> : <SignedOutActions locale={props.locale} placement={props.placement} signupOpen={false} signIn={props.words.signIn} tryIt={props.words.tryIt} />;
  return ready ? <Suspense fallback={waiting}><BarSession {...props} /></Suspense> : waiting;
}
