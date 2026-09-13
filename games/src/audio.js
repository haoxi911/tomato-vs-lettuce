// Web Audio: synthesised effects (no files) + William's narration clips.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.noise = null; this.loops = new Map(); this.muted = false;
    this.narr = null; this.narrVol = 1;
  }
  boot() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
    const n = Math.floor(this.ctx.sampleRate * 2); this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  // --- primitives
  burst(dur, f0, f1, gain, type = 'lowpass', q = 1, pan = 0, delay = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    s.connect(f); f.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  tone(f0, f1, dur, type = 'sine', gain = 0.2, pan = 0, delay = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(this.master); } else g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  loop(name, make) {
    if (!this.ctx || this.loops.has(name)) return;
    const nodes = make(this.ctx); this.loops.set(name, nodes);
  }
  stopLoop(name, fade = 0.3) {
    const l = this.loops.get(name); if (!l) return; this.loops.delete(name);
    try { l.gain.gain.setTargetAtTime(0, this.t, fade / 3); l.sources.forEach(s => s.stop(this.t + fade + 0.2)); } catch (e) { }
  }
  stopAllLoops() { for (const k of [...this.loops.keys()]) this.stopLoop(k); }
  noiseLoop(freq, q, gain, type = 'lowpass') {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, c.currentTime, 0.4);
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    return { sources: [s], gain: g, filter: f };
  }
  humLoop(freq, gain, type = 'sine') {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, c.currentTime, 0.5);
    o.connect(g); g.connect(this.master); o.start();
    return { sources: [o], gain: g, osc: o };
  }
  // --- named effects
  shot(pan = 0) { this.burst(0.09, 3800, 500, 0.5, 'bandpass', 0.8, pan); this.tone(180, 60, 0.08, 'square', 0.12, pan); }
  enemyShot(pan = 0) { this.burst(0.08, 2600, 400, 0.22, 'bandpass', 1, pan); }
  reload() { this.tone(900, 500, 0.05, 'square', 0.08); this.tone(600, 900, 0.06, 'square', 0.08, 0, 0.35); this.burst(0.05, 5000, 2000, 0.12, 'highpass', 1, 0, 0.7); }
  dry() { this.tone(500, 380, 0.05, 'square', 0.1); }
  hit() { this.tone(1600, 900, 0.05, 'square', 0.12); }
  shieldHit(laser = false) { if (laser) { this.tone(1200, 400, 0.25, 'square', 0.12); this.burst(0.2, 3000, 800, 0.12); } else this.tone(900, 700, 0.06, 'square', 0.08); }
  hurt() { this.burst(0.25, 500, 90, 0.35); this.tone(140, 60, 0.3, 'sawtooth', 0.14); }
  explode(size = 1, pan = 0) {
    this.burst(0.9 * size, 900, 50, 0.7, 'lowpass', 1, pan); this.tone(90, 28, 0.8 * size, 'sine', 0.6, pan);
    this.burst(0.35, 4000, 600, 0.22, 'bandpass', 1, pan, 0.03);
  }
  bigBoom() { this.explode(2.2); this.tone(60, 22, 3.5, 'sine', 0.8); this.burst(3.5, 400, 40, 0.5); }
  laserCharge(dur = 1.3) { this.tone(240, 1900, dur, 'sawtooth', 0.07); }
  laserFire(pan = 0) { this.tone(1900, 300, 0.35, 'sawtooth', 0.2, pan); this.burst(0.3, 6000, 1500, 0.15, 'highpass', 1, pan); }
  zap() { this.tone(1200, 200, 0.12, 'square', 0.1); }
  missileLaunch() { this.burst(2.4, 700, 120, 0.55); this.tone(70, 40, 2, 'sawtooth', 0.15); }
  whoosh(pan = 0) { this.burst(0.7, 1800, 300, 0.25, 'bandpass', 2, pan); }
  alarm(times = 3, base = 430) {
    if (!this.ctx) return; const c = this.ctx; for (let k = 0; k < times; k++) {
      const t = c.currentTime + k * 0.66 + 0.05, o = c.createOscillator(); o.type = 'sawtooth';
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500; const g = c.createGain();
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.55, t + 0.26); o.frequency.linearRampToValueAtTime(base, t + 0.52);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.06); g.gain.setValueAtTime(0.12, t + 0.44); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.6);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.66);
    }
  }
  step() { this.burst(0.06, 900, 200, 0.08); }
  pickup() { this.tone(660, 990, 0.09, 'square', 0.1); this.tone(990, 1320, 0.12, 'square', 0.1, 0, 0.09); }
  objective() { this.tone(523, 523, 0.1, 'square', 0.08); this.tone(659, 659, 0.1, 'square', 0.08, 0, 0.11); this.tone(784, 784, 0.16, 'square', 0.09, 0, 0.22); }
  fail() { this.tone(300, 120, 0.8, 'sawtooth', 0.14); }
  hiss(dur = 1.2) { this.burst(dur, 7000, 4000, 0.3, 'highpass'); }
  crack() { this.burst(0.05, 5000, 2500, 0.2, 'highpass'); }
  // --- ambience loops
  ambWind(g = 0.05) { this.loop('wind', c => this.noiseLoop(420, 1, g)); }
  ambDrone(g = 0.06) { this.loop('drone', c => { const n = this.humLoop(140, g, 'sawtooth'); const l = c.createOscillator(); l.frequency.value = 9; const la = c.createGain(); la.gain.value = g * 0.6; l.connect(la); la.connect(n.gain.gain); l.start(); n.sources.push(l); return n; }); }
  ambHeli(g = 0.09) { this.loop('heli', c => { const n = this.noiseLoop(160, 6, g, 'bandpass'); const l = c.createOscillator(); l.frequency.value = 11; const la = c.createGain(); la.gain.value = g * 0.9; l.connect(la); la.connect(n.gain.gain); l.start(); n.sources.push(l); return n; }); }
  ambReactor(g = 0.1) { this.loop('reactor', c => this.humLoop(58, g)); }
  ambFire(g = 0.07) { this.loop('fire', c => this.noiseLoop(700, 3, g, 'bandpass')); }
  ambUnderground(g = 0.05) { this.loop('under', c => this.noiseLoop(200, 1, g)); }

  // --- narration (William)
  narration(file, onEnd) {
    this.stopNarration();
    const a = new Audio(file); a.preload = 'auto'; a.volume = this.narrVol; this.narr = a;
    let done = false; const fin = () => { if (done) return; done = true; if (this.narr === a) this.narr = null; onEnd && onEnd(); };
    a.addEventListener('ended', fin); a.addEventListener('error', fin);
    const p = a.play(); if (p && p.catch) p.catch(fin);
    return a;
  }
  stopNarration() { if (this.narr) { try { this.narr.pause(); } catch (e) { } this.narr = null; } }
  duck(on) { if (!this.master) return; this.master.gain.setTargetAtTime(on ? 0.22 : 0.55, this.t, 0.2); }
}
