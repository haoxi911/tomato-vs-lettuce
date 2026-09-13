// The battlefield shared by scenes 1–4: Tomato Kingdom on the left (−x), Lettuce Kingdom on the right (+x).
import * as THREE from 'three';
import { C, mat, emissive, box, cyl, cone, sphere, makeBuilding, makeSilo, makeTree, makeRock, makeRubble, makeGallows, outline } from './art.js';
import { V3, rand } from './engine.js';
import { RoofGun } from './actors.js';

export const FIELD = { tomatoX: -74, lettuceX: 74, tomatoSiloX: -44, lettuceSiloX: 44, z: 0 };
// A point on a base's flat roof (building-local lx/lz, so it follows the building's rotation and any wreck tilt).
// The tower sits on the local +x half; the open roof is local x in [-13, 0].
export function roofPoint(building, lx, lz, lift = 0.6) { building.updateMatrixWorld(true); return building.localToWorld(V3(lx, building.userData.roofY + lift, lz)); }

export function buildField(e, { wreckedLettuce = false, crater = false, roofGun = true, gallows = false, wreckedTomatoRoof = false, phase = 'night' } = {}) {
  const refs = {}; e.resetAtmosphere(phase);
  const day = phase !== 'night';
  const GROUND = { night: C.ground, dawn: 0x3E5E3C, morning: 0x55954C }[phase] || C.ground;
  const TUFT = { night: C.groundLight, dawn: 0x4E7448, morning: 0x6BAA5E }[phase] || C.groundLight;
  const HILL = { night: C.hill, dawn: 0x3E5A44, morning: 0x4F8A55 }[phase] || C.hill;
  e.addGround(700, GROUND);
  // rolling hills far away + a darker band behind the bases
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2, r = 210 + Math.random() * 90;
    const h = new THREE.Mesh(new THREE.SphereGeometry(rand(30, 70), 10, 6), mat(i % 3 ? HILL : (day ? 0x467A4B : 0x243B31))); h.scale.y = rand(0.18, 0.32);
    h.position.set(Math.cos(a) * r, -4, Math.sin(a) * r); h.receiveShadow = true; e.world.add(h);
  }
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 110; const t = makeTree(rand(1.2, 2.6)); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); e.world.add(t);
  }
  for (let i = 0; i < 14; i++) { const t = makeTree(rand(1, 1.8)); t.position.set(rand(-100, 100), 0, rand(-70, -50) * (Math.random() < 0.5 ? 1 : -1)); e.world.add(t); }
  for (let i = 0; i < 18; i++) { const r = makeRock(rand(0.6, 1.6)); r.position.set(rand(-90, 90), r.position.y, rand(-40, 40)); if (Math.abs(r.position.x) < 30 && Math.abs(r.position.z) < 8) continue; e.world.add(r); }
  // grass tufts (flat dark discs)
  const tuftGeo = new THREE.CircleGeometry(1.2, 6); const tuftMat = mat(TUFT);
  for (let i = 0; i < 120; i++) { const t = new THREE.Mesh(tuftGeo, tuftMat); t.rotation.x = -Math.PI / 2; t.position.set(rand(-120, 120), 0.02, rand(-80, 80)); t.scale.setScalar(rand(0.6, 2.2)); e.world.add(t); }

  // ---- Tomato Kingdom
  const tb = makeBuilding({ color: C.tomato }); tb.position.set(FIELD.tomatoX, 0, 0); tb.rotation.y = -Math.PI / 2; e.world.add(tb); refs.tomatoBase = tb;
  e.addCollider(FIELD.tomatoX, 0, 16, 26, 30); e.addSolid(tb);
  refs.tomatoWallMeshes = []; tb.traverse(o => { if (o.isMesh) refs.tomatoWallMeshes.push(o); });
  const ts = makeSilo(C.tomato); ts.position.set(FIELD.tomatoSiloX, 0, 0); e.world.add(ts); refs.tomatoSilo = ts; e.addCollider(FIELD.tomatoSiloX, 0, 12, 12, 20); e.addSolid(ts);
  if (roofGun) { refs.roofGun = new RoofGun(e, { x: FIELD.tomatoX + 2, y: tb.userData.towerRoofY, z: -3, color: C.tomato }); }
  if (wreckedTomatoRoof) { const r = makeRubble(8, 8); r.position.set(FIELD.tomatoX + 4, tb.userData.towerRoofY, 0); e.world.add(r); refs.roofGun = null; }
  // ---- Lettuce Kingdom
  const lb = makeBuilding({ color: C.teal }); lb.position.set(FIELD.lettuceX, 0, 0); lb.rotation.y = Math.PI / 2; e.world.add(lb); refs.lettuceBase = lb;
  e.addCollider(FIELD.lettuceX, 0, 16, 26, 30); e.addSolid(lb);
  refs.lettuceWallMeshes = []; lb.traverse(o => { if (o.isMesh) refs.lettuceWallMeshes.push(o); });
  const ls = makeSilo(C.lettuce); ls.position.set(FIELD.lettuceSiloX, 0, 0); e.world.add(ls); refs.lettuceSilo = ls; e.addCollider(FIELD.lettuceSiloX, 0, 12, 12, 20); e.addSolid(ls);
  if (wreckedLettuce) {
    lb.rotation.z = 0.22; lb.position.y = -1.2; lb.position.x += 3; lb.userData.lamp.material = mat(C.slate);
    const rub = makeRubble(14, 26); rub.position.set(FIELD.lettuceX - 10, 0, 0); e.world.add(rub);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rand(2, 4), 7, 6), new THREE.MeshLambertMaterial({ color: 0x5C6772, transparent: true, opacity: 0.55 })); s.position.set(FIELD.lettuceX + rand(-8, 8), rand(14, 22), rand(-6, 6)); e.world.add(s); refs.smokeBalls = (refs.smokeBalls || []).concat(s); }
  }
  if (crater) {
    const cr = new THREE.Mesh(new THREE.CircleGeometry(30, 28), mat(0x1A1512)); cr.rotation.x = -Math.PI / 2; cr.position.y = 0.05; e.world.add(cr);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(30, 3, 6, 28), mat(0x3B3128)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.4; e.world.add(rim);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(20, 24), new THREE.MeshBasicMaterial({ color: 0xD9452B, transparent: true, opacity: 0.35 })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.12; e.world.add(glow); refs.craterGlow = glow;
    const l = new THREE.PointLight(0xFF6A2A, 2.2, 90); l.position.set(0, 6, 0); e.world.add(l); refs.craterLight = l;
    for (let i = 0; i < 24; i++) { const em = new THREE.Mesh(new THREE.SphereGeometry(rand(0.2, 0.5), 6, 5), emissive(C.orange, 1.5)); const a = Math.random() * 6.3, r = rand(4, 27); em.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r); e.world.add(em); }
    const rb = makeRubble(24, 60); rb.position.set(0, 0, 0); e.world.add(rb);
    for (const t of [[-30, -22], [26, 24], [-14, 30], [22, -30]]) { const dead = makeTree(1.6); dead.children.forEach((c, i) => { if (i > 0) c.material = mat(0x2A2420); }); dead.rotation.z = rand(0.3, 0.8); dead.position.set(t[0], 0, t[1]); e.world.add(dead); }
  }
  if (gallows) { const g = makeGallows(); g.position.set(FIELD.tomatoX + 34, 0, 14); g.rotation.y = 0; e.world.add(g); refs.gallows = g; }
  // a few lamp posts along the middle road
  for (const x of [-20, 0, 20]) for (const z of [-24, 24]) {
    const post = cyl(0.12, 0.16, 6, C.ink, 6); post.position.set(x, 3, z); e.world.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), phase === 'morning' ? mat(0xEDE7D6) : emissive(C.window, 1.2)); lamp.position.set(x, 6.2, z); e.world.add(lamp);
    if (phase !== 'morning') { const pl = new THREE.PointLight(0xFFD98A, 0.7, 26); pl.position.set(x, 5.8, z); e.world.add(pl); }
  }
  e.bounds = { x1: -100, x2: 100, z1: -75, z2: 75 };
  e.floorAt = () => 0; e.ceilAt = null;
  return refs;
}

// Jet flyby prop: flies along +x (or −x) at height, fires a missile at `target` when passing x=fireX.
export function jetFlyby(e, { z = -10, y = 32, dir = 1, speed = 40, startX = -170, life = 12, onFire = null, fireX = null, jet }) {
  const j = jet; j.position.set(startX, y, z); j.rotation.y = dir > 0 ? 0 : Math.PI; e.world.add(j);
  let t = 0, fired = false;
  const upd = (dt) => {
    t += dt; j.position.x += speed * dir * dt; j.position.y = y + Math.sin(t * 0.8) * 1.2; j.rotation.z = Math.sin(t * 0.6) * 0.06;
    if (t % 0.05 < dt) { e.puff(j.position.clone().add(V3(-7 * dir, 0, 0)), 0xC9D2D8, 0.6, 1.6); }
    if (!fired && fireX != null && (dir > 0 ? j.position.x >= fireX : j.position.x <= fireX)) { fired = true; onFire && onFire(j.position.clone().add(V3(0, -1.4, 0))); }
    if (t > life) { e.updaters.delete(upd); e.world.remove(j); }
  };
  e.updaters.add(upd); e.audio.whoosh(0); return j;
}
