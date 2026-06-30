/**
 * Vocabulary content layer.
 *
 * Each item carries the Spanish noun phrase the child HEARS plus metadata the
 * game needs to build a cute model and grade an action. English is stored ONLY
 * for the (gated) parent dashboard — it is never shown or spoken to the child.
 *
 * Design note: words are grouped into "intro waves". The game never dumps the
 * whole list on the child; it activates a few words, then unlocks more as the
 * child demonstrates comprehension. This is meaningful-exposure pacing, not a
 * vocabulary list to memorize.
 */

export type VocabCategory =
  | 'food'
  | 'animal'
  | 'nature'
  | 'toy'
  | 'color'
  | 'number'
  | 'school';

export type ModelKey =
  | 'apple'
  | 'banana'
  | 'strawberry'
  | 'flower'
  | 'mushroom'
  | 'star'
  | 'ball'
  | 'fish'
  | 'frog'
  | 'bird'
  | 'butterfly'
  | 'bone'
  | 'gem'
  | 'pencil'
  | 'crayon'
  | 'paper'
  | 'book'
  | 'backpack'
  | 'scissors'
  | 'glue'
  | 'eraser'
  | 'notebook'
  | 'ruler';

export interface VocabItem {
  /** Stable id used for progress tracking + save data. */
  readonly id: string;
  /** Bare noun, e.g. "manzana". */
  readonly es: string;
  /** Definite article, "la" | "el". */
  readonly article: 'la' | 'el';
  /** Plural noun, e.g. "manzanas" — used for counting commands. */
  readonly plural: string;
  /** Full spoken phrase, e.g. "la manzana". */
  readonly say: string;
  /** English — parent dashboard only, never shown to the child. */
  readonly en: string;
  readonly category: VocabCategory;
  readonly model: ModelKey;
  /** Primary body color (hex int). */
  readonly color: number;
  /** Accent/detail color (hex int). */
  readonly accent: number;
}

function item(
  id: string,
  es: string,
  article: 'la' | 'el',
  plural: string,
  en: string,
  category: VocabCategory,
  model: ModelKey,
  color: number,
  accent: number,
): VocabItem {
  return { id, es, article, plural, say: `${article} ${es}`, en, category, model, color, accent };
}

/**
 * Meadow biome starter vocabulary. Concrete, tappable nouns that a 5-year-old
 * can map to a picture instantly — food and animals first, exactly as the
 * design brief specifies.
 */
export const MEADOW_VOCAB: readonly VocabItem[] = [
  item('manzana', 'manzana', 'la', 'manzanas', 'apple', 'food', 'apple', 0xe2483a, 0x6ab04c),
  item('platano', 'plátano', 'el', 'plátanos', 'banana', 'food', 'banana', 0xf6c542, 0x7a5a1e),
  item('fresa', 'fresa', 'la', 'fresas', 'strawberry', 'food', 'strawberry', 0xe23b5a, 0x4caf50),
  item('flor', 'flor', 'la', 'flores', 'flower', 'nature', 'flower', 0xff7eb6, 0xffd84d),
  item('estrella', 'estrella', 'la', 'estrellas', 'star', 'nature', 'star', 0xffd23f, 0xffa62b),
  item('pelota', 'pelota', 'la', 'pelotas', 'ball', 'toy', 'ball', 0x3aa0e2, 0xffffff),
  item('pez', 'pez', 'el', 'peces', 'fish', 'animal', 'fish', 0x2ec5c1, 0xff8c42),
  item('rana', 'rana', 'la', 'ranas', 'frog', 'animal', 'frog', 0x6abf4b, 0xfff3b0),
  item('pajaro', 'pájaro', 'el', 'pájaros', 'bird', 'animal', 'bird', 0x4d8cff, 0xff8c42),
  item('mariposa', 'mariposa', 'la', 'mariposas', 'butterfly', 'animal', 'butterfly', 0xb06cff, 0xffd23f),
  item('seta', 'seta', 'la', 'setas', 'mushroom', 'nature', 'mushroom', 0xe2483a, 0xfdf3e7),
  item('hueso', 'hueso', 'el', 'huesos', 'bone', 'toy', 'bone', 0xfdf3e7, 0xd9c9a8),
  // La Mochila — school supply cluster (highest-leverage for 1st grade dual-language)
  item('lapiz',     'lápiz',     'el', 'lápices',    'pencil',   'school', 'pencil',   0xffd23f, 0xff7043),
  item('crayon',    'crayón',    'el', 'crayones',   'crayon',   'school', 'crayon',   0xe2483a, 0xffd23f),
  item('papel',     'papel',     'el', 'papeles',    'paper',    'school', 'paper',    0xf5f0e8, 0x88aacc),
  item('libro',     'libro',     'el', 'libros',     'book',     'school', 'book',     0x3a7bd5, 0xffd23f),
  item('mochila',   'mochila',   'la', 'mochilas',   'backpack', 'school', 'backpack', 0x6b4c9a, 0xffd23f),
  item('tijera',    'tijera',    'la', 'tijeras',    'scissors', 'school', 'scissors', 0xe2483a, 0xc8c8c8),
  item('pegamento', 'pegamento', 'el', 'pegamentos', 'glue',     'school', 'glue',     0xffffff, 0x3aa0e2),
  item('borrador',  'borrador',  'el', 'borradores', 'eraser',   'school', 'eraser',   0xff6b9d, 0x3aa0e2),
  item('cuaderno',  'cuaderno',  'el', 'cuadernos',  'notebook', 'school', 'notebook', 0x6abf4b, 0xffd23f),
  item('regla',     'regla',     'la', 'reglas',     'ruler',    'school', 'ruler',    0xffd23f, 0x3aa0e2),
] as const;

/** Numbers 1–5 — introduced through "find N" commands, never as a list. */
export interface NumberWord {
  readonly value: number;
  readonly es: string;
  readonly en: string;
}

export const NUMBER_WORDS: readonly NumberWord[] = [
  { value: 1, es: 'una', en: 'one' },
  { value: 2, es: 'dos', en: 'two' },
  { value: 3, es: 'tres', en: 'three' },
  { value: 4, es: 'cuatro', en: 'four' },
  { value: 5, es: 'cinco', en: 'five' },
] as const;

/** Colors — introduced through "find the red ball" style commands. */
export interface ColorWord {
  readonly id: string;
  readonly es: string;
  readonly en: string;
  readonly color: number;
  /** Feminine agreement form for words like "pelota" (la pelota roja). */
  readonly esFem: string;
}

export const COLOR_WORDS: readonly ColorWord[] = [
  { id: 'rojo', es: 'rojo', esFem: 'roja', en: 'red', color: 0xe2483a },
  { id: 'azul', es: 'azul', esFem: 'azul', en: 'blue', color: 0x3aa0e2 },
  { id: 'amarillo', es: 'amarillo', esFem: 'amarilla', en: 'yellow', color: 0xffd23f },
  { id: 'verde', es: 'verde', esFem: 'verde', en: 'green', color: 0x6abf4b },
] as const;

export function getNumberWord(value: number): NumberWord {
  const found = NUMBER_WORDS.find((n) => n.value === value);
  if (!found) throw new Error(`No number word for ${value}`);
  return found;
}

export function vocabById(id: string): VocabItem | undefined {
  return MEADOW_VOCAB.find((v) => v.id === id);
}
