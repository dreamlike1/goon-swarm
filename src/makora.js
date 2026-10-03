/* makora.js — MAKORA, the last boss, and the loop of runs it closes (v0.69 rework, user). */
'use strict';

/* The fight (v0.69, user):
   - Stage 4's boss. The summoning is as before: the screen goes black, furube.m4a, "WITH THIS TREASURE…",
     "I SUMMON", MAKORA! as its music comes in.
   - It no longer dies and comes back. Its HP is more than any of the other three bosses' whole fights, and it gets
     HARDER as it goes: phase 1, then from `phases[0]` of its HP it roars and phase 2 adds its lasers and longer
     combos; at `phases[1]` it slices open space and time (the rift, below) and comes out of it enraged, glowing, for
     phase 3, faster still.
   - When it dies, it sinks to its knees, the screen goes black and its wheel turns one notch: RUN 1 CLEARED. The
     run's stats show, then you're back at stage 1 as RUN 2, keeping your level, upgrades and deck. Every run after
     the first makes the swarm, the bosses and MAKORA tougher (`run`). Its wheel has 8 spokes: run 8's MAKORA is the
     last (`last`), and beating it ends the run in a win.
   - It still adapts: the weapon that finished it does `adapt` × its damage to it in every run after.
   - Its moves (user), each with a red warning first:
     - the dash: from far off it crouches, then dashes in to close the gap, straight into a combo;
     - the slash: 3 sizes (a quick small one, a wider one, a huge one), and the stab / lunge: 3 lengths. A combo
       chains them (from 1 to 3 hits in phase 1, longer later), small to big, and can end in another move;
     - the slam: it slams the ground (a ring round it), a big rock bursts up, it lifts it and throws it at you, fast.
       Dodge it and the rock lands at the end of its throw: MAKORA dashes to it, picks it up and lobs it back near you.
       A red circle shows where it lands, and it breaks into the ground in a blast;
     - the lasers (phase 2 on): it glows and floats, then either fires beams out like its wheel's spokes, in volleys
       that turn between them, or calls pillars of light down on you one after another;
     - the rift (once, at `phases[1]`): it leaps to the middle and slices the air open. Rifts tear open round the
       arena and a few enemies come through them at you, while it kneels and regains health: at most `rift.heal`
       of its HP, not all of it. Hurt it enough while it does (`rift.break`) and the heal breaks off.
   - Drawn in 3D (makora3d.js) once three.js has loaded; until then, or if it can't, the flat drawing below.
   (The user's context for it is Mahoraga, but the name must be MAKORA.) Numbers are placeholders. */
const MAKORA = {
  name: 'MAKORA', r: 72,                               // `r`: its drawing's size
  hit: { r: 30, cap: [0, 12, 0, -62] },                // its hitbox: a capsule from its legs to its head (30 = r px)
  grow: 0.05, growMax: 1.3,                            // a little bigger each run
  furube: 'assets/sfx/furube.m4a',
  hp: 1800,                                            // OBI ONE's whole fight is 1710 (360 + 600 + 750): the most of the other three
  last: 8,                                             // its wheel's 8 spokes: beating run 8's MAKORA ends the loop
  // each run after the first: + this share of MAKORA's HP and damage; its timings × quick per run (down to quickMin)
  run: { hp: 0.45, dmg: 0.2, quick: 0.93, quickMin: 0.7 },
  phases: [0.66, 0.33],                                // HP left where phase 2 starts, and the rift (then phase 3)
  phaseQuick: [1, 0.88, 0.78],                         // every warning, cooldown and rest × this, by phase
  walk: 78, walkPhase: 0.15, touch: 8, knockResist: 0.06,
  cd: [0.55, 1.1], rest: 0.45, follow: 0.72,           // `follow`: a combo's next warning, × the first's
  track: [0, 0.4, 0.55], turn: 3.2,                    // how much of a warning it keeps turning to follow you (by phase), rad/s
  combo: [3, 4, 5],                                    // the most hits in a combo, by phase (+1 every 3 runs)
  dash: { min: 250, wind: 0.34, speed: 1250, max: 560, stop: 110 },
  slash: {                                             // arc: the cone's full angle; range: how far it reaches
    S: { arc: 1.7, range: 150, tele: 0.42, anim: 0.16, dmg: 12, step: 22 },
    M: { arc: 2.3, range: 205, tele: 0.5, anim: 0.2, dmg: 16, step: 34 },
    L: { arc: 3.0, range: 275, tele: 0.68, anim: 0.26, dmg: 22, step: 46 },
  },
  stab: {                                              // a straight lane `len` long and `w` wide; it lunges `lunge` px down it
    S: { len: 230, w: 44, tele: 0.44, anim: 0.13, dmg: 13, lunge: 120 },
    M: { len: 310, w: 50, tele: 0.52, anim: 0.15, dmg: 17, lunge: 180 },
    L: { len: 410, w: 58, tele: 0.7, anim: 0.18, dmg: 22, lunge: 250 },
  },
  // the slam and its rock: the ring's radius and damage, lifting it, aiming (short: a fast throw), the throw's speed
  // and how far it flies, the rock's size and damage, and how long before it slams again
  slam: { tele: 0.62, r: 150, dmg: 14, knock: 380, lift: 0.5, aim: 0.42, lock: 0.7, speed: 1050, range: 620, rock: 40, rockDmg: 20, rockKnock: 520, cd: [5, 8] },
  // … and if you dodge it: it dashes to the rock, picks it up, and lobs it back near you (within `near`): a red circle
  // `r` across where it lands, `flight` s away
  fetch: { speed: 980, grab: 0.32, hold: 0.28, flight: 0.95, h: 280, r: 125, dmg: 22, near: 45 },
  laser: {
    glow: 0.75, cd: [7, 10], w: 24, len: 1700, dmg: 16,
    spokes: { n: 8, warn: 0.85, fire: 0.38, gap: 0.14, volleys: [2, 2, 3] },
    pillars: { n: [5, 6, 8], every: 0.4, warn: 0.8, r: 52, dmg: 18, lead: 0.3, glow: 0.35 },
  },
  rift: {
    heal: 0.1, time: 6, break: 0.12, rifts: 3, per: 3, every: 1.5, first: 0.5, ring: [250, 380],
    leap: 0.75, tear: 0.65, close: 0.5, broken: 1.1, land: { r: 130, dmg: 12 },
    units: ['red', 'tri', 'big', 'crab', 'lunger', 'shooter', 'split'],
  },
  roar: { time: 0.9, push: 520, r: 190 },
  die: 2.2,                                            // its death, before the screen goes black
  adapt: 0.5,                                          // the weapon that finished it: × this to it in the runs after
  cine: {                                              // seconds into each black-screen scene
    // The summoning plays furube.m4a (user) and follows its clock: "WITH THIS TREASURE…" from 3 to 4 s, "I SUMMON"
    // from 4.6 to 6 s, then MAKORA! as its own music comes in, it appears, done.
    summon: [3.0, 4.0, 4.6, 6.0, 6.3, 7.7, 8.4],
    clear: [0.55, 1.1, 2.4, 3.7],                      // the wheel shows, it turns one notch (WHEEL.spin), RUN N CLEARED, the stats
  },
};
const cineEl = document.getElementById('cine'), cineLine = document.getElementById('cine-line'), cineWheel = document.getElementById('cine-wheel');
const cineSkip = document.getElementById('cine-skip');
const runNo = () => game.flow?.run || 1;              // which run this is (flow.js: 1 until MAKORA's first defeat)

