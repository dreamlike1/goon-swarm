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

// v0.52: what comes next is up to the run's clock (flow.js pickUnit), not your level.
function spawnEnemy() {
  const p = game.player;
  const u = pickUnit(), type = u.type, T = ENEMY_TYPES[type], R = T.r;
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
  // the purple ones: split squares split in two; a purple triangle is an exploder (v0.51). The wave says which (v0.52).
  const e = makeEnemy(type, best.x, best.y, !!u.split);
  if (u.boom) e.boom = true;
  if (u.n) e.n = u.n;                   // (how much room it takes in the swarm)
  const tough = game.flow?.tough, vet = vetHp(u);   // after a test swarm you beat, some come in tougher (flow.js FLOW.test);
  let mul = vet;                                    // and later in the stage the basic shapes do (FLOW.vet). Unmarked (user).
  if (tough && Math.random() < tough.share) { mul *= tough.hp; e.tough = true; }
  if (mul > 1) e.hp = e.maxHp = Math.round(e.hp * mul);
  testCount('spawned');
  game.enemies.push(e);
  aliveEl.textContent = game.enemies.length;
}

// One enemy of `type` at (x, y). `split`: the red-purple version that splits in two when it dies.
function makeEnemy(type, x, y, split = false) {
  const T = ENEMY_TYPES[type], hp = Math.round(enemyHp(type, game.level) * coopHp() * runHp());   // co-op: tougher; and each run of the loop (flow.js RUN)
  const e = {
    x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    type, shape: T.shape, r: T.r, dmg: Math.round(enemyDmg(type, game.level) * adaptDmg() * runDmg()) + adaptArmor(), hp, maxHp: hp, split,   // (flow.js FLOW.adapt, RUN)
    hit: 0, born: 0, speed: T.speed * enemySpeedMul(game.level) * (0.85 + Math.random() * 0.3),
  };
  // Crabs (mini dinos before v0.46) have a small state machine (see moveRaptor in boss.js).
  if (T.shape === 'crab') Object.assign(e, { state: 'walk', t: 0, dir: 0, face: 0, step: 0, anim: 0, throwing: null, recoil: 0, cd: RAPTOR.every[0] });
  if (type === 'lunger') Object.assign(e, { state: 'walk', t: 0, dir: 0, cd: between(LUNGER.every) });   // (boss.js moveLunger)
  return e;
}
const enemyCol = e => COL[e.split ? `${e.type}-split` : e.boom ? 'triangle-split' : e.type];

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

// Where an enemy can be hit (v0.46, user: the bosses' hitboxes should fit them and grow with them). Most are a circle
// of radius r round (x, y). SKURTOSAURUS and MAKORA are a capsule: that circle slid along a line through their body
// (`e.cap`: its two ends, as offsets from x, y; boss.js sizeBoss, makora.js sizeMakora), so their chest and head can be
// hit too, not only their middle. hitPoint: the point on that line nearest (x, y); hitGap: how far (x, y) is from its edge.
function hitPoint(e, x, y) {
  const parts = e.parts || (e.cap ? [[...e.cap, e.r]] : null);
  if (!parts) return e;
  let best = null, bd = Infinity;
  for (const c of parts) {                                   // v0.52: a boss can have several shapes (hitboxes.js)
    const ax = e.x + c[0], ay = e.y + c[1], vx = c[2] - c[0], vy = c[3] - c[1];
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
    const q = { x: ax + vx * t, y: ay + vy * t, r: c[4] }, gap = Math.hypot(x - q.x, y - q.y) - q.r;
    if (gap < bd) { bd = gap; best = q; }
  }
  return best;
}
const hitGap = (e, x, y) => { const q = hitPoint(e, x, y); return Math.hypot(x - q.x, y - q.y) - (q.r ?? e.r); };
// A boss's hitbox for its pose right now (v0.52, hitboxes.js): its shapes for this state (or its default ones), scaled
// by `u` (its size / 30) and flipped to the side it faces. `e.r` becomes the biggest shape's radius.
// Each shape is pinned to a body part (its 6th value: 'root' — the legs, and the jump — 'body', 'head' …) and follows
// it: the draw code marks every part's frame as it draws it (boneMark), so a jump, a lean or a nod carries the shape
// along. Before the boss has been drawn once, the shapes sit as they would on its default pose.
function applyHitbox(e, kind, u, face = 1) {
  const H = HITBOXES[kind], list = H && (H[e.state] || H.default);
  if (!list || !list.length) return false;
  const B = e.bones;
  e.parts = list.map(([x1, y1, x2, y2, r, bone = 'root']) => {
    const m = B && B[bone];
    if (!m) return [x1 * u * face, y1 * u, x2 * u * face, y2 * u, r * u];
    return [m[0] * x1 + m[2] * y1 + m[4], m[1] * x1 + m[3] * y1 + m[5], m[0] * x2 + m[2] * y2 + m[4], m[1] * x2 + m[3] * y2 + m[5],
      r * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))];
  });
  e.cap = e.parts[0].slice(0, 4);
  e.r = Math.max(...e.parts.map(c => c[4]));
  return true;
}
// A body part's frame, as it's drawn (v0.52): from its drawing units to px from the boss's middle. `boneInv` undoes the
// camera (draw.js sets it each frame, the hitbox editor its own); `toWorld` is for a part drawn on another canvas
// (MAKORA's), from that canvas's px to the world.
let boneInv = null;
function boneMark(e, name, c = ctx, toWorld = null) {
  const m = toWorld ? toWorld.multiply(c.getTransform()) : boneInv ? boneInv.multiply(c.getTransform()) : null;
  if (m) (e.bones ||= {})[name] = [m.a, m.b, m.c, m.d, m.e - e.x, m.f - e.y];
  bonePaint(e, name, c);
}
// The hitbox editor's view of the parts (localhost only): while `boneHL` is set for this boss, everything drawn from
// here on (until the canvas state is restored) gets that part's filter, so each part's own pixels show. Off in a run.
let boneHL = null;
function bonePaint(e, name, c = ctx) {
  if (boneHL && boneHL.e === e) c.filter = boneHL.filter(name);
}

// The nearest enemy to a point, skipping any in `skip`, optionally within `range`.
// Distances are to the enemy's edge, not its middle (v0.30, user: you had to be right up against SKURTOSAURUS, whose
// middle is 50 px in, before your cards would fire at it).
function nearestEnemy(from = game.player, skip = null, range = Infinity) {
  let best = null, bd = range;
  for (const e of game.enemies) {
    if (skip && skip.has(e)) continue;
    const d = hitGap(e, from.x, from.y);
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
    tallyCombo(cb);                                  // (the online run log, flow.js)
    const evs = [];
    for (let k = 0; k < cb.n; k++) { const ev = deck.draw(); evs.push(ev); onAttack(ev); }   // one at a time, so the tray and log keep up
    const slots = evs.map(ev => ev.slot);
    // The combo plays with every augment in its slots; a DUPE slot anywhere in it plays the whole combo a second time,
    // a moment later.
    withAug(slots, () => { runCombo(cb); if (slots.some(i => augAt(i) === 'dupe')) later(0.3, () => runCombo(cb, true)); });
    const last = evs[evs.length - 1];
    return { ...last, card: cb.card, rush: augPlayed(slots), reshuffle: evs.find(ev => ev.reshuffle)?.reshuffle || null, sequence: evs.find(ev => ev.sequence)?.sequence || null };
  }
  const ev = deck.draw();
  withAug([ev.slot], () => shoot(ev.card, inRange(ev.card) || nearestEnemy()));
  // A DUPE slot fires its card a second time, a moment later. The extra shot doesn't draw from the deck.
  if (augAt(ev.slot) === 'dupe') game.echoes.push({ card: ev.card, t: ECHO_DELAY });
  onAttack(ev);
  ev.rush = augPlayed([ev.slot]);
  return ev;
}

// The melee deck's turn (v0.53): like fire(), but it never waits for a target (melee.js).
function fireMelee() {
  const cb = comboAt(mdeck.sequence, mdeck.seqPos);
  if (cb) {
    tallyCombo(cb);
    const evs = [];
    for (let k = 0; k < cb.n; k++) { const ev = mdeck.draw(); evs.push(ev); onMeleeAttack(ev); }
    const slots = evs.map(ev => ev.slot);
    const hit = withAug(slots, () => { const h = meleeCombo(cb, false); if (slots.some(i => augAt(i) === 'dupe')) later(0.3, () => runCombo(cb, true)); return h; });
    return { hit, card: cb.card, rush: augPlayed(slots), reshuffle: evs.find(ev => ev.reshuffle)?.reshuffle || null };
  }
  const ev = mdeck.draw();
  const hit = withAug([ev.slot], () => meleeStrike(ev.card, inRange(ev.card)));   // (a BIG slot reaches further: rangeOf)
  if (augAt(ev.slot) === 'dupe') game.echoes.push({ card: ev.card, t: ECHO_DELAY });   // (a DUPE slot: both decks')
  onMeleeAttack(ev);
  return { hit, card: ev.card, rush: augPlayed([ev.slot]), reshuffle: ev.reshuffle };
}

