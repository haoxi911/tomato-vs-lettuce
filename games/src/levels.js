// The five scenes as levels, plus the story cutscenes between them.
import * as THREE from 'three';
import { C, mat, emissive, box, cyl, cone, sphere, makeSoldier, poseSoldier, animateWalk, makeJet, makeMissile, makeTomatoBomb, makeLaserPod, makeGlow, makeCO2, makeConsole, makeRubble, makeScreenGlow, outline, at , makeHatch } from './art.js';
import { V3, rand, clamp, lerp, ease } from './engine.js';
import { Drone, Trooper, Heli, ArcMissile, LaserPod, HealthPack, RocketPod, Wanderer, Companion, Bomb, Rocket, Actor } from './actors.js';
import { buildField, FIELD, jetFlyby, roofPoint } from './field.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class Level {
  constructor(game) { this.g = game; this.e = game.e; this.dir = game.dir; this.refs = {}; this.objs = []; this.t = 0; this.done = false; this.failed = false; this.tasks = []; this._upd = (dt) => this.tick(dt); this.running = false; }
  obj(text, count = null) { const o = { text, count, n: 0, done: false }; this.objs.push(o); return o; }
  after(sec, fn) { this.tasks.push({ at: this.t + sec, fn }); }
  every(sec, fn, first = sec) { const self = this; const re = () => { if (!self.running) return; fn(); self.after(sec, re); }; this.after(first, re); }
  tick(dt) {
    if (!this.running) return; this.t += dt;
    for (let i = this.tasks.length - 1; i >= 0; i--) if (this.tasks[i].at <= this.t) { const tk = this.tasks.splice(i, 1)[0]; tk.fn(); }
    this.update(dt);
    if (!this.running) return; // update() may have ended the level itself (e.g. the CO₂ ride)
    if (!this.done && this.objs.length && this.objs.every(o => o.done)) this.win();
  }
  update(dt) { }
  begin() { this.running = true; this.t = 0; this.e.updaters.add(this._upd); this.e.setObjectives(this.objs); this.e.setLevelName(this.title, this.beat); }
  stop() { this.running = false; this.e.updaters.delete(this._upd); }
  win() { this.done = true; this.stop(); this.e.player.controlsOn = false; this.e.audio.objective(); this.e.toast('SCENE COMPLETE', this.title, 3); this.onWin && this.onWin(); }
  fail(reason) { if (this.failed || this.done) return; this.failed = true; this.stop(); this.onFail && this.onFail(reason); }
  liveEnemies(cls) { return this.e.targets.filter(a => a.alive && (!cls || a instanceof cls)).length; }
  wallHitCounter(meshes, objective) { this.e.onWorldHit = (hit) => { if (meshes.includes(hit.object) && objective && !objective.done) { this.e.progress(objective, objective.n + 1); if (objective.n === 1) this.e.hint('Orders are orders. <b>Keep shooting the wall.</b>', 3); } }; }
}

// ===================================================================== SCENE 1
export class Level1 extends Level {
  constructor(g) { super(g); this.id = 1; this.title = 'Two Kingdoms, One Sky'; this.beat = 'SCENE ONE · THE ATTACK BEGINS'; }
  build() {
    const e = this.e; e.clearWorld(); this.refs = buildField(e); e.spawn(-24, 0, 4, -90);
  }
  async intro() {
    const e = this.e, d = this.dir, r = this.refs; d.begin();
    d.lookFrom(V3(-120, 26, 60), V3(-74, 8, 0)); // reveal the cinematic opening angle, not the player-spawn view
    e.audio.ambWind(); await e.fade(0, 1.2);
    // a helicopter is already circling the lettuce side; a jet crosses; drones out
    this.heli = new Heli(e, { center: V3(30, 0, -6), radius: 34, height: 24 }); e.audio.ambHeli();
    this.drones = [new Drone(e, { center: V3(-10, 0, -8), radius: 22, height: 15, phase: 0 }), new Drone(e, { center: V3(4, 0, 10), radius: 20, height: 17, phase: 2.5 })];
    d.narrate('01-scene-1', { wait: false });
    d.cam({ from: [-120, 26, 60], to: [-60, 18, 40], look: [-74, 8, 0], lookTo: [-30, 10, 0], dur: 9 });
    await d.wait(6.5);
    jetFlyby(e, { jet: makeJet(C.tomato), z: -18, y: 30, dir: 1, speed: 38, startX: -190, life: 11 });
    await d.cam({ from: [-60, 18, 40], to: [10, 14, 34], look: [-30, 10, 0], lookTo: [50, 16, -6], dur: 9 });
    // tomato drone drops a sniper; enemy paratrooper's chute torn — he falls
    const sniper = makeSoldier({ color: C.tomato }); poseSoldier(sniper, 'aim'); sniper.position.set(6, 34, -4); e.world.add(sniper);
    const faller = new Trooper(e, { x: 26, z: -10, y: 44, chute: true }); faller.friendly = false; e.removeTarget(faller);
    await d.cam({ from: [10, 14, 34], to: [0, 26, 22], look: [50, 16, -6], lookTo: [16, 34, -6], dur: 6 });
    e.tracer(sniper.position.clone().add(V3(0, 1.8, 0)), faller.pos.clone().add(V3(0, 5, 0)), 0xFFE7B8, 0.12); e.audio.shot(0.2);
    faller.obj.remove(faller.chute); faller.state = 'fall'; const fu = (dt) => { faller.pos.y -= 9 * dt; faller.obj.rotation.x += dt * 2; if (faller.pos.y < 0.4) { e.updaters.delete(fu); e.puff(faller.pos, 0x7F8A95, 1, 1.2); faller.remove(); } }; e.updaters.add(fu);
    const su = (dt) => { sniper.position.y -= 2.4 * dt; if (sniper.position.y < 0) { e.updaters.delete(su); e.world.remove(sniper); } }; e.updaters.add(su);
    await d.cam({ from: [0, 26, 22], to: [-18, 6, 16], look: [16, 34, -6], lookTo: [-24, 4, 4], dur: 9 });
    await d.cam({ from: [-18, 6, 16], to: [-24, 1.7, 4], look: [-24, 4, 4], lookTo: [40, 6, 4], dur: 5 });
    await d.until(() => !e.audio.narr, 45); // let the ~73s narration finish before d.end() stops it (returns early once it ends)
    d.end();
  }
  play() {
    const e = this.e, r = this.refs;
    this.oDrones = this.obj('Shoot down the Lettuce drones', 4); this.oHeli = this.obj('Bring down the helicopter'); this.oWall = this.obj('Orders from the King: fire at the Lettuce wall', 10);
    this.begin(); e.player.controlsOn = true; e.player.canShoot = true; e.lock();
    e.toast('SCENE ONE', 'TWO KINGDOMS, ONE SKY', 3);
    this.wallHitCounter(r.lettuceWallMeshes, this.oWall);
    e.hint('<b>WASD</b> move · <b>MOUSE</b> aim · <b>CLICK</b> shoot · <b>R</b> reload', 6);
    this.killed = 0; const onDrone = () => { this.killed++; e.progress(this.oDrones, this.killed); };
    // on a retry the intro is skipped, so the cast it would have introduced has to be raised here
    if (!this.heli) { this.heli = new Heli(e, { center: V3(30, 0, -6), radius: 34, height: 24 }); e.audio.ambHeli(); }
    if (!this.drones) this.drones = [new Drone(e, { center: V3(-10, 0, -8), radius: 22, height: 15, phase: 0 }), new Drone(e, { center: V3(4, 0, 10), radius: 20, height: 17, phase: 2.5 })];
    for (const dr of this.drones) dr.onDeath = onDrone;
    this.heli.onDeath = () => { this.e.completeObjective(this.oHeli); };
    this.heli.center.set(-10, 0, -4); this.heli.radius = 30; this.heli.height = 22;
    this.every(14, () => { if (this.killed + this.liveEnemies(Drone) < 4) { const dr = new Drone(e, { center: V3(rand(-20, 20), 0, rand(-12, 12)), radius: rand(16, 24), height: rand(13, 18) }); dr.onDeath = onDrone; } }, 10);
    this.after(18, () => { new Trooper(e, { x: -6, z: -14, y: 46, chute: true }); e.toast('PARATROOPERS', 'LETTUCE SOLDIERS DROPPING IN', 2.4); });
    this.after(42, () => { new Trooper(e, { x: 2, z: 14, y: 46, chute: true }); new Trooper(e, { x: 10, z: -6, y: 50, chute: true }); });
    this.every(30, () => { if (this.liveEnemies(Trooper) < 2) new Trooper(e, { x: rand(-10, 20), z: rand(-16, 16), y: 48, chute: true }); }, 70);
  }
}

