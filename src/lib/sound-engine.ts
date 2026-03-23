"use client";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  get muted() {
    return this._muted;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    // Load mute preference
    if (typeof window !== "undefined") {
      this._muted = localStorage.getItem("soundMuted") === "true";
    }
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("soundMuted", String(muted));
    }
    if (muted) this.stopAmbient();
  }

  private ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === "suspended") this.ctx.resume();
    return this.ctx!;
  }

  // Short bleep for typewriter characters
  playTypewriterTick() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.value = 0.03;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // Countdown tick — once per second
  playCountdownTick() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = 440;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  // Urgent countdown — faster, higher beeps (< 10s)
  playCountdownUrgent() {
    if (this._muted) return;
    const ctx = this.ensureContext();

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.08);

      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.08);
    }
  }

  // Score reveal — rising tone, pitch based on score
  playScoreReveal(score: number, maxScore: number = 1000) {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const ratio = Math.max(0, Math.min(1, score / maxScore));
    const baseFreq = 200 + ratio * 600;

    // Quick ascending arpeggio
    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.15);

      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.15);
    });
  }

  // Ship departure — ascending sweep
  playShipDepart() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 2);
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2);
  }

  // Burn — descending noise burst
  playBurn() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.value = 1000;
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.5);
    filter.type = "lowpass";
    filter.frequency.value = 2000;
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.5);
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  }

  // Ready-up confirmation beep
  playReady() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // All players ready — go!
  playAllReady() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  }

  // Round transition fanfare
  playRoundStart() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const notes = [392, 523, 659]; // G4, C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.25);
    });
  }

  // Low ambient drone during question phase
  startAmbient() {
    if (this._muted || this.ambientOsc) return;
    const ctx = this.ensureContext();

    this.ambientOsc = ctx.createOscillator();
    this.ambientGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    this.ambientOsc.type = "sawtooth";
    this.ambientOsc.frequency.value = 55; // Low A
    filter.type = "lowpass";
    filter.frequency.value = 200;
    this.ambientGain.gain.value = 0.02;

    // LFO for subtle wobble
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 10;
    lfo.connect(lfoGain).connect(this.ambientOsc.frequency);
    lfo.start();

    this.ambientOsc.connect(filter).connect(this.ambientGain).connect(ctx.destination);
    this.ambientOsc.start();
  }

  stopAmbient() {
    if (this.ambientOsc) {
      try { this.ambientOsc.stop(); } catch { /* already stopped */ }
      this.ambientOsc = null;
    }
    this.ambientGain = null;
  }
}

// Singleton
export const soundEngine = new SoundEngine();
