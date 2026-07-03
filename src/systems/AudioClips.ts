/**
 * AudioClips — file-first Spanish audio player.
 *
 * Loads the manifest of pre-generated MP3 clips (ElevenLabs es-MX kid voice) and
 * plays them via HTMLAudioElement. Falls back to the SpanishVoice TTS wrapper
 * for any clip not yet generated (e.g. dynamic counting sentences).
 *
 * All public methods return a Promise that resolves when the audio finishes,
 * so callers can await the intro clip before triggering the quest command.
 */
import { SpanishVoice } from './SpanishVoice';

export type ClipId = string;

export class AudioClips {
  private available = new Set<string>();
  private readonly elements = new Map<string, HTMLAudioElement>();
  private readonly voice: SpanishVoice;
  private muted = false;
  private ready = false;
  private rate = 1;
  // Resolvers for any play() promise currently in flight — el.pause() (used by
  // cancel()) does NOT fire 'ended', so without this a cancelled clip's promise
  // (and any onEnd callback chained off it, e.g. a phase transition) would hang
  // forever instead of resolving.
  private pendingResolves = new Set<() => void>();

  constructor(voice: SpanishVoice) {
    this.voice = voice;
  }

  /** Slow down (or restore) playback of pre-baked clips. Pitch is preserved
   *  by the browser (HTMLMediaElement defaults preservesPitch to true), so
   *  this reads as "talking slower," not chipmunk/deepened audio. */
  setRate(rate: number): void {
    this.rate = rate;
    for (const el of this.elements.values()) el.playbackRate = rate;
  }

  /** Load manifest. Call once before the game starts. */
  async init(): Promise<void> {
    try {
      const resp = await fetch('/audio/manifest.json');
      if (resp.ok) {
        const ids: string[] = await resp.json();
        for (const id of ids) this.available.add(id);
      }
    } catch {
      // No manifest — everything falls back to TTS
    }
    this.ready = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.voice.setMuted(muted);
    if (muted) {
      for (const el of this.elements.values()) {
        el.pause();
        el.currentTime = 0;
      }
    }
  }

  /** Play a pre-baked clip. Returns a promise that resolves when audio ends. */
  play(id: ClipId): Promise<void> {
    if (this.muted) return Promise.resolve();
    if (!this.ready || !this.available.has(id)) return Promise.resolve();

    return new Promise((resolve) => {
      let el = this.elements.get(id);
      if (!el) {
        el = new Audio(`/audio/${id}.mp3`);
        this.elements.set(id, el);
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.pendingResolves.delete(finish);
        resolve();
      };
      this.pendingResolves.add(finish);
      el.playbackRate = this.rate;
      el.currentTime = 0;
      el.onended = finish;
      el.onerror = finish; // silent fallback
      el.play().catch(finish);
    });
  }

  /** Speak Spanish text, preferring a pre-baked clip, falling back to TTS. */
  speak(id: ClipId, fallbackText: string, opts: { onEnd?: () => void } = {}): void {
    if (this.muted) { opts.onEnd?.(); return; }

    if (this.ready && this.available.has(id)) {
      void this.play(id).then(() => opts.onEnd?.());
    } else {
      this.voice.speak(fallbackText, { onEnd: opts.onEnd });
    }
  }

  /** Awaitable version — resolves after clip or TTS ends (with 7s safety timeout). */
  speakAsync(id: ClipId, fallbackText: string): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const t = setTimeout(finish, 7000); // never hang longer than 7s
      this.speak(id, fallbackText, { onEnd: () => { clearTimeout(t); finish(); } });
    });
  }

  /** Stop all currently playing clips. */
  cancel(): void {
    for (const el of this.elements.values()) {
      el.pause();
      el.currentTime = 0;
    }
    // el.pause() doesn't fire 'ended' — resolve any in-flight play() promises
    // (and whatever onEnd callback / phase transition is chained off them)
    // directly, so cancelling a clip can never leave a caller hanging forever.
    for (const finish of [...this.pendingResolves]) finish();
    this.voice.cancel();
  }

  hasClip(id: ClipId): boolean {
    return this.available.has(id);
  }

  dispose(): void {
    this.cancel();
    this.elements.clear();
    this.voice.dispose();
  }
}
