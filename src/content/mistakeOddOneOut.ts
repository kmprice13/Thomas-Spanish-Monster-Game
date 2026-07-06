import type { ModelKey } from './vocabulary';

/**
 * "Find the Mistake" — general odd-one-out domain. Every item shares a
 * category (and the same color, so category/shape is the only cue) except
 * one from a different category — e.g. three fruits and one bug. Uses only
 * the ModelKeys drawItem() can actually render procedurally (no PNG loading
 * in this scene).
 *
 * Purely formulaic from skill 0 — see the plateau bug note in
 * project-debugging-game-roadmap memory for why fixed tables are risky here.
 */
export interface OddOneOutRound {
  models: ModelKey[]; // one per item
  color: number;
  oddIndex: number;
  rivalMs: number;
}

const CATEGORIES: ModelKey[][] = [
  ['apple', 'banana', 'strawberry'],
  ['fish', 'frog', 'bird', 'butterfly'],
  ['flower', 'mushroom', 'star'],
  ['ball', 'bone', 'gem'],
];

const COLORS = [0xff6b6b, 0x4d8cff, 0xffcf40, 0x4caf50, 0xb06cff, 0xff9f43, 0x2ec5c1];

const MIN_ITEMS = 4;
const MAX_ITEMS = 10;
const MIN_RIVAL_MS = 3500;

function pickCategoryIndex(exclude: number): number {
  let idx = Math.floor(Math.random() * CATEGORIES.length);
  while (idx === exclude) idx = Math.floor(Math.random() * CATEGORIES.length);
  return idx;
}

export function oddOneOutLevelForSkill(levelIndex: number): OddOneOutRound {
  const skill = Math.max(0, levelIndex);
  const itemCount = Math.min(MAX_ITEMS, MIN_ITEMS + Math.floor(skill * 0.6));
  const rivalMs = Math.max(MIN_RIVAL_MS, 9000 - skill * 400);

  const mainIdx = Math.floor(Math.random() * CATEGORIES.length);
  const oddCategoryIdx = pickCategoryIndex(mainIdx);
  const mainCategory = CATEGORIES[mainIdx];
  const oddCategory = CATEGORIES[oddCategoryIdx];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const models: ModelKey[] = [];
  for (let i = 0; i < itemCount; i++) models.push(mainCategory[i % mainCategory.length]);

  const oddIndex = Math.floor(Math.random() * itemCount);
  models[oddIndex] = oddCategory[Math.floor(Math.random() * oddCategory.length)];

  return { models, color, oddIndex, rivalMs };
}