// ===================================================================== SCENE 2
export class Level2 extends Level {
  constructor(g) { super(g); this.id = 2; this.title = 'First Missile'; this.beat = 'SCENE TWO · DIRECT HIT'; this.retryPhase = 'dawn'; }
  build() { const e = this.e; e.clearWorld(); this.refs = buildField(e, { phase: 'dawn' }); e.setTimeOfDay('night'); e.spawn(-26, 0, 6, -90); }
  async intro() {
    const e = this.e, d = this.dir, r = this.refs; d.begin(); e.audio.ambWind(); e.tweenTimeOfDay('night', 'dawn', 34); d.lookFrom(V3(-70, 10, 30), V3(-44, 10, 0)); await e.fade(0, 1);
    const heli = new Heli(e, { center: V3(24, 0, 10), radius: 26, height: 22 }); e.removeTarget(heli); e.audio.ambHeli();
    d.narrate('02-scene-2', { wait: false });
    d.cam({ from: [-70, 10, 30], to: [-30, 14, 26], look: [-44, 10, 0], lookTo: [-44, 16, 0], dur: 8 });
    await d.wait(1.5);
    // tomato silo fires
    const tm = r.tomatoSilo.userData.missile; tm.visible = false;
    const arc = new ArcMissile(e, { from: V3(FIELD.tomatoSiloX, 8, 0), to: V3(FIELD.lettuceX - 6, 10, 0), dur: 8.5, apex: 52, color: C.tomato, targetable: false, size: 1.35, onArrive: () => {
      e.explosion(V3(FIELD.lettuceX - 4, 10, 0), 3.2, { debris: 10 }); e.audio.alarm(4, 400);
      const lb = r.lettuceBase; const start = performance.now(); const u = (dt) => { const k = clamp((performance.now() - start) / 1400, 0, 1); lb.rotation.z = ease(k) * 0.22; lb.position.y = -ease(k) * 1.2; lb.position.x = FIELD.lettuceX + ease(k) * 3; if (k >= 1) e.updaters.delete(u); }; e.updaters.add(u);
    } });
    await d.cam({ from: [-30, 14, 26], to: [20, 30, 50], look: [-44, 16, 0], lookTo: [70, 12, 0], dur: 9 });
    // jet fires at the helicopter
    jetFlyby(e, { jet: makeJet(C.tomato), z: 14, y: 30, dir: 1, speed: 34, startX: -150, life: 12, fireX: -20, onFire: (p) => {
      const m = new ArcMissile(e, { from: p, to: heli.pos.clone(), dur: 2.2, apex: 2, color: C.tomato, targetable: false, size: 0.7, onArrive: () => { heli.die(); } });
      const chase = (dt) => { if (!m.alive) { e.updaters.delete(chase); return; } m.to.copy(heli.pos); }; e.updaters.add(chase);
    } });
    await d.cam({ from: [20, 30, 50], to: [0, 20, 40], look: [70, 12, 0], lookTo: [24, 22, 10], dur: 8 });
    // drone drops a soldier at the tomato roof
    const dr = new Drone(e, { center: V3(-60, 0, 0), radius: 10, height: 26, bombs: false }); e.removeTarget(dr);
    await d.cam({ from: [0, 20, 40], to: [-50, 24, 34], look: [24, 22, 10], lookTo: [-72, 20, 0], dur: 6 });
    const tr = new Trooper(e, { x: -66, z: -2, y: 25, chute: true }); e.removeTarget(tr); this.roofTrooper = tr;
    await d.cam({ from: [-50, 24, 34], to: [-26, 1.7, 6], look: [-72, 20, 0], lookTo: [40, 6, 6], dur: 7 });
    await d.until(() => !e.audio.narr, 35); // let the full narration finish before d.end() stops it
    heli.remove(); dr.remove(); d.end();
  }
  play() {
    const e = this.e, r = this.refs;
    this.oMissiles = this.obj('Shoot down the incoming Lettuce missiles', 3); this.oTroops = this.obj('Stop the soldiers the drones drop', 4); this.oWall = this.obj('Keep firing at the Lettuce wall', 10);
    this.begin(); e.player.controlsOn = true; e.lock(); e.toast('SCENE TWO', 'FIRST MISSILE', 3);
    this.wallHitCounter(r.lettuceWallMeshes, this.oWall);
    e.hint('Incoming missiles: <b>shoot them out of the sky</b> before they hit the roof gun.', 6);
    this.roofHits = 0; this.shot = 0; this.troopsDown = 0;
    if (this.roofTrooper) { e.addTarget(this.roofTrooper); this.roofTrooper.onDeath = () => { this.troopsDown++; e.progress(this.oTroops, this.troopsDown); }; }
    const launch = () => {
      e.toast('MISSILE LAUNCH', 'FROM THE LETTUCE SILO', 2); e.audio.alarm(3, 460);
      const m = new ArcMissile(e, { from: V3(FIELD.lettuceSiloX, 8, 0), to: V3(FIELD.tomatoX + 2, r.tomatoBase.userData.towerRoofY + 1, -3), dur: 11, apex: 55, color: C.lettuce, hp: 4, onArrive: () => {
        this.roofHits++; e.audio.alarm(4, 380);
        if (this.roofHits >= 2) { r.roofGun && r.roofGun.wreck(); this.fail('The roof gun is gone. The Tomato Kingdom is wide open.'); } else e.toast('ROOF HIT', 'ONE MORE AND THE GUN IS GONE', 2.6);
      } });
      m.onShotDown = () => { this.shot++; e.progress(this.oMissiles, this.shot); };
    };
    this.after(6, launch); this.every(22, () => { if (this.shot + this.liveEnemies(ArcMissile) < 3 && !this.done) launch(); }, 26);
    const dropTroop = () => { const dr = new Drone(e, { center: V3(-40, 0, rand(-14, 14)), radius: 14, height: 24, bombs: false }); e.removeTarget(dr); setTimeout(() => dr.remove(), 8500); // remove the carrier drone unconditionally so it can't leak if the level ends mid-drop
      setTimeout(() => { if (!this.running) return; const t = new Trooper(e, { x: -40 + rand(-8, 8), z: rand(-12, 12), y: 24, chute: true }); t.onDeath = () => { this.troopsDown++; e.progress(this.oTroops, this.troopsDown); }; }, 2500); };
    this.after(12, dropTroop); this.every(18, () => { if (this.troopsDown + this.liveEnemies(Trooper) < 4) dropTroop(); }, 30);
    this.every(16, () => { if (this.liveEnemies(Drone) < 2) new Drone(e, { center: V3(rand(-24, 10), 0, rand(-10, 10)), radius: 18, height: 15 }); }, 20);
  }
}

