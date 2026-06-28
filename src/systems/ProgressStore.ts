/**
 * ProgressStore — all learning data, spaced repetition, and parent insights.
 *
 * Spaced repetition uses SM-2 (SuperMemo 2), the same algorithm behind Anki.
 * Quality ratings map response time + correctness to the SM-2 quality scale:
 *
 *   Fast correct  (< 2.5s) → quality 5 (easy, long next interval)
 *   Normal correct (2.5–6s) → quality 4
 *   Slow correct   (> 6s) → quality 3 (correct but uncertain, shorter interval)
 *   Wrong                  → quality 1 (resets interval, drops ease factor)
 *
 * Confusion pairs: every wrong selection records WHAT was chosen instead.
 * If the same pair appears 3+ times, the game stages those words apart.
 *
 * All data is localStorage — offline, private, no backend needed.
 * Supabase sync can be layered on top later without changing this API.
 */
import { MEADOW_VOCAB, vocabById } from '../content/vocabulary';

const STORAGE_KEY = 'ismg-progress-v2';
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const DAY_MS = 86_400_000;

// SM-2 quality thresholds (ms)
const FAST_MS  = 2_500;
const SLOW_MS  = 6_000;

export interface GameSettings {
  reducedMotion: boolean;
  muted: boolean;
  slowSpeech: boolean;
  playerColor: number; // hex tint applied to grayscale Thomas sprite (0 = default orange)
}

/** Per-word SRS state. */
interface SRSState {
  ease: number;
  interval: number;      // days until next review
  reps: number;          // consecutive correct
  nextReview: number;    // ms timestamp
}

/** A single attempt record (kept rolling, last 30 per word). */
interface Attempt {
  t: number;             // timestamp
  correct: boolean;
  responseMs: number;
  confusedWith?: string; // vocab id chosen instead (if wrong)
}

/** Everything we track per vocabulary item. */
export interface WordRecord {
  vocabId: string;
  introduced: boolean;   // has Lumi done the intro sequence?
  exposures: number;     // times shown via intro
  srs: SRSState;
  attempts: Attempt[];
  correctCount: number;
  totalAttempts: number;
  confusionWith: Record<string, number>; // vocabId → wrong-pick count
}

export interface ProgressData {
  version: number;
  secondsPlayed: number;
  words: Record<string, WordRecord>;
  creatures: string[];
  settings: GameSettings;
}

// ── SM-2 ────────────────────────────────────────────────────────────────────

function defaultSRS(): SRSState {
  return { ease: DEFAULT_EASE, interval: 1, reps: 0, nextReview: Date.now() };
}

function sm2Quality(correct: boolean, responseMs: number): number {
  if (!correct) return 1;
  if (responseMs < FAST_MS) return 5;
  if (responseMs < SLOW_MS) return 4;
  return 3;
}

function updateSRS(state: SRSState, quality: number): SRSState {
  const now = Date.now();
  let { ease, interval, reps } = state;

  if (quality >= 3) {
    // Correct — advance interval
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
  } else {
    // Wrong — reset
    reps = 0;
    interval = 1;
  }

  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    ease: +ease.toFixed(3),
    interval: Math.max(1, interval),
    reps,
    nextReview: now + Math.max(1, interval) * DAY_MS,
  };
}

// ── Fluency levels (for dashboard) ──────────────────────────────────────────

export type FluencyLevel = 'fluent' | 'learning' | 'struggling' | 'unseen';

export function fluencyLevel(r: WordRecord): FluencyLevel {
  if (!r.introduced || r.totalAttempts === 0) return 'unseen';
  const rate = r.correctCount / r.totalAttempts;
  if (r.srs.ease >= 2.1 && r.srs.reps >= 3 && rate >= 0.75) return 'fluent';
  if (r.srs.ease < 1.7 || rate < 0.5) return 'struggling';
  return 'learning';
}

/** Average response time across recent correct attempts (ms). */
function avgResponseMs(attempts: Attempt[]): number {
  const correct = attempts.filter(a => a.correct).slice(-10);
  if (!correct.length) return 0;
  return correct.reduce((s, a) => s + a.responseMs, 0) / correct.length;
}

// ── Defaults ────────────────────────────────────────────────────────────────

function defaultWord(vocabId: string): WordRecord {
  return {
    vocabId,
    introduced: false,
    exposures: 0,
    srs: defaultSRS(),
    attempts: [],
    correctCount: 0,
    totalAttempts: 0,
    confusionWith: {},
  };
}

function defaultData(): ProgressData {
  return {
    version: 2,
    secondsPlayed: 0,
    words: {},
    creatures: [],
    settings: { reducedMotion: false, muted: false, slowSpeech: false, playerColor: 0xff6b35 },
  };
}

// ── ProgressStore ────────────────────────────────────────────────────────────

export class ProgressStore {
  private data: ProgressData;
  private saveTimer = 0;

  constructor() {
    this.data = this.load();
  }

