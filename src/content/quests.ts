/**
 * Quest phrasing.
 *
 * Turns vocabulary into spoken Spanish commands. The grammar grows on its own:
 * single nouns -> commands (busca/toca) -> prepositions (dale ... a) ->
 * adjectives (color agreement) -> numbers + plurals. The child never sees a
 * grammar rule; they just hear more complex sentences as they succeed.
 */
import type { ColorWord, NumberWord, VocabItem } from './vocabulary';
import type { IconName } from './icons';

export type QuestKind = 'find' | 'touch' | 'give' | 'count' | 'color';

/** A short, kid-readable icon hint for the command verb (no English words). */
export const QUEST_ICON: Record<QuestKind, IconName> = {
  find: 'magnifyingGlass',
  touch: 'handTap',
  give: 'gift',
  count: 'listNumbers',
  color: 'palette',
};

export interface SpokenLine {
  /** The sentence spoken to the child. */
  readonly text: string;
  /** A shorter celebratory echo, optional. */
  readonly cheer?: string;
}

/** "Busca la manzana." */
export function findLine(item: VocabItem): SpokenLine {
  return { text: `Busca ${item.say}.`, cheer: `¡${capitalize(item.say)}!` };
}

/** "Toca la flor." */
export function touchLine(item: VocabItem): SpokenLine {
  return { text: `Toca ${item.say}.` };
}

/** "Dale la manzana a Nube." — introduces the preposition "a". */
export function giveLine(item: VocabItem, npcName: string): SpokenLine {
  return { text: `Dale ${item.say} a ${npcName}.` };
}

/** "Encuentra tres fresas." / "Encuentra un pez." — numbers + plurals + gender on 1. */
export function countLine(item: VocabItem, num: NumberWord): SpokenLine {
  if (num.value === 1) {
    const article = item.article === 'el' ? 'un' : 'una';
    return { text: `Encuentra ${article} ${item.es}.` };
  }
  return { text: `Encuentra ${num.es} ${item.plural}.` };
}

/** "Busca la pelota roja." — introduces color adjectives + agreement. */
export function colorLine(item: VocabItem, color: ColorWord): SpokenLine {
  const adj = item.article === 'la' ? color.esFem : color.es;
  return { text: `Busca ${item.say} ${adj}.` };
}

/** Nube's warm, varied praise. Kept short so it never delays the next action. */
export const PRAISE_LINES = [
  '¡Sí! ¡Muy bien!',
  '¡Perfecto!',
  '¡Genial!',
  '¡Lo lograste!',
  '¡Excelente!',
  '¡Qué bien!',
] as const;

/** Gentle, non-punishing nudge when the child picks the wrong thing. */
export const NUDGE_LINES = ['Mmm... otra vez.', 'Casi. Escucha.', 'Inténtalo.'] as const;

export function praise(index: number): string {
  return PRAISE_LINES[index % PRAISE_LINES.length];
}

export function nudge(index: number): string {
  return NUDGE_LINES[index % NUDGE_LINES.length];
}

/**
 * The printed word is a training wheel for a well-established reader
 * transferring print-to-sound skill from English — it should come off once
 * a word is drilled enough that recall should be happening by ear, not by
 * reading the answer during the quiz.
 */
export type WordVisibility = 'full' | 'partial' | 'hidden';

const PARTIAL_AFTER_PLAYS = 10;
const HIDDEN_AFTER_PLAYS = 20;

export function wordVisibility(timesPlayed: number): WordVisibility {
  if (timesPlayed > HIDDEN_AFTER_PLAYS) return 'hidden';
  if (timesPlayed > PARTIAL_AFTER_PLAYS) return 'partial';
  return 'full';
}

/** "manzana" -> "m--z--a" — keeps every 3rd letter per word as a light
 * scaffold, not a giveaway. Restarts the pattern at each space so a leading
 * article ("la"/"el") doesn't shift which letters of the noun stay visible. */
export function maskWord(text: string): string {
  return text
    .split(' ')
    .map((word) => word.split('').map((ch, i) => (i % 3 === 0 ? ch : '-')).join(''))
    .join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
