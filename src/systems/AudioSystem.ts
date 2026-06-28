/**
 * Procedural sound effects (Web Audio).
 *
 * No external SFX API key is available, so cues are synthesized. For a young
 * audience these are intentionally soft, bright, and major-key — instant
 * positive dopamine, never harsh. "Wrong" is a gentle questioning blip, never
 * a buzzer (the design forbids punishment feedback).
 */
export type Cue = 'tap' | 'correct' | 'wrong' | 'collect' | 'hatch' | 'levelup' | 'sparkle';

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private muted = false;

  constructor() {
    const unlock = () => {
      void this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.context = new Ctx();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    await this.context.resume();
    this.unlocked = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  play(cue: Cue): void {
    switch (cue) {
      case 'tap':
        this.blip(520, 0.06, 'sine', 0.05);
        break;
      case 'correct':
        this.arp([523, 659, 784], 0.1, 'triangle'); // C-E-G major
        break;
      case 'wrong':
        this.blip(500, 0.10, 'sine', 0.04, 380); // gentle "oops" glide, higher pitch
        break;
      case 'collect':
        this.arp([659, 988], 0.09, 'triangle');
        break;
      case 'hatch':
        this.arp([392, 523, 659, 880], 0.12, 'triangle');
        break;
      case 'levelup':
        this.arp([523, 659, 784, 1047, 1319], 0.13, 'triangle');
        break;
      case 'sparkle':
        this.blip(1200, 0.12, 'sine', 0.03, 1900);
        break;
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, peak: number, glideTo?: number): void {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private arp(freqs: number[], step: number, type: OscillatorType): void {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * step;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step + 0.08);
      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + step + 0.1);
    });
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
