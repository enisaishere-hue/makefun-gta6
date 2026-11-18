// Procedural sound, made with WebAudio and nothing else: no audio files, no
// network. Engine hum, sirens, gunshots, pickups and mission stings, all
// synthesized. Silent until the first user gesture creates the context.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      sirenTimer = 0;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noise(dur, vol) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    engine(speed, driving) {
      if (!ctx || muted || !engineOsc) return;
      const target = driving ? 0.03 + Math.min(0.05, Math.abs(speed) / 9000) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) / 6, ctx.currentTime, 0.1);
    },
    siren(wanted) {
      if (!ctx || muted || !sirenOsc) return;
      if (wanted > 0) {
        sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.2);
        sirenTimer += 1 / 60;
        sirenOsc.frequency.setTargetAtTime(700 + Math.sin(sirenTimer * 4) * 220, ctx.currentTime, 0.05);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    },
    shot() { noise(0.12, 0.25); blip(180, 0.08, 'square', 0.1); },
    punch() { noise(0.08, 0.15); },
    pickup() { blip(880, 0.12, 'sine', 0.12); blip(1320, 0.16, 'sine', 0.1); },
    mission() { blip(523, 0.14, 'triangle', 0.14); setTimeout(() => blip(659, 0.14, 'triangle', 0.14), 130); setTimeout(() => blip(784, 0.22, 'triangle', 0.14), 260); },
    busted() { blip(220, 0.3, 'sawtooth', 0.14); setTimeout(() => blip(165, 0.4, 'sawtooth', 0.14), 250); },
    crime() { blip(1100, 0.09, 'square', 0.07); },
  };
}
