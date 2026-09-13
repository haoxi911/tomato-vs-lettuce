// Enemies, projectiles and friendly characters.
import * as THREE from 'three';
import { C, mat, emissive, box, cyl, sphere, makeGlow, makeDrone, makeHeli, makeSoldier, makeParachute, poseSoldier, animateWalk, makeMissile, makeLaserPod, makeTurret, at, makeJet, makeGenerator } from './art.js';
import { V3, rand, clamp, lerp } from './engine.js';

const hitMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0, depthWrite: false });

export class Actor {
  constructor(engine, obj, { hp = 3, hitR = 1.5, hitH = null, hitOffset = 0 } = {}) {
    this.e = engine; this.obj = obj; this.alive = true; this.hp = hp; this.maxHp = hp; this.dead = false; this.t = 0;
    const geo = hitH ? new THREE.BoxGeometry(hitR * 2, hitH, hitR * 2) : new THREE.SphereGeometry(hitR, 8, 6);
    this.hitbox = new THREE.Mesh(geo, hitMat); this.hitbox.position.y = hitOffset; obj.add(this.hitbox);
    engine.world.add(obj); engine.addTarget(this);
    this._upd = (dt) => this.update(dt); engine.updaters.add(this._upd);
    this.onDeath = null;
  }
  get pos() { return this.obj.position; }
  onHit(dmg, point, dir) { if (!this.alive) return; this.hp -= dmg; this.flashHit(); if (this.hp <= 0) this.die(point, dir); }
  flashHit() { this.obj.traverse(o => { if (o.isMesh && o.material && o.material.emissive && !o.userData.noFlash) { const m = o.material; if (!m.userData.shared) { m.userData.shared = true; } } }); if (this._flashing) return; this._flashing = true; const s = this.obj.scale.x; this.obj.scale.setScalar(s * 1.06); setTimeout(() => { this.obj.scale.setScalar(s); this._flashing = false; }, 60); }
  die(point, dir) { this.alive = false; this.e.removeTarget(this); this.onDeath && this.onDeath(this); }
  remove() { this.dead = true; this.e.updaters.delete(this._upd); this.e.world.remove(this.obj); this.e.removeTarget(this); }
  update(dt) { this.t += dt; }
  distToPlayer() { return this.pos.distanceTo(this.e.yaw.position); }
  toPlayer() { return this.e.yaw.position.clone().sub(this.pos); }
}

// Enemy fires at the player: hit probability by distance + movement, visual tracer, damage.
export function enemyFire(e, from, dmg = 8, opts = {}) {
  const eye = e.eye(); const d = from.distanceTo(eye);
  const moving = e.player.vel.length() > 2.5;
  let p = clamp(0.48 - d * 0.006, 0.12, 0.48) * (moving ? 0.55 : 1) * (opts.acc || 1);
  if (!e.hostile()) return false;
  const hit = Math.random() < p && e.player.alive && e.player.controlsOn;
  const target = hit ? eye.clone().add(V3(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2))) : eye.clone().add(V3(rand(-2.5, 2.5), rand(-1.5, 2.2), rand(-2.5, 2.5)));
  e.tracer(from, target, opts.color || 0xFFB4A2, 0.09);
  e.audio.enemyShot(clamp((from.x - eye.x) / 40, -1, 1));
  if (hit) e.damage(dmg, opts.who || 'enemy', from);
  return hit;
}

// ---------------------------------------------------------------- projectiles
export class Bomb extends Actor {
  constructor(e, pos, vel, { dmg = 30, radius = 5, size = 1.2 } = {}) {
    const m = sphere(0.35, C.ink, 8); super(e, m, { hp: 1, hitR: 0.6 });
    m.position.copy(pos); this.vel = vel.clone(); this.dmg = dmg; this.radius = radius; this.size = size;
  }
  update(dt) {
    super.update(dt); if (!this.alive) return;
    this.vel.y -= 18 * dt; this.pos.addScaledVector(this.vel, dt);
    if (this.t > 0.15 && this.t % 0.12 < dt) this.e.puff(this.pos, 0x7F8A95, 0.5, 0.9);
    const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
    if (this.pos.y <= floor + 0.3 || this.distToPlayer() < 1.6) this.boom();
  }
  boom() {
    if (!this.alive) return; this.alive = false;
    this.e.explosion(this.pos.clone(), this.size); const d = this.distToPlayer();
    if (d < this.radius) this.e.damage(this.dmg * (1 - d / this.radius * 0.6), 'bomb');
    this.e.onBlast && this.e.onBlast(this.pos.clone(), this.dmg, this.radius, 'bomb');
    this.remove();
  }
  die() { this.e.explosion(this.pos.clone(), 0.7); this.alive = false; this.remove(); }
}

export class Rocket extends Actor {
  constructor(e, pos, target, { speed = 16, dmg = 28, homing = 0.6, color = C.lettuce } = {}) {
    const m = makeMissile(color, 0.35); m.userData.flame.visible = true; super(e, m, { hp: 1, hitR: 0.9 });
    m.position.copy(pos); this.speed = speed; this.dmg = dmg; this.homing = homing; this.dir = target.clone().sub(pos).normalize(); this.life = 9;
  }
  update(dt) {
    super.update(dt); if (!this.alive) return;
    const want = this.e.eye().sub(this.pos).normalize(); this.dir.lerp(want, clamp(this.homing * dt, 0, 1)).normalize();
    this.pos.addScaledVector(this.dir, this.speed * dt);
    this.obj.quaternion.setFromUnitVectors(V3(0, 1, 0), this.dir);
    if (this.t % 0.08 < dt) this.e.puff(this.pos.clone().addScaledVector(this.dir, -1.2), 0xB9C3C9, 0.45, 1.1);
    const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
    if (this.pos.y <= floor + 0.4 || this.distToPlayer() < 2 || this.t > this.life) this.boom();
  }
  boom() { if (!this.alive) return; this.alive = false; this.e.explosion(this.pos.clone(), 1.1); const d = this.distToPlayer(); if (d < 5) this.e.damage(this.dmg * (1 - d / 8), 'rocket'); this.e.onBlast && this.e.onBlast(this.pos.clone(), this.dmg, 5, 'rocket'); this.remove(); }
  die() { this.e.explosion(this.pos.clone(), 0.8); this.alive = false; this.remove(); }
}

