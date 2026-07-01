/**
 * Quest director — the pure-logic brain of the learning loop.
 *
 * Deliberately free of Three.js so it can be unit-tested: it decides what the
 * child is asked to do, which objects to place, and whether an action was
 * correct. It also paces unlocks so something new appears every few quests
 * (ADHD dopamine cadence) — new words, new command types, new creatures — and
 * grows grammar implicitly: nouns -> commands -> numbers -> colors -> the
 * preposition "a" via two-step delivery quests.
 */
import {
  COLOR_WORDS,
  MEADOW_VOCAB,
  NUMBER_WORDS,
  type ColorWord,
  type ModelKey,
  type VocabItem,
} from '../content/vocabulary';
import {
  colorLine,
  countLine,
  findLine,
  giveLine,
  touchLine,
  type QuestKind,
  type SpokenLine,
} from '../content/quests';
export interface SelectionDescriptor { vocabId: string; colorId?: string; }

export interface Quest {
  kind: QuestKind;
  target: VocabItem;
  line: SpokenLine;
  count: number;
  collected: number;
  color?: ColorWord;
  /** For 'give': true once the child has picked up the correct item. */
  carrying: boolean;
}

export interface SpawnSpec {
  vocab: VocabItem;
  colorId?: string;
  colorOverride?: number;
}

export type SelectOutcome = 'correct' | 'wrong' | 'progress' | 'pickup';

export interface SelectResult {
  outcome: SelectOutcome;
  questComplete: boolean;
}

export interface NextEvent {
  unlockedWord?: VocabItem;
  awardCreature?: VocabItem;
  levelUp: boolean;
}

export const INITIAL_ACTIVE = 4;
const COLORABLE: ReadonlySet<ModelKey> = new Set(['ball', 'gem', 'flower', 'star', 'butterfly']);

type Rng = () => number;

export class QuestDirector {
  private readonly npcName: string;
  private readonly rng: Rng;
  private active: VocabItem[];
  private nextUnlockIndex = INITIAL_ACTIVE;
  private completed = 0;
  private current!: Quest;
  private collectedCreatures = new Set<string>();

  constructor(opts: {
    npcName?: string;
    rng?: Rng;
    alreadyCollected?: readonly string[];
    initialProgress?: { nextUnlockIndex: number; completed: number };
  } = {}) {
    this.npcName = opts.npcName ?? 'Nube';
    this.rng = opts.rng ?? Math.random;
    this.nextUnlockIndex = Math.min(
      Math.max(opts.initialProgress?.nextUnlockIndex ?? INITIAL_ACTIVE, INITIAL_ACTIVE),
      MEADOW_VOCAB.length,
    );
    this.completed = Math.max(0, opts.initialProgress?.completed ?? 0);
    this.active = MEADOW_VOCAB.slice(0, this.nextUnlockIndex);
    for (const id of opts.alreadyCollected ?? []) this.collectedCreatures.add(id);
  }

  /** Snapshot of unlock progress, for persistence. */
  get progressSnapshot(): { nextUnlockIndex: number; completed: number } {
    return { nextUnlockIndex: this.nextUnlockIndex, completed: this.completed };
  }

  get quest(): Quest {
    return this.current;
  }

  get activeVocab(): readonly VocabItem[] {
    return this.active;
  }

  get completedCount(): number {
    return this.completed;
  }

  private pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private chooseKind(): QuestKind {
    const candidates: QuestKind[] = ['find', 'touch'];
    if (this.completed >= 3 && this.active.length >= 3) candidates.push('count');
    if (this.completed >= 4) candidates.push('give');
    if (this.completed >= 5 && this.active.some((v) => COLORABLE.has(v.model))) candidates.push('color');
    // Bias toward simple find/touch so the loop never feels like a test.
    if (this.rng() < 0.5) return this.rng() < 0.5 ? 'find' : 'touch';
    return this.pick(candidates);
  }

  /** Start the very first quest (always a gentle 'find'). */
  start(): Quest {
    const target = this.pick(this.active);
    this.current = { kind: 'find', target, line: findLine(target), count: 1, collected: 0, carrying: false };
    return this.current;
  }

