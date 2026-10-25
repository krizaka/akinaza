"use client";

import { SearchIcon } from "@krizaka/icons";
import { krizakaFetch, useQuery } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { Command, CommandDialog } from "@krizaka/ui/command";
import { Kbd } from "@krizaka/ui/kbd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSay } from "@/lib/i18n-client";
import { isPaletteShortcut, type PaletteFound, type PaletteItem, paletteItems } from "@/lib/palette";
import { shopRoutes } from "@/lib/routes";

// @fixed: one letter matches half the files; two say what the person is after
const MIN_QUERY = 2;
const GROUPS = ["clients", "invoices", "actions"] as const;

/**
 * The header's search (B2, the family's top bar): « Rechercher un client, une facture… » with its ⌘K hint on a desktop, the
 * magnifier alone on a phone. ⌘K / Ctrl+K opens the palette anywhere in the shop's space; it searches the shop's own client
 * files and invoices (`/api/walker/search`, the shop's guard) and lists the actions. Enter opens the option; Escape closes and
 * the focus returns to where it was (the dialog's).
 */
export function ShopSearch({ locale, shopId, actions }: { locale: "en" | "fr"; shopId: string; actions: readonly PaletteItem[] }) {
  const { say } = useSay();
  const router = useRouter();
  const routes = shopRoutes(locale, shopId);
  const [open, setOpen] = useState(false);
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
      setOpen((was) => !was);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const items = paletteItems(q.length >= MIN_QUERY ? found.data : undefined, routes, actions, q);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="max-sm:size-9 max-sm:px-0 sm:w-64 sm:justify-start sm:font-normal sm:text-fg-muted"
        aria-label={say("shell.search.open")}
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
        data-testid="search-trigger"
        onClick={() => setOpen(true)}
      >
        <SearchIcon size={16} aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">{say("shell.search.placeholder")}</span>
        <Kbd size="sm" className="hidden sm:inline-flex" aria-hidden>
          ⌘K
        </Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
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
