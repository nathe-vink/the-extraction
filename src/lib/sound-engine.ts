"use client";

// Note frequencies for melody generation
const NOTE = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99,
};

// 8-bit space melody — a catchy minor key loop (think cantina meets space invaders)
const MELODY_NOTES: [number, number][] = [
  // Bar 1
  [NOTE.Eb4, 0.25], [NOTE.G4, 0.25], [NOTE.Bb4, 0.25], [NOTE.G4, 0.25],
  // Bar 2
  [NOTE.Ab4, 0.25], [NOTE.F4, 0.125], [NOTE.Ab4, 0.125], [NOTE.G4, 0.5],
  // Bar 3
  [NOTE.Eb4, 0.25], [NOTE.G4, 0.25], [NOTE.Bb4, 0.125], [NOTE.C5, 0.125], [NOTE.Bb4, 0.25],
  // Bar 4
  [NOTE.Ab4, 0.25], [NOTE.G4, 0.25], [NOTE.F4, 0.25], [NOTE.Eb4, 0.25],
  // Bar 5
  [NOTE.F4, 0.25], [NOTE.Ab4, 0.25], [NOTE.G4, 0.25], [NOTE.F4, 0.25],
  // Bar 6
  [NOTE.Eb4, 0.25], [NOTE.G4, 0.125], [NOTE.Eb4, 0.125], [NOTE.Bb3, 0.5],
  // Bar 7
  [NOTE.Eb4, 0.125], [NOTE.Eb4, 0.125], [NOTE.G4, 0.25], [NOTE.Bb4, 0.25], [NOTE.Ab4, 0.25],
  // Bar 8
  [NOTE.G4, 0.25], [NOTE.F4, 0.25], [NOTE.Eb4, 0.25], [0, 0.25], // rest
];

const BASS_NOTES: [number, number][] = [
  [NOTE.Eb3, 1], [NOTE.Ab3, 1], [NOTE.Eb3, 1], [NOTE.Bb3, 0.5], [NOTE.Ab3, 0.5],
  [NOTE.F3, 1], [NOTE.Eb3, 1], [NOTE.Eb3, 0.5], [NOTE.G3, 0.5], [NOTE.Ab3, 0.5], [NOTE.Bb3, 0.5],
];

// Alien voice pitch range (Banjo-Kazooie style)
const ALIEN_PITCHES = [280, 320, 360, 300, 340, 260, 380, 310, 290, 350];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private _muted: boolean = false;
  private melodyTimeout: ReturnType<typeof setTimeout> | null = null;
  private melodyPlaying: boolean = false;
  private melodyIndex: number = 0;
  private bassIndex: number = 0;
  private bassTimeout: ReturnType<typeof setTimeout> | null = null;
  private _tempo: number = 120; // BPM
  private melodyGain: GainNode | null = null;

  get muted() {
    return this._muted;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    if (typeof window !== "undefined") {
      this._muted = localStorage.getItem("soundMuted") === "true";
    }
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("soundMuted", String(muted));
    }
    if (muted) this.stopMelody();
  }

  private ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === "suspended") this.ctx.resume();
    return this.ctx!;
  }

  // === ALIEN VOICE (Banjo-Kazooie style bleeps) ===
  playAlienBleep() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const pitch = ALIEN_PITCHES[Math.floor(Math.random() * ALIEN_PITCHES.length)];
    const duration = 0.06 + Math.random() * 0.04;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = pitch;
    // Quick pitch slide for character
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(pitch * (0.9 + Math.random() * 0.2), ctx.currentTime + duration);

    gain.gain.value = 0.06;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // Word-level bleep for typewriter — now uses alien bleeps
  playTypewriterTick() {
    this.playAlienBleep();
  }

  // Countdown tick
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

  // === 8-BIT MELODY SYSTEM ===

  private playNote(freq: number, duration: number, type: OscillatorType, volume: number, delay: number = 0) {
    if (!freq || this._muted) return; // freq 0 = rest
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration * 0.9);

    if (this.melodyGain) {
      osc.connect(gain).connect(this.melodyGain).connect(ctx.destination);
    } else {
      osc.connect(gain).connect(ctx.destination);
    }
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  }

  private scheduleMelodyNote() {
    if (!this.melodyPlaying || this._muted) return;

    const beatDuration = 60 / this._tempo; // seconds per beat
    const [freq, beats] = MELODY_NOTES[this.melodyIndex];
    const duration = beats * beatDuration;

    this.playNote(freq, duration, "square", 0.04);

    this.melodyIndex = (this.melodyIndex + 1) % MELODY_NOTES.length;
    this.melodyTimeout = setTimeout(() => this.scheduleMelodyNote(), duration * 1000);
  }

  private scheduleBassNote() {
    if (!this.melodyPlaying || this._muted) return;

    const beatDuration = 60 / this._tempo;
    const [freq, beats] = BASS_NOTES[this.bassIndex];
    const duration = beats * beatDuration;

    this.playNote(freq, duration, "triangle", 0.03);

    this.bassIndex = (this.bassIndex + 1) % BASS_NOTES.length;
    this.bassTimeout = setTimeout(() => this.scheduleBassNote(), duration * 1000);
  }

  startMelody() {
    if (this._muted || this.melodyPlaying) return;
    const ctx = this.ensureContext();
    this.melodyPlaying = true;
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this._tempo = 120;

    this.melodyGain = ctx.createGain();
    this.melodyGain.gain.value = 1;
    this.melodyGain.connect(ctx.destination);

    this.scheduleMelodyNote();
    this.scheduleBassNote();
  }

  stopMelody() {
    this.melodyPlaying = false;
    if (this.melodyTimeout) { clearTimeout(this.melodyTimeout); this.melodyTimeout = null; }
    if (this.bassTimeout) { clearTimeout(this.bassTimeout); this.bassTimeout = null; }
    this.melodyGain = null;
  }

  setMelodyTempo(bpm: number) {
    this._tempo = bpm;
  }

  // Ramp extend sound
  playRampExtend() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 100;
    osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.8);
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  }

  // Charge-up sound
  playChargeUp() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 80;
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 2);
    gain.gain.value = 0.04;
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 2);
  }

  // Engine blast sound
  playEngineBlast() {
    if (this._muted) return;
    const ctx = this.ensureContext();
    // White noise burst
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.5);
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  // Legacy ambient methods — now redirect to melody
  startAmbient() {
    this.startMelody();
  }

  stopAmbient() {
    this.stopMelody();
  }
}

// Singleton
export const soundEngine = new SoundEngine();
