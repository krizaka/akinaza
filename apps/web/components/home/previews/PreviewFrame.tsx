import type { ReactNode } from "react";

/**
 * A feature card's picture: a real component drawn with demo data. It is decoration for the eye, not a control: `inert` and
 * `aria-hidden`, with the text alternative read instead; a fixed box (no layout shift) cut by a soft fade at the bottom.
 */
export function PreviewFrame({ alt, demo, children }: Readonly<{ alt: string; demo: string; children: ReactNode }>) {
  return (
    <figure className="relative m-0 h-72 w-full overflow-hidden rounded-lg border border-border-default bg-surface-1">
      <figcaption className="sr-only">{alt}</figcaption>
      <div aria-hidden="true" {...{ inert: true }} className="pointer-events-none h-full w-full select-none p-3 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
        {children}
      </div>
      <span aria-hidden="true" className="absolute right-2 top-2 rounded-full border border-border-default bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted">
        {demo}
      </span>
    </figure>
  );
}
