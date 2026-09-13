// BATTLE mode: one open fight on the field, with a rank that grows across battles and unlocks new ways to fight.
import * as THREE from 'three';
import { C, mat, emissive, box, cyl, makeGlow, makeJet, makeHatch, makeC4, makePad, makeWirePanel, makeSoldier, poseSoldier } from './art.js';
import { V3, rand, clamp, lerp } from './engine.js';
import { Level, Level5 } from './levels.js';
import { buildField, FIELD, roofPoint } from './field.js';
import { Drone, Trooper, Heli, ArcMissile, LaserPod, HealthPack, Bomb, Generator, EnemyJet, PlayerRocket, SafeBoxGuy, Actor } from './actors.js';

// ---------------------------------------------------------------- rank / XP (persists in the browser)
const XP_KEY = 'tvl.xp';
export const RANK = {
  e: null, session: 0,
  xpFor(n) { return 20 * n * n; },                       // rank 5 = 500 xp, rank 10 = 2000, rank 20 = 8000
  xp() { try { return parseInt(localStorage.getItem(XP_KEY) || '0', 10) || 0; } catch (_) { return 0; } },
  setXp(v) { try { localStorage.setItem(XP_KEY, String(Math.max(0, Math.floor(v)))); } catch (_) { } },
  rank(xp = this.xp()) { let n = 1; while (n < 99 && xp >= this.xpFor(n + 1)) n++; return n; },
  unlocks: [
    { lv: 1, name: 'GROUND SOLDIER', text: 'Rifle, shield, silo missile and the one-shot nuke.' },
    { lv: 5, name: 'PARACHUTE', text: 'Step on the yellow pad by our base: a drone lifts you up and you jump.' },
    { lv: 10, name: 'JET + C4', text: 'Fly the jet from the red pad, and blow the hatch under the Lettuce silo.' },
    { lv: 20, name: 'SPY', text: 'Press G for a Lettuce uniform. They ignore you — until you shoot or get too close.' },
  ],
  has(lv) { return this.rank() >= lv; },
  nextUnlock(r = this.rank()) { return this.unlocks.find(u => u.lv > r) || null; },
  hud() {
    const e = this.e; if (!e) return; const xp = this.xp(), r = this.rank(xp); const lo = this.xpFor(r), hi = this.xpFor(r + 1);
    e.setRank(`RANK ${r} · ${xp - lo} / ${hi - lo} XP`, (xp - lo) / (hi - lo));
  },
  award(n, why = '') {
    const before = this.rank(); const xp = this.xp() + n; this.setXp(xp); this.session += n; this.hud();
    const after = this.rank(xp);
    if (this.e && why) this.e.toast(`+${n} XP`, why.toUpperCase(), 1.3);
    if (after > before && this.e) { const u = this.unlocks.find(u => u.lv === after); this.e.audio.objective(); setTimeout(() => this.e.toast(`RANK ${after}`, u ? `${u.name} UNLOCKED` : 'KEEP GOING', 3.2), 1400); this.onRankUp && this.onRankUp(after); }
  },
};