// ---------------------------------------------------------------- drone
export class Drone extends Actor {
  constructor(e, { center = V3(0, 14, 0), radius = 18, height = 14, color = C.lettuceLight, bombs = true, phase = Math.random() * 6, dropSoldier = null } = {}) {
    const m = makeDrone(color); super(e, m, { hp: 3, hitR: 2 });
    this.center = center; this.radius = radius; this.height = height; this.phase = phase; this.bombs = bombs; this.next = rand(3, 6); this.mode = 'orbit'; this.dropSoldier = dropSoldier;
    this.sparkColor = C.lettuceLight; this.pos.set(center.x + Math.cos(phase) * radius, height, center.z + Math.sin(phase) * radius);
    this.dive = null; this.fallV = 0;
  }
  update(dt) {
    super.update(dt); const u = this.obj.userData; for (const r of u.rotors) r.rotation.y += dt * 40;
    if (!this.alive) { // falling
      this.fallV += 18 * dt; this.pos.y -= this.fallV * dt; this.obj.rotation.x += dt * 3; this.obj.rotation.z += dt * 2;
      if (this.t % 0.1 < dt) this.e.puff(this.pos, 0x555C66, 0.6, 1);
      const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
      if (this.pos.y <= floor + 0.5) { this.e.explosion(this.pos.clone(), 1.3, { debris: 4 }); this.remove(); }
      return;
    }
    const a = this.phase + this.t * 0.35;
    const want = this.mode === 'orbit'
      ? V3(this.center.x + Math.cos(a) * this.radius, this.height + Math.sin(this.t * 1.3) * 1.5, this.center.z + Math.sin(a) * this.radius)
      : this.dive;
    this.pos.lerp(want, clamp(dt * (this.mode === 'orbit' ? 0.9 : 1.6), 0, 1));
    this.obj.rotation.z = lerp(this.obj.rotation.z, (want.x - this.pos.x) * 0.04, dt * 3); this.obj.rotation.x = lerp(this.obj.rotation.x, -(want.z - this.pos.z) * 0.04, dt * 3);
    this.next -= dt;
    const tgt = this.target ? this.target() : (this.e.hostile() ? this.e.yaw.position : null);
    if (this.mode === 'orbit' && this.next <= 0 && this.bombs && tgt) { this.mode = 'dive'; const tp = tgt; this.dive = V3(tp.x + rand(-3, 3), 9, tp.z + rand(-3, 3)); this.next = 2.2; this.e.audio.whoosh(); }
    else if (this.mode === 'dive' && this.next <= 0) {
      const tp = tgt || this.e.yaw.position; const dir = tp.clone().sub(this.pos); dir.y = 0; dir.normalize();
      new Bomb(this.e, this.pos.clone().add(V3(0, -0.9, 0)), dir.multiplyScalar(5)); this.mode = 'orbit'; this.next = rand(4, 7.5);
    }
  }
  die(point, dir) { super.die(); this.e.explosion(this.pos.clone(), 0.9); this.fallV = 0; }
}

