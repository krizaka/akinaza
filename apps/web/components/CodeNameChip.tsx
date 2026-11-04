/**
 * The code-name line of a development deployment (« code name: akinaza »): small, mono, under or beside the commercial name. The same
 * markup as `CodeNameLine` of @krizaka/ui; this app draws its own lockup (BrandLockup) to keep the shop pages inside their JavaScript
 * budget, so the line is drawn here once for the lockup and the frames. The words come from `lib/code-name.ts`, the stage from the caller.
 */
export function CodeNameChip({ children, className }: Readonly<{ children: string; className?: string }>) {
  return (
    <span className={`font-mono text-xs text-fg-secondary${className ? ` ${className}` : ""}`} data-code-name="">
      {children}
    </span>
  );
}
