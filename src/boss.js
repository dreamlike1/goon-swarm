/* boss.js — SKURTOSAURUS, the level-10 boss, its rocks, and the BULL relic it drops. */
'use strict';

/* ============================================================
   SKURTOSAURUS (user): 350 HP (was 700, then too tanky). v0.8 (user): bigger, with an intro ("DO YOU HEAR THOSE
   FOOTSTEPS?"), a ring of rocks after every charge, and a big fast rock thrown down a lane it shows first.
   Those replaced the old fan of rocks. It walks at you, winds up and charges,
   and throws volleys of slow rocks you can dodge. It arrives once per
   run, as soon as the level-10 picks are done. Beating it earns the
   relic BULL: Space charges you forward, knocking enemies back.
   Relics last for the run. Every number but the HP is a placeholder.
   ============================================================ */
const BOSS = {
  // hp: phase 1 (user, v0.20: 20% less than the 350 it had, since a second phase follows; v0.21: a bit weaker still,
  // 280 → 240, and it throws a little less often: `throwEvery1`). r: 30 before v0.8.
  level: 10, name: 'SKURTOSAURUS', hp: 240, r: 50, throwEvery1: 2.0,   // renamed from KURTSAURUS in v0.9 (user)
  jump: 0.5, jumpHeight: 70,                               // v0.9: every charge ends in a hop; it lands, the ground breaks, and the ring of rocks flies out
  crack: { life: 4, fade: 1.5 },                           // the broken ground lasts `life` s, fading out over the last `fade`
  walk: 70, dmg: 15, chargeDmg: 25,                        // contact damage, walking / charging
  windup: 0.7, charge: 0.55, chargeSpeed: 560, rest: 0.8, chargeEvery: [2.2, 3.4],
  throwEvery: 1.7, rocks: 9, rockSpread: 1.3, rockSpeed: 150, rockR: 7, rockDmg: 8, rockLife: 6,
  throwWind: 0.75, throwRecover: 0.3,                      // it plants its feet and rears back with the big rock (its lane shows), then flings it
  bigRock: { speed: 820, r: 17, dmg: 22 },                 // the big rock: fast (580 before v0.11), so dodge out of the lane while it winds up
  ringRocks: 14, ringRockR: 12,                            // the ring it lets out when a charge ends: 14 rocks, bigger than the old thrown ones (7 before v0.11)
  intro: { stomps: [0.35, 1.05, 1.75, 2.35], spawn: 2.7 },  // seconds: the footsteps, then it arrives
  knockResist: 0.15,                                       // takes this share of knockback
  // Phase 2 (user, v0.20): when phase 1's HP runs out it roars (`enrage` s, can't be hurt, shoves you back) and
  // comes back with a fresh bar of `hp`. It's faster (walk and charge ×), winds up quicker, charges twice in a row
  // (`dashes`) and throws 3 big rocks in a row (`throws`, `throwGap` s apart, a shorter wind-up each). Placeholders
  // apart from the user's "dashes 2 times, throws 3 times".
  phase2: { hp: 200, enrage: 1.6, walk: 1.45, chargeSpeed: 1.2, windup: 0.75, dashes: 2, throws: 3, throwWind: 0.5, throwGap: 0.3, chargeEvery: 0.75, push: 520 },
  xp: 20,
};
// BULL (user: short, with a clear charge animation). `grab`: extra pickup reach while charging; `hitstop`: the freeze on a hit.
const SWOOSH_LIFE = 0.28;   // seconds a BULL charge's swoosh trail lingers after it ends
const BULL = { name: 'BULL', speed: 950, time: 0.14, cd: 3, knock: 900, grab: 22, hitstop: 0.05, key: 'Space' };

// A bull's head: the relic's icon by the HP bar and in its message.
const BULL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
  + `<path d="M3 5c0 4 2.5 6 5.5 6M21 5c0 4-2.5 6-5.5 6"/><path d="M8 10h8l-1.2 7.5a2.8 2.8 0 0 1-5.6 0z"/><path d="M10.5 16.5h.01M13.5 16.5h.01"/></svg>`;

