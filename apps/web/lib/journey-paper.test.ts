import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JourneySkeleton } from "@/components/journey/JourneyFrame";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

/** The booking journey wears a thin paper head and nothing else of the notebook (B45, #315). */
describe("the booking journey on paper", () => {
  it("puts the paper head on steps 1, 2 and 4, each saying where the visitor stands", () => {
    expect(read("app/[locale]/s/[slug]/(public)/service/[id]/page.tsx")).toMatch(/head=\{\{ shop: page\.shop\.name, step: t\("console\.journey\.stepOf", \{ step: 1, total: 4/);
    expect(read("app/[locale]/s/[slug]/(public)/service/[id]/slots/page.tsx")).toMatch(/step: 2, total: 4/);
    expect(read("app/[locale]/s/[slug]/service/[id]/confirmation/page.tsx")).toMatch(/step: 4, total: 4/);
  });
  it("presses the « booked » stamp once, on the confirmation of a booking that stands", () => {
    const page = read("app/[locale]/s/[slug]/service/[id]/confirmation/page.tsx");
    expect(page).toContain("data-booked-stamp");
    expect(page).toMatch(/cancelled \? null : <Stamp/);
  });
  it("keeps a skeleton for the head, on the same box, so nothing moves when the step arrives", () => {
    expect(renderToStaticMarkup(JourneySkeleton({ rows: 3 }))).toContain("data-journey-head-skeleton");
  });
  it("brings no wall, tilt, doodle or texture into the journey", () => {
    const frame = read("components/journey/JourneyFrame.tsx");
    for (const word of ["Wall", "Polaroid", "Doodle", "PinnedNote", "paper="]) expect(frame).not.toContain(word);
  });
  it("says every word of the head in both languages", () => {
    for (const j of [en.console.journey, fr.console.journey]) for (const key of ["stepOf", "stepService", "stepTime", "stepBooked", "edit", "bookedStamp"] as const) expect(j[key]).toBeTruthy();
  });
});
