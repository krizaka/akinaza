/**
 * One section's data, settled (D6): its value, or a failure the page shows in place (« Réessayer ») while the rest of the page
 * renders. The error itself is logged by the caller's handler, never shown.
 */
export async function settle<T>(work: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await work };
  } catch (error) {
    console.error("section failed", error instanceof Error ? error.name : "unknown");
    return { ok: false };
  }
}
