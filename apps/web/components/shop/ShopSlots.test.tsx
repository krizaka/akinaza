import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DayView } from "@/lib/storefront";

import { ShopSlots } from "./ShopSlots";

const day = (id: string, label: string): DayView => {
  const slot = { id: `${id}T14:00:00.000Z`, label: "10 h", href: `/book?start=${id}` };
  return { id, label, sub: id, slots: [slot], groups: [{ id: "morning", label: "Matin", slots: [slot] }] };
};
const labels = { label: "Heures disponibles", empty: "Aucune heure", previous: "Semaine précédente", today: "Cette semaine", next: "Semaine suivante" };
const render = (days: DayView[]) => renderToStaticMarkup(<ShopSlots days={days} labels={labels} locale="fr-CA" footer="Heures de America/Toronto" />);

describe("the public times by week and by part of the day (SlotPicker, krizaka-ui#672)", () => {
  it("shows the first week with its days, the part of the day, the week buttons and the clock said", () => {
    const html = render([day("2026-10-20", "Mar"), day("2026-10-21", "Mer"), day("2026-10-27", "Mar")]);
    expect(html).toContain("Mar");
    expect(html).toContain("Matin");
    expect(html).toContain("Semaine suivante");
    expect(html).toContain("Semaine précédente");
    expect(html).toContain("Heures de America/Toronto");
    expect(html).toContain('href="/book?start=2026-10-20"');
    expect(html).not.toContain("2026-10-27");
  });

  it("says there is nothing when no day has a free time", () => {
    expect(render([])).toContain("Aucune heure");
  });
});
