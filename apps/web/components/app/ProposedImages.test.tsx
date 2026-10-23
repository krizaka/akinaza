import { defaultShopPageConfig } from "@akinaza/db";
import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { ProposedImages, type ProposedImagesData } from "./ProposedImages";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/s1/shop" }));

const proposal = (id: string) => ({ id, src: `https://cdn.test/${id}.webp`, altFr: `Description ${id}`, altEn: `Alt ${id}` });
const data = (over: Partial<ProposedImagesData> = {}): ProposedImagesData => ({
  config: { ...defaultShopPageConfig(), shopType: null, useDefaults: true },
  shopType: "pets",
  proposals: {
    pets: { cover: { ...proposal("pets-cover-1"), webm: "https://cdn.test/l.webm", mp4: "https://cdn.test/l.mp4" }, gallery: [1, 2, 3, 4].map((n) => proposal(`pets-gallery-${n}`)) },
    salon: { cover: null, gallery: [] },
  },
  media: { cover: null, gallery: [] },
  ...over,
});
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const render = (d: ProposedImagesData, locale: "en" | "fr" = "en") => renderIn(locale, "pets", <ProposedImages data={d} />);

describe("« Images proposées » in the editor (#267)", () => {
  it("offers the trade, the switch, the proposed cover with its loop and the photos, each one click away", () => {
    const html = render(data());
    const t = text(html);
    for (const word of ["Proposed images", "Your trade", "Show proposed images where I have none", "Use as my cover", "Add to my photos"]) expect(t).toContain(word);
    expect(html.match(/Add to my photos/g)).toHaveLength(4);
    expect(html).toContain("l.webm");
    expect(html).toContain("l.mp4");
    expect(html).toContain('poster="https://cdn.test/pets-cover-1.webp"');
  });

  it("the preview plays only when the owner asks: native controls, no autoplay, still under reduced motion", () => {
    const html = render(data());
    expect(html).toMatch(/<video[^>]*\scontrols/);
    expect(html).not.toMatch(/<video[^>]*\sautoplay/i);
  });

  it("a trade the administrator does not offer stays visible but disabled, so choosing an offered one is a change", () => {
    const html = render(data({ shopType: "consulting" }));
    expect(html).toMatch(/<option value="consulting" disabled[^>]*>Professional services<\/option>/);
    expect(html).toMatch(/<option value="pets"[^>]*>Pet care<\/option>/);
    expect(render(data())).not.toMatch(/<option[^>]*\sdisabled/);
  });

  it("says they are neutral pictures, not the shop, and describes each in the language of the page", () => {
    expect(text(render(data()))).toContain("They are neutral pictures, not your shop");
    expect(render(data())).toContain('alt="Alt pets-gallery-1"');
    expect(render(data(), "fr")).toContain('alt="Description pets-gallery-1"');
    expect(text(render(data(), "fr"))).toContain("Images proposées");
  });

  it("lists only the trades the administrator offers, by name", () => {
    const html = render(data());
    expect(html).toContain("Pet care");
    expect(html).toContain("Salon (hair, beauty)");
    expect(html).not.toContain("Cleaning");
  });

  it("the switch shows the owner's choice", () => {
    expect(render(data({ config: { ...defaultShopPageConfig(), useDefaults: false } }))).toContain('aria-checked="false"');
    expect(render(data())).toContain('aria-checked="true"');
  });
});