// ---------------------------------------------------------------- soldier on foot
export class Trooper extends Actor {
  constructor(e, { x = 0, z = 0, y = 0, color = C.lettuceLight, chute = false, hp = 3, dmg = 8, standoff = 13, acc = 1, faction = 'lettuce', indoor = false } = {}) {
    const m = makeSoldier({ color }); super(e, m, { hp, hitR: 0.9, hitH: 3, hitOffset: 1.5 });
    this.pos.set(x, y, z); this.dmg = dmg; this.standoff = standoff; this.acc = acc; this.faction = faction; this.indoor = indoor;
    this.state = chute ? 'chute' : 'ground'; this.fireT = rand(1, 2.5); this.burst = 0; this.strafeT = 0; this.strafe = 0; this.sparkColor = C.tomato;
    if (chute) { this.chute = makeParachute(faction === 'tomato' ? 0xF1F5F7 : 0xEAF4E4); this.obj.add(this.chute); this.landing = V3(x + rand(-6, 6), 0, z + rand(-6, 6)); poseSoldier(m, 'float'); }
    else poseSoldier(m, 'aim');
    this.deadT = 0;
  }
  update(dt) {
    super.update(dt); const m = this.obj;
    if (!this.alive) { this.deadT += dt; if (this.deadT > 3.5) { this.pos.y -= dt * 0.7; if (this.deadT > 6) this.remove(); } return; }
    const pp = this.e.yaw.position;
    if (this.state === 'chute') {
      this.pos.y -= 3.4 * dt; const dx = this.landing.x - this.pos.x, dz = this.landing.z - this.pos.z; const dl = Math.hypot(dx, dz);
      if (dl > 0.3) { this.pos.x += dx / dl * 2 * dt; this.pos.z += dz / dl * 2 * dt; }
      this.chute.rotation.z = Math.sin(this.t * 1.7) * 0.12; this.chute.rotation.x = Math.cos(this.t * 1.3) * 0.1;
      m.lookAt(pp.x, this.pos.y, pp.z);
      const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
      if (this.pos.y <= floor) { this.pos.y = floor; this.state = 'ground'; this.obj.remove(this.chute); poseSoldier(m, 'aim'); this.fireT = 0.8; }
      return;
    }
    // asleep guards stay put until woken (Scene 5's armed guard) — otherwise the AI chases the cutscene camera during the intro and wanders off
    if (this.asleep) { const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0; this.pos.y = floor; return; }
    // ground AI: approach to standoff, strafe, fire bursts
    const to = pp.clone().sub(this.pos); to.y = 0; const d = to.length(); to.normalize();
    m.lookAt(pp.x, this.pos.y, pp.z);
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rand(1.2, 2.6); this.strafe = Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) : 0; }
    let mv = V3();
    if (d > this.standoff + 2) mv.add(to); else if (d < this.standoff - 4) mv.addScaledVector(to, -1);
    mv.add(V3(-to.z, 0, to.x).multiplyScalar(this.strafe * 0.7));
    if (mv.lengthSq() > 0.01) { mv.normalize(); this.pos.addScaledVector(mv, 2.6 * dt); animateWalk(m, dt, 1); }
    else { m.userData.legL.rotation.x = m.userData.legR.rotation.x = 0; }
    const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0; this.pos.y = floor;
    if (this.e.colliders) for (const c of this.e.colliders) {
      const r = 0.6; if (this.pos.y + 1.5 < c.y1 || this.pos.y > c.y2) continue;
      if (this.pos.x > c.x1 - r && this.pos.x < c.x2 + r && this.pos.z > c.z1 - r && this.pos.z < c.z2 + r) {
        const dx1 = this.pos.x - (c.x1 - r), dx2 = (c.x2 + r) - this.pos.x, dz1 = this.pos.z - (c.z1 - r), dz2 = (c.z2 + r) - this.pos.z; const mn = Math.min(dx1, dx2, dz1, dz2);
        if (mn === dx1) this.pos.x = c.x1 - r; else if (mn === dx2) this.pos.x = c.x2 + r; else if (mn === dz1) this.pos.z = c.z1 - r; else this.pos.z = c.z2 + r;
      }
    }
    if (this.e.player.disguised && d < 4.5) { this.nearT = (this.nearT || 0) + dt; if (this.nearT > 1.6) this.e.blowCover('A soldier got a good look at you.'); } else this.nearT = 0;
    if (!this.e.hostile()) { this.fireT = Math.max(this.fireT, 0.5); return; }
    this.fireT -= dt;
    if (this.fireT <= 0 && d < 45) {
      if (this.burst <= 0) this.burst = 3;
      this.burst--; const muzzle = this.pos.clone().add(V3(0, 2.1, 0)).add(to.clone().multiplyScalar(1.1));
      enemyFire(this.e, muzzle, this.dmg, { acc: this.acc, who: 'trooper' });
      this.fireT = this.burst > 0 ? 0.14 : rand(1.4, 2.6);
    }
  }
  die(point, dir) { super.die(); poseSoldier(this.obj, 'down'); this.pos.y += 0.5; this.e.sparks(point, 6, C.tomato); if (this.chute) this.obj.remove(this.chute); }
}

// ---------------------------------------------------------------- helicopter with rope soldier
export class Heli extends Actor {
  constructor(e, { center = V3(0, 0, 0), radius = 34, height = 22, color = C.lettuceLight, hp = 26 } = {}) {
    const m = makeHeli(color); super(e, m, { hp, hitR: 5 });
    this.center = center; this.radius = radius; this.height = height; this.sparkColor = C.lettuceLight;
    this.soldier = makeSoldier({ color }); poseSoldier(this.soldier, 'rope'); this.soldier.scale.setScalar(0.95);
    e.world.add(this.soldier); this.ropeGeo = new THREE.BufferGeometry().setFromPoints([V3(), V3()]);
    this.rope = new THREE.Line(this.ropeGeo, new THREE.LineBasicMaterial({ color: C.ink })); e.world.add(this.rope);
    this.fireT = 2; this.burst = 0; this.crash = null; this.a = Math.random() * 6;
  }
  update(dt) {
    super.update(dt); const u = this.obj.userData; u.rotor.rotation.y += dt * 28; u.tailRotor.rotation.x += dt * 40;
    if (this.crash) {
      this.crash.v += 6 * dt; this.pos.y -= this.crash.v * dt; this.obj.rotation.y += dt * 2.5; this.obj.rotation.z = lerp(this.obj.rotation.z, 0.5, dt);
      if (this.t % 0.07 < dt) this.e.puff(this.pos.clone().add(V3(rand(-2, 2), 0, rand(-2, 2))), 0x444A52, 1.2, 1.4);
      const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
      if (this.pos.y <= floor + 2) { this.e.explosion(this.pos.clone(), 2.4, { debris: 8 }); this.e.world.remove(this.soldier); this.e.world.remove(this.rope); this.remove(); this.onCrash && this.onCrash(); }
      this.updateRope(); return;
    }
    this.a += dt * 0.28; const nx = this.center.x + Math.cos(this.a) * this.radius, nz = this.center.z + Math.sin(this.a) * this.radius;
    const vx = nx - this.pos.x, vz = nz - this.pos.z; this.pos.set(nx, this.height + Math.sin(this.t * 0.9) * 1.2, nz);
    this.obj.rotation.y = Math.atan2(vx, vz) - Math.PI / 2 + Math.PI; this.obj.rotation.z = -0.12;
    this.updateRope();
    // rope soldier shoots
    const pp = this.e.yaw.position; this.soldier.lookAt(pp.x, this.soldier.position.y, pp.z);
    this.fireT -= dt; if (this.fireT <= 0 && this.e.hostile()) { if (this.burst <= 0) this.burst = 4; this.burst--; enemyFire(this.e, this.soldier.position.clone().add(V3(0, 1.6, 0)), 7, { acc: 0.8, who: 'heli' }); this.fireT = this.burst > 0 ? 0.13 : rand(1.6, 3); }
  }
  updateRope() {
    const anchor = this.obj.userData.ropeAnchor.getWorldPosition(V3());
    const sway = V3(Math.sin(this.t * 1.4) * 1.2, 0, Math.cos(this.t * 1.1) * 1.2);
    const sp = anchor.clone().add(V3(0, -9, 0)).add(sway); if (!this.crash) this.soldier.position.lerp(sp, 0.3); else this.soldier.position.copy(sp);
    const pts = this.ropeGeo.attributes.position.array; pts[0] = anchor.x; pts[1] = anchor.y; pts[2] = anchor.z;
    const hand = this.soldier.position.clone().add(V3(0, 2.8, 0)); pts[3] = hand.x; pts[4] = hand.y; pts[5] = hand.z; this.ropeGeo.attributes.position.needsUpdate = true;
  }
  die() { super.die(); this.crash = { v: 2 }; this.e.explosion(this.pos.clone(), 1.4); this.e.audio.stopLoop('heli'); }
  remove() { this.e.world.remove(this.soldier); this.e.world.remove(this.rope); super.remove(); }
}

