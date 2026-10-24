/** A line's quantity as the server accepts it (`invoiceInputSchema`): 0.01 to 10 000, at most two decimals. */
// @fixed: the server's bounds for a line's quantity, shown here so the screen refuses before it sends
const MAX_QUANTITY = 10_000;

export function parseQuantity(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(value) || value < 0.01 || value > MAX_QUANTITY) return null;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? value : null;
}
