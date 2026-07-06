import type { ModelKey } from './vocabulary';

/**
 * Difficulty curve for the "Find the Mistake" game. The first 5 levels are
 * hand-authored (covers the range Thomas actually plays in). Beyond that,
 * levelForSkill() generates further levels procedurally so a skilled/fast
 * player never plateaus at a fixed ceiling — item count keeps climbing (up to
 * a sane cap so it still fits the canvas), the rival keeps getting faster,
 * and the color pair keeps getting closer in hue (harder to tell apart).
 */
export interface MistakeLevel {
  itemCount: number;
  model: ModelKey;
  baseColor: number; // shared by every item except the one mistake
  oddColor: number;  // the mistake's color
  rivalMs: number;   // how long the rival takes to reach the finish line
}

export const MISTAKE_LEVELS: MistakeLevel[] = [
  { itemCount: 4, model: 'star', baseColor: 0xffcf40, oddColor: 0x3aa0ff, rivalMs: 9000 },
  { itemCount: 5, model: 'star', baseColor: 0xff6b6b, oddColor: 0x4caf50, rivalMs: 8000 },
  { itemCount: 6, model: 'star', baseColor: 0xffcf40, oddColor: 0xffb347, rivalMs: 7500 },
  { itemCount: 7, model: 'star', baseColor: 0x6ba3ff, oddColor: 0x8f6bff, rivalMs: 7000 },
  { itemCount: 8, model: 'star', baseColor: 0x4caf50, oddColor: 0x2ec5c1, rivalMs: 6500 },
];

const MAX_ITEM_COUNT = 12;   // canvas/hit-target space gets cramped much past this
const MIN_RIVAL_MS = 3000;   // floor so it's still humanly possible
const MIN_HUE_OFFSET_DEG = 6; // floor so the two colors are still technically distinguishable

function hslToHex(hueDeg: number, s: number, l: number): number {
  const h = ((hueDeg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const toByte = (v: number) => Math.round((v + m) * 255);
  return (toByte(r) << 16) | (toByte(g) << 8) | toByte(b);
}

/** Level for a given (rounded) skill/level index — hand-authored for 0-4, procedural beyond. */
export function levelForSkill(levelIndex: number): MistakeLevel {
  const clampedIndex = Math.max(0, levelIndex);
  if (clampedIndex < MISTAKE_LEVELS.length) return MISTAKE_LEVELS[clampedIndex];

  const beyond = clampedIndex - (MISTAKE_LEVELS.length - 1); // 1, 2, 3, ...
  const itemCount = Math.min(MAX_ITEM_COUNT, 8 + beyond);
  const rivalMs = Math.max(MIN_RIVAL_MS, 6500 - beyond * 350);
  const hueOffsetDeg = Math.max(MIN_HUE_OFFSET_DEG, 35 - beyond * 4);
  const baseHue = Math.random() * 360;
  return {
    itemCount,
    model: 'star',
    baseColor: hslToHex(baseHue, 0.65, 0.55),
    oddColor: hslToHex(baseHue + hueOffsetDeg, 0.65, 0.55),
    rivalMs,
  };
}