// ---------------------------------------------------------------- missile in flight (arc from A to B)
export class ArcMissile extends Actor {
  constructor(e, { from, to, dur = 8, color = C.lettuce, apex = 40, hp = 4, targetable = true, size = 1, onArrive = null, big = false }) {
    const m = big ? null : makeMissile(color, size); const obj = m || new THREE.Group(); super(e, obj, { hp, hitR: 1.6 * size });
    if (!targetable) e.removeTarget(this);
    this.from = from.clone(); this.to = to.clone(); this.dur = dur; this.apex = apex; this.onArrive = onArrive; this.sparkColor = C.orange;
    obj.userData.flame && (obj.userData.flame.visible = true); this.pos.copy(from); this.last = from.clone();
    e.audio.missileLaunch();
  }
  at(k) { const p = this.from.clone().lerp(this.to, k); p.y += Math.sin(k * Math.PI) * this.apex; return p; }
  update(dt) {
    super.update(dt); if (!this.alive) return; const k = clamp(this.t / this.dur, 0, 1); const p = this.at(k);
    const dir = p.clone().sub(this.last); if (dir.lengthSq() > 1e-6) { dir.normalize(); this.obj.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); }
    this.last.copy(this.pos); this.pos.copy(p);
    if (this.t % 0.06 < dt) this.e.puff(this.pos.clone().addScaledVector(dir, -2), 0xC3CBD2, 0.8, 1.5);
    if (k >= 1) { this.alive = false; this.e.explosion(this.pos.clone(), 2.2, { debris: 6 }); this.remove(); this.onArrive && this.onArrive(this); }
  }
  die() { super.die(); this.e.explosion(this.pos.clone(), 1.4); this.remove(); this.onShotDown && this.onShotDown(this); }
}

// ---------------------------------------------------------------- roof laser pod
export class LaserPod extends Actor {
  // charge (tracking, visible sight line) -> lock (aim frozen, sight goes bright) -> fire (beam along the locked line, stopped by anything solid)
  constructor(e, { x, y, z, color = C.lettuceLight, hp = 10, dmg = 18, period = 3.4, charge = 1.3, lock = 0.7 } = {}) {
    const m = makeLaserPod(color); super(e, m, { hp, hitR: 1.4, hitH: 3, hitOffset: 1.4 });
    this.pos.set(x, y, z); this.dmg = dmg; this.period = period; this.chargeT = charge; this.lockT = lock; this.phase = 'idle'; this.pt = rand(0.5, 2.5); this.aim = V3(); this.sparkColor = C.lettuceLight;
    const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2);
    this.sight = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: C.laser, transparent: true, opacity: 0.2, depthWrite: false })); this.sight.visible = false; e.fx.add(this.sight);
    this.glow = makeGlow(C.laser, 0.6); this.glow.material.opacity = 0.7; this.glow.visible = false; this.obj.userData.lens.add(this.glow);
    this.ray = new THREE.Raycaster();
  }
  lensPos() { return this.obj.userData.lens.getWorldPosition(V3()); }
  // where a beam from the lens toward `to` really ends: the first solid in the way, or far past the target
  beamEnd(from, to, maxLen = 160) {
    const dir = to.clone().sub(from); const dist = dir.length(); dir.normalize();
    this.ray.set(from, dir); this.ray.far = maxLen;
    const hits = this.ray.intersectObjects(this.e.solids, false).filter(h => h.distance > 0.8);
    const end = from.clone().addScaledVector(dir, maxLen);
    if (hits.length) { end.copy(hits[0].point); return { end, blocked: hits[0].distance < dist - 0.6, dir }; }
    return { end, blocked: false, dir };
  }
  showSight(from, to, radius, opacity) {
    // stop the line a couple of metres short of where it points, so it reads as a line and not a cone in your face
    const s = this.sight; const len = Math.max(0.5, from.distanceTo(to) - 4); s.visible = true; s.position.copy(from); s.lookAt(to); s.scale.set(radius, radius, len); s.material.opacity = opacity;
  }
  update(dt) {
    super.update(dt); if (!this.alive) return; const u = this.obj.userData; const pp = this.e.eye();
    this.pt -= dt;
    if (this.phase === 'idle') {
      const dir = pp.clone().sub(this.pos); u.yaw.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2; u.lens.scale.setScalar(1); this.sight.visible = false; this.glow.visible = false;
      if (this.pt <= 0 && this.distToPlayer() < 90 && this.e.hostile()) { this.phase = 'charge'; this.pt = this.chargeT; this.e.audio.laserCharge(this.chargeT + this.lockT); }
    } else if (this.phase === 'charge') {
      // tracking: the pod follows the player and a faint sight line shows where it is looking
      const dir = pp.clone().sub(this.pos); u.yaw.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2; this.aim.copy(pp); this.aim.y -= 0.55;
      const k = 1 - this.pt / this.chargeT; u.lens.scale.setScalar(1 + k * 1.1); this.glow.visible = true; this.glow.scale.setScalar(1 + k * 3);
      const lens = this.lensPos(); const b = this.beamEnd(lens, this.aim); this.showSight(lens, b.end, 0.04 + k * 0.04, 0.16 + k * 0.24);
      if (this.pt <= 0) { this.phase = 'lock'; this.pt = this.lockT; }
    } else if (this.phase === 'lock') {
      // locked: the aim no longer follows you — this is the window to step out of the line
      u.lens.scale.setScalar(2.4 + Math.sin(this.t * 40) * 0.3); this.glow.scale.setScalar(4.5 + Math.sin(this.t * 40));
      const lens = this.lensPos(); const b = this.beamEnd(lens, this.aim); this.showSight(lens, b.end, 0.1, 0.6 + Math.sin(this.t * 40) * 0.25);
      if (this.pt <= 0) {
        this.phase = 'fire'; this.pt = 0.3; this.sight.visible = false; this.glow.visible = false;
        const b2 = this.beamEnd(lens, this.aim); this.e.beam(lens, b2.end, C.laser, 0.45, 0.2); this.e.audio.laserFire();
        this.e.sparks(b2.end, 6, C.laser);
        // hit if the player's body is close to the beam line and nothing solid stood between
        const seg = b2.end.clone().sub(lens); const segLen = seg.length(); seg.normalize();
        const rel = pp.clone().sub(lens); const along = THREE.MathUtils.clamp(rel.dot(seg), 0, segLen); const closest = lens.clone().addScaledVector(seg, along);
        const d = pp.distanceTo(closest), dFeet = pp.clone().sub(V3(0, 1.2, 0)).distanceTo(closest);
        if (Math.min(d, dFeet) < 1.5 && !b2.blocked) this.e.damage(this.dmg, 'laser', lens);
      }
    } else if (this.phase === 'fire') { if (this.pt <= 0) { this.phase = 'idle'; this.pt = this.period + rand(-0.5, 0.8); } }
  }
  die(point) { this.sight.visible = false; this.glow.visible = false; this.e.fx.remove(this.sight); super.die(); this.e.explosion(this.pos.clone().add(V3(0, 1.5, 0)), 1.2, { debris: 5 }); const x1 = box(3.2, 0.3, 0.3, C.tomato, false), x2 = box(3.2, 0.3, 0.3, C.tomato, false); x1.rotation.z = 0.8; x2.rotation.z = -0.8; x1.position.y = x2.position.y = 1.5; this.obj.add(x1, x2); this.obj.userData.lens.material = mat(C.slate); this.obj.userData.yaw.rotation.x = 0.5; }
  remove() { this.e.fx.remove(this.sight); super.remove(); }
}

