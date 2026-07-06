import type { MistakeDomain } from '../systems/ProgressStore';
import type { ModelKey } from './vocabulary';
import { levelForSkill } from './mistakeLevels';
import { patternLevelForSkill } from './mistakePatterns';
import { mathLevelForSkill } from './mistakeMath';
import { oddOneOutLevelForSkill } from './mistakeOddOneOut';

/**
 * Unifies all four "Find the Mistake" domains into one shape DebugGameScene
 * can render generically: N positions, exactly one of them (oddIndex) is the
 * mistake. `kind` says how to draw each item — colored shapes (color/pattern
 * domains both reduce to "one model, per-item colors"), category shapes
 * (oddOneOut — one color, per-item models), or plain text (math).
 */
export type RoundContent =
  | { kind: 'shape'; domain: 'color' | 'pattern'; itemCount: number; model: ModelKey; colors: number[]; oddIndex: number; rivalMs: number }
  | { kind: 'category'; domain: 'oddOneOut'; itemCount: number; models: ModelKey[]; color: number; oddIndex: number; rivalMs: number }
  | { kind: 'text'; domain: 'math'; itemCount: number; labels: string[]; oddIndex: number; rivalMs: number };

export const MISTAKE_DOMAINS: MistakeDomain[] = ['color', 'pattern', 'math', 'oddOneOut'];

export const DOMAIN_PROMPT: Record<MistakeDomain, string> = {
  color: 'Tap the one that doesn’t belong',
  pattern: 'Tap the one that breaks the pattern',
  math: 'Tap the one that’s wrong',
  oddOneOut: 'Tap the one that doesn’t belong',
};

export function generateRound(domain: MistakeDomain, levelIndex: number): RoundContent {
  switch (domain) {
    case 'color': {
      const level = levelForSkill(levelIndex);
      const oddIndex = Math.floor(Math.random() * level.itemCount);
      const colors = Array.from({ length: level.itemCount }, (_, i) => (i === oddIndex ? level.oddColor : level.baseColor));
      return { kind: 'shape', domain: 'color', itemCount: level.itemCount, model: level.model, colors, oddIndex, rivalMs: level.rivalMs };
    }
    case 'pattern': {
      const level = patternLevelForSkill(levelIndex);
      return {
        kind: 'shape', domain: 'pattern', itemCount: level.colors.length, model: level.model,
        colors: level.colors, oddIndex: level.oddIndex, rivalMs: level.rivalMs,
      };
    }
    case 'math': {
      const level = mathLevelForSkill(levelIndex);
      return { kind: 'text', domain: 'math', itemCount: level.labels.length, labels: level.labels, oddIndex: level.oddIndex, rivalMs: level.rivalMs };
    }
    case 'oddOneOut': {
      const level = oddOneOutLevelForSkill(levelIndex);
      return {
        kind: 'category', domain: 'oddOneOut', itemCount: level.models.length,
        models: level.models, color: level.color, oddIndex: level.oddIndex, rivalMs: level.rivalMs,
      };
    }
  }
}
