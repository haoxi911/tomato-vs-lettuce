// Procedural low-poly art in the storybook palette. Flat colour + ink outlines.
import * as THREE from 'three';

export const C = {
  ink: 0x16202A, cream: 0xF4F1E9, tomato: 0xE1382B, tomatoDeep: 0xB2291F,
  lettuce: 0x4E9E3E, lettuceLight: 0x79B93F, teal: 0x2EC4B6, scarf: 0xF5D24A, orange: 0xF2A227,
  steel: 0x8FA3B2, steelLight: 0xC3CBD2, steelDark: 0x5D7284, slate: 0x4A5C6B,
  wall: 0xEDE7D6, wallShade: 0xD9D2BF, skin: 0xF7E2C8, glass: 0x9FD3EA, window: 0xFFE08A,
  ground: 0x22382D, groundLight: 0x2F4A3A, hill: 0x2B4438, sky: 0x0D1729, horizon: 0x3A5A80,
  fire: 0xF07A3D, fireHot: 0xFFE7B8, smoke: 0x8E99A3, laser: 0x5CE04A, blood: 0xB3222A,
  hazmat: 0xBEC7CE, belt: 0xD3243D, concrete: 0xB9C3C9, floor: 0xDCE2E6, pipe: 0x79B93F,
};

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color, ...opts });
  matCache.set(key, m);
  return m;
}
export function emissive(color, intensity = 1) {
  return new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity });
}
const inkLine = new THREE.LineBasicMaterial({ color: C.ink });

export function outline(mesh, thresholdDeg = 25) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, thresholdDeg), inkLine);
  e.raycast = () => {};
  mesh.add(e);
  return mesh;
}
export function box(w, h, d, color, ol = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return ol ? outline(m) : m;
}
export function cyl(rt, rb, h, color, seg = 10, ol = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = true;
  return ol ? outline(m, 40) : m;
}
export function sphere(r, color, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat(color));
  m.castShadow = true;
  return m;
}
export function cone(r, h, color, seg = 10) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.castShadow = true;
  return m;
}
export function at(obj, x, y, z, rx = 0, ry = 0, rz = 0) { obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); return obj; }

// ---------------------------------------------------------------- buildings
export function makeBuilding({ color = C.tomato, w = 26, h = 14, d = 16, windows = true } = {}) {
  const g = new THREE.Group();
  const main = at(box(w, h, d, C.wall), 0, h / 2, 0); g.add(main);
  const tower = at(box(w * 0.42, h * 0.5, d * 0.9, C.wall), w * 0.22, h + h * 0.25, 0); g.add(tower);
  const towerShade = at(box(w * 0.42 + 0.02, h * 0.5, 0.6, C.wallShade), w * 0.22, h + h * 0.25, d * 0.45 + 0.3); towerShade.material = mat(C.wallShade); g.add(towerShade);
  const stripe = at(box(w * 0.5, 2.2, 0.35, color, false), -w * 0.18, h * 0.55, d / 2 + 0.2); g.add(stripe);
  const pillar = at(box(2.6, h * 0.8, 0.35, color, false), w * 0.36, h * 0.45, d / 2 + 0.2); g.add(pillar);
  const door = at(box(3.2, 4.4, 0.4, C.steelDark), -w * 0.05, 2.2, d / 2 + 0.22); g.add(door);
  const xbox = at(box(3, 3, 0.4, C.wall), w * 0.16, h * 0.7, d / 2 + 0.22); g.add(xbox);
  const xa = at(box(3.2, 0.35, 0.1, C.ink, false), w * 0.16, h * 0.7, d / 2 + 0.45, 0, 0, Math.PI / 4); g.add(xa);
  const xb = at(box(3.2, 0.35, 0.1, C.ink, false), w * 0.16, h * 0.7, d / 2 + 0.45, 0, 0, -Math.PI / 4); g.add(xb);
  if (windows) {
    const wm = emissive(C.window, 0.9);
    const wg = new THREE.BoxGeometry(1.5, 1.2, 0.2);
    const rows = [h * 0.32, h * 0.72];
    for (const y of rows) for (let i = -3; i <= 0; i++) {
      const m = new THREE.Mesh(wg, wm); m.position.set(i * 2.6 - w * 0.08, y, d / 2 + 0.2); g.add(m);
    }
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(wg, wm); m.position.set(w * 0.1 + i * 2.6, h + h * 0.28, d * 0.45 + 0.25); g.add(m); }
    const side = new THREE.Mesh(wg, wm); side.rotation.y = Math.PI / 2; side.position.set(w / 2 + 0.2, h * 0.55, 2); g.add(side);
  }
  // roof lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), emissive(0xFF5A46, 1.2));
  lamp.position.set(w * 0.22, h * 1.5 + 0.5, 0); g.add(lamp); g.userData.lamp = lamp;
  g.userData.size = { w, h: h * 1.5, d };
  g.userData.roofY = h; g.userData.towerRoofY = h * 1.5;
  return g;
}

