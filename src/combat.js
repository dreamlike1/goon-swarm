/* combat.js — Simulation: spawning, targeting, firing, hits and effects. */
'use strict';

/* ---------- simulation ---------- */
const aliveEl = document.getElementById('alive');

const TYPE_IDS = Object.keys(ENEMY_TYPES);
// A diamond's pull on a potion or another diamond: it speeds up (XP.vacuum) and flies straight at the player.
function vacuumStep(o, dt) {
  const p = game.player, dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
  o.spd = Math.min(XP.vacuum.max, (o.spd || XP.vacuum.start) + XP.vacuum.accel * dt);
  const step = Math.min(d, o.spd * dt);
  o.x += dx / d * step; o.y += dy / d * step;
}

// A random type among those unlocked at this level, by weight.
function pickType() {
  const ids = TYPE_IDS.filter(k => game.level >= ENEMY_TYPES[k].from);
  const total = ids.reduce((s, k) => s + ENEMY_TYPES[k].weight, 0);
  let x = Math.random() * total;
  for (const k of ids) if ((x -= ENEMY_TYPES[k].weight) < 0) return k;
  return ids[0];
}

function spawnEnemy() {
  const p = game.player;
  const type = pickType(), T = ENEMY_TYPES[type], R = T.r;
  let best = null;
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const x = side === 0 ? R : side === 1 ? W - R : R + t * (W - 2 * R);
    const y = side === 2 ? R : side === 3 ? H - R : R + t * (H - 2 * R);
    const d = Math.hypot(x - p.x, y - p.y);
    if (!best || d > best.d) best = { x, y, d };
    if (d > Math.min(W, H) * 0.4) break;
  }
  game.enemies.push(makeEnemy(type, best.x, best.y, SPLIT.types.includes(type) && Math.random() < splitChance(game.level)));
  aliveEl.textContent = game.enemies.length;
}

// One enemy of `type` at (x, y). `split`: the red-purple version that splits in two when it dies.
function makeEnemy(type, x, y, split = false) {
  const T = ENEMY_TYPES[type], hp = Math.round(enemyHp(type, game.level) * coopHp());   // co-op: tougher
  const e = {
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    type, shape: T.shape, r: T.r, dmg: enemyDmg(type, game.level), hp, maxHp: hp, split,
    hit: 0, born: 0, speed: T.speed * enemySpeedMul(game.level) * (0.85 + Math.random() * 0.3),
  };
  // Mini dinos use the dino drawing and a small state machine (see moveRaptor in boss.js).
  if (T.shape === 'dino') Object.assign(e, { state: 'walk', t: 0, dir: 0, face: 0, step: 0, anim: 0, throwing: null, recoil: 0, cd: RAPTOR.every[0] });
  return e;
}
const enemyCol = e => COL[e.split ? `${e.type}-split` : e.type];

// A splitter's two halves: normal red ones, a bit smaller, popping apart.
function splitEnemy(e) {
  const a = Math.random() * Math.PI * 2;
  for (const side of [-1, 1]) {
    const h = makeEnemy(e.type, e.x + Math.cos(a) * side * e.r * 0.5, e.y + Math.sin(a) * side * e.r * 0.5);
    h.r = Math.round(e.r * SPLIT.r);
    h.hp = h.maxHp = Math.max(1, Math.round(h.maxHp * SPLIT.hp));
    h.kx = Math.cos(a) * side * SPLIT.push; h.ky = Math.sin(a) * side * SPLIT.push;
    h.born = 0.5;
    game.enemies.push(h);
  }
  game.rings.push({ x: e.x, y: e.y, r: 4, max: e.r * 3, life: 0.3, color: enemyCol(e) });
}