// ===================================================================== SCENE 3
export class Level3 extends Level {
  constructor(g) { super(g); this.id = 3; this.title = 'The Counterstrike'; this.beat = 'SCENE THREE · THEY HIT BACK'; this.retryPhase = 'morning'; }
  build() {
    const e = this.e; e.clearWorld(); this.refs = buildField(e, { wreckedLettuce: true, phase: 'morning' }); e.setTimeOfDay('dawn'); e.spawn(-20, 0, -6, -90);
    const r = this.refs;
    // laser pods on the open part of the lettuce roof (the building is tilted after the hit, so place them in roof space); one already dead
    this.pods = [];
    for (const [lx, lz] of [[-10, 6], [-10, -6], [-3, 7], [-3, -7]]) { const p = roofPoint(r.lettuceBase, lx, lz); this.pods.push(new LaserPod(e, { x: p.x, y: p.y, z: p.z, period: 4.6 })); }
    const dp = roofPoint(r.lettuceBase, -4, 0); const dead = new LaserPod(e, { x: dp.x, y: dp.y, z: dp.z }); dead.die(); dead.remove(); e.world.add(dead.obj);
    // health packs scattered over the field (they come back after a while)
    for (const [x, z] of [[-30, -20], [-8, 22], [14, 6]]) new HealthPack(e, { x, z });
  }
  async intro() {
    const e = this.e, d = this.dir, r = this.refs; d.begin(); e.audio.ambWind(); e.tweenTimeOfDay('dawn', 'morning', 28); d.lookFrom(V3(80, 20, 40), V3(44, 10, 0)); await e.fade(0, 1);
    d.narrate('03-scene-3', { wait: false });
    d.cam({ from: [80, 20, 40], to: [40, 16, 36], look: [44, 10, 0], lookTo: [44, 14, 0], dur: 6 });
    await d.wait(3);
    r.lettuceSilo.userData.missile.visible = false;
    const arc = new ArcMissile(e, { from: V3(FIELD.lettuceSiloX, 8, 0), to: V3(FIELD.tomatoX + 2, r.tomatoBase.userData.towerRoofY + 1, -3), dur: 9, apex: 55, color: C.lettuce, targetable: false, size: 1.35, onArrive: () => { r.roofGun && r.roofGun.wreck(); e.audio.alarm(5, 380); e.flash(0.5, 0.8); } });
    await d.cam({ from: [40, 16, 36], to: [-40, 30, 50], look: [44, 14, 0], lookTo: [-74, 20, 0], dur: 9.5 });
    await d.cam({ from: [-40, 30, 50], to: [-60, 24, 30], look: [-74, 20, 0], lookTo: [-72, 22, -3], dur: 4 });
    // tomato paratroopers drop toward the enemy roof
    for (let i = 0; i < 3; i++) { const p = new Trooper(e, { x: FIELD.lettuceX - 8 + i * 5, z: -14 + i * 6, y: 48 + i * 6, chute: true, color: C.tomato, faction: 'tomato' }); e.removeTarget(p); p.friendly = true; this.friendlies = (this.friendlies || []).concat(p); }
    await d.cam({ from: [-60, 24, 30], to: [20, 26, 44], look: [-72, 22, -3], lookTo: [70, 30, 0], dur: 8 });
    await d.cam({ from: [20, 26, 44], to: [-20, 1.7, -6], look: [70, 30, 0], lookTo: [40, 6, -6], dur: 7 });
    await d.until(() => !e.audio.narr, 30); // let the full narration finish before d.end() stops it
    d.end();
  }
  play() {
    const e = this.e, r = this.refs;
    this.oPods = this.obj('Destroy the laser guns on the Lettuce roof', 4); this.oTroops = this.obj('Hold the field against the Lettuce soldiers', 5); this.oWall = this.obj('Shoot the base. Not people. Just the base.', 10);
    this.begin(); e.player.controlsOn = true; e.lock(); e.toast('SCENE THREE', 'THE COUNTERSTRIKE', 3);
    this.wallHitCounter(r.lettuceWallMeshes, this.oWall);
    e.hint('The laser guns <b>charge up</b> before they fire. When the sight line goes <b>bright</b> the aim is locked — <b>step out of it</b>, duck behind cover, or press <b>F</b> to raise the <b>shield</b>. Red boxes heal.', 9);
    let podsDown = 0; for (const p of this.pods) p.onDeath = () => { podsDown++; e.progress(this.oPods, podsDown); };
    // friendly paratroopers keep drifting down and "work" on the roof; harmless
    if (this.friendlies) for (const f of this.friendlies) { f.update = function (dt) { Actor.prototype.update.call(this, dt); if (this.state === 'chute') { this.pos.y -= 2.2 * dt; if (this.pos.y <= r.lettuceBase.userData.roofY + 1) { this.state = 'roof'; this.obj.remove(this.chute); poseSoldier(this.obj, 'aim'); } } }; }
    let down = 0; const spawn = (n) => { for (let i = 0; i < n; i++) { const t = new Trooper(e, { x: rand(20, 40), z: rand(-20, 20), y: 0 }); t.onDeath = () => { down++; e.progress(this.oTroops, down); }; } };
    // one thing at a time: never more than two soldiers and one drone on the field
    this.after(6, () => spawn(1)); this.every(16, () => { if (down + this.liveEnemies(Trooper) < 5 && this.liveEnemies(Trooper) < 2) spawn(1); }, 22);
    this.every(24, () => { if (this.liveEnemies(Drone) < 1) new Drone(e, { center: V3(rand(-10, 30), 0, rand(-10, 10)), radius: 18, height: 15 }); }, 20);
  }
}