// ---------------------------------------------------------------- health pack: walk over it to heal; comes back after a while
export class HealthPack extends Actor {
  constructor(e, { x, z, heal = 40, respawn = 30 } = {}) {
    const g = new THREE.Group();
    const bx = box(0.9, 0.5, 0.9, 0xF4F1E9); bx.position.y = 0.25; g.add(bx);
    const c1 = box(0.5, 0.12, 0.16, C.tomato, false), c2 = box(0.16, 0.12, 0.5, C.tomato, false); c1.position.y = c2.position.y = 0.52; g.add(c1, c2);
    const glow = makeGlow(0xFF6B5E, 0.9); glow.position.y = 0.3; glow.material.opacity = 0.18; g.add(glow);
    super(e, g, { hp: 999, hitR: 0.6, hitH: 1, hitOffset: 0.5 }); e.removeTarget(this);
    this.pos.set(x, 0, z); this.heal = heal; this.respawn = respawn; this.ready = true; this.hideT = 0; this.light = new THREE.PointLight(0xFF6B5E, 0.8, 6); this.light.position.y = 1; g.add(this.light);
  }
  onHit() { }
  update(dt) {
    super.update(dt);
    if (!this.ready) { this.hideT -= dt; if (this.hideT <= 0) { this.ready = true; this.obj.visible = true; } return; }
    this.obj.rotation.y += dt * 1.6; this.obj.position.y = 0.15 + Math.sin(this.t * 3) * 0.12;
    const p = this.e.player; const yp = this.e.yaw.position;
    if (p.alive && p.hp < p.maxHp && Math.hypot(yp.x - this.pos.x, yp.z - this.pos.z) < 1.4) {
      p.hp = Math.min(p.maxHp, p.hp + this.heal); this.e.updateHUD(); this.e.audio.pickup(); this.e.sparks(this.pos.clone().add(V3(0, 0.8, 0)), 10, 0xFF6B5E);
      this.e.hint('<b>+' + this.heal + ' HEALTH</b>', 1.6);
      this.ready = false; this.hideT = this.respawn; this.obj.visible = false;
    }
  }
}

// ---------------------------------------------------------------- rocket pod (level 4 risen machine)
export class RocketPod extends Actor {
  constructor(e, { x, y = 0, z, color = C.lettuce, hp = 12, period = 4.5 } = {}) {
    const g = new THREE.Group(); g.add(at(box(4, 1, 4, C.steel), 0, 0.5, 0));
    const yaw = new THREE.Group(); yaw.position.y = 1; g.add(yaw); g.userData.yaw = yaw;
    yaw.add(at(box(2.6, 1.8, 2.2, color), 0, 0.9, 0));
    const tubes = new THREE.Group(); tubes.position.set(0, 1.4, 0); yaw.add(tubes);
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const t = cyl(0.42, 0.42, 3, C.steelDark, 8); t.rotation.z = Math.PI / 2; t.position.set(1.6, a, b); tubes.add(t); }
    super(e, g, { hp, hitR: 2, hitH: 3.5, hitOffset: 1.7 }); this.pos.set(x, y, z); this.pt = rand(2, 4); this.period = period; this.sparkColor = C.lettuceLight;
  }
  update(dt) {
    super.update(dt); if (!this.alive) return; const pp = this.e.eye(); const dir = pp.clone().sub(this.pos); this.obj.userData.yaw.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    this.pt -= dt; if (this.pt <= 0 && this.distToPlayer() < 80 && this.e.hostile()) { this.pt = this.period; const muzzle = this.pos.clone().add(V3(0, 2.4, 0)).addScaledVector(dir.clone().normalize(), 3); new Rocket(this.e, muzzle, pp, { speed: 15, homing: 0.7 }); this.e.audio.whoosh(); }
  }
  die() { super.die(); this.e.explosion(this.pos.clone().add(V3(0, 1.5, 0)), 1.6, { debris: 7 }); this.obj.rotation.z = 0.5; this.obj.rotation.x = 0.2; this.obj.userData.yaw.rotation.x = 0.6; }
}

