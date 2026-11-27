/**
 * Hybrid Web Audio API engine for Typewriter:
 * Preloads the 7 real sampled mechanical typewriter WAV files used in the Android IME
 * (key_strike_1..4, key_backspace, key_space_return, key_mode) with natural pitch jitter,
 * and falls back seamlessly to procedural Web Audio synthesis if audio buffers are still loading.
 */
export class MechanicalAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sampleBuffers = new Map<string, AudioBuffer>();
  private loadingPromise: Promise<void> | null = null;
  public enabled = false;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      const len = Math.floor(this.ctx.sampleRate * 0.06);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
      }
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private preloadSamples(ctx: AudioContext): void {
    if (this.loadingPromise) return;
    const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : './';

    const files: Record<string, string> = {
      s1: `${base}audio/key_strike_1.wav`,
      s2: `${base}audio/key_strike_2.wav`,
      s3: `${base}audio/key_strike_3.wav`,
      s4: `${base}audio/key_strike_4.wav`,
      backspace: `${base}audio/key_backspace.wav`,
      space: `${base}audio/key_space_return.wav`,
      mode: `${base}audio/key_mode.wav`,
    };

    this.loadingPromise = Promise.all(
      Object.entries(files).map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arr);
          this.sampleBuffers.set(key, decoded);
        } catch {
          // Procedural synthesis fallback remains active
        }
      }),
    ).then(() => undefined);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      const ctx = this.ensureContext();
      if (ctx) this.preloadSamples(ctx);
    }
  }

  public playKeyStrike(pitchVariance = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.preloadSamples(ctx);

    const strikeIdx = 1 + Math.floor(Math.random() * 4);
    const sampled = this.sampleBuffers.get(`s${strikeIdx}`);
    if (sampled) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = sampled;
        src.playbackRate.value = 0.96 + Math.random() * 0.08 + pitchVariance * 0.02;
        const gain = ctx.createGain();
        gain.gain.value = 0.52;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        return;
      } catch {
        // Fall through to procedural click
      }
    }

    if (!this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400 + pitchVariance * 420, now);
    filter.Q.setValueAtTime(3.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.032);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1180 + pitchVariance * 240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.025);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.035, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.028);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playHeavyCarriage(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.preloadSamples(ctx);

    const sampled = this.sampleBuffers.get('space');
    if (sampled) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = sampled;
        src.playbackRate.value = 0.98 + Math.random() * 0.04;
        const gain = ctx.createGain();
        gain.gain.value = 0.62;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        return;
      } catch {
        // Fall through to procedural thock
      }
    }

    if (!this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(760, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.06);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.noiseBuffer = null;
      this.sampleBuffers.clear();
      this.loadingPromise = null;
    }
  }
}
