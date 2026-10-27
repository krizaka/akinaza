"use client";

import { PageError } from "@/components/app/PageError";

/** A page of the signed-in space (or the shop's layout above it) failed: the settle pattern, never the error's own words (`PageError`). */
export default function SpaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError reset={reset} />;
}