// ---------------------------------------------------------------- irradiated guards: harmless
export class Wanderer extends Actor {
  constructor(e, { x, y = 0, z, kind = 'float', color = C.lettuceLight, ceilY = 8 } = {}) {
    const m = makeSoldier({ color, rifle: false }); super(e, m, { hp: 999, hitR: 0.9, hitH: 3, hitOffset: 1.5 }); e.removeTarget(this);
    this.kind = kind; this.pos.set(x, y, z); this.base = V3(x, y, z); this.ceilY = ceilY; this.sparkColor = C.laser;
    if (kind === 'ceiling') { poseSoldier(m, 'limp'); m.rotation.z = Math.PI; this.pos.y = ceilY - 0.2; }
    else if (kind === 'float') { poseSoldier(m, 'float'); this.pos.y = y + 2.2; }
    else if (kind === 'gamer') { poseSoldier(m, 'sit'); }
    this.glow = new THREE.PointLight(C.laser, 0.9, 7); this.glow.position.y = 1.5; m.add(this.glow);
  }
  onHit() { this.e.sparks(this.pos.clone().add(V3(0, 1.5, 0)), 3, C.laser); }
  update(dt) {
    super.update(dt); const m = this.obj;
    if (this.kind === 'ceiling') { this.pos.x = this.base.x + Math.sin(this.t * 0.5) * 4; animateWalk(m, dt, 0.5); }
    else if (this.kind === 'float') { this.pos.y = this.base.y + 2.2 + Math.sin(this.t * 1.1) * 0.5; m.rotation.y += dt * 0.35; m.rotation.z = Math.sin(this.t * 0.7) * 0.25; }
    else if (this.kind === 'gamer') { m.userData.neck.rotation.x = 0.4 + Math.sin(this.t * 6) * 0.03; m.userData.armL.rotation.x = -1.1 + Math.sin(this.t * 9) * 0.08; m.userData.armR.rotation.x = -1.1 + Math.cos(this.t * 9) * 0.08; }
    this.glow.intensity = 0.7 + Math.sin(this.t * 5) * 0.3;
    if (this.t % 0.35 < dt) { const s = makeGlow(C.laser, 0.06); s.position.copy(this.pos).add(V3(rand(-0.6, 0.6), rand(0.5, 2.6), rand(-0.6, 0.6))); this.e.fx.add(s); this.e.effects.push({ obj: s, t: 0, life: 1.2, update: (ev, k, d) => { s.position.y += d * 0.6; s.material.opacity = 1 - k; } }); }
  }
}

// ---------------------------------------------------------------- Ryley, the companion
export class Companion extends Actor {
  constructor(e, { x, y = 0, z, hazmat = true, scarf = false, follow = 4 } = {}) {
    const m = makeSoldier({ color: C.tomato, hazmat, scarf }); super(e, m, { hp: 9999, hitR: 0.9, hitH: 3, hitOffset: 1.5 }); e.removeTarget(this);
    this.pos.set(x, y, z); this.follow = follow; poseSoldier(m, 'aim'); this.fireT = 1; this.target = null;
  }
  onHit() { }
  update(dt) {
    super.update(dt); const m = this.obj; const pp = this.e.yaw.position; const to = pp.clone().sub(this.pos); to.y = 0; const d = to.length();
    if (d > this.follow + 1.5) { to.normalize(); this.pos.addScaledVector(to, Math.min(d - this.follow, 6) * dt * 1.2); animateWalk(m, dt, 1); }
    else { m.userData.legL.rotation.x = m.userData.legR.rotation.x = 0; }
    const floor = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0; this.pos.y = floor;
    // look where the player looks (roughly)
    const f = this.e.forward(); const look = this.pos.clone().add(f.multiplyScalar(10)); m.lookAt(look.x, this.pos.y, look.z);
    // helps out: shoots the nearest live enemy occasionally
    this.fireT -= dt; if (this.fireT <= 0) {
      this.fireT = rand(0.6, 1.4); let best = null, bd = 60;
      for (const a of this.e.targets) { if (!a.alive || a.friendly || a instanceof Bomb) continue; const dd = a.pos.distanceTo(this.pos); if (dd < bd) { bd = dd; best = a; } }
      if (best) { const muzzle = this.pos.clone().add(V3(0, 2.1, 0)); const tp = best.pos.clone().add(V3(0, best.hitbox.position.y, 0)); this.e.tracer(muzzle, tp, 0xFFE7B8, 0.08); this.e.audio.enemyShot(-0.3); m.lookAt(tp.x, this.pos.y, tp.z); if (Math.random() < 0.45) best.onHit(1, tp, tp.clone().sub(muzzle).normalize()); }
    }
  }
}