// ---------------------------------------------------------------- super points: one per finished war, spent at the supply depot
const SUPER_KEY = 'tvl.super';
export const SUPER = {
  e: null,
  items: [
    { id: 'rocket', kind: 'weapon', name: 'ROCKET LAUNCHER', text: 'Four rockets, then reload. Slow, loud, and it does not care where it lands. Press 2 to switch, 1 for the rifle.' },
    { id: 'laser', kind: 'weapon', name: 'LASER RIFLE', text: 'A Lettuce laser gun rebuilt Tomato-style: no bullets, just a beam that keeps cutting while you hold the button.' },
    { id: 'ryley', kind: 'character', name: 'RYLEY', text: 'Play as the SWAT diver. Tougher (130 health) and quicker on his feet.' },
    { id: 'king', kind: 'character', name: 'THE TOMATO KING', text: 'Play as the King himself. His shield stops everything from the front, and the royal med kit heals +70 every 6 seconds.' },
  ],
  load() { try { const d = JSON.parse(localStorage.getItem(SUPER_KEY) || '{}'); return { pts: d.pts || 0, owned: d.owned || [], weapon: d.weapon || 'rifle', character: d.character || 'tom', total: d.total || 0 }; } catch (_) { return { pts: 0, owned: [], weapon: 'rifle', character: 'tom', total: 0 }; } },
  save(d) { try { localStorage.setItem(SUPER_KEY, JSON.stringify(d)); } catch (_) { } },
  earn(n = 1) { const d = this.load(); d.pts += n; d.total += n; this.save(d); this.onChange && this.onChange(d); return d; },
  owns(id) { return this.load().owned.includes(id); },
  buy(id) { const d = this.load(); const it = this.items.find(i => i.id === id); if (!it || d.pts < 1 || d.owned.includes(id)) return false; d.pts--; d.owned.push(id); this.save(d); this.equip(id); return true; },
  equip(id) { const d = this.load(); const it = this.items.find(i => i.id === id); if (id === 'rifle') d.weapon = 'rifle'; else if (id === 'tom') d.character = 'tom'; else if (it && d.owned.includes(id)) { if (it.kind === 'weapon') d.weapon = id; else d.character = id; } this.save(d); this.apply(); this.onChange && this.onChange(d); },
  apply() { const d = this.load(); if (this.e) this.e.loadout = { weapon: d.weapon, character: d.character }; },
};

