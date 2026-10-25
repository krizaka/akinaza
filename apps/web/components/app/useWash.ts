"use client";

import { useState } from "react";

import { changedKeys, signaturesOf } from "@/lib/wash";

/**
 * The rows that changed since the page's previous read (D11): `wash(id)` gives `data-kz-arrive` to put inside the row (its cell:
 * `tr:has([data-kz-arrive])` of motion.css washes the row). The page's first read washes nothing; a row keeps the marker until the
 * next change, so the animation plays once and, under reduced motion, a static marker stays (globals.css). The previous read is
 * kept as React's « information from previous renders » (a state set while rendering), never a ref read during render.
 */
export function useWash<T>(rows: readonly T[], key: (row: T) => string, signature: (row: T) => string) {
  const [seen, setSeen] = useState<{ rows: readonly T[]; changed: ReadonlySet<string> }>(() => ({ rows, changed: new Set() }));
  let changed = seen.changed;
  if (seen.rows !== rows) {
    changed = changedKeys(signaturesOf(seen.rows, key, signature), rows, key, signature);
    setSeen({ rows, changed });
  }
  return (id: string): { "data-kz-arrive"?: "" } => (changed.has(id) ? { "data-kz-arrive": "" } : {});
}