// ---------------------------------------------------------------- roof machine gun (friendly, fires at things)
export class RoofGun {
  constructor(e, { x, y, z, color = C.tomato }) { this.e = e; this.obj = makeTurret(color); this.obj.position.set(x, y, z); e.world.add(this.obj); this.t = 0; this.fireT = 0; this.alive = true; this._u = (dt) => this.update(dt); e.updaters.add(this._u); }
  update(dt) {
    this.t += dt; if (!this.alive) return; let best = null, bd = 80;
    for (const a of this.e.targets) { if (!a.alive || a instanceof Bomb) continue; const d = a.pos.distanceTo(this.obj.position); if (d < bd) { bd = d; best = a; } }
    if (!best) return; const u = this.obj.userData; const dir = best.pos.clone().sub(this.obj.position);
    u.yaw.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2; u.pitch.rotation.z = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 0.9;
    this.fireT -= dt; if (this.fireT <= 0) { this.fireT = 0.28; const mz = u.pitch.localToWorld(u.muzzle.clone()); const tp = best.pos.clone().add(V3(rand(-1.5, 1.5), rand(-1, 1.5), rand(-1.5, 1.5))); this.e.tracer(mz, tp, 0xFFE7B8, 0.08); this.e.audio.enemyShot(clamp((mz.x - this.e.yaw.position.x) / 40, -1, 1)); if (Math.random() < 0.18) best.onHit(1, tp, tp.clone().sub(mz).normalize()); }
  }
  wreck() { this.alive = false; this.obj.rotation.z = 0.6; this.obj.userData.pitch.rotation.z = 0.9; this.e.explosion(this.obj.position.clone().add(V3(0, 1.5, 0)), 1.6, { debris: 6 }); }
  remove() { this.e.updaters.delete(this._u); this.e.world.remove(this.obj); }
}

// ---------------------------------------------------------------- battle mode actors
// A power generator. Friendly ones are hurt by enemy blasts (through Battle.onBlast); enemy ones by the player's bullets.
export class Generator extends Actor {
  constructor(e, { x, z, color = C.tomato, hp = 40, friendly = false, yaw = 0 } = {}) {
    const m = makeGenerator(color); super(e, m, { hp, hitR: 2.8, hitH: 5, hitOffset: 2.5 });
    this.pos.set(x, 0, z); this.obj.rotation.y = yaw; this.friendly = friendly; this.sparkColor = C.scarf; if (friendly) e.removeTarget(this);
    e.addCollider(x, z, 7, 5, 5); this.smokeT = 0;
  }
  onHit(dmg, point, dir) { if (this.friendly || !this.alive) return; this.hp -= dmg; this.flashHit(); if (this.hp <= 0) this.die(point); }
  hurt(dmg) { if (!this.alive) return; this.hp -= dmg; this.flashHit(); if (this.hp <= 0) this.die(); }
  update(dt) {
    super.update(dt); const u = this.obj.userData;
    if (this.alive) { u.fan.rotation.x += dt * 9; u.core.material.emissiveIntensity = 1 + Math.sin(this.t * 6) * 0.3; if (this.t % 0.5 < dt) this.e.puff(this.pos.clone().add(V3(-1.6, 7.6, -0.8)), 0xBFC7CF, 0.4, 1.4); }
    else if (this.t % 0.18 < dt) this.e.puff(this.pos.clone().add(V3(rand(-2, 2), 4, rand(-1, 1))), 0x2E353C, 1, 2);
  }
  die(point) { this.alive = false; this.e.removeTarget(this); this.e.explosion(this.pos.clone().add(V3(0, 2.5, 0)), 2, { debris: 8 }); const u = this.obj.userData; u.core.material = mat(C.slate); u.light.intensity = 0; this.obj.rotation.z = 0.08; this.onDeath && this.onDeath(this); }
  repair() { this.alive = true; this.hp = this.maxHp; const u = this.obj.userData; u.core.material = emissive(C.scarf, 1.2); u.light.intensity = 1; this.obj.rotation.z = 0; if (!this.friendly) this.e.addTarget(this); this.e.sparks(this.pos.clone().add(V3(0, 3, 0)), 12, C.scarf); this.onRepair && this.onRepair(this); }
}

// An enemy jet: crosses the field and drops a bomb on `target`; shootable.
export class EnemyJet extends Actor {
  constructor(e, { z = -10, y = 30, dir = 1, speed = 34, startX = -170, target = null, hp = 6 } = {}) {
    const m = makeJet(C.lettuce); super(e, m, { hp, hitR: 5, hitH: 4, hitOffset: 0 });
    this.pos.set(startX, y, z); this.dir = dir; this.speed = speed; this.y0 = y; this.obj.rotation.y = dir > 0 ? 0 : Math.PI; this.target = target; this.dropped = false; this.crash = null; this.sparkColor = C.lettuceLight; this.life = 0;
    e.audio.whoosh(0);
  }
  update(dt) {
    super.update(dt);
    if (this.crash) { this.crash.v += 8 * dt; this.pos.y -= this.crash.v * dt; this.pos.x += this.speed * 0.5 * this.dir * dt; this.obj.rotation.z += dt * 2; if (this.t % 0.06 < dt) this.e.puff(this.pos, 0x444A52, 1.2, 1.4); const fl = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0; if (this.pos.y <= fl + 1) { this.e.explosion(this.pos.clone(), 2.2, { debris: 8 }); this.remove(); } return; }
    this.pos.x += this.speed * this.dir * dt; this.pos.y = this.y0 + Math.sin(this.t * 0.8) * 1.2; this.obj.rotation.z = Math.sin(this.t * 0.6) * 0.06;
    if (this.t % 0.05 < dt) this.e.puff(this.pos.clone().add(V3(-7 * this.dir, 0, 0)), 0xC9D2D8, 0.6, 1.6);
    if (!this.dropped && this.target) { const tp = this.target(); if (tp && Math.abs(this.pos.x - tp.x) < 12 && (this.dir > 0 ? this.pos.x < tp.x : this.pos.x > tp.x)) { this.dropped = true; const v = V3(this.speed * this.dir * 0.55, 0, (tp.z - this.pos.z) * 0.4); new Bomb(this.e, this.pos.clone().add(V3(0, -1.5, 0)), v, { dmg: 35, radius: 7, size: 1.5 }); this.e.audio.whoosh(0); } }
    if (Math.abs(this.pos.x) > 200) this.remove();
  }
  die() { super.die(); this.crash = { v: 1 }; this.e.explosion(this.pos.clone(), 1.4); }
}

