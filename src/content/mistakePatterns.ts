import type { ModelKey } from './vocabulary';

/**
 * "Find the Mistake" — pattern domain. A repeating color sequence (AB or ABC)
 * with one position swapped to a color from the same unit that doesn't belong
 * there — a "misplaced" item, not an alien third color, so spotting it
 * requires tracking the sequence rather than just scanning for a different hue.
 *
 * Purely formulaic from skill 0 (no fixed table to outgrow) — see the
 * plateau bug note in project-debugging-game-roadmap memory for why that
 * matters.
 */
export interface PatternRound {
  model: ModelKey;
  colors: number[]; // one per item, in sequence order
  oddIndex: number;
  rivalMs: number;
}

const MIN_ITEMS = 5;
const MAX_ITEMS = 12;
const MIN_RIVAL_MS = 3500;

const UNIT_COLORS_2 = [0xff6b6b, 0x4d8cff]; // red / blue
const UNIT_COLORS_3 = [0xffcf40, 0x4caf50, 0xb06cff]; // yellow / green / purple

export function patternLevelForSkill(levelIndex: number): PatternRound {
  const skill = Math.max(0, levelIndex);
  const unitLength = skill >= 4 ? 3 : 2;
  const unit = unitLength === 3 ? UNIT_COLORS_3 : UNIT_COLORS_2;
  const minForUnit = unitLength === 3 ? 7 : MIN_ITEMS;
  const itemCount = Math.min(MAX_ITEMS, Math.max(minForUnit, MIN_ITEMS + Math.floor(skill * 0.7)));
  const rivalMs = Math.max(MIN_RIVAL_MS, 9000 - skill * 450);

  const colors: number[] = [];
  for (let i = 0; i < itemCount; i++) colors.push(unit[i % unitLength]);

  const oddIndex = Math.floor(Math.random() * itemCount);
  const expected = unit[oddIndex % unitLength];
  const alternatives = unit.filter((c) => c !== expected);
  colors[oddIndex] = alternatives[Math.floor(Math.random() * alternatives.length)];

  // Deliberately NOT 'star' — the color domain already uses stars, and having
  // both domains render the same shape made it confusing to tell which game
  // you were playing (user feedback: "that was confusing"). Ball reads as a
  // clearly different shape at a glance, independent of the prompt text.
  return { model: 'ball', colors, oddIndex, rivalMs };
}