/* ---------- augments (v0.68, user; config.js AUGS) ---------- */
// The augment on a deck slot (slot n of every deck), or null.
const augAt = slot => game.aug.get(slot) || null;
// What a play from these slots carries onto everything it does: DMG, CRIT and BIG (null if none of them).
function augFlags(slots) {
  const f = {};
  for (const i of slots) { const k = augAt(i); if (k === 'dmg' || k === 'crit' || k === 'big') f[k] = true; }
  return Object.keys(f).length ? f : null;
}
// Runs a play with its slots' augments on (AUG_FX), and grows what a BIG one left on the floor straight away.
function withAug(slots, fn) {
  const was = AUG_FX;
  AUG_FX = augFlags(slots);
  try { return fn(); } finally { if (AUG_FX?.big) bigUp(); AUG_FX = was; }
}
// BIG: everything a BIG play left on the floor (shots, swings, runes, fields…) grows once: its size, reach and width,
// so it looks bigger and hits a bigger area. (A swing and a blast size themselves as they hit: `bigged`, blast. Reach
// isn't grown here: it comes from rangeOf, which already grew; so a Super Washer's sweep, the length of its range.)
const BIG_LISTS = ['projectiles', 'melees', 'sinfx', 'mines', 'beams', 'zones', 'fields', 'kicks'];
const BIG_KEYS = ['r', 'radius', 'len', 'w', 'size'];
function bigUp() {
  for (const k of BIG_LISTS) for (const o of game[k] || []) {
    if (!o.aug?.big || o.bigged) continue;
    o.bigged = true;
    for (const f of BIG_KEYS) if (typeof o[f] === 'number') o[f] *= AUG.big;
  }
}
// After a play: MAGNET pulls in the orbs around you. True if a RUSH slot played (the next card goes straight away).
function augPlayed(slots) {
  const kinds = slots.map(augAt);
  if (kinds.includes('magnet')) {
    const p = game.player;
    let n = 0;
    for (const o of game.orbs) if (!o.magnetized && Math.hypot(o.x - p.x, o.y - p.y) < AUG.magnet) { o.magnetized = true; n++; }
    if (n) game.rings.push({ x: p.x, y: p.y, r: AUG.magnet, max: PLAYER.r, life: 0.3, color: COL.xp });   // (closing in)
  }
  return kinds.includes('rush');
}
// How long until a deck's next card after this play: a RUSH slot's next goes almost at once (a shuffle still takes its time).
const nextWait = r => (r.rush ? AUG.rush : attackInterval() * paceMul(r.card)) + (r.reshuffle ? shuffleTime() : 0);

// The Wild deck's turn (v0.62): its card plays exactly as the ranged or the melee deck's would (fire / fireMelee), with
// the Wild deck standing in for that deck for the moment, and its tray (hud.js, WILD) showing it.
let WILD = false;
function wildTurn(fn) {
  const d = deck, m = mdeck;
  if (isMelee(wdeck.sequence[wdeck.seqPos])) mdeck = wdeck; else deck = wdeck;
  WILD = true;
  try { return fn(); } finally { deck = d; mdeck = m; WILD = false; }
}
function wildDeckStep(dt) {
  game.wcool -= dt;
  const seq = wdeck.sequence, pos = wdeck.seqPos, next = seq[pos];
  if (!next) return;
  if (isMelee(next)) {                               // as the melee deck: it never waits for an enemy in reach
    if (game.wcool > 0 && !(game.wprimed && nearestEnemy(game.player, null, meleeReach(seq, pos)))) return;
    const r = wildTurn(fireMelee);
    game.wprimed = !r.hit;
    game.wcdTotal = nextWait(r);
    game.wcool = Math.min(0, game.wcool) + game.wcdTotal;
  } else if (game.wcool <= 0) {                      // as the ranged deck: it waits for something in range
    if (!(CARDS[next].auto || inRange(next))) { game.wcool = 0; return; }
    const ev = wildTurn(fire);
    game.wcdTotal = nextWait(ev);
    game.wcool += game.wcdTotal;
  }
}

// The nearest enemy within a card's attack range, or null.
// Attack range upgrades stretch every ranged card's range; melee reach stays as it is (v0.55, user).
const rangeOf = card => (CARDS[card].range || Infinity) * (CARDS[card].melee ? 1 : 1 + stats.range) * bigK();   // (a BIG slot's reach too, v0.68)
const inRange = (card, from = game.player) => nearestEnemy(from, null, rangeOf(card));
const knockOf = base => base * (1 + stats.knock);   // the Knockback upgrade pushes every hit harder

// Runs `fn` after `t` seconds of play (paused time doesn't count).
function later(t, fn) { game.timers.push({ t, fn, owner: ownerId(), aug: AUG_FX }); }

// Mine: placed where the player stands, or `dist` px away at angle `a` (the mine combos). Too many on the field and
// the oldest one is cleared. In the store's test mode it's placed under the target dummy, which never moves.
function dropMine(card, a = 0, dist = 0, quiet = false) {
  const dummy = game.practice && !game.practice.battle && game.practice.dummies[0];   // old test mode: around the main dummy
  const c = dummy || game.player;      // the test arena (v0.57) has no dummies: drop it under the player like a real run
  const m = { x: c.x + Math.cos(a) * dist - (dummy && !dist ? c.r + 4 : 0), y: c.y + Math.sin(a) * dist, t: 0, card, owner: ownerId(), aug: AUG_FX };
  clampTo(m, 8);
  game.mines.push(m);
  if (game.mines.length > MINE_MAX) game.mines.shift();
  if (!quiet) SFX.fire(card);
}

// Pressure Washer (user): an instant cone of spray from the player, hitting and pushing back everything inside.
// `wipe` (WASH CONE!, user): the cone wipes across as it appears instead of popping in all at once (draw.js).
function spray(card, angle, arc, range, o = {}) {
  const p = game.player, dmg = damageOf(o.dmg ?? CARDS[card].dmg), knock = knockOf(o.knock ?? CARDS[card].knock);
  for (const e of game.enemies.slice()) {
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d > range + e.r) continue;
    let diff = Math.atan2(dy, dx) - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > arc / 2 + Math.atan2(e.r, Math.max(d, 1))) continue;
    hitEnemy({ card, look: 'spray', dmg, knock, vx: dx / (d || 1), vy: dy / (d || 1), x: e.x, y: e.y }, e);
  }
  const life = o.wipe ? 0.36 : 0.22;
  game.sprays.push(pinTo({ x: p.x, y: p.y, a: angle, arc, range, card, life, max: life, wipe: !!o.wipe, seed: Math.random() * 10 }));
  const col = COL[card];   // droplets flicked out along the cone (drawn as water: draw.js)
  for (let k = 0, n = o.wipe ? 20 : 11; k < n; k++) {
    const da = angle + (Math.random() - 0.5) * arc, s = 140 + Math.random() * 240, d = range * (0.15 + Math.random() * 0.5);
    game.particles.push({ x: p.x + Math.cos(da) * d, y: p.y + Math.sin(da) * d, vx: Math.cos(da) * s, vy: Math.sin(da) * s, life: 0.22 + Math.random() * 0.25, color: col, drop: true });
  }
  if (!o.quiet) SFX.fire(card);
}
function updateSprays(dt) {
  for (let i = game.sprays.length - 1; i >= 0; i--) if ((game.sprays[i].life -= dt) <= 0) game.sprays.splice(i, 1); else followOwner(game.sprays[i]);
}
// Super Washer (user): two sprays spin a full turn around you (reuses Laser ×7's sweep, twice, offset by half a turn).
// `dur`: a faster spin (its combos, v0.65), with no hold before it.
function superSweep(card, range, dmg, dur) {
  const a0 = Math.random() * Math.PI * 2;
  sweep(card, a0, range, damageOf(dmg), dur);
  sweep(card, a0 + Math.PI, range, damageOf(dmg), dur);
}
// SOAK TRAIL! (Super Washer ×7, user): `soakTrail.time` s of extra speed (upgrades.js moveSpeed), both sprays
// re-spinning every `every` s, and a trail of bubbles dropped behind you that explode after `trailDelay` s.
function startSoak(card, range, dmg) {
  const S = TUNE.soakTrail;
  Object.assign(game, { soakT: S.time, soakCard: card, soakRange: range, soakDmg: dmg, soakSweep: 0, soakDrop: 0 });
  superSweep(card, range, dmg, S.spin);
}
function updateSoak(dt) {
  if (!(game.soakT > 0)) return;
  const S = TUNE.soakTrail, p = game.player;
  game.soakT = Math.max(0, game.soakT - dt);
  if ((game.soakSweep -= dt) <= 0) { game.soakSweep = S.every; superSweep(game.soakCard, game.soakRange, game.soakDmg, S.spin); }
  if ((game.soakDrop -= dt) <= 0) { game.soakDrop = S.dropEvery; game.trails.push({ x: p.x, y: p.y, t: S.trailDelay, card: game.soakCard, seed: Math.random() * 10 }); }
  const sv = Math.hypot(p.svx || 0, p.svy || 0);              // sliding (v0.65): water kicked up behind you
  if (!reducedMotion && sv > 60 && Math.random() < dt * 40) {
    const b = Math.atan2(-p.svy, -p.svx) + (Math.random() - 0.5) * 1.2, v = 60 + Math.random() * 90;
    game.particles.push({ x: p.x + Math.cos(b) * PLAYER.r, y: p.y + Math.sin(b) * PLAYER.r, vx: Math.cos(b) * v, vy: Math.sin(b) * v - 30, life: 0.3 + Math.random() * 0.2, color: COL.superwasher, drop: true });
  }
}
function updateTrails(dt) {
  for (let i = game.trails.length - 1; i >= 0; i--) {
    const t = game.trails[i];
    if ((t.t -= dt) <= 0) { game.trails.splice(i, 1); blast(t.x, t.y, t.card, TUNE.soakTrail.trailRadius, damageOf(CARDS[t.card].dmg), { knock: 140 }); }
  }
}