export function makeSilo(color = C.tomato) {
  const g = new THREE.Group();
  const body = at(box(9, 15, 9, C.steelLight), 0, 7.5, 0); g.add(body);
  const inner = at(box(6.4, 14.2, 6.4, C.steelDark, false), 0, 7.6, 0); inner.material = mat(0x6E7E8B); g.add(inner);
  for (let i = 0; i < 4; i++) { const r = at(box(6.6, 0.25, 6.6, C.ink, false), 0, 3 + i * 3.2, 0); g.add(r); }
  const band = at(box(9.2, 0.9, 9.2, C.orange, false), 0, 14.6, 0); g.add(band);
  for (let i = 0; i < 8; i++) { const s = at(box(0.5, 0.95, 0.2, C.ink, false), -3.6 + i * 1.05, 14.6, 4.7, 0, 0, 0.5); g.add(s); }
  const base = at(box(9.4, 0.7, 9.4, color, false), 0, 0.35, 0); g.add(base);
  // blast doors, open
  const dL = at(box(4.2, 0.5, 9, C.steel), -4.6, 15.6, 0, 0, 0, 1.05); g.add(dL);
  const dR = at(box(4.2, 0.5, 9, C.steel), 4.6, 15.6, 0, 0, 0, -1.05); g.add(dR);
  const dLm = at(box(2.4, 0.2, 5, color, false), -4.6, 15.95, 0, 0, 0, 1.05); g.add(dLm);
  const dRm = at(box(2.4, 0.2, 5, color, false), 4.6, 15.95, 0, 0, 0, -1.05); g.add(dRm);
  // lattice towers
  for (const sx of [-5.4, 5.4]) {
    for (const sz of [-3.2, 3.2]) { g.add(at(box(0.5, 12, 0.5, C.steel, false), sx, 7, sz)); }
    for (let i = 0; i < 4; i++) {
      g.add(at(box(0.3, 7.6, 0.3, C.steel, false), sx, 2.5 + i * 3, 0, Math.PI / 4 * (i % 2 ? 1 : -1), 0, 0));
    }
    const sign = at(box(1.6, 1.4, 0.2, C.scarf, false), sx + (sx > 0 ? 0.55 : -0.55), 8.5, 0, 0, Math.PI / 2, 0); g.add(sign);
    const fl = at(cone(0.35, 0.7, C.ink, 6), sx + (sx > 0 ? 0.7 : -0.7), 8.6, 0); g.add(fl);
  }
  const msl = makeMissile(color, 1.35); msl.position.set(0, 7.4, 0); g.add(msl);
  g.userData.missile = msl; g.userData.size = { w: 12, h: 18, d: 12 };
  return g;
}

export function makeMissile(color = C.tomato, s = 1) {
  const g = new THREE.Group();
  const body = cyl(0.55 * s, 0.6 * s, 6 * s, C.steelLight, 10); body.position.y = 3 * s; g.add(outline(body, 60));
  const nose = cone(0.55 * s, 2.2 * s, 0xE6EBEF, 10); nose.position.y = 7.1 * s; g.add(nose);
  const tip = cone(0.18 * s, 0.7 * s, C.ink, 6); tip.position.y = 8.35 * s; g.add(tip);
  for (const y of [1.2, 4.6]) { const b = cyl(0.62 * s, 0.62 * s, 0.9 * s, color, 10); b.position.y = y * s; g.add(b); }
  for (let i = 0; i < 4; i++) {
    const f = box(0.12 * s, 1.6 * s, 1.1 * s, color); f.position.set(0, 0.9 * s, 0); f.rotation.y = i * Math.PI / 2;
    f.translateZ(0.85 * s); g.add(f);
  }
  const nozzle = cyl(0.45 * s, 0.3 * s, 0.6 * s, C.ink, 8); nozzle.position.y = -0.2 * s; g.add(nozzle);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 2.4 * s, 8), emissive(C.orange, 1.3));
  flame.rotation.x = Math.PI; flame.position.y = -1.5 * s; flame.visible = false; g.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 1.5 * s, 8), emissive(C.fireHot, 1.5));
  flame2.rotation.x = Math.PI; flame2.position.y = -1.1 * s; flame.add(flame2); flame2.position.set(0, 0.35 * s, 0);
  g.userData.flame = flame; g.userData.len = 9 * s;
  return g;
}

