import { WALL_LIMITS } from "@akinaza/core";

/**
 * The wall editor's moves, pure: the keyboard nudges an item by a step (Shift for a larger one), `[` and `]` tilt it, and nothing ever leaves the bounds
 * the server enforces (0–100 % on both axes, ±8° of tilt). The same bounds are checked again by the route and the database.
 */
// @fixed: one press moves an item by 1 % of the wall, Shift by 5 %; one tilt step is 1°, Shift 2° (the design's small steps).
const STEP = { move: 1, moveShift: 5, tilt: 1, tiltShift: 2 } as const;

export interface Placed {
  x: number;
  y: number;
  rotation: number;
  z: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

export const clampPlace = <T extends Placed>(item: T): T => ({
  ...item,
  x: round(clamp(Number.isFinite(item.x) ? item.x : 0, 0, 100)),
  y: round(clamp(Number.isFinite(item.y) ? item.y : 0, 0, 100)),
  rotation: round(clamp(Number.isFinite(item.rotation) ? item.rotation : 0, -WALL_LIMITS.tilt, WALL_LIMITS.tilt)),
  z: Math.round(clamp(Number.isFinite(item.z) ? item.z : 0, 0, WALL_LIMITS.order)),
});

/** The item after a key, or null when the key is not one of the editor's. Arrow keys move, `[` and `]` tilt, PageUp and PageDown change the layer. */
export function nudge<T extends Placed>(item: T, key: string, shift: boolean): T | null {
  const move = shift ? STEP.moveShift : STEP.move;
  const tilt = shift ? STEP.tiltShift : STEP.tilt;
  switch (key) {
    case "ArrowLeft": return clampPlace({ ...item, x: item.x - move });
    case "ArrowRight": return clampPlace({ ...item, x: item.x + move });
    case "ArrowUp": return clampPlace({ ...item, y: item.y - move });
    case "ArrowDown": return clampPlace({ ...item, y: item.y + move });
    case "[": return clampPlace({ ...item, rotation: item.rotation - tilt });
    case "]": return clampPlace({ ...item, rotation: item.rotation + tilt });
    case "PageUp": return clampPlace({ ...item, z: item.z + 1 });
    case "PageDown": return clampPlace({ ...item, z: item.z - 1 });
    default: return null;
  }
}

/** Where the next item lands: a staggered diagonal, so a new photo never hides the one before it. */
export function nextPlace(count: number): Placed {
  return { x: 6 + ((count * 13) % 60), y: 8 + ((count * 17) % 50), rotation: ((count % 5) - 2), z: count + 1 };
}
