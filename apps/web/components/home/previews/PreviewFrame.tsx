import { ChevronDownIcon } from "@krizaka/icons";
import { cn } from "@krizaka/ui/cn";
import type { ReactNode } from "react";

type Step = Readonly<{ label: string; body: ReactNode }>;

/**
 * A feature card's picture (krizaka-internal#683): one useful action and its result, drawn with demo data. The action is
 * quiet, the result is the subject. It is decoration for the eye, not a control: `inert` and `aria-hidden`, with the text
 * alternative read instead. Its height follows its content (nothing is cut); the demo label is the card's own footer row,
 * never laid over the content.
 */
export function PreviewFrame({ alt, demo, action, result }: Readonly<{ alt: string; demo: string; action: Step; result: Step }>) {
  return (
    <figure className="m-0 flex h-full w-full flex-col border border-border-default bg-surface-1">
      <figcaption className="sr-only">{`${alt} (${demo})`}</figcaption>
      <div aria-hidden="true" {...{ inert: true }} className="pointer-events-none flex flex-1 select-none flex-col gap-2 p-4">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-xs text-fg-muted">{action.label}</p>
          <div className="text-sm text-fg-secondary">{action.body}</div>
        </div>
        <ChevronDownIcon size={16} className="self-center text-fg-muted" />
        <div className="flex flex-col gap-1.5 border-l-2 border-accent bg-surface-2 px-3 py-2.5">
          <p className="m-0 text-xs font-semibold text-fg-secondary">{result.label}</p>
          <div className="text-sm text-fg">{result.body}</div>
        </div>
      </div>
      <p aria-hidden="true" className="m-0 border-t border-border-subtle px-4 py-2 text-xs text-fg-muted">
        {demo}
      </p>
    </figure>
  );
}

/** A label and its amount on one line, the amount in tabular figures; `strong` for the line that is the answer. */
export function AmountRow({ label, amount, strong = false }: Readonly<{ label: string; amount: string; strong?: boolean }>) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "border-t border-border-default pt-1.5 text-base font-semibold text-fg")}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </div>
  );
}
