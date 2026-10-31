import type { GuestStep } from "@/lib/journey";

/**
 * What the person is about to book, said before the button (krizaka-internal#1910): the time, with whom, the price with its taxes
 * and the cancellation rule. One component for the visitor and the signed-in client, so the two paths cannot drift apart.
 */
export function BookingSummary({ step, words }: Readonly<{ step: GuestStep; words: { when: string; who: string; price: string } }>) {
  return (
    <>
      <dl data-booking-summary="" data-guest-summary="" className="m-0 grid max-w-2xl gap-x-6 gap-y-1 text-fg sm:grid-cols-[max-content_1fr]">
        <dt className="text-fg-secondary">{words.when}</dt>
        <dd className="m-0">{step.when}</dd>
        {step.who ? (
          <>
            <dt className="text-fg-secondary">{words.who}</dt>
            <dd className="m-0">{step.who}</dd>
          </>
        ) : null}
        <dt className="text-fg-secondary">{words.price}</dt>
        <dd className="m-0" data-booking-price="">{step.taxLine ?? step.price}</dd>
      </dl>
      <p data-guest-cancel-rule="" data-booking-cancel-rule="" className="m-0 max-w-2xl text-fg-secondary">{step.cancelRule}</p>
    </>
  );
}