// The wheel scene: MAKORA's wheel, big on the black screen, turning one notch. Flat gold (v0.36): a rim, eight spokes
// with round knobs, a hub, a darker gold offset under each part for depth and a pale glint on top. Redrawn at every
// angle on its own small canvas, which the page blows up with hard edges (v0.37: a little pixelation, user).
const WHEEL = { size: 146, spins: 0, spin: 1.0 };   // canvas px: small, blown up to 440 for a little pixelation (v0.37,
// user); the turn: `spins` full turns and on one notch, over `spin` s
cineWheel.width = cineWheel.height = WHEEL.size;
const wheelCtx = cineWheel.getContext('2d');
function drawWheel(angle, flash = 0) {
  const c = wheelCtx, n = WHEEL.size, u = n / 100;         // drawn in a 100-unit box
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
  c.setTransform(u, 0, 0, u, n / 2, n / 2);
  c.lineCap = 'round';
  const part = (col, dx, dy) => {
    c.save(); c.translate(dx, dy); c.rotate(angle);
    c.strokeStyle = col; c.fillStyle = col;
    c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.stroke();           // the rim
    c.lineWidth = 3.4;
    for (let i = 0; i < 8; i++) {                                                   // spokes, reaching past the rim
      const a = i / 8 * TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 39, Math.sin(a) * 39); c.stroke();
      c.beginPath(); c.arc(Math.cos(a) * 42, Math.sin(a) * 42, 6.5, 0, TAU); c.fill();   // … each ending in a knob
    }
    c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill();                                // the hub
    c.restore();
  };
  part(COL.wheelDark, 1.4, 2);                              // depth: the same wheel in dark gold, a little below
  part(COL.wheel, 0, 0);
  c.save(); c.rotate(angle); c.fillStyle = COL.wheelHi;     // glints on the knobs and hub
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.arc(Math.cos(a) * 42 - 2, Math.sin(a) * 42 - 2, 2.2, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(-2.4, -2.4, 2.6, 0, TAU); c.fill();
  c.restore();
  if (flash > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = flash; c.fillStyle = '#fff6d8'; c.fillRect(-50, -50, 100, 100); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
}
// The nudge: slow to get going (it's heavy), then it swings a little past the notch and settles back into it.
function wheelEase(k) {
  const x = k ** 1.7, s = 1.6;
  return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
}
// One frame of the spin, from notch `c.run - 1` to `c.run`: draws it, ticks as each spoke passes, and clunks,
// flashes and shakes as it lands.
function spinMakoraWheel(c) {
  const k = Math.min(1, (c.t - MAKORA.cine.clear[1]) / WHEEL.spin), e = wheelEase(k), notch = Math.PI / 4;
  let a = (c.run - 1) * notch + (WHEEL.spins * Math.PI * 2 + notch) * e;
  if (c.landed) { const u = c.t - c.landed; a += notch * 0.14 * Math.sin(u * 30) * Math.exp(-u * 8); }   // the catch
  const spoke = Math.floor(a / notch + 0.5);
  if (c.spoke != null && spoke !== c.spoke && !c.landed) SFX.makoraTick(Math.min(1, (1 - k) * 1.6));
  c.spoke = spoke;
  if (!c.landed && e >= 1) {
    c.landed = c.t;
    SFX.wheelLand();
    cineWheel.classList.remove('is-clunk'); void cineWheel.offsetWidth; cineWheel.classList.add('is-clunk');
  }
  drawWheel(a, c.landed ? Math.max(0, 0.7 - (c.t - c.landed) * 3) : 0);
}

// flow.js sets game.makoraDue when stage 4's clock runs out; combat.js starts this once the floor is clear.
function startMakora() {
  game.makoraDue = false;
  m3dLoad();                                           // (makora3d.js: three.js, if it isn't in yet)
  for (const e of game.enemies) burst(e.x, e.y, enemyCol(e), 6, 140);   // the swarm scatters
  game.enemies = []; game.projectiles = []; game.rocks = []; game.mines = []; game.mrocks = [];
  aliveEl.textContent = 0;
  game.cine = { kind: 'summon', t: 0, step: 0 };
  cineEl.className = 'cine';
  cineLine.textContent = ''; cineLine.className = 'cine-line';
  cineWheel.hidden = true;
  cineSkip.hidden = false;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');                     // fades to black
  game.cine.audio = playFurube();
}
// Skip (user): the Skip button, Space or Enter. The voice stops, its music comes in and MAKORA is standing there as
// the screen fades back in, the same as the end of the summoning.
function skipIntro(fromNet = false) {
  const c = game.cine, T = MAKORA.cine.summon;
  if (!c || c.kind !== 'summon' || c.step > 5) return;
  if (NET.guest && NET.run && !fromNet) { toHost({ t: 'skip' }); return; }   // co-op: the host skips it for everyone
  if (NET.host && NET.run) coopEvent({ e: 'skip' });
  if (furubeEl) { furubeEl.pause(); furubeEl = null; }
  c.audio = null; c.music = true;
  cineSkip.hidden = true;
  lineOut();
  c.step = 5; c.t = T[5];                            // straight on to "it appears"
  SFX.click();
}
cineSkip.addEventListener('click', e => { skipIntro(); e.currentTarget.blur(); });   // (a click event is never `fromNet`)
// The summoning's voice (furube.m4a), on the sound effects' volume. A fresh copy each time, so it always starts at 0:00.
let furubeEl = null;
function playFurube() {
  const a = new Audio(MAKORA.furube);
  a.volume = Math.min(1, sfxGain() * 1.8);
  a.play().catch(() => { /* not allowed yet: the scene still runs on its own clock */ });
  return (furubeEl = a);
}
// sound.js keeps it in step with pausing, the tab hiding and the volume sliders
function syncFurube(hold) {
  const a = furubeEl;
  if (!a || a.ended) return;
  if (!game.cine || game.cine.kind !== 'summon') { a.pause(); furubeEl = null; return; }
  a.volume = Math.min(1, sfxGain() * 1.8);
  if (hold && !a.paused) a.pause();
  else if (!hold && a.paused && a.currentTime > 0) a.play().catch(() => {});
}

// The black-screen scenes. The fight is frozen while one plays (combat.js calls this instead of update).
function updateCine(dt) {
  const c = game.cine, T = MAKORA.cine[c.kind];
  // the summoning keeps time with its voice while that plays, so the words land on it
  const a = c.audio;
  if (a && !a.paused && !a.ended && a.currentTime > 0) c.t = Math.max(c.t, a.currentTime);
  else c.t += dt;
  if (c.kind === 'clear' && c.step >= 2) spinMakoraWheel(c);   // every frame of the spin
  if (!T || c.step >= T.length || c.t < T[c.step]) return;
  const i = c.step++;
  if (c.kind === 'summon') {
    if (i === 0) line('WITH THIS TREASURE…');
    else if (i === 1 || i === 3) lineOut();
    else if (i === 2) line('I SUMMON');
    else if (i === 4) { line('MAKORA!', 'is-name'); c.music = true; SFX.makoraRoar(); game.shake = Math.max(game.shake, 0.5); }   // its music comes in (sound.js)
    else if (i === 5) { if (!NET.guest) spawnMakora(); cineEl.classList.remove('is-on'); cineSkip.hidden = true; }   // fades back in, MAKORA standing there
    else endCine();
  } else {                                           // 'clear': MAKORA is down, the wheel turns, then the run's stats
    if (i === 0) { line(''); drawWheel((c.run - 1) * Math.PI / 4); cineWheel.hidden = false; void cineWheel.offsetWidth; cineWheel.classList.add('is-shown'); }
    else if (i === 1) { SFX.wheelSpin(); spinMakoraWheel(c); }   // the shove; it spins from here (above)
    else if (i === 2) line(c.final ? 'THE WHEEL IS COMPLETE' : `RUN ${c.run} CLEARED`, 'is-name is-clear');
    else if (!NET.guest) showRunCleared(c);          // (a co-op guest's comes with the host's picture: coop.js)
  }
}
function lineOut() { cineLine.classList.remove('is-in'); cineLine.classList.add('is-out'); }
function line(text, cls = '') {
  cineLine.className = `cine-line ${cls}`;
  cineLine.textContent = text;
  void cineLine.offsetWidth;
  cineLine.classList.add('is-in');
}
function endCine() {
  game.cine = null; game.cineHold = false;
  cineEl.classList.remove('is-on');
  cineEl.hidden = true;
  cineSkip.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-clunk');
  cineWheel.hidden = true;
  last = performance.now();
}

// This run's numbers, multiplied in: MAKORA's HP and damage, and its timings (a run after the first).
const runK = key => 1 + MAKORA.run[key] * (runNo() - 1);
const quick = m => MAKORA.phaseQuick[m.phase || 0] * Math.max(MAKORA.run.quickMin, MAKORA.run.quick ** (runNo() - 1));
const mDmg = (m, n) => Math.round(n * runK('dmg'));
const between = ([a, b]) => a + Math.random() * (b - a);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const turnTo = (a, to, max) => { const d = angDiff(to, a); return a + Math.max(-max, Math.min(max, d)); };

function spawnMakora() {
  const x = W / 2, y = Math.min(playH || H, H) * 0.32, hp = Math.round(MAKORA.hp * runK('hp') * bossHpMul(false));   // tougher in co-op, for a strong run (flow.js), and each run (its own: runK)
  const m = {
    makora: true, type: 'makora', shape: 'makora', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: MAKORA.r, size: MAKORA.r,
    hp, maxHp: hp, dmg: mDmg(null, MAKORA.touch), hit: 0, born: 0, speed: MAKORA.walk,
    state: 'rest', t: 1.1, cd: 0.6, aim: Math.PI / 2, face: 1, step: 0, anim: 0, act: null, plan: [],
    phase: 0, run: runNo(), glow: 0, rockCd: 3, laserCd: 4, rifted: false, down: false,
  };
  sizeMakora(m);
  game.enemies = [m];
  game.makora = m;
  if (!game.makoraAdapted) game.makoraAdapted = new Map();
  renderMakoraBar();
}

// Its scale: growing in as it arrives, and a little bigger each run. The drawing and the hitbox both follow it.
const makoraUnit = m => ((m.size || MAKORA.r) * (0.5 + 0.5 * (m.born ?? 1)) * Math.min(MAKORA.growMax, 1 + MAKORA.grow * ((m.run || 1) - 1))) / 30;
function sizeMakora(m) {
  const u = makoraUnit(m), c = MAKORA.hit.cap;
  m.parts = null;                                    // (v0.69: a capsule; the old drawing's hitboxes don't fit the 3D one)
  m.r = MAKORA.hit.r * u;
  m.cap = [c[0] * u, c[1] * u, c[2] * u, c[3] * u];
}
// How much of a hit it takes from this weapon: less from one it adapted to (MAKORA.adapt, once per time).
const adaptMul = card => MAKORA.adapt ** (game.makoraAdapted?.get?.(card) || 0);

/* ---------- its moves ---------- */
// Hits whoever (co-op: each living player) `test` says is in it, unless a dash or a shield keeps them out.
function mHurt(test, dmg, name, push = 0, from = null) {
  eachLiving(() => {
    const p = game.player;
    if (!test(p)) return;
    if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
    p.flash = 0.25;
    if (push && from) { const a = Math.atan2(p.y - from.y, p.x - from.x); p.kx = (p.kx || 0) + Math.cos(a) * push; p.ky = (p.ky || 0) + Math.sin(a) * push; }
    hurtPlayer(dmg, name);
  });
}
function inCone(cx, cy, a, arc, range, p) {
  const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
  return d <= range + PLAYER.r && Math.abs(angDiff(Math.atan2(dy, dx), a)) <= arc / 2 + Math.atan2(PLAYER.r, Math.max(d, 1));
}
function inLane(x0, y0, a, len, w, p, from = 0) {
  const ux = Math.cos(a), uy = Math.sin(a), dx = p.x - x0, dy = p.y - y0, along = dx * ux + dy * uy;
  return along >= from - PLAYER.r && along <= len + PLAYER.r && Math.abs(-dx * uy + dy * ux) <= w / 2 + PLAYER.r;
}
const inCircle = (x, y, r, p) => Math.hypot(p.x - x, p.y - y) <= r + PLAYER.r;

// One frame of MAKORA (combat.js calls this instead of the normal chase; `game.player` is who it's after).
function moveMakora(m, dt) {
  if (m.down) { dieStep(m, dt); return; }
  const p = game.player, dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1, toward = Math.atan2(dy, dx);
  const decay = Math.exp(-6 * dt);
  m.kx *= decay; m.ky *= decay;
  m.t -= dt; m.anim += dt; m.cd -= dt; m.rockCd -= dt; m.laserCd -= dt;
  m.glow += ((m.phase >= 2 ? 1 : 0) - m.glow) * Math.min(1, dt * 2);   // phase 3: it glows from now on
  if (!game.practice) {                              // its phases, by the HP it has left (not in the Archives)
    const f = m.hp / m.maxHp;
    if (m.phase === 0 && f <= MAKORA.phases[0]) { m.phase = 1; m.wantRoar = true; }
    if (m.phase === 1 && f <= MAKORA.phases[1] && !m.rifted) m.wantRift = true;
  }
  m.vx = m.kx; m.vy = m.ky;
  if (m.state === 'walk') {                          // a heavy walk at you
    m.aim = turnTo(m.aim, toward, MAKORA.turn * 1.5 * dt);
    const speed = MAKORA.walk * (1 + MAKORA.walkPhase * m.phase) * (1 + 0.06 * (runNo() - 1));
    if (d > 70) { m.vx += (dx / d) * speed; m.vy += (dy / d) * speed; }
    m.step += dt * 6 * (speed / MAKORA.walk);
    if (m.wantRoar || m.wantRift || m.cd <= 0) decide(m, d);
  } else if (m.state === 'rest') {
    m.aim = turnTo(m.aim, toward, MAKORA.turn * dt);
    if (m.t <= 0) {
      if (m.wantRoar || m.wantRift || m.plan.length) next(m);
      else { m.state = 'walk'; m.cd = between(MAKORA.cd) * quick(m); }
    }
  } else if (m.act) {
    m.act.t += dt;
    ACTS[m.act.kind](m, m.act, dt, toward, d);
  }
  m.face = Math.cos(m.aim) < 0 ? -1 : 1;
  m.x += m.vx * dt; m.y += m.vy * dt;
  const pad = 30;                                    // it stays in the arena
  m.x = Math.min(W - pad, Math.max(pad, m.x)); m.y = Math.min((playH || H) - pad, Math.max(pad + 40, m.y));
}
function toRest(m, t = MAKORA.rest) { m.act = null; m.state = 'rest'; m.t = t * quick(m); }
// What next: a roar or the rift if one is due, or a new plan of moves for where you are.
function decide(m, d) {
  if (m.wantRoar || m.wantRift) { next(m); return; }
  const P = m.phase, r = Math.random(), S = MAKORA.slam;
  let plan;
  if (P >= 1 && m.laserCd <= 0 && r < (P >= 2 ? 0.38 : 0.3)) plan = ['laser'];
  else if (m.rockCd <= 0 && (d > 380 ? r < 0.75 : d < S.r * 0.9 && r < 0.3)) plan = ['slam'];   // far off, or you're hugging it
  else if (d > MAKORA.dash.min) plan = ['dash', ...combo(m)];
  else plan = combo(m);
  m.plan = plan;
  next(m);
}
// A combo: 1 to `combo` hits, slashes and stabs, small to big (the last is the biggest), and from phase 2 it can end
// in a slam or the lasers.
function combo(m) {
  const most = Math.min(6, MAKORA.combo[m.phase] + Math.floor((runNo() - 1) / 3));
  const n = 1 + Math.floor(Math.random() ** 0.8 * most);
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? Math.random() : i / (n - 1), size = k < 0.34 ? 'S' : k < 0.67 ? 'M' : 'L';
    out.push((Math.random() < 0.55 ? 'slash' : 'stab') + size);
  }
  if (m.phase >= 1 && Math.random() < 0.3) {
    if (m.rockCd <= 0 && Math.random() < 0.6) out.push('slam');
    else if (m.laserCd <= 0) out.push('laser');
  }
  return out;
}
// Starts the next move: the roar or the rift if due (a combo stops for them), else the plan's next, else a rest.
function next(m) {
  if (m.wantRoar) { m.wantRoar = false; m.plan = []; return mStartAct(m, 'roar'); }
  if (m.wantRift) { m.wantRift = false; m.plan = []; return mStartAct(m, 'rift'); }
  const k = m.plan.shift();
  if (!k) return toRest(m);
  const first = !m.inCombo;
  m.inCombo = m.plan.length > 0;
  if (k.startsWith('slash') || k.startsWith('stab')) mStartAct(m, k.slice(0, -1), { size: k.slice(-1), first });
  else mStartAct(m, k);
}
function mStartAct(m, kind, o = {}) {
  const p = game.player;
  m.state = kind; m.inCombo = m.plan.length > 0;
  m.act = { kind, t: 0, a: Math.atan2(p.y - m.y, p.x - m.x), ...o };
  m.aim = m.act.a;
  const A = m.act, q = quick(m);
  if (kind === 'slash' || kind === 'stab') A.tele = MAKORA[kind][A.size].tele * q * (A.first === false ? MAKORA.follow : 1);
  else if (kind === 'dash') { A.tele = MAKORA.dash.wind * q; A.went = 0; SFX.growl(); }
  else if (kind === 'slam') { A.ph = 'slam'; A.tele = MAKORA.slam.tele * q; SFX.growl(); }
  else if (kind === 'laser') startLaser(m, A);
  else if (kind === 'rift') startRift(m, A);
  else if (kind === 'roar') { A.tele = 0.25; }
  else if (kind === 'fetch') { A.ph = 'run'; }
}
// Keeps turning to follow you for the first part of a warning (more in later phases), then locks.
function mTrack(m, A, toward, dt) {
  if (A.t < A.tele * MAKORA.track[m.phase]) A.a = turnTo(A.a, toward, MAKORA.turn * dt);
  m.aim = A.a;
}
const ACTS = {
  // the dash: it crouches (a dashed line shows where), then shoots in, and the combo starts as it arrives
  dash(m, A, dt, toward, d) {
    const D = MAKORA.dash;
    if (A.t < A.tele) { A.a = turnTo(A.a, toward, MAKORA.turn * 2 * dt); m.aim = A.a; return; }
    if (!A.go) { A.go = true; SFX.bullDash(); }
    const v = D.speed * (1 + 0.1 * m.phase);
    m.vx += Math.cos(A.a) * v; m.vy += Math.sin(A.a) * v; A.went += v * dt;
    m.step += dt * 30;
    if (!reducedMotion && Math.random() < 0.8) game.particles.push({ x: m.x - Math.cos(A.a) * m.r, y: m.y + m.r * 0.9, vx: -Math.cos(A.a) * 120, vy: -25 * Math.random(), life: 0.35, color: COL.rock });
    if (A.went >= D.max || d < D.stop) { m.inCombo = true; next(m); }
  },
  // the slash: a red cone while it winds up, then the cut, stepping into it
  slash(m, A, dt, toward) {
    const S = MAKORA.slash[A.size];
    if (!A.struck) { mTrack(m, A, toward, dt); if (A.t >= A.tele) { A.struck = true; slashHit(m, A, S); } return; }
    const u = A.t - A.tele;
    if (u < S.anim) { m.vx += Math.cos(A.a) * S.step / S.anim; m.vy += Math.sin(A.a) * S.step / S.anim; }
    if (u >= S.anim + 0.06) next(m);
  },
  // the stab: a red lane, then it thrusts down it, lunging
  stab(m, A, dt, toward) {
    const S = MAKORA.stab[A.size];
    if (!A.struck) { mTrack(m, A, toward, dt); if (A.t >= A.tele) { A.struck = true; A.x0 = m.x; A.y0 = m.y; stabHit(m, A, S); } return; }
    const u = A.t - A.tele;
    if (u < S.anim) { m.vx += Math.cos(A.a) * S.lunge / S.anim; m.vy += Math.sin(A.a) * S.lunge / S.anim; }
    if (u >= S.anim + 0.1) next(m);
  },
  // the slam, the rock coming up, lifting it, aiming (fast), the throw; then waiting to see if it lands
  slam(m, A, dt, toward) {
    const S = MAKORA.slam, q = quick(m);
    if (A.ph === 'slam') {
      m.aim = turnTo(m.aim, toward, MAKORA.turn * dt);
      if (A.t >= A.tele) { slamHit(m); A.ph = 'lift'; A.t = 0; A.a = m.aim; }
    } else if (A.ph === 'lift') {
      if (A.t >= S.lift * q) { A.ph = 'aim'; A.t = 0; A.a = toward; A.tele = S.aim * q; }
    } else if (A.ph === 'aim') {
      if (A.t < A.tele * S.lock) A.a = turnTo(A.a, toward, MAKORA.turn * 1.6 * dt);
      m.aim = A.a;
      if (A.t >= A.tele) { throwRock(m, A); A.ph = 'throw'; A.t = 0; }
    } else if (A.ph === 'throw') {
      if (A.t < 0.3) return;
      const k = game.mrocks.find(k => k.id === A.rock);
      if (k && k.mode === 'fly') return;             // still flying
      m.rockCd = between(S.cd) * q;
      if (k && k.mode === 'ground') { m.plan = []; mStartAct(m, 'fetch', { rock: k.id }); }   // you dodged it: it goes and gets it
      else next(m);
    }
  },
  // it dashes to its rock, picks it up, holds it up while it picks its spot near you (a red circle), and lobs it
  fetch(m, A, dt, toward) {
    const F = MAKORA.fetch, q = quick(m), k = game.mrocks.find(k => k.id === A.rock);
    if (!k) { next(m); return; }
    if (A.ph === 'run') {
      const dx = k.x - m.x, dy = k.y - m.y - 30, dd = Math.hypot(dx, dy) || 1;
      m.aim = Math.atan2(dy, dx);
      const v = F.speed * (1 + 0.08 * m.phase);
      if (dd < 34 || A.t > 1.6) { A.ph = 'grab'; A.t = 0; k.mode = 'held'; SFX.kickStomp(); burst(k.x, k.y, COL.rock, 12, 200); return; }
      m.vx += dx / dd * Math.min(v, dd / dt); m.vy += dy / dd * Math.min(v, dd / dt);
      m.step += dt * 26;
    } else if (A.ph === 'grab') {
      m.aim = turnTo(m.aim, toward, MAKORA.turn * dt);
      if (A.t >= F.grab * q) {                         // up over its head; the spot it picks, near you
        const p = game.player, a = Math.random() * TAU, r = Math.random() * F.near;
        A.ph = 'hold'; A.t = 0; A.tx = p.x + Math.cos(a) * r; A.ty = p.y + Math.sin(a) * r;
        Object.assign(k, { mode: 'aimed', tx: A.tx, ty: A.ty });
      }
    } else if (A.ph === 'hold') {
      m.aim = Math.atan2(A.ty - m.y, A.tx - m.x);
      if (A.t >= F.hold * q) { lobRock(m, k, A); A.ph = 'throw'; A.t = 0; }
    } else if (A.t >= 0.32) next(m);
  },
  laser(m, A, dt) { laserStep(m, A, dt); },
  rift(m, A, dt) { riftStep(m, A, dt); },
  // a roar as a new phase begins: it shoves you back
  roar(m, A) {
    const R = MAKORA.roar;
    if (!A.done && A.t >= A.tele) {
      A.done = true;
      SFX.enrage(); game.shake = Math.max(game.shake, 0.4);
      game.rings.push({ x: m.x, y: m.y, r: m.r, max: R.r * 1.6, life: 0.55, color: COL.wheel });
      game.rings.push({ x: m.x, y: m.y, r: m.r * 0.6, max: R.r, life: 0.4, color: COL.bad });
      eachLiving(() => { const p = game.player; if (inCircle(m.x, m.y, R.r, p)) { const a = Math.atan2(p.y - m.y, p.x - m.x); p.kx = (p.kx || 0) + Math.cos(a) * R.push; p.ky = (p.ky || 0) + Math.sin(a) * R.push; } });
      const text = m.phase >= 2 ? 'MAKORA IS ENRAGED' : 'MAKORA GROWS STRONGER';
      game.floaters.push({ x: m.x, y: m.y - m.r - 60, text, color: m.phase >= 2 ? COL.bad : COL.wheel, life: 1.8, vy: -14, big: true });
      renderMakoraBar();
    }
    if (A.t >= MAKORA.roar.time) toRest(m, 0.25);
  },
};

