// The composer's layout, measured in a real browser and judged here (krizaka-internal#214: the editor shipped with a phone-width preview and
// radios over their cards, and every pixel baseline accepted it). Pixels do not say « the preview is half the screen »; boxes do.
//
//   measureComposer(page)  runs in the page: the viewport, the desktop preview's box, each radio card with the boxes of what it holds
//   composerLayoutProblems(measure) the problems, in words (empty when the layout is right)
//
// Two interactive elements that share pixels are @krizaka/page-audit's `controlOverlaps` (the journey runs it too).

/** The preview takes at least this share of the viewport's width on a desktop (1440 px). */
export const MIN_PREVIEW_SHARE = 0.5;
/** A box inside another one, to the pixel the browser rounds to. */
const SLACK = 1;

/** Runs in the page (`page.evaluate`). Boxes are `{ left, top, right, bottom }`. */
export function measureComposer() {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const preview = document.querySelector('iframe[data-device="desktop"]');
  const cards = [...document.querySelectorAll('[role="radio"]')].filter((el) => el.getBoundingClientRect().width > 0);
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    preview: preview ? box(preview) : null,
    radios: cards.map((card) => ({
      name: (card.textContent || "").trim().slice(0, 30),
      card: box(card),
      // what the card holds: its text swatch and its check ring (the aria-hidden child)
      content: [...card.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().width > 0 && !el.hasAttribute("aria-hidden") && !el.closest("[aria-hidden]")).map(box),
      check: [...card.querySelectorAll(':scope > [aria-hidden="true"]')].map(box),
    })),
  };
}

const inside = (inner, outer) => inner.left >= outer.left - SLACK && inner.right <= outer.right + SLACK && inner.top >= outer.top - SLACK && inner.bottom <= outer.bottom + SLACK;
const meets = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

/** @param {ReturnType<typeof measureComposer>} m @returns {string[]} */
export function composerLayoutProblems(m) {
  const problems = [];
  if (!m.preview) return ["the desktop preview is not drawn"];
  const share = m.preview.width / m.viewport.width;
  if (share < MIN_PREVIEW_SHARE)
    problems.push(`the preview is ${Math.round(m.preview.width)} px wide, ${Math.round(share * 100)} % of the ${m.viewport.width} px screen (at least ${MIN_PREVIEW_SHARE * 100} %)`);
  for (const r of m.radios) {
    const out = r.content.filter((c) => !inside(c, r.card));
    if (out.length) problems.push(`the radio « ${r.name} » holds ${out.length} box(es) outside its card`);
    if (r.check.some((ring) => !inside(ring, r.card))) problems.push(`the radio « ${r.name} » has its check outside its card`);
    if (r.check.some((ring) => r.content.some((c) => meets(ring, c)))) problems.push(`the radio « ${r.name} » has its check over its own content`);
  }
  return problems;
}