// Laser: an instant zap from the player to `e`, drawn as a beam for a moment (draw.js).
function zap(card, e, o = {}) {
  const spec = CARDS[card], p = game.player, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
  const wall = snekWall(p.x, p.y, e.x, e.y);                // AWAS THE SNEK's body in the way: the zap stops there (snek.js)
  const b = { x1: p.x, y1: p.y, x2: wall ? wall.x : e.x, y2: wall ? wall.y : e.y, life: 0.14, max: 0.14, w: 3, card, owner: ownerId(), aug: AUG_FX, target: wall ? null : e };
  game.beams.push(b);
  pinBeam(b);
  if (wall) snekBlocked(wall);
  else hitEnemy({ card, look: 'laser', dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  if (o.quiet) return;
  setMuzzle(Math.atan2(dy, dx), 0.08, card);
  SFX.fire(card);
}
// Attacks that show for a moment stay on whoever fired them (user: moving fast or zig-zagging, they were left behind
// where they fired, over you or with a gap). `pinTo` notes the owner and the offset from them; `followOwner` puts
// it back there each frame (sprays, the Gatling's barrel flashes). A laser's beam goes from the edge of your circle
// to wherever its target is now (pinBeam).
const ownerBody = o => (NET.run && byId(o.owner)?.body) || game.player;
function pinTo(o) {
  const p = game.player;
  return Object.assign(o, { owner: ownerId(), aug: AUG_FX, ox: o.x - p.x, oy: o.y - p.y });
}
function followOwner(o) {
  const p = ownerBody(o);
  o.x = p.x + o.ox; o.y = p.y + o.oy;
}
function pinBeam(b) {
  if (b.free) return;                    // (CHAIN ZAP!'s jumps go from enemy to enemy)
  const p = ownerBody(b), e = b.target;
  if (e && !e.dead && !e.gone && game.enemies.includes(e)) { b.x2 = e.x; b.y2 = e.y; }
  const dx = b.x2 - p.x, dy = b.y2 - p.y, d = Math.hypot(dx, dy) || 1, off = Math.min(PLAYER.r + 2, d);
  b.x1 = p.x + dx / d * off; b.y1 = p.y + dy / d * off;
}
// Laser ×7: a line at angle a0, held for a moment, then swept a full turn back to where it started. Every enemy the
// beam passes over (within `len`) is hit once. `dur`: its own (faster) sweep, with no hold (Super Washer's combos).
function sweep(card, a0, len, dmg, dur) {
  game.sweeps.push({ card, a0, len, dmg, t: 0, prev: a0, hits: new Set(), owner: ownerId(), aug: AUG_FX, ...(dur ? { dur, hold: 0 } : {}) });
  if (!dur || often('sweep', 110)) SFX.sweep();
}
function updateSweeps(dt) {
  for (let i = game.sweeps.length - 1; i >= 0; i--) {
    const sw = game.sweeps[i], hold = sw.hold ?? TUNE.sweep.hold, dur = sw.dur ?? TUNE.sweep.dur;
    usePlayerId(sw.owner, sw.aug);
    const p = game.player;
    sw.t += dt;
    const k = Math.max(0, Math.min(1, (sw.t - hold) / dur)), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;   // ease in-out
    const a = sw.a0 + e * Math.PI * 2;
    for (const en of game.enemies.slice()) {
      if (sw.hits.has(en)) continue;
      const q = hitPoint(en, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
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
// that was already hit directly. `big` adds the heavier effects (sound, shake, particles). `stun` (Soap Gun's
// BUBBLE TRAP!, user): everything caught freezes in place for this long before the knockback throws it out.
function blast(x, y, card, radius, dmg, { skip = null, knock = 160, big = false, stun = 0, sized = false } = {}) {
  if (!sized) radius *= bigK();          // a BIG slot's blast (v0.68); `sized`: its radius already grew with what it came from
  for (const e of game.enemies.slice()) {
    if (e === skip) continue;
    const q = hitPoint(e, x, y), dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
    if (d > radius + e.r) continue;
    if (stun) e.stun = Math.max(e.stun || 0, stun);
    hitEnemy({ card, look: 'blast', dmg, knock: knockOf(knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  }
  game.rings.push({ x, y, r: 6, max: radius, life: big ? 0.45 : 0.3, color: COL[card] });
  burst(x, y, COL[card], big ? 34 : 12, big ? 320 : 200, WET.has(card));
  if (WET.has(card)) splashFx(x, y, COL[card], radius * 0.5, 0.4);   // SOAK TRAIL!'s puddles burst as water
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
  const spec = upSpec(card), p = game.player;   // (its stats at its tier, v0.62: tiers.js)
  game.projectiles.push({
    card, look: spec.look, r: o.r || spec.r, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), speed: spec.start, top: spec.speed,
    start: spec.start, ramp: spec.ramp, age: 0, straight: true, pierce: o.pierce ?? (spec.pierce || 0), bounces: 0, hits: new Set(), spin: 0,
    target: null, a, x: p.x + Math.cos(a) * (PLAYER.r + 4), y: p.y + Math.sin(a) * (PLAYER.r + 4), big: !!o.big,
    vx: Math.cos(a) * spec.start, vy: Math.sin(a) * spec.start, trail: [], flown: 0, range: o.range || 0, endBlast: o.endBlast || null, owner: ownerId(), aug: AUG_FX,
  });
  if (!e) return;                       // part of a burst: the burst handles sound and muzzle
  setMuzzle(a, 0.12, card);
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
//   extra: more fields for the shot itself (the Ulti Magus pack's: what it does when it hits, magus.js magusHit)
// Every shot fizzles once it has flown a bit past its card's range. Returns the shot (if it made one).
function shoot(card, e, o = {}) {
  const spec = upSpec(card);                                 // the card at its tier (v0.62: more pellets, bounces, sleep…)
  const p = o.from || game.player;
  if (spec.tball && !o.raw) { tballPlay(card, e, o); return; }   // the T-Balls: from a ball, one effect at random (tballs.js)
  if (spec.melee) { meleeStrike(card, e, o); return; }       // a melee card (melee.js): a stab or a punch, if it can reach
  if (spec.look === 'mine') { dropMine(card); return; }
  if (spec.silica && !o.raw) { silicaShot(card, e, o); return; }   // the Silica pack's weapons (silica.js)
  if (spec.magus && !o.raw) { magusShot(card, e, o); return; }     // the Ulti Magus pack's (magus.js)
  if (spec.look === 'chess' && !o.raw) { chessShot(card, e, o); return; }   // EN PASSANT: a random chess piece (chess.js)
  if (spec.look === 'kalash') { akBurst(card, e ? Math.atan2(e.y - p.y, e.x - p.x) : 0, o); return; }   // KARISHNIKOV: a burst into a cone
  if (spec.look === 'laser') { zap(card, e, o); return; }
  if (spec.look === 'spray') { spray(card, e ? Math.atan2(e.y - p.y, e.x - p.x) : 0, o.arc ?? spec.arc, rangeOf(card), o); return; }
  if (spec.look === 'orbit') { superSweep(card, rangeOf(card), o.dmg ?? spec.dmg); return; }   // Super Washer (user)
  if (spec.pops && o.split == null) o = { ...o, split: spec.pops };   // Soap Gun (user): pops into more bubbles on a hit
  if (spec.volley && !o.one && e) {                          // Arcane Missiles: 4 (v0.66), fanned out evenly to the sides, each at its own target
    const n = spec.volley, ts = targets(n, rangeOf(card)), a0 = Math.atan2(e.y - p.y, e.x - p.x);
    for (let k = 0; k < n; k++) shoot(card, ts[k] || e, { ...o, one: true, angle: a0 + (n > 1 ? (k / (n - 1)) * 2 - 1 : 0) * TUNE.missile.spread, quiet: o.quiet || k > 0 });
    return;
  }
  if (spec.pellets && !o.one && e) {                         // Shotgun (v0.58): a cone of small pellets, each straight on its way
    const a0 = Math.atan2(e.y - p.y, e.x - p.x), sp = o.spread ?? spec.spread, n = spec.pellets;
    for (let k = 0; k < n; k++) shoot(card, e, { ...o, one: true, noHome: true, quiet: o.quiet || k > 0, speedMul: 0.9 + Math.random() * 0.2,
      angle: a0 + (k / (n - 1) - 0.5) * sp + (Math.random() - 0.5) * 0.08 });
    if (!o.quiet) game.shake = Math.max(game.shake, 0.06);
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
  const pr = {
    card, look: spec.look, r: o.r || spec.r, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), speed,
    bounces: o.bounces ?? (spec.bounces || 0), bounceRange: o.bounceRange || BOUNCE_RANGE, hits: new Set(o.skip ? [o.skip] : []), spin: 0, target: e,
    aoe: o.aoe ? { radius: o.aoe.radius, dmg: damageOf(o.aoe.dmg) } : null, big: !!o.r,
    // missiles fly out to the side for a moment, then steer in (a turn rate rather than snapping round)
    homeDelay: o.noHome ? Infinity : (o.homeDelay ?? (steer ? TUNE.missile.curve : 0)), split: o.split || 0, field: o.field || null,
    turn: steer ? TUNE.missile.turn * speed / spec.speed : 0,   // faster missiles turn faster, so they still curve in the same space
    flown: 0, maxDist: o.maxDist ?? rangeOf(card) * (steer ? 2.2 : 1.35), age: 0, stun: o.stun || 0,   // Soap Gun ×3 (user): stuns on a hit
    // v0.58: Brickshot's brick (its bounces, for the shield), and the shells that burst instead of just hitting
    // (Grapeshot's pellets, Flashbang's flash: its damage, size and how long it dazes)
    brick: spec.look === 'brick', bounce0: o.bounces ?? (spec.bounces || 0), burst: spec.grape ? 'grape' : spec.look === 'flashbang' ? 'flash' : null,
    flashDmg: o.flashDmg || 0, flashR: o.flashR || spec.radius || 0, flashDaze: o.flashDaze || spec.daze || 0,
    // v0.59: Blowpipe's darts (how long they put what they hit to sleep; BERSERK!'s red one)
    sleep: o.sleep ?? (spec.sleep || 0), berserk: o.berserk || 0, red: !!o.red,
    sway: Math.random() * TAU,   // Soap Gun (user): a stable per-bubble phase for its floaty sway (draw.js), unused otherwise
    x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, trail: [], owner: ownerId(), aug: AUG_FX,
    ...(o.extra || {}),
  };
  game.projectiles.push(pr);
  if (o.quiet) return pr;
  setMuzzle(a, 0.12, card);
  SFX.fire(card);
  if (spec.look === 'heavy') game.shake = Math.max(game.shake, 0.08);
  return pr;
}

// MISSILE STORM!: a missile that hits splits into `pr.split` smaller ones, each after the nearest other enemies (they
// fly off to the sides and fizzle if there are none).
function splitMissile(pr, hit) {
  const others = game.enemies.filter(en => en !== hit && !en.dead).sort((a, b) => Math.hypot(a.x - pr.x, a.y - pr.y) - Math.hypot(b.x - pr.x, b.y - pr.y));
  const a0 = Math.atan2(pr.vy, pr.vx);
  for (let k = 0; k < pr.split; k++) {
    const e = others[k % Math.max(1, others.length)] || null, side = k % 2 ? 1 : -1;
    // split: 0 (user's Soap Gun, via `spec.pops`): a split child never re-splits, however many enemies are around.
    const o = { one: true, from: { x: pr.x, y: pr.y }, angle: a0 + side * 1.1, quiet: true, skip: hit, speedMul: 1.3, r: 3, split: 0 };
    if (e) shoot(pr.card, e, o);
    else shoot(pr.card, hit, { ...o, noHome: true });
  }
  burst(pr.x, pr.y, COL[pr.card], 8, 160);
}

// An Arcane Missile's impact (v0.66): runes on the floor, a shaft of light, shards (draw.js drawArcaneHit). Not too many at once.
function arcaneHit(x, y, dir, r) {
  let n = 0;
  for (const f of game.sinfx) if (f.kind === 'amhit') {
    if (f.max - f.life < 0.12 && Math.hypot(f.x - x, f.y - y) < 16) return;   // (missiles landing together: one impact, not a white-out)
    n++;
  }
  if (n >= AMH.max) return;
  game.sinfx.push({ kind: 'amhit', x, y, dir, size: 6 + r * 2, rot: Math.random() * TAU, seed: Math.random() * 1e9, life: AMH.life, max: AMH.life, fixed: true });
}
// Brickshot (v0.58, user): a brick that kills on its second bounce gives you a light blue shield, extra health on top of
// yours for `time` s, fading out at the end (hurtPlayer takes hits off it first; the HP bar shows it: hud.js).
const BRICK = { shield: 12, time: 1.5 };
function brickShield() {
  const p = game.player;
  game.bshield = { hp: BRICK.shield, t: BRICK.time };
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 26, life: 0.4, color: COL.bshield });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 14, text: '+SHIELD', color: COL.bshield, life: 0.8, vy: -40, big: true });
  SFX.tball('shield');
  renderHp(false);
}
// Laser ×7, CHAIN ZAP! (v0.58, user): one laser that jumps from enemy to enemy, `count` of them, in super quick succession.
function chainZap(card, e0, C) {
  const hits = new Set(), spec = CARDS[card];
  let from = null, e = e0;
  const step = k => {
    if (!e || !game.enemies.includes(e)) return;
    hits.add(e);
    const at = { x: e.x, y: e.y };
    if (!from) zap(card, e);
    else {
      game.beams.push({ x1: from.x, y1: from.y, x2: at.x, y2: at.y, life: 0.18, max: 0.18, w: 3, card, owner: ownerId(), aug: AUG_FX, free: true });
      hitEnemy({ card, look: 'laser', dmg: damageOf(spec.dmg), knock: knockOf(spec.knock), vx: at.x - from.x, vy: at.y - from.y, x: at.x, y: at.y }, e);
      SFX.fire(card);
    }
    from = at;
    if (k + 1 >= C.count) return;
    e = nearestEnemy(from, hits, C.reach);
    if (e) later(C.gap, () => step(k + 1));
  };
  step(0);
}
// A straight shot from anywhere (v0.58: Grapeshot's pellets and GRAPE RAIN!): along `a`, gone after `range` px, hitting
// the first enemy in its way. o.endBlast: a blast where it ends.
// o.pierce: how many it goes through. Returns the shot.
function straightShot(card, x, y, a, o = {}) {
  const spec = CARDS[card], sp = o.speed || spec.speed, pr = {
    card, look: o.look || 'streak', r: o.r || 3, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(o.knock ?? spec.knock), speed: sp, top: sp, start: sp, ramp: 0.01,
    age: 0, straight: true, pierce: o.pierce || 0, bounces: 0, hits: new Set(), spin: 0, target: null, a, x, y, big: false,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, trail: [], flown: 0, range: o.range || 160, endBlast: o.endBlast || null, owner: ownerId(), aug: AUG_FX,
  };
  game.projectiles.push(pr);
  return pr;
}
// Grapeshot (v0.58, user): the shell bursts into `grape` pellets, each starting from a random spot inside a hidden
// circle round where it burst, and flying off in a random direction.
const GRAPE = { radius: 34, range: 120, speed: 520 };
function grapeBurst(pr, x, y) {
  for (let k = 0, n = upSpec(pr.card).grape || 5; k < n; k++) {
    const d = Math.sqrt(Math.random()) * GRAPE.radius, b = Math.random() * TAU;
    straightShot(pr.card, x + Math.cos(b) * d, y + Math.sin(b) * d, Math.random() * TAU, { range: GRAPE.range * (0.7 + Math.random() * 0.6), speed: GRAPE.speed, r: 3 });
  }
  burst(x, y, COL[pr.card], 10, 200);
  game.rings.push({ x, y, r: 4, max: 30, life: 0.2, color: COL[pr.card] });
  SFX.hit(true);
}
// GRAPE RAIN! (Grapeshot ×7): shots dropping out of the sky all over the arena, each with a small blast where it lands
// (or on whatever it hits on the way down).
function grapeRain(card, R) {
  // (inside whatever the fight is in: the test arena's box, AWAS THE SNEK's grid, or the arena)
  const b = game.practice?.box || (game.snek && !game.snek.huge ? game.snek.box : null) || { x: 0, y: 0, w: W, h: playH || H };
  for (let k = 0; k < R.count; k++) later(k * R.gap, () => {
    const x = b.x + 20 + Math.random() * (b.w - 40), y = b.y + 20 + Math.random() * (b.h - 40), y0 = Math.max(-30, y - R.fall);
    straightShot(card, x, y0, Math.PI / 2, { range: y - y0, speed: 900, r: 4, dmg: R.dmg, look: 'rain', endBlast: { radius: R.radius, dmg: damageOf(R.dmg), knock: 60 } });
  });
  SFX.burst();
}
// Flashbang (v0.58, user): a white flash where it lands. Everything within its radius is dazed: it stops where it is
// (e.stun) with a little dazed swirl over it (draw.js). FLASH BURN! and WHITEOUT! hurt them too (`flashDmg`).
function flashBurst(pr, x, y) {
  const R = pr.flashR, daze = pr.flashDaze;
  for (const e of game.enemies.slice()) {
    if (hitGap(e, x, y) > R) continue;
    e.stun = Math.max(e.stun || 0, daze); e.dazed = Math.max(e.dazed || 0, daze);
    if (pr.flashDmg) hitEnemy({ card: pr.card, look: 'blast', dmg: damageOf(pr.flashDmg), knock: 0, vx: e.x - x, vy: e.y - y, x: e.x, y: e.y }, e);
  }
  game.melees.push({ kind: 'flash', x, y, r: R, fixed: true, life: 0.5, max: 0.5, card: pr.card });   // the flash itself (melee.js drawMelees)
  game.rings.push({ x, y, r: 6, max: R, life: 0.4, color: '#ffffff' });
  game.shake = Math.max(game.shake, R > 150 ? 0.25 : 0.1);
  SFX.boom();
}

// Blowpipe (v0.59, user): asleep, it stops where it is (e.stun) with a zzz over it (draw.js drawDazed). A boss only
// nods off for a moment.
const SLEEP = { boss: 0.5 };
const bossLike = e => !!(e.boss || e.obi || e.makora || e.hugeSnek || e.apple || e.mrock);
function sleepEnemy(e, t) {
  if (e.dead || e.dummy) return;
  if (bossLike(e)) t = Math.min(t, SLEEP.boss);
  e.stun = Math.max(e.stun || 0, t); e.sleep = Math.max(e.sleep || 0, t);
}
// BERSERK! (Blowpipe ×7): for `t` s the enemy forgets you, runs at the nearest other enemy and bites it, again and
// again (TUNE.berserk). A boss can't be turned; it just takes the dart.
function berserkEnemy(e, t) {
  if (e.dead || e.dummy || bossLike(e) || e.fling) return;
  e.berserk = t; e.stun = 0; e.sleep = 0; e.bite = 0; e.bowner = ownerId();
  game.floaters.push({ x: e.x, y: e.y - e.r - 12, text: 'BERSERK!', color: COL.berserk, life: 0.9, vy: -36, big: true });
  game.rings.push({ x: e.x, y: e.y, r: e.r, max: e.r + 30, life: 0.35, color: COL.berserk });
}
function berserkStep(e, dt) {
  const B = TUNE.berserk;
  e.berserk -= dt; e.bite -= dt;
  e.kx *= Math.exp(-6 * dt); e.ky *= Math.exp(-6 * dt);
  let prey = null, bd = Infinity;
  for (const o of game.enemies) {
    if (o === e || o.dead || o.apple || o.mrock) continue;
    const d = hitGap(o, e.x, e.y);
    if (d < bd) { bd = d; prey = o; }
  }
  if (!prey) { e.x += e.kx * dt; e.y += e.ky * dt; return; }   // nothing else to fight: it waits, raging
  const q = hitPoint(prey, e.x, e.y), dx = q.x - e.x, dy = q.y - e.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(90, e.speed * B.speedMul);
  e.vx = (dx / d) * sp + e.kx; e.vy = (dy / d) * sp + e.ky;
  if (bd > e.r) { e.x += e.vx * dt; e.y += e.vy * dt; }
  if (bd < e.r * 1.25 + 6 && e.bite <= 0) {                   // a bite (enemies are kept apart, so touching is about its own size off)
    e.bite = B.every;
    usePlayerId(e.bowner);
    hitEnemy({ card: 'blowpipe', look: 'melee', dmg: damageOf(B.bite), knock: knockOf(180), vx: dx, vy: dy, x: q.x, y: q.y }, prey);
    game.rings.push({ x: q.x, y: q.y, r: 4, max: 22, life: 0.2, color: COL.berserk });
    // v0.59 (user): the rage drains it: every bite costs the berserker some of its own life, which bleeds off it
    for (let k = 0; k < 6; k++) game.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 70, life: 0.35 + Math.random() * 0.3, color: COL.berserk, drop: true });
    hitEnemy({ card: 'blowpipe', look: 'melee', dmg: Math.max(1, Math.ceil(e.maxHp * B.drain)), noCrit: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
  }
}

// KARISHNIKOV (v0.59, user: "only show a muzzle, but it fires in a cone, and in the cone they get damaged"): no bullets
// drawn, just the muzzle flash; each round of the burst hits everything in the cone in front of you, within its range.
// o: arc / range / dmg / burst / gap override the card's (the jammed gun's wide cone, combos.js).
function coneHit(card, a, arc, range, dmg, knock) {
  const p = game.player;
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > range) continue;
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a));
    if (Math.abs(diff) > arc / 2 + Math.atan2(q.r ?? e.r, d)) continue;
    hitEnemy({ card, look: 'kalash', dmg, knock, vx: dx / d, vy: dy / d, x: q.x, y: q.y }, e);
  }
}
function akBurst(card, a, o = {}) {
  const spec = upSpec(card), n = o.burst ?? spec.burst, gap = o.gap ?? spec.gap, arc = o.arc ?? spec.arc, range = o.range ?? rangeOf(card);
  for (let k = 0; k < n; k++) later(k * gap, () => {
    const p = game.player, e = nearestEnemy(p, null, range), aa = (e ? Math.atan2(e.y - p.y, e.x - p.x) : a) + (Math.random() - 0.5) * 0.08;   // (it tracks a little, with a bit of kick)
    coneHit(card, aa, arc, range, damageOf(o.dmg ?? spec.dmg), knockOf(spec.knock));
    setMuzzle(aa, 0.07, card);
    SFX.fire(card);
    game.shake = Math.max(game.shake, o.shake ?? 0.05);
  });
}
// KARISHNIKOV ×3 (and the start of ×7): a thin red aiming line onto the target for a moment (`aim` s, following it), then
// one heavy round straight down that line, through everything on it.
// (v0.59, user: "make it better": the line 34 → 60 damage and wider, the jammed cone 8 × 5 → 14 × 8, shorter jam)
// v0.66 (user: "(3) the range becomes farther; and each fire 3 bullets, each succeeding bullet increases damage; keep the
// line animation"): ×3 (`triple`) aims the same red line, but it reaches the arena's edge, stays on through the volley
// (still following its target), and 3 rounds go down it `gap` s apart, each harder, wider and louder than the one before.
const AK = { aim: 0.3, line: { dmg: 60, w: 16, range: 460, knock: 340 }, jam: 0.45, wide: { arc: 1.7, range: 300, burst: 14, gap: 0.05, dmg: 8 },
  triple: { gap: 0.16, dmg: [26, 40, 62], w: [12, 15, 20], knock: [110, 190, 320], beam: [3, 4.5, 6.5], shake: [0.1, 0.15, 0.24] } };
function akLine(card, e, then = null, triple = false) {
  const T = AK.triple, rounds = triple ? T.dmg.length : 1, all = AK.aim + (rounds - 1) * T.gap + 0.04;
  game.sinfx.push({ kind: 'aim', card, target: e, far: triple, life: all, max: all, fixed: true, owner: ownerId(), aug: AUG_FX });
  SFX.sin('mark');
  for (let k = 0; k < rounds; k++) later(AK.aim + k * T.gap, () => {
    const p = game.player, L = AK.line, live = e && game.enemies.includes(e);
    const a = live ? Math.atan2(e.y - p.y, e.x - p.x) : (game.sinfx.find(f => f.kind === 'aim' && f.target === e)?.a ?? p.face ?? 0);
    const range = triple ? Math.max(L.range, edgeDist(p.x, p.y, a) + 20) : L.range, w = triple ? T.w[k] : L.w;
    const dmg = triple ? T.dmg[k] : L.dmg, knock = triple ? T.knock[k] : L.knock;
    const x2 = p.x + Math.cos(a) * range, y2 = p.y + Math.sin(a) * range;
    for (const en of game.enemies.slice()) {                         // everything on the line
      const ex = en.x - p.x, ey = en.y - p.y, along = ex * Math.cos(a) + ey * Math.sin(a), off = Math.abs(-ex * Math.sin(a) + ey * Math.cos(a));
      if (along < 0 || along > range + en.r || off > w + en.r) continue;
      hitEnemy({ card, look: 'kalash', dmg: damageOf(dmg), knock: knockOf(knock), vx: Math.cos(a), vy: Math.sin(a), x: en.x, y: en.y }, en);
    }
    game.beams.push({ x1: p.x, y1: p.y, x2, y2, life: 0.14, max: 0.14, w: triple ? T.beam[k] : 4, card, owner: ownerId(), aug: AUG_FX, free: true });
    setMuzzle(a, 0.16, card);
    SFX.fire('sniper');
    game.shake = Math.max(game.shake, triple ? T.shake[k] : 0.2);
    if (then && k === rounds - 1) then(a);
  });
}
// ×7: after the line, the gun jams (a click, smoke, JAMMED!), then clears with a wider, longer cone.
function akJam(card, a) {
  const p = game.player;
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 14, text: 'JAMMED!', color: COL.text, life: 0.7, vy: -30, big: true });
  SFX.jam();
  for (let k = 0; k < 10; k++) later(k * 0.05, () => {
    const q = game.player;
    game.particles.push({ x: q.x + Math.cos(a) * (PLAYER.r + 6), y: q.y + Math.sin(a) * (PLAYER.r + 6), vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30, life: 0.5 + Math.random() * 0.3, color: '#8a8f99' });
  });
  later(AK.jam, () => akBurst(card, a, { ...AK.wide, shake: 0.12 }));
}

