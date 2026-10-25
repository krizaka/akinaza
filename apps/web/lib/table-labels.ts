"use client";

import type { DataTableLabels } from "@krizaka/ui/data-table";
import { useMemo } from "react";

import { useSay } from "./i18n-client";

/**
 * Every word of @krizaka/ui's DataTable in the screen's language, from the messages (`table.*`): its defaults are English
 * until krizaka-ui#595 localises them, and a French list must never show « Filter the table » or « 5 rows ».
 */
export function useTableLabels(): DataTableLabels {
  const { say } = useSay();
  return useMemo(
    () => ({
      selectAll: say("table.selectAll"),
      selectRow: (name) => say("table.selectRow", { name }),
      loading: say("table.loading"),
      empty: say("table.empty"),
      details: say("table.details"),
      expandRow: (name) => say("table.expandRow", { name }),
      group: (value, count) => say("table.group", { value, count }),
      resize: (header) => say("table.resize", { header }),
      results: (count) => say(count === 1 ? "table.result" : "table.results", { count }),
      filters: say("table.filters"),
      clearFilters: say("table.clearFilters"),
      removeFilter: (label) => say("table.removeFilter", { label }),
      activeFilter: (header, value) => say("table.activeFilter", { header, value }),
      search: (header) => say("table.search", { header }),
      rangeFrom: (header) => say("table.rangeFrom", { header }),
      rangeTo: (header) => say("table.rangeTo", { header }),
      columns: say("table.columns"),
      showMore: (name) => say("table.showMore", { name }),
      export: say("table.export"),
      pagination: {
        nav: say("table.pagination.nav"),
        previous: say("table.pagination.previous"),
        next: say("table.pagination.next"),
        page: (page) => say("table.pagination.page", { page }),
        compact: (page, pageCount) => say("table.pagination.compact", { page, pageCount }),
        pageSize: say("table.pagination.pageSize"),
      },
    }),
    [say],
  );
}