export function makeTomatoBomb() {
  const g = new THREE.Group();
  const body = cyl(0.9, 1.0, 7, C.steelLight, 12); body.position.y = 3.5; g.add(outline(body, 60));
  for (const y of [1.6, 5.2]) { const b = cyl(1.02, 1.02, 1.1, C.tomato, 12); b.position.y = y; g.add(b); }
  const tom = sphere(1.7, C.tomato, 14); tom.position.y = 8.2; g.add(tom);
  const leaf = at(cone(0.5, 1.1, C.lettuce, 5), 0, 9.9, 0); g.add(leaf);
  const stem = at(cyl(0.12, 0.12, 0.8, C.lettuce, 6), 0, 10.3, 0); g.add(stem);
  for (let i = 0; i < 4; i++) { const f = box(0.14, 2.2, 1.6, C.tomato); f.rotation.y = i * Math.PI / 2; f.position.y = 1.1; f.translateZ(1.4); g.add(f); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4, 10), emissive(C.orange, 1.3)); flame.rotation.x = Math.PI; flame.position.y = -2.2; flame.visible = false; g.add(flame);
  g.userData.flame = flame;
  return g;
}

export function makeTurret(color = C.tomato) {
  const g = new THREE.Group();
  g.add(at(box(4.2, 0.9, 3.2, C.steel), 0, 0.45, 0));
  const yaw = new THREE.Group(); yaw.position.y = 0.9; g.add(yaw);
  yaw.add(at(box(2.8, 1.6, 2.4, C.steelLight), 0, 0.8, 0));
  const dome = sphere(1.15, color, 12); dome.position.y = 1.8; dome.scale.y = 0.7; yaw.add(dome);
  const pitch = new THREE.Group(); pitch.position.set(0, 1.2, 0); yaw.add(pitch);
  for (const z of [-0.45, 0.45]) { const b = cyl(0.17, 0.17, 4, C.steelDark, 8); b.rotation.z = Math.PI / 2; b.position.set(2.6, 0, z); pitch.add(b); }
  const box2 = at(box(1, 0.9, 0.9, C.slate), -1.4, 0.2, 0); yaw.add(box2);
  g.userData.yaw = yaw; g.userData.pitch = pitch; g.userData.muzzle = new THREE.Vector3(4.6, 0, 0);
  return g;
}

export function makeLaserPod(color = C.lettuceLight) {
  const g = new THREE.Group();
  g.add(at(box(2.2, 0.6, 2.2, C.steel), 0, 0.3, 0));
  const yaw = new THREE.Group(); yaw.position.y = 0.6; g.add(yaw);
  const body = at(box(1.8, 2.2, 1.8, color), 0, 1.1, 0); yaw.add(body);
  const mast = at(cyl(0.08, 0.08, 1.2, C.ink, 6), -0.5, 2.7, 0); yaw.add(mast);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), emissive(0xDFF7C9, 1.2)); lens.position.set(0.95, 1.3, 0); yaw.add(lens);
  g.userData.yaw = yaw; g.userData.lens = lens;
  return g;
}