// The nearest enemy to a point, skipping any in `skip`, optionally within `range`.
// Distances are to the enemy's edge, not its middle (v0.30, user: you had to be right up against SKURTOSAURUS, whose
// middle is 50 px in, before your cards would fire at it).
function nearestEnemy(from = game.player, skip = null, range = Infinity) {
  let best = null, bd = range;
  for (const e of game.enemies) {
    if (skip && skip.has(e)) continue;
    const d = Math.hypot(e.x - from.x, e.y - from.y) - e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Velocity from (x, y) toward enemy e at `speed`, leading it a little so slow shots still connect.
function aimAt(x, y, e, speed) {
  const t = Math.hypot(e.x - x, e.y - y) / speed;
  const a = Math.atan2(e.y + e.vy * t - y, e.x + e.vx * t - x);
  return { a, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

// Plays the next card, or a whole combo: a run of the same card (3, 4 or 7 in a row, see COMBOS in combos.js)
// is played as ONE attack that uses up all its slots.
function fire() {
  const cb = comboAt(deck.sequence, deck.seqPos);
  if (cb) {
    const evs = [];
    for (let k = 0; k < cb.n; k++) { const ev = deck.draw(); evs.push(ev); onAttack(ev); }   // one at a time, so the tray and log keep up
    runCombo(cb);
    // An augmented slot anywhere in the combo plays the whole combo a second time, a moment later.
    if (evs.some(ev => game.aug.has(ev.slot))) later(0.3, () => runCombo(cb, true));
    const last = evs[evs.length - 1];
    return { ...last, reshuffle: evs.find(ev => ev.reshuffle)?.reshuffle || null, sequence: evs.find(ev => ev.sequence)?.sequence || null };
  }
  const ev = deck.draw();
  shoot(ev.card, inRange(ev.card) || nearestEnemy());
  // An augmented slot fires its card a second time, a moment later. The extra shot doesn't draw from the deck.
  if (game.aug.has(ev.slot)) game.echoes.push({ card: ev.card, t: ECHO_DELAY });
  onAttack(ev);
  return ev;
}

// The nearest enemy within a card's attack range, or null.
const rangeOf = card => (CARDS[card].range || Infinity) * (1 + stats.range);   // Attack range upgrades stretch every card's range
const inRange = (card, from = game.player) => nearestEnemy(from, null, rangeOf(card));
const knockOf = base => base * (1 + stats.knock);   // the Knockback upgrade pushes every hit harder

// Runs `fn` after `t` seconds of play (paused time doesn't count).
function later(t, fn) { game.timers.push({ t, fn, owner: ownerId() }); }

// Mine: placed where the player stands, or `dist` px away at angle `a` (the mine combos). Too many on the field and
// the oldest one is cleared. In the store's test mode it's placed under the target dummy, which never moves.
function dropMine(card, a = 0, dist = 0, quiet = false) {
  const c = game.practice ? game.practice.dummies[0] : game.player;   // test mode: around the main dummy
  const m = { x: c.x + Math.cos(a) * dist - (game.practice && !dist ? c.r + 4 : 0), y: c.y + Math.sin(a) * dist, t: 0, card, owner: ownerId() };
  clampTo(m, 8);
  game.mines.push(m);
  if (game.mines.length > MINE_MAX) game.mines.shift();
  if (!quiet) SFX.fire(card);
}

// Laser: an instant zap from the player to `e`, drawn as a beam for a moment (draw.js).
function zap(card, e, o = {}) {
  const spec = CARDS[card], p = game.player, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
  game.beams.push({ x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.14, max: 0.14, w: 3, card });
  hitEnemy({ card, look: 'laser', dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  if (o.quiet) return;
  game.muzzle = { a: Math.atan2(dy, dx), life: 0.08, card };
  SFX.fire(card);
}
// Laser ×7: a line at angle a0, held for a moment, then swept a full turn back to where it started. Every enemy the
// beam passes over (within `len`) is hit once.
function sweep(card, a0, len, dmg) {
  game.sweeps.push({ card, a0, len, dmg, t: 0, prev: a0, hits: new Set(), owner: ownerId() });
  SFX.sweep();
}
function updateSweeps(dt) {
  const { hold, dur } = TUNE.sweep;
  for (let i = game.sweeps.length - 1; i >= 0; i--) {
    const sw = game.sweeps[i];
    usePlayerId(sw.owner);
    const p = game.player;
    sw.t += dt;
    const k = Math.max(0, Math.min(1, (sw.t - hold) / dur)), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;   // ease in-out
    const a = sw.a0 + e * Math.PI * 2;
    for (const en of game.enemies.slice()) {
      if (sw.hits.has(en)) continue;
      const dx = en.x - p.x, dy = en.y - p.y, d = Math.hypot(dx, dy);
      if (d > sw.len + en.r) continue;
      const ang = Math.atan2(dy, dx);
      let touched;
      if (sw.t <= hold) touched = Math.cos(ang - sw.a0) > 0 && Math.abs(Math.sin(ang - sw.a0)) * d < en.r + 3;   // the first line
      else {                                            // inside the slice swept this frame (sw.prev → a), allowing for its size
        const pad = Math.asin(Math.min(1, (en.r + 3) / Math.max(d, 1))), TAU2 = Math.PI * 2;
        touched = (((ang - sw.prev + pad) % TAU2) + TAU2) % TAU2 <= (a - sw.prev) + 2 * pad;
      }
      if (!touched) continue;
      sw.hits.add(en);
      hitEnemy({ card: sw.card, look: 'laser', dmg: sw.dmg, knock: knockOf(CARDS[sw.card].knock * 3), vx: -dy / (d || 1), vy: dx / (d || 1), x: en.x, y: en.y }, en);
    }
    sw.prev = a; sw.a = a;
    if (sw.t >= hold + dur) game.sweeps.splice(i, 1);
  }
}

// An area hit: every enemy within `radius` of (x, y) takes `dmg` and is thrown outward. `skip` is an enemy
// that was already hit directly. `big` adds the heavier effects (sound, shake, particles).
function blast(x, y, card, radius, dmg, { skip = null, knock = 160, big = false } = {}) {
  for (const e of game.enemies.slice()) {
    if (e === skip) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
    if (d > radius + e.r) continue;
    hitEnemy({ card, look: 'blast', dmg, knock: knockOf(knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  }
  game.rings.push({ x, y, r: 6, max: radius, life: big ? 0.45 : 0.3, color: COL[card] });
  burst(x, y, COL[card], big ? 34 : 12, big ? 320 : 200);
  if (big) { SFX.boom(); game.rings.push({ x, y, r: 4, max: radius * 0.6, life: 0.3, color: COL.player }); game.shake = Math.max(game.shake, 0.22); }
  else SFX.hit(true);
}

// A mine goes off. Any other mine inside its blast goes off too, a beat later (chain reaction, user).
function explode(m) {
  const spec = CARDS[m.card];
  blast(m.x, m.y, m.card, spec.radius, damageOf(spec.dmg), { knock: spec.knock, big: true });
  for (const o of game.mines.slice()) {
    if (Math.hypot(o.x - m.x, o.y - m.y) > spec.radius) continue;
    game.mines.splice(game.mines.indexOf(o), 1);
    later(0.09, () => explode(o));
  }
}

// A straight-flying projectile (Space Impact): fixed direction, speed climbs from `start` to `speed` over `ramp` s.
// Space Impact only fires when an enemy is within its attack range, but once fired its missiles have no range (user):
// they fly until they hit or leave the arena. o.range: it bursts when it has flown this far (MEGA IMPACT! uses this
// so its missiles explode where they end); o.endBlast: { radius, dmg } where it ends (hit, range or edge).
// Also the Sniper's shots (v0.30), which start at full speed. o.pierce / o.r / o.dmg override the card's; o.big: the
// Railgun (drawn bigger, and its blast is the big kind).
function launch(card, a, e, o = {}) {
  const spec = CARDS[card], p = game.player;
  game.projectiles.push({
    card, look: spec.look, r: o.r || spec.r, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), speed: spec.start, top: spec.speed,
    start: spec.start, ramp: spec.ramp, age: 0, straight: true, pierce: o.pierce ?? (spec.pierce || 0), bounces: 0, hits: new Set(), spin: 0,
    target: null, a, x: p.x + Math.cos(a) * (PLAYER.r + 4), y: p.y + Math.sin(a) * (PLAYER.r + 4), big: !!o.big,
    vx: Math.cos(a) * spec.start, vy: Math.sin(a) * spec.start, trail: [], flown: 0, range: o.range || 0, endBlast: o.endBlast || null, owner: ownerId(),
  });
  if (!e) return;                       // part of a burst: the burst handles sound and muzzle
  game.muzzle = { a, life: 0.12, card };
  SFX.fire(card);
  if (o.big) SFX.boom();
}
// How far a straight shot from (x, y) at angle a flies before it reaches the arena's edge (the Railgun ends there).
function edgeDist(x, y, a) {
  const cx = Math.cos(a), cy = Math.sin(a), h = playH || H;
  const tx = cx > 0 ? (W - 12 - x) / cx : cx < 0 ? (12 - x) / cx : Infinity;
  const ty = cy > 0 ? (h - 12 - y) / cy : cy < 0 ? (12 - y) / cy : Infinity;
  return Math.max(40, Math.min(tx, ty));
}

// One homing shot of `card` at enemy `e`. Options (all optional), for combos:
//   dmg: exact damage (before Base damage) · speedMul · r (size) · bounces · bounceRange
//   aoe: { radius, dmg } splash where it hits · angle + homeDelay: fly this way for a moment, then home in
//   angle + noHome: fly straight this way (cone shots) · quiet: no sound or muzzle (the combo plays its own)
//   from: { x, y } to start from instead of the player · split: on a hit it splits into this many (Arcane Missiles ×7)
//   one: just one shot, for a card that fires a volley (Arcane Missiles fire 2)
// Every shot fizzles once it has flown a bit past its card's range.
function shoot(card, e, o = {}) {
  const spec = CARDS[card];
  const p = o.from || game.player;
  if (spec.look === 'mine') { dropMine(card); return; }
  if (spec.silica && !o.raw) { silicaShot(card, e, o); return; }   // the Silica pack's weapons (silica.js)
  if (spec.look === 'laser') { zap(card, e, o); return; }
  if (spec.volley && !o.one && e) {                          // Arcane Missiles: 2, fanned out to the sides, each at its own target
    const ts = targets(spec.volley, rangeOf(card)), a0 = Math.atan2(e.y - p.y, e.x - p.x);
    for (let k = 0; k < spec.volley; k++) shoot(card, ts[k] || e, { ...o, one: true, angle: a0 + (k % 2 ? 1 : -1) * TUNE.missile.spread, quiet: o.quiet || k > 0 });
    return;
  }
  const speed = spec.speed * (o.speedMul || 1);
  if (spec.homing === false) {
    // A straight shot can't correct its course, so it leads using its average speed over the climb.
    const { a } = aimAt(p.x, p.y, e, (spec.start + spec.speed) / 2);
    launch(card, o.angle ?? a, e, o);
    return;
  }
  const aim = aimAt(p.x, p.y, e, speed);
  const a = o.angle ?? aim.a, steer = spec.look === 'amissile', off = o.from ? 2 : PLAYER.r + 4;
  game.projectiles.push({
    card, look: spec.look, r: o.r || spec.r, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), speed,
    bounces: o.bounces ?? (spec.bounces || 0), bounceRange: o.bounceRange || BOUNCE_RANGE, hits: new Set(o.skip ? [o.skip] : []), spin: 0, target: e,
    aoe: o.aoe ? { radius: o.aoe.radius, dmg: damageOf(o.aoe.dmg) } : null, big: !!o.r,
    // missiles fly out to the side for a moment, then steer in (a turn rate rather than snapping round)
    homeDelay: o.noHome ? Infinity : (o.homeDelay ?? (steer ? TUNE.missile.curve : 0)), split: o.split || 0, field: o.field || null,
    turn: steer ? TUNE.missile.turn * speed / spec.speed : 0,   // faster missiles turn faster, so they still curve in the same space
    flown: 0, maxDist: rangeOf(card) * (steer ? 2.2 : 1.35), age: 0,
    x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, trail: [], owner: ownerId(),
  });
  if (o.quiet) return;
  game.muzzle = { a, life: 0.12, card };
  SFX.fire(card);
  if (spec.look === 'heavy') game.shake = Math.max(game.shake, 0.08);
}

// MISSILE STORM!: a missile that hits splits into `pr.split` smaller ones, each after the nearest other enemies (they
// fly off to the sides and fizzle if there are none).
function splitMissile(pr, hit) {
  const others = game.enemies.filter(en => en !== hit && !en.dead).sort((a, b) => Math.hypot(a.x - pr.x, a.y - pr.y) - Math.hypot(b.x - pr.x, b.y - pr.y));
  const a0 = Math.atan2(pr.vy, pr.vx);
  for (let k = 0; k < pr.split; k++) {
    const e = others[k % Math.max(1, others.length)] || null, side = k % 2 ? 1 : -1;
    const o = { one: true, from: { x: pr.x, y: pr.y }, angle: a0 + side * 1.1, quiet: true, skip: hit, speedMul: 1.3, r: 3 };
    if (e) shoot(pr.card, e, o);
    else shoot(pr.card, hit, { ...o, noHome: true });
  }
  burst(pr.x, pr.y, COL[pr.card], 8, 160);
}

function hitEnemy(pr, e) {
  if (e.dead) return;                   // already killed this frame by another hit (a blast, a pierce): count it once
  if (e.boss && e.state === 'enrage') return;   // roaring into phase 2: can't be hurt
  if (e.makora && (e.down || game.makoraAdapted.has(pr.card))) {   // MAKORA has adapted to this weapon: no effect
    if (!e.down && performance.now() - (e.tink || 0) > 350) {
      e.tink = performance.now();
      game.floaters.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - e.r - 10, text: 'ADAPTED', color: COL.wheel, life: 0.7, vy: -40, big: false });
      SFX.adapted();
    }
    return;
  }
  if (Math.random() < critChance()) {                // a crit (v0.41): rolled per hit; a gold spark on the enemy (v0.42)
    pr = { ...pr, dmg: critHit(pr.dmg), crit: true };
    game.rings.push({ x: e.x, y: e.y, r: e.r * 0.5, max: e.r + 22, life: 0.25, color: COL.wheelHi });
    burst(e.x, e.y, COL.wheelHi, 8, 260);
  }
  e.hp -= pr.dmg;
  if (e.dummy) {                                    // test dummies never die or move; they count the damage instead
    game.practice.dmg += pr.dmg; e.hp = e.maxHp; pr = { ...pr, knock: 0 };
    renderPrDmg();
  }
  e.hit = 0.1;
  const len = Math.hypot(pr.vx, pr.vy) || 1, kr = e.boss ? BOSS.knockResist : e.makora ? MAKORA.knockResist : e.mrock ? 0 : 1;
  e.kx += (pr.vx / len) * pr.knock * kr;
  e.ky += (pr.vy / len) * pr.knock * kr;
  if (e.boss) renderBossBar();
  if (e.makora) renderMakoraBar();
  const heavy = pr.look === 'heavy' && !pr.aoe, strong = pr.dmg >= 10;
  SFX.hit(heavy || pr.crit || pr.dmg >= 15);
  burst(pr.x, pr.y, COL[pr.card], heavy ? 16 : strong ? 10 : 5, heavy ? 260 : 180);
  if (heavy) {
    game.rings.push({ x: pr.x, y: pr.y, r: 6, max: 70, life: 0.35, color: COL[pr.card] });
    game.shake = Math.max(game.shake, 0.18);
  }
  if (pr.crit) game.floaters.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.r - 10, text: `${pr.dmg}!`, color: COL.wheelHi, life: 0.9, max: 0.9, vy: -45, big: true, crit: true });   // gold, bigger, with a !
  else game.floaters.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.r - 8, text: String(pr.dmg), color: COL[pr.card], life: 0.6, vy: -50, big: strong });

  if (e.hp <= 0 && e.boss && bossNextPhase(e)) return;   // SKURTOSAURUS: phase 1's bar is gone, phase 2 begins
  if (e.hp <= 0 && e.makora) { makoraDown(e, pr.card); return; }   // MAKORA never stays down: it adapts and comes back
  if (e.hp <= 0 && e.mrock) { rockBlast(e); return; }                // MAKORA's kicked rock: shot apart, it explodes (makora.js)
  if (e.hp <= 0) {
    e.dead = true;
    SFX.kill(e.r > 15);
    burst(e.x, e.y, enemyCol(e), e.r > 15 ? 30 : 22, 240);
    game.rings.push({ x: e.x, y: e.y, r: 10, max: e.r * 6, life: 0.45, color: enemyCol(e) });
    game.enemies.splice(game.enemies.indexOf(e), 1);
    if (e.split) splitEnemy(e);
    if (e.boss) bossDown(e);
    else if (Math.random() < orbDropChance()) dropOrb(e);
    if (Math.random() < POTION.drop && game.potions.length < POTION.max) game.potions.push({ x: e.x, y: e.y, t: 0 });
    else if (Math.random() < DIAMOND.drop && game.diamonds.length < DIAMOND.max) game.diamonds.push({ x: e.x, y: e.y, t: 0 });
    game.kills++;
    document.getElementById('kills').textContent = game.kills;
    aliveEl.textContent = game.enemies.length;
  }
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, color });
  }
}

