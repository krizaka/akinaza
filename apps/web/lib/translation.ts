import { type TranslationPort, TranslationUnavailable } from "@akinaza/db";

/**
 * The real adapter: the Orazaka Studio `text-translation` (krizaka/orazaka-packs#119), through Orazaka's API, with the credits of its pricebook.
 * The Studio is not merged yet: until it is, the adapter says so (`not-wired`) and the owner's screen says the translation is unavailable;
 * the data, the screen and the routes are complete behind the port. Wire it here and nowhere else.
 */
export const orazakaTranslation: TranslationPort = {
  async translate() {
    throw new TranslationUnavailable("not-wired");
  },
};

/** The port the app uses: the Orazaka adapter. */
export const translationPort = (): TranslationPort => orazakaTranslation;
