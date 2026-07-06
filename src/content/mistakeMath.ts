/**
 * "Find the Mistake" — math domain. A set of equations that all equal the
 * same target value, except one whose displayed result is off by a small
 * amount. Mixes simple addition/subtraction within 20 (his classroom level)
 * with order-of-operations and small exponents (his advanced-interest level),
 * per the user's "mix of both, randomly" choice — every round independently
 * rolls simple vs. advanced, not gated behind a skill threshold.
 *
 * Every expression's true value is computed in code (never hardcoded), so
 * correctness is guaranteed regardless of which style got picked.
 *
 * Purely formulaic from skill 0 — see the plateau bug note in
 * project-debugging-game-roadmap memory for why fixed tables are risky here.
 */
export interface MathRound {
  labels: string[]; // one equation string per item, e.g. "6 + 7 = 13"
  oddIndex: number;
  rivalMs: number;
}

const MIN_ITEMS = 3;
const MAX_ITEMS = 6;
// Verifying an equation takes real thinking time, not a glance — much more
// generous than the other domains, and shrinks slowly (user feedback: even
// the starting pace was too tight for a 6-year-old to actually work through).
const MIN_RIVAL_MS = 12000;
const START_RIVAL_MS = 25000;
const MAX_TARGET = 20;

function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** A random true "a + b" or "x - y" expression string that evaluates to `target`. */
function simpleExpr(target: number): string {
  if (Math.random() < 0.5) {
    const a = randInt(0, target);
    return `${a} + ${target - a}`;
  }
  const a = randInt(0, 10);
  return `${target + a} - ${a}`;
}

/** A random true order-of-operations or small-exponent expression equal to `target`, falling back to simpleExpr if none fits. */
function advancedExpr(target: number): string {
  if (Math.random() < 0.5) {
    const base = Math.round(Math.sqrt(target));
    if (base >= 2 && base * base === target) return `${base}²`; // e.g. "4²"
  }
  const c = randInt(2, 3);
  const maxB = Math.floor(target / c);
  if (maxB >= 1) {
    const b = randInt(1, maxB);
    const a = target - b * c;
    // Parenthesize the multiplication — he's just learning order of
    // operations, so show which part happens first rather than assuming he
    // already knows to do multiplication before addition.
    if (a >= 0) return `${a} + (${b} × ${c})`;
  }
  return simpleExpr(target);
}

export function mathLevelForSkill(levelIndex: number): MathRound {
  const skill = Math.max(0, levelIndex);
  const itemCount = Math.min(MAX_ITEMS, MIN_ITEMS + Math.floor(skill / 3));
  const rivalMs = Math.max(MIN_RIVAL_MS, START_RIVAL_MS - skill * 800);
  const target = randInt(5, MAX_TARGET);

  const labels: string[] = [];
  for (let i = 0; i < itemCount; i++) {
    const expr = Math.random() < 0.5 ? simpleExpr(target) : advancedExpr(target);
    labels.push(`${expr} = ${target}`);
  }

  // Small, difficulty-scaled perturbation on one item's shown result — smaller
  // offset is harder to catch at a glance.
  const maxPerturb = Math.max(1, 4 - Math.floor(skill / 3));
  const oddIndex = randInt(0, itemCount - 1);
  const sign = Math.random() < 0.5 ? 1 : -1;
  const perturb = sign * randInt(1, maxPerturb);
  const wrongExpr = labels[oddIndex].split(' = ')[0];
  labels[oddIndex] = `${wrongExpr} = ${target + perturb}`;

  return { labels, oddIndex, rivalMs };
}