const bossBar = document.getElementById('bossbar');
const bossFill = document.getElementById('boss-fill');
const relicsEl = document.getElementById('relics');
const toastEl = document.getElementById('toast');

// The intro: the swarm clears, the fight freezes, "DO YOU HEAR THOSE FOOTSTEPS?", four heavy stomps that shake the
// arena harder each time, then SKURTOSAURUS arrives with its name.
const introEl = document.getElementById('intro');
let introTimer = 0;
// The intro's words, on its own (a co-op guest plays just this, the host clears the arena).
function startIntroScene() {
  clearTimeout(introTimer);
  introEl.innerHTML = `<p class="intro-line">DO YOU HEAR THOSE FOOTSTEPS?</p>`;
  introEl.hidden = false;
}
function startIntro() {
  // The boss fights alone (user): the swarm on the field scatters in a puff, and none spawn until it's down.
  for (const e of game.enemies) {
    burst(e.x, e.y, enemyCol(e), 6, 140);
    game.rings.push({ x: e.x, y: e.y, r: 2, max: e.r * 2, life: 0.3, color: enemyCol(e) });
  }
  game.enemies = [];
  game.projectiles = [];
  aliveEl.textContent = 0;
  game.intro = { t: 0, stomp: 0 };
  clearTimeout(introTimer);
  introEl.innerHTML = `<p class="intro-line">DO YOU HEAR THOSE FOOTSTEPS?</p>`;
  introEl.hidden = false;
}
function updateIntro(dt) {
  const it = game.intro, { stomps, spawn } = BOSS.intro;
  it.t += dt;
  if (it.stomp < stomps.length && it.t >= stomps[it.stomp]) {
    it.stomp++;
    SFX.stomp(it.stomp);
    game.shake = Math.max(game.shake, 0.12 + it.stomp * 0.08);
    // dust shaken loose from the top of the arena
    if (!reducedMotion) for (let k = 0; k < 6 + it.stomp * 4; k++) game.particles.push({ x: Math.random() * W, y: Math.random() * 20, vx: 0, vy: 60 + Math.random() * 90, life: 0.7, color: COL.rock });
  }
  if (it.t >= spawn) {
    game.intro = null;
    if (!NET.guest) spawnBoss();
    introEl.innerHTML = `<p class="intro-name"><span class="intro-vs">VS</span>${BOSS.name}</p>`;
    introTimer = setTimeout(() => { introEl.hidden = true; }, 1400);
  }
}

function updateCracks(dt) {
  for (const c of game.cracks) c.t += dt;
  game.cracks = game.cracks.filter(c => c.t < BOSS.crack.life);
}

function spawnBoss() {
  const p = game.player;
  // Enter from the edge furthest from the player.
  const x = p.x < W / 2 ? W - BOSS.r - 4 : BOSS.r + 4, y = Math.min(playH || H, H) / 2;
  const b = {
    boss: true, type: 'boss', shape: 'boss', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: BOSS.r,
    hp: Math.round(BOSS.hp * coopBossHp()), maxHp: Math.round(BOSS.hp * coopBossHp()), dmg: BOSS.dmg,   // co-op: tougher
    hit: 0, born: 0, speed: BOSS.walk,
    state: 'walk', t: 0, dir: 0, throwT: 1.2, chargeT: 2.4, face: 0, phase: 1, throwsLeft: 0, dashesLeft: 0, wind: BOSS.throwWind,
    step: 0, throwing: null, recoil: 0, anim: 0,               // walk cycle, throw windup / follow-through, clock (for draw.js)
  };
  game.enemies = [b];
  game.boss = b;
  game.bossDue = false;
  SFX.roar();
  game.shake = Math.max(game.shake, 0.4);
  renderBossBar();
  aliveEl.textContent = game.enemies.length;
}