  private load(): ProgressData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const p = JSON.parse(raw) as Partial<ProgressData>;
      return {
        ...defaultData(),
        ...p,
        words: p.words ?? {},
        creatures: p.creatures ?? [],
        settings: { ...defaultData().settings, ...(p.settings ?? {}) },
      };
    } catch {
      return defaultData();
    }
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch { /* storage unavailable */ }
    }, 500);
  }

  private word(id: string): WordRecord {
    if (!this.data.words[id]) this.data.words[id] = defaultWord(id);
    return this.data.words[id];
  }

  // ── Settings ──

  get settings(): GameSettings { return this.data.settings; }

  setSettings(patch: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.scheduleSave();
  }

  // ── Session ──

  addSeconds(dt: number): void {
    this.data.secondsPlayed += dt;
    if (Math.floor(this.data.secondsPlayed) % 10 === 0) this.scheduleSave();
  }

  // ── Intro / exposure ──

  /** Returns true if this word has NOT yet had Lumi's intro. */
  needsIntro(vocabId: string): boolean {
    return !this.word(vocabId).introduced;
  }

  markIntroduced(vocabId: string): void {
    const w = this.word(vocabId);
    w.introduced = true;
    w.exposures += 1;
    this.scheduleSave();
  }

  // ── Attempt recording ──

  recordAttempt(vocabId: string, correct: boolean, responseMs: number, confusedWith?: string): void {
    const w = this.word(vocabId);
    const attempt: Attempt = { t: Date.now(), correct, responseMs };
    if (!correct && confusedWith) {
      attempt.confusedWith = confusedWith;
      w.confusionWith[confusedWith] = (w.confusionWith[confusedWith] ?? 0) + 1;
    }
    w.attempts.push(attempt);
    if (w.attempts.length > 30) w.attempts = w.attempts.slice(-30);
    w.totalAttempts += 1;
    if (correct) w.correctCount += 1;

    const quality = sm2Quality(correct, responseMs);
    w.srs = updateSRS(w.srs, quality);
    this.scheduleSave();
  }

  // ── Confusion pair guard ──

  /** True if the two words are a known confusion pair (>= 3 mix-ups either way). */
  areConfused(idA: string, idB: string): boolean {
    const a = this.word(idA).confusionWith[idB] ?? 0;
    const b = this.word(idB).confusionWith[idA] ?? 0;
    return a + b >= 3;
  }

  // ── Creatures ──

  get creatures(): readonly string[] { return this.data.creatures; }

  addCreature(id: string): boolean {
    if (this.data.creatures.includes(id)) return false;
    this.data.creatures.push(id);
    this.scheduleSave();
    return true;
  }

  // ── SRS review scheduling ──

  /** Words due for review now (nextReview <= now). */
  wordsForReview(): string[] {
    const now = Date.now();
    return Object.values(this.data.words)
      .filter(w => w.introduced && w.srs.nextReview <= now)
      .sort((a, b) => a.srs.nextReview - b.srs.nextReview)
      .map(w => w.vocabId);
  }

  // ── Parent dashboard ──

  parentSummary(): ParentSummary {
    const all = MEADOW_VOCAB.map(v => ({ v, r: this.word(v.id) }));

    const fluent     = all.filter(x => fluencyLevel(x.r) === 'fluent');
    const learning   = all.filter(x => fluencyLevel(x.r) === 'learning');
    const struggling = all.filter(x => fluencyLevel(x.r) === 'struggling');
    const unseen     = all.filter(x => fluencyLevel(x.r) === 'unseen');

    // Top confusion pairs (each pair listed once)
    const confusionPairs: Array<{ wordA: string; wordB: string; count: number }> = [];
    const seen = new Set<string>();
    for (const { v, r } of all) {
      for (const [otherId, count] of Object.entries(r.confusionWith)) {
        if (count < 2) continue;
        const key = [v.id, otherId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const otherVocab = vocabById(otherId);
        if (!otherVocab) continue;
        confusionPairs.push({ wordA: v.es, wordB: otherVocab.es, count });
      }
    }
    confusionPairs.sort((a, b) => b.count - a.count);

    // Response time trend: avg of last 5 attempts for "fluent" words
    const recentResponseMs = fluent.length
      ? fluent.reduce((s, x) => s + avgResponseMs(x.r.attempts), 0) / fluent.length
      : 0;

    // Words due for review today
    const reviewDue = this.wordsForReview()
      .map(id => vocabById(id))
      .filter(Boolean)
      .map(v => v!.es);

    // Next review dates for learning words
    const nextReviews = learning.map(x => ({
      es: x.v.es,
      daysUntil: Math.max(0, Math.ceil((x.r.srs.nextReview - Date.now()) / DAY_MS)),
    }));

    // Plain-language recommendation
    let recommendation = 'Keep exploring — every quest builds new words naturally.';
    if (struggling.length) {
      recommendation = `Lumi will replay "${struggling[0].v.es}" more often — it's still settling in.`;
    } else if (confusionPairs.length) {
      const p = confusionPairs[0];
      recommendation = `Thomas sometimes mixes up "${p.wordA}" and "${p.wordB}" — the game is separating these.`;
    } else if (fluent.length >= 6) {
      recommendation = `${fluent.length} words are solid. The Beach biome unlocks soon with new vocabulary!`;
    }

    return {
      wordsTotal: MEADOW_VOCAB.length,
      wordsFluent: fluent.map(x => ({ es: x.v.es, en: x.v.en })),
      wordsLearning: learning.map(x => ({ es: x.v.es, en: x.v.en })),
      wordsStruggling: struggling.map(x => ({ es: x.v.es, en: x.v.en })),
      wordsUnseen: unseen.length,
      confusionPairs,
      avgResponseMs: Math.round(recentResponseMs),
      reviewDue,
      nextReviews,
      minutesPlayed: Math.round(this.data.secondsPlayed / 60),
      creaturesCollected: this.data.creatures.length,
      recommendation,
    };
  }
}

export interface ParentSummary {
  wordsTotal: number;
  wordsFluent: { es: string; en: string }[];
  wordsLearning: { es: string; en: string }[];
  wordsStruggling: { es: string; en: string }[];
  wordsUnseen: number;
  confusionPairs: { wordA: string; wordB: string; count: number }[];
  avgResponseMs: number;
  reviewDue: string[];
  nextReviews: { es: string; daysUntil: number }[];
  minutesPlayed: number;
  creaturesCollected: number;
  recommendation: string;
}