// ---------------------------------------------------------------- the surface battle
export class Battle extends Level {
  constructor(g) { super(g); this.id = 'battle'; this.title = 'Battle for the Field'; this.beat = 'BATTLE · THE WHOLE WAR AT ONCE'; this.retryPhase = 'morning'; }
  build() {
    const e = this.e; e.clearWorld(); this.refs = buildField(e, { phase: 'morning' }); e.setTimeOfDay('morning'); e.spawn(FIELD.tomatoX + 30, 0, 16, -90);
    e.jetBounds = { x1: -140, x2: 140, z1: -110, z2: 110 };
    const r = this.refs;
    // generators on both sides
    this.genT = new Generator(e, { x: FIELD.tomatoX + 14, z: -26, color: C.tomato, friendly: true, yaw: 0.4 });
    this.genL = new Generator(e, { x: FIELD.lettuceX - 14, z: 26, color: C.lettuce, friendly: false, yaw: Math.PI + 0.4 });
    this.genL.onDeath = () => { RANK.award(40, 'Lettuce generator down'); e.toast('LETTUCE POWER IS OUT', 'NO JETS, NO MISSILES FOR THEM — FOR A WHILE', 3); this.lettuceRepairT = 60; };
    this.genL.onRepair = () => { e.toast('LETTUCE ENGINEERS', 'THEIR GENERATOR IS BACK', 2.6); };
    this.genT.onDeath = () => { e.toast('OUR POWER IS OUT', 'NO MISSILE, NO JET — REPAIR THE GENERATOR (HOLD E)', 3.5); e.audio.alarm(4, 400); this.updateOrders(); };
    this.genT.onRepair = () => { RANK.award(20, 'Generator repaired'); e.toast('POWER RESTORED', '', 2); this.updateOrders(); };
    // laser pods on the lettuce roof (optional targets, worth xp)
    this.pods = [[-10, 5], [-10, -5]].map(([lx, lz]) => { const p = roofPoint(r.lettuceBase, lx, lz); return new LaserPod(e, { x: p.x, y: p.y, z: p.z, period: 4.6 }); });
    for (const p of this.pods) p.onDeath = () => RANK.award(25, 'Laser gun destroyed');
    // pads: parachute (yellow) and jet (red), by the tomato base
    this.chutePad = makePad(C.scarf, 4); this.chutePad.position.set(FIELD.tomatoX + 18, 0, 20); e.world.add(this.chutePad);
    this.jetPad = makePad(C.tomato, 5.5); this.jetPad.position.set(FIELD.tomatoX + 24, 0, 36); e.world.add(this.jetPad);
    this.parkedJet = makeJet(C.tomato); this.parkedJet.scale.setScalar(0.8); this.parkedJet.position.set(FIELD.tomatoX + 24, 1.2, 36); this.parkedJet.rotation.y = 0; this.parkedJet.userData.flame.visible = false; this.parkedJet.userData.flame2.visible = false; e.world.add(this.parkedJet);
    this.jetReadyT = 0;
    // silo console: a post with a big red button beside our silo
    const con = new THREE.Group(); con.position.set(FIELD.tomatoSiloX + 9, 0, 6); e.world.add(con); this.consolePos = con.position.clone();
    con.add(box(1.6, 1.2, 1.2, C.steel).translateY(0.6)); con.add(box(1.2, 0.6, 1.0, C.steelLight).translateY(1.5));
    const btn = cyl(0.3, 0.3, 0.16, C.tomato, 12); btn.position.set(0, 1.9, 0); con.add(btn); this.consoleBtn = btn;
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.05), emissive(C.laser, 0.8)); scr.position.set(0, 1.45, 0.52); con.add(scr); this.consoleScreen = scr;
    // the hatch under the lettuce silo
    this.hatch = makeHatch(); this.hatch.position.set(FIELD.lettuceSiloX + 12, 0, 0); e.world.add(this.hatch); e.addCollider(FIELD.lettuceSiloX + 12, 0, 6, 6, 1); this.hatchCollider = e.colliders[e.colliders.length - 1];
    // health packs
    for (const [x, z] of [[-40, 22], [-30, -18], [-8, 26], [-4, -24], [14, 8], [26, -26], [36, 20]]) new HealthPack(e, { x, z });
    // state
    this.missileT = 0; this.missileCd = 180; this.nukeUsed = false; this.nukeArmed = false; this.lettuceRepairT = 0; this.repairHold = 0;
    this.spawnedTroops = 0; this.spawnedDrones = 0; this.spawnedJets = 0; this.heliDone = false; this.c4 = null; this.hatchOpen = false;
    this.quota = { troops: 12, air: 6 };
    e.onBlast = (pos, dmg, radius, kind) => this.onBlast(pos, dmg, radius, kind);
    e.onJetFire = (origin, dir) => { new PlayerRocket(e, origin, dir); e.audio.shot && e.audio.shot(0.3); };
    e.onJetEnd = (reason, pos) => { if (reason === 'reset') return; e.startChute(pos.x, Math.max(pos.y, 12), pos.z); e.toast(reason === 'crash' ? 'CRASHED' : 'BAILED OUT', 'PARACHUTE OPEN', 2); this.jetReadyT = 35; };
    e.onDisguiseRequest = () => {
      const p = e.player; if (p.disguised) { e.setDisguise(false); e.toast('UNIFORM OFF', '', 1.4); return; }
      if (!RANK.has(20)) { e.hint('The spy uniform unlocks at <b>rank 20</b>.', 3); return; }
      if (p.disguiseCd > 0) { e.hint(`They are still on alert — <b>${Math.ceil(p.disguiseCd)}s</b>`, 2); return; }
      if (p.mode !== 'foot') return; e.setDisguise(true); e.toast('UNDERCOVER', 'LETTUCE UNIFORM ON · DO NOT SHOOT, DO NOT GET CLOSE', 3);
    };
  }
  ambient() { this.e.audio.ambWind(); }
  async intro() {
    const e = this.e, d = this.dir; d.begin(); e.audio.ambWind(); await e.fade(0, 1);
    const r = RANK.rank();
    d.sub(`Rank ${r}. ${RANK.unlocks.filter(u => u.lv <= r).map(u => u.name).join(' · ')}.`, 'TOM');
    await d.cam({ from: [FIELD.tomatoX + 10, 26, 60], to: [FIELD.tomatoX + 22, 8, 20], look: [0, 6, 0], lookTo: [FIELD.lettuceX, 8, 0], dur: 6 });
    d.sub('Clear every Lettuce soldier and every aircraft. Then the silo will let you fire the nuke — once.', '');
    await d.cam({ from: [FIELD.tomatoX + 22, 8, 20], to: [FIELD.tomatoX + 30, 1.7, 16], look: [FIELD.lettuceX, 8, 0], lookTo: [FIELD.lettuceX, 6, 0], dur: 4 });
    d.clearSub(); d.end();
  }
  play() {
    const e = this.e;
    this.oTroops = this.obj('Lettuce soldiers', this.quota.troops); this.oAir = this.obj('Lettuce aircraft (drones · helicopter · jets)', this.quota.air);
    this.oPower = this.obj('Keep our generator running'); this.oNuke = this.obj('Nuke: locked — clear the field first'); this.oHatch = this.obj(RANK.has(10) ? 'Blow the hatch under the Lettuce silo (C4)' : 'The hatch needs C4 — unlocks at rank 10');
    this.begin(); e.player.controlsOn = true; e.player.canShoot = true; e.lock(); e.toast('BATTLE', 'THE FIELD IS YOURS TO CLEAR', 3);
    RANK.hud();
    e.hint('Silo missile: <b>E</b> at the red button by our silo (recharges). <b>F</b> shield. Yellow pad: parachute · red pad: jet.', 8);
    this.down = { troops: 0, air: 0 };
    this.after(5, () => this.spawnTroops(2)); this.every(24, () => { if (this.spawnedTroops < this.quota.troops && this.liveEnemies(Trooper) < 4) this.spawnTroops(2); }, 30);
    this.after(10, () => this.spawnDrone()); this.every(20, () => { if (this.spawnedDrones < 3 && this.liveEnemies(Drone) < 1 && this.lettuceHasPower()) this.spawnDrone(); }, 30);
    this.after(40, () => this.spawnHeli());
    this.after(70, () => this.spawnJet()); this.after(150, () => this.spawnJet()); this.every(60, () => { if (this.spawnedJets < 2 && !this.liveEnemies(EnemyJet)) this.spawnJet(); }, 210);
    this.after(50, () => this.enemyMissile()); this.every(75, () => this.enemyMissile(), 125);
    this.e.onWorldHit = null;
  }
  lettuceHasPower() { return this.genL.alive; }
  ourPower() { return this.genT.alive; }
  // ---- spawns
  spawnTroops(n) {
    const e = this.e; for (let i = 0; i < n && this.spawnedTroops < this.quota.troops; i++) {
      this.spawnedTroops++; const byAir = Math.random() < 0.4 && this.lettuceHasPower();
      const t = byAir ? new Trooper(e, { x: rand(10, 40), z: rand(-24, 24), y: 46, chute: true }) : new Trooper(e, { x: rand(46, 62), z: rand(-28, 28), y: 0 });
      t.onDeath = () => { this.down.troops++; e.progress(this.oTroops, this.down.troops); RANK.award(10, 'Soldier down'); };
    }
  }
  spawnDrone() {
    const e = this.e; this.spawnedDrones++; const gen = this.genT;
    const d = new Drone(e, { center: V3(rand(-30, 20), 0, rand(-14, 14)), radius: 20, height: 15 });
    if (Math.random() < 0.5) d.target = () => (gen.alive ? gen.pos.clone().add(V3(0, 2, 0)) : (e.hostile() ? e.yaw.position : null));
    d.onDeath = () => { this.down.air++; e.progress(this.oAir, this.down.air); RANK.award(15, 'Drone down'); };
    e.toast('DRONE', 'LETTUCE DRONE OVER THE FIELD', 1.6);
  }
  spawnHeli() {
    const e = this.e; if (this.heliDone) return; this.heliDone = true;
    const h = new Heli(e, { center: V3(20, 0, 0), radius: 30, height: 22 }); e.audio.ambHeli(0.06);
    h.onDeath = () => { this.down.air++; e.progress(this.oAir, this.down.air); RANK.award(40, 'Helicopter down'); };
    e.toast('HELICOPTER', 'ROPE SOLDIER INCOMING', 2);
  }
  spawnJet() {
    const e = this.e; if (this.spawnedJets >= 2 || !this.lettuceHasPower()) return; this.spawnedJets++;
    const j = new EnemyJet(e, { z: this.genT.pos.z + rand(-3, 3), y: 26, dir: -1, speed: 30, startX: 170, target: () => this.genT.pos });
    j.onDeath = () => { this.down.air++; e.progress(this.oAir, this.down.air); RANK.award(40, 'Jet shot down'); };
    e.toast('LETTUCE JET', 'IT IS GOING FOR OUR GENERATOR', 2.4); e.audio.alarm(2, 460);
  }
  enemyMissile() {
    const e = this.e; if (!this.lettuceHasPower() || this.done) return;
    e.toast('MISSILE LAUNCH', 'FROM THE LETTUCE SILO — SHOOT IT DOWN', 2.4); e.audio.alarm(3, 460);
    const m = new ArcMissile(e, { from: V3(FIELD.lettuceSiloX, 8, 0), to: this.genT.pos.clone().add(V3(0, 2, 0)), dur: 11, apex: 55, color: C.lettuce, hp: 4, onArrive: () => { this.genT.hurt(30); e.audio.alarm(3, 380); } });
    m.onShotDown = () => RANK.award(20, 'Missile shot down');
  }
  // ---- blasts hitting structures
  onBlast(pos, dmg, radius, kind) {
    if (kind === 'playerRocket') { if (this.genL.alive && this.genL.pos.distanceTo(pos) < radius + 3) this.genL.hurt(dmg); return; }
    if (this.genT.alive && this.genT.pos.distanceTo(pos) < radius + 3) this.genT.hurt(dmg);
  }
  // ---- the silo: missile (recharging) and the nuke (once)
  fireMissile() {
    const e = this.e; this.missileT = this.missileCd; e.toast('MISSILE AWAY', 'SILO TO LETTUCE BASE', 2.4); e.audio.alarm(2, 520);
    const tm = this.refs.tomatoSilo.userData.missile; tm.visible = false; setTimeout(() => { tm.visible = true; }, 20000);
    const target = V3(FIELD.lettuceX - 8, 6, rand(-8, 8));
    new ArcMissile(e, { from: V3(FIELD.tomatoSiloX, 8, 0), to: target, dur: 7, apex: 50, color: C.tomato, targetable: false, size: 1.3, onArrive: (m) => {
      e.explosion(target, 3, { debris: 10 }); e.flash(0.3, 0.6);
      for (const a of [...e.targets]) { if (!a.alive || a.friendly) continue; if (a instanceof Bomb) continue; const d = a.pos.distanceTo(target); if (d < 24 && !(a instanceof Generator)) a.onHit(50, a.pos.clone(), V3(0, 1, 0)); else if (a instanceof Generator && d < 20) a.hurt(25); }
    } });
  }
  fireNuke() {
    const e = this.e; this.nukeUsed = true; e.completeObjective(this.oNuke); e.setMarker(null); e.toast('NUKE AWAY', 'GET BACK. GET DOWN.', 3); e.audio.alarm(6, 300);
    const target = V3(FIELD.lettuceX - 2, 4, 0);
    new ArcMissile(e, { from: V3(FIELD.tomatoSiloX, 8, 0), to: target, dur: 9, apex: 75, color: C.tomato, targetable: false, size: 2.2, onArrive: () => {
      e.explosion(target, 7, { debris: 24 }); e.flash(1, 2.2); e.shake = 1.4; e.audio.explode && e.audio.explode(4, 0.5);
      const lb = this.refs.lettuceBase; const start = performance.now(); const u = (dt) => { const k = clamp((performance.now() - start) / 1600, 0, 1); lb.rotation.z = k * 0.26; lb.position.y = -k * 1.6; lb.position.x = FIELD.lettuceX + k * 3; if (k >= 1) e.updaters.delete(u); }; e.updaters.add(u);
      for (const a of [...e.targets]) { if (!a.alive || a.friendly || a instanceof Bomb) continue; if (a.pos.distanceTo(target) < 60) a.onHit(999, a.pos.clone(), V3(0, 1, 0)); }
      if (this.genL.alive) this.genL.hurt(999);
      for (let i = 0; i < 6; i++) setTimeout(() => e.puff(target.clone().add(V3(rand(-14, 14), rand(2, 16), rand(-14, 14))), 0x3A3F46, 4, 5), i * 220);
      RANK.award(80, 'Nuke on target'); e.completeObjective(this.oPower);
      this.hatchOpen = false; this.nukeLanded = true;
      if (RANK.has(10)) { e.hint('The Lettuce base is gone. <b>Plant the C4</b> on the hatch under their silo (<b>E</b>) — follow the marker.', 8); e.setMarker(this.hatch.position, 'HATCH'); }
      else { e.toast('SURFACE CLEARED', 'RANK 10 UNLOCKS THE C4 FOR THE HATCH', 4); this.after(4, () => this.win()); }
    } });
  }
  plantC4() {
    const e = this.e; this.c4 = makeC4(); this.c4.position.copy(this.hatch.position).add(V3(0, 0.75, 0)); e.world.add(this.c4); e.audio.pickup();
    e.toast('C4 PLANTED', 'TEN SECONDS. RUN.', 2.6); e.hint('<b>Get clear</b> of the hatch!', 5); this.c4T = 10;
  }
  blowHatch() {
    const e = this.e; e.world.remove(this.c4); this.c4 = null; const hp = this.hatch.position.clone();
    e.explosion(hp.clone().add(V3(0, 1, 0)), 2.6, { debris: 12 }); e.flash(0.5, 1);
    const u = this.hatch.userData; this.hatch.remove(u.lid, u.wheel, u.spokes); u.hole.visible = true; this.hatchOpen = true; const ci = e.colliders.indexOf(this.hatchCollider); if (ci >= 0) e.colliders.splice(ci, 1);
    if (e.yaw.position.distanceTo(hp) < 7) e.damage(50, 'bomb');
    RANK.award(40, 'Hatch blown'); e.toast('THE HATCH IS OPEN', 'DROP IN', 2.6); e.hint('Walk into the hole to go <b>underground</b>.', 6);
  }
  updateOrders() {
    const e = this.e; if (!this.oPower) return;
    this.oPower.text = this.genT.alive ? 'Keep our generator running' : 'Generator DOWN — hold E next to it to repair';
    if (!this.nukeUsed) this.oNuke.text = this.nukeArmed ? 'NUKE ARMED — fire it from the silo (E)' : 'Nuke: locked — clear the field first';
    e.renderObjectives();
  }
  update(dt) {
    const e = this.e, p = e.player, pp = e.yaw.position;
    if (this.missileT > 0) this.missileT -= dt;
    if (this.lettuceRepairT > 0) { this.lettuceRepairT -= dt; if (this.lettuceRepairT <= 0 && !this.genL.alive && !this.nukeLanded) this.genL.repair(); }
    if (this.jetReadyT > 0) { this.jetReadyT -= dt; this.parkedJet.visible = false; if (this.jetReadyT <= 0) { this.parkedJet.visible = true; e.toast('JET READY', 'RED PAD', 1.8); } }
    // nuke arms when soldiers and aircraft are all down
    if (!this.nukeArmed && !this.nukeUsed && this.oTroops.done && this.oAir.done) { this.nukeArmed = true; e.setMarker(this.consolePos, 'NUKE BUTTON'); e.toast('NUKE ARMED', 'THE SILO WILL TAKE IT NOW · E AT THE RED BUTTON', 4); e.audio.objective(); this.updateOrders(); }
    // silo console screen + button
    this.consoleScreen.material.emissiveIntensity = this.ourPower() ? (this.missileT > 0 && !this.nukeArmed ? 0.3 : 0.8 + Math.sin(this.t * 6) * 0.3) : 0.05;
    this.consoleBtn.material = this.nukeArmed && !this.nukeUsed ? emissive(C.tomato, 1.2 + Math.sin(this.t * 10) * 0.5) : mat(C.tomato);
    // C4 countdown
    if (this.c4) { this.c4T -= dt; this.c4.userData.led.visible = (this.c4T % 0.5) < 0.25 || this.c4T < 2; if (this.c4T <= 0) this.blowHatch(); }
    if (this.hatchOpen && !this.done && pp.distanceTo(this.hatch.position) < 3.2 && p.mode === 'foot') { e.completeObjective(this.oHatch); e.setMarker(null); this.win(); return; }
    if (p.mode !== 'foot' || !p.controlsOn) return;
    // ---- interactions (E)
    const near = (v, r) => Math.hypot(pp.x - v.x, pp.z - v.z) < r;
    const eDown = e.keys.KeyE; this.eLatch = this.eLatch === undefined ? false : this.eLatch; const ePressed = eDown && !this.eLatch; this.eLatch = !!eDown;
    if (near(this.consolePos, 3.5)) {
      if (!this.ourPower()) e.hint('No power. <b>Repair the generator</b> first.');
      else if (this.nukeArmed && !this.nukeUsed) { e.hint('<b>E</b> — fire the NUKE. One shot.'); if (ePressed) this.fireNuke(); }
      else if (this.nukeUsed) e.hint('The silo is empty.');
      else if (this.missileT > 0) e.hint(`Missile recharging — <b>${Math.ceil(this.missileT)}s</b>`);
      else { e.hint('<b>E</b> — fire the silo missile at the Lettuce base'); if (ePressed) this.fireMissile(); }
    }
    else if (near(this.chutePad.position, 4)) {
      if (!RANK.has(5)) e.hint('Parachute drop unlocks at <b>rank 5</b>.');
      else { e.hint('<b>E</b> — drone lift + parachute drop'); if (ePressed) { e.setShield(false); e.fade(1, 0.35).then(() => { e.startChute(pp.x, 62, pp.z); e.toast('DRONE DROP', 'STEER WITH WASD. LAND ON A ROOF IF YOU LIKE.', 3); e.fade(0, 0.5); }); } }
    }
    else if (near(this.jetPad.position, 6)) {
      if (!RANK.has(10)) e.hint('The jet unlocks at <b>rank 10</b>.');
      else if (!this.ourPower()) e.hint('No power, no jet. <b>Repair the generator.</b>');
      else if (this.jetReadyT > 0) e.hint(`Next jet in <b>${Math.ceil(this.jetReadyT)}s</b>`);
      else { e.hint('<b>E</b> — take the jet. Fly where you look, click for rockets, Shift to boost.'); if (ePressed) { e.setShield(false); this.parkedJet.visible = false; this.jetReadyT = 0; e.startJet(pp.x, 6, pp.z, -90, 50); e.toast('AIRBORNE', 'HIT THEIR GENERATOR AND THEIR ROOF', 3); } }
    }
    else if (!this.genT.alive && near(this.genT.pos, 6)) {
      if (eDown) { this.repairHold += dt; e.hint(`Repairing… <b>${Math.round(this.repairHold / 4 * 100)}%</b>`); if (this.t % 0.3 < dt) e.sparks(this.genT.pos.clone().add(V3(rand(-1, 1), 2.5, rand(-1, 1))), 4, C.scarf); if (this.repairHold >= 4) { this.repairHold = 0; this.genT.repair(); } }
      else { this.repairHold = 0; e.hint('<b>Hold E</b> to repair the generator'); }
    }
    else if (this.nukeLanded && !this.hatchOpen && !this.c4 && near(this.hatch.position, 4)) {
      if (!RANK.has(10)) e.hint('You need <b>C4</b> for this hatch — rank 10.');
      else { e.hint('<b>E</b> — plant the C4 on the hatch'); if (ePressed) this.plantC4(); }
    }
  }
}

