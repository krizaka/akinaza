import type { PublicShop } from "@akinaza/db";
import type { CommunityView } from "@akinaza/db";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildCommunity } from "@/lib/community-view";
import { buildStorefront } from "@/lib/storefront";

import { Storefront } from "./Storefront";

const NOW = new Date("2026-10-19T10:30:00-04:00");
const TODAY = "2026-10-19";
const RULES = { minCount: 5, prior: 4.2, weight: 5 };
const ON = { wall: true, reels: true, announcements: true, reviews: true };

const shop: PublicShop = {
  shop: { id: "s", name: "Salon Cèdre & Ciseaux", slug: "cedre", timezone: "America/Toronto", registrant: true, taglineFr: null, taglineEn: "Cuts.", area: null, bioFr: null, bioEn: null, publicPhone: "", publicEmail: "", ownerName: "Maëlle", seatUnitFr: null, seatUnitEn: null },
  zones: [],
  services: [{ id: "cut", nameFr: "Coupe", nameEn: "Cut", durationMinutes: 45, priceCents: 4_500, capacity: 1, descriptionFr: null, descriptionEn: null, includedFr: [], includedEn: [], priceVaries: false }],
  windows: [],
  daysOff: [],
  rules: { cancellationHours: 24, bookingHorizonDays: 30 },
  media: { cover: null, gallery: [] },
  team: [],
  popularServiceId: null,
  languages: { source: "fr", enabled: ["fr", "en"] },
  translations: [],
} as unknown as PublicShop;

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const reel = (over: Partial<CommunityView["reels"][number]>): CommunityView["reels"][number] => ({ id: "r1", kind: "upload", mp4Url: "https://cdn.test/reel.mp4", webmUrl: "https://cdn.test/reel.webm", posterUrl: "https://cdn.test/poster.webp", seconds: 7, platform: null, externalUrl: null, embedUrl: null, titleFr: "La semaine", titleEn: "A week", createdAt: at("2026-10-10"), ...over });
const review = (i: number, rating = 5): CommunityView["reviews"][number] => ({ id: `v${i}`, firstName: "Camille", lastInitial: "T", rating, body: `Super ${i}`, serviceName: "Cut", reply: i === 0 ? "Merci!" : "", createdAt: at("2026-10-01"), verified: true, state: "published" });

function community(over: Partial<CommunityView> = {}): CommunityView {
  const reels = over.reels ?? [reel({}), reel({ id: "r0", kind: "external", mp4Url: null, platform: "youtube-shorts", externalUrl: "https://www.youtube.com/shorts/sOpin6X2--0", createdAt: at("2026-10-05") })];
  return {
    wall: { texture: "brick", items: [
      { id: "p1", kind: "polaroid", x: 5, y: 5, rotation: -2, z: 1, attachment: "tape", imageUrl: "https://cdn.test/a.webp", altFr: "Un fauteuil", altEn: "A chair", captionFr: "Le fauteuil", captionEn: "The chair" },
      { id: "n1", kind: "note", x: 50, y: 5, rotation: 1, z: 2, attachment: "pin", textFr: "Merci", textEn: "Thanks", signature: "Maëlle" },
      { id: "s1", kind: "sign", x: 70, y: 5, rotation: 0, z: 3, variant: "enamel" },
    ] },
    reel: reels[0] ?? null,
    reels,
    links: { instagram: "https://www.instagram.com/cedre", tiktok: "https://www.tiktok.com/@cedre" },
    announcements: [{ id: "a1", shopId: "s", textFr: "Portes ouvertes", textEn: "Open house", photoUrl: null, photoAlt: "", endsOn: null, createdAt: at("2026-10-12") }] as unknown as CommunityView["announcements"],
    reviews: [0, 1, 2, 3, 4, 5].map((i) => review(i)),
    ...over,
  };
}

const html = (c: CommunityView, enabled = ON, locale: "fr" | "en" = "en") => {
  const placed = buildCommunity({ community: c, locale, today: TODAY, rules: RULES, enabled });
  return renderToStaticMarkup(<Storefront locale={locale} view={buildStorefront({ page: shop, locale, now: NOW, community: placed, enabledUpcomingSections: enabled })} />);
};