function hitEnemy(pr, e) {
  if (e.dead) return;                   // already killed this frame by another hit (a blast, a pierce): count it once
  if (e.boss && e.state === 'enrage') return;   // roaring into phase 2: can't be hurt
  if (e.apple && game.snek?.state !== 'go') return;   // AWAS THE SNEK's apple: only while the fight is on (snek.js)
  if (e.hugeSnek && game.snek?.state !== 'huge') return;   // … and AWAS grown huge: once it's done growing
  if (e.obi && obiGuard(e, pr)) return;          // OBI ONE: blocking (your shot comes back at you), or arriving (obi.js)
  if (e.makora && e.down) return;                // MAKORA going down (makora.js): out of the fight
  if (pr.dmg > 0 && CARDS[pr.card]) pr = { ...pr, dmg: tierDmg(pr.card, pr.dmg) };   // its card's tier (v0.62, tiers.js)
  const fx = pr.aug || AUG_FX;                                     // its slot's augments (v0.68): DMG doubles it, CRIT always crits
  if (fx?.dmg && pr.dmg > 0) pr = { ...pr, dmg: pr.dmg * 2 };
  if (!pr.noCrit && (fx?.crit || Math.random() < critChance())) {                // a crit (v0.41): rolled per hit; a gold spark on the enemy (v0.42)
    pr = { ...pr, dmg: critHit(pr.dmg), crit: true };
    game.rings.push({ x: e.x, y: e.y, r: e.r * 0.5, max: e.r + 22, life: 0.25, color: COL.wheelHi });
    burst(e.x, e.y, COL.wheelHi, 8, 260);
  }
  if (e.amark > 0 && !pr.noCrit && !pr.noMark) pr = arcanaCash(pr, e);   // Arcana's mark: this hit does more, and uses it up (magus.js)
  if (e.makora && adaptMul(pr.card) < 1 && pr.dmg > 0) {   // v0.69: a weapon MAKORA adapted to (in a run before) does less to it
    pr = { ...pr, dmg: Math.max(1, Math.round(pr.dmg * adaptMul(pr.card))) };
    if (performance.now() - (e.tink || 0) > 600) {
      e.tink = performance.now();
      game.floaters.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - e.r - 26, text: 'ADAPTED', color: COL.wheel, life: 0.7, vy: -40, big: false });
      SFX.adapted();
    }
  }
  if (!e.dummy && !game.practice && pr.dmg > (game.maxHit || 0)) game.maxHit = Math.round(pr.dmg);   // the run's highest hit (v0.69: the leaderboard)
  const dealt = Math.min(pr.dmg, Math.max(0, e.hp));
  if (!e.dummy) { tallyHit(pr.card, dealt); sackHit(e, dealt); }   // for the end-of-run screen (flow.js); a boss hit fills VAMPIRIC BALLSACK (snek.js)
  e.hp -= pr.dmg;
  if (e.dummy) {                                    // test dummies never die or move; they count the damage instead
    game.practice.dmg += pr.dmg; e.hp = e.maxHp; pr = { ...pr, knock: 0 };
    renderPrDmg();
  } else if (game.practice?.battle) { game.practice.dmg += dealt; game.practice.dmgDirty = true; }   // (the test arena: menus.js)
  e.hit = 0.1;
  const len = Math.hypot(pr.vx, pr.vy) || 1, kr = e.boss ? BOSS.knockResist : e.makora ? MAKORA.knockResist : e.obi ? OBI.knockResist : e.mrock || e.apple || e.hugeSnek ? 0 : 1;
  e.kx += (pr.vx / len) * pr.knock * kr;
  e.ky += (pr.vy / len) * pr.knock * kr;
  if (pr.stun) e.stun = Math.max(e.stun || 0, pr.stun);   // Soap Gun (user)
  if (pr.sleep) sleepEnemy(e, pr.sleep);                  // Blowpipe (v0.59)
  if (pr.berserk) berserkEnemy(e, pr.berserk);            // … and its BERSERK! dart
  if (pr.look === 'sonic') sonicMark(pr, e);              // Sonic Kick: the mark, then the astral kick (sins.js)
  if (e.boss) renderBossBar();
  if (e.makora) renderMakoraBar();
  if (e.obi) renderObiBar();
  const heavy = pr.look === 'heavy' && !pr.aoe, strong = pr.dmg >= 10;
  const wet = WET.has(pr.card);
  if (!e.apple) fxPop(pr.x ?? e.x, pr.y ?? e.y, COL[pr.card] || COL.player, pr.dmg, pr.crit, wet, pr.vx || pr.vy ? Math.atan2(pr.vy, pr.vx) : null);   // the hit's flash (above)
  if (pr.brick) brickHit(pr.x ?? e.x, pr.y ?? e.y);       // Brickshot (v0.64): its own clunk, chips and dust
  else SFX.hit(heavy || pr.crit || pr.dmg >= 15);
  burst(pr.x, pr.y, COL[pr.card], heavy ? 16 : strong ? 10 : 5, heavy ? 260 : 180, wet);
  if (heavy) {
    game.rings.push({ x: pr.x, y: pr.y, r: 6, max: 70, life: 0.35, color: COL[pr.card] });
    game.shake = Math.max(game.shake, 0.18);
  }
  if (pr.crit) game.floaters.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.r - 10, text: `${pr.dmg}!`, color: COL.wheelHi, life: 0.9, max: 0.9, vy: -45, big: true, crit: true });   // gold, bigger, with a !
  else game.floaters.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.r - 8, text: String(pr.dmg), color: COL[pr.card], life: 0.6, vy: -50, big: strong });

  if (e.apple) { appleHit(e, dealt); return; }          // AWAS THE SNEK's apple: AWAS takes it, and a popped one is gone (snek.js)
  if (e.hugeSnek) { hugeHit(e); return; }              // AWAS grown huge: its own bar (snek.js)
  if (e.hp <= 0 && e.boss && bossNextPhase(e)) return;   // SKURTOSAURUS: phase 1's bar is gone, phase 2 begins
  if (e.hp <= 0 && e.obi && obiNextPhase(e)) return;     // … and OBI ONE's
  if (e.hp <= 0 && e.makora) { makoraDown(e, pr.card); return; }   // MAKORA: it sinks to its knees, the wheel turns, the next run (makora.js)
  if (e.hp <= 0) {
    e.dead = true;
    SFX.kill(e.r > 15);
    burst(e.x, e.y, enemyCol(e), e.r > 15 ? 30 : 22, 240);
    game.rings.push({ x: e.x, y: e.y, r: 10, max: e.r * 6, life: 0.45, color: enemyCol(e) });
    game.enemies.splice(game.enemies.indexOf(e), 1);
    if (e.split) splitEnemy(e);
    if (e.boss || e.obi) startDeath(e);                 // v0.54 (user): it plays its death first, then the rewards (deaths.js)
    else if (!game.practice && Math.random() < orbDropChance()) dropOrb(e);   // (the test arena drops nothing: menus.js)
    sackFeed(1);                                        // VAMPIRIC BALLSACK fills with every kill (snek.js)
    if (game.practice) { /* nothing to pick up */ }
    else if (Math.random() < POTION.drop && game.potions.length < POTION.max) game.potions.push({ x: e.x, y: e.y, t: 0 });
    else if (Math.random() < DIAMOND.drop && game.diamonds.length < DIAMOND.max) game.diamonds.push({ x: e.x, y: e.y, t: 0 });
    tallyKill(pr.card);                                 // which card finished it off (the online run log, flow.js)
    testCount('killed');                                // (the test swarm, flow.js)
    game.kills++;
    document.getElementById('kills').textContent = game.kills;
    aliveEl.textContent = game.enemies.length;
  }
}

