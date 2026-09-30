import type { SoundSpec } from './map';

/**
 * Everything the visitor hears is synthesized here with the Web Audio API:
 * a slow two-oscillator drone, a soft pulse whose tempo follows the network,
 * and one short synthesized gesture per event. No samples, no music files.
 *
 * The AudioContext is only created inside start(), which the app calls from
 * the Play button's click handler, so nothing sounds before the visitor asks.
 */
export class SwarmAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneNodes: AudioScheduledSourceNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  private volume = 0.7;
  private muted = false;
  private running = false;

  private bpm = 72;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private schedulerHandle: number | null = null;
  private beatTimeouts = new Set<number>();

  /** Called on the main thread roughly when each beat sounds. */
  onBeat: ((beat: number) => void) | null = null;

  get isRunning(): boolean {
    return this.running;
  }

  /** True when the browser can build an AudioContext at all. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  }

  async start(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);

      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 12;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.2;
      limiter.connect(this.master);

      this.voiceBus = this.ctx.createGain();
      this.voiceBus.gain.value = 1;
      this.voiceBus.connect(limiter);

      this.noiseBuffer = makeNoise(this.ctx);
      this.buildDrone(limiter);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.running = true;
    this.applyMasterGain(0.6);
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.beatIndex = 0;
    if (this.schedulerHandle === null) {
      this.schedulerHandle = window.setInterval(() => this.schedule(), 100);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.schedulerHandle !== null) {
      window.clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
    for (const handle of this.beatTimeouts) window.clearTimeout(handle);
    this.beatTimeouts.clear();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.15);
    const ctx = this.ctx;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    if (!this.running && ctx.state === 'running') await ctx.suspend();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain(0.1);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain(0.05);
  }

  setTempo(bpm: number): void {
    this.bpm = Math.max(30, Math.min(160, bpm));
  }

  /** Play one event gesture now. Silently ignored while stopped. */
  play(spec: SoundSpec): void {
    if (!this.running || !this.ctx || !this.voiceBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const out = this.voiceBus;
    switch (spec.id) {
      case 'job':
        this.tone(out, spec.frequency, t, 1.6, 0.18, 'triangle');
        this.tone(out, spec.frequency * 1.25, t + 0.06, 1.5, 0.14, 'triangle');
        this.tone(out, spec.frequency * 1.5, t + 0.12, 1.4, 0.12, 'triangle');
        break;
      case 'accepted':
        this.pluck(out, spec.frequency, t, 0.9, 0.22);
        break;
      case 'working':
        this.breath(out, spec.frequency, t, 1.2, 0.16);
        break;
      case 'rejected':
        this.tone(out, spec.frequency, t, 1.2, 0.16, 'sine');
        this.tone(out, spec.frequency * 1.2, t, 1.2, 0.12, 'sine');
        break;
      case 'completed':
        [1, 1.25, 1.5, 2].forEach((ratio, i) => {
          this.pluck(out, spec.frequency * ratio, t + i * 0.13, 1.1, 0.18);
        });
        break;
      case 'failed':
        this.slide(out, spec.frequency, spec.frequency * 0.66, t, 0.9, 0.16);
        break;
      case 'joined':
      case 'left':
        this.tick(out, spec.frequency, t, 0.12);
        break;
      case 'site':
        [1, 1.26, 1.5, 2].forEach((ratio, i) => {
          this.tone(out, spec.frequency * ratio, t + i * 0.05, 2.4, 0.05, 'sine', 0.5);
        });
        break;
    }
  }

  private applyMasterGain(seconds: number): void {
    if (!this.ctx || !this.master) return;
    const target = this.running && !this.muted ? this.volume * 0.9 : 0;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, seconds);
  }

  private buildDrone(destination: AudioNode): void {
    const ctx = this.ctx!;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.045;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    filter.connect(this.droneGain);
    this.droneGain.connect(destination);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 120;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    const voices: Array<[OscillatorType, number, number]> = [
      ['sawtooth', 55, -4],
      ['sawtooth', 55, 4],
      ['triangle', 82.5, 0],
      ['sine', 110, 2],
    ];
    for (const [type, frequency, detune] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
      this.droneNodes.push(osc);
    }
    this.droneNodes.push(lfo);
  }

  private schedule(): void {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    const lookahead = 0.25;
    while (this.nextBeatTime < ctx.currentTime + lookahead) {
      const beat = this.beatIndex;
      const when = this.nextBeatTime;
      this.pulse(beat, when);
      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      const handle = window.setTimeout(() => {
        this.beatTimeouts.delete(handle);
        this.onBeat?.(beat);
      }, delay);
      this.beatTimeouts.add(handle);
      this.nextBeatTime += 60 / this.bpm;
      this.beatIndex += 1;
    }
  }

  private pulse(beat: number, when: number): void {
    const ctx = this.ctx!;
    const out = this.voiceBus!;
    const downbeat = beat % 4 === 0;
    if (beat % 2 === 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(downbeat ? 70 : 62, when);
      osc.frequency.exponentialRampToValueAtTime(38, when + 0.18);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(downbeat ? 0.32 : 0.2, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.26);
      osc.connect(gain);
      gain.connect(out);
      osc.start(when);
      osc.stop(when + 0.3);
    }
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(beat % 2 === 1 ? 0.05 : 0.025, when + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(out);
      src.start(when);
      src.stop(when + 0.06);
    }
  }

  private tone(
    out: AudioNode,
    frequency: number,
    when: number,
    seconds: number,
    peak: number,
    type: OscillatorType,
    attack = 0.02,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + seconds + 0.05);
  }

  private pluck(out: AudioNode, frequency: number, when: number, seconds: number, peak: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency * 6, when);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, when + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + seconds + 0.05);
  }

  private breath(out: AudioNode, frequency: number, when: number, seconds: number, peak: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(frequency, when);
    bp.frequency.exponentialRampToValueAtTime(frequency * 2, when + seconds);
    bp.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + seconds * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(when);
    src.stop(when + seconds + 0.05);
  }

  private slide(
    out: AudioNode,
    from: number,
    to: number,
    when: number,
    seconds: number,
    peak: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(to, when + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + seconds);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + seconds + 0.05);
  }

  private tick(out: AudioNode, frequency: number, when: number, peak: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + 0.12);
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
