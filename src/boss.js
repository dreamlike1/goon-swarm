/* boss.js — KURTSAURUS, the level-10 boss, its rocks, and the BULL relic it drops. */
'use strict';

/* ============================================================
   KURTSAURUS (user): 67 HP. It walks at you, winds up and charges,
   and throws volleys of slow rocks you can dodge. It arrives once per
   run, as soon as the level-10 picks are done. Beating it earns the
   relic BULL: Shift charges you forward, knocking enemies back.
   Relics last for the run. Every number but the HP is a placeholder.
   ============================================================ */
const BOSS = {
  level: 10, name: 'KURTSAURUS', hp: 67, r: 30,
  walk: 70, dmg: 15, chargeDmg: 25,                        // contact damage, walking / charging
  windup: 0.7, charge: 0.55, chargeSpeed: 560, rest: 0.8, chargeEvery: [2.2, 3.4],
  throwEvery: 1.7, rocks: 9, rockSpread: 1.3, rockSpeed: 150, rockR: 7, rockDmg: 8, rockLife: 6,
  knockResist: 0.15,                                       // takes this share of knockback
  swarmMul: 0.5,                                           // the normal swarm is halved while it's up
  xp: 20,
};
const BULL = { name: 'BULL', speed: 760, time: 0.22, cd: 3, knock: 900, key: 'Shift' };

const bossBar = document.getElementById('bossbar');
const bossFill = document.getElementById('boss-fill');
const relicsEl = document.getElementById('relics');
const toastEl = document.getElementById('toast');

function spawnBoss() {
  const p = game.player;
  // Enter from the edge furthest from the player.
  const x = p.x < W / 2 ? W - BOSS.r - 4 : BOSS.r + 4, y = Math.min(playH || H, H) / 2;
  const b = {
    boss: true, type: 'boss', shape: 'boss', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: BOSS.r,
    hp: BOSS.hp, maxHp: BOSS.hp, dmg: BOSS.dmg, hit: 0, born: 0, speed: BOSS.walk,
    state: 'walk', t: 0, dir: 0, throwT: 1.2, chargeT: 2.4, face: 0,
  };
  game.enemies.push(b);
  game.boss = b;
  game.bossDue = false;
  SFX.roar();
  game.shake = Math.max(game.shake, 0.4);
  toast(`${BOSS.name} appears!`, 'boss');
  renderBossBar();
  aliveEl.textContent = game.enemies.length;
}

function renderBossBar() {
  const b = game.boss;
  bossBar.hidden = !b;
  if (!b) return;
  bossFill.style.transform = `scaleX(${Math.max(0, b.hp) / b.maxHp})`;
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(b.hp)));
}

// Moves the boss for one frame (combat.js calls this instead of the normal chase).
function moveBoss(b, dt) {
  const p = game.player, dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
  const decay = Math.exp(-6 * dt);
  b.kx *= decay; b.ky *= decay;
  b.t -= dt;
  b.face = Math.atan2(dy, dx);
  if (b.state === 'walk') {
    b.vx = (dx / d) * BOSS.walk + b.kx; b.vy = (dy / d) * BOSS.walk + b.ky;
    if ((b.throwT -= dt) <= 0) { throwRocks(b); b.throwT = BOSS.throwEvery; }
    if ((b.chargeT -= dt) <= 0) { b.state = 'windup'; b.t = BOSS.windup; b.dir = b.face; SFX.growl(); }
  } else if (b.state === 'windup') {                        // stands still and aims: the dashed line shows where it'll go
    b.vx = b.kx; b.vy = b.ky;
    b.dir = b.face;
    if (b.t <= 0) { b.state = 'charge'; b.t = BOSS.charge; SFX.roar(); game.shake = Math.max(game.shake, 0.15); }
  } else if (b.state === 'charge') {
    b.vx = Math.cos(b.dir) * BOSS.chargeSpeed; b.vy = Math.sin(b.dir) * BOSS.chargeSpeed;
    if (!reducedMotion && Math.random() < 0.5) burst(b.x, b.y, COL.rock, 1, 60);
    if (b.t <= 0) { b.state = 'rest'; b.t = BOSS.rest; }
  } else {                                                  // rest: catches its breath after a charge
    b.vx = b.kx * 0.5; b.vy = b.ky * 0.5;
    if (b.t <= 0) { b.state = 'walk'; b.chargeT = BOSS.chargeEvery[0] + Math.random() * (BOSS.chargeEvery[1] - BOSS.chargeEvery[0]); }
  }
  b.dmg = b.state === 'charge' ? BOSS.chargeDmg : BOSS.dmg;
  b.x += b.vx * dt; b.y += b.vy * dt;
}

// A fan of slow rocks, aimed at where the player is now.
function throwRocks(b) {
  const a0 = b.face;
  for (let k = 0; k < BOSS.rocks; k++) {
    const a = a0 + (k / (BOSS.rocks - 1) - 0.5) * BOSS.rockSpread;
    const s = BOSS.rockSpeed * (0.85 + Math.random() * 0.3);
    game.rocks.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: BOSS.rockR, t: 0, spin: Math.random() * 6 });
  }
  SFX.rocks();
}