function renderBossBar() {
  const b = game.boss;
  bossBar.hidden = !b;
  if (!b) return;
  bossFill.style.transform = `scaleX(${Math.max(0, b.hp) / b.maxHp})`;
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(b.hp)));
  bossBar.setAttribute('aria-valuemax', b.maxHp);
  bossBar.classList.toggle('is-phase2', b.phase === 2);
  bossBar.querySelector('.boss-name').textContent = b.phase === 2 ? `${BOSS.name} · ENRAGED` : BOSS.name;
}

// Phase 1's HP has run out (combat.js asks before killing it): it doesn't die, it gets angry. Returns true if it did.
function bossNextPhase(b) {
  if (b.phase !== 1) return false;
  const P = BOSS.phase2, p = game.player;
  Object.assign(b, { phase: 2, hp: Math.round(P.hp * coopBossHp()), maxHp: Math.round(P.hp * coopBossHp()), dead: false, state: 'enrage', t: P.enrage, throwing: null, recoil: 0, throwsLeft: 0, dashesLeft: 0, kx: 0, ky: 0 });
  game.rocks = [];                                           // a clean slate for the second round
  // the roar shoves you back
  eachLiving(() => {
    const q = game.player, dx = q.x - b.x, dy = q.y - b.y, d = Math.hypot(dx, dy) || 1;
    q.kx = (q.kx || 0) + dx / d * P.push; q.ky = (q.ky || 0) + dy / d * P.push;
  });
  game.rings.push({ x: b.x, y: b.y, r: b.r, max: Math.max(W, H) * 0.6, life: 0.7, color: COL.bad });
  game.shake = Math.max(game.shake, 0.6);
  game.hitstop = Math.max(game.hitstop || 0, 0.12);
  SFX.enrage();
  toast(`PHASE 2 · ${BOSS.name} IS ENRAGED!`, 'enrage');
  renderBossBar();
  return true;
}

