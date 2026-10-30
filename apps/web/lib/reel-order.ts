/** The place a poster frame is taken from: a tenth into the video, never before a quarter second nor past two seconds, so it is neither black nor late (akinaza#469). */
export function posterTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(Math.max(duration * 0.1, 0.25), 2, duration / 2);
}

/** The ids with the one at `from` moved to `to` (both clamped to the list): the owner's drag, or a press on « up » and « down ». The list is not changed in place. */
export function moveReel<T>(ids: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= ids.length) {
    return [...ids];
  }
  const target = Math.min(Math.max(to, 0), ids.length - 1);
  const next = [...ids];
  const [picked] = next.splice(from, 1);
  next.splice(target, 0, picked!);
  return next;
}