// `wet`: water (the Powerwash pack's sprays, v0.55): drops instead of sparks.
// A brick hitting (v0.64, user: "sounds like a brick when hit"): the clunk (sound.js), chips of clay and a puff of dust.
function brickHit(x, y) {
  SFX.brick();
  burst(x, y, COL.brickshot, 7, 210);
  burst(x, y, COL.brickDust, 6, 90);
  game.shake = Math.max(game.shake, 0.06);
}
function burst(x, y, color, n, speed, wet = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, color, [wet ? 'drop' : 'spark']: true });   // (drawn as sparks or drops: draw.js)
  }
}
// A hit's flash (v0.55, user: clean, like the effect creator's): a spiky star that pops and fades on the spot, white at
// its heart, over a glow (sins.js draws it with the other effects). Bigger for a bigger hit, and a crit's is bigger and
// brighter; not too many at once (a Gatling hits a lot).
// The Powerwash pack's sprays (not Soap Gun's bubbles) hit as water instead (v0.55, user: like actual water): a splash.
const POP = { max: 26, life: 0.17 };
const WET = new Set(['pressurewasher', 'superwasher']);
const fxCount = () => { let n = 0; for (const f of game.sinfx) if (f.kind === 'pop' || f.kind === 'splash') n++; return n; };
function splashFx(x, y, color, size, life = 0.3) {
  if (fxCount() >= POP.max) return;
  game.sinfx.push({ kind: 'splash', x, y, color, size, rot: Math.random() * TAU, life, max: life, fixed: true });
}
// v0.57 (user: prettier than flat): a shock ring, streaks thrown out mostly the way the shot was going (`dir`), and a
// white-hot core (sins.js draws it).
function fxPop(x, y, color, dmg, crit = false, wet = false, dir = null) {
  const size = (9 + Math.min(24, Math.sqrt(Math.max(1, dmg)) * 4)) * (crit ? 1.5 : 1);
  if (wet) { splashFx(x, y, color, size * 1.15 + 6, 0.3); return; }
  if (fxCount() >= POP.max) return;
  const life = POP.life * (crit ? 1.4 : 1.15);
  game.sinfx.push({ kind: 'pop', x, y, color, size, crit, dir, seed: (Math.random() * 1e9) | 0, rot: Math.random() * TAU, life, max: life, fixed: true });
  if (dmg >= 12 || crit) game.rings.push({ x, y, r: size * 0.3, max: size * 2.6, life: 0.3, color });   // a strong one rings out too
}