// Moves the boss for one frame (combat.js calls this instead of the normal chase).
function moveBoss(b, dt) {
  const p = game.player, dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  const decay = Math.exp(-6 * dt);
  b.kx *= decay; b.ky *= decay;
  b.t -= dt;
  b.anim += dt;
  b.recoil = Math.max(0, b.recoil - dt);
  b.face = Math.atan2(dy, dx);
  const feet = b.y + b.r * 0.95;                            // where its feet kick up dust
  const P = b.phase === 2 ? BOSS.phase2 : null;             // phase 2: faster, and everything comes in a flurry
  const walk = BOSS.walk * (P ? P.walk : 1), windup = BOSS.windup * (P ? P.windup : 1);
  if (b.state === 'enrage') {                               // phase 2 starts: planted, roaring, can't be hurt
    b.vx = b.kx; b.vy = b.ky;
    if (!reducedMotion && Math.random() < dt * 30) game.particles.push({ x: b.x + (Math.random() - 0.5) * b.r * 2, y: feet, vx: (Math.random() - 0.5) * 200, vy: -60 - Math.random() * 120, life: 0.5, color: COL.bad });
    if (b.t <= 0) { b.state = 'walk'; b.throwT = 0.9; b.chargeT = 1.6; }
  } else if (b.state === 'walk') {
    if (b.throwing != null) {                               // throwing: feet planted, rearing back with a rock
      b.vx = b.kx; b.vy = b.ky;
      if ((b.throwing += dt) >= b.wind) {
        throwBigRock(b); b.throwing = null; b.recoil = BOSS.throwRecover;
        b.throwsLeft = Math.max(0, b.throwsLeft - 1);
        b.throwT = b.throwsLeft ? P.throwGap : P ? BOSS.throwEvery : BOSS.throwEvery1;   // phase 2: the next of its 3 comes right after
      }
    } else {
      b.vx = (dx / d) * walk + b.kx; b.vy = (dy / d) * walk + b.ky;
      b.step += dt * (P ? 12 : 9);
      if (b.recoil <= 0 && (b.throwT -= dt) <= 0) {        // aims where you are now, and keeps that line
        if (!b.throwsLeft) b.throwsLeft = P ? P.throws : 1;
        b.throwing = 0; b.wind = P ? P.throwWind : BOSS.throwWind; b.throwA = b.face; SFX.growl();
      }
      else if (!b.throwsLeft && (b.chargeT -= dt) <= 0) { b.state = 'windup'; b.t = windup; b.dir = b.face; b.dashesLeft = P ? P.dashes : 1; SFX.growl(); }
    }
  } else if (b.state === 'windup') {                        // stands still and aims: the dashed line shows where it'll go
    b.vx = b.kx; b.vy = b.ky;
    b.dir = b.face;
    // Paws the ground like a bull and snorts.
    if (!reducedMotion && Math.random() < dt * 14) {
      const back = Math.cos(b.dir) < 0 ? 1 : -1;            // the side behind it: the dust flies back from its front foot
      game.particles.push({ x: b.x - back * b.r * 0.2, y: feet, vx: back * (60 + Math.random() * 80), vy: -20 - Math.random() * 40, life: 0.4, color: COL.rock });
    }
    if (b.t <= 0) { b.state = 'charge'; b.t = BOSS.charge; SFX.roar(); game.shake = Math.max(game.shake, 0.15); }
  } else if (b.state === 'charge') {
    const cs = BOSS.chargeSpeed * (P ? P.chargeSpeed : 1);
    b.vx = Math.cos(b.dir) * cs; b.vy = Math.sin(b.dir) * cs;
    b.step += dt * 26;
    if (!reducedMotion && Math.random() < 0.7) game.particles.push({ x: b.x + (Math.random() - 0.5) * b.r, y: feet, vx: -b.vx * 0.15, vy: -30 * Math.random(), life: 0.45, color: COL.rock });
    if (b.t <= 0) { b.state = 'jump'; b.t = BOSS.jump; SFX.dash(); }
  } else if (b.state === 'jump') {                          // hops up (no contact while it's in the air: draw.js lifts it) …
    b.vx = b.kx * 0.3; b.vy = b.ky * 0.3;
    if (b.t <= 0) {                                         // … and slams down: the ground breaks and the debris flies out in a ring
      groundBreak(b.x, b.y + b.r * 0.85, b.r);
      ringRocks(b);
      b.dashesLeft = Math.max(0, b.dashesLeft - 1);
      if (b.dashesLeft) { b.state = 'windup'; b.t = windup * 0.8; b.dir = b.face; SFX.growl(); }   // phase 2: straight into its second charge
      else { b.state = 'rest'; b.t = BOSS.rest; }
    }
  } else {                                                  // rest: catches its breath after a charge
    b.vx = b.kx * 0.5; b.vy = b.ky * 0.5;
    if (b.t <= 0) { b.state = 'walk'; b.chargeT = (BOSS.chargeEvery[0] + Math.random() * (BOSS.chargeEvery[1] - BOSS.chargeEvery[0])) * (P ? P.chargeEvery : 1); }
  }
  b.dmg = b.state === 'charge' ? BOSS.chargeDmg : BOSS.dmg;
  b.x += b.vx * dt; b.y += b.vy * dt;
}

/* ---------- crabs (level 11 on; mini dinos before v0.46) ---------- */
// Walks in; once you're within sight it stops, winds up (shaking, aim line), dashes along that line, then rests.
function moveRaptor(e, dt) {
  const p = game.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  const decay = Math.exp(-6 * dt);
  e.kx *= decay; e.ky *= decay;
  e.t -= dt; e.anim += dt; e.cd -= dt;
  e.face = Math.atan2(dy, dx);
  if (e.state === 'walk') {
    e.vx = (dx / d) * e.speed + e.kx; e.vy = (dy / d) * e.speed + e.ky;
    e.step += dt * 11;
    if (e.cd <= 0 && d < RAPTOR.sight) { e.state = 'windup'; e.t = RAPTOR.windup; e.dir = e.face; }
  } else if (e.state === 'windup') {
    e.vx = e.kx; e.vy = e.ky;
    e.dir = e.face;                                         // keeps aiming until it goes
    if (e.t <= 0) { e.state = 'charge'; e.t = RAPTOR.dash; SFX.dash(); }
  } else if (e.state === 'charge') {
    const v = RAPTOR.dashSpeed * enemySpeedMul(game.level);
    e.vx = Math.cos(e.dir) * v + e.kx; e.vy = Math.sin(e.dir) * v + e.ky;
    e.step += dt * 28;
    if (!reducedMotion && Math.random() < 0.5) game.particles.push({ x: e.x, y: e.y + e.r, vx: -e.vx * 0.1, vy: -20 * Math.random(), life: 0.3, color: COL.rock });
    if (e.t <= 0) { e.state = 'rest'; e.t = RAPTOR.rest; }
  } else {                                                  // rest
    e.vx = e.kx; e.vy = e.ky;
    if (e.t <= 0) { e.state = 'walk'; e.cd = RAPTOR.every[0] + Math.random() * (RAPTOR.every[1] - RAPTOR.every[0]); }
  }
  e.x += e.vx * dt; e.y += e.vy * dt;
}