// ---------------------------------------------------------------- underground: the guards, the safe box, the wires, the fire
export class BattleUnderground extends Level5 {
  constructor(g) { super(g); this.id = 'battle-under'; this.title = 'Under the Lettuce Silo'; this.beat = 'BATTLE · UNDERGROUND'; }
  build() {
    super.build(); const e = this.e, H = this.H, Y2 = this.Y2, W = this.W;
    // the guards down here still have their wits: the sleeper wakes, two more stand watch
    this.guard.asleep = false; this.guard.fireT = 1.5; this.guard.hp = this.guard.maxHp = 4;
    this.guards = [this.guard, new Trooper(e, { x: 32, z: 4, hp: 4, dmg: 8, standoff: 9, indoor: true }), new Trooper(e, { x: 50, z: -3, hp: 4, dmg: 8, standoff: 8, indoor: true })];
    // the gamer becomes the safe-box guy
    const gamer = this.wanderers[2]; gamer.remove(); this.wanderers.splice(2, 1);
    this.safeGuy = new SafeBoxGuy(e, { inside: V3(57, 0, 4.6), outside: V3(49, 0, -1) });
    // reactor panel on the B2 wall
    this.panel = makeWirePanel(); this.panel.position.set(46, Y2, -W / 2 + 0.55); e.world.add(this.panel);
    const pl = new THREE.PointLight(C.laser, 0.8, 8); pl.position.set(46, Y2 + 2.5, -W / 2 + 2); e.world.add(pl); this.panelLight = pl;
    this.wired = 0; this.eLatch = false;
    // no console shooting in this mode
    e.removeTarget(this.consoleActor);
  }
  ambient() { this.e.audio.ambUnderground(); this.e.audio.ambReactor(0.06); }
  async intro() {
    const e = this.e, d = this.dir; d.begin(); this.ambient(); await e.fade(0, 1.2);
    d.sub('Down the shaft. Their guards are still armed — and one of them sits in a glass box.', '');
    await d.cam({ from: [0.4, 26, 0], to: [0.4, 1.7, 0], look: [0.4, 0, 0], lookTo: [20, 2, 0], dur: 7, linear: true });
    d.sub('Find the reactor panel on B2 and cross the wrong wires. Then deal with what happens.', 'RYLEY');
    await d.cam({ from: [0.4, 1.7, 0], to: [1, 1.7, 0], look: [20, 2, 0], lookTo: [40, 2, 0], dur: 4 });
    d.clearSub(); d.end();
  }
  play() {
    const e = this.e;
    this.oGuards = this.obj('Guards who still have their wits (the safe-box one only when he steps out)', 4);
    this.oWires = this.obj('Reactor panel on B2: cross the wrong wires'); this.oLauncher = this.oWires; this.oFire = this.obj('Put the fire out'); this.oRide = this.obj('Ride the CO₂ bottle up the vent');
    this.begin(); e.player.controlsOn = true; e.lock(); e.toast('UNDERGROUND', 'SHUT IT DOWN', 3); RANK.hud();
    e.hint('The <b>floaters</b> are harmless. The armed ones are not. The man in the <b>glass box</b> cannot be hit inside — wait for the door.', 8);
    let n = 0; const one = (why, xp) => () => { n++; e.progress(this.oGuards, n); RANK.award(xp, why); };
    for (const g of this.guards) g.onDeath = one('Guard down', 15);
    this.safeGuy.onDeath = one('Safe-box guard down', 30);
    this.e.onWorldHit = null;
  }
  blowConsole() { super.blowConsole(); RANK.award(60, 'Reactor shorted'); this.e.toast('SHORT CIRCUIT', 'THE REACTOR LINE BLEW — FIRE!', 3); }
  update(dt) {
    const stageBefore = this.stage; super.update(dt); const e = this.e, pp = e.yaw.position;
    if (stageBefore === 0 && this.stage === 1) { e.hint('The <b>reactor panel</b> is on the wall by the console. Cross the wires: <b>E</b>.', 6); e.toast('B2', 'THE REACTOR PANEL', 2.4); }
    if (this.oFire.done && !this._fireXp) { this._fireXp = true; RANK.award(40, 'Fire out'); }
    // the panel
    if (this.stage === 1 && Math.hypot(pp.x - this.panel.position.x, pp.z - this.panel.position.z) < 3.6 && pp.y < -5) {
      const eDown = e.keys.KeyE; const pressed = eDown && !this.eLatch; this.eLatch = !!eDown;
      e.hint(`<b>E</b> — pull a wire into the wrong socket (${this.wired}/3)`);
      if (pressed) {
        this.wired++; const maps = [[1, 0, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1]]; this.panel.userData.rewire(maps[this.wired - 1]);
        e.sparks(this.panel.position.clone().add(V3(rand(-1, 1), 1.5, 0.4)), 8, this.wired < 3 ? C.scarf : C.tomato); e.audio.zap(); e.shake = Math.max(e.shake, 0.2);
        this.panel.userData.lamp.material = emissive(this.wired < 3 ? C.orange : C.tomato, 1.4); this.panelLight.color.set(this.wired < 3 ? C.orange : C.tomato);
        if (this.wired >= 3) { e.hint(''); setTimeout(() => this.blowConsole(), 700); }
      }
    } else this.eLatch = !!e.keys.KeyE;
  }
}