// ---------------------------------------------------------------- vehicles
export function makeDrone(color = C.lettuceLight) {
  const g = new THREE.Group();
  const body = at(box(2.4, 0.9, 1.6, 0xEDF1F4), 0, 0, 0); g.add(body);
  const canopy = at(box(0.9, 0.35, 0.2, C.glass, false), -0.5, 0.05, 0.85); g.add(canopy);
  const bar = at(box(0.7, 0.3, 0.2, color, false), 0.55, 0.05, 0.85); g.add(bar);
  const pack = at(box(1.3, 0.35, 1, C.steelLight), 0, 0.6, 0); g.add(pack);
  const rotors = [];
  for (const [x, z] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) {
    const arm = at(box(0.25, 0.25, 2.2, C.ink, false), x / 2, 0.15, z / 2, 0, Math.atan2(x, z), 0); arm.scale.z = Math.hypot(x, z) / 2.2; g.add(arm);
    const pod = at(box(0.8, 0.5, 0.8, C.steelDark), x, 0.35, z); g.add(pod);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 14), mat(0xDDE5EA, { transparent: true, opacity: 0.55 }));
    rotor.position.set(x, 0.75, z); g.add(rotor); rotors.push(rotor);
  }
  const gimbal = sphere(0.42, C.slate, 8); gimbal.position.set(0, -0.7, 0); g.add(gimbal);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emissive(C.glass, 1)); lens.position.set(0, -0.72, 0.36); g.add(lens);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), emissive(0xE1382B, 1.4)); led.position.set(-1.2, 0.05, 0.85); g.add(led);
  g.userData.rotors = rotors; g.userData.hitRadius = 2.2;
  return g;
}

export function makeHeli(color = C.lettuceLight) {
  const g = new THREE.Group();
  const body = at(box(6.5, 3.2, 3, 0xEDF1F4), 0, 0, 0); g.add(body);
  const win = at(box(2.2, 1.6, 3.2, C.glass, false), 2.3, 0.4, 0); g.add(win);
  const stripe = at(box(2.4, 0.9, 3.15, color, false), -0.4, 0.1, 0); g.add(stripe);
  const tail = at(box(7, 1, 0.9, 0xEDF1F4), -6.4, 0.6, 0); g.add(tail);
  const fin = at(box(0.5, 2.4, 0.6, 0xEDF1F4), -9.6, 1.6, 0); g.add(fin);
  const mast = at(cyl(0.2, 0.2, 1.2, C.ink, 6), 0.2, 2.2, 0); g.add(mast);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(15, 0.14, 0.7), mat(C.ink)); rotor.position.set(0.2, 2.85, 0); g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.4), mat(C.ink)); tailRotor.position.set(-9.9, 1.4, 0.55); g.add(tailRotor);
  for (const z of [-1.1, 1.1]) {
    g.add(at(box(6, 0.25, 0.3, C.ink, false), 0, -2.3, z));
    g.add(at(box(0.25, 0.9, 0.25, C.ink, false), -1.8, -1.85, z)); g.add(at(box(0.25, 0.9, 0.25, C.ink, false), 1.8, -1.85, z));
  }
  const ropeAnchor = new THREE.Object3D(); ropeAnchor.position.set(-9.6, -0.3, 0); g.add(ropeAnchor);
  g.userData = { rotor, tailRotor, ropeAnchor, hitRadius: 5 };
  return g;
}

export function makeJet(color = C.tomato) {
  const g = new THREE.Group();
  const fus = cyl(0.9, 1.3, 11, 0xF7F9FA, 12); fus.rotation.z = -Math.PI / 2; g.add(outline(fus, 50));
  const nose = cone(0.9, 3.4, 0xF7F9FA, 12); nose.rotation.z = -Math.PI / 2; nose.position.x = 7.2; g.add(nose);
  const tip = cone(0.25, 1, C.ink, 6); tip.rotation.z = -Math.PI / 2; tip.position.x = 9.4; g.add(tip);
  for (const x of [1.2, 2.4]) { const b = cyl(1.12, 1.12, 0.7, color, 12); b.rotation.z = Math.PI / 2; b.position.x = x; g.add(b); }
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.scarf)); canopy.scale.set(1.6, 0.8, 0.9); canopy.position.set(3.2, 0.9, 0); g.add(canopy);
  const fin = at(box(3.2, 3, 0.25, C.scarf), -3.2, 2.2, 0); g.add(fin);
  const finMark = at(box(0.35, 3.1, 0.3, color, false), -1.7, 2.2, 0); g.add(finMark);
  const tomato = sphere(0.7, color, 10); tomato.position.set(-3.4, 2.1, 0.25); g.add(tomato);
  for (const z of [-1, 1]) { const w = at(box(4.2, 0.22, 4.5, 0xDDE5EA), -2.2, -0.5, z * 3.1, 0, z * 0.25, 0); g.add(w); }
  const exhaust = at(cyl(0.7, 0.85, 1.4, C.steel, 10), -6.2, 0, 0, 0, 0, Math.PI / 2); g.add(exhaust);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.5, 10), emissive(C.orange, 1.4)); flame.rotation.z = Math.PI / 2; flame.position.x = -9; g.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 3, 8), emissive(C.fireHot, 1.6)); flame2.rotation.z = Math.PI / 2; flame2.position.x = -8.3; g.add(flame2);
  g.userData = { flame, flame2, pylon: new THREE.Vector3(-1.5, -1.2, 0) };
  return g;
}