// Broken ground where it lands (user: to sell the debris circle): a crater with jagged cracks running out of it and a
// few chunks of rubble, all fading out after a few seconds. The shape is made once here; draw.js draws it.
function groundBreak(x, y, size) {
  const s = size / 30, cracks = [];
  const n = 8 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, len = (45 + Math.random() * 55) * s;
    const pts = [[Math.cos(a) * 14 * s, Math.sin(a) * 9 * s]];
    for (let k = 1; k <= 4; k++) {
      const d = 14 * s + (len - 14 * s) * (k / 4), j = (Math.random() - 0.5) * 0.45;
      pts.push([Math.cos(a + j) * d, Math.sin(a + j) * d * 0.62]);           // flattened a little: it's the floor
    }
    const branch = Math.random() < 0.6 ? (() => {
      const [bx, by] = pts[2], ba = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4), bl = len * 0.35;
      return [[bx, by], [bx + Math.cos(ba) * bl * 0.5, by + Math.sin(ba) * bl * 0.31], [bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl * 0.62]];
    })() : null;
    cracks.push({ pts, branch, w: (2.4 + Math.random() * 1.6) * s });
  }
  const rubble = Array.from({ length: 7 }, () => {
    const a = Math.random() * Math.PI * 2, d = (18 + Math.random() * 30) * s;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.62, r: (2.5 + Math.random() * 3) * s, spin: Math.random() * 6 };
  });
  game.cracks.push({ x, y, s, t: 0, cracks, rubble });
  if (game.cracks.length > 4) game.cracks.shift();
}

// When a charge ends: a ring of slow rocks in every direction (user: a circle, not an arc).
function ringRocks(b) {
  const a0 = Math.random() * Math.PI * 2;
  for (let k = 0; k < BOSS.ringRocks; k++) {
    const a = a0 + (k / BOSS.ringRocks) * Math.PI * 2, s = BOSS.rockSpeed;
    game.rocks.push({ x: b.x + Math.cos(a) * b.r * 0.8, y: b.y + Math.sin(a) * b.r * 0.8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: BOSS.ringRockR, t: 0, spin: Math.random() * 6 });
  }
  burst(b.x, b.y + b.r * 0.8, COL.rock, 16, 200);
  game.shake = Math.max(game.shake, 0.18);
  SFX.stomp(2);
  SFX.rocks();
}

// The big rock: thrown fast down the lane it showed while winding up (draw.js), so you can step out of the way.
function throwBigRock(b) {
  const a = b.throwA ?? b.face, R = BOSS.bigRock;
  game.rocks.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * R.speed, vy: Math.sin(a) * R.speed, r: R.r, t: 0, spin: 0, big: true });
  SFX.boom();
  game.shake = Math.max(game.shake, 0.15);
}

