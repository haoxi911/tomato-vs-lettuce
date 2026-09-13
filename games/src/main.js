import { Engine, V3 } from './engine.js';
import { AudioSys } from './audio.js';
import { Director } from './cutscenes.js';
import { Level1, Level2, Level3, Level4, Level5, scene4Cutscene, endingCutscene } from './levels.js';
import { buildField, FIELD } from './field.js';
import { Battle, BattleUnderground, RANK, SUPER } from './battle.js';
import { PlayerRocket } from './actors.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SAVE = 'tvl.progress';

const audio = new AudioSys();
const e = new Engine(audio);
const dir = new Director(e);
const game = { e, dir, audio, level: null, levelIndex: 0 };
const LEVELS = [Level1, Level2, Level3, Level4, Level5];

function showMenu(id) { for (const m of document.querySelectorAll('.menu')) m.classList.toggle('on', m.id === id); }
function progress() { try { return parseInt(localStorage.getItem(SAVE) || '0', 10) || 0; } catch (_) { return 0; } }
function save(i) { try { localStorage.setItem(SAVE, String(i)); } catch (_) { } }

// ---------------------------------------------------------------- title
e.clearWorld(); buildField(e); dir.lookFrom(V3(-90, 22, 70), V3(-20, 8, 0));
let titleSpin = 0; const titleCam = (dt) => { titleSpin += dt * 0.06; dir.lookFrom(V3(-20 + Math.cos(titleSpin) * -110, 26, Math.sin(titleSpin) * 90 + 30), V3(-10, 8, 0)); };
e.updaters.add(titleCam);
e.viewmodel.visible = false; e.start(); e.setState('title'); $('fade').style.opacity = 0; showMenu('title');
if (progress() > 0 && progress() < 5) { $('btnContinue').hidden = false; $('btnContinue').textContent = `CONTINUE · SCENE ${progress() + 1}`; }

RANK.e = e; RANK.onRankUp = () => renderTitleRank();
SUPER.e = e; SUPER.apply(); SUPER.onChange = () => { renderTitleRank(); renderDepot(); };
e.onRocketFire = (o, d) => { new PlayerRocket(e, o, d, { speed: 46, dmg: 6, blast: 6 }); e.audio.missileLaunch(); };
function renderDepot() {
  const d = SUPER.load(); $('depotPts').innerHTML = `★ <b>${d.pts}</b> SUPER POINT${d.pts === 1 ? '' : 'S'} · ${d.pts ? 'pick something' : 'finish the war or win a battle to earn one'}`;
  const rows = SUPER.items.map(it => {
    const owned = d.owned.includes(it.id); const equipped = (it.kind === 'weapon' ? d.weapon : d.character) === it.id;
    const btn = owned ? (equipped ? '<span class="tag on">EQUIPPED</span>' : `<button class="btn small ghost" data-equip="${it.id}" type="button">EQUIP</button>`) : (d.pts > 0 ? `<button class="btn small" data-buy="${it.id}" type="button">★ BUY</button>` : '<span class="tag">★ 1</span>');
    return `<div class="item ${owned ? 'owned' : ''}"><div><b>${it.name}</b><small>${it.kind === 'weapon' ? 'WEAPON' : 'CHARACTER'}</small><p>${it.text}</p></div><div class="act">${btn}</div></div>`;
  });
  const defaults = `<div class="item owned"><div><b>RIFLE ONLY / TOM</b><small>DEFAULT</small><p>Back to Tom with just the rifle.</p></div><div class="act">${d.weapon !== 'rifle' ? '<button class="btn small ghost" data-equip="rifle" type="button">RIFLE ONLY</button>' : ''} ${d.character !== 'tom' ? '<button class="btn small ghost" data-equip="tom" type="button">PLAY AS TOM</button>' : ''}</div></div>`;
  $('depotList').innerHTML = rows.join('') + defaults;
  for (const b of $('depotList').querySelectorAll('[data-buy]')) b.onclick = () => { SUPER.buy(b.dataset.buy); audio.boot(); audio.objective(); };
  for (const b of $('depotList').querySelectorAll('[data-equip]')) b.onclick = () => { SUPER.equip(b.dataset.equip); audio.boot(); audio.pickup(); };
}
$('btnDepot').onclick = () => { renderDepot(); showMenu('depot'); };
$('btnDepotBack').onclick = () => showMenu('title');
renderDepot();
function renderTitleRank() { const r = RANK.rank(), nx = RANK.nextUnlock(r); const el = $('titleRank'); if (!el) return; const d = SUPER.load(); el.innerHTML = `RANK <b>${r}</b> · ${RANK.xp()} XP` + (nx ? ` · next: <b>${nx.name}</b> at rank ${nx.lv}` : ' · everything unlocked') + ` &nbsp;·&nbsp; <b>${d.pts}</b> super point${d.pts === 1 ? '' : 's'}`; const lo = { tom: 'Tom', ryley: 'Ryley', king: 'the King' }[d.character] || 'Tom'; $('titleLoadout').textContent = `PLAYING AS ${lo.toUpperCase()} · ${d.weapon === 'rifle' ? 'RIFLE' : 'RIFLE + ' + d.weapon.toUpperCase() + (d.weapon === 'rocket' ? ' LAUNCHER' : ' RIFLE')}`; }
renderTitleRank();
$('btnBattle').onclick = () => startBattle();
$('btnBattleAgain').onclick = () => startBattle();
$('btnBattleTitle').onclick = () => location.reload();
$('btnStart').onclick = () => start(0);
$('btnContinue').onclick = () => start(progress());
$('btnAgain').onclick = () => { save(0); location.reload(); };
$('skip').onclick = () => dir.skip();
$('btnResume').onclick = () => resume();
$('btnRestart').onclick = () => { if (pendingResolve) { showMenu(''); e.paused = false; pendingResolve({ restart: true }); } };
$('btnRetry').onclick = () => { if (pendingResolve) { showMenu(''); e.paused = false; pendingResolve({ retry: true }); } };