// ---------------------------------------------------------------- people
// A soldier rig. parts: torso, head, armL, armR, legL, legR, rifle. Faces +Z.
export function makeSoldier({ color = C.lettuceLight, scarf = false, hazmat = false, rifle = true, crown = false, skinTone = C.skin } = {}) {
  const g = new THREE.Group();
  const suit = hazmat ? C.hazmat : 0xDDE5EA;
  const legColor = hazmat ? 0xE8556B : C.slate;
  const legL = at(box(0.42, 1.1, 0.5, legColor), -0.3, 0.55, 0); const legR = at(box(0.42, 1.1, 0.5, legColor), 0.3, 0.55, 0);
  g.add(legL, legR);
  for (const l of [legL, legR]) { const boot = at(box(0.5, 0.3, 0.7, C.ink, false), 0, -0.45, 0.06); l.add(boot); }
  const hips = new THREE.Group(); hips.position.y = 1.1; g.add(hips);
  const torso = at(box(1.15, 1.3, 0.7, suit), 0, 0.65, 0); hips.add(torso);
  const belt = at(box(1.2, 0.28, 0.75, hazmat ? C.belt : color, false), 0, 0.15, 0); hips.add(belt);
  if (hazmat) { const tank = at(box(0.5, 0.9, 0.35, C.steel), 0, 0.7, -0.5); hips.add(tank); }
  const shoulder = 1.25;
  const armL = new THREE.Group(); armL.position.set(-0.75, shoulder, 0); hips.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.75, shoulder, 0); hips.add(armR);
  for (const a of [armL, armR]) { a.add(at(box(0.36, 1.1, 0.4, suit), 0, -0.5, 0)); a.add(at(box(0.3, 0.3, 0.3, skinTone, false), 0, -1.1, 0)); }
  const neck = new THREE.Group(); neck.position.y = 1.35; hips.add(neck);
  const head = sphere(0.46, skinTone, 12); head.position.y = 0.45; neck.add(head);
  if (hazmat) {
    const helm = sphere(0.58, C.hazmat, 12); helm.position.y = 0.45; neck.add(helm);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, -0.9, 1.8, 0.9, 1.6), mat(C.glass, { transparent: true, opacity: 0.55 })); visor.position.y = 0.45; neck.add(visor);
    const filt = at(box(0.3, 0.36, 0.3, C.steelDark), 0.5, 0.35, 0.2); neck.add(filt);
  } else {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(color)); helm.position.y = 0.5; neck.add(helm);
    const brim = at(cyl(0.56, 0.56, 0.12, color, 12), 0, 0.5, 0); neck.add(brim);
  }
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), mat(C.ink)); eyeL.position.set(-0.16, 0.5, 0.42); neck.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.16; neck.add(eyeR);
  if (crown) {
    const cr = at(cyl(0.45, 0.4, 0.5, C.scarf, 8, true), 0, 1.05, 0); neck.add(cr);
    for (let i = 0; i < 5; i++) { const p = at(cone(0.13, 0.35, C.scarf, 4), Math.cos(i * 1.26) * 0.4, 1.4, Math.sin(i * 1.26) * 0.4); neck.add(p); }
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), emissive(C.tomato, 0.8)); gem.position.set(0, 1.05, 0.44); neck.add(gem);
  }
  let scarfMesh = null;
  if (scarf) {
    scarfMesh = at(box(1.25, 0.32, 0.8, C.scarf), 0, 1.25, 0.05); hips.add(scarfMesh);
    const tail = at(box(0.3, 0.9, 0.18, C.scarf), 0.45, 0.85, -0.45, 0.25, 0, 0.2); hips.add(tail);
  }
  let rifleMesh = null;
  if (rifle) {
    rifleMesh = new THREE.Group();
    rifleMesh.add(at(box(1.6, 0.22, 0.16, C.steelDark), 0.4, 0, 0));
    rifleMesh.add(at(box(0.5, 0.4, 0.2, C.slate), -0.3, -0.12, 0));
    rifleMesh.add(at(box(0.2, 0.35, 0.16, C.slate), 0.5, -0.25, 0));
    rifleMesh.add(at(cyl(0.06, 0.06, 0.8, C.ink, 6), 1.5, 0.02, 0, 0, 0, Math.PI / 2));
    rifleMesh.position.set(0.15, -1.05, 0.2); rifleMesh.rotation.y = -Math.PI / 2;
    armR.add(rifleMesh);
  }
  g.userData = { legL, legR, armL, armR, hips, neck, head, torso, rifle: rifleMesh, scarf: scarfMesh, t: 0, hitRadius: 1.1, height: 2.9 };
  g.userData.pose = (name) => poseSoldier(g, name);
  poseSoldier(g, 'stand');
  return g;
}

