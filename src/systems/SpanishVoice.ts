/**
 * Spanish voice via the browser-native Web Speech API (SpeechSynthesis).
 *
 * Why this and not an external TTS API: the asset-credential probe showed no
 * ElevenLabs key, and — more importantly — Web Speech ships real es-ES / es-MX
 * voices in every modern browser, works fully offline (a brief requirement),
 * needs no network, and lets us replay/slow any phrase instantly. For
 * production this layer can be swapped for recorded native-speaker clips behind
 * the same `speak()` interface without touching gameplay code.
 *
 * The child never hears English here; all text passed in is Spanish.
 */

export interface VoiceOptions {
  /** 1 = normal, ~0.7 = slow replay for comprehension support. */
  rate?: number;
  /** Slightly higher pitch reads friendlier to young children. */
  pitch?: number;
  onEnd?: () => void;
}

export class SpanishVoice {
  private readonly synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  private voice: SpeechSynthesisVoice | null = null;
  private lastText = '';
  private muted = false;
  private baseRate = 0.95;

  readonly supported: boolean;

  constructor() {
    this.supported = this.synth !== null;
    if (this.synth) {
      this.pickVoice();
      // Voices load asynchronously in most browsers.
      this.synth.onvoiceschanged = () => this.pickVoice();
    }
  }

  /** Choose the best available Spanish voice; prefer natural-sounding ones. */
  private pickVoice(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
    const pool = spanish.length > 0 ? spanish : voices;

    // Preference order: known high-quality names, then es-ES/es-MX/es-US, then any es.
    const preferredNames = ['google español', 'mónica', 'monica', 'paulina', 'jorge', 'juan', 'helena'];
    const byName = pool.find((v) => preferredNames.some((n) => v.name.toLowerCase().includes(n)));
    const byLang =
      pool.find((v) => /es-(es|mx|us|419)/i.test(v.lang)) ?? pool.find((v) => v.lang.toLowerCase().startsWith('es'));

    this.voice = byName ?? byLang ?? pool[0] ?? null;
  }

  /** Returns true if a real Spanish voice was found (vs. a fallback). */
  hasSpanishVoice(): boolean {
    return Boolean(this.voice && this.voice.lang.toLowerCase().startsWith('es'));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.synth?.cancel();
  }

  /** Lower base rate globally (reduced-stimulation / slow-speech setting). */
  setBaseRate(rate: number): void {
    this.baseRate = rate;
  }

  speak(text: string, opts: VoiceOptions = {}): void {
    this.lastText = text;
    if (!this.synth || this.muted) {
      opts.onEnd?.();
      return;
    }
    // Cancel any in-flight speech so commands never pile up (ADHD pacing).
    this.synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    if (this.voice) utter.voice = this.voice;
    utter.lang = this.voice?.lang ?? 'es-ES';
    utter.rate = (opts.rate ?? 1) * this.baseRate;
    utter.pitch = opts.pitch ?? 1.15;
    utter.volume = 1;
    if (opts.onEnd) utter.onend = () => opts.onEnd?.();
    this.synth.speak(utter);
  }

  /** Slow, clear replay of the last spoken command. */
  replaySlow(): void {
    if (this.lastText) this.speak(this.lastText, { rate: 0.7, pitch: 1.1 });
  }

  replay(): void {
    if (this.lastText) this.speak(this.lastText);
  }

  cancel(): void {
    this.synth?.cancel();
  }

  dispose(): void {
    if (this.synth) {
      this.synth.cancel();
      this.synth.onvoiceschanged = null;
    }
  }
}