// ===================================================================== SCENE 4 (cutscene) · The Tomato Bomb · Tom's Choice
export async function scene4Cutscene(game) {
  const e = game.e, d = game.dir; e.clearWorld();
  const r = buildField(e, { wreckedLettuce: true, gallows: true, wreckedTomatoRoof: true, roofGun: false, phase: 'morning' });
  d.begin(); e.audio.ambWind(0.04); d.lookFrom(V3(10, 24, 50), V3(74, 8, 0)); await e.fade(0, 1.2);
  // Tom hangs from the gallows
  const gal = r.gallows; const hook = gal.localToWorld(gal.userData.hook.clone());
  const tom = makeSoldier({ color: C.tomato, scarf: true, rifle: false }); poseSoldier(tom, 'hang'); tom.rotation.z = Math.PI; tom.position.copy(hook).add(V3(0, -3.1, 0)); e.world.add(tom);
  const ropeGeo = new THREE.BufferGeometry().setFromPoints([hook, hook.clone().add(V3(0, -0.2, 0))]); e.world.add(new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: C.ink })));
  const swing = (dt) => { const s = Math.sin(e.time * 1.1) * 0.08; tom.rotation.z = Math.PI + s; tom.rotation.x = Math.cos(e.time * 0.8) * 0.05; }; e.updaters.add(swing);
  const king = makeSoldier({ color: C.tomato, crown: true, rifle: false }); king.position.set(hook.x + 7, 0, hook.z + 3); king.lookAt(hook.x, 0, hook.z); e.world.add(king);
  const g1 = makeSoldier({ color: C.tomato }); poseSoldier(g1, 'aim'); g1.position.set(hook.x + 4, 0, hook.z - 5); g1.lookAt(hook.x, 0, hook.z); e.world.add(g1);
  const g2 = makeSoldier({ color: C.tomato }); poseSoldier(g2, 'aim'); g2.position.set(hook.x + 3, 0, hook.z + 7); g2.lookAt(hook.x, 0, hook.z); e.world.add(g2);
  // risen platform on the lettuce side
  const plat = new THREE.Group(); plat.position.set(FIELD.lettuceX - 30, -9, 12); e.world.add(plat);
  plat.add(at(box(22, 1.4, 14, C.steelLight), 0, 0.7, 0));
  const rp = new RocketPod(e, { x: 0, y: 1.4, z: -3 }); e.removeTarget(rp); plat.add(rp.obj); e.world.remove(rp.obj);
  const lp1 = makeLaserPod(); lp1.position.set(7, 1.4, 3); plat.add(lp1); const lp2 = makeLaserPod(); lp2.position.set(-7, 1.4, 3); plat.add(lp2);
  const lp3 = makeLaserPod(); lp3.position.set(-1, 1.4, 5); plat.add(lp3);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), mat(0x0B1014)); hole.rotation.x = -Math.PI / 2; hole.position.set(plat.position.x, 0.06, plat.position.z); e.world.add(hole);

  d.narrate('04-scene-4', { wait: false });
  // "The Lettuce base is wrecked" — look at it
  d.cam({ from: [10, 24, 50], to: [30, 18, 40], look: [74, 8, 0], dur: 7 });
  await d.wait(7);
  // ground opens, weapons rise
  e.audio.alarm(3, 300); e.shake = 0.6;
  const rise = (dt) => { plat.position.y = Math.min(0, plat.position.y + dt * 1.6); if (plat.position.y >= 0) e.updaters.delete(rise); }; e.updaters.add(rise);
  for (let i = 0; i < 12; i++) setTimeout(() => e.puff(V3(plat.position.x + rand(-11, 11), 0.5, plat.position.z + rand(-7, 7)), 0x6E7A85, 1.4, 1.8), i * 300);
  await d.cam({ from: [30, 18, 40], to: [20, 12, 36], look: [44, 4, 12], lookTo: [44, 3, 12], dur: 8 });
  // the jet fires into the new machines
  jetFlyby(e, { jet: makeJet(C.tomato), z: 4, y: 30, dir: 1, speed: 36, startX: -160, life: 12, fireX: -10, onFire: (p) => {
    new ArcMissile(e, { from: p, to: V3(plat.position.x, 2, plat.position.z), dur: 2.4, apex: 4, color: C.tomato, targetable: false, size: 0.7, onArrive: () => { e.explosion(V3(plat.position.x, 3, plat.position.z), 2.6, { debris: 10 }); lp1.rotation.z = 0.9; lp3.rotation.x = -0.8; rp.obj.rotation.z = 0.6; } });
  } });
  await d.cam({ from: [20, 12, 36], to: [-10, 20, 30], look: [44, 3, 12], lookTo: [44, 4, 12], dur: 7 });
  // "someone is hanging upside down" — reveal Tom
  await d.cam({ from: [hook.x + 14, 3, hook.z + 12], to: [hook.x + 8, 4, hook.z + 7], look: [hook.x, 6, hook.z], lookTo: [hook.x, 5.5, hook.z], dur: 9 });
  // Tom's POV: upside-down, looking out over the field at the King
  tom.visible = false;
  await d.cam({ from: [hook.x, 2.9, hook.z + 0.6], to: [hook.x, 2.9, hook.z + 0.6], look: [hook.x + 7, 2.6, hook.z + 3], lookTo: [hook.x + 12, 2, hook.z + 2], dur: 10, roll: Math.PI, rollTo: Math.PI, shake: 0.03 });
  tom.visible = true;
  await d.cam({ from: [hook.x + 12, 3, hook.z + 8], to: [hook.x + 10, 3.5, hook.z + 6], look: [hook.x + 7, 2.4, hook.z + 3], lookTo: [hook.x + 7, 2.6, hook.z + 3], dur: 6 });
  // the King raises his arm; the Tomato Bomb launches from the rail
  king.userData.armR.rotation.x = -2.2; e.audio.alarm(5, 440);
  const bomb = makeTomatoBomb(); const rail = V3(FIELD.tomatoX + 30, 0, 22); bomb.position.copy(rail).add(V3(0, 1, 0)); e.world.add(bomb);
  await d.cam({ from: [rail.x + 10, 6, rail.z + 14], to: [rail.x + 8, 8, rail.z + 12], look: [rail.x, 6, rail.z], lookTo: [rail.x, 8, rail.z], dur: 3.5 });
  bomb.userData.flame.visible = true; e.audio.missileLaunch();
  const from = rail.clone().add(V3(0, 1, 0)), to = V3(0, 3, 0); let bt = 0;
  const fly = (dt) => { bt += dt; const k = clamp(bt / 7, 0, 1); const p = from.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * 60; const prev = bomb.position.clone(); bomb.position.copy(p); const dir = p.clone().sub(prev); if (dir.lengthSq() > 1e-5) bomb.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize()); if (bt % 0.07 < dt) e.puff(p.clone().add(V3(0, -3, 0)), 0xD0D8DE, 1.3, 2.2); if (k >= 1) { e.updaters.delete(fly); e.world.remove(bomb); bigBlast(); } };
  e.updaters.add(fly);
  let blasted = false;
  const bigBlast = () => {
    blasted = true; e.audio.bigBoom(); e.flash(1, 2.2); e.shake = 1.6;
    e.explosion(V3(0, 4, 0), 7, { debris: 20, silent: true });
    const sun = makeGlow(0xFF3B1F, 1); sun.position.set(0, 14, 0); e.world.add(sun);
    const glowL = new THREE.PointLight(0xFF6A2A, 12, 260); glowL.position.set(0, 20, 0); e.world.add(glowL);
    let st = 0; const su = (dt) => { st += dt; const k = clamp(st / 6, 0, 1); sun.scale.setScalar(4 + k * 26); sun.material.opacity = 0.95 * (1 - k * 0.7); glowL.intensity = 12 * (1 - k * 0.6); if (k >= 1) { e.updaters.delete(su); } }; e.updaters.add(su);
    for (let i = 0; i < 30; i++) setTimeout(() => e.puff(V3(rand(-14, 14), rand(2, 30), rand(-14, 14)), i % 2 ? 0x8A3A2A : 0x4A3A3A, rand(3, 6), 5), i * 120);
    for (const s of ['tomatoBase', 'lettuceBase']) { }
  };
  await d.cam({ from: [rail.x + 8, 8, rail.z + 12], to: [-30, 14, 40], look: [rail.x, 8, rail.z], lookTo: [0, 30, 0], dur: 6 });
  await d.until(() => blasted, 10);
  await d.cam({ from: [-30, 14, 40], to: [-34, 12, 44], look: [0, 30, 0], lookTo: [0, 16, 0], dur: 5, shake: 0.5 });
  // Tom shakes on the rope
  tom.visible = false;
  await d.cam({ from: [hook.x, 2.9, hook.z + 0.6], to: [hook.x, 2.9, hook.z + 0.6], look: [0, 24, 0], lookTo: [0, 12, 0], dur: 7, roll: Math.PI, rollTo: Math.PI, shake: 0.12 });
  await d.until(() => !e.audio.narr, 30); // let the full narration finish before d.end() stops it

  // ---- Ryley cuts Tom down  (the long "Tom's Choice" remembering interlude was removed by request)
  const ryley = makeSoldier({ color: C.tomato, hazmat: true }); ryley.position.set(hook.x + 26, 0, hook.z - 8); e.world.add(ryley);
  let rt = 0; const walk = (dt) => { rt += dt; const tgt = V3(hook.x + 2.4, 0, hook.z + 1.2); const to = tgt.clone().sub(ryley.position); if (to.length() > 0.2) { to.normalize(); ryley.position.addScaledVector(to, 5 * dt); ryley.lookAt(tgt.x, 0, tgt.z); animateWalk(ryley, dt, 1); } else { poseSoldier(ryley, 'aim'); ryley.lookAt(hook.x, 0, hook.z); e.updaters.delete(walk); } }; e.updaters.add(walk);
  await d.cam({ from: [hook.x, 2.85, hook.z + 0.6], to: [hook.x, 2.7, hook.z + 0.6], look: [hook.x + 20, 3, hook.z - 6], lookTo: [hook.x + 10, 2, hook.z - 2], dur: 5, roll: Math.PI, rollTo: Math.PI, shake: 0.02 });
  d.sub('Ryley cuts the rope. The ground comes up to meet him.', '');
  e.updaters.delete(swing); e.audio.crack();
  await d.cam({ from: [hook.x, 2.7, hook.z + 0.6], to: [hook.x, 1.7, hook.z + 0.6], look: [hook.x + 10, 2, hook.z - 2], lookTo: [hook.x + 3, 2.2, hook.z + 1.2], dur: 2.6, roll: Math.PI, rollTo: 0 });
  e.world.remove(tom);
  d.sub('“You are the only one who knows the way in. Suit up.”', 'RYLEY');
  await d.wait(3.5);
  await e.fade(1, 1.2); d.end();
}