export function poseSoldier(g, name) {
  const u = g.userData;
  u.poseName = name;
  u.armL.rotation.set(0, 0, 0); u.armR.rotation.set(0, 0, 0); u.legL.rotation.set(0, 0, 0); u.legR.rotation.set(0, 0, 0);
  u.hips.rotation.set(0, 0, 0); u.hips.position.set(0, 1.1, 0); u.neck.rotation.set(0, 0, 0); g.rotation.z = 0; g.rotation.x = 0;
  switch (name) {
    case 'aim': u.armR.rotation.x = -Math.PI / 2 + 0.1; u.armL.rotation.x = -Math.PI / 2 + 0.2; u.armL.rotation.y = 0.9; u.armL.position.x = -0.45; break;
    case 'hang': u.armL.rotation.x = 2.9; u.armR.rotation.x = 2.9; u.neck.rotation.x = -0.3; break;   // upside-down handled by caller rotating g
    case 'float': u.armL.rotation.z = 1.3; u.armR.rotation.z = -1.3; u.legL.rotation.x = -0.4; u.legR.rotation.x = 0.4; break;
    case 'limp': u.armL.rotation.x = 0.2; u.armR.rotation.x = 0.2; u.neck.rotation.x = 0.35; u.hips.rotation.z = 0.12; break;
    case 'sit': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.hips.position.y = 0.6; u.armL.rotation.x = -1.1; u.armR.rotation.x = -1.1; u.neck.rotation.x = 0.4; break;
    case 'down': g.rotation.x = -Math.PI / 2; u.armL.rotation.z = 0.8; u.armR.rotation.z = -0.5; break;
    case 'rope': u.armR.rotation.x = Math.PI - 0.1; u.armL.rotation.x = -Math.PI / 2; u.legL.rotation.x = 0.4; u.legR.rotation.x = -0.3; break;
    default: break;
  }
}

// Walk cycle; call with speed factor per frame.
export function animateWalk(g, dt, speed = 1) {
  const u = g.userData; u.t += dt * 7 * speed;
  const s = Math.sin(u.t) * 0.55 * Math.min(1, speed);
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  if (u.poseName !== 'aim') { u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7; }
  g.position.y += 0; // ground handled by caller
}

export function makeParachute(color = 0xF1F5F7) {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(color, { side: THREE.DoubleSide }));
  canopy.position.y = 5.6; g.add(canopy);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(3.24, 12, 6, -0.25, 0.5, 0, Math.PI / 2.4), mat(C.tomato, { side: THREE.DoubleSide })); stripe.position.y = 5.6; g.add(stripe);
  const lines = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2; const p1 = new THREE.Vector3(Math.cos(a) * 3, 5.2, Math.sin(a) * 3), p2 = new THREE.Vector3(0, 2.9, 0);
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]); lines.add(new THREE.Line(geo, inkLine));
  }
  g.add(lines); g.userData.canopy = canopy;
  return g;
}

export function makeGallows() {
  const g = new THREE.Group();
  g.add(at(box(0.5, 9, 0.5, C.ink, false), 0, 4.5, 0));
  g.add(at(box(6, 0.5, 0.5, C.ink, false), 2.8, 9, 0));
  g.add(at(box(2.2, 0.35, 0.35, C.ink, false), 0.9, 8.1, 0, 0, 0, -0.6));
  g.add(at(box(2.4, 0.5, 2.4, C.steelDark), 0, 0.25, 0));
  g.userData.hook = new THREE.Vector3(5.4, 8.75, 0);
  return g;
}

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = cyl(0.25 * scale, 0.35 * scale, 2.2 * scale, 0x4A3728, 6); trunk.position.y = 1.1 * scale; g.add(trunk);
  const c1 = cone(1.8 * scale, 3.4 * scale, 0x2F5138, 7); c1.position.y = 3.4 * scale; g.add(c1);
  const c2 = cone(1.3 * scale, 2.6 * scale, 0x3A6344, 7); c2.position.y = 5 * scale; g.add(c2);
  return g;
}