// The muzzle flash (v0.57, user: prettier than flat; draw.js drawMuzzle): how long it shows, a seed so each one is a
// little different, and a few hot sparks thrown out the way you fired.
function setMuzzle(a, life, card) {
  game.muzzle = { a, life, max: life, card, seed: (Math.random() * 1e9) | 0 };
  const p = game.player, big = CARDS[card]?.look === 'heavy', r = PLAYER.r + 6, c = COL[card] || COL.player;
  if (reducedMotion) return;
  for (let i = 0, n = big ? 6 : 3; i < n; i++) {
    const s = (big ? 380 : 300) * (0.5 + Math.random() * 0.6), b = a + (Math.random() - 0.5) * 0.9;
    game.particles.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(b) * s, vy: Math.sin(b) * s, life: 0.1 + Math.random() * 0.12, color: i ? c : COL.player, spark: true });
  }
}

// An XP orb pops out of a defeated enemy and settles on the floor.
function dropOrb(e) {
  const value = ENEMY_TYPES[e.type].xp, a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 60;
  game.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value, r: value > 1 ? 8 : 6, t: Math.random() * 6, born: 0 });
}

// Adds XP, levelling up as many times as it covers. Leftover XP carries into the next level.
// v0.57 (user): no level cap (it stopped at MAKORA's level, 30, before).
function gainXp(n) {
  game.xp += n;
  let up = 0;
  while (game.xp >= xpNeeded(game.level)) {
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

// Bonus gold (user): +1 for reaching level 10, +10 for beating SKURTOSAURUS and, every time MAKORA goes down (its wheel spins), 10 doubling each spin (v0.55; +15 each before)
// (v0.43; the boss was +1). Saved straight away; the run's Defeated screen and the title note add it to the gold for kills.
const GOLD_BONUS = { level10: 1, boss: 10, obi: 12, snek: 14, makora: 10 };   // makora: run 1 cleared (its wheel turns), ×2 each run after (v0.69; each spin, v0.55)   // obi: OBI ONE (v0.48), snek: AWAS THE SNEK (v0.54); placeholders
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
// `by`: what hit you, for the online run log (flow.js hitName: an enemy, a name, or left out for whichever boss is up).
function hurtPlayer(raw, by) {
  const p = game.player;
  if (game.practice) return;                       // the test arena's enemies come at you, but can't hurt you (menus.js)
  if (p.safe > 0 || game.over || (NET.run && ACTIVE?.down)) return;
  if (deflectHit()) return;                        // DEFLECT's shield takes it (obi.js)
  if (game.sguard && (raw = sinAbsorb(raw)) <= 0) { p.safe = PLAYER.safe; return; }   // Iron Will soaks it up (sins.js)
  if (game.tshield && tShieldAbsorb()) { p.safe = PLAYER.safe; return; }   // a Melee T-Ball's red shield (tballs.js)
  if (game.bshield?.hp > 0) {                      // Brickshot's light blue shield takes it first (v0.58)
    const take = Math.min(game.bshield.hp, raw);
    game.bshield.hp -= take; raw -= take;
    if (game.bshield.hp <= 0) game.bshield = null;
    renderHp(false);
    if (raw <= 0) { p.safe = PLAYER.safe; return; }
  }
  if (Math.random() < dodgeChance()) {
    p.safe = PLAYER.safe;
    SFX.dodge();
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: 'DODGE', color: COL.text, life: 0.6, vy: -40, big: false });
    return;
  }
  const dmg = armorCut(raw);
  if (game.tally && isLocal()) { game.tally.taken += Math.min(dmg, p.hp); tallyHurt(by, Math.min(dmg, p.hp), dmg >= p.hp); }
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
  AUG_FX = null;                         // (whatever hit last left its augments on: usePlayerId)
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
  if (game.practice?.battle) practiceBattleStep(dt);              // the test arena (menus.js): its enemies, and the chosen attack firing
  else if (game.practice?.archive) archiveStep(dt);               // the Weapon Archive (archive.js): its skills playing in turn
  if (game.practice && !autoTest) { game.cooldown = game.mcool = game.wcool = attackInterval(); return; }
  // the melee deck (v0.53, user): on its own timer, the same length, and it never waits for an enemy in reach. After a
  // card that hit nothing (`mprimed`), the next goes off the moment an enemy comes within its reach (user: they got to
  // you before the attack came), and its timer starts again from then.
  if (mdeck) {
    game.mcool -= dt;
    const seq = mdeck.sequence, pos = mdeck.seqPos;
    if (seq[pos] && (game.mcool <= 0 || (game.mprimed && nearestEnemy(game.player, null, meleeReach(seq, pos))))) {
      const r = fireMelee();
      game.mprimed = !r.hit;
      game.mcdTotal = nextWait(r);   // (a card's attack speed tier, v0.62; a RUSH slot, v0.68)
      game.mcool = Math.min(0, game.mcool) + game.mcdTotal;
    }
  }
  if (wdeck) wildDeckStep(dt);                                     // the Wild deck (v0.62)
  if (!deck) return;
  if (game.cooldown <= 0) {
    const next = deck.sequence[deck.seqPos];
    if (next && (CARDS[next].auto || inRange(next))) {   // the Mine has no range: it drops on its own (v0.40)
      const ev = fire();
      // A shuffle takes a moment: the next card waits for it. Attack speed shortens both.
      game.cdTotal = nextWait(ev);
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
  const slip = game.soakT > 0 && !pulledNow();   // SOAK TRAIL! (v0.65, user: "you get slippery"): you slide
  if (!slip) p.svx = p.svy = 0;
  if (updateDash(dt)) { /* BULL charge: it moves the player itself */ }
  else if (slip) {                         // your speed only catches up with where you steer at `grip`: you skid and drift
    const v = ml ? moveSpeed() / ml : 0, k = 1 - Math.exp(-TUNE.soakTrail.grip * dt);
    p.svx = (p.svx || 0) + (mx * v - (p.svx || 0)) * k; p.svy = (p.svy || 0) + (my * v - (p.svy || 0)) * k;
    p.x += p.svx * dt; p.y += p.svy * dt;
    if (ml) p.face = Math.atan2(my, mx);
  }
  else if (ml && !pulledNow()) {           // (OBI ONE's force pull holds you: obi.js drags you instead)
    p.x += (mx / ml) * moveSpeed() * dt; p.y += (my / ml) * moveSpeed() * dt;
    p.face = Math.atan2(my, mx);         // which way you're going (BLACK FLASH! with nothing in reach punches that way)
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
  game.bflash = Math.max(0, (game.bflash || 0) - dt);   // BLACK FLASH! (melee.js)
  if (game.bshield && (game.bshield.t -= dt) <= 0) game.bshield = null;   // Brickshot's shield runs out (v0.58)
  if (game.bshield || game.bshieldShown) { game.bshieldShown = !!game.bshield; renderHp(false); }   // (its bar on the HP bar, fading)
  game.shieldHit = Math.max(0, game.shieldHit - dt);
  deflectStep(dt);                      // DEFLECT's shield and cooldown (obi.js)
  sackStep(dt);                         // VAMPIRIC BALLSACK's cooldown (snek.js)
  // health regen
  const regen = stats.regen + (game.bflash > 0 ? MELEE.blackFlash.regen : 0);   // BLACK FLASH! heals fast while it lasts (v0.55, user)
  if (regen > 0 && p.hp < maxHp()) {
    const before = Math.ceil(p.hp);
    p.hp = Math.min(maxHp(), p.hp + regen * dt);
    if (Math.ceil(p.hp) !== before) renderHp(false);
  }
}

function update(dt) {
  if (first) return;                    // wait until the arena has a real size (see resize)
  zoomStep(dt);                         // a boss fight's bigger arena eases in and out (arena.js)
  if (game.bfFrame) game.bfFrame.t += dt;   // BLACK FLASH!'s impact frame plays on through the freeze (draw.js)
  if (game.hitstop > 0) { game.hitstop -= dt; return; }   // a BULL hit freezes the frame for a moment
  if (!game.practice) game.runT = (game.runT || 0) + dt;   // how long the run has lasted (the end-of-run screen)
  if (game.intro) { updateIntro(dt); if (game.intro?.kind === 'snek') orbStep(dt); updateEffects(dt); return; }   // SKURTOSAURUS's intro: the fight waits
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
  flowStep(dt);                         // the run's clock: the waves, the huge swarm, and when each boss comes (flow.js)
  if (game.bossDue && !game.boss) { startIntro(); return; }   // nothing else happens once the footsteps start
  if (game.obiDue && !game.boss && !game.obi && !game.makora) { startObi(); return; }   // stage 2's boss: OBI ONE (obi.js)
  if (game.snekDue && !game.boss && !game.obi && !game.makora && !game.snek && !game.dying) { startSnek(); return; }   // stage 3's: AWAS THE SNEK (snek.js)
  if (game.makoraDue && !game.boss && !game.obi && !game.makora && !game.snek && !game.dying) { startMakora(); return; }   // stage 4's: the last fight
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && !game.boss && !game.obi && !game.makora && !game.snek && !game.dying && !game.practice && game.flow.state !== 'sweep') {   // (nor while the drops fly in before one)   // no swarm at all while a boss is up (user)
    const S = swarmNow(), n = fieldLoad(), low = n < S.min;    // (co-op: many more of them; a huge swarm: more still)
    if (n < S.max) spawnEnemy();
    game.spawnTimer = (low ? SWARM.refill : S.every) / coopCount();
  }

  // enemies: chase, keep a little apart from each other, get shoved on contact
  const es = game.enemies;
  const decay = Math.exp(-6 * dt);
  for (const e of es) {
    if (e.dummy) { e.hit = Math.max(0, e.hit - dt); continue; }   // the store's test dummies stand still and do no harm
    if (e.apple) { e.hit = Math.max(0, e.hit - dt); e.born = Math.min(1, e.born + dt * 2.5); continue; }   // … and so do AWAS's apples
    if (e.hugeSnek) { e.hit = Math.max(0, e.hit - dt); continue; }   // AWAS grown huge moves itself (snek.js updateHuge)
    if (e.fling) { flingStep(e, dt); e.hit = Math.max(0, e.hit - dt); continue; }   // Dragon Kick: flying off in a straight line (sins.js)
    if (e.stun > 0) { if (e.obi) obiLetGo(e); e.stun -= dt; e.dazed = Math.max(0, (e.dazed || 0) - dt); e.sleep = Math.max(0, (e.sleep || 0) - dt); e.hit = Math.max(0, e.hit - dt); continue; }   // Soap Gun (user), Flashbang (v0.58), Blowpipe (v0.59): frozen in place
    if (e.berserk > 0) { berserkStep(e, dt); e.hit = Math.max(0, e.hit - dt); continue; }   // BERSERK! (v0.59): it goes for the other enemies, not you
    if (e.confused > 0 && !bossLike(e)) { confuseStep(e, dt); e.hit = Math.max(0, e.hit - dt); continue; }   // Gear Toss (v0.60): it staggers about, lost (silica.js)
    e.born = Math.min(1, e.born + dt * (e.boss || e.makora || e.obi ? 1.5 : 4));
    if (e.boss) sizeBoss(e); else if (e.makora) sizeMakora(e); else if (e.obi) sizeObi(e);   // their hitbox follows their size
    if (NET.run) {                          // co-op: each goes after whoever is nearest (and standing)
      if (!e.mrock && !nearestLiving(e.x, e.y)) { e.hit = Math.max(0, e.hit - dt); continue; }
      p = game.player;
    }
    let dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const ox = e.x, oy = e.y;
    if (e.boss) moveBoss(e, dt);
    else if (e.makora) moveMakora(e, dt);
    else if (e.obi) moveObi(e, dt);
    else if (e.shape === 'crab') moveRaptor(e, dt);
    else if (e.type === 'shooter') moveShooter(e, dt);         // v0.51: keeps off and shoots (boss.js)
    else if (e.type === 'lunger') moveLunger(e, dt);           // v0.52: creeps, lights up, dashes (boss.js)
    else if (e.boom && fuseStep(e, dt, d)) { /* an exploder, lit: it stops and flashes (boss.js) */ }
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
    if (e.mslow > 0) { e.x = ox + (e.x - ox) * MAGUS.slow; e.y = oy + (e.y - oy) * MAGUS.slow; }   // Darkmagus / Gravamagus (magus.js counts it down)
    e.hit = Math.max(0, e.hit - dt);
    const shielded = game.shield > 0;
    let reach = e.r + PLAYER.r + (shielded ? SHIELD.r : 0);
    if (e.cap) {                                            // a boss: its nearest part (and that part's own size)
      const q = hitPoint(e, p.x, p.y); dx = p.x - q.x; dy = p.y - q.y; d = Math.hypot(dx, dy) || 1;
      reach = (q.r ?? e.r) + PLAYER.r + (shielded ? SHIELD.r : 0);
    }
    if (d < reach && e.state !== 'jump' && !e.down) {   // contact: push out, shove back, and hurt the player (unless shielded; not while the boss is in the air)
      if (e.boss || e.makora || e.obi) { p.x += (dx / d) * (reach - d); p.y += (dy / d) * (reach - d); clampTo(p, PLAYER.r); }   // a boss shoves you, not the other way round
      else {
        e.x -= (dx / d) * (reach - d); e.y -= (dy / d) * (reach - d); e.kx -= (dx / d) * 260; e.ky -= (dy / d) * 260;
        if (e.state === 'charge') { e.state = 'rest'; e.t = RAPTOR.rest; }   // a crab's dash stops when it hits you
        else if (e.state === 'dash' && e.type === 'lunger') { e.state = 'rest'; e.t = LUNGER.rest; }   // … and a lunger's
      }
      if (shielded || game.dash) game.shieldHit = 0.15;
      else { p.flash = 0.2; hurtPlayer(e.dmg, e); }
    }
  }
  for (const e of es.filter(e => e.blowNow)) blowUp(e);   // exploders whose fuse ran out (after the loop: it can kill others)
  for (let i = es.length - 1; i >= 0; i--) if (es[i].gone) es.splice(i, 1);   // … and gone once they have
  // MAKORA's kicked rocks: their own list (not targets), and they do their own hitting (makora.js)
  for (const k of game.mrocks.slice()) moveKickRock(k, dt);
  game.mrocks = game.mrocks.filter(k => !k.gone && !k.dead);   // (broke on you, blew up, or flew off)
  updateSnek(dt);                       // AWAS THE SNEK: its steps, its apples, bumping into it (snek.js)
  updateDeath(dt);                      // a boss's death playing out (deaths.js)
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.apple || b.apple || a.hugeSnek || b.hugeSnek) continue;   // (the apples sit on their cells)
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const overlap = (a.r + b.r) * 1.1 - d;
      if (overlap > 0) {
        const ox = (dx / d) * overlap / 2, oy = (dy / d) * overlap / 2;
        if (a.boss || a.makora || a.obi) { b.x += ox * 2; b.y += oy * 2; }
        else if (b.boss || b.makora || b.obi) { a.x -= ox * 2; a.y -= oy * 2; }
        else { a.x -= ox; a.y -= oy; b.x += ox; b.y += oy; }
      }
    }
  }
  for (const e of es) if (!e.mrock) clampTo(e, e.r);

  AUG_FX = null;                        // (the last shot's augments, from the loop above)
  updateRocks(dt);
  updateEnemyShots(dt);                 // the shooters' orbs (boss.js)
  updateSabers(dt); updateBolts(dt);    // OBI ONE's thrown saber and the shots he knocks back (obi.js)
  updateDebris(dt); updateBoulders(dt);   // (phase 3's rocks, v0.50)                     // OBI ONE phase 2: the force rains debris down (obi.js)
  updateSprays(dt); updateSoak(dt); updateTrails(dt);   // the Powerwash pack (user)
  updateMelees(dt);                                     // melee swings (melee.js)
  tballStep(dt);                                        // the T-Balls (tballs.js)
  updateSins(dt);                                       // the SINS pack (sins.js)
  chessStep(dt);                                        // EN PASSANT's pieces moving over their squares (chess.js)
  magusStep(dt);                                        // the Ulti Magus pack's swirls, roots, drains and the rest (magus.js)
  AUG_FX = null;

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
    // With still dummies nothing walks onto a mine, so mines go off as soon as they're armed (the test arena's squares do walk).
    if ((game.practice && !game.practice.battle) || es.some(e => hitGap(e, m.x, m.y) < (spec.trigger || spec.r))) { game.mines.splice(i, 1); usePlayerId(m.owner, m.aug); explode(m); }
  }

  // scheduled combo shots
  for (let i = game.timers.length - 1; i >= 0; i--) {
    const tm = game.timers[i];
    if ((tm.t -= dt) > 0) continue;
    game.timers.splice(i, 1);
    usePlayerId(tm.owner, tm.aug);
    tm.fn();
    if (tm.aug?.big) bigUp();            // (what a BIG play makes later grows too)
  }
  AUG_FX = null;

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
    usePlayerId(pr.owner, pr.aug);                 // co-op: its hits crit and blast as whoever fired it
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
        const ox = pr.x, oy = pr.y;
        pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
        pr.flown += pr.speed * dt / steps;
        const wall = snekWall(ox, oy, pr.x, pr.y);           // AWAS's body stops it (snek.js)
        if (wall) { snekBlocked(wall); pr.blocked = true; end = true; break; }
        for (const hit of es.filter(en => !pr.hits.has(en) && hitGap(en, pr.x, pr.y) < pr.r)) {
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
        if (pr.endBlast && !out && !pr.blocked) blast(pr.x, pr.y, pr.card, pr.endBlast.radius, pr.endBlast.dmg, { knock: pr.endBlast.knock ?? (pr.big ? 220 : 80), big: pr.big, stun: pr.endBlast.stun || 0 });
      }
      continue;
    }
    // A spread shot (shotgun, cone) flies its own way for a moment before homing in.
    const spread = pr.homeDelay > 0, ox = pr.x, oy = pr.y;
    if (spread) pr.homeDelay -= dt;
    if (pr.target && !es.includes(pr.target)) pr.target = null;   // its target died: carry on straight
    const tg = spread ? null : pr.target;
    if (spread) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    else if (tg) {
      const aim = hitPoint(tg, pr.x, pr.y), dx = aim.x - pr.x, dy = aim.y - pr.y, d = Math.hypot(dx, dy) || 1;   // the nearest part of it
      if (pr.turn && d > 70) {                        // Arcane Missiles: turn toward it at a rate that grows, so they curve in; close up
                                                      // they go straight for it (they could circle it otherwise)
        pr.age += dt;
        const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(dy, dx), max = (pr.turn + pr.age * 30) * dt;
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), na = cur + Math.max(-max, Math.min(max, diff));
        pr.vx = Math.cos(na) * pr.speed; pr.vy = Math.sin(na) * pr.speed;
      } else { pr.vx = (dx / d) * pr.speed; pr.vy = (dy / d) * pr.speed; }
      // Arrives this frame: land on it, so a fast shot can't step past its target.
      if (d <= pr.speed * dt + pr.r + tg.r) { pr.x = aim.x - (dx / d) * tg.r * 0.8; pr.y = aim.y - (dy / d) * tg.r * 0.8; }
      else { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    } else {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;   // no target: fly on straight
    }
    pr.flown += pr.speed * dt;
    pr.spin += dt * 18;
    const wall = snekWall(ox, oy, pr.x, pr.y);             // AWAS's body stops it (snek.js)
    if (wall) { snekBlocked(wall); game.projectiles.splice(i, 1); continue; }
    const touching = en => !pr.hits.has(en) && hitGap(en, pr.x, pr.y) < pr.r;
    const target = (tg && touching(tg)) ? tg : es.find(touching);
    if (target) {
      if (pr.burst === 'flash') { flashBurst(pr, pr.x, pr.y); game.projectiles.splice(i, 1); continue; }   // Flashbang: no hit, a flash (v0.58)
      hitEnemy(pr, target);
      pr.hits.add(target);
      if (pr.mh && magusHit(pr, target) === 'keep') continue;   // the Ulti Magus pack's on-hit effects (magus.js); Arcana ×3 flies on
      if (pr.gh) gearHit(pr, target);                           // Gear Toss: a gear sets it sparking (silica.js)
      if (pr.burst === 'grape') { grapeBurst(pr, pr.x, pr.y); game.projectiles.splice(i, 1); continue; }   // Grapeshot: bursts into pellets
      if (pr.brick && target.dead && pr.bounce0 - pr.bounces >= 2) brickShield();   // Brickshot: a kill on its second bounce
      if (pr.aoe) blast(target.x, target.y, pr.card, pr.aoe.radius, pr.aoe.dmg, { skip: target, big: pr.big });
      if (pr.look === 'amissile') arcaneHit(pr.x, pr.y, Math.atan2(pr.vy, pr.vx), pr.r);   // its own impact (v0.66, draw.js)
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
      if (pr.burst === 'flash') flashBurst(pr, pr.x, pr.y);   // (a flashbang or a grapeshot shell goes off anyway)
      else if (pr.burst === 'grape') grapeBurst(pr, pr.x, pr.y);
      burst(pr.x, pr.y, COL[pr.card], 3, 80);
      if (pr.field) iceField(pr.x, pr.y, pr.field, pr.card);
      game.projectiles.splice(i, 1);
      continue;
    }
    if (pr.x < -40 || pr.y < -40 || pr.x > W + 40 || pr.y > H + 40) game.projectiles.splice(i, 1);
  }

  orbStep(dt);
  updateEffects(dt);
  renderRunGold();
}