// Rocket fired by the player's jet: homes gently toward the nearest enemy in front, blasts on contact.
export class PlayerRocket extends Actor {
  constructor(e, pos, dir, { speed = 60, dmg = 6, blast = 6 } = {}) {
    const m = makeMissile(C.tomato, 0.4); m.userData.flame.visible = true; super(e, m, { hp: 1, hitR: 0.5 }); e.removeTarget(this);
    m.position.copy(pos); this.dir = dir.clone().normalize(); this.speed = speed; this.dmg = dmg; this.blast = blast; this.life = 4; this.friendly = true;
    e.audio.missileLaunch();
  }
  update(dt) {
    super.update(dt); if (!this.alive) return;
    // gentle homing on the closest enemy roughly ahead
    let best = null, bd = 90;
    for (const a of this.e.targets) { if (!a.alive || a.friendly || a instanceof Bomb || a instanceof PlayerRocket) continue; const to = a.pos.clone().sub(this.pos); const d = to.length(); if (d < bd && to.normalize().dot(this.dir) > 0.8) { bd = d; best = a; } }
    if (best) { const want = best.pos.clone().add(V3(0, best.hitbox.position.y, 0)).sub(this.pos).normalize(); this.dir.lerp(want, clamp(dt * 3, 0, 1)).normalize(); }
    this.pos.addScaledVector(this.dir, this.speed * dt); this.obj.quaternion.setFromUnitVectors(V3(0, 1, 0), this.dir);
    if (this.t % 0.05 < dt) this.e.puff(this.pos.clone().addScaledVector(this.dir, -1), 0xC3CBD2, 0.4, 1);
    // contact with an enemy hitbox or the ground / a building
    for (const a of this.e.targets) { if (!a.alive || a.friendly || a instanceof Bomb) continue; const r = (a.hitbox.geometry.parameters.radius || a.hitbox.geometry.parameters.width || 1.5) + 0.8; if (a.pos.clone().add(V3(0, a.hitbox.position.y, 0)).distanceTo(this.pos) < r) { a.onHit(this.dmg, this.pos.clone(), this.dir); this.boom(); return; } }
    const fl = this.e.floorAt ? this.e.floorAt(this.pos.x, this.pos.z, this.pos.y) : 0;
    if (this.pos.y <= fl + 0.3 || this.t > this.life) { this.boom(); return; }
    for (const c of this.e.colliders) { if (this.pos.y < c.y2 && this.pos.x > c.x1 && this.pos.x < c.x2 && this.pos.z > c.z1 && this.pos.z < c.z2) { this.boom(); return; } }
  }
  boom() { if (!this.alive) return; this.alive = false; this.e.explosion(this.pos.clone(), 1.3, { debris: 4 }); for (const a of [...this.e.targets]) { if (!a.alive || a.friendly || a instanceof Bomb) continue; const d = a.pos.distanceTo(this.pos); if (d < this.blast) a.onHit(this.dmg * (1 - d / this.blast * 0.5), this.pos.clone(), this.dir); } this.e.onBlast && this.e.onBlast(this.pos.clone(), this.dmg * 3, this.blast, 'playerRocket'); this.remove(); }
}

// The guard in the glass safe box: untouchable inside, but every so often he steps out — and then he is fair game (and armed).
export class SafeBoxGuy extends Actor {
  constructor(e, { inside, outside, hp = 4, dmg = 8, every = 22, stay = 7 } = {}) {
    const m = makeSoldier({ color: C.lettuceLight, rifle: true }); super(e, m, { hp, hitR: 0.9, hitH: 3, hitOffset: 1.5 }); e.removeTarget(this);
    this.inside = inside.clone(); this.outside = outside.clone(); this.pos.copy(inside); this.every = every; this.stay = stay; this.timer = every * 0.5; this.state = 'in'; this.dmg = dmg; this.fireT = 1; this.burst = 0; this.sparkColor = C.tomato;
    poseSoldier(m, 'sit'); this.deadT = 0;
  }
  update(dt) {
    super.update(dt); const m = this.obj, pp = this.e.yaw.position;
    if (!this.alive) { this.deadT += dt; if (this.deadT > 6) this.remove(); return; }
    this.timer -= dt;
    if (this.state === 'in') { m.lookAt(pp.x, this.pos.y, pp.z); if (this.timer <= 0) { this.state = 'out'; this.timer = this.stay; this.e.addTarget(this); poseSoldier(m, 'aim'); this.e.toast('SAFE ROOM', 'THE DOOR OPENED — HE IS OUT', 2.2); this.onOut && this.onOut(); } }
    else {
      const goal = this.timer > 0 ? this.outside : this.inside; const to = goal.clone().sub(this.pos); to.y = 0; const d = to.length();
      if (d > 0.3) { to.normalize(); this.pos.addScaledVector(to, 3 * dt); animateWalk(m, dt, 1); m.lookAt(goal.x, this.pos.y, goal.z); }
      else { m.userData.legL.rotation.x = m.userData.legR.rotation.x = 0; m.lookAt(pp.x, this.pos.y, pp.z); if (this.timer <= 0) { this.state = 'in'; this.timer = this.every; this.e.removeTarget(this); poseSoldier(m, 'sit'); } }
      if (this.timer > 0 && d < 1 && this.e.hostile()) { this.fireT -= dt; if (this.fireT <= 0) { if (this.burst <= 0) this.burst = 3; this.burst--; const dir = pp.clone().sub(this.pos).normalize(); enemyFire(this.e, this.pos.clone().add(V3(0, 2.1, 0)).addScaledVector(dir, 1.1), this.dmg, { who: 'trooper' }); this.fireT = this.burst > 0 ? 0.14 : rand(1.4, 2.4); } }
    }
  }
  onHit(dmg, point, dir) { if (this.state !== 'out') { this.e.sparks(point, 3, C.glass); return; } super.onHit(dmg, point, dir); }
  die(point) { super.die(); poseSoldier(this.obj, 'down'); this.pos.y += 0.5; this.e.sparks(point || this.pos, 6, C.tomato); }
}
