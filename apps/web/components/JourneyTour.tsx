"use client";

import { format } from "@krizaka/i18n";
import { type ShowcaseStep, StepShowcase } from "@krizaka/ui/step-showcase";

/**
 * The router's adapter of @krizaka/ui's StepShowcase: the server page passes plain words (a function cannot cross into a
 * client component), this builds the controls' labels. The journey was captured on a phone: a phone frame everywhere.
 */
export function JourneyTour({ label, steps, words }: { label: string; steps: readonly ShowcaseStep[]; words: { play: string; pause: string; step: string } }) {
  const labels = { play: words.play, pause: words.pause, step: (n: number, total: number) => format(words.step, { n, total }) };
  return <StepShowcase label={label} steps={steps} device="phone" labels={labels} />;
}