function slashHit(m, A, S) {
  SFX.slice(A.size === 'L' ? 'cleave' : A.size === 'M' ? 'sweep' : 'cross');
  if (A.size === 'L') SFX.punch();
  game.shake = Math.max(game.shake, A.size === 'L' ? 0.3 : 0.1);
  mHurt(p => inCone(m.x, m.y, A.a, S.arc, S.range, p), mDmg(m, S.dmg), 'MAKORA slash');
}
function stabHit(m, A, S) {
  SFX.slice('cleave'); SFX.kick();
  game.shake = Math.max(game.shake, A.size === 'L' ? 0.25 : 0.1);
  mHurt(p => inLane(A.x0, A.y0, A.a, S.len, S.w, p, -m.r * 0.3), mDmg(m, S.dmg), 'MAKORA stab', 220, { x: A.x0, y: A.y0 });
}
// The slam: hurts and throws back whoever's in its ring, and a rock bursts up out of the ground in front of it.
function slamHit(m) {
  const S = MAKORA.slam;
  SFX.stomp(3); SFX.kickStomp();
  game.shake = Math.max(game.shake, 0.4);
  game.rings.push({ x: m.x, y: m.y + m.r * 0.4, r: 10, max: S.r * 1.15, life: 0.45, color: COL.rock });
  burst(m.x, m.y + m.r * 0.4, COL.rock, 26, 320);
  groundBreak(m.x, m.y + m.r * 0.5, 30);
  mHurt(p => inCircle(m.x, m.y, S.r, p), mDmg(m, S.dmg), 'MAKORA slam', S.knock, m);
}
// The throw: the rock flies at you down its lane, fast, as far as `range`.
let rockN = 0;
function throwRock(m, A) {
  const S = MAKORA.slam, v = S.speed * (1 + 0.06 * m.phase + 0.05 * (runNo() - 1));
  const x = m.x + Math.cos(A.a) * m.r * 0.8, y = m.y + Math.sin(A.a) * m.r * 0.8 - 10;
  A.rock = ++rockN;
  game.mrocks.push({
    mrock: true, type: 'mrock', id: A.rock, mode: 'fly', x, y, x0: x, y0: y, vx: Math.cos(A.a) * v, vy: Math.sin(A.a) * v, kx: 0, ky: 0,
    r: S.rock, dmg: mDmg(m, S.rockDmg), hit: 0, born: 1, t: 0, spin: Math.random() * TAU, seed: Math.floor(Math.random() * 1000), h: 30,
  });
  SFX.kick();
  game.shake = Math.max(game.shake, 0.22);
}
// The lob, back at the spot it picked near you: an arc of `flight` s.
function lobRock(m, k, A) {
  const F = MAKORA.fetch;
  Object.assign(k, { mode: 'lob', x0: m.x, y0: m.y - 10, x: m.x, y: m.y, t: 0, T: F.flight * Math.max(0.8, quick(m)), dmg: mDmg(m, F.dmg) });
  SFX.kick();
}
// One frame of the rock (combat.js): flying (it hits you, or lands at the end of its throw), lying there, held,
// or lobbed (it lands in a blast where the red circle is). Mirrored by DEFLECT, it blows up on MAKORA.
function moveKickRock(k, dt) {
  k.t += dt;
  const m = game.makora;
  if (k.mode === 'lob') {
    const u = Math.min(1, k.t / k.T);
    k.x = k.x0 + (k.tx - k.x0) * u; k.y = k.y0 + (k.ty - k.y0) * u;
    k.h = Math.sin(Math.PI * u) * MAKORA.fetch.h * Math.min(1, Math.hypot(k.tx - k.x0, k.ty - k.y0) / 300 + 0.4);
    k.spin += dt * 6;
    if (u >= 1) lobLand(k);
    return;
  }
  if (k.mode === 'held' || k.mode === 'aimed') {      // in its hands (the drawing puts it there)
    if (!m || m.down) k.gone = true;
    else { k.x = m.x; k.y = m.y - 2; }
    return;
  }
  if (k.mode === 'ground') { if (!m || m.down) k.gone = true; return; }
  // flying
  k.spin += dt * Math.hypot(k.vx, k.vy) / k.r * 0.5;
  k.x += k.vx * dt; k.y += k.vy * dt;
  if (!reducedMotion && Math.random() < 0.5) game.particles.push({ x: k.x - k.vx * 0.05, y: k.y + k.r * 0.6, vx: -k.vx * 0.1, vy: -20 * Math.random(), life: 0.3, color: COL.rock });
  if (k.back) {                                      // mirrored by DEFLECT: it blows up on MAKORA
    if (k.x < -k.r * 2 || k.y < -k.r * 2 || k.x > W + k.r * 2 || k.y > H + k.r * 2) { k.gone = true; return; }
    if (m && !m.down && hitGap(m, k.x, k.y) < k.r) rockBlast(k);
    return;
  }
  const far = Math.hypot(k.x - k.x0, k.y - k.y0) >= MAKORA.slam.range;
  const wall = k.x < k.r || k.y < k.r + 20 || k.x > W - k.r || k.y > (playH || H) - k.r;
  if (far || wall) {                                 // it reached the end of its throw: it lands and sticks in the ground
    k.x = Math.min(W - k.r, Math.max(k.r, k.x)); k.y = Math.min((playH || H) - k.r, Math.max(k.r + 20, k.y));
    Object.assign(k, { mode: 'ground', vx: 0, vy: 0, h: 0 });
    SFX.stomp(1); game.shake = Math.max(game.shake, 0.15);
    burst(k.x, k.y, COL.rock, 16, 200); groundBreak(k.x, k.y + k.r * 0.4, 18);
    return;
  }
  let hitP = null;
  eachLiving(c => { if (!hitP && Math.hypot(k.x - game.player.x, k.y - game.player.y) < k.r + PLAYER.r) hitP = c || true; });
  if (!hitP) return;
  if (NET.run && hitP !== true) usePlayer(hitP);
  const p = game.player;
  if (!(game.shield > 0 || game.dash) && deflectHit()) {   // DEFLECT (v0.52, user): it goes straight back at MAKORA
    const a = m ? Math.atan2(m.y - k.y, m.x - k.x) : Math.atan2(-k.vy, -k.vx), v = Math.hypot(k.vx, k.vy) * DEFLECT.mirror.speed * 0.6;
    Object.assign(k, { back: true, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    return;
  }
  k.gone = true;                                     // it hits you, and shatters
  burst(k.x, k.y, COL.rock, 26, 280);
  game.shake = Math.max(game.shake, 0.3);
  SFX.stomp(2);
  if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
  p.flash = 0.25;
  const a = Math.atan2(k.vy, k.vx);
  p.kx = (p.kx || 0) + Math.cos(a) * MAKORA.slam.rockKnock; p.ky = (p.ky || 0) + Math.sin(a) * MAKORA.slam.rockKnock;
  hurtPlayer(k.dmg, 'MAKORA rock');
}
// The lobbed rock lands: it breaks into the ground, hurting whoever's in the circle.
function lobLand(k) {
  const F = MAKORA.fetch;
  k.gone = true;
  SFX.rockBlast();
  game.shake = Math.max(game.shake, 0.45);
  game.rings.push({ x: k.x, y: k.y, r: 10, max: F.r * 1.2, life: 0.45, color: COL.rock });
  game.rings.push({ x: k.x, y: k.y, r: 6, max: F.r * 0.8, life: 0.3, color: COL.wheelHi });
  burst(k.x, k.y, COL.rock, 34, 340);
  groundBreak(k.x, k.y, 34);
  mHurt(p => inCircle(k.x, k.y, F.r, p), k.dmg, 'MAKORA rock', 360, k);
}
// It blows up (DEFLECT sent it back into MAKORA): it takes a share of its max HP.
function rockBlast(k) {
  const m = game.makora;
  k.dead = true;
  SFX.rockBlast();
  game.shake = Math.max(game.shake, 0.35);
  game.rings.push({ x: k.x, y: k.y, r: 10, max: 130, life: 0.4, color: COL.relic });
  burst(k.x, k.y, COL.relic, 22, 340);
  burst(k.x, k.y, COL.rock, 30, 300);
  if (!m || m.down || game.cine) return;
  hitEnemy({ card: 'deflect', dmg: Math.ceil(m.maxHp * 0.04), knock: 200, vx: k.vx, vy: k.vy, x: k.x, y: k.y, noCrit: true }, m);
}
function clearKickRocks() { game.mrocks = []; }

// The lasers (phase 2 on): it glows and floats up, then fires one of two patterns.
//  - spokes: beams out all round it like its wheel's spokes, a thin red line first; each volley turned half a
//    spoke from the one before, so the gap you stood in gets hit next;
//  - pillars: light comes down on you, one pillar after another, each where you're heading (a red circle first).
function startLaser(m, A) {
  const L = MAKORA.laser, q = quick(m), P = m.phase;
  A.glowT = L.glow * q;
  A.pat = Math.random() < 0.5 ? 'spokes' : 'pillars';
  m.laserCd = between(L.cd) * q;
  SFX.mkCharge();
  if (A.pat === 'spokes') {
    const S = L.spokes, warn = Math.max(0.55, S.warn * q), n = S.volleys[P] + (runNo() >= 4 ? 1 : 0);
    let a0 = A.a + (Math.random() < 0.5 ? 0 : Math.PI / S.n);
    A.vol = [];
    for (let i = 0; i < n; i++) { A.vol.push({ a: a0, at: A.glowT + i * (warn + S.fire + S.gap), warn }); a0 += Math.PI / S.n; }
    A.end = A.vol[n - 1].at + warn + S.fire + 0.35;
  } else {
    const S = L.pillars, n = S.n[P] + Math.floor((runNo() - 1) / 2);
    A.pills = []; A.left = n; A.every = S.every * Math.max(0.75, q); A.nextAt = A.glowT;
    A.end = A.glowT + n * A.every + S.warn + S.glow + 0.3;
  }
}
function laserStep(m, A, dt) {
  const L = MAKORA.laser;
  m.vx *= 0.2; m.vy *= 0.2;
  if (A.pat === 'spokes') {
    const S = L.spokes;
    for (const v of A.vol) {
      const on = A.t >= v.at + v.warn && A.t < v.at + v.warn + S.fire;
      if (on && !v.fired) { v.fired = true; SFX.mkBeam(); game.shake = Math.max(game.shake, 0.18); }
      if (on) for (let i = 0; i < S.n; i++) {
        const a = v.a + i * TAU / S.n;
        mHurt(p => inLane(m.x, m.y, a, L.len, L.w, p, m.r * 0.3), mDmg(m, L.dmg), 'MAKORA laser');
      }
    }
  } else {
    const S = L.pillars, p = game.player;
    if (A.left > 0 && A.t >= A.nextAt) {             // the next one: where you're heading
      A.left--; A.nextAt += A.every;
      const vx = (p.x - (p.px ?? p.x)) / Math.max(dt, 1e-3), vy = (p.y - (p.py ?? p.y)) / Math.max(dt, 1e-3);
      const lead = Math.hypot(vx, vy) > 20 ? S.lead : 0;
      A.pills.push({ x: Math.min(W - 20, Math.max(20, p.x + vx * lead)), y: Math.min((playH || H) - 20, Math.max(20, p.y + vy * lead)), t: 0 });
      SFX.mkPillarWarn();
    }
    for (const c of A.pills) {
      c.t += dt;
      if (!c.struck && c.t >= S.warn) {
        c.struck = true;
        SFX.mkPillar(); game.shake = Math.max(game.shake, 0.14);
        game.rings.push({ x: c.x, y: c.y, r: 6, max: S.r * 1.3, life: 0.35, color: COL.wheelHi });
        burst(c.x, c.y, COL.wheelHi, 14, 260);
        mHurt(p => inCircle(c.x, c.y, S.r, p), mDmg(m, S.dmg), 'MAKORA laser');
      }
    }
  }
  if (A.t >= A.end) { A.pills = []; next(m); }
}

// The rift (once, at MAKORA.phases[1]): it leaps to the middle, slices space and time open, and kneels to heal while
// enemies come through the rifts at you. Hurt it enough and the heal breaks off. Then phase 3.
function startRift(m, A) {
  const R = MAKORA.rift;
  m.rifted = true;
  Object.assign(A, { ph: 'leap', x0: m.x, y0: m.y, tx: W / 2, ty: Math.min(playH || H, H) * 0.42, h: 0, rifts: [], healed: 0 });
  m.state = 'jump';                                  // (combat.js: no touch damage while it's in the air)
  SFX.growl(); SFX.whoosh?.();
  game.floaters.push({ x: m.x, y: m.y - m.r - 50, text: 'MAKORA TEARS OPEN SPACE AND TIME', color: COL.rift, life: 2, vy: -12, big: true });
}
function riftStep(m, A, dt) {
  const R = MAKORA.rift;
  m.vx = 0; m.vy = 0;
  if (A.ph === 'leap') {
    const u = Math.min(1, A.t / R.leap), e = u * u * (3 - 2 * u);
    m.x = A.x0 + (A.tx - A.x0) * e; m.y = A.y0 + (A.ty - A.y0) * e; A.h = Math.sin(Math.PI * u) * 160;
    if (u >= 1) {
      A.ph = 'tear'; A.t = 0; A.h = 0; m.state = 'rift';
      SFX.stomp(3); game.shake = Math.max(game.shake, 0.45);
      game.rings.push({ x: m.x, y: m.y + m.r * 0.4, r: 10, max: R.land.r * 1.2, life: 0.45, color: COL.rift });
      groundBreak(m.x, m.y + m.r * 0.5, 30);
      mHurt(p => inCircle(m.x, m.y, R.land.r, p), mDmg(m, R.land.dmg), 'MAKORA slam', 420, m);
    }
  } else if (A.ph === 'tear') {
    if (!A.cut1 && A.t >= R.tear * 0.3) { A.cut1 = true; SFX.slice('cross'); }
    if (!A.cut2 && A.t >= R.tear * 0.6) { A.cut2 = true; SFX.slice('cleave'); }
    if (A.t >= R.tear) { A.ph = 'channel'; A.t = 0; A.hp0 = m.hp; openRifts(m, A); }
  } else if (A.ph === 'channel') {
    const heal = Math.min(R.heal * m.maxHp * dt / R.time, R.heal * m.maxHp - A.healed);
    if (heal > 0) { m.hp = Math.min(m.maxHp, m.hp + heal); A.healed += heal; renderMakoraBar(); }
    if (!reducedMotion && Math.random() < 0.5) game.particles.push({ x: m.x + (Math.random() - 0.5) * m.r * 1.6, y: m.y + m.r * 0.5, vx: 0, vy: -90 - Math.random() * 80, life: 0.7, color: COL.hp });
    for (const r of A.rifts) {                       // enemies come through
      r.t += dt;
      if (r.left > 0 && r.t >= r.next) { r.left--; r.next += R.every; riftSpawn(r); }
    }
    const taken = A.hp0 + A.healed - m.hp;
    if (taken >= R.break * m.maxHp) {                // hurt enough: the heal breaks off
      A.ph = 'broken'; A.t = 0;
      SFX.shatter(); game.shake = Math.max(game.shake, 0.3);
      game.floaters.push({ x: m.x, y: m.y - m.r - 40, text: 'HEALING BROKEN!', color: COL.wheelHi, life: 1.6, vy: -20, big: true });
      game.rings.push({ x: m.x, y: m.y, r: m.r, max: m.r * 3, life: 0.5, color: COL.wheelHi });
    } else if (A.t >= R.time) { A.ph = 'close'; A.t = 0; }
  } else if (A.ph === 'broken' || A.ph === 'close') {
    if (A.t >= (A.ph === 'broken' ? R.broken : R.close)) { A.rifts = []; m.phase = 2; m.wantRoar = true; next(m); }
  }
}
// The rifts: around the middle, away from you, inside the arena.
function openRifts(m, A) {
  const R = MAKORA.rift, n = R.rifts + Math.min(2, Math.floor((runNo() - 1) / 2)), a0 = Math.random() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + i * TAU / n + (Math.random() - 0.5) * 0.5, d = between(R.ring);
    const x = Math.min(W - 60, Math.max(60, m.x + Math.cos(a) * d)), y = Math.min((playH || H) - 70, Math.max(90, m.y + Math.sin(a) * d * 0.8));
    A.rifts.push({ x, y, t: 0, next: R.first + i * 0.25, left: R.per });
    game.rings.push({ x, y, r: 6, max: 70, life: 0.4, color: COL.rift });
  }
  SFX.mkRift();
}
function riftSpawn(r) {
  const R = MAKORA.rift, u = UNITS[R.units[Math.floor(Math.random() * R.units.length)]];
  const e = makeEnemy(u.type, r.x + (Math.random() - 0.5) * 20, r.y + 10, !!u.split);
  if (u.boom) e.boom = true;
  e.born = 0.2; e.rift = true;
  game.enemies.push(e);
  aliveEl.textContent = game.enemies.length;
  burst(r.x, r.y, COL.rift, 10, 200);
}

/* ---------- its death, and the next run ---------- */
// Its HP ran out (combat.js asks before killing it): the weapon that did it is adapted to, it sinks to its knees,
// then the wheel turns and the run is cleared. (`card` is null when its own rock finished it.)
function makoraDown(m, card) {
  if (m.down) return;
  if (card && CARDS[card]) game.makoraAdapted.set(card, (game.makoraAdapted.get(card) || 0) + 1);
  Object.assign(m, { down: true, adaptedTo: card, hp: 0, dmg: 0, state: 'die', t: MAKORA.die, act: null, plan: [], vx: 0, vy: 0, kx: 0, ky: 0 });
  game.projectiles = []; game.mines = [];
  clearKickRocks();
  for (const e of game.enemies) if (e !== m) { burst(e.x, e.y, enemyCol(e), 8, 160); }   // what came through the rifts goes back
  game.enemies = [m];
  aliveEl.textContent = 0;
  game.hitstop = Math.max(game.hitstop || 0, 0.2);
  game.shake = Math.max(game.shake, 0.5);
  SFX.makoraRoar();
  game.rings.push({ x: m.x, y: m.y, r: m.r, max: m.r * 4, life: 0.7, color: COL.wheel });
  renderMakoraBar();
}
function dieStep(m, dt) {
  m.t -= dt; m.anim += dt;
  if (!reducedMotion && Math.random() < 0.6) {
    const a = Math.random() * TAU;
    game.particles.push({ x: m.x + Math.cos(a) * m.r * 0.6, y: m.y + Math.sin(a) * m.r * 0.4, vx: Math.cos(a) * 40, vy: -60 - Math.random() * 120, life: 0.8, color: Math.random() < 0.5 ? COL.wheel : COL.wheelHi });
  }
  if (m.t > 0) return;
  runCleared(m);
}
// The wheel turns: gold for it (10, doubling each run), the black screen, RUN N CLEARED, then the run's stats.
function runCleared(m) {
  const run = runNo(), f = game.flow, final = run >= MAKORA.last;
  game.wheelSpins = run;
  const gold = GOLD_BONUS.makora * 2 ** (run - 1);
  game.wheelGold = (game.wheelGold || 0) + gold;
  bonusGold(`WHEEL ${run}`, gold);
  if (!f.beaten.includes('makora')) f.beaten.push('makora');
  f.state = 'cleared';
  game.cine = { kind: 'clear', t: 0, step: 0, run, final };
  showClearScene(game.cine);
}
// The black screen for it (a co-op guest plays just this; the host runs the rest).
function showClearScene(c) {
  cineEl.className = 'cine';
  line('');
  cineWheel.hidden = true;
  cineSkip.hidden = true;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');
  SFX.kill(true);
}
// The stats over the black screen, with Continue (the next run) or End run (menus.js renderRunStats does the rest).
function showRunCleared(c) {
  game.cleared = { run: c.run, final: c.final };
  renderRunStats();
  runClearPanel(true);
}
// Continue: back to stage 1 as the next run. You keep your level, upgrades, deck and HP's upgrades (healed to full).
function nextRun() {
  if (NET.guest && NET.run) return;
  if (NET.host && NET.run) coopEvent({ e: 'nextRun' });
  const f = game.flow;
  game.cleared = null;
  runClearPanel(false);
  f.run = (f.run || 1) + 1;
  Object.assign(f, { stage: 0, t: 0, wave: -1, huge: false, state: 'swarm', beaten: [], sweep: 0, dmg: [], boost: 1, tough: null, test: null, mixes: [], recent: [] });   // (mixes: flow.js runMix, fresh each run)
  game.runMark = { t: game.runT || 0, kills: game.kills, dealt: totalDealt() };
  game.enemies = []; game.projectiles = []; game.mrocks = []; game.mines = []; game.rocks = []; game.cracks = [];
  game.started = false; game.spawnTimer = 0;
  resetMakora(true);
  eachPlayer(() => { const p = game.player; p.hp = maxHp(); p.safe = 1.2; });
  renderHp(false);
  endCine();
  resetZoom();
  Object.assign(game.player, { x: W / 2, y: H / 2 });
  renderFlow();
  toast(`RUN ${f.run} · THE SWARM GROWS STRONGER`, 'enrage');
  SFX.wheelLand();
}
const totalDealt = () => Object.values(game.tally?.dealt || {}).reduce((a, b) => a + b, 0);

/* ---------- its bar ---------- */
// MAKORA, the run it's on, its phase, and what it has adapted to.
function renderMakoraBar() {
  const m = game.makora;
  if (!m) return;
  bossBar.hidden = false;
  bossBar.classList.remove('is-phase2', 'is-obi');
  bossBar.classList.add('is-makora');
  bossBar.classList.toggle('is-enraged', (m.phase || 0) >= 2);
  bossFill.style.transform = `scaleX(${Math.max(0, m.hp) / m.maxHp})`;
  bossBar.setAttribute('aria-label', `${MAKORA.name} health`);
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(m.hp)));
  bossBar.setAttribute('aria-valuemax', m.maxHp);
  const run = m.run || runNo();
  bossBar.querySelector('.boss-name').textContent = `${MAKORA.name} · RUN ${run}` + ((m.phase || 0) >= 2 ? ' · ENRAGED' : '');
  const sub = bossBar.querySelector('.boss-sub');
  const list = [...(game.makoraAdapted || new Map())].map(([id, n]) => `${CARDS[id]?.name.toUpperCase() || id}${n > 1 ? ` ×${n}` : ''}`);
  sub.hidden = !list.length;
  sub.textContent = `Adapted to: ${list.join(', ')} (less damage)`;
}

