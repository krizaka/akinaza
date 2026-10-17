"use client";

import { krizakaFetch } from "@krizaka/query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

/**
 * A call to the BFF from a button: busy while it runs, the refusal in words (the server's stable code, translated), and
 * the page re-read from the server after a success so every card shows what is now true.
 */
export function useCall() {
  const { say } = useSay();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useCallback(
    async <T = unknown>(path: string, init: { method?: string; json?: unknown; body?: BodyInit } = {}, options: { refresh?: boolean } = {}): Promise<T | null> => {
      setPending(true);
      setProblem(null);
      try {
        const result = (await krizakaFetch(path, { method: init.method ?? "POST", ...(init.json !== undefined ? { json: init.json } : {}), ...(init.body ? { body: init.body } : {}) })) as T;
        if (options.refresh !== false) router.refresh();
        return result;
      } catch (error) {
        setProblem(say(`errors.${errorKey(error)}`));
        return null;
      } finally {
        setPending(false);
      }
    },
    [router, say],
  );
  return { run, pending, problem, clear: () => setProblem(null) };
}