let pendingResolve = null;
function resume() { showMenu(''); e.paused = false; e.setState('play'); e.lock(); }
e.onLockChange = (locked) => { if (!locked && e.state === 'play' && e.player.alive && game.level && game.level.running) { e.paused = true; showMenu('pause'); } };
e.onKey = (ev) => {
  if (ev.code === 'Escape' && e.state === 'cutscene') dir.skip();
  if (ev.code === 'Escape' && e.softLock && e.state === 'play' && e.mouse.locked) e.unlock();
  if (ev.code === 'Enter' || ev.code === 'Space') { if ($('pause').classList.contains('on')) resume(); else if ($('dead').classList.contains('on')) $('btnRetry').click(); }
};

async function start(fromLevel) {
  audio.boot(); showMenu(''); e.updaters.delete(titleCam);
  await e.fade(1, 0.8);
  for (let i = fromLevel; i < LEVELS.length; i++) {
    if (i === 3 && fromLevel <= 3) await scene4Cutscene(game);
    await playLevel(i);
  }
  try { await endingCutscene(game); } catch (err) { console.error('ending cutscene failed', err); dir.end(); }
  const d = SUPER.earn(1); $('endSuper').innerHTML = `★ <b>+1 SUPER POINT</b> · you have ${d.pts} — spend it at the SUPPLY DEPOT on the title screen for a new weapon or a new character.`;
  save(0); e.setState('end'); showMenu('end'); $('fade').style.opacity = 0;
}

async function playLevel(i) {
  let first = true;
  while (true) {
    const L = new LEVELS[i](game); game.level = L; game.levelIndex = i;
    document.title = `Scene ${L.id}/5 · ${L.title} — Tomato vs Lettuce`;
    e.onWorldHit = null; e.player.canShoot = true; e.paused = false;
    L.build();
    if (first) { await L.intro(); first = false; } else { if (L.retryPhase) e.setTimeOfDay(L.retryPhase); if (L.ambient) L.ambient(); else e.audio.ambWind(); await e.fade(0, 0.8); }
    e.setState('play'); e.viewmodel.visible = true; e.pitch.position.y = 1.7; e.camera.rotation.z = 0;
    const result = await new Promise(res => {
      pendingResolve = res;
      L.onWin = () => res('win'); L.onFail = (r) => res({ fail: r });
      e.onPlayerDead = (from) => res({ dead: from });
      L.play();
    });
    pendingResolve = null;
    if (result === 'win') { await sleep(2600); e.unlock(); await e.fade(1, 1.1); save(i + 1); e.audio.stopAllLoops(); return; }
    L.stop(); dir.stopNarration(); e.player.controlsOn = false; e.unlock(); e.mouse.down = false;
    if (result.dead || result.fail) {
      audio.fail();
      const why = result.fail || ({ trooper: 'A Lettuce soldier got you.', heli: 'The rope soldier on the helicopter got you.', bomb: 'A drone bomb landed too close.', rocket: 'A rocket found you.', laser: 'The laser gun caught you standing still.', fire: 'The fire got you.', enemy: 'The Lettuce Kingdom got you.' })[result.dead] || 'The Lettuce Kingdom got you.';
      $('deadKick').textContent = result.fail ? 'SCENE FAILED' : 'TOM IS DOWN'; $('deadTitle').textContent = why; $('deadText').textContent = `Back to the start of ${L.title}.`;
      e.setState('menu'); showMenu('dead');
      await new Promise(res => { pendingResolve = res; }); pendingResolve = null;
    }
    e.audio.stopAllLoops(); await e.fade(1, 0.6);
  }
}

