"use client";

import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";

/** A section that failed to load (D6): said in place, with « Réessayer » — the page is read again; the rest keeps working. */
export function SectionError({ what }: Readonly<{ what?: string }>) {
  const { say } = useSay();
  const router = useRouter();
  return (
    <Alert tone="danger" title={say("states.error.title")} action={<Button size="sm" variant="secondary" onClick={() => router.refresh()}>{say("states.retry")}</Button>}>
      {what ?? say("states.error.body")}
    </Alert>
  );
}
