// Neon Harbor — a procedural music loop: a minor-key bass groove, a kick and
// hats, and a sparse synth lead, all scheduled ahead on the WebAudio clock.
// No audio files anywhere: every note is an oscillator, every hat a burst
// of filtered noise from one shared buffer built when the loop starts.
const BPM = 96;
const BASS_ROOTS = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1, one bar each
const LEAD_LICKS = { 0: 220, 3: 261.63, 10: 329.63, 24: 392, 35: 329.63, 48: 261.63, 56: 220 };

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.playing = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.noiseBuf = null;
  }

  start() {
    if (this.playing) return;
    const ctx = this.sfx.ensure();
    if (!ctx) return;
    // One second of white noise, reused for every hat in the loop.
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.scheduleAhead(), 40);
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // Keep about 150 ms of notes queued ahead of the playhead.
  scheduleAhead() {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.playing) return;
    const eighth = 60 / BPM / 2;
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (!this.sfx.muted) this.playStep(this.step, this.nextTime, eighth);
      this.step = (this.step + 1) % 64;
      this.nextTime += eighth;
    }
  }

  // One envelope-shaped oscillator note, placed at an exact clock time.
  noteAt(freq, when, dur, type, vol) {
    const ctx = this.sfx.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  kickAt(when) {
    const ctx = this.sfx.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.11);
    g.gain.setValueAtTime(0.24, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.13);
    o.connect(g).connect(ctx.destination);
    o.start(when);
    o.stop(when + 0.15);
  }

  hatAt(when, dur) {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(when, Math.random() * 0.5, dur + 0.02);
  }

  playStep(step, when, eighth) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    // Bass on the beat, a fifth up on the back half of the bar.
    if (s16 % 4 === 0) this.noteAt(BASS_ROOTS[bar], when, eighth * 3, 'triangle', 0.15);
    if (s16 === 6 || s16 === 14) this.noteAt(BASS_ROOTS[bar] * 2, when, eighth, 'sawtooth', 0.045);
    // Kick on the beat, hats on the off-beats.
    if (s16 % 4 === 0) this.kickAt(when);
    if (s16 % 2 === 1) this.hatAt(when, eighth * 0.5);
    // A sparse lead lick, once or twice a bar.
    const lead = LEAD_LICKS[step];
    if (lead !== undefined) this.noteAt(lead, when, eighth * 2, 'sine', 0.06);
  }
}