// An XP orb pops out of a defeated enemy and settles on the floor.
function dropOrb(e) {
  const value = ENEMY_TYPES[e.type].xp, a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 60;
  game.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value, r: value > 1 ? 8 : 6, t: Math.random() * 6, born: 0 });
}

// Adds XP, levelling up as many times as it covers. Leftover XP carries into the next level.
function gainXp(n) {
  if (game.level >= MAKORA.level) return;   // level 15 is the last level (user)
  game.xp += n;
  let up = 0;
  while (game.xp >= xpNeeded(game.level) && game.level < MAKORA.level) {
    game.xp -= xpNeeded(game.level);
    game.level++;
    up++;
  }
  if (up) {
    const p = game.player;
    SFX.levelUp();
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 90, life: 0.6, color: COL.xp });
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 18, text: `LEVEL ${game.level}`, color: COL.xp, life: 1.1, vy: -30, big: true });
  }
  renderXp(up > 0);
  if (up && game.level >= 10 && game.level - up < 10) bonusGold('LEVEL 10', GOLD_BONUS.level10);   // +1 gold for reaching level 10 (user)
  if (up) { if (NET.run) coopLevelUps(game.level - up, game.level); else queueLevelUps(game.level - up, game.level); }
}

// Bonus gold (user): +1 for reaching level 10, +10 for beating SKURTOSAURUS and +15 every time MAKORA goes down
// (v0.43; the boss was +1). Saved straight away; the run's Defeated screen and the title note add it to the gold for kills.
const GOLD_BONUS = { level10: 1, boss: 10, makora: 15 };
function bonusGold(why, n = 1) {
  if (game.practice) return;
  if (NET.host && NET.run) coopEvent({ e: 'gold', why, n });   // each friend earns it on their own computer
  save.gold += n; writeSave();
  game.goldBonus = (game.goldBonus || 0) + n;
  const p = game.player;
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 30, text: `+${n} GOLD · ${why}`, color: COL['r-legendary'], life: 1.4, vy: -26, big: true });
  SFX.coin();
}

