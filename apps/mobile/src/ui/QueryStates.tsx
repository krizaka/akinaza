import { Button, EmptyState, ErrorState, LoadingState } from "@krizaka/ui/native";
import * as React from "react";

import { useI18n } from "@/i18n";

/** What a screen needs of a query to tell its three states. */
export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/**
 * The three states of a screen (D8, as the web's D6): **loading** — the beaver says what is read; **error** — in place, with
 * « Réessayer »; **empty** — what will fill it. The content renders only with data, never over an error.
 */
export function QueryStates<T>({ query, isEmpty, empty, children }: Readonly<{ query: QueryLike<T>; isEmpty?: (data: T) => boolean; empty?: { title: string; description?: string; action?: React.ReactNode }; children: (data: T) => React.ReactNode }>) {
  const { t } = useI18n();
  if (query.isError) return <ErrorState bird="beaver" title={t("common.offline")} action={<Button variant="secondary" label={t("common.retry")} onPress={() => void query.refetch()} />} />;
  if (query.isPending || query.data === undefined) return <LoadingState bird="beaver" title={t("common.loading")} />;
  if (empty && isEmpty?.(query.data)) return <EmptyState title={empty.title} description={empty.description} action={empty.action} />;
  return <>{children(query.data)}</>;
}