// ===================================================================== SCENE 4 (level) · Crossing the field
export class Level4 extends Level {
  constructor(g) { super(g); this.id = 4; this.title = 'Across the Field'; this.beat = 'SCENE FOUR · TWO BETRAYALS'; }
  build() {
    const e = this.e; e.clearWorld(); this.refs = buildField(e, { wreckedLettuce: true, crater: true, wreckedTomatoRoof: true, roofGun: false, phase: 'night' });
    e.spawn(FIELD.tomatoX + 26, 0, -10, -90);
    // risen machines: two platforms
    this.machines = [];
    const mk = (px, pz) => {
      const plat = box(22, 1.4, 14, C.steelLight); plat.position.set(px, 0.7, pz); e.world.add(plat); e.addSolid(plat); e.addCollider(px, pz, 22, 14, 2.2);
      const rp = new RocketPod(e, { x: px - 4, y: 1.4, z: pz - 2 }); const lp = new LaserPod(e, { x: px + 6, y: 1.4, z: pz + 3, period: 3.8 }); this.machines.push(rp, lp);
    };
    mk(FIELD.lettuceX - 30, 14); mk(FIELD.lettuceX - 32, -18);
    for (const [x, z] of [[FIELD.tomatoX + 40, 0], [-4, 26], [4, -28], [30, 0]]) new HealthPack(e, { x, z });
    // hatch at the lettuce silo
    const hatch = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), emissive(C.laser, 0.6)); hatch.rotation.x = -Math.PI / 2; hatch.position.set(FIELD.lettuceSiloX + 12, 0.08, 0); e.world.add(hatch); this.hatch = hatch;
    const hm = makeHatch(); hm.position.set(FIELD.lettuceSiloX + 12, 0, 0); hm.userData.lid.material = emissive(C.laser, 0.5); e.world.add(hm); this.hatchModel = hm;
    // a column of light so it can be seen from across the field
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: C.laser, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(FIELD.lettuceSiloX + 12, 30, 0); e.world.add(beam); this.hatchBeam = beam;
    const hl = new THREE.PointLight(C.laser, 1.4, 16); hl.position.set(FIELD.lettuceSiloX + 12, 2, 0); e.world.add(hl);
    this.ryley = new Companion(e, { x: FIELD.tomatoX + 22, z: -8 });
  }
  ambient() { this.e.audio.ambWind(0.06); this.e.audio.ambFire(0.05); }
  async intro() {
    const e = this.e, d = this.dir; d.begin(); e.audio.ambWind(0.06); e.audio.ambFire(0.05); e.setTimeOfDay('morning'); e.tweenTimeOfDay('morning', 'night', 13); d.lookFrom(V3(FIELD.tomatoX + 40, 20, 40), V3(0, 6, 0)); await e.fade(0, 1.4);
    d.sub('Suited up. The field is still burning. The launcher under the Lettuce silo is armed — two days, and counting.', '');
    await d.cam({ from: [FIELD.tomatoX + 40, 20, 40], to: [FIELD.tomatoX + 30, 8, 20], look: [0, 6, 0], lookTo: [20, 4, 0], dur: 7 });
    d.sub('“The new machines came up out of the ground. Rockets and lasers. We go through them, not around.”', 'RYLEY');
    await d.cam({ from: [FIELD.tomatoX + 30, 8, 20], to: [FIELD.tomatoX + 26, 1.7, -10], look: [20, 4, 0], lookTo: [40, 3, 0], dur: 6 });
    d.clearSub(); d.end();
  }
  play() {
    const e = this.e;
    this.oMach = this.obj('Destroy the risen machines', 4); this.oHatch = this.obj('Reach the hatch by the Lettuce silo');
    this.begin(); e.player.controlsOn = true; e.lock(); e.toast('SCENE FOUR', 'ACROSS THE FIELD', 3);
    e.hint('Rockets can be <b>shot down</b>. Lasers <b>charge</b> first — step out of the sight line once it goes bright. Red boxes heal.', 7);
    let down = 0; for (const m of this.machines) m.onDeath = () => { down++; e.progress(this.oMach, down); };
    this.every(20, () => { if (this.liveEnemies(Drone) < 2) new Drone(e, { center: V3(rand(-20, 30), 0, rand(-10, 10)), radius: 16, height: 14 }); }, 15);
    this.every(28, () => { if (this.liveEnemies(Trooper) < 2) new Trooper(e, { x: rand(30, 50), z: rand(-20, 20), y: 0 }); }, 35);
    this.e.onWorldHit = null;
  }
  update(dt) {
    this.hatch.material.emissiveIntensity = 0.5 + Math.sin(this.t * 4) * 0.4; this.hatchBeam.material.opacity = 0.16 + Math.sin(this.t * 3) * 0.08; this.hatchBeam.rotation.y += dt * 0.4;
    if (this.oMach.done && !this.oHatch.done) { const p = this.e.yaw.position; if (Math.hypot(p.x - this.hatch.position.x, p.z - this.hatch.position.z) < 4) { this.e.completeObjective(this.oHatch); this.e.setMarker(null); } }
    if (this.oMach.done && !this._hinted) { this._hinted = true; this.e.hint('The machines are down. <b>Get to the glowing hatch</b> by the Lettuce silo — follow the marker.', 6); this.e.setMarker(this.hatch.position, 'HATCH'); }
  }
}

