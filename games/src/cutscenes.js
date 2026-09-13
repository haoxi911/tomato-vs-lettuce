// A tiny director: camera moves, subtitles, narration — sequential, skippable.
import { V3, ease, lerp, clamp } from './engine.js';
import { CUES } from './cues.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class Director {
  constructor(engine) { this.e = engine; this.skipped = false; this.running = false; this.cueTimer = null; this.camAnim = null; this._upd = (dt) => this.update(dt); engine.updaters.add(this._upd); engine.persistent.add(this._upd); }
  lookFrom(pos, target, roll = 0) {
    const e = this.e; e.yaw.position.copy(pos); const d = target.clone().sub(pos);
    e.yaw.rotation.y = Math.atan2(-d.x, -d.z); e.pitch.rotation.x = Math.atan2(d.y, Math.hypot(d.x, d.z)); e.camera.rotation.z = roll; e.pitch.position.y = 0;
  }
  update(dt) {
    const a = this.camAnim; if (!a) return; a.t = (performance.now() - a.start) / 1000; const k = this.skipped ? 1 : clamp(a.t / a.dur, 0, 1); const s = a.linear ? k : ease(k);
    const p = a.from.clone().lerp(a.to, s); const l = a.look.clone().lerp(a.lookTo, s); const roll = lerp(a.roll0, a.roll1, s);
    if (a.shake) p.add(V3((Math.random() - .5) * a.shake, (Math.random() - .5) * a.shake, (Math.random() - .5) * a.shake));
    this.lookFrom(p, l, roll); if (k >= 1) { this.camAnim = null; a.done(); }
  }
  cam({ from, to, look, lookTo, dur = 4, roll = 0, rollTo, linear = false, shake = 0 }) {
    return new Promise(res => {
      if (this.camAnim) this.camAnim.done();
      const f = V3(...from), t = V3(...(to || from)), l = V3(...look), lt = V3(...(lookTo || look));
      if (this.skipped) { this.lookFrom(t, lt, rollTo ?? roll); return res(); }
      this.camAnim = { from: f, to: t, look: l, lookTo: lt, dur, roll0: roll, roll1: rollTo ?? roll, linear, shake, t: 0, start: performance.now(), done: res };
    });
  }
  async wait(s) { if (this.skipped) return; const step = 50; let t = 0; while (t < s * 1000 && !this.skipped) { await sleep(step); t += step; } }
  async until(fn, timeout = 60) { let t = 0; while (!fn() && !this.skipped && t < timeout) { await sleep(60); t += 0.06; } }
  sub(text, who = '') { if (this.skipped) return; this.e.subtitle(text, who); }
  clearSub() { this.e.subtitle(''); }
  // play a narration clip with its cues; resolves when the clip ends (or on skip)
  narrate(name, { wait = true, who = 'WILLIAM' } = {}) {
    return new Promise(res => {
      if (this.skipped) return res();
      const cues = CUES[name] || []; let i = 0; const t0 = performance.now();
      const audio = this.e.audio.narration(`audio/${name}.mp3`, () => { clearInterval(this.cueTimer); this.cueTimer = null; this.clearSub(); res(); });
      clearInterval(this.cueTimer);
      this.cueTimer = setInterval(() => {
        if (this.skipped) { clearInterval(this.cueTimer); this.cueTimer = null; this.e.audio.stopNarration(); this.clearSub(); return res(); }
        const t = audio && !isNaN(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : (performance.now() - t0) / 1000;
        while (i < cues.length && cues[i][0] <= t) { this.e.subtitle(cues[i][1], who); i++; }
      }, 80);
      if (!wait) res();
    });
  }
  skip() { this.skipped = true; this.e.audio.stopNarration(); this.clearSub(); if (this.camAnim) { const a = this.camAnim; this.camAnim = null; this.lookFrom(a.to, a.lookTo, a.roll1); a.done(); } }
  begin() { this.skipped = false; this.running = true; this.e.viewmodel.visible = false; this.e.player.controlsOn = false; this.e.setState('cutscene'); this.e.unlock(); }
  // stop a running narration clip AND its subtitle-cue interval (call this to end a kept-alive narration, e.g. on death mid-Scene-5)
  stopNarration() { clearInterval(this.cueTimer); this.cueTimer = null; this.e.audio.stopNarration(); this.clearSub(); }
  // keepNarration: leave the narration clip + its subtitle cues running past the cutscene (they finish on their own) — used when a scene's narration is meant to play over the gameplay
  end({ keepNarration = false } = {}) { this.running = false; if (!keepNarration) this.stopNarration(); this.e.camera.rotation.z = 0; this.e.pitch.position.y = 1.7; this.e.viewmodel.visible = true; if (this.camAnim) { const a = this.camAnim; this.camAnim = null; a.done(); } }
}