const hintEl = document.getElementById('hint');

// How close (x, y) came to the player this frame: the distance to the path from where the frame started to
// where the player is now. A BULL charge moves far in one frame, and would otherwise skip over pickups.
function playerReach(x, y) {
  const p = game.player, ax = p.px ?? p.x, ay = p.py ?? p.y, vx = p.x - ax, vy = p.y - ay, l2 = vx * vx + vy * vy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 1;
  return Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
}

// Contact damage, then a short safe window so touching an enemy doesn't drain HP every frame.
// Dodge can avoid the hit entirely; Armor takes a flat amount off it (a hit always does at least 1).
function hurtPlayer(raw) {
  const p = game.player;
  if (p.safe > 0 || game.over || (NET.run && ACTIVE?.down)) return;
  if (Math.random() < dodgeChance()) {
    p.safe = PLAYER.safe;
    SFX.dodge();
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: 'DODGE', color: COL.text, life: 0.6, vy: -40, big: false });
    return;
  }
  const dmg = armorCut(raw);
  p.hp = Math.max(0, p.hp - dmg);
  p.safe = PLAYER.safe;
  if (isLocal()) SFX.hurt();
  game.shake = Math.max(game.shake, 0.12);
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: `-${dmg}`, color: COL.bad, life: 0.7, vy: -40, big: true });
  renderHp(true);
  if (p.hp <= 0) { if (NET.run) coopDown(ACTIVE); else defeat(); }   // co-op: down until a friend revives you
}