// ===================================================================== SCENE 5 · Underground
export class Level5 extends Level {
  constructor(g) { super(g); this.id = 5; this.title = 'Shut It Down'; this.beat = 'SCENE FIVE · TWO MEN GO DOWN'; }
  build() {
    const e = this.e; e.clearWorld(); this.refs = {};
    e.resetAtmosphere(); e.scene.fog = new THREE.Fog(0x0B1418, 10, 120); e.hemi.color.set(0x5A6B78); e.hemi.intensity = 0.55; e.sun.intensity = 0.15; e.sky.visible = false; e.stars.visible = false; e.moon.visible = false; e.scene.background = new THREE.Color(0x0B1418);
    const W = 14, H = 8; this.H = H;
    // B1: corridor along +x from x=0..80, z=-W/2..W/2 at y=0.  B2: same footprint at y=-11 from x=20..80. Ramp from B1 (x=80) down to B2 (x=60) along z.
    const flo = (x1, x2, y, z1, z2, col = C.floor) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat(col)); m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.receiveShadow = true; e.world.add(m); e.solids.push(m); return m; };
    const ceil = (x1, x2, y, z1, z2, col = 0xB9C3C9) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat(col)); m.rotation.x = Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); e.world.add(m); e.solids.push(m); return m; };
    const wall = (cx, cy, cz, w, h, d, col = C.concrete) => { const m = box(w, h, d, col); m.position.set(cx, cy, cz); e.world.add(m); e.solids.push(m); e.addCollider(cx, cz, w, d, h, cy - h / 2); return m; };
    // ---- B1
    flo(-6, 86, 0, -W / 2, W / 2); ceil(-6, 86, H, -W / 2, W / 2);
    wall(40, H / 2, -W / 2 - 0.5, 92, H, 1); wall(40, H / 2, W / 2 + 0.5, 92, H, 1); wall(-6.5, H / 2, 0, 1, H, W + 2);
    // floor stripes + lights
    for (let x = 0; x < 84; x += 10) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, W), mat(0xA9B4BC)); s.rotation.x = -Math.PI / 2; s.position.set(x, 0.01, 0); e.world.add(s); const l = new THREE.PointLight(0xEAF0F4, 0.8, 22); l.position.set(x + 5, H - 0.6, 0); e.world.add(l); const lm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.5), emissive(0xF4F1E9, 1)); lm.position.set(x + 5, H - 0.1, 0); e.world.add(lm); }
    // the entry: rope down the vent shaft at x=0
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 30, 12, 1, true), mat(0x5D7284, { side: THREE.BackSide })); shaft.position.set(0, H + 15, 0); e.world.add(shaft);
    const ropeG = new THREE.BufferGeometry().setFromPoints([V3(0.4, H + 28, 0), V3(0.4, 0.2, 0)]); e.world.add(new THREE.Line(ropeG, new THREE.LineBasicMaterial({ color: C.ink })));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), mat(0x111820)); hole.rotation.x = Math.PI / 2; hole.position.set(0, H - 0.02, 0); e.world.add(hole);
    // green radiation pipe along the wall, glowing
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 40, 10), emissive(C.pipe, 0.35)); pipe.rotation.z = Math.PI / 2; pipe.position.set(30, H - 1.6, -W / 2 + 1.2); e.world.add(pipe);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(C.laser, 0.9, 14); l.position.set(14 + i * 10, H - 2, -W / 2 + 2); e.world.add(l); }
    const crackW = wall(24, 2.2, -W / 2 + 0.6, 4, 4.4, 0.4, C.steelDark); // door panel
    // safe room: glass box at x=52..62, z=2..7 — gamer inside
    const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 5), mat(C.glass, { transparent: true, opacity: 0.28 })); glass.position.set(57, 2.5, 4.5); e.world.add(glass); e.solids.push(glass); e.addCollider(57, 4.5, 10, 5, 5);
    outline(glass, 30);
    const screen = makeScreenGlow(2.6, 1.6); screen.position.set(59, 2.4, 6.9); screen.rotation.y = Math.PI; e.world.add(screen);
    const sl = new THREE.PointLight(C.glass, 1.2, 9); sl.position.set(58, 3, 4); e.world.add(sl);
    const sign = box(3.2, 0.7, 0.1, C.cream); sign.position.set(57, 5.6, 2); e.world.add(sign);
    // pillars + crates for cover
    for (const x of [18, 34, 68]) { for (const z of [-4, 4]) wall(x, H / 2, z * 1.2, 1.6, H, 1.6, 0xA9B4BC); }
    for (const [x, z] of [[12, -4.5], [27, 4.5], [44, -4.8], [46, 4.6], [72, -3]]) { wall(x, 0.9, z, 1.8, 1.8, 1.8, 0x8FA3B2); }
    // stairs down at the far end: x from 80 to 86 is a landing, then ramp back toward -x on B2? Simpler: a ramp from x=80 (y=0) to x=94 (y=-11) beyond a doorway, then B2 runs from x=94 back to x=40.
    const rampLen = 22; const ramp = new THREE.Mesh(new THREE.PlaneGeometry(rampLen, 6), mat(0xA9B4BC)); const ang = Math.atan2(11, rampLen); ramp.rotation.x = -Math.PI / 2; ramp.rotation.y = 0;
    const rampG = new THREE.Group(); rampG.position.set(86 + rampLen / 2, -5.5, 0); rampG.rotation.z = -ang; ramp.rotation.x = -Math.PI / 2; rampG.add(ramp); e.world.add(rampG); e.solids.push(ramp);
    wall(97, -1.5, -3.5, 24, 12, 1); wall(97, -1.5, 3.5, 24, 12, 1); wall(86, H / 2, -5, 1, H, 4); wall(86, H / 2, 5, 1, H, 4);
    const rampCeil = ceil(86, 110, H, -3, 3); // keep it simple
    // ---- B2 at y=-11 : x from 108 back to 30, z −W/2..W/2 (wider room at the launcher end)
    const Y2 = -11; flo(30, 110, Y2, -W / 2, W / 2, 0xD3D9DE); ceil(30, 110, Y2 + H, -W / 2, W / 2);
    wall(70, Y2 + H / 2, -W / 2 - 0.5, 82, H, 1); wall(70, Y2 + H / 2, W / 2 + 0.5, 82, H, 1); wall(29.5, Y2 + H / 2, 0, 1, H, W + 2); wall(110.5, Y2 + H / 2, 0, 1, H, W + 2);
    for (let x = 34; x < 108; x += 10) { const l = new THREE.PointLight(0xEAF0F4, 0.7, 20); l.position.set(x, Y2 + H - 0.6, 0); e.world.add(l); const lm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.5), emissive(0xF4F1E9, 1)); lm.position.set(x, Y2 + H - 0.1, 0); e.world.add(lm); }
    // launcher console + missile at the far (−x) end of B2
    this.console = makeConsole(); this.console.position.set(36, Y2, -3); this.console.rotation.y = Math.PI / 2; e.world.add(this.console); e.addCollider(36, -3, 1.4, 4.8, 3.4, Y2);
    const bigMissile = makeMissile(C.lettuce, 1.2); bigMissile.position.set(38, Y2, 4); e.world.add(bigMissile); e.addCollider(38, 4, 2.4, 2.4, 12, Y2); this.bigMissile = bigMissile;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 8, 8, 1, true), mat(C.steelDark, { side: THREE.DoubleSide, transparent: true, opacity: 0.35 })); cage.position.set(38, Y2 + 4, 4); e.world.add(cage);
    const label = box(4, 0.6, 0.1, C.cream); label.position.set(36.9, Y2 + 4.4, -3); label.rotation.y = Math.PI / 2; e.world.add(label);
    this.consoleActor = new Actor(e, new THREE.Group(), { hp: 8, hitR: 2, hitH: 3.2, hitOffset: 1.6 }); this.consoleActor.obj.position.set(36, Y2, -3); this.consoleActor.sparkColor = C.glass;
    // CO2 bottle on the wall near the console
    this.co2 = makeCO2(); this.co2.position.set(44, Y2 + 0.05, W / 2 - 1); e.world.add(this.co2);
    const co2l = new THREE.PointLight(0xFF6B5E, 0.8, 7); co2l.position.set(44, Y2 + 2, W / 2 - 2); e.world.add(co2l);
    // vent grate on the B2 ceiling above the console area for the escape
    const vent = new THREE.Mesh(new THREE.CircleGeometry(2, 12), mat(0x1B242C)); vent.rotation.x = Math.PI / 2; vent.position.set(50, Y2 + H - 0.02, 0); e.world.add(vent); this.ventPos = V3(50, Y2, 0);
    const ventShaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 60, 12, 1, true), mat(0x5D7284, { side: THREE.BackSide })); ventShaft.position.set(50, Y2 + H + 30, 0); e.world.add(ventShaft);
    // floor function: B1 (x<86) y=0 ; ramp 86..108 ; B2 x>=30 & y<-5 → -11
    // the ramp is only 6 wide (z −3..3); beside it and under it is B2 floor at −11, not the ramp surface
    const rampY = (x) => -(x - 86) / 22 * 11; const onRamp = (x, z) => x >= 86 && x <= 108 && Math.abs(z) <= 3;
    e.floorAt = (x, z, y) => {
      if (y < -4.5) { if (onRamp(x, z) && y > rampY(x) - 1.0) return rampY(x); return -11; }
      if (x <= 86) return 0; if (x <= 108) return onRamp(x, z) ? rampY(x) : -11; return -11;
    };
    e.ceilAt = (x, z, y) => {
      if (y < -4.5) { if (onRamp(x, z) && y <= rampY(x) - 1.0) return rampY(x) - 0.2; return Y2 + H; }
      return x <= 108 ? H : Y2 + H;
    };
    e.bounds = { x1: -5, x2: 109.5, z1: -W / 2 + 0.6, z2: W / 2 - 0.6 };
    this.Y2 = Y2; this.W = W; this.buildWiring();
    e.spawn(1, 0, 0, -90);
    // Ryley
    this.ryley = new Companion(e, { x: -2, z: 2 });
    // guards
    this.wanderers = [new Wanderer(e, { x: 30, z: 0, kind: 'ceiling', ceilY: H }), new Wanderer(e, { x: 46, z: -2, kind: 'float' }), new Wanderer(e, { x: 57, z: 4.6, kind: 'gamer' })];
    this.guard = new Trooper(e, { x: 76, z: 0, hp: 5, dmg: 9, standoff: 9, indoor: true }); this.guard.fireT = 999; this.guard.asleep = true;
    this.fire = null; this.hasCO2 = false; this.stage = 0;
  }

  // cable trays, wire bundles, junction boxes and drooping cables — the bunker is stitched together with wiring
  buildWiring() {
    const e = this.e, H = this.H, W = this.W, Y2 = this.Y2; const wireCols = [C.tomato, C.scarf, 0x3B7DD8, 0x2A3340];
    const tray = (x1, x2, y, z) => {
      const t = box(x2 - x1, 0.22, 0.9, C.steelDark, false); t.position.set((x1 + x2) / 2, y, z); e.world.add(t);
      for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, x2 - x1, 6), mat(wireCols[i])); w.rotation.z = Math.PI / 2; w.position.set((x1 + x2) / 2, y + 0.17, z - 0.3 + i * 0.2); e.world.add(w); }
      for (let x = x1 + 4; x < x2; x += 8) { const br = box(0.12, 0.5, 1, C.steel, false); br.position.set(x, y + 0.36, z); e.world.add(br); }
    };
    tray(-4, 84, H - 0.9, -W / 2 + 0.75); tray(-4, 84, H - 0.9, W / 2 - 0.75); tray(32, 108, Y2 + H - 0.9, -W / 2 + 0.75); tray(32, 108, Y2 + H - 0.9, W / 2 - 0.75);
    // junction boxes with a blinking LED, conduit running up into the tray
    this.leds = [];
    for (const [x, y, side] of [[10, 0, -1], [38, 0, 1], [64, 0, -1], [80, 0, 1], [48, Y2, -1], [96, Y2, 1], [70, Y2, -1]]) {
      const z = side * (W / 2 - 0.22), zf = side * (W / 2 - 0.45);
      const jb = box(1.4, 1.8, 0.32, C.steelLight); jb.position.set(x, y + 3, z); e.world.add(jb);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), emissive(C.laser, 1.4)); led.position.set(x + 0.4, y + 3.55, zf); e.world.add(led); this.leds.push({ led, t: Math.random() * 3 });
      const sw = box(0.3, 0.5, 0.12, C.ink, false); sw.position.set(x - 0.3, y + 2.9, zf); e.world.add(sw);
      const top = y + H - 0.9; const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, top - (y + 3.9), 6), mat(C.steel)); cd.position.set(x, (top + y + 3.9) / 2, zf + side * 0.15); e.world.add(cd);
    }
    // cables drooping across the ceiling
    const droop = (x, y, r = 0.06, col = 0x2A3340) => {
      const pts = [V3(x, y + H - 0.8, -W / 2 + 1), V3(x + 0.6, y + H - 2.4, -W / 5), V3(x - 0.4, y + H - 2.7, W / 6), V3(x + 0.3, y + H - 0.8, W / 2 - 1)];
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 6, false), mat(col)); e.world.add(tube); return tube;
    };
    for (const x of [8, 22, 50, 66, 78]) { droop(x, 0); droop(x + 0.5, 0, 0.04, C.tomato); }
    for (const x of [58, 88, 102]) { droop(x, Y2); droop(x + 0.4, Y2, 0.04, C.scarf); }
    // wall panels near the launcher
    for (const [x, z] of [[42, -W / 2 + 0.25], [33, W / 2 - 0.25]]) {
      const pn = box(2.6, 2.2, 0.3, C.steelLight); pn.position.set(x, Y2 + 3, z); e.world.add(pn);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), emissive(i % 3 ? C.laser : C.tomato, 1)); b.position.set(x - 0.8 + i * 0.32, Y2 + 3.5, z + (z < 0 ? 0.2 : -0.2)); e.world.add(b); }
      const meter = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), emissive(0xF4F1E9, 0.6)); meter.position.set(x + 0.6, Y2 + 2.6, z + (z < 0 ? 0.2 : -0.2)); if (z > 0) meter.rotation.y = Math.PI; e.world.add(meter);
    }
    // the reactor circuit: a thick bundle from the console to the missile cage and up the wall
    const cpts = [V3(36.8, Y2 + 1.4, -2.2), V3(37.8, Y2 + 0.35, 0.6), V3(38.6, Y2 + 0.5, 2.8), V3(39.9, Y2 + 2.2, 4.2), V3(40.2, Y2 + 6.5, 4.6), V3(40.2, Y2 + H - 0.9, 6.2)];
    this.circuitCurve = new THREE.CatmullRomCurve3(cpts);
    this.circuit = new THREE.Mesh(new THREE.TubeGeometry(this.circuitCurve, 24, 0.22, 8, false), mat(0x2A3340)); e.world.add(this.circuit);
    this.circuitStrands = [];
    for (let i = 0; i < 3; i++) { const off = V3(Math.cos(i * 2.1) * 0.28, 0.1 + Math.sin(i * 2.1) * 0.2, 0); const strand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cpts.map(p => p.clone().add(off))), 24, 0.06, 6, false), mat(wireCols[i])); e.world.add(strand); this.circuitStrands.push(strand); }
    const clamp1 = box(0.9, 0.5, 0.9, C.steel, false); clamp1.position.set(38.6, Y2 + 0.5, 2.8); e.world.add(clamp1);
  }
  ambient() { this.e.audio.ambUnderground(); this.e.audio.ambReactor(0.06); }
  async intro() {
    const e = this.e, d = this.dir; d.begin(); e.audio.ambUnderground(); e.audio.ambReactor(0.06);
    d.lookFrom(V3(0.4, 28, 0), V3(0.4, 0, 0)); // reveal the cinematic opening (top of the vent shaft), not the player-spawn view
    await e.fade(0, 1.4);
    d.narrate('06-scene-5', { wait: false });
    // rope down the shaft, look around B1
    await d.cam({ from: [0.4, 28, 0], to: [0.4, 1.7, 0], look: [0.4, 0, 0], lookTo: [20, 2, 0], dur: 30, linear: true });
    await d.cam({ from: [0.4, 1.7, 0], to: [6, 1.7, 0], look: [20, 2, 0], lookTo: [30, 6, -2], dur: 12 });
    await d.cam({ from: [6, 1.7, 0], to: [12, 1.7, 1], look: [30, 6, -2], lookTo: [57, 2.5, 4.5], dur: 12 });
    await d.cam({ from: [12, 1.7, 1], to: [1, 1.7, 0], look: [57, 2.5, 4.5], lookTo: [40, 2, 0], dur: 10 });
    d.end({ keepNarration: true }); // the ~140s narration keeps playing over the underground gameplay (it describes the guards/reactor/fire/vent) instead of being cut here
  }
  play() {
    const e = this.e;
    this.oGuard = this.obj('Get past the guard who still has his wits'); this.oLauncher = this.obj('Find the launcher on B2 and shut it off. The rough way.'); this.oFire = this.obj('Put the fire out'); this.oRide = this.obj('Ride the CO₂ bottle back up the vent');
    this.begin(); e.player.controlsOn = true; e.lock(); e.toast('SCENE FIVE', 'SHUT IT DOWN', 3);
    e.hint('The guards down here have <b>gone strange</b>. They are not holding weapons. <b>Leave them.</b>', 7);
    this.guard.onDeath = () => { e.completeObjective(this.oGuard); e.hint('Stairs down to <b>B2</b> at the end of the corridor.', 5); };
    this.consoleActor.onHit = (dmg, p) => { if (this.stage !== 1) return; this.consoleActor.hp -= dmg; e.sparks(p, 8, C.glass); e.audio.zap(); if (this.consoleActor.hp <= 0) this.blowConsole(); };
    this.e.onWorldHit = null;
  }
  blowConsole() {
    const e = this.e; this.stage = 2; e.removeTarget(this.consoleActor);
    e.explosion(this.console.position.clone().add(V3(0, 2, 0)), 1.6, { debris: 6 }); e.audio.alarm(4, 320);
    this.console.userData.off.material = emissive(0xE1382B, 1.2); this.console.userData.screen.material = mat(C.slate); this.console.userData.lamp.material = mat(C.slate);
    this.bigMissile.userData.flame.visible = false; e.completeObjective(this.oLauncher);
    e.audio.stopLoop('reactor'); e.audio.ambFire(0.12);
    // the circuit arcs along its whole length, then chars
    this.circuitArc = 9; for (const st of this.circuitStrands) st.material = mat(0x1A1A1A); this.circuit.material = mat(0x151515);
    for (const l of this.leds) l.dead = Math.random() < 0.6;
    // fire
    const f = new THREE.Group(); f.position.set(38.5, this.Y2, -0.5); e.world.add(f); this.fire = f; this.fireHP = 1;
    this.flames = []; for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(rand(0.5, 1), rand(2, 3.6), 7), new THREE.MeshBasicMaterial({ color: i % 2 ? C.orange : C.scarf, transparent: true, opacity: 0.9 })); c.position.set(rand(-2.2, 2.2), 1, rand(-2, 2)); f.add(c); this.flames.push(c); }
    this.fireLight = new THREE.PointLight(0xFF7A2A, 4, 30); this.fireLight.position.set(0, 2, 0); f.add(this.fireLight);
    e.toast('FIRE!', 'THE REACTOR CIRCUIT BLEW OUT', 3); e.hint('There is a <b>CO₂ bottle</b> on the wall. Walk up to it and press <b>E</b>.', 8);
  }
  update(dt) {
    const e = this.e, p = e.yaw.position;
    for (const l of this.leds) { l.t += dt; l.led.material.emissiveIntensity = l.dead ? 0 : ((l.t % 1.6) < 0.12 ? 1.6 : 0.35); }
    if (this.circuitArc > 0) { this.circuitArc -= dt; if (this.t % 0.22 < dt) { const pt = this.circuitCurve.getPoint(Math.random()); e.sparks(pt, 6, Math.random() < 0.5 ? C.glass : C.scarf); e.audio.zap(); } }
    // wake the guard when close
    if (this.guard.alive && this.guard.asleep && p.distanceTo(this.guard.pos) < 26) { this.guard.asleep = false; this.guard.fireT = 0.6; e.toast('GUARD', 'THIS ONE STILL HAS HIS WITS', 2.2); }
    // stage 0: reach B2 → stage 1: console is shootable
    if (this.stage === 0 && p.y < -9 && p.x < 70) { this.stage = 1; e.hint('That is the launcher. No password. <b>Shoot the console.</b>', 6); e.toast('B2', 'NUKE LAUNCHER', 2.4); }
    if (this.fire) {
      for (const c of this.flames) { c.scale.y = (0.8 + Math.sin(this.t * 9 + c.position.x * 3) * 0.25) * this.fireHP; c.scale.x = c.scale.z = (0.9 + Math.cos(this.t * 7 + c.position.z) * 0.15) * Math.max(0.05, this.fireHP); }
      this.fireLight.intensity = 4 * this.fireHP + Math.sin(this.t * 20) * 0.6;
      if (this.t % 0.25 < dt && this.fireHP > 0.1) e.puff(this.fire.position.clone().add(V3(rand(-2, 2), 2.5, rand(-2, 2))), 0x333B44, 1.2, 1.8);
      if (this.fireHP > 0.1 && Math.hypot(p.x - this.fire.position.x, p.z - this.fire.position.z) < 3.6 && this.t % 0.5 < dt) e.damage(6, 'fire');
    }
    // CO2 pickup
    if (this.stage === 2 && !this.hasCO2) {
      const d = Math.hypot(p.x - this.co2.position.x, p.z - this.co2.position.z);
      if (d < 3) { e.hint('Press <b>E</b> to grab the CO₂ bottle'); if (e.keys.KeyE) { this.hasCO2 = true; e.world.remove(this.co2); e.audio.pickup(); this.stage = 3; e.player.canShoot = false; this.swapToCO2(); e.hint('Aim at the fire and <b>hold click</b> to spray.', 6); } }
      else if (d < 8) e.hint('The CO₂ bottle is on the wall');
    }
    // spraying
    if (this.stage === 3) {
      if (e.mouse.down && e.mouse.locked) {
        const dir = e.aimDir(); const from = e.eye(); if (this.t % 0.05 < dt) { const s = makeGlow(0xE8F4F8, 0.09); s.position.copy(from).addScaledVector(dir, 1.4).add(V3(0.22, -0.28, 0)); e.fx.add(s); const v = dir.clone().multiplyScalar(14).add(V3(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1))); e.effects.push({ obj: s, t: 0, life: 0.6, update: (ev, k, d2) => { s.position.addScaledVector(v, d2); s.scale.setScalar(1 + k * 4); s.material.opacity = 0.7 * (1 - k); } }); }
        if (!this.hissing) { this.hissing = true; e.audio.hiss(1); setTimeout(() => this.hissing = false, 900); }
        const toFire = this.fire.position.clone().add(V3(0, 1.5, 0)).sub(from); const dist = toFire.length(); toFire.normalize();
        if (dist < 12 && toFire.dot(dir) > 0.86 && this.fireHP > 0) { this.fireHP = Math.max(0, this.fireHP - dt * 0.28); }
        if (this.fireHP <= 0 && !this.oFire.done) { e.completeObjective(this.oFire); e.audio.stopLoop('fire'); this.stage = 4; e.toast('FIRE OUT', 'NOW… THE SAME BOTTLE, POINTED AT THE FLOOR', 3.5); e.hint('Stand under the <b>vent</b> (dark circle in the ceiling), <b>aim at the floor</b> and hold click.', 12); const vl = new THREE.PointLight(C.laser, 1.6, 14); vl.position.copy(this.ventPos).add(V3(0, 5, 0)); e.world.add(vl); }
      }
    }
    if (this.stage === 4) {
      const under = Math.hypot(p.x - this.ventPos.x, p.z - this.ventPos.z) < 2.6; const aimDown = e.aimDir().y < -0.6;
      if (under && aimDown && e.mouse.down && e.mouse.locked) { this.stage = 5; this.ride(); }
      else if (under && this.t % 1 < dt) e.hint('<b>Look down</b> at the floor and hold click to fire the bottle.');
    }
  }
  swapToCO2() {
    const e = this.e; const vm = e.viewmodel; vm.visible = false;
    const b = makeCO2(); b.scale.setScalar(0.2); b.rotation.set(0.5, -0.6, 0.1); b.position.set(0.36, -0.42, -0.6); e.camera.add(b); this.co2vm = b; b.traverse(o => { o.castShadow = false; });
  }
  async ride() {
    const e = this.e, d = this.dir; this.done = true; this.stop(); e.completeObjective(this.oRide); e.player.controlsOn = false; d.begin();
    if (this.co2vm) e.camera.remove(this.co2vm);
    e.audio.hiss(4); e.shake = 0.5;
    const start = this.ventPos.clone().add(V3(0, 1.7, 0));
    await d.cam({ from: [start.x, start.y, start.z], to: [start.x, start.y + 56, start.z], look: [start.x, start.y + 8, start.z], lookTo: [start.x, start.y + 70, start.z], dur: 5.5, linear: true, shake: 0.25 });
    e.flash(1, 1.5); await e.fade(1, 0.4); d.end(); this.onWin && this.onWin();
  }
}

