import type { PageLocale, SourceLocale } from "./shop-translations";

/**
 * Translation is Orazaka's job, never Akinaza's (AGENTS section 2, epic #161): this port is the only door. Nothing here names a model or a vendor;
 * the adapter (`orazaka.ts`) calls the Orazaka Studio `text-translation` and answers with the run that made the texts.
 */
export interface TranslationRequest {
  from: SourceLocale;
  to: PageLocale;
  /** Words that stay as they are in every language: the shop's name, its service names, its street address. */
  glossary: readonly string[];
  /** The texts to translate, by key (`kind:refId:field`). Nothing else about the shop or its clients is sent. */
  texts: readonly { key: string; text: string }[];
}

export interface TranslationResult {
  /** The Orazaka run that produced the texts (kept with each translation: where it came from). */
  runId: string;
  texts: readonly { key: string; text: string }[];
}

export interface TranslationPort {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

/** The port cannot answer (not wired, Studio down, credits out): the owner sees a plain message, nothing is stored. */
export class TranslationUnavailable extends Error {
  constructor(readonly reason: "not-wired" | "failed") {
    super(`TRANSLATION_UNAVAILABLE: ${reason}`);
  }
}
