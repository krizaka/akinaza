"use client";

import { krizakaFetch, useQuery } from "@krizaka/query";
import { Command, CommandDialog } from "@krizaka/ui/command";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSay } from "@/lib/i18n-client";
import { isPaletteShortcut, type PaletteFound, type PaletteItem, paletteItems } from "@/lib/palette";
import { shopRoutes } from "@/lib/routes";

// @fixed: one letter matches half the files; two say what the person is after
const MIN_QUERY = 2;
const GROUPS = ["clients", "invoices", "actions"] as const;

/**
 * The header's search palette (B2, the family's top bar). The frame draws the trigger (`AppFrame`'s `search`) and holds `open`; ⌘K / Ctrl+K opens the palette anywhere in the shop's space; it searches the shop's own client
 * files and invoices (`/api/walker/search`, the shop's guard) and lists the actions. Enter opens the option; Escape closes and
 * the focus returns to where it was (the dialog's).
 */
export function ShopSearch({ locale, shopId, actions, open, onOpenChange }: { locale: "en" | "fr"; shopId: string; actions: readonly PaletteItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { say } = useSay();
  const router = useRouter();
  const routes = shopRoutes(locale, shopId);
  const [query, setQuery] = useState("");
  const q = query.trim();
  const found = useQuery({
    queryKey: ["shop-search", shopId, q],
    queryFn: ({ signal }) => krizakaFetch(routes.api(`/api/walker/search?q=${encodeURIComponent(q)}`), { signal }) as Promise<PaletteFound>,
    enabled: open && q.length >= MIN_QUERY,
    staleTime: 30_000,
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      e.preventDefault();
      onOpenChange(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  const items = paletteItems(q.length >= MIN_QUERY ? found.data : undefined, routes, actions, q);
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) setQuery("");
        }}
        label={say("shell.search.label")}
        shouldFilter={false}
      >
        <Command.Input placeholder={say("shell.search.placeholder")} value={query} onValueChange={setQuery} />
        <Command.List label={say("shell.search.results")} emptyLabel={q.length >= MIN_QUERY && !found.isFetching && items.length === 0 ? say("shell.search.none") : undefined}>
          {found.isFetching ? <Command.Loading label={say("shell.search.loading")} /> : null}
          {GROUPS.map((group) => {
            const options = items.filter((i) => i.group === group);
            return options.length ? (
              <Command.Group key={group} heading={say(`shell.search.groups.${group}`)}>
                {options.map((item) => (
                  <Command.Item key={item.id} value={item.id} onSelect={() => go(item.href)}>
                    <span className={item.group === "invoices" ? "font-mono tabular-nums" : undefined}>{item.label}</span>
                    {item.hint ? <span className="ml-2 truncate text-fg-muted">{item.hint}</span> : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null;
          })}
        </Command.List>
      </CommandDialog>
    </>
  );
}
