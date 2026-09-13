// Renderer, first-person player, shooting, effects, HUD glue.
import * as THREE from 'three';
import { C, mat, emissive, box, cyl, makeGlow, outline, at , makeParachute, makeJet } from './art.js';

const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Engine {
  constructor(audio) {
    this.audio = audio;
    this.canvas = $('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 900);
    this.yaw = new THREE.Object3D(); this.pitch = new THREE.Object3D();
    this.yaw.add(this.pitch); this.pitch.add(this.camera); this.scene.add(this.yaw);
    this.pitch.position.y = 1.7;
    this.clock = new THREE.Clock();
    this.keys = {}; this.mouse = { down: false, dx: 0, dy: 0, locked: false };
    this.player = { pos: V3(0, 0, 0), vel: V3(), hp: 100, maxHp: 100, ammo: 30, mag: 30, reserve: Infinity, reloading: 0, fireCd: 0, onGround: true, alive: true, lastHurt: -99, speed: 6.5, run: 10, radius: 0.55, invuln: 0, controlsOn: false, canShoot: true, lookScale: 1, shield: false, mode: 'foot', disguised: false, disguiseCd: 0, jetFuel: 0, medCd: 0, medHeal: 45, medCdMax: 10, weapon: 'rifle', weapons: ['rifle'], royalShield: false, name: 'TOM' };
    this.loadout = { weapon: 'rifle', character: 'tom' };
    this.targets = []; this.solids = []; this.colliders = []; this.updaters = new Set(); this.persistent = new Set(); this.effects = [];
    this.time = 0; this.shake = 0; this.state = 'boot'; this.paused = false;
    this.raycaster = new THREE.Raycaster();
    this.onPlayerDead = null; this.level = null;
    this.tmpV = V3(); this.tmpV2 = V3();
    this.setupWorld(); this.setupViewmodel(); this.bindInput();
    this.resize(); addEventListener('resize', () => this.resize());
    this.sens = 0.0022;
  }

  // ---------------------------------------------------------------- world
  setupWorld() {
    const s = this.scene;
    s.background = new THREE.Color(C.sky);
    s.fog = new THREE.Fog(0x18294A, 90, 520);
    this.hemi = new THREE.HemisphereLight(0x8FB2E0, 0x1E2E26, 0.9); s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xC8D8F0, 0.9); this.sun.position.set(-60, 90, 40); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 300;
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0008; s.add(this.sun); s.add(this.sun.target);
    // sky dome with gradient + stars
    const skyGeo = new THREE.SphereGeometry(700, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x0A1224) }, mid: { value: new THREE.Color(0x1D3153) }, bot: { value: new THREE.Color(0x3A5A80) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = h<0.25 ? mix(bot,mid,h/0.25) : mix(mid,top,(h-0.25)/0.75); gl_FragColor = vec4(c,1.0); }'
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat); s.add(this.sky);
    const starGeo = new THREE.BufferGeometry(); const pts = [];
    for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.08; pts.push(Math.cos(a) * Math.cos(e) * 650, Math.sin(e) * 650, Math.sin(a) * Math.cos(e) * 650); }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false })); s.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xF6F1DC, fog: false })); this.moon.position.set(260, 300, -420); s.add(this.moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(34, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFF6D8, transparent: true, opacity: 0.05, fog: false, depthWrite: false })); this.moon.add(halo);
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFE9B0, fog: false })); this.sunDisc.visible = false; s.add(this.sunDisc);
    const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12), new THREE.MeshBasicMaterial({ color: 0xFFD27A, transparent: true, opacity: 0.18, fog: false, depthWrite: false })); this.sunDisc.add(sunHalo);
    this.sunOffset = new THREE.Vector3(-60, 90, 40);
    this.world = new THREE.Group(); s.add(this.world);
    this.fx = new THREE.Group(); s.add(this.fx);
  }
  // Time of day: 'night' | 'dawn' | 'morning' (and smooth blends between them)
  static PHASES = {
    night:   { top: 0x0A1224, mid: 0x1D3153, bot: 0x3A5A80, fog: 0x18294A, fogNear: 90, fogFar: 520, hemi: 0x8FB2E0, hemiG: 0x1E2E26, hemiI: 0.9, sun: 0xC8D8F0, sunI: 0.9, sunOff: [-60, 90, 40], stars: 0.85, moon: 1, disc: [520, -80, -190], discA: 0, bg: 0x0D1729 },
    dawn:    { top: 0x2B3E6E, mid: 0xC4694A, bot: 0xF3BE74, fog: 0xE0A47E, fogNear: 110, fogFar: 560, hemi: 0xFFC79C, hemiG: 0x4A4A3E, hemiI: 0.85, sun: 0xFFAE6A, sunI: 1.15, sunOff: [140, 28, -50], stars: 0.2, moon: 0, disc: [520, 70, -190], discA: 1, bg: 0xE0A47E },
    morning: { top: 0x4C93E0, mid: 0x9FCBF2, bot: 0xE3EFF8, fog: 0xC6DCEC, fogNear: 120, fogFar: 600, hemi: 0xE6F0FF, hemiG: 0x6E8C66, hemiI: 1.0, sun: 0xFFF5E0, sunI: 1.35, sunOff: [70, 120, -60], stars: 0, moon: 0, disc: [340, 420, -300], discA: 1, bg: 0xC6DCEC },
  };
  applyPhase(P) {
    const u = this.sky.material.uniforms; const col = (v) => (v instanceof THREE.Color ? v : new THREE.Color(v));
    u.top.value.copy(col(P.top)); u.mid.value.copy(col(P.mid)); u.bot.value.copy(col(P.bot));
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0x000000, 90, 520);
    this.scene.fog.color.copy(col(P.fog)); this.scene.fog.near = P.fogNear; this.scene.fog.far = P.fogFar;
    if (!this.scene.background || !this.scene.background.isColor) this.scene.background = new THREE.Color(); this.scene.background.copy(col(P.bg));
    this.hemi.color.copy(col(P.hemi)); this.hemi.groundColor.copy(col(P.hemiG)); this.hemi.intensity = P.hemiI;
    this.sun.color.copy(col(P.sun)); this.sun.intensity = P.sunI; this.sunOffset.set(...P.sunOff);
    this.stars.visible = P.stars > 0.01; this.stars.material.opacity = P.stars; this.moon.visible = P.moon > 0.5; this.sky.visible = true;
    this.sunDisc.visible = P.discA > 0.01; this.sunDisc.position.set(...P.disc); this.sunDisc.material.opacity = P.discA; this.sunDisc.material.transparent = P.discA < 0.99;
  }
  setTimeOfDay(phase = 'night') { this.phase = phase; if (this._tod) { this.updaters.delete(this._tod); this.persistent.delete(this._tod); this._tod = null; } this.applyPhase(Engine.PHASES[phase] || Engine.PHASES.night); }
  // blend from one phase to another over `dur` seconds (wall clock)
  tweenTimeOfDay(from, to, dur = 12) {
    const A = Engine.PHASES[from], B = Engine.PHASES[to]; const t0 = performance.now(); this.phase = to;
    const ca = {}, cb = {}; for (const k of ['top', 'mid', 'bot', 'fog', 'bg', 'hemi', 'hemiG', 'sun']) { ca[k] = new THREE.Color(A[k]); cb[k] = new THREE.Color(B[k]); }
    if (this._tod) this.updaters.delete(this._tod);
    const upd = () => {
      const k = clamp((performance.now() - t0) / (dur * 1000), 0, 1), s = ease(k); const P = {};
      for (const key of ['top', 'mid', 'bot', 'fog', 'bg', 'hemi', 'hemiG', 'sun']) P[key] = ca[key].clone().lerp(cb[key], s);
      for (const key of ['fogNear', 'fogFar', 'hemiI', 'sunI', 'stars', 'moon', 'discA']) P[key] = lerp(A[key], B[key], s);
      P.sunOff = A.sunOff.map((v, i) => lerp(v, B.sunOff[i], s)); P.disc = A.disc.map((v, i) => lerp(v, B.disc[i], s));
      this.applyPhase(P); if (k >= 1) { this.updaters.delete(upd); this.persistent.delete(upd); this._tod = null; }
    };
    this._tod = upd; this.updaters.add(upd); this.persistent.add(upd);
  }
  resetAtmosphere(phase = 'night') { this.setTimeOfDay(phase); }
  clearWorld() {
    this.setMarker(null);
    for (const o of [...this.world.children]) this.world.remove(o);
    for (const o of [...this.fx.children]) this.fx.remove(o);
    this.targets.length = 0; this.solids.length = 0; this.colliders.length = 0; this.effects.length = 0;
    for (const u of [...this.updaters]) if (!this.persistent.has(u)) this.updaters.delete(u);
    // per-scene gameplay callbacks must not leak across scenes/modes (e.g. Battle's handlers into the underground). Global ones (onRocketFire, onLockChange, onKey, onPlayerDead) are set elsewhere and left intact.
    this.onWorldHit = this.onBlast = this.onJetFire = this.onJetEnd = this.onDisguiseRequest = null;
    this.audio.stopAllLoops();
  }
  addGround(size = 500, color = C.ground) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat(color)); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; g.name = 'ground';
    this.world.add(g); this.solids.push(g); return g;
  }
  // add a solid box collider (axis-aligned) at world coords
  addCollider(cx, cz, w, d, h = 100, cy = 0) { this.colliders.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, y1: cy, y2: cy + h }); }
  addSolid(obj) { obj.traverse(o => { if (o.isMesh && !o.userData.noSolid) this.solids.push(o); }); }
  addTarget(actor) { this.targets.push(actor); }
  removeTarget(actor) { const i = this.targets.indexOf(actor); if (i >= 0) this.targets.splice(i, 1); }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- viewmodel
  setupViewmodel() {
    const g = new THREE.Group(); const gun = new THREE.Group(); g.add(gun);
    gun.add(at(box(0.12, 0.11, 0.95, C.steelDark), 0, 0, -0.45));
    gun.add(at(box(0.16, 0.22, 0.34, C.slate), 0, -0.07, 0.05));
    gun.add(at(box(0.1, 0.24, 0.14, C.slate), 0, -0.2, -0.28));
    const barrel = cyl(0.03, 0.03, 0.5, C.ink, 8); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -1.1); gun.add(barrel);
    const sight = box(0.03, 0.08, 0.03, C.ink, false); sight.position.set(0, 0.09, -0.85); gun.add(sight);
    // scarf tail in view, Tom's signature
    const band = box(0.19, 0.07, 0.16, C.scarf, false); band.position.set(0, -0.06, 0.02); band.userData.band = true; gun.add(band);
    const flash = makeGlow(0xFFE7B8, 0.07); flash.position.set(0, 0.01, -1.42); flash.visible = false; gun.add(flash);
    const light = new THREE.PointLight(0xFFC070, 0, 8); light.position.copy(flash.position); gun.add(light);
    // rocket launcher: a fat tomato-red tube with a sight and a grip
    const rl = new THREE.Group(); rl.visible = false; g.add(rl);
    const tube = cyl(0.1, 0.12, 1.3, C.tomato, 12); tube.rotation.x = Math.PI / 2; tube.position.set(0, -0.02, -0.6); rl.add(tube);
    const tubeRim = cyl(0.14, 0.14, 0.1, C.ink, 12); tubeRim.rotation.x = Math.PI / 2; tubeRim.position.set(0, -0.02, -1.25); rl.add(tubeRim);
    rl.add(at(box(0.1, 0.24, 0.16, C.slate), 0, -0.2, -0.2)); rl.add(at(box(0.04, 0.12, 0.04, C.ink, false), 0, 0.2, -0.7)); const rlBand = at(box(0.19, 0.07, 0.16, C.scarf, false), 0, -0.1, 0.05); rlBand.userData.band = true; rl.add(rlBand);
    const rlFlash = makeGlow(C.orange, 0.12); rlFlash.position.set(0, 0.02, -1.4); rlFlash.visible = false; rl.add(rlFlash);
    // laser rifle: slim, dark, with a green lens and a glowing cell
    const lr = new THREE.Group(); lr.visible = false; g.add(lr);
    lr.add(at(box(0.1, 0.12, 1.0, C.slate), 0, 0, -0.45)); lr.add(at(box(0.14, 0.2, 0.3, C.steelDark), 0, -0.06, 0.05)); lr.add(at(box(0.09, 0.22, 0.13, C.slate), 0, -0.2, -0.26));
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.34), emissive(C.laser, 1.2)); cell.position.set(0, 0.09, -0.4); lr.add(cell);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), emissive(C.laser, 1.5)); lens.position.set(0, 0, -0.98); lr.add(lens);
    const lrBand = at(box(0.19, 0.07, 0.16, C.scarf, false), 0, -0.06, 0.02); lrBand.userData.band = true; lr.add(lrBand);
    this.vmRocket = rl; this.vmRocketFlash = rlFlash; this.vmLaser = lr; this.vmLaserLens = lens;
    // the shield: a tomato-red riot plate with a view slit, held up in front (F toggles)
    const sh = new THREE.Group(); sh.visible = false; g.add(sh);
    const plate = box(1.0, 1.15, 0.06, C.tomato); plate.position.set(-0.12, -0.48, -0.8); sh.add(plate);
    const rim = box(1.08, 1.23, 0.03, C.ink, false); rim.position.set(-0.12, -0.48, -0.83); sh.add(rim);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.08), new THREE.MeshLambertMaterial({ color: 0xCFE4F0, transparent: true, opacity: 0.3 })); slit.position.set(-0.12, -0.08, -0.765); sh.add(slit);
    const boss = cyl(0.14, 0.14, 0.08, C.scarf, 10); boss.rotation.x = Math.PI / 2; boss.position.set(-0.12, -0.55, -0.755); sh.add(boss);
    const grip = box(0.08, 0.3, 0.1, C.slate, false); grip.position.set(-0.12, -0.8, -0.7); sh.add(grip);
    const arm = box(0.1, 0.1, 0.5, C.scarf, false); arm.position.set(-0.1, -0.85, -0.45); sh.add(arm);
    const shFlash = makeGlow(0xDFF7C9, 0.7); shFlash.position.set(-0.12, -0.3, -1.0); shFlash.visible = false; sh.add(shFlash);
    g.position.set(0.32, -0.32, -0.55); g.scale.setScalar(0.85); this.camera.add(g);
    g.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
    this.viewmodel = g; this.vmGun = gun; this.vmRifle = gun; this.vmShield = sh; this.vmShieldFlash = shFlash; this.vmFlash = flash; this.vmLight = light; this.vmBob = 0; this.vmKick = 0;
  }
  // built-in med kit: H heals, then it needs a moment to restock
  useMedkit() {
    const p = this.player; if (!p.alive) return;
    if (p.medCd > 0) { this.hint(`Med kit restocking — <b>${Math.ceil(p.medCd)}s</b>`, 1.2); return; }
    if (p.hp >= p.maxHp) { this.hint('You are at <b>full health</b>.', 1.2); return; }
    p.hp = Math.min(p.maxHp, p.hp + p.medHeal); p.medCd = p.medCdMax; this.audio.pickup(); this.updateHUD();
    this.sparks(this.eye().add(this.forward().multiplyScalar(0.8)).add(V3(0, -0.4, 0)), 8, 0xFF6B5E); this.toast('MED KIT', `+${p.medHeal} HEALTH`, 1.2);
  }
  updateMed(dt) { const p = this.player; if (p.medCd > 0) { p.medCd -= dt; if (p.medCd <= 0) { p.medCd = 0; this.hint('<b>Med kit</b> ready — <b>H</b>', 1.5); } } const m = $('med'); if (m && this.time % 0.25 < dt) { m.textContent = p.medCd > 0 ? `MED KIT · ${Math.ceil(p.medCd)}s` : 'MED KIT · H'; m.classList.toggle('cd', p.medCd > 0); } }
  // do enemies bother with the player right now? (dead, cutscene, or in disguise → no)
  hostile() { const p = this.player; return p.alive && p.controlsOn && !p.disguised; }
  // ---- spy disguise (rank 20): enemies ignore Tom until he shoots or gets too close
  setDisguise(on) {
    const p = this.player; if (p.disguised === on) return; p.disguised = on;
    if (on) { if (p.shield) this.setShield(false); this.vmGun.visible = false; $('ammoS').textContent = 'UNDERCOVER · LETTUCE UNIFORM · G TO DROP'; this.audio.pickup(); }
    else { if (p.mode === 'foot') this.vmGun.visible = true; this.updateHUD(); }
    this.onDisguise && this.onDisguise(on);
  }
  blowCover(why = 'They saw through you.') { const p = this.player; if (!p.disguised) return; this.setDisguise(false); p.disguiseCd = 25; this.toast('COVER BLOWN', why.toUpperCase(), 2.4); this.audio.alarm && this.audio.alarm(2, 520); }
  // ---- parachute (rank 5): a slow fall with air control, canopy overhead
  startChute(x, y, z) {
    const p = this.player; p.mode = 'chute'; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.onGround = false; this.yaw.position.copy(p.pos);
    if (!this.canopy) { this.canopy = makeParachute(0xF1F5F7); this.canopy.scale.setScalar(1.6); this.canopy.position.set(0, 1.2, 0); this.canopy.traverse(o => { o.castShadow = false; }); }
    this.yaw.add(this.canopy); this.canopy.visible = true; this.audio.whoosh(0); $('ammoS').textContent = 'PARACHUTE · WASD TO STEER';
  }
  endChute() { const p = this.player; if (p.mode !== 'chute') return; p.mode = 'foot'; if (this.canopy) this.canopy.visible = false; this.audio.step(); this.updateHUD(); this.onLanded && this.onLanded(); }
  // ---- jet (rank 10): fly where you look, click fires rockets, limited fuel, then you bail out with a chute
  startJet(x, y, z, yawDeg = -90, fuel = 45) {
    const p = this.player; p.mode = 'jet'; p.jetFuel = fuel; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.onGround = false; this.yaw.position.copy(p.pos);
    this.yaw.rotation.y = THREE.MathUtils.degToRad(yawDeg); this.pitch.rotation.x = 0.12; this.mouse.dx = 0; this.mouse.dy = 0;
    if (!this.cockpit) { const j = makeJet(C.tomato); j.scale.setScalar(0.3); j.rotation.y = Math.PI / 2; j.position.set(0, -1.7, -3.4); j.traverse(o => { o.castShadow = false; o.receiveShadow = false; }); this.cockpit = j; this.camera.add(j); }
    this.cockpit.visible = true; this.vmGun.visible = false; this.vmShield.visible = false; if (p.shield) p.shield = false;
    this.audio.whoosh(0); this.audio.loop && this.audio.loop('jet', c => this.audio.noiseLoop(900, 1, 0.09));
    this.jetCd = 0; this.updateHUD();
  }
  endJet(reason = 'fuel') {
    const p = this.player; if (p.mode !== 'jet') return; if (this.cockpit) this.cockpit.visible = false; this.audio.stopLoop && this.audio.stopLoop('jet');
    const pos = p.pos.clone(); p.mode = 'foot'; this.vmGun.visible = !p.disguised;
    this.onJetEnd && this.onJetEnd(reason, pos);
  }
  updateJet(dt) {
    const p = this.player, k = this.keys;
    if (this.mouse.locked && p.controlsOn) { this.yaw.rotation.y -= this.mouse.dx * this.sens * 0.6; this.pitch.rotation.x = clamp(this.pitch.rotation.x - this.mouse.dy * this.sens * 0.6, -0.9, 0.9); }
    this.mouse.dx = 0; this.mouse.dy = 0;
    const dir = this.aimDir(); const boost = (k.ShiftLeft || k.ShiftRight) ? 1.35 : 1; const brake = (k.KeyS) ? 0.7 : 1;
    p.pos.addScaledVector(dir, 34 * boost * brake * dt);
    // keep it in the sky and on the map
    if (p.pos.y < 5) { p.pos.y = 5; if (this.pitch.rotation.x < 0) this.pitch.rotation.x = 0.05; }
    if (p.pos.y > 75) { p.pos.y = 75; if (this.pitch.rotation.x > 0) this.pitch.rotation.x = -0.05; }
    const B = this.jetBounds || { x1: -130, x2: 130, z1: -100, z2: 100 }; let turned = false;
    if (p.pos.x < B.x1 || p.pos.x > B.x2 || p.pos.z < B.z1 || p.pos.z > B.z2) { p.pos.x = clamp(p.pos.x, B.x1, B.x2); p.pos.z = clamp(p.pos.z, B.z1, B.z2); turned = true; this.yaw.rotation.y += dt * 1.6; if (this.time % 1 < dt) this.hint('<b>Turn back</b> — the fight is behind you.', 1); }
    // hitting a building counts as a crash
    for (const c of this.colliders) { if (p.pos.y < c.y2 && p.pos.x > c.x1 && p.pos.x < c.x2 && p.pos.z > c.z1 && p.pos.z < c.z2) { this.explosion(p.pos.clone(), 1.6); this.damage(45, 'crash'); this.endJet('crash'); return; } }
    this.yaw.position.copy(p.pos); this.camera.position.set(rand(-0.01, 0.01), rand(-0.01, 0.01), 0);
    if (this.cockpit) { this.cockpit.rotation.z = lerp(this.cockpit.rotation.z, -this.mouse.dx * 0.01, 0.1); this.cockpit.userData.flame.scale.setScalar(boost > 1 ? 1.5 : 1); }
    if (this.time % 0.08 < dt) this.puff(p.pos.clone().addScaledVector(dir, -3).add(V3(0, -0.8, 0)), 0xC9D2D8, 0.5, 1.2);
    // rockets
    this.jetCd -= dt; if (p.controlsOn && this.mouse.down && this.jetCd <= 0) { this.jetCd = 0.55; this.onJetFire && this.onJetFire(this.eye().add(V3(0, -1, 0)).addScaledVector(dir, 3), dir.clone()); this.shake = Math.max(this.shake, 0.1); }
    p.jetFuel -= dt; if (p.jetFuel <= 0) { this.toast('OUT OF FUEL', 'BAILING OUT', 2.2); this.endJet('fuel'); return; }
    if (this.time % 0.5 < dt) $('ammoS').textContent = `JET · CLICK FIRES ROCKETS · SHIFT BOOST · FUEL ${Math.ceil(p.jetFuel)}s`;
    if (p.invuln > 0) p.invuln -= dt;
  }
  // ---- loadout: the character Tom is playing as, and the second weapon slot (bought with super points)
  static CHARACTERS = {
    tom: { name: 'TOM', maxHp: 100, speed: 6.5, run: 10, medHeal: 45, medCd: 10, royalShield: false, band: 0xF5D24A },
    ryley: { name: 'RYLEY', maxHp: 130, speed: 7.4, run: 11.4, medHeal: 45, medCd: 10, royalShield: false, band: 0x2EC4B6 },
    king: { name: 'THE KING', maxHp: 100, speed: 6.5, run: 10, medHeal: 70, medCd: 6, royalShield: true, band: 0xFFC940 },
  };
  static WEAPONS = {
    rifle: { label: 'RIFLE · R TO RELOAD', mag: 30, cd: 0.115, reload: 1.25 },
    rocket: { label: 'ROCKETS · 1 FOR RIFLE', mag: 4, cd: 0.9, reload: 2.2 },
    laser: { label: 'LASER · 1 FOR RIFLE', mag: 40, cd: 0.1, reload: 1.5 },
  };
  applyLoadout() {
    const p = this.player, L = this.loadout || {}; const ch = Engine.CHARACTERS[L.character] || Engine.CHARACTERS.tom;
    p.name = ch.name; p.maxHp = ch.maxHp; p.speed = ch.speed; p.run = ch.run; p.medHeal = ch.medHeal; p.medCdMax = ch.medCd; p.royalShield = ch.royalShield;
    this.viewmodel.traverse(o => { if (o.isMesh && o.userData.band) o.material = mat(ch.band); });
    p.weapons = L.weapon && L.weapon !== 'rifle' && Engine.WEAPONS[L.weapon] ? ['rifle', L.weapon] : ['rifle'];
    const hl = $('hplabel'); if (hl && hl.firstChild && hl.firstChild.nodeType === 3) hl.firstChild.textContent = `${p.name} · HEALTH`;
    this.setWeapon('rifle', true);
  }
  setWeapon(name, silent = false) {
    const p = this.player; if (!p.weapons.includes(name) || (p.weapon === name && !silent)) return;
    const W = Engine.WEAPONS[name]; p.weapon = name; p.mag = W.mag; p.ammo = W.mag; p.reloading = 0; p.fireCd = 0;
    this.vmRifle.visible = name === 'rifle'; this.vmRocket.visible = name === 'rocket'; this.vmLaser.visible = name === 'laser';
    if (p.shield) { this.vmRifle.visible = this.vmRocket.visible = this.vmLaser.visible = false; }
    if (p.disguised || p.mode === 'jet') { this.vmRifle.visible = this.vmRocket.visible = this.vmLaser.visible = false; }
    this.vmGun = name === 'rifle' ? this.vmRifle : name === 'rocket' ? this.vmRocket : this.vmLaser;
    if (!silent) { this.audio.reload(); this.toast(name === 'rifle' ? 'RIFLE' : name === 'rocket' ? 'ROCKET LAUNCHER' : 'LASER RIFLE', '', 1); }
    this.updateHUD();
  }
  setShield(on) {
    const p = this.player; if (p.shield === on) return; p.shield = on; this.vmGun.visible = !on; this.vmShield.visible = on; this.audio.reload();
    if (!on) this.updateHUD(); else { $('ammoS').textContent = 'SHIELD UP · F FOR RIFLE'; }
    if (on && !this._shieldHinted) { this._shieldHinted = true; this.hint('Shield up: blocks the <b>laser</b> and most bullets from the front. No shooting, slower walking. <b>F</b> brings the rifle back.', 4); }
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'KeyF' && !e.repeat && this.state === 'play' && this.player.controlsOn && this.player.mode === 'foot' && !this.player.disguised) this.setShield(!this.player.shield); if (e.code === 'KeyG' && !e.repeat && this.state === 'play' && this.player.controlsOn && this.onDisguiseRequest) this.onDisguiseRequest(); if (e.code === 'KeyH' && !e.repeat && this.state === 'play' && this.player.controlsOn) this.useMedkit(); if ((e.code === 'Digit1' || e.code === 'Digit2') && !e.repeat && this.state === 'play' && this.player.controlsOn && this.player.mode === 'foot') { const w = this.player.weapons[e.code === 'Digit1' ? 0 : 1]; if (w) this.setWeapon(w); } if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault(); this.onKey && this.onKey(e); });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', e => { if (!this.mouse.locked) return; this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; });
    document.addEventListener('mousedown', e => { if (e.button === 0 && this.mouse.locked) this.mouse.down = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; });
    document.addEventListener('pointerlockchange', () => { if (this.softLock) return; this.mouse.locked = document.pointerLockElement === this.canvas; document.body.dataset.locked = this.mouse.locked ? '1' : '0'; this.mouse.dx = 0; this.mouse.dy = 0; this.onLockChange && this.onLockChange(this.mouse.locked); });
    // some hosts (an embedded page, a sandboxed frame) refuse pointer lock — fall back to plain mouse movement over the canvas
    document.addEventListener('pointerlockerror', () => this.enableSoftLock());
    this.canvas.addEventListener('click', () => { if (this.state === 'play' && !this.mouse.locked) this.lock(); });
  }
  lock() {
    if (this.softLock) { this.softLocked(true); return; }
    try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (_) { this.enableSoftLock(); } }); } catch (e) { try { this.canvas.requestPointerLock(); } catch (_) { this.enableSoftLock(); } }
    clearTimeout(this._lockT); this._lockT = setTimeout(() => { if (!document.pointerLockElement && this.state === 'play' && !this.softLock) this.enableSoftLock(); }, 700);
  }
  unlock() { if (this.softLock) { this.softLocked(false); return; } if (document.pointerLockElement) document.exitPointerLock(); }
  enableSoftLock() { if (this.softLock) return; this.softLock = true; this.hint('Mouse look without pointer lock: keep the cursor over the game. <b>Esc</b> pauses.', 5); this.softLocked(this.state === 'play'); }
  softLocked(on) { this.mouse.locked = on; document.body.dataset.locked = on ? '1' : '0'; this.mouse.dx = 0; this.mouse.dy = 0; this.onLockChange && this.onLockChange(on); }

  // ---------------------------------------------------------------- player
  spawn(x, y, z, yawDeg = 0) {
    const p = this.player; this.applyLoadout(); p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.hp = p.maxHp; p.ammo = p.mag; p.reloading = 0; p.alive = true; p.invuln = 1.5; p.medCd = 0; if (p.shield) this.setShield(false); if (p.mode === 'jet') this.endJet('reset'); if (p.mode === 'chute') this.endChute(); p.mode = 'foot'; p.onRoof = null; if (p.disguised) this.setDisguise(false); p.disguiseCd = 0; if (this.cockpit) this.cockpit.visible = false; if (this.canopy) this.canopy.visible = false; this.setWeapon('rifle', true);
    this.yaw.rotation.y = THREE.MathUtils.degToRad(yawDeg); this.pitch.rotation.x = 0; this.yaw.position.copy(p.pos); this.mouse.dx = 0; this.mouse.dy = 0; this.updateHUD();
  }
  forward() { return V3(-Math.sin(this.yaw.rotation.y), 0, -Math.cos(this.yaw.rotation.y)); }
  eye() { return this.yaw.position.clone().add(V3(0, this.pitch.position.y, 0)); }
  aimDir() { return this.camera.getWorldDirection(V3()); }
  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    this.updateMed(dt);
    if (p.mode === 'jet') { this.updateJet(dt); return; }
    if (p.disguiseCd > 0) p.disguiseCd -= dt;
    if (this.mouse.locked && p.controlsOn) {
      this.yaw.rotation.y -= this.mouse.dx * this.sens * p.lookScale; this.pitch.rotation.x = clamp(this.pitch.rotation.x - this.mouse.dy * this.sens * p.lookScale, -1.45, 1.45);
    }
    this.mouse.dx = 0; this.mouse.dy = 0;
    let mx = 0, mz = 0;
    if (p.controlsOn) { if (k.KeyW || k.ArrowUp) mz -= 1; if (k.KeyS || k.ArrowDown) mz += 1; if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1; }
    const len = Math.hypot(mx, mz); if (len > 0) { mx /= len; mz /= len; }
    const run = (k.ShiftLeft || k.ShiftRight) && mz < 0;
    const spd = (run ? p.run : p.speed) * (p.shield ? 0.62 : 1);
    const sy = Math.sin(this.yaw.rotation.y), cy = Math.cos(this.yaw.rotation.y);
    const wx = (mx * cy - mz * sy) * spd, wz = (mx * sy + mz * cy) * spd;
    // note: forward is -z in yaw space => world (−sin, −cos)
    const fwd = this.forward(); const right = V3(-fwd.z, 0, fwd.x);
    const want = V3().addScaledVector(fwd, -mz * spd).addScaledVector(right, mx * spd);
    const chute = p.mode === 'chute';
    const accel = chute ? 2.2 : (p.onGround ? 14 : 4);
    if (chute) { want.multiplyScalar(1.4); }
    p.vel.x = lerp(p.vel.x, want.x, clamp(accel * dt, 0, 1)); p.vel.z = lerp(p.vel.z, want.z, clamp(accel * dt, 0, 1));
    if (p.controlsOn && (k.Space) && p.onGround && !chute) { p.vel.y = 7.2; p.onGround = false; }
    p.vel.y -= 22 * dt; if (chute) p.vel.y = Math.max(p.vel.y, -4.2);
    p.pos.addScaledVector(p.vel, dt);
    if (chute && this.canopy) { this.canopy.rotation.z = lerp(this.canopy.rotation.z, -p.vel.x * 0.02, 0.05); this.canopy.rotation.x = lerp(this.canopy.rotation.x, p.vel.z * 0.02, 0.05); }
    // ground + colliders
    let floorY = this.floorAt ? this.floorAt(p.pos.x, p.pos.z, p.pos.y) : 0;
    if (p.onRoof) { const c = p.onRoof; if (p.pos.x > c.x1 - 0.3 && p.pos.x < c.x2 + 0.3 && p.pos.z > c.z1 - 0.3 && p.pos.z < c.z2 + 0.3 && p.pos.y >= c.y2 - 0.5) floorY = Math.max(floorY, c.y2); else p.onRoof = null; }
    if (p.pos.y <= floorY) { p.pos.y = floorY; p.vel.y = 0; p.onGround = true; if (chute) this.endChute(); }
    const ceil = this.ceilAt ? this.ceilAt(p.pos.x, p.pos.z, p.pos.y) : Infinity;
    if (p.pos.y + 1.9 > ceil) { p.pos.y = ceil - 1.9; if (p.vel.y > 0) p.vel.y = 0; }
    for (const c of this.colliders) {
      if (chute && p.vel.y <= 0 && p.pos.y <= c.y2 && p.pos.y > c.y2 - 1.2 && p.pos.x > c.x1 && p.pos.x < c.x2 && p.pos.z > c.z1 && p.pos.z < c.z2) { p.pos.y = c.y2; p.vel.y = 0; p.onGround = true; p.onRoof = c; this.endChute(); continue; }
      if (p.pos.y + 1.7 < c.y1 || p.pos.y > c.y2) continue;
      const r = p.radius;
      if (p.pos.x > c.x1 - r && p.pos.x < c.x2 + r && p.pos.z > c.z1 - r && p.pos.z < c.z2 + r) {
        const dx1 = p.pos.x - (c.x1 - r), dx2 = (c.x2 + r) - p.pos.x, dz1 = p.pos.z - (c.z1 - r), dz2 = (c.z2 + r) - p.pos.z;
        const m = Math.min(dx1, dx2, dz1, dz2);
        if (m === dx1) p.pos.x = c.x1 - r; else if (m === dx2) p.pos.x = c.x2 + r; else if (m === dz1) p.pos.z = c.z1 - r; else p.pos.z = c.z2 + r;
      }
    }
    if (this.bounds) { p.pos.x = clamp(p.pos.x, this.bounds.x1, this.bounds.x2); p.pos.z = clamp(p.pos.z, this.bounds.z1, this.bounds.z2); }
    this.yaw.position.copy(p.pos);
    // bob
    const moving = len > 0 && p.onGround; this.vmBob += dt * (run ? 13 : 9) * (moving ? 1 : 0);
    const bobY = moving ? Math.sin(this.vmBob) * 0.018 : 0, bobX = moving ? Math.cos(this.vmBob * 0.5) * 0.012 : 0;
    this.viewmodel.position.set(0.32 + bobX, -0.32 + bobY + this.vmKick * 0.06, -0.55 + this.vmKick * 0.12);
    this.viewmodel.rotation.x = this.vmKick * 0.25; this.vmKick = lerp(this.vmKick, 0, clamp(dt * 12, 0, 1));
    if (moving && p.onGround) { this.stepT = (this.stepT || 0) + dt; if (this.stepT > (run ? 0.3 : 0.45)) { this.stepT = 0; this.audio.step(); } }
    // shooting
    p.fireCd -= dt; if (p.reloading > 0) { p.reloading -= dt; if (p.reloading <= 0) { p.ammo = p.mag; this.updateHUD(); } }
    if (p.controlsOn && p.canShoot && !p.shield && this.mouse.down && p.fireCd <= 0 && p.reloading <= 0) {
      if (p.ammo > 0) { this.fire(); p.fireCd = Engine.WEAPONS[p.weapon].cd; } else { this.audio.dry(); p.fireCd = 0.3; this.reload(); }
    }
    if (p.controlsOn && !p.shield && k.KeyR && p.reloading <= 0 && p.ammo < p.mag) this.reload();
    if (this.shieldFlashT > 0) { this.shieldFlashT -= dt; if (this.shieldFlashT <= 0) this.vmShieldFlash.visible = false; }
    if (p.invuln > 0) p.invuln -= dt;
    // regen after 6s
    if (p.alive && this.time - p.lastHurt > 6 && p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + dt * 9); this.updateHUD(); }
  }
  reload() { const p = this.player; if (p.reloading > 0) return; p.reloading = Engine.WEAPONS[p.weapon].reload; this.audio.reload(); $('ammoS').textContent = 'RELOADING…'; }
  fire() {
    const p = this.player; if (p.disguised) this.blowCover('You opened fire.');
    if (p.weapon === 'rocket') { p.ammo--; this.updateHUD(); this.vmKick = 1.6; this.shake = Math.max(this.shake, 0.3); this.vmRocketFlash.visible = true; setTimeout(() => { this.vmRocketFlash.visible = false; }, 70); const o = this.eye().add(this.aimDir().multiplyScalar(1.2)).add(V3(0, -0.25, 0)); this.onRocketFire && this.onRocketFire(o, this.aimDir()); return; }
    if (p.weapon === 'laser') { this.fireLaser(); return; }
    p.ammo--; this.updateHUD(); this.audio.shot(); this.vmKick = 1; this.shake = Math.max(this.shake, 0.12);
    this.vmFlash.visible = true; this.vmLight.intensity = 3; this.vmFlash.scale.setScalar(0.8 + Math.random() * 0.7); setTimeout(() => { this.vmFlash.visible = false; this.vmLight.intensity = 0; }, 45);
    const origin = this.eye(); const dir = this.aimDir();
    // slight spread
    dir.x += (Math.random() - 0.5) * 0.012; dir.y += (Math.random() - 0.5) * 0.012; dir.z += (Math.random() - 0.5) * 0.012; dir.normalize();
    this.raycaster.set(origin, dir); this.raycaster.far = 400;
    let best = null, bestD = Infinity, hitActor = null;
    for (const a of this.targets) {
      if (!a.hitbox || !a.alive) continue;
      const hits = this.raycaster.intersectObject(a.hitbox, false);
      if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = hits[0]; hitActor = a; }
    }
    const solidHits = this.raycaster.intersectObjects(this.solids, false);
    let end;
    if (solidHits.length && solidHits[0].distance < bestD) { end = solidHits[0].point; hitActor = null; this.sparks(end, 4, C.fireHot); if (this.onWorldHit) this.onWorldHit(solidHits[0]); }
    else if (hitActor) { end = best.point; hitActor.onHit(1, best.point, dir); this.hitMarker(); this.audio.hit(); this.sparks(end, 5, hitActor.sparkColor || C.scarf); }
    else end = origin.clone().addScaledVector(dir, 300);
    const muzzle = this.vmFlash.getWorldPosition(V3());
    this.tracer(muzzle, end, 0xFFE7B8, 0.06);
  }
  fireLaser() {
    const p = this.player; p.ammo--; this.updateHUD(); this.vmKick = 0.25; if (this.time % 0.3 < 0.11) this.audio.laserFire && this.audio.tone(1400, 900, 0.12, 'sawtooth', 0.06);
    const origin = this.eye(); const dir = this.aimDir(); this.raycaster.set(origin, dir); this.raycaster.far = 400;
    let best = null, bestD = Infinity, hitActor = null;
    for (const a of this.targets) { if (!a.hitbox || !a.alive) continue; const hits = this.raycaster.intersectObject(a.hitbox, false); if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = hits[0]; hitActor = a; } }
    const solidHits = this.raycaster.intersectObjects(this.solids, false); let end;
    if (solidHits.length && solidHits[0].distance < bestD) { end = solidHits[0].point; hitActor = null; this.sparks(end, 2, C.laser); if (this.onWorldHit) this.onWorldHit(solidHits[0]); }
    else if (hitActor) { end = best.point; hitActor.onHit(1.6, best.point, dir); this.hitMarker(); this.sparks(end, 3, C.laser); }
    else end = origin.clone().addScaledVector(dir, 300);
    const muzzle = this.vmLaserLens.getWorldPosition(V3()); this.beam(muzzle, end, C.laser, 0.12, 0.05);
  }
  // srcPos (optional): where the hit came from — the shield only covers the front
  damage(amount, from, srcPos = null) {
    const p = this.player; if (!p.alive || p.invuln > 0) return;
    if (p.shield) {
      let frontal = true;
      if (srcPos) { const to = srcPos.clone().sub(this.eye()); to.y = 0; to.normalize(); frontal = to.dot(this.forward()) > 0.34; }
      if (frontal) {
        const block = (from === 'laser' || p.royalShield) ? 1 : (srcPos ? 0.8 : 0.5);
        amount *= 1 - block; this.audio.shieldHit(from === 'laser'); this.vmShieldFlash.visible = true; this.vmShieldFlash.scale.setScalar(from === 'laser' ? 1.6 : 0.8); this.shieldFlashT = 0.18; this.shake = Math.max(this.shake, 0.15);
        this.sparks(this.eye().add(this.forward().multiplyScalar(0.9)), from === 'laser' ? 10 : 3, from === 'laser' ? C.laser : 0xFFE7B8);
        if (amount <= 0.01) return;
      }
    }
    p.hp -= amount; p.lastHurt = this.time; this.audio.hurt(); this.shake = Math.max(this.shake, 0.35);
    $('dmg').style.opacity = 1; setTimeout(() => $('dmg').style.opacity = 0, 180);
    this.updateHUD();
    if (p.hp <= 0) { p.hp = 0; p.alive = false; p.controlsOn = false; this.onPlayerDead && this.onPlayerDead(from); }
  }
  updateHUD() {
    const p = this.player; if (p.shield) { $('hp').style.width = (100 * p.hp / p.maxHp) + '%'; $('hp').style.background = p.hp < 30 ? '#FF6B5E' : '#E1382B'; $('ammoN').textContent = p.ammo; return; } $('hp').style.width = (100 * p.hp / p.maxHp) + '%'; $('hp').style.background = p.hp < 30 ? '#FF6B5E' : '#E1382B';
    $('ammoN').textContent = p.ammo; if (p.reloading <= 0) $('ammoS').textContent = p.mode === 'jet' ? 'JET · CLICK FIRES ROCKETS' : p.mode === 'chute' ? 'PARACHUTE · WASD TO STEER' : p.disguised ? 'UNDERCOVER · LETTUCE UNIFORM · G TO DROP' : (Engine.WEAPONS[p.weapon] || Engine.WEAPONS.rifle).label + (p.weapons.length > 1 && p.weapon === 'rifle' ? ' · 2 FOR ' + p.weapons[1].toUpperCase() : '');
  }
  // a HUD marker pinned to a world position — shows the distance, sticks to the screen edge when it is behind you
  setMarker(pos = null, label = '') { this.marker = pos ? { pos: pos.clone(), label } : null; const m = $('marker'); if (m) m.hidden = !pos; }
  updateMarker() {
    const m = $('marker'); if (!m || !this.marker) return; if (this.state !== 'play') { m.hidden = true; return; } m.hidden = false;
    const p = this.marker.pos.clone().add(V3(0, 2.2, 0)); const d = Math.round(this.yaw.position.distanceTo(this.marker.pos));
    const v = p.project(this.camera); const behind = v.z > 1; let x = v.x, y = -v.y; if (behind) { x = -x; y = -y; }
    const W = innerWidth, H = innerHeight; const m2 = 0.9; let off = behind || Math.abs(x) > m2 || Math.abs(y) > m2;
    if (off) { const k = m2 / Math.max(Math.abs(x), Math.abs(y), 1e-6); x *= k; y *= k; if (behind) { y = m2; } }
    m.style.left = ((x + 1) / 2 * W) + 'px'; m.style.top = ((y + 1) / 2 * H) + 'px';
    const arrow = off ? (behind ? '↓' : (Math.abs(x) > Math.abs(y) ? (x > 0 ? '→' : '←') : (y > 0 ? '↓' : '↑'))) : '▼';
    m.innerHTML = `<b>${this.marker.label}</b><small>${d} m</small><i>${arrow}</i>`;
  }
  setRank(html, frac = null) { const r = $('rank'); if (!r) return; if (html == null) { r.hidden = true; return; } r.hidden = false; $('rankText').innerHTML = html; if (frac != null) $('rankBar').style.width = (100 * clamp(frac, 0, 1)) + '%'; }
  hitMarker() { const c = $('cross'); c.classList.add('hit'); clearTimeout(this._hm); this._hm = setTimeout(() => c.classList.remove('hit'), 90); }

  // ---------------------------------------------------------------- effects
  tracer(a, b, color = 0xFFE7B8, life = 0.07, width = 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const l = new THREE.Line(geo, m); this.fx.add(l);
    this.effects.push({ obj: l, t: 0, life, update: (e, k) => { m.opacity = 1 - k; } });
    return l;
  }
  beam(a, b, color = C.laser, life = 0.35, radius = 0.12) {
    const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(radius, radius, len, 6, 1); g.translate(0, len / 2, 0); g.rotateX(Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(g, m); mesh.position.copy(a); mesh.lookAt(b); this.fx.add(mesh);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, len, 6, 1).translate(0, len / 2, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9 })); mesh.add(core);
    this.effects.push({ obj: mesh, t: 0, life, update: (e, k) => { m.opacity = 0.9 * (1 - k); core.material.opacity = 0.9 * (1 - k); } });
  }
  sparks(pos, n = 5, color = C.scarf) {
    for (let i = 0; i < n; i++) {
      const s = makeGlow(color, 0.07 + Math.random() * 0.06); s.position.copy(pos); this.fx.add(s);
      const v = V3(rand(-1, 1), rand(0.5, 2.2), rand(-1, 1)).multiplyScalar(rand(2, 5));
      this.effects.push({ obj: s, t: 0, life: rand(0.25, 0.5), update: (e, k, dt) => { v.y -= 12 * dt; s.position.addScaledVector(v, dt); s.material.opacity = 1 - k; } });
    }
  }
  explosion(pos, size = 1, opts = {}) {
    const a = this.audio; const pan = clamp((pos.x - this.yaw.position.x) / 60, -1, 1);
    if (!opts.silent) a.explode(size, pan);
    this.shake = Math.max(this.shake, clamp(0.25 * size * (1 - pos.distanceTo(this.yaw.position) / 120), 0, 1.2));
    const core = makeGlow(0xFFF3D2, 1); core.position.copy(pos); this.fx.add(core);
    const fire = makeGlow(C.orange, 1); fire.position.copy(pos); this.fx.add(fire);
    const red = makeGlow(C.tomato, 1); red.position.copy(pos); this.fx.add(red);
    const light = new THREE.PointLight(0xFFA040, 6 * size, 40 * size); light.position.copy(pos); this.fx.add(light);
    const life = 0.55 + size * 0.15;
    this.effects.push({ obj: core, t: 0, life, update: (e, k) => { core.scale.setScalar(size * (0.6 + k * 2.2)); core.material.opacity = (1 - k) * 0.9; } });
    this.effects.push({ obj: fire, t: 0, life: life * 1.2, update: (e, k) => { fire.scale.setScalar(size * (1 + k * 3.4)); fire.material.opacity = (1 - k) * 0.85; } });
    this.effects.push({ obj: red, t: 0, life: life * 1.4, update: (e, k) => { red.scale.setScalar(size * (1.4 + k * 4)); red.material.opacity = (1 - k) * 0.55; } });
    this.effects.push({ obj: light, t: 0, life: life * 1.3, update: (e, k) => { light.intensity = 6 * size * (1 - k); } });
    // shockwave ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: 0xFFE7B8, transparent: true, opacity: 0.8 }));
    ring.position.copy(pos); ring.rotation.x = Math.PI / 2; this.fx.add(ring);
    this.effects.push({ obj: ring, t: 0, life: 0.9 + size * 0.2, update: (e, k) => { ring.scale.setScalar(size * (1 + k * 14)); ring.material.opacity = 0.8 * (1 - k); } });
    // smoke
    for (let i = 0; i < 5 + size * 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 6), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x6E7A85 : 0x9AA5AF, transparent: true, opacity: 0.85 }));
      s.position.copy(pos).add(V3(rand(-1, 1), rand(0, 1), rand(-1, 1)).multiplyScalar(size)); this.fx.add(s);
      const v = V3(rand(-1, 1), rand(1.5, 3.5), rand(-1, 1)).multiplyScalar(size * 0.9);
      this.effects.push({ obj: s, t: 0, life: rand(1.6, 2.8) + size * 0.4, update: (e, k, dt) => { s.position.addScaledVector(v, dt); v.multiplyScalar(1 - dt * 0.6); s.scale.setScalar(size * (0.8 + k * 3)); s.material.opacity = 0.85 * (1 - k); } });
    }
    this.sparks(pos, 8 + size * 4, C.orange);
    if (opts.debris) for (let i = 0; i < opts.debris; i++) {
      const d = box(rand(0.3, 0.9) * size, rand(0.2, 0.5) * size, rand(0.3, 0.9) * size, i % 3 ? C.steel : C.wall); d.position.copy(pos); this.fx.add(d);
      const v = V3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)).multiplyScalar(rand(5, 10) * Math.sqrt(size)); const rv = V3(rand(-4, 4), rand(-4, 4), rand(-4, 4));
      this.effects.push({ obj: d, t: 0, life: rand(1.5, 2.5), update: (e, k, dt) => { v.y -= 20 * dt; d.position.addScaledVector(v, dt); d.rotation.x += rv.x * dt; d.rotation.y += rv.y * dt; if (d.position.y < 0.2) { d.position.y = 0.2; v.set(0, 0, 0); } } });
    }
  }
  puff(pos, color = C.smoke, size = 1, life = 1.6) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.6, 7, 6), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.7 }));
    s.position.copy(pos); this.fx.add(s); const v = V3(rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4));
    this.effects.push({ obj: s, t: 0, life, update: (e, k, dt) => { s.position.addScaledVector(v, dt); s.scale.setScalar(size * (0.6 + k * 2.2)); s.material.opacity = 0.7 * (1 - k); } });
  }
  flash(strength = 1, dur = 1.2) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = strength; requestAnimationFrame(() => { f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = 0; }); }
  fade(to, dur = 0.6) { const f = $('fade'); f.style.transition = `opacity ${dur}s ease`; f.style.opacity = to; this.fadeTarget = to; this.fadeAt = this.time; return new Promise(r => setTimeout(r, dur * 1000)); }
  // safety net: a cutscene should never sit behind a black screen for long — if it does, lift the curtain and let skip work
  fadeWatchdog() { if (this.fadeTarget === 1 && this.state === 'cutscene' && this.time - this.fadeAt > 8) { console.warn('fade watchdog: lifting a stuck black screen'); this.fade(0, 0.8); } }
  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.t += dt; const k = clamp(e.t / e.life, 0, 1); e.update(e, k, dt);
      if (e.t >= e.life) { this.fx.remove(e.obj); if (e.obj.geometry) e.obj.geometry.dispose(); this.effects.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- HUD text helpers
  toast(text, sub = '', dur = 2.4) { const t = $('toast'); t.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); t.style.opacity = 1; clearTimeout(this._toastT); this._toastT = setTimeout(() => t.style.opacity = 0, dur * 1000); }
  hint(html, dur = 0) { const h = $('hint'); if (!html) { h.style.opacity = 0; return; } h.innerHTML = html; h.style.opacity = 1; clearTimeout(this._hintT); if (dur) this._hintT = setTimeout(() => h.style.opacity = 0, dur * 1000); }
  subtitle(text, who = '') { const s = $('sub'); if (!text) { s.classList.remove('on'); return; } s.innerHTML = (who ? `<span class="who">${who}</span>` : '') + text; s.classList.add('on'); }
  setLevelName(title, beat) { $('lvtitle').textContent = title; $('lvbeat').textContent = beat; }
  setObjectives(list) { this.objectives = list; this.renderObjectives(); }
  renderObjectives() { $('objlist').innerHTML = this.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.text}${o.count != null ? ` <b>${o.n}/${o.count}</b>` : ''}</li>`).join(''); }
  completeObjective(o) { if (o.done) return; o.done = true; this.renderObjectives(); this.audio.objective(); }
  progress(o, n) { o.n = n; if (o.count != null && n >= o.count) this.completeObjective(o); else this.renderObjectives(); }
  setState(s) { this.state = s; document.body.dataset.state = s; }

  // ---------------------------------------------------------------- loop
  start() { const tick = () => { requestAnimationFrame(tick); this.frame(); }; tick(); }
  frame() {
    let dt = Math.min(this.clock.getDelta(), 0.05); if (this.paused) dt = 0;
    this.time += dt;
    if (dt > 0) {
      if (this.state === 'play') this.updatePlayer(dt);
      for (const u of this.updaters) u(dt);
      this.updateEffects(dt);
      if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); const s = this.shake * 0.03; this.camera.position.set(rand(-s, s), rand(-s, s), 0); } else this.camera.position.set(0, 0, 0);
    }
    this.sun.position.copy(this.yaw.position).add(this.sunOffset); this.sun.target.position.copy(this.yaw.position);
    this.updateMarker(); this.fadeWatchdog();
    this.renderer.render(this.scene, this.camera);
  }
}
