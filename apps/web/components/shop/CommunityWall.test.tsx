import { describe, expect, it } from "vitest";

import fr from "../../messages/fr.json";
import { type PlayerWords, tvLabels } from "./CommunityWall";

const frPlayer: PlayerWords = fr.console.shopPage.player;

describe("the television speaks the shop's language", () => {
  it("maps every RetroTv label from the French catalogue", () => {
    expect(tvLabels(frPlayer)).toMatchObject({
      play: "Lire",
      next: "Vidéo suivante",
      previous: "Vidéo précédente",
      nowPlaying: "En cours",
      captions: "Sous-titres",
    });
  });

});
