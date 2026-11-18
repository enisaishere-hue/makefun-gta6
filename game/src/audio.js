// Neon Harbor — procedural sound effects, WebAudio only, no audio files.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.sirenOn = false;
    this.sirenNodes = null;
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  tone(freq, dur, type, vol, slideTo) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  noise(dur, vol, lowpass) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }
  shot() { this.noise(0.12, 0.35, 2600); this.tone(180, 0.08, 'square', 0.1, 60); }
  sirenBlip() { this.tone(880, 0.14, 'sine', 0.12, 660); this.tone(660, 0.18, 'sine', 0.12, 880); }
  punch() { this.noise(0.08, 0.25, 900); }
  pickup() { this.tone(660, 0.09, 'sine', 0.14); this.tone(990, 0.12, 'sine', 0.12); }
  cash() { this.tone(880, 0.08, 'sine', 0.14); this.tone(1320, 0.14, 'sine', 0.14); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.16), i * 110)); }
  missionFail() { this.tone(220, 0.4, 'sawtooth', 0.14, 110); }
  crash() { this.noise(0.25, 0.3, 700); }
  busted() { this.tone(440, 0.5, 'sawtooth', 0.14, 220); }
  engineTick() { this.tone(70, 0.05, 'sawtooth', 0.03, 90); }
  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!on) { if (this.sirenNodes) { try { this.sirenNodes.o.stop(); } catch {} this.sirenNodes = null; } return; }
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
    const lg = ctx.createGain(); lg.gain.value = 320;
    lfo.connect(lg).connect(o.frequency);
    g.gain.value = 0.045;
    o.connect(g).connect(ctx.destination);
    o.start(); lfo.start();
    this.sirenNodes = { o, lfo };
  }
}