function updateRocks(dt) {
  for (let i = game.rocks.length - 1; i >= 0; i--) {
    const k = game.rocks[i];
    k.t += dt; k.spin += dt * 4;
    k.x += k.vx * dt; k.y += k.vy * dt;
    const gone = (!k.big && k.t > BOSS.rockLife) || k.x < -40 || k.y < -40 || k.x > W + 40 || k.y > H + 40;
    if (gone) { game.rocks.splice(i, 1); continue; }
    let p = game.player;
    if (NET.run) {                                           // co-op: whoever it hits
      const c = living().find(c => Math.hypot(k.x - c.body.x, k.y - c.body.y) < k.r + PLAYER.r);
      if (c) usePlayer(c);
      p = c ? c.body : null;
    }
    if (p && Math.hypot(k.x - p.x, k.y - p.y) < k.r + PLAYER.r) {
      game.rocks.splice(i, 1);
      burst(k.x, k.y, COL.rock, k.big ? 24 : 8, k.big ? 260 : 160);
      if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; continue; }
      p.flash = 0.2;
      if (k.big) game.shake = Math.max(game.shake, 0.25);
      hurtPlayer(k.big ? BOSS.bigRock.dmg : BOSS.rockDmg);
    }
  }
}

// The boss is down: a big XP orb, the relic, and the swarm goes back to normal.
function bossDown(b) {
  game.boss = null;
  game.bossDone = true;
  bonusGold('BOSS', GOLD_BONUS.boss);                      // +10 gold (user, v0.43; it was +1)
  renderBossBar();
  SFX.roar();
  game.shake = Math.max(game.shake, 0.5);
  burst(b.x, b.y, COL.boss, 60, 380);
  game.rings.push({ x: b.x, y: b.y, r: 10, max: 220, life: 0.7, color: COL.boss });
  game.orbs.push({ x: b.x, y: b.y, vx: 0, vy: 0, value: BOSS.xp, r: 11, t: 0, born: 0 });
  game.rocks = [];
  if (NET.run) {                                           // co-op: everyone gets BULL, and the fight doesn't stop
    eachPlayer(() => { if (!game.relics.includes('bull')) game.relics = [...game.relics, 'bull']; game.dashCd = 0; renderRelics(); });
    toast(`EVERYONE GOT ${BULL.name} · SPACE TO CHARGE`, '');
    SFX.upgrade(4);
  } else if (!game.relics.includes('bull')) {
    game.relics.push('bull');
    game.dashCd = 0;
    renderRelics();
    SFX.upgrade(4);
    // A message explaining the relic (user). It pauses the fight like a level-up pick, then you carry on.
    game.upQueue.unshift({ kind: 'relic', relic: 'bull', level: game.level });
    if (!game.choosing) openNext();
  }
}

/* ---------- BULL: Space to charge ---------- */
function tryDash(dir = null) {
  if (NET.guest && NET.run) { if (!NET.me.down) NET.wantDash = true; return; }   // co-op: the host charges us
  if (!game.relics.includes('bull') || game.dash || game.dashCd > 0 || game.inMenu || game.over || (game.paused && !NET.run) || game.choosing || game.intro || game.cine) return;
  if (NET.run && ACTIVE?.down) return;
  const p = game.player;
  let [mx, my] = dir || localInput();
  if (!mx && !my) { const e = nearestEnemy(); if (e) { mx = e.x - p.x; my = e.y - p.y; } else mx = 1; }
  const l = Math.hypot(mx, my) || 1;
  game.dash = { t: BULL.time, dx: mx / l, dy: my / l, hit: new Set(), smashed: false, sx: p.x, sy: p.y };
  game.dashCd = BULL.cd;
  if (game.makora && !game.makora.down) game.makora.dashesSeen++;   // MAKORA is watching: dash a lot and it learns to (makora.js)
  p.safe = Math.max(p.safe, BULL.time + 0.1);
  SFX.bullDash();                                          // a swoosh (user)
  // Launch: a shockwave where you start and dust kicked out behind you.
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 22, life: 0.25, color: COL.relic });
  if (!reducedMotion) for (let k = 0; k < 8; k++) {
    const a = Math.atan2(-my, -mx) + (Math.random() - 0.5) * 1.4, v = 80 + Math.random() * 160;
    game.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35, color: COL.rock });
  }
  game.shake = Math.max(game.shake, 0.05);
  renderRelics();
}