// ===================================================================== ENDING
export async function endingCutscene(game) {
  const e = game.e, d = game.dir; e.clearWorld(); e.scene.background = new THREE.Color(C.sky);
  const r = buildField(e, { wreckedLettuce: true, crater: true, wreckedTomatoRoof: true, roofGun: false, phase: 'dawn' });
  const tom = makeSoldier({ color: C.tomato, hazmat: true, scarf: true, rifle: false }); tom.position.set(FIELD.lettuceSiloX - 6, 0, 12); e.world.add(tom);
  const ry = makeSoldier({ color: C.tomato, hazmat: true, rifle: false }); ry.position.set(FIELD.lettuceSiloX - 3, 0, 15); e.world.add(ry);
  for (const s of [tom, ry]) s.lookAt(FIELD.tomatoX, 0, 0);
  const co2 = makeCO2(); co2.position.set(FIELD.lettuceSiloX - 5, 0, 9); co2.rotation.z = 1.3; e.world.add(co2);
  e.setTimeOfDay('night'); d.begin(); e.audio.ambWind(0.05); e.tweenTimeOfDay('night', 'dawn', 26); await e.fade(0, 1.6);
  let wt = 0; const walk = (dt) => { wt += dt; for (const s of [tom, ry]) { s.position.x -= 2.2 * dt; animateWalk(s, dt, 0.8); } if (wt > 40) e.updaters.delete(walk); }; e.updaters.add(walk);
  d.narrate('07-ending', { wait: false });
  await d.cam({ from: [FIELD.lettuceSiloX + 10, 3, 26], to: [FIELD.lettuceSiloX - 20, 5, 20], look: [FIELD.lettuceSiloX - 6, 2, 12], lookTo: [FIELD.lettuceSiloX - 40, 2, 8], dur: 16 });
  await d.cam({ from: [FIELD.lettuceSiloX - 20, 5, 20], to: [FIELD.lettuceSiloX - 30, 24, 60], look: [FIELD.lettuceSiloX - 40, 2, 8], lookTo: [FIELD.tomatoX, 8, 0], dur: 18 });
  await d.until(() => !e.audio.narr, 25);
  await e.fade(1, 1.6); d.end();
}