describe("the shop as a place on the public page", () => {
  const page = html(community());
  it("draws the wall as a real list with its photo, card and sign, the sign as live text", () => {
    expect(page).toContain('id="wall"');
    expect(page).toContain("A chair");
    expect(page).toContain("Thanks");
    expect(page).toContain("Salon Cèdre &amp; Ciseaux");
  });
  it("plays the shop's own latest video in the television", () => {
    // The player arrives after hydration; the page holds its box with the poster.
    expect(page).toContain("data-tv-frame");
    expect(page).toContain("poster.webp");
  });
  it("keeps another channel's video behind a facade: no iframe and no request to the platform in the markup", () => {
    expect(page).not.toContain("<iframe");
    expect(page).not.toMatch(/src="https:\/\/(www\.)?(youtube|youtube-nocookie|tiktok|instagram)\./);
    expect(page).toContain("Load YouTube and play");
  });
  it("lists the profile links as plain anchors that carry no referrer", () => {
    expect(page).toMatch(/<a [^>]*href="https:\/\/www\.instagram\.com\/cedre"[^>]*rel="noopener noreferrer nofollow"/);
    expect(page).toMatch(/referrerPolicy="no-referrer"/i);
  });
  it("shows the bulletin board and the verified score with its text equivalent", () => {
    expect(page).toContain("data-bulletin");
    expect(page).toContain("Open house");
    expect(page).toContain("4.6 out of 5, 6 verified reviews");
    expect(page).toContain("Merci!");
  });
  it("speaks French on a French page", () => {
    const fr = html(community(), ON, "fr");
    expect(fr).toContain("6 avis vérifiés");
    expect(fr).toContain("Charger YouTube et lire");
  });
});

describe("what is not there is not drawn", () => {
  it("shows no reviews section under the administrator's minimum", () => {
    const few = html(community({ reviews: [review(0), review(1)] }));
    expect(few).not.toContain('id="reviews"');
  });
  it("shows no wall, board or videos on an empty shop, and no review of a switched-off feature", () => {
    const empty = html(community({ wall: { texture: "plaster", items: [] }, reel: null, reels: [], links: {}, announcements: [], reviews: [] }));
    for (const id of ["wall", "reels", "announcements", "reviews"]) expect(empty).not.toContain(`id="${id}"`);
    const off = html(community(), { wall: false, reels: false, announcements: false, reviews: false });
    for (const id of ["wall", "reels", "announcements", "reviews"]) expect(off).not.toContain(`id="${id}"`);
  });
  it("puts the television in the videos section when the wall is switched off", () => {
    const noWall = html(community(), { ...ON, wall: false });
    expect(noWall).not.toContain('id="wall"');
    expect(noWall).toContain('id="reels"');
    expect(noWall).toContain("data-tv-frame");
  });
  it("hides a flyer after its last day and keeps three at most", () => {
    const old = html(community({ announcements: [{ id: "a1", textFr: "Vieux", textEn: "Old news", photoUrl: null, photoAlt: "", endsOn: "2026-10-01", createdAt: at("2026-09-01") }] as unknown as CommunityView["announcements"] }));
    expect(old).not.toContain("Old news");
    const four = ["a", "b", "c", "d"].map((x, i) => ({ id: x, textFr: x, textEn: `Flyer ${x}`, photoUrl: null, photoAlt: "", endsOn: null, createdAt: at(`2026-10-0${i + 1}`) }));
    const many = html(community({ announcements: four as unknown as CommunityView["announcements"] }));
    expect(many).toContain("Flyer d");
    expect(many).not.toContain("Flyer a");
  });
  it("lists a hidden review nowhere (the public projection carries published ones only)", () => {
    const placed = buildCommunity({ community: community({ reviews: [...[0, 1, 2, 3, 4].map((i) => review(i)), { ...review(9), state: "hidden_by_owner", body: "Secret" }] }), locale: "en", today: TODAY, rules: RULES, enabled: ON });
    expect(JSON.stringify(placed)).not.toContain("Secret");
  });
});