export function makeRock(scale = 1) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), mat(C.concrete)); m.castShadow = true; m.position.y = scale * 0.6; return outline(m, 20);
}

export function makeRubble(n = 6, spread = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const r = makeRock(0.5 + Math.random() * 1.1); r.position.set((Math.random() - 0.5) * spread, r.position.y, (Math.random() - 0.5) * spread); r.rotation.set(Math.random(), Math.random() * 3, Math.random()); g.add(r); }
  return g;
}

export function makeCO2() {
  const g = new THREE.Group();
  const b = cyl(0.32, 0.32, 1.4, C.tomato, 10, true); b.position.y = 0.7; g.add(b);
  g.add(at(cyl(0.12, 0.12, 0.25, C.ink, 6), 0, 1.5, 0));
  g.add(at(box(0.5, 0.12, 0.12, C.ink, false), 0.2, 1.62, 0));
  const label = at(box(0.5, 0.35, 0.02, C.cream, false), 0, 0.7, 0.33); g.add(label);
  const horn = at(cone(0.28, 0.6, C.ink, 8), 0.55, 1.35, 0, 0, 0, -Math.PI / 2); g.add(horn);
  g.userData.hitRadius = 0.9;
  return g;
}

export function makeConsole() {
  const g = new THREE.Group();
  g.add(at(box(4.6, 3.2, 1.2, C.steelLight), 0, 1.6, 0));
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.1), emissive(C.glass, 0.8)); screen.position.set(-0.8, 2.3, 0.62); g.add(screen);
  const off = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.15), emissive(C.lettuceLight, 0.9)); off.position.set(1.3, 1.1, 0.62); g.add(off);
  const label = at(box(1.4, 0.3, 0.02, C.cream, false), 0, 3.05, 0.62); g.add(label);
  const msl = makeMissile(C.lettuce, 0.55); msl.position.set(-1.35, 0.2, 0.55); g.add(msl);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emissive(0xFF5A46, 1.2)); lamp.position.set(1.9, 3.35, 0.4); g.add(lamp);
  g.userData = { screen, off, lamp, hitRadius: 2.4 };
  return g;
}

export function makeScreenGlow(w = 2.2, h = 1.4) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), emissive(C.glass, 0.9));
}

// glowing sphere used for explosions / muzzle flashes
export function makeGlow(color = C.orange, r = 1) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
}