// ---------------------------------------------------------------- battle mode
async function runBattleLevel(LClass) {
  let first = true;
  while (true) {
    const L = new LClass(game); game.level = L; game.levelIndex = -1;
    e.onWorldHit = null; e.player.canShoot = true; e.paused = false;
    L.build();
    if (first) { await L.intro(); first = false; } else { if (L.retryPhase) e.setTimeOfDay(L.retryPhase); if (L.ambient) L.ambient(); await e.fade(0, 0.8); }
    e.setState('play'); e.viewmodel.visible = true; e.pitch.position.y = 1.7; e.camera.rotation.z = 0; RANK.hud();
    const result = await new Promise(res => {
      pendingResolve = res;
      L.onWin = () => res('win'); L.onFail = (r) => res({ fail: r });
      e.onPlayerDead = (from) => res({ dead: from });
      L.play();
    });
    pendingResolve = null;
    if (result === 'win') { await sleep(2200); e.unlock(); await e.fade(1, 1); e.audio.stopAllLoops(); return 'win'; }
    L.stop(); e.player.controlsOn = false; e.unlock(); e.mouse.down = false;
    if (result.dead || result.fail) {
      audio.fail();
      const why = result.fail || ({ trooper: 'A Lettuce soldier got you.', heli: 'The rope soldier on the helicopter got you.', bomb: 'A bomb landed too close.', rocket: 'A rocket found you.', laser: 'The laser gun caught you in its line.', fire: 'The fire got you.', crash: 'The jet went into the ground.', enemy: 'The Lettuce Kingdom got you.' })[result.dead] || 'The Lettuce Kingdom got you.';
      $('deadKick').textContent = result.fail ? 'BATTLE LOST' : 'TOM IS DOWN'; $('deadTitle').textContent = why; $('deadText').textContent = `Your XP stays. Back to the start of ${L.title}.`;
      e.setState('menu'); showMenu('dead');
      await new Promise(res => { pendingResolve = res; }); pendingResolve = null;
    }
    e.audio.stopAllLoops(); await e.fade(1, 0.6);
  }
}
async function startBattle() {
  audio.boot(); showMenu(''); e.updaters.delete(titleCam); RANK.session = 0; const r0 = RANK.rank();
  await e.fade(1, 0.8);
  const surface = await runBattleLevel(Battle);
  let outcome = 'SURFACE CLEARED';
  let superLine = '';
  if (surface === 'win' && game.level.hatchOpen) { await runBattleLevel(BattleUnderground); RANK.award(150, 'Battle won'); outcome = 'VICTORY'; const d = SUPER.earn(1); superLine = `<br>★ <b>+1 SUPER POINT</b> (you have ${d.pts}) — spend it at the SUPPLY DEPOT.`; }
  e.setRank(null); e.setState('end'); e.viewmodel.visible = false;
  const r1 = RANK.rank(), nx = RANK.nextUnlock(r1);
  $('reportKick').textContent = outcome; $('reportTitle').innerHTML = r1 > r0 ? `RANK ${r1}` : `RANK ${r1}`;
  $('reportText').innerHTML = `<b>+${RANK.session} XP</b> this battle · ${RANK.xp()} XP total` + (r1 > r0 ? ` · <b>rank up!</b> ${RANK.unlocks.filter(u => u.lv > r0 && u.lv <= r1).map(u => u.name + ' unlocked').join(', ')}`.replace(/! $/, '!') : '') + (nx ? `<br>Next: <b>${nx.name}</b> at rank ${nx.lv} — ${nx.text}` : '<br>Everything is unlocked.') + (outcome !== 'VICTORY' ? '<br>The hatch under their silo needs <b>C4</b> (rank 10) — the war goes on below.' : '') + superLine;
  renderTitleRank(); showMenu('report'); $('fade').style.opacity = 0;
}

// debug / automation hooks (harmless in normal play)
window.TVL = { e, dir, game, audio, start, startBattle, RANK, SUPER, tick(n = 1, dt = 0.05) { for (let i = 0; i < n; i++) { e.time += dt; if (e.state === 'play') e.updatePlayer(dt); for (const u of e.updaters) u(dt); e.updateEffects(dt); } }, fakeLock() { e.mouse.locked = true; e.lock = () => { e.mouse.locked = true; }; e.unlock = () => { }; }, key(code, on = true) { e.keys[code] = on; }, fire(on = true) { e.mouse.down = on; }, look(dx, dy) { e.mouse.dx += dx; e.mouse.dy += dy; }, skip() { dir.skip(); }, win() { if (game.level) for (const o of game.level.objs) { o.done = true; } }, god() { e.player.invuln = 1e9; }, ending() { e.updaters.delete(titleCam); showMenu(''); return endingCutscene(game).then(() => { e.setState('end'); showMenu('end'); $('fade').style.opacity = 0; }); }, scene4() { e.updaters.delete(titleCam); showMenu(''); audio.boot(); return scene4Cutscene(game); } };