// Your gold, top right (v0.55, user): what you have now plus what this run's kills will pay at its end (save.js payGold).
const runGoldEl = document.getElementById('run-gold'), runGoldN = document.getElementById('run-gold-n');
let runGoldShown = -1;
function renderRunGold() {
  const n = save.gold + (game.practice ? 0 : Math.floor(game.kills / GOLD_PER));
  if (n === runGoldShown) return;
  if (runGoldShown >= 0 && n > runGoldShown && animOk) { runGoldEl.classList.remove('is-up'); void runGoldEl.offsetWidth; runGoldEl.classList.add('is-up'); }
  runGoldShown = n; runGoldN.textContent = n;
}

// XP orbs: slide to a stop, then fly to the player once in range. Touching one collects it. (Also during AWAS THE
// SNEK's intro, as the drops before it fly to you: snek.js.)
function orbStep(dt) {
  let p = game.player;                  // (the pickups above leave p as whoever grabbed something, or null)
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
  for (const b of game.beams) { b.life -= dt; pinBeam(b); }
  game.beams = game.beams.filter(b => b.life > 0);
  for (const f of game.floaters) { f.y += f.vy * dt; f.life -= dt; }
  game.floaters = game.floaters.filter(f => f.life > 0);
  if (game.muzzle && (game.muzzle.life -= dt) <= 0) game.muzzle = null;
  game.shake = Math.max(0, game.shake - dt);
}