// A new run resets everything; `keep` (the next run of the loop) keeps what it has adapted to.
function resetMakora(keep = false) {
  if (game.makora) clearKickRocks();
  game.makora = null; game.makoraDue = false; game.cine = null; game.cineHold = false;
  if (!keep) game.makoraAdapted = new Map();
  cineEl.hidden = true; cineEl.classList.remove('is-on');
  cineSkip.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-clunk');
  bossBar.hidden = true;
  bossBar.classList.remove('is-makora', 'is-enraged');
  bossBar.setAttribute('aria-label', 'SKURTOSAURUS health');
  const sub = bossBar.querySelector('.boss-sub');
  if (sub) sub.hidden = true;
}

/* ---------- drawing ----------
   Its warnings are flat red shapes on the ground, drawn here for both. MAKORA itself, its rock and its effects are
   3D (makora3d.js) once three.js is in; the flat drawing below is for until then, or if it can't load. */
function drawMakora(m) {
  drawMakoraWarnings(m);
  if (m3dOk()) { m3dDraw(m); return; }
  drawMakoraFlat(m);
}
function drawMakoraWarnings(m) {
  const A = m.act, q01 = x => Math.max(0, Math.min(1, x));
  if (!A || m.down) return;
  ctx.save();
  if (A.kind === 'slash' && !A.struck) {
    const S = MAKORA.slash[A.size];
    ctx.translate(m.x, m.y); ctx.rotate(A.a); warnCone(S.arc, S.range, q01(A.t / A.tele));
  } else if (A.kind === 'stab' && !A.struck) {
    const S = MAKORA.stab[A.size];
    ctx.translate(m.x, m.y); ctx.rotate(A.a); warnLane(S.len, S.w, q01(A.t / A.tele));
  } else if (A.kind === 'dash' && A.t < A.tele) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(A.t * 30);
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(A.a) * MAKORA.dash.max, m.y + Math.sin(A.a) * MAKORA.dash.max); ctx.stroke();
    ctx.setLineDash([]);
  } else if (A.kind === 'slam' && A.ph === 'slam') {
    warnCircle(m.x, m.y, MAKORA.slam.r, q01(A.t / A.tele));
  } else if (A.kind === 'slam' && A.ph === 'aim') {
    ctx.translate(m.x, m.y); ctx.rotate(A.a);
    warnLane(MAKORA.slam.range, MAKORA.slam.rock * 2, q01(A.t / A.tele), A.t >= A.tele * MAKORA.slam.lock);
  } else if (A.kind === 'rift' && A.ph === 'leap') {
    warnCircle(A.tx, A.ty, MAKORA.rift.land.r, q01(A.t / MAKORA.rift.leap));
  } else if (A.kind === 'laser') {
    const L = MAKORA.laser;
    if (A.pat === 'spokes') for (const v of A.vol) {
      if (A.t < v.at || A.t >= v.at + v.warn) continue;
      const q = (A.t - v.at) / v.warn;
      ctx.strokeStyle = COL.bad; ctx.lineCap = 'round';
      for (let i = 0; i < L.spokes.n; i++) {
        const a = v.a + i * TAU / L.spokes.n, x0 = m.x + Math.cos(a) * m.r * 0.3, y0 = m.y + Math.sin(a) * m.r * 0.3;
        ctx.globalAlpha = 0.18 + 0.2 * q; ctx.lineWidth = L.w * (0.4 + 0.6 * q);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(m.x + Math.cos(a) * L.len, m.y + Math.sin(a) * L.len); ctx.stroke();
        ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(m.x + Math.cos(a) * L.len * q, m.y + Math.sin(a) * L.len * q); ctx.stroke();
      }
    } else for (const c of A.pills || []) if (!c.struck) warnCircle(c.x, c.y, L.pillars.r, q01(c.t / L.pillars.warn));
  }
  ctx.restore(); ctx.globalAlpha = 1;
  // the lobbed rock's circle, filling as it comes down (and its shadow)
  for (const k of game.mrocks) {
    if (k.mode === 'aimed' || k.mode === 'lob') warnCircle(k.tx, k.ty, MAKORA.fetch.r, k.mode === 'lob' ? q01(k.t / k.T) : 0.05);
  }
}
// A red warning cone along +x (the caller has rotated to the aim): faint, filling, with its edge racing out.
function warnCone(arc, range, q) {
  ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.1 + 0.18 * q;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, -arc / 2, arc / 2); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.5 + 0.4 * q; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, range * q, -arc / 2, arc / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-arc / 2) * range, Math.sin(-arc / 2) * range);
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(arc / 2) * range, Math.sin(arc / 2) * range); ctx.stroke();
  ctx.globalAlpha = 1;
}
// … a lane along +x, filling from the start (solid edges once `locked`) …
function warnLane(len, w, q, locked = true) {
  ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.1 + 0.12 * q; ctx.fillRect(0, -w / 2, len, w);
  ctx.globalAlpha = 0.3 + 0.25 * q; ctx.fillRect(0, -w / 2, len * q, w);
  ctx.globalAlpha = 0.85; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
  if (!locked) ctx.setLineDash([12, 8]);
  ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(len, -w / 2); ctx.moveTo(0, w / 2); ctx.lineTo(len, w / 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}
// … and a circle on the ground, its inside filling up to the edge.
function warnCircle(x, y, r, q) {
  ctx.save();
  ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.12 + 0.1 * q;
  ctx.beginPath(); ctx.ellipse(x, y, r, r, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.ellipse(x, y, r * q, r * q, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.9; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, r, r, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

// The rock (draw.js, before the enemies): its shadow, and the flat rock when it isn't 3D.
function drawKickRock(k) {
  if (k.mode === 'held' || k.mode === 'aimed') return;   // (in MAKORA's hands: drawn with it)
  const h = k.h || 0;
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(k.x, k.y + k.r * 0.7, k.r * (1 - Math.min(0.5, h / 600)), k.r * 0.3); ctx.globalAlpha = 1;
  if (m3dOk()) return;
  if (k.mode === 'fly') {
    const a = Math.atan2(k.vy, k.vx);
    ctx.strokeStyle = COL.rock; ctx.globalAlpha = 0.3; ctx.lineWidth = k.r * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x - Math.cos(a) * 70, k.y - Math.sin(a) * 70); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawRockBody(k.x, k.y - h, k.r, k.spin, k.hit > 0 ? 1 : 0, k.seed);
}
// A big lumpy boulder: a dark outline, flat facets in two shades, cracks. `flash` whitens it when it's hit.
function drawRockBody(x, y, r, spin, flash, seed) {
  const n = 13, pts = [];                                   // lumpy: each corner pushed in or out a little (the same each frame)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (0.8 + 0.22 * (((i + 3) * (seed + 11) * 7919) % 97) / 96) * (1 + 0.08 * Math.sin(i * 2.3));
    pts.push([Math.cos(a) * rr * 1.08, Math.sin(a) * rr * 0.94]);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  path(); ctx.fillStyle = COL.rock; ctx.fill();
  ctx.save(); path(); ctx.clip();                            // a darker lower half and a pale facet on top
  ctx.fillStyle = COL.rockDark; ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.1); ctx.lineTo(r * 1.2, -r * 0.2); ctx.lineTo(r * 1.2, r * 1.2); ctx.lineTo(-r * 1.2, r * 1.2); ctx.fill();
  ctx.fillStyle = COL.rockHi; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(r * 0.2, -r * 0.85); ctx.lineTo(r * 0.05, -r * 0.35); ctx.lineTo(-r * 0.55, -r * 0.3); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COL.crack; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();                                          // cracks, and a couple of pits
  ctx.moveTo(-r * 0.15, -r * 0.2); ctx.lineTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.15, r * 0.5); ctx.moveTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.62, 0);
  ctx.moveTo(-r * 0.7, r * 0.1); ctx.lineTo(-r * 0.4, r * 0.3); ctx.lineTo(-r * 0.45, r * 0.6);
  ctx.stroke();
  ctx.fillStyle = COL.rockDark;
  for (const [px, py, pr] of [[-0.35, -0.45, 0.09], [0.45, 0.45, 0.07], [0.55, -0.35, 0.06]]) { ctx.beginPath(); ctx.arc(px * r, py * r, pr * r, 0, TAU); ctx.fill(); }
  path(); ctx.strokeStyle = COL.crack; ctx.lineWidth = Math.max(2, r * 0.09); ctx.stroke();
  if (flash) { path(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

// The flat MAKORA (v0.38's drawing, until three.js is in): its body in a pose for what it's doing, and its effects
// drawn flat.
function drawMakoraFlat(m) {
  const k = makoraUnit(m), t = m.anim, A = m.act, st = m.state, still = reducedMotion;
  const lerp = (a, b, x) => a + (b - a) * x;
  // the effects: the cut, the thrust, beams, pillars, rifts
  ctx.save();
  if (A && A.kind === 'slash' && A.struck) {
    const S = MAKORA.slash[A.size], q = Math.min(1, (A.t - A.tele) / S.anim);
    ctx.translate(m.x, m.y); ctx.rotate(A.a); ctx.globalAlpha = 1 - q; ctx.fillStyle = COL.blade;
    crescent(0, S.range * 0.8, -S.arc / 2, -S.arc / 2 + S.arc * Math.min(1, q * 2.2), A.size === 'L' ? 26 : 14);
  } else if (A && A.kind === 'stab' && A.struck) {
    const S = MAKORA.stab[A.size], q = Math.min(1, (A.t - A.tele) / S.anim);
    ctx.translate(A.x0, A.y0); ctx.rotate(A.a); ctx.globalAlpha = 1 - q * 0.8; ctx.fillStyle = COL.blade;
    ctx.fillRect(0, -S.w * 0.18, S.len * Math.min(1, q * 2), S.w * 0.36);
  } else if (A && A.kind === 'laser') {
    const L = MAKORA.laser;
    fxAdd(COL.wheelHi);
    if (A.pat === 'spokes') for (const v of A.vol) {
      if (!(A.t >= v.at + v.warn && A.t < v.at + v.warn + L.spokes.fire)) continue;
      for (let i = 0; i < L.spokes.n; i++) {
        const a = v.a + i * TAU / L.spokes.n;
        for (const [w, col] of [[L.w * 1.4, COL.wheel], [L.w * 0.45, '#fff']]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(a) * L.len, m.y + Math.sin(a) * L.len); ctx.stroke();
        }
      }
    } else for (const c of A.pills || []) if (c.struck && c.t < L.pillars.warn + L.pillars.glow) {
      ctx.globalAlpha = 1 - (c.t - L.pillars.warn) / L.pillars.glow; ctx.fillStyle = COL.wheelHi;
      ctx.fillRect(c.x - L.pillars.r * 0.5, c.y - 900, L.pillars.r, 900); circle(c.x, c.y, L.pillars.r);
    }
    fxNormal();
  } else if (A && A.kind === 'rift') for (const r of A.rifts) {
    const o = Math.min(1, r.t * 3);
    ctx.globalAlpha = 1; ctx.fillStyle = '#0a0410'; ctx.strokeStyle = COL.rift; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(r.x, r.y - 50, 18 * o, 56 * o, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
  const held = game.mrocks.find(k => k.mode === 'held' || k.mode === 'aimed') || (A?.kind === 'slam' && (A.ph === 'lift' || A.ph === 'aim'));
  // the pose, from the old drawing's knobs
  let lean = 0, crouch = 0, dA = -0.9, dB = 1.5, knife = 0.1, fA = 2.3, fB = -0.75, fFront = false;
  const breathe = still ? 0 : Math.sin(t * 2.4) * 0.8, stride = st === 'walk' ? Math.sin(m.step) * 0.5 : st === 'dash' ? 0.7 : 0;
  if (st === 'walk') { dA += Math.sin(m.step) * 0.1; fA -= Math.sin(m.step) * 0.12; crouch = Math.abs(Math.sin(m.step)) * 1.5; }
  else if (st === 'dash') { crouch = A.t < A.tele ? 5 : 2; lean = 0.3; dA = A.t < A.tele ? -2.4 : 0.1; dB = 0.1; }
  else if (st === 'slash' && A) {
    const q = A.struck ? Math.min(1, (A.t - A.tele) / MAKORA.slash[A.size].anim) : 0;
    if (!A.struck) { const w = Math.min(1, A.t / A.tele); dA = lerp(-0.9, -2.5, w); dB = lerp(1.5, -0.5, w); crouch = 4 * w; }
    else { dA = lerp(-2.5, 1.0, q); dB = lerp(-0.5, 0.3, q); lean = 0.18; crouch = 3; }
  } else if (st === 'stab' && A) {
    if (!A.struck) { crouch = 4; lean = -0.1; dA = 0.4; dB = 2.2; } else { dA = 0; dB = 0; knife = 0; lean = 0.25; crouch = 2; }
  } else if (held || st === 'laser' || st === 'roar') { dA = -2.6; dB = -0.3; fA = 3.6; fB = 0.3; crouch = 1; }
  else if (st === 'rift' || st === 'die') { crouch = 7; lean = 0.25; dA = 1.0; dB = 0.4; fA = 1.9; }
  const bs = cv.width / VW * viewZoom, B = Math.max(1, Math.round(2 * bs)), q = k * bs / B;
  const pw = Math.ceil(MK.w * q), ph = Math.ceil(MK.h * q);
  if (!(pw > 0 && ph > 0 && pw < 4096 && ph < 4096)) return;
  if (mkCv.width !== pw || mkCv.height !== ph) { mkCv.width = pw; mkCv.height = ph; }
  const c = mkx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, ph);
  c.setTransform(q * m.face, 0, 0, q, -MK.x0 * q, -MK.y0 * q);
  drawMakoraBody(c, m, { lean, crouch, dA, dB, knife, fA, fB, fFront, legN: null, footRot: 0, stride, breathe, t, still });
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (readbackOK()) {                                        // hard edges: every block is there or it isn't
    try {
      const img = c.getImageData(0, 0, pw, ph), d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
      c.putImageData(img, 0, 0);
    } catch (err) { readback.ok = false; }
  }
  if (m.hit > 0 || (m.phase >= 2 && Math.sin(t * 8) > 0.6)) {   // a hit flashes it pale (enraged: it flickers gold)
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = m.hit > 0 ? 0.6 : 0.25; c.fillStyle = m.hit > 0 ? '#fff' : COL.wheel;
    c.fillRect(0, 0, pw, ph);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  const lift = A?.kind === 'rift' && A.ph === 'leap' ? A.h || 0 : 0;
  ctx.save();
  if (m.down) ctx.globalAlpha = Math.max(0.2, m.t / MAKORA.die);
  ctx.globalAlpha *= 0.3; ctx.fillStyle = '#000'; ellipse(m.x, m.y + 34 * k, 36 * k, 7 * k); ctx.globalAlpha = m.down ? Math.max(0.2, m.t / MAKORA.die) : 1;
  const g = B / bs, x0 = Math.round((m.x + MK.x0 * k) / g) * g, y0 = Math.round((m.y - lift + MK.y0 * k) / g) * g;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mkCv, x0, y0, pw * g, ph * g);
  ctx.restore();
  if (held) {                                                // the rock over its head
    const kk = game.mrocks.find(k => k.mode === 'held' || k.mode === 'aimed');
    drawRockBody(m.x, m.y - 100 * k, MAKORA.slam.rock, kk ? kk.spin : 0, 0, kk ? kk.seed : 3);
  }
}

const MK = { x0: -100, y0: -112, w: 200, h: 170 };         // the box it's drawn in, in its units
// Can we read the canvas back as drawn? (v0.44, user: every browser.) Brave's fingerprinting protection, Firefox's
// resistFingerprinting and Safari's private browsing can add noise to a canvas read, or return blank or random pixels.
// A small noise is harmless here, but a blank or random read would make MAKORA a box of noise, so this draws a known
// pattern once and checks it comes back close. If not, MAKORA is drawn without the hard-edge pass (slightly soft
// edges; everything else is the same).
const readback = { ok: null };
function readbackOK() {
  if (readback.ok !== null) return readback.ok;
  try {
    const t = document.createElement('canvas'); t.width = 8; t.height = 2;
    const x = t.getContext('2d', { willReadFrequently: true });
    const want = [];
    for (let i = 0; i < 8; i++) { const v = [i * 32, 255 - i * 30, (i * 71) % 256]; want.push(v); x.fillStyle = `rgb(${v})`; x.fillRect(i, 0, 1, 1); }
    const d = x.getImageData(0, 0, 8, 2).data;
    let bad = 0;
    for (let i = 0; i < 8; i++) {
      const o = i * 4;
      if (d[o + 3] !== 255 || want[i].some((v, j) => Math.abs(d[o + j] - v) > 6)) bad++;
      if (d[(8 + i) * 4 + 3] > 6) bad++;                     // the second row was left empty: it must read back clear
    }
    readback.ok = bad === 0;
  } catch (err) { readback.ok = false; }
  return readback.ok;
}
const mkCv = document.createElement('canvas');
const mkx = mkCv.getContext('2d', { willReadFrequently: true });
// v0.38's drawing: a flat cartoon with a dark grey outline round every shape, seen from the front in a wide,
// bent-kneed stance, the golden eight-spoked wheel above. Local units: 30 = its radius, feet at y ≈ 34; it faces +x.
function drawMakoraBody(c, m, P) {
  const SK = COL.makora, SH = COL.makoraDark, OL = COL.makoraLine, LW = 1.3;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const trace = pts => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const ink = (col, lw = LW) => { c.fillStyle = col; c.fill(); c.strokeStyle = OL; c.lineWidth = lw; c.stroke(); };
  const shape = (col, path) => { c.beginPath(); path(); ink(col); };
  const lines = (w, segs, col = OL) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (const s of segs) { c.moveTo(s[0], s[1]); for (let i = 2; i < s.length; i += 2) c.lineTo(s[i], s[i + 1]); } c.stroke(); };
  const limb = (col, pts, ws) => {
    for (const [cc, extra] of [[OL, LW * 2], [col, 0]]) {
      c.strokeStyle = cc;
      for (let i = 1; i < pts.length; i++) { c.lineWidth = ws[i - 1] + extra; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
    }
  };
  const band = (x, y, a, w) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.roundRect(-2.6, -w / 2, 5.2, w, 2); ink(COL.makoraBand, 1); c.restore(); };
  const tuft = (x, y, a, len, wid, col) => {
    c.save(); c.translate(x, y); c.rotate(a);
    const top = [[0, -wid * 0.4]], bot = [];
    for (let i = 1; i < 7; i++) {
      const u = i / 7, env = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * 0.35);
      top.push([len * (u + 0.06), -wid * env * 1.15], [len * u, -wid * env * 0.55]);
      bot.unshift([len * u, wid * env * 0.45], [len * (u + 0.06), wid * env * 0.95]);
    }
    trace([...top, [len, 0], ...bot, [0, wid * 0.4]]); ink(col);
    c.restore();
  };
  const hipY = -20 + P.crouch + P.breathe * 0.3;
  const leg = sgn => {
    const hx = sgn * 10, hy = hipY + 2, sw = sgn * P.stride;
    const kn = [sgn * (25 + sw * 4), 2 - Math.max(0, sw) * 3], an = [sgn * (33 + sw * 7), 20 - Math.max(0, sw) * 4];
    limb(SK, [[hx, hy], kn, an], [13, 10]);
    const sa = Math.atan2(an[1] - kn[1], an[0] - kn[0]);
    shape(SK, () => { const fx = an[0] + sgn * 3, fy = an[1] + 7; c.moveTo(fx - sgn * 6, fy - 5); c.quadraticCurveTo(fx + sgn * 10, fy - 6, fx + sgn * 11, fy + 2); c.quadraticCurveTo(fx, fy + 5, fx - sgn * 7, fy + 3); c.closePath(); });
    band(an[0] - Math.cos(sa) * 3, an[1] - Math.sin(sa) * 3, sa, 13);
  };
  leg(-1); leg(1);
  c.save();
  c.translate(0, hipY); c.rotate(P.lean); c.translate(0, -hipY);
  c.translate(0, P.crouch);
  tuft(-2, -64, -2.1, 30, 5.5, SH); tuft(2, -64, -1.0, 30, 5.5, SH);
  c.beginPath(); c.roundRect(-4.5, -60, 9, 10, 2); ink(SK);
  shape(SK, () => {
    c.moveTo(-7, -54); c.quadraticCurveTo(-15, -51, -21, -46); c.quadraticCurveTo(-23, -39, -18, -35);
    c.quadraticCurveTo(-13, -31, -11, -25); c.lineTo(11, -25); c.quadraticCurveTo(13, -31, 18, -35);
    c.quadraticCurveTo(23, -39, 21, -46); c.quadraticCurveTo(15, -51, 7, -54); c.closePath();
  });
  lines(0.9, [[-16, -41, -8, -36, -1, -39], [1, -39, 8, -36, 16, -41], [0, -43, 0, -27]]);
  const flutter = x => (P.still ? 0 : Math.sin(P.t * 5 + x * 0.4) * 0.7);
  shape(COL.makoraCloth, () => {
    c.moveTo(-13, -27); c.quadraticCurveTo(0, -24, 13, -27); c.lineTo(21, -15); c.lineTo(29, -2);
    for (const [x, y] of [[27, 5], [23, 1], [20, 9], [15, 4], [11, 12], [7, 6], [3, 12], [-2, 6], [-7, 11], [-11, 4], [-16, 10], [-20, 2], [-25, 7], [-29, -1]]) c.lineTo(x, y + flutter(x));
    c.lineTo(-21, -15); c.closePath();
  });
  c.beginPath(); c.ellipse(0, -61, 5.2, 7.2, 0, 0, TAU); ink(SK);
  c.beginPath(); c.ellipse(0, -55.5, 2.5, 2.4, 0, 0, TAU); ink(COL.makoraMouth, 1);
  tuft(-3, -62, -2.55, 34, 6.4, SK); tuft(-4, -58, -2.95, 29, 5.4, SK);
  tuft(3, -62, -0.6, 34, 6.4, SK); tuft(4, -58, -0.2, 29, 5.4, SK);
  c.save(); c.translate(0, -84 + (P.still ? 0 : Math.sin(P.t * 2) * 1.2)); c.scale(1, 0.84); c.rotate(((m.run || 1) - 1) * Math.PI / 4 + (m.down ? P.t * 4 : 0));
  for (const [col, extra] of [[COL.wheelDark, 1.6], [COL.wheel, 0]]) {
    c.strokeStyle = col;
    c.lineWidth = 2.6 + extra; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.stroke();
    c.lineWidth = 2 + extra; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5); c.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5); }
    c.stroke();
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.arc(Math.cos(a) * 15, Math.sin(a) * 15, 2.9, 0, TAU); c.fillStyle = COL.wheel; c.fill(); }
  c.restore();
  const arm = (s0, a, b, l1, l2) => { const e = [s0[0] + Math.cos(a) * l1, s0[1] + Math.sin(a) * l1]; return [s0, e, [e[0] + Math.cos(a + b) * l2, e[1] + Math.sin(a + b) * l2]]; };
  const fist = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); ink(SK); };
  const fp = arm([-21, -45], P.fA, P.fB, 17, 15);
  limb(SK, fp, [10.5, 8.5]); fist(fp[2][0], fp[2][1], 5.2);
  const sp = arm([21, -45], P.dA, P.dB, 14, 13);
  const fa = Math.atan2(sp[2][1] - sp[1][1], sp[2][0] - sp[1][0]), ka = fa + P.knife, hx = sp[2][0], hy = sp[2][1];
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(ka) * 30, hy + Math.sin(ka) * 30); c.strokeStyle = OL; c.lineWidth = 5.4; c.stroke(); c.strokeStyle = COL.blade; c.lineWidth = 3.2; c.stroke();
  limb(SK, sp, [10, 8.5]); band(sp[1][0] + Math.cos(fa) * 3.5, sp[1][1] + Math.sin(fa) * 3.5, fa, 10.5); fist(hx, hy, 5);
  c.restore();
}

// A curved blade trail: an arc band from angle a0 to a1 at radius r, `w` thick, tapering at both ends.
function crescent(cx, r, a0, a1, w) {
  if (a1 <= a0) return;
  ctx.beginPath();
  ctx.arc(cx, 0, r + w / 2, a0, a1);
  ctx.arc(cx, 0, r - w / 2, a1, a0, true);
  ctx.closePath(); ctx.fill();
}