function updateRocks(dt) {
  const p = game.player;
  for (let i = game.rocks.length - 1; i >= 0; i--) {
    const k = game.rocks[i];
    k.t += dt; k.spin += dt * 4;
    k.x += k.vx * dt; k.y += k.vy * dt;
    const gone = k.t > BOSS.rockLife || k.x < -30 || k.y < -30 || k.x > W + 30 || k.y > H + 30;
    if (gone) { game.rocks.splice(i, 1); continue; }
    if (Math.hypot(k.x - p.x, k.y - p.y) < k.r + PLAYER.r) {
      game.rocks.splice(i, 1);
      burst(k.x, k.y, COL.rock, 8, 160);
      if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; continue; }
      p.flash = 0.2;
      hurtPlayer(BOSS.rockDmg);
    }
  }
}

// The boss is down: a big XP orb, the relic, and the swarm goes back to normal.
function bossDown(b) {
  game.boss = null;
  game.bossDone = true;
  renderBossBar();
  SFX.roar();
  game.shake = Math.max(game.shake, 0.5);
  burst(b.x, b.y, COL.boss, 60, 380);
  game.rings.push({ x: b.x, y: b.y, r: 10, max: 220, life: 0.7, color: COL.boss });
  game.orbs.push({ x: b.x, y: b.y, vx: 0, vy: 0, value: BOSS.xp, r: 11, t: 0, born: 0 });
  game.rocks = [];
  if (!game.relics.includes('bull')) {
    game.relics.push('bull');
    game.dashCd = 0;
    renderRelics();
    toast(`Relic earned: ${BULL.name}. Press ${BULL.key} to charge.`, 'relic');
    SFX.upgrade(4);
  }
}

/* ---------- BULL: Shift to charge ---------- */
function tryDash() {
  if (!game.relics.includes('bull') || game.dash || game.dashCd > 0 || game.inMenu || game.over || game.paused || game.choosing) return;
  const p = game.player;
  let mx = 0, my = 0;
  for (const k of keys) { mx += MOVE[k][0]; my += MOVE[k][1]; }
  if (!mx && !my && pointer) { mx = pointer.x - p.x; my = pointer.y - p.y; }
  if (!mx && !my) { const e = nearestEnemy(); if (e) { mx = e.x - p.x; my = e.y - p.y; } else mx = 1; }
  const l = Math.hypot(mx, my) || 1;
  game.dash = { t: BULL.time, dx: mx / l, dy: my / l, hit: new Set() };
  game.dashCd = BULL.cd;
  p.safe = Math.max(p.safe, BULL.time + 0.1);
  SFX.dash();
  renderRelics();
}

// Moves the player during a charge and throws every enemy it touches aside. Returns true while charging.
function updateDash(dt) {
  if (game.dashCd > 0) {
    game.dashCd = Math.max(0, game.dashCd - dt);
    const bar = relicsEl.querySelector('.relic-cd');
    if (bar) bar.style.transform = `scaleX(${1 - game.dashCd / BULL.cd})`;
    if (game.dashCd === 0) renderRelics();               // ready again
  }
  const dsh = game.dash;
  if (!dsh) return false;
  const p = game.player;
  dsh.t -= dt;
  p.x += dsh.dx * BULL.speed * dt; p.y += dsh.dy * BULL.speed * dt;
  clampTo(p, PLAYER.r);
  if (!reducedMotion) game.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, color: COL.relic });
  for (const e of game.enemies) {
    if (dsh.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + PLAYER.r + 10) continue;
    dsh.hit.add(e);
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, kr = e.boss ? BOSS.knockResist : 1;
    // Mostly away from the player, with some of the charge's own direction.
    e.kx += ((dx / d) * 0.6 + dsh.dx * 0.4) * knockOf(BULL.knock) * kr;
    e.ky += ((dy / d) * 0.6 + dsh.dy * 0.4) * knockOf(BULL.knock) * kr;
    e.hit = 0.1;
    SFX.hit(true);
    game.rings.push({ x: e.x, y: e.y, r: 4, max: e.r * 2.5, life: 0.25, color: COL.relic });
  }
  if (dsh.t <= 0) game.dash = null;
  return true;
}

// The relic chip under the top stats: its name, the key, and a bar that refills while it cools down.
function renderRelics() {
  const has = game.relics.includes('bull');
  relicsEl.hidden = !has;
  if (!has) return;
  const k = game.dashCd > 0 ? 1 - game.dashCd / BULL.cd : 1;
  relicsEl.innerHTML = `<button type="button" class="relic${k >= 1 ? ' is-ready' : ''}" id="relic-bull" aria-label="${BULL.name}: charge (${BULL.key})${k >= 1 ? ', ready' : ', recharging'}">`
    + `<span class="relic-name">${BULL.name}</span><span class="relic-key">${BULL.key}</span>`
    + `<span class="relic-cd" style="transform: scaleX(${k})"></span></button>`;
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
  game.rocks = []; game.relics = []; game.dash = null; game.dashCd = 0;
  renderBossBar();
  renderRelics();
  toastEl.hidden = true;
}
