/**
 * Content-blind voice activity detection — confirms a sound happened, never
 * what was said. Deliberately NOT SpeechRecognition/transcription: consumer
 * ASR has much higher error rates on child/atypical speech, and grading
 * pronunciation correctness is explicitly out of scope for this game (a
 * lisp/mispronunciation must never register as failure).
 */
export type VadReason = 'sound' | 'timeout' | 'denied' | 'unsupported';

export interface VadResult {
  detected: boolean;
  reason: VadReason;
}

export interface VadOptions {
  sustainedMs?: number;         // total time above threshold (tolerating brief dips) to count as "spoke"
  ambientSampleMs?: number;     // noise-floor calibration window before listening starts
  timeoutMs?: number;           // failsafe — resolves as timeout if nothing heard
  thresholdMultiplier?: number; // multiple of measured ambient RMS to count as sound
  dipToleranceMs?: number;      // how long a below-threshold dip can last before it resets the streak
}

export class VoiceActivityDetector {
  // Session-level cache — once denied, stop prompting/opening the mic again.
  private static permissionDenied = false;

  static get isKnownDenied(): boolean {
    return VoiceActivityDetector.permissionDenied;
  }

  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private raf = 0;

  /**
   * One-time "does the mic work at all" probe — opens, tests, and
   * immediately releases the stream. Call from an explicit user-gesture
   * handler (e.g. the Play button) so any permission prompt appears at a
   * clearly intentional moment, not mid-quest.
   */
  async primePermission(): Promise<boolean> {
    if (VoiceActivityDetector.permissionDenied) return false;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      return true;
    } catch {
      VoiceActivityDetector.permissionDenied = true;
      return false;
    }
  }

  /**
   * Opens a fresh mic stream, calibrates ambient noise, and waits for
   * sustained amplitude above threshold — content-blind, so it cannot fail
   * on pronunciation. Always tears the stream/context down before resolving.
   */
  async listenForSpeech(opts: VadOptions = {}): Promise<VadResult> {
    if (VoiceActivityDetector.permissionDenied) return { detected: false, reason: 'denied' };
    if (!navigator.mediaDevices?.getUserMedia) return { detected: false, reason: 'unsupported' };

    const sustainedMs = opts.sustainedMs ?? 350;
    const ambientSampleMs = opts.ambientSampleMs ?? 400;
    const timeoutMs = opts.timeoutMs ?? 18000;
    const mult = opts.thresholdMultiplier ?? 1.5;
    const dipToleranceMs = opts.dipToleranceMs ?? 200;
    const MIN_THRESHOLD = 0.015;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      VoiceActivityDetector.permissionDenied = true;
      return { detected: false, reason: 'denied' };
    }

    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser); // NOT connected to destination — no echo/feedback
    const buf = new Float32Array(analyser.fftSize);

    const rms = (): number => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    };

    return new Promise(resolve => {
      let done = false;
      const finish = (result: VadResult) => {
        if (done) return;
        done = true;
        this.dispose();
        resolve(result);
      };
      const timeoutHandle = setTimeout(() => finish({ detected: false, reason: 'timeout' }), timeoutMs);

      const startTs = performance.now();
      let noiseFloor = 0;
      let samples = 0;
      // Real speech isn't a flat plateau — it dips below any fixed threshold
      // every syllable or two (consonant closures, brief pauses). Track a
      // burst's start time and only cancel it once a dip has lasted longer
      // than dipToleranceMs, instead of resetting on the very first dip.
      let aboveSince: number | null = null;
      let belowSince: number | null = null;

      const tick = () => {
        if (done) return;
        const elapsed = performance.now() - startTs;
        const level = rms();
        if (elapsed < ambientSampleMs) {
          noiseFloor = (noiseFloor * samples + level) / (samples + 1);
          samples++;
        } else {
          const threshold = Math.max(noiseFloor * mult, MIN_THRESHOLD);
          const now = performance.now();
          if (level > threshold) {
            belowSince = null;
            if (aboveSince === null) aboveSince = now;
            else if (now - aboveSince >= sustainedMs) {
              clearTimeout(timeoutHandle);
              finish({ detected: true, reason: 'sound' });
              return;
            }
          } else if (aboveSince !== null) {
            if (belowSince === null) belowSince = now;
            else if (now - belowSince >= dipToleranceMs) {
              aboveSince = null;
              belowSince = null;
            }
          }
        }
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /** Idempotent — stops mic tracks + closes the AudioContext. Never leaves the mic hot. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.audioCtx && this.audioCtx.state !== 'closed') void this.audioCtx.close();
    this.audioCtx = null;
  }
}