// One player's cards for this frame: an augmented slot's second shot, then the next card when the timer runs out. The
// timer only runs out while the next card has an enemy within its range (not in the store's test mode).
function attackStep(dt) {
  for (let i = game.echoes.length - 1; i >= 0; i--) {
    const ec = game.echoes[i];
    if ((ec.t -= dt) > 0) continue;
    game.echoes.splice(i, 1);
    const tg = inRange(ec.card);
    if (tg) shoot(ec.card, tg);
  }
  game.cooldown -= dt;
  const autoTest = game.practice?.card === DECK_TAB;             // Test loadout's Whole deck: your deck plays as in a run
  if (autoTest) game.practice.t += dt;
  if (game.practice && !autoTest) game.cooldown = attackInterval();
  else if (game.cooldown <= 0) {
    const next = deck.sequence[deck.seqPos];
    if (next && (CARDS[next].auto || inRange(next))) {   // the Mine has no range: it drops on its own (v0.40)
      const ev = fire();
      // A shuffle takes a moment: the next card waits for it. Attack speed shortens both.
      game.cdTotal = attackInterval() + (ev.reshuffle ? shuffleTime() : 0);
      game.cooldown += game.cdTotal;
    }
    else game.cooldown = 0;
  }

}

// One player's movement, timers and regen for this frame (co-op runs it for each player in turn).
function playerStep(dt, mx, my) {
  const p = game.player;
  p.px = p.x; p.py = p.y;               // where this frame started, so pickups can check the whole path (see playerReach)
  const ml = Math.hypot(mx, my);
  if (updateDash(dt)) { /* BULL charge: it moves the player itself */ }
  else if (ml) {
    p.x += (mx / ml) * moveSpeed() * dt; p.y += (my / ml) * moveSpeed() * dt;
    if (isLocal()) hintEl.classList.add('gone');
  }
  if (p.kx || p.ky) {                   // a shove (SKURTOSAURUS's phase-2 roar), dying away quickly
    p.x += p.kx * dt; p.y += p.ky * dt;
    const k = Math.exp(-6 * dt); p.kx *= k; p.ky *= k;
    if (Math.hypot(p.kx, p.ky) < 5) p.kx = p.ky = 0;
  }
  clampTo(p, PLAYER.r);
  p.flash = Math.max(0, p.flash - dt);
  p.safe = Math.max(0, p.safe - dt);
  // Mini shield: a moment of safety right after a level-up choice closes.
  game.shield = Math.max(0, game.shield - dt);
  game.shieldHit = Math.max(0, game.shieldHit - dt);
  // health regen
  if (stats.regen > 0 && p.hp < maxHp()) {
    const before = Math.ceil(p.hp);
    p.hp = Math.min(maxHp(), p.hp + stats.regen * dt);
    if (Math.ceil(p.hp) !== before) renderHp(false);
  }
}

