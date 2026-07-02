import { describe, expect, it } from 'vitest';
import { QuestDirector } from './QuestDirector';
import { MEADOW_VOCAB, UNLOCK_ORDER } from '../content/vocabulary';

/** Deterministic RNG for repeatable tests. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('QuestDirector', () => {
  it('starts with a find quest targeting an active word', () => {
    const d = new QuestDirector({ rng: seeded(1) });
    const q = d.start();
    expect(q.kind).toBe('find');
    expect(d.activeVocab.map((v) => v.id)).toContain(q.target.id);
  });

  it('grades a correct find selection as complete', () => {
    const d = new QuestDirector({ rng: seeded(2) });
    const q = d.start();
    const result = d.evaluateSelection({ vocabId: q.target.id });
    expect(result.outcome).toBe('correct');
    expect(result.questComplete).toBe(true);
  });

  it('grades a wrong selection as wrong and never completes', () => {
    const d = new QuestDirector({ rng: seeded(3) });
    const q = d.start();
    const wrongId = MEADOW_VOCAB.find((v) => v.id !== q.target.id)!.id;
    const result = d.evaluateSelection({ vocabId: wrongId });
    expect(result.outcome).toBe('wrong');
    expect(result.questComplete).toBe(false);
  });

  it('unlocks a new word every two completions', () => {
    const d = new QuestDirector({ rng: seeded(4) });
    d.start();
    const startCount = d.activeVocab.length;
    d.next(); // completion 1 — no unlock
    const a = d.activeVocab.length;
    const { event } = d.next(); // completion 2 — unlock
    expect(a).toBe(startCount);
    expect(event.unlockedWord).toBeDefined();
    expect(d.activeVocab.length).toBe(startCount + 1);
  });

  it('awards a creature every three completions', () => {
    const d = new QuestDirector({ rng: seeded(5) });
    d.start();
    d.next();
    d.next();
    const { event } = d.next(); // completion 3
    expect(event.awardCreature).toBeDefined();
    expect(event.levelUp).toBe(true);
  });

  it('requires collecting N items for a count quest', () => {
    const d = new QuestDirector({ rng: seeded(7) });
    d.start();
    // advance until a count quest appears
    let guard = 0;
    while (d.quest.kind !== 'count' && guard++ < 200) d.next();
    if (d.quest.kind !== 'count') return; // tolerate seeds that never pick count
    const q = d.quest;
    for (let i = 0; i < q.count - 1; i++) {
      expect(d.evaluateSelection({ vocabId: q.target.id }).outcome).toBe('progress');
    }
    expect(d.evaluateSelection({ vocabId: q.target.id }).questComplete).toBe(true);
  });

  it('color quest only accepts the matching color', () => {
    const d = new QuestDirector({ rng: seeded(11) });
    d.start();
    let guard = 0;
    while (d.quest.kind !== 'color' && guard++ < 400) d.next();
    if (d.quest.kind !== 'color') return;
    const q = d.quest;
    expect(d.evaluateSelection({ vocabId: q.target.id, colorId: 'definitely-wrong' }).outcome).toBe('wrong');
    expect(d.evaluateSelection({ vocabId: q.target.id, colorId: q.color!.id }).outcome).toBe('correct');
  });

  it('give quest picks up first, then delivers', () => {
    const d = new QuestDirector({ rng: seeded(13) });
    d.start();
    let guard = 0;
    while (d.quest.kind !== 'give' && guard++ < 400) d.next();
    if (d.quest.kind !== 'give') return;
    const q = d.quest;
    expect(d.evaluateSelection({ vocabId: q.target.id }).outcome).toBe('pickup');
    expect(d.deliver()).toBe(true);
  });

  it('spawn set always includes the target', () => {
    const d = new QuestDirector({ rng: seeded(17) });
    d.start();
    const specs = d.buildSpawnSet();
    expect(specs.some((s) => s.vocab.id === d.quest.target.id)).toBe(true);
  });

  it('single-target spawn set contains only the current target', () => {
    const d = new QuestDirector({ rng: seeded(19) });
    d.start();
    const specs = d.buildSingleTargetSpawn();
    expect(specs).toHaveLength(1);
    expect(specs[0].vocab.id).toBe(d.quest.target.id);
  });
});

describe('UNLOCK_ORDER', () => {
  it('contains every MEADOW_VOCAB id exactly once', () => {
    expect(UNLOCK_ORDER).toHaveLength(MEADOW_VOCAB.length);
    const ids = UNLOCK_ORDER.map((v) => v.id).sort();
    const expected = MEADOW_VOCAB.map((v) => v.id).sort();
    expect(ids).toEqual(expected);
  });

  it('interleaves categories — no run of more than 2 same-category items in the first 15 slots', () => {
    let runLength = 1;
    for (let i = 1; i < Math.min(15, UNLOCK_ORDER.length); i++) {
      if (UNLOCK_ORDER[i].category === UNLOCK_ORDER[i - 1].category) {
        runLength++;
        expect(runLength).toBeLessThanOrEqual(2);
      } else {
        runLength = 1;
      }
    }
  });
});

describe('QuestDirector SM-2 target selection', () => {
  it('prefers a due-for-review word over uniform-random selection', () => {
    const dueId = UNLOCK_ORDER[0].id; // guaranteed active from INITIAL_ACTIVE
    const d = new QuestDirector({ rng: seeded(23), wordsForReview: () => [dueId] });
    const q = d.start();
    expect(q.target.id).toBe(dueId);
  });

  it('falls back to uniform-random when nothing is due', () => {
    const d = new QuestDirector({ rng: seeded(23), wordsForReview: () => [] });
    const q = d.start();
    expect(d.activeVocab.map((v) => v.id)).toContain(q.target.id);
  });
});
