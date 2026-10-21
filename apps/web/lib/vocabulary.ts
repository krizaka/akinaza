import type { BusinessType } from "@akinaza/core";

import { getDictionary,type Locale } from "@/lib/i18n";

/**
 * The words of a business type (krizaka/akinaza#117). `console` holds the base words (the pet-care shop's, the first
 * business Akinaza served); `console.vocabularies.<type>` holds, for another type, only the messages that differ, under
 * the same paths. Pure: used by the server (titles, lines), by the client's `useSay` and by the tests.
 */
export interface Tree {
  [key: string]: string | Tree;
}

/** The message at a path (`walker.title`) of a tree, if it is a string. */
export function wordAt(tree: Tree | undefined, key: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** The overlay of a type, or undefined for the base words. */
export const overlayOf = (consoleMessages: Tree, type: BusinessType): Tree | undefined => {
  const all = consoleMessages.vocabularies;
  const overlay = typeof all === "object" ? all[type] : undefined;
  return typeof overlay === "object" ? overlay : undefined;
};

/** Every message of a tree with its dotted path. */
export function entries(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => (typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : entries(value, `${prefix}${key}.`)));
}

/** The console's messages as a business type reads them: the base, with the type's own words over it. */
export function wordsFor(consoleMessages: Tree, type: BusinessType): Tree {
  const base: Tree = Object.fromEntries(Object.entries(consoleMessages).filter(([key]) => key !== "vocabularies"));
  const overlay = overlayOf(consoleMessages, type);
  const merge = (a: Tree, b: Tree | undefined): Tree => {
    if (!b) return a;
    const out: Tree = { ...a };
    for (const [key, value] of Object.entries(b)) {
      const mine = out[key];
      out[key] = typeof value === "string" || typeof mine !== "object" ? value : merge(mine, value);
    }
    return out;
  };
  return merge(base, overlay);
}

/** What a server component reads: the console's messages in the shop's vocabulary. */
export const consoleFor = (locale: Locale, type: BusinessType) => wordsFor(getDictionary(locale).console as unknown as Tree, type) as unknown as ReturnType<typeof getDictionary>["console"];