function update(dt) {
  if (first) return;                    // wait until the arena has a real size (see resize)
  if (game.hitstop > 0) { game.hitstop -= dt; return; }   // a BULL hit freezes the frame for a moment
  if (game.intro) { updateIntro(dt); updateEffects(dt); return; }   // SKURTOSAURUS's intro: the fight waits
  if (game.cine) { updateCine(dt); updateEffects(dt); return; }     // MAKORA's black-screen scenes: so does this
  let p = game.player;
  if (NET.run) coopPlayersStep(dt);     // co-op: every player moves (coop.js)
  else playerStep(dt, ...localInput());

  // swarm spawning
  // swarm spawning: tops up fast below this level's minimum, then keeps adding up to its maximum
  if (!game.started) {
    game.started = true;
    for (let i = 0; i < 3; i++) spawnEnemy();
  }
  if (game.bossDue && !game.boss) { startIntro(); return; }   // nothing else happens once the footsteps start
  if (game.makoraDue && !game.boss && !game.makora) { startMakora(); return; }   // level 15: the last fight
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && !game.boss && !game.makora && !game.practice) {   // no swarm at all while a boss is up (user)
    const n = game.enemies.length, low = n < swarmMin(game.level) * coopCount();   // co-op: many more of them
    if (n < swarmMax(game.level) * coopCount()) spawnEnemy();
    game.spawnTimer = (low ? SWARM.refill : spawnEvery(game.level)) / coopCount();
  }

  // enemies: chase, keep a little apart from each other, get shoved on contact
  const es = game.enemies;
  const decay = Math.exp(-6 * dt);
  for (const e of es) {
    if (e.dummy) { e.hit = Math.max(0, e.hit - dt); continue; }   // the store's test dummies stand still and do no harm
    e.born = Math.min(1, e.born + dt * (e.boss || e.makora ? 1.5 : 4));
    if (NET.run) {                          // co-op: each goes after whoever is nearest (and standing)
      if (!e.mrock && !nearestLiving(e.x, e.y)) { e.hit = Math.max(0, e.hit - dt); continue; }
      p = game.player;
    }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, ox = e.x, oy = e.y;
    if (e.boss) moveBoss(e, dt);
    else if (e.makora) moveMakora(e, dt);
    else if (e.mrock) { moveKickRock(e, dt); e.hit = Math.max(0, e.hit - dt); continue; }   // it does its own hitting (makora.js)
    else if (e.shape === 'dino') moveRaptor(e, dt);
    else {
      e.kx *= decay; e.ky *= decay;
      e.vx = (dx / d) * e.speed + e.kx;
      e.vy = (dy / d) * e.speed + e.ky;
      e.x += e.vx * dt; e.y += e.vy * dt;
    }
    if (e.chill > 0) {                     // Cryo Magus: chilled enemies only get part of the way (silica.js)
      e.chill -= dt;
      e.x = ox + (e.x - ox) * SILICA.cryo.slow; e.y = oy + (e.y - oy) * SILICA.cryo.slow;
    }
    e.hit = Math.max(0, e.hit - dt);
    const shielded = game.shield > 0;
    const reach = e.r + PLAYER.r + (shielded ? SHIELD.r : 0);
    if (d < reach && e.state !== 'jump') {   // contact: push out, shove back, and hurt the player (unless shielded; not while the boss is in the air)
      if (e.boss || e.makora) { p.x += (dx / d) * (reach - d); p.y += (dy / d) * (reach - d); clampTo(p, PLAYER.r); }   // a boss shoves you, not the other way round
      else {
        e.x -= (dx / d) * (reach - d); e.y -= (dy / d) * (reach - d); e.kx -= (dx / d) * 260; e.ky -= (dy / d) * 260;
        if (e.state === 'charge') { e.state = 'rest'; e.t = RAPTOR.rest; }   // a mini dino's dash stops when it hits you
      }
      if (shielded || game.dash) game.shieldHit = 0.15;
      else { p.flash = 0.2; hurtPlayer(e.dmg); }
    }
  }
  for (let i = es.length - 1; i >= 0; i--) if (es[i].gone) es.splice(i, 1);   // MAKORA's rocks that broke or flew off
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.mrock || b.mrock) continue;                        // a flying rock goes through everything
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const overlap = (a.r + b.r) * 1.1 - d;
      if (overlap > 0) {
        const ox = (dx / d) * overlap / 2, oy = (dy / d) * overlap / 2;
        if (a.boss || a.makora) { b.x += ox * 2; b.y += oy * 2; }
        else if (b.boss || b.makora) { a.x -= ox * 2; a.y -= oy * 2; }
        else { a.x -= ox; a.y -= oy; b.x += ox; b.y += oy; }
      }
    }
  }
  for (const e of es) if (!e.mrock) clampTo(e, e.r);

  updateRocks(dt);

  // Pickups reach: a BULL charge also scoops up anything it passes near. (Co-op: whoever gets there; see reacher.)

  // potions: walk over one to heal; they fade after a while
  for (let i = game.potions.length - 1; i >= 0; i--) {
    const pt = game.potions[i];
    pt.t += dt;
    if (pt.vacuum) vacuumStep(pt, dt);
    else if (pt.t > POTION.life) { game.potions.splice(i, 1); continue; }
    if ((p = reacher(pt.x, pt.y, POTION.r))) {
      game.potions.splice(i, 1);
      const healed = Math.min(POTION.heal, maxHp() - p.hp);
      p.hp = Math.min(maxHp(), p.hp + POTION.heal);
      SFX.potion();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 26, life: 0.4, color: COL.potion });
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: `+${Math.round(healed)}`, color: COL.hp, life: 0.8, vy: -40, big: true });
      renderHp(false);
    }
  }

  // diamonds: walk over one and every XP orb on the floor flies to you
  for (let i = game.diamonds.length - 1; i >= 0; i--) {
    const dm = game.diamonds[i];
    dm.t += dt;
    if (dm.vacuum) vacuumStep(dm, dt);
    else if (dm.t > DIAMOND.life) { game.diamonds.splice(i, 1); continue; }
    if ((p = reacher(dm.x, dm.y, DIAMOND.r))) {
      game.diamonds.splice(i, 1);
      // every drop on the floor flies to you (user: all of them, not just XP): orbs, potions and other diamonds
      for (const o of game.orbs) { o.magnetized = true; o.vacuum = true; }   // the fast pull (XP.vacuum)
      for (const d of game.potions.concat(game.diamonds)) d.vacuum = true;
      SFX.diamond();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: Math.max(W, H), life: 0.6, color: COL.diamond });
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: 'MAGNET!', color: COL.diamond, life: 0.9, vy: -40, big: true });
    }
  }

  // mines: arm after a moment, then go off when an enemy touches one
  for (let i = game.mines.length - 1; i >= 0; i--) {
    const m = game.mines[i];
    if (!m) continue;                    // a chain reaction removed mines from the list
    const spec = CARDS[m.card];
    m.t += dt;
    if (m.t < spec.arm) continue;
    // In test mode the dummies never walk onto a mine, so mines go off as soon as they're armed.
    if (game.practice || es.some(e => Math.hypot(e.x - m.x, e.y - m.y) < (spec.trigger || spec.r) + e.r)) { game.mines.splice(i, 1); usePlayerId(m.owner); explode(m); }
  }

  // scheduled combo shots
  for (let i = game.timers.length - 1; i >= 0; i--) {
    const tm = game.timers[i];
    if ((tm.t -= dt) > 0) continue;
    game.timers.splice(i, 1);
    usePlayerId(tm.owner);
    tm.fn();
  }

  updateSweeps(dt);
  updateSilica(dt);
  if (NET.run) coopAttacks(dt);         // co-op: everyone's cards (coop.js)
  else attackStep(dt);

  // Projectiles home in on their target, so they don't miss it. If the target dies first, the shot doesn't
  // look for another: it flies on straight and can still hit whatever it runs into (user: less aimbot).
  // Each hits the first enemy it touches. A bouncing one (Shuriken) then heads for the nearest enemy it
  // hasn't hit yet, within its bounce range; with none, it ends. Every shot fizzles past its range.
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    // MAKORA going down clears every shot mid-loop (makoraDown), so the list can shrink under us (v0.32: this threw,
    // and the frame loop stopped for good: "the game freezes after the second wheel turn")
    if (game.cine) break;
    const pr = game.projectiles[i];
    if (!pr) continue;
    usePlayerId(pr.owner);                 // co-op: its hits crit and blast as whoever fired it
    pr.trail.push(pr.x, pr.y);
    if (pr.trail.length > 16) pr.trail.splice(0, 2);
    // Straight missiles: no homing. They ease in slowly, then speed up. They pierce `pierce` enemies;
    // the next hit stops them. Missing is possible.
    if (pr.straight) {
      pr.age += dt;
      const k = Math.min(1, pr.age / pr.ramp);
      pr.speed = pr.start + (pr.top - pr.start) * k * k;
      pr.vx = Math.cos(pr.a) * pr.speed; pr.vy = Math.sin(pr.a) * pr.speed;
      // in small steps, so a very fast shot (the Sniper) can't skip past an enemy between frames
      const steps = Math.max(1, Math.ceil(pr.speed * dt / 8));
      let end = false;
      for (let st = 0; st < steps && !end; st++) {
        pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
        pr.flown += pr.speed * dt / steps;
        for (const hit of es.filter(en => !pr.hits.has(en) && Math.hypot(pr.x - en.x, pr.y - en.y) < pr.r + en.r)) {
          hitEnemy(pr, hit);
          pr.hits.add(hit);
          if (pr.pierce > 0) pr.pierce--;
          else { end = true; break; }
        }
        if (pr.range && pr.flown >= pr.range) end = true;
      }
      const out = pr.x < -40 || pr.y < -40 || pr.x > W + 40 || pr.y > H + 40;
      if (end || out) {
        game.projectiles.splice(i, 1);
        if (pr.endBlast && !out) blast(pr.x, pr.y, pr.card, pr.endBlast.radius, pr.endBlast.dmg, { knock: pr.big ? 220 : 80, big: pr.big });
      }
      continue;
    }
    // A spread shot (shotgun, cone) flies its own way for a moment before homing in.
    const spread = pr.homeDelay > 0;
    if (spread) pr.homeDelay -= dt;
    if (pr.target && !es.includes(pr.target)) pr.target = null;   // its target died: carry on straight
    const tg = spread ? null : pr.target;
    if (spread) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    else if (tg) {
      const dx = tg.x - pr.x, dy = tg.y - pr.y, d = Math.hypot(dx, dy) || 1;
      if (pr.turn && d > 70) {                        // Arcane Missiles: turn toward it at a rate that grows, so they curve in; close up
                                                      // they go straight for it (they could circle it otherwise)
        pr.age += dt;
        const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(dy, dx), max = (pr.turn + pr.age * 30) * dt;
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), na = cur + Math.max(-max, Math.min(max, diff));
        pr.vx = Math.cos(na) * pr.speed; pr.vy = Math.sin(na) * pr.speed;
      } else { pr.vx = (dx / d) * pr.speed; pr.vy = (dy / d) * pr.speed; }
      // Arrives this frame: land on it, so a fast shot can't step past its target.
      if (d <= pr.speed * dt + pr.r + tg.r) { pr.x = tg.x - (dx / d) * tg.r * 0.8; pr.y = tg.y - (dy / d) * tg.r * 0.8; }
      else { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    } else {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;   // no target: fly on straight
    }
    pr.flown += pr.speed * dt;
    pr.spin += dt * 18;
    const touching = en => !pr.hits.has(en) && Math.hypot(pr.x - en.x, pr.y - en.y) < pr.r + en.r;
    const target = (tg && touching(tg)) ? tg : es.find(touching);
    if (target) {
      hitEnemy(pr, target);
      pr.hits.add(target);
      if (pr.aoe) blast(target.x, target.y, pr.card, pr.aoe.radius, pr.aoe.dmg, { skip: target, big: pr.big });
      if (pr.split) splitMissile(pr, target);
      if (pr.field) iceField(target.x, target.y, pr.field, pr.card);   // Cryo Magus: a frost field where it lands
      const next = pr.bounces > 0 && nearestEnemy(pr, pr.hits, pr.bounceRange || BOUNCE_RANGE);
      if (next) {
        pr.bounces--;
        pr.target = next;
        pr.flown = 0; pr.maxDist = (pr.bounceRange || BOUNCE_RANGE) * 1.35;   // each bounce gets its own reach
        continue;
      }
      game.projectiles.splice(i, 1);
      continue;
    }
    if (pr.flown > pr.maxDist) {           // out of range: fizzle
      burst(pr.x, pr.y, COL[pr.card], 3, 80);
      if (pr.field) iceField(pr.x, pr.y, pr.field, pr.card);
      game.projectiles.splice(i, 1);
      continue;
    }
    if (pr.x < -40 || pr.y < -40 || pr.x > W + 40 || pr.y > H + 40) game.projectiles.splice(i, 1);
  }

  // XP orbs: slide to a stop, then fly to the player once in range. Touching one collects it.
  p = game.player;                      // (the pickups above leave p as whoever grabbed something, or null)
  for (let i = game.orbs.length - 1; i >= 0; i--) {
    const o = game.orbs[i];
    o.t += dt; o.born = Math.min(1, o.born + dt * 5);
    if (NET.run) { if (!nearestLiving(o.x, o.y)) break; p = game.player; }   // co-op: it flies to whoever is nearest
    const grab = PLAYER.r + (game.dash ? BULL.grab : 2);
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    // Once an orb is pulled in range, it stays "latched" and keeps chasing no matter how far
    // it falls behind afterwards — otherwise a player sprinting away can shake it off for good.
    if (!o.magnetized && d < magnetRange()) o.magnetized = true;
    if (o.magnetized) {
      // Steers straight at the player. Always faster than the player, and much faster up close (user: super
      // strong at point blank). A diamond's pull (`vacuum`) keeps speeding up until the orb arrives.
      const closeness = Math.max(0, Math.min(1, (magnetRange() - d) / magnetRange()));
      const want = o.vacuum ? (o.spd = Math.min(XP.vacuum.max, (o.spd || XP.vacuum.start) + XP.vacuum.accel * dt))
        : Math.max(XP.chase, moveSpeed() * 1.4) + closeness * closeness * XP.snap;
      const turn = Math.min(1, dt * (o.vacuum ? 18 : 5 + closeness * 25));
      o.vx += ((dx / d) * want - o.vx) * turn;
      o.vy += ((dy / d) * want - o.vy) * turn;
    } else {
      const drag = Math.exp(-5 * dt);
      o.vx *= drag; o.vy *= drag;
    }
    // Collected on touch, or if it would fly past the player this frame.
    const pass = o.magnetized && Math.hypot(o.vx, o.vy) * dt >= d - grab - o.r;
    if (pass || playerReach(o.x, o.y) < grab + o.r) {
      game.orbs.splice(i, 1);
      SFX.pickup();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 10, life: 0.2, color: COL.xp });
      gainXp(xpGain(o.value));
      continue;
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
    clampTo(o, o.r);
  }

  updateEffects(dt);
}

// Particles, rings, beams, floaters, muzzle flash and shake (also run during the boss intro, when the fight is frozen).
function updateEffects(dt) {
  updateCracks(dt);
  for (const q of game.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
  for (const g of game.ghosts) g.life -= dt;
  for (const w of game.swooshes) w.life -= dt;
  game.swooshes = game.swooshes.filter(w => w.life > 0);
  game.ghosts = game.ghosts.filter(g => g.life > 0);
  game.particles = game.particles.filter(q => q.life > 0);
  for (const r of game.rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 12); }
  game.rings = game.rings.filter(r => r.life > 0);
  for (const b of game.beams) b.life -= dt;
  game.beams = game.beams.filter(b => b.life > 0);
  for (const f of game.floaters) { f.y += f.vy * dt; f.life -= dt; }
  game.floaters = game.floaters.filter(f => f.life > 0);
  if (game.muzzle && (game.muzzle.life -= dt) <= 0) game.muzzle = null;
  game.shake = Math.max(0, game.shake - dt);
}
