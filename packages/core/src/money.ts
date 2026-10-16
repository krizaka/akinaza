/**
 * Money is an integer number of cents — never a float. A rate is an exact fraction (5/100, 9975/100000), and a tax is
 * rounded once, half away from zero, to the cent: 9.975 % of $100.00 is 997.5 ¢ → 998 ¢ ($9.98).
 */
export type Cents = number;

export interface Rate {
  numerator: number;
  denominator: number;
}

/** `base × rate`, rounded half away from zero, in exact integer arithmetic (BigInt — no float ever touches money). */
export function applyRate(base: Cents, rate: Rate): Cents {
  if (!Number.isSafeInteger(base)) throw new RangeError(`not a whole number of cents: ${base}`);
  const sign = base < 0 ? -1n : 1n;
  const n = BigInt(Math.abs(base)) * BigInt(rate.numerator);
  const d = BigInt(rate.denominator);
  return Number(sign * ((2n * n + d) / (2n * d)));
}

/** A whole number of cents from a decimal string (`"19.99"` → 1999), refusing anything that is not exactly money. */
export function parseCents(value: string): Cents {
  const sanitized = value
    .trim()
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(/^\$/, "")
    .replace(/\$$/, "");
  const m = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(sanitized);
  if (!m) throw new RangeError(`not an amount: ${value}`);
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] ? -cents : cents;
}

/** `1999` → `"19.99"` (the display is the web's job, in the reader's locale; this is for files and tests). */
export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