  /** Advance to the next quest and report what (if anything) was unlocked. */
  next(): { quest: Quest; event: NextEvent } {
    this.completed += 1;
    const event: NextEvent = { levelUp: false };

    // Unlock a new word every 2 completions until the full set is active.
    if (this.completed % 2 === 0 && this.nextUnlockIndex < MEADOW_VOCAB.length) {
      const word = MEADOW_VOCAB[this.nextUnlockIndex];
      this.active = MEADOW_VOCAB.slice(0, this.nextUnlockIndex + 1);
      this.nextUnlockIndex += 1;
      event.unlockedWord = word;
    }

    // Award a collectible creature every 3 completions.
    if (this.completed % 3 === 0) {
      const candidate = this.active.find((v) => !this.collectedCreatures.has(v.id));
      if (candidate) {
        this.collectedCreatures.add(candidate.id);
        event.awardCreature = candidate;
        event.levelUp = true;
      }
    }

    const kind = this.chooseKind();
    this.current = this.buildQuest(kind);
    return { quest: this.current, event };
  }

  private buildQuest(kind: QuestKind): Quest {
    const base = { collected: 0, carrying: false };
    switch (kind) {
      case 'touch': {
        const target = this.pick(this.active);
        return { kind, target, line: touchLine(target), count: 1, ...base };
      }
      case 'give': {
        const target = this.pick(this.active);
        return { kind, target, line: giveLine(target, this.npcName), count: 1, ...base };
      }
      case 'count': {
        const target = this.pick(this.active);
        const maxN = Math.min(3, NUMBER_WORDS.length);
        const num = NUMBER_WORDS[1 + Math.floor(this.rng() * (maxN - 1))]; // 2..3
        return { kind, target, line: countLine(target, num), count: num.value, ...base };
      }
      case 'color': {
        const colorable = this.active.filter((v) => COLORABLE.has(v.model));
        const target = this.pick(colorable.length ? colorable : this.active);
        const color = this.pick(COLOR_WORDS);
        return { kind, target, line: colorLine(target, color), count: 1, color, ...base };
      }
      case 'find':
      default: {
        const target = this.pick(this.active);
        return { kind, target, line: findLine(target), count: 1, ...base };
      }
    }
  }

  /**
   * Decide which objects to place this round: the target(s) plus distractors,
   * always drawn from currently-active (already-introduced) vocabulary.
   */
  buildSpawnSet(maxObjects = 7): SpawnSpec[] {
    const q = this.current;
    const specs: SpawnSpec[] = [];

    if (q.kind === 'color' && q.color) {
      // Same noun in several colors: noun reinforced, color taught.
      // The correct-color target must always survive the final trim.
      const target: SpawnSpec = { vocab: q.target, colorId: q.color.id, colorOverride: q.color.color };
      const otherColors = COLOR_WORDS.filter((c) => c.id !== q.color!.id)
        .map((c) => ({ vocab: q.target, colorId: c.id, colorOverride: c.color }));
      const distractorSpecs = this.distractors(q.target, 2).map((v) => ({ vocab: v }));
      const rest = this.shuffle([...otherColors, ...distractorSpecs]).slice(0, maxObjects - 1);
      return this.shuffle([target, ...rest]);
    }

    const targetCopies = q.kind === 'count' ? q.count : 1;
    for (let i = 0; i < targetCopies; i++) specs.push({ vocab: q.target });

    const distractorCount = Math.max(2, maxObjects - targetCopies);
    for (const v of this.distractors(q.target, distractorCount)) specs.push({ vocab: v });

    return this.shuffle(specs).slice(0, maxObjects);
  }

  private distractors(exclude: VocabItem, n: number): VocabItem[] {
    const pool = this.active.filter((v) => v.id !== exclude.id);
    return this.shuffle(pool).slice(0, n);
  }

  /** Grade a selection (tap or bump) against the current quest. */
  evaluateSelection(sel: SelectionDescriptor): SelectResult {
    const q = this.current;
    const right = sel.vocabId === q.target.id;

    if (q.kind === 'color') {
      const ok = right && sel.colorId === q.color?.id;
      return { outcome: ok ? 'correct' : 'wrong', questComplete: ok };
    }

    if (q.kind === 'count') {
      if (!right) return { outcome: 'wrong', questComplete: false };
      q.collected += 1;
      const done = q.collected >= q.count;
      return { outcome: done ? 'correct' : 'progress', questComplete: done };
    }

    if (q.kind === 'give') {
      if (!right) return { outcome: 'wrong', questComplete: false };
      q.carrying = true;
      return { outcome: 'pickup', questComplete: false };
    }

    // find / touch
    return { outcome: right ? 'correct' : 'wrong', questComplete: right };
  }

  /** Called when the child reaches the NPC while carrying a give-quest item. */
  deliver(): boolean {
    if (this.current.kind === 'give' && this.current.carrying) {
      return true;
    }
    return false;
  }
}