// Moves the player during a charge and throws every enemy it touches aside. Returns true while charging.
function updateDash(dt) {
  if (game.dashCd > 0) {
    game.dashCd = Math.max(0, game.dashCd - dt);
    const icon = isLocal() && relicsEl.querySelector('.relic');
    if (icon) icon.style.setProperty('--k', 1 - game.dashCd / BULL.cd);
    if (game.dashCd === 0) {                              // ready again: the chip lights up, and so do you
      renderRelics();
      const p = game.player;
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 12, life: 0.3, color: COL.relic });
    }
  }
  const dsh = game.dash;
  if (!dsh) return false;
  const p = game.player;
  dsh.t -= dt;
  p.x += dsh.dx * BULL.speed * dt; p.y += dsh.dy * BULL.speed * dt;
  clampTo(p, PLAYER.r);
  game.ghosts.push({ x: p.x, y: p.y, a: Math.atan2(dsh.dy, dsh.dx), life: 0.2 });   // afterimages (draw.js)
  for (const e of game.enemies) {
    if (dsh.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + PLAYER.r + 10) continue;
    dsh.hit.add(e);
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, kr = e.boss ? BOSS.knockResist : 1;
    // Mostly away from the player, with some of the charge's own direction.
    e.kx += ((dx / d) * 0.6 + dsh.dx * 0.4) * knockOf(BULL.knock) * kr;
    e.ky += ((dy / d) * 0.6 + dsh.dy * 0.4) * knockOf(BULL.knock) * kr;
    e.hit = 0.12;
    if (dsh.smashed) SFX.hit(true);                        // the first hit gets the big impact (below)
    game.rings.push({ x: e.x, y: e.y, r: 4, max: e.r * 2.5, life: 0.25, color: COL.relic });
    burst(e.x, e.y, COL.relic, 6, 240);
    if (!dsh.smashed) {                                    // the first hit of a charge: a freeze, a shake and a callout
      dsh.smashed = true;
      SFX.bullImpact();                                    // user: an impact sound
      game.hitstop = BULL.hitstop;
      game.shake = Math.max(game.shake, 0.12);
      game.floaters.push({ x: e.x, y: e.y - e.r - 8, text: 'SMASH!', color: COL.relic, life: 0.6, vy: -50, big: true });
    }
  }
  if (dsh.t <= 0) {                                        // skid to a stop in a puff of dust
    game.swooshes.push({ x1: dsh.sx, y1: dsh.sy, x2: p.x, y2: p.y, life: SWOOSH_LIFE });   // the swoosh lingers a moment (draw.js)
    game.dash = null;
    if (!reducedMotion) burst(p.x, p.y, COL.rock, 6, 90);
  }
  return true;
}

// The BULL icon beside the HP bar: a bull's head in a ring that fills while it cools down, and glows when ready.
function renderRelics() {
  if (!isLocal()) return;
  const has = game.relics.includes('bull');
  relicsEl.hidden = !has;
  if (!has) return;
  const k = game.dashCd > 0 ? 1 - game.dashCd / BULL.cd : 1;
  relicsEl.innerHTML = `<button type="button" class="relic${k >= 1 ? ' is-ready' : ''}" id="relic-bull" style="--k: ${k}" title="${BULL.name}: ${BULL.key} to charge" aria-label="${BULL.name}: charge (${BULL.key})${k >= 1 ? ', ready' : ', recharging'}">`
    + `<span class="relic-icon" aria-hidden="true">${BULL_ICON}</span></button>`;
}
relicsEl.addEventListener('click', e => { if (e.target.closest('#relic-bull')) tryDash(); });   // tap to charge on touch screens

let toastTimer = 0;
function toast(text, kind) {
  toastEl.textContent = text;
  toastEl.className = `toast is-${kind}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3600);
}

function resetBoss() {
  game.boss = null; game.bossDue = false; game.bossDone = false;
  game.rocks = []; game.relics = []; game.dash = null; game.dashCd = 0; game.ghosts = []; game.hitstop = 0; game.intro = null; game.cracks = [];
  clearTimeout(introTimer);
  introEl.hidden = true;
  renderBossBar();
  renderRelics();
  toastEl.hidden = true;
}