// ---------------------------------------------------------------- battle-mode props
// A power generator: a boxy machine with a chimney, a spinning fan and a glowing core.
export function makeGenerator(color = C.tomato) {
  const g = new THREE.Group();
  g.add(at(box(7, 0.6, 5, C.steelDark), 0, 0.3, 0));
  g.add(at(box(5.2, 3.6, 3.6, C.steel), 0, 2.4, 0));
  g.add(at(box(5.4, 0.5, 3.8, color), 0, 4.45, 0));
  const chimney = cyl(0.55, 0.65, 3, C.steelDark, 8); chimney.position.set(-1.6, 6, -0.8); g.add(chimney);
  const fanRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.14, 6, 14), mat(C.ink)); fanRing.position.set(2.62, 2.4, 0); fanRing.rotation.y = Math.PI / 2; g.add(fanRing);
  const fan = new THREE.Group(); fan.position.set(2.66, 2.4, 0); g.add(fan);
  for (let i = 0; i < 4; i++) { const b = box(0.06, 0.9, 0.3, C.steelLight, false); b.position.y = 0.5; const h = new THREE.Group(); h.rotation.x = i * Math.PI / 2; h.add(b); fan.add(h); }
  const core = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.2), emissive(C.scarf, 1.2)); core.position.set(0, 2.4, 1.9); g.add(core);
  const stripe = at(box(0.3, 3.4, 0.2, color, false), -1.6, 2.4, 1.85); g.add(stripe);
  const light = new THREE.PointLight(0xFFD98A, 1, 14); light.position.set(0, 3, 3); g.add(light);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-2.6, 0.9, 1.4), new THREE.Vector3(-4, 0.2, 2.6), new THREE.Vector3(-6, 0.1, 3.2)]), 8, 0.12, 6, false), mat(C.ink)); g.add(cable);
  g.userData = { fan, core, light, chimney };
  return g;
}
// A round steel hatch with a wheel; opens (wheel + lid gone) when blown.
export function makeHatch() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.5, 16), mat(C.steelDark)); rim.position.y = 0.25; g.add(outline(rim, 40));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 16), mat(C.steel)); lid.position.y = 0.6; g.add(outline(lid, 40));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 14), mat(C.ink)); wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.95; g.add(wheel);
  const spokes = new THREE.Group(); spokes.position.y = 0.95; g.add(spokes);
  for (let i = 0; i < 3; i++) { const s = box(1.8, 0.1, 0.1, C.ink, false); s.rotation.y = i * Math.PI / 3; spokes.add(s); }
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), mat(0x0B1014)); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.52; hole.visible = false; g.add(hole);
  g.userData = { lid, wheel, spokes, hole };
  return g;
}
// C4 charge: a tan brick with a blinking red light.
export function makeC4() {
  const g = new THREE.Group();
  g.add(at(box(0.7, 0.35, 0.45, 0xD9C79A), 0, 0.18, 0));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), emissive(C.tomato, 1.5)); led.position.set(0.2, 0.4, 0); g.add(led);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, 0.36, 0), new THREE.Vector3(-0.4, 0.55, 0.1), new THREE.Vector3(-0.1, 0.5, 0.2)]), 6, 0.025, 5, false), mat(C.ink)); g.add(wire);
  g.userData = { led };
  return g;
}
// A painted pad on the ground with a label post (for the drone drop / jet).
export function makePad(color = C.scarf, r = 4) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.RingGeometry(r - 0.5, r, 24), new THREE.MeshBasicMaterial({ color })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; g.add(disc);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r - 1.2, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.035; g.add(inner);
  const post = cyl(0.08, 0.1, 3, C.ink, 6); post.position.set(r + 0.6, 1.5, 0); g.add(post);
  const sign = box(1.6, 0.9, 0.1, C.cream); sign.position.set(r + 0.6, 3.2, 0); g.add(sign);
  const mark = box(0.7, 0.35, 0.12, color, false); mark.position.set(r + 0.6, 3.2, 0); g.add(mark);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emissive(color, 1.4)); lamp.position.set(r + 0.6, 3.85, 0); g.add(lamp);
  g.userData = { lamp, sign, mark };
  return g;
}
// Reactor wire panel: 4 coloured wires running from plugs (left) to sockets (right). Sockets can be re-wired.
export function makeWirePanel() {
  const g = new THREE.Group(); const cols = [C.tomato, C.scarf, 0x3B7DD8, C.laser];
  g.add(at(box(3.4, 2.6, 0.3, C.steelLight), 0, 1.7, 0));
  g.add(at(box(3.0, 0.5, 0.1, C.cream), 0, 3.15, 0.14));
  const plugs = [], sockets = [], wires = [];
  for (let i = 0; i < 4; i++) {
    const y = 0.75 + i * 0.5;
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 8), mat(cols[i])); pl.rotation.x = Math.PI / 2; pl.position.set(-1.2, y, 0.2); g.add(pl); plugs.push(pl);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 8), mat(C.ink)); so.rotation.x = Math.PI / 2; so.position.set(1.2, y, 0.2); g.add(so); sockets.push(so);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 5, 10), mat(cols[i])); ring.position.set(1.2, y, 0.3); g.add(ring);
    wires.push(null);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), emissive(C.laser, 1.4)); lamp.position.set(1.4, 2.75, 0.2); g.add(lamp);
  g.userData = { cols, plugs, sockets, wires, lamp, map: [0, 1, 2, 3] };
  // wire from plug i to socket map[i]
  g.userData.rewire = (map) => {
    for (let i = 0; i < 4; i++) {
      if (wires[i]) g.remove(wires[i]);
      const a = plugs[i].position, b = sockets[map[i]].position; const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.25, 0.42);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a.clone().add(new THREE.Vector3(0, 0, 0.1)), mid, b.clone().add(new THREE.Vector3(0, 0, 0.1))]), 10, 0.05, 6, false), mat(cols[i]));
      g.add(tube); wires[i] = tube;
    }
    g.userData.map = map.slice();
  };
  g.userData.rewire([0, 1, 2, 3]);
  return g;
}
