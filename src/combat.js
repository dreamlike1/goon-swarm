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
  game.enemies.push(e);
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

// The melee deck's turn (v0.53): like fire(), but it never waits for a target (melee.js).
function fireMelee() {
  const cb = comboAt(mdeck.sequence, mdeck.seqPos);
  if (cb) {
    const evs = [];
    for (let k = 0; k < cb.n; k++) { const ev = mdeck.draw(); evs.push(ev); onMeleeAttack(ev); }
    const hit = meleeCombo(cb, false);
    if (evs.some(ev => game.aug.has(ev.slot))) later(0.3, () => runCombo(cb, true));
    return { hit, reshuffle: evs.find(ev => ev.reshuffle)?.reshuffle || null };
  }
  const ev = mdeck.draw();
  const hit = meleeStrike(ev.card, inRange(ev.card));
  if (game.aug.has(ev.slot)) game.echoes.push({ card: ev.card, t: ECHO_DELAY });   // (an augmented slot: both decks')
  onMeleeAttack(ev);
  return { hit, reshuffle: ev.reshuffle };
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
  const col = COL[card];   // droplets flicked out along the cone
  for (let k = 0, n = o.wipe ? 14 : 7; k < n; k++) {
    const da = angle + (Math.random() - 0.5) * arc, s = 90 + Math.random() * 140;
    game.particles.push({ x: p.x, y: p.y, vx: Math.cos(da) * s, vy: Math.sin(da) * s, life: 0.2 + Math.random() * 0.2, color: col });
  }
  if (!o.quiet) SFX.fire(card);
}
function updateSprays(dt) {
  for (let i = game.sprays.length - 1; i >= 0; i--) if ((game.sprays[i].life -= dt) <= 0) game.sprays.splice(i, 1); else followOwner(game.sprays[i]);
}
// Super Washer (user): two sprays spin a full turn around you (reuses Laser ×7's sweep, twice, offset by half a turn).
function superSweep(card, range, dmg) {
  const a0 = Math.random() * Math.PI * 2;
  sweep(card, a0, range, damageOf(dmg));
  sweep(card, a0 + Math.PI, range, damageOf(dmg));
}
// SOAK TRAIL! (Super Washer ×7, user): `soakTrail.time` s of extra speed (upgrades.js moveSpeed), both sprays
// re-spinning every `every` s, and a trail of bubbles dropped behind you that explode after `trailDelay` s.
function startSoak(card, range, dmg) {
  const S = TUNE.soakTrail;
  Object.assign(game, { soakT: S.time, soakCard: card, soakRange: range, soakDmg: dmg, soakSweep: 0, soakDrop: 0 });
  superSweep(card, range, dmg);
}
function updateSoak(dt) {
  if (!(game.soakT > 0)) return;
  const S = TUNE.soakTrail, p = game.player;
  game.soakT = Math.max(0, game.soakT - dt);
  if ((game.soakSweep -= dt) <= 0) { game.soakSweep = S.every; superSweep(game.soakCard, game.soakRange, game.soakDmg); }
  if ((game.soakDrop -= dt) <= 0) { game.soakDrop = S.dropEvery; game.trails.push({ x: p.x, y: p.y, t: S.trailDelay, card: game.soakCard, seed: Math.random() * 10 }); }
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
  const b = { x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.14, max: 0.14, w: 3, card, owner: ownerId(), target: e };
  game.beams.push(b);
  pinBeam(b);
  hitEnemy({ card, look: 'laser', dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  if (o.quiet) return;
  game.muzzle = { a: Math.atan2(dy, dx), life: 0.08, card };
  SFX.fire(card);
}
// Attacks that show for a moment stay on whoever fired them (user: moving fast or zig-zagging, they were left behind
// where they fired, over you or with a gap). `pinTo` notes the owner and the offset from them; `followOwner` puts
// it back there each frame (sprays, the Gatling's barrel flashes). A laser's beam goes from the edge of your circle
// to wherever its target is now (pinBeam).
const ownerBody = o => (NET.run && byId(o.owner)?.body) || game.player;
function pinTo(o) {
  const p = game.player;
  return Object.assign(o, { owner: ownerId(), ox: o.x - p.x, oy: o.y - p.y });
}
function followOwner(o) {
  const p = ownerBody(o);
  o.x = p.x + o.ox; o.y = p.y + o.oy;
}
function pinBeam(b) {
  const p = ownerBody(b), e = b.target;
  if (e && !e.dead && !e.gone && game.enemies.includes(e)) { b.x2 = e.x; b.y2 = e.y; }
  const dx = b.x2 - p.x, dy = b.y2 - p.y, d = Math.hypot(dx, dy) || 1, off = Math.min(PLAYER.r + 2, d);
  b.x1 = p.x + dx / d * off; b.y1 = p.y + dy / d * off;
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
function blast(x, y, card, radius, dmg, { skip = null, knock = 160, big = false, stun = 0 } = {}) {
  for (const e of game.enemies.slice()) {
    if (e === skip) continue;
    const q = hitPoint(e, x, y), dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
    if (d > radius + e.r) continue;
    if (stun) e.stun = Math.max(e.stun || 0, stun);
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
  if (spec.melee) { meleeStrike(card, e, o); return; }       // a melee card (melee.js): a stab or a punch, if it can reach
  if (spec.look === 'mine') { dropMine(card); return; }
  if (spec.silica && !o.raw) { silicaShot(card, e, o); return; }   // the Silica pack's weapons (silica.js)
  if (spec.look === 'laser') { zap(card, e, o); return; }
  if (spec.look === 'spray') { spray(card, e ? Math.atan2(e.y - p.y, e.x - p.x) : 0, o.arc ?? spec.arc, rangeOf(card), o); return; }
  if (spec.look === 'orbit') { superSweep(card, rangeOf(card), o.dmg ?? spec.dmg); return; }   // Super Washer (user)
  if (spec.pops && o.split == null) o = { ...o, split: spec.pops };   // Soap Gun (user): pops into more bubbles on a hit
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
    flown: 0, maxDist: rangeOf(card) * (steer ? 2.2 : 1.35), age: 0, stun: o.stun || 0,   // Soap Gun ×3 (user): stuns on a hit
    sway: Math.random() * TAU,   // Soap Gun (user): a stable per-bubble phase for its floaty sway (draw.js), unused otherwise
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
    // split: 0 (user's Soap Gun, via `spec.pops`): a split child never re-splits, however many enemies are around.
    const o = { one: true, from: { x: pr.x, y: pr.y }, angle: a0 + side * 1.1, quiet: true, skip: hit, speedMul: 1.3, r: 3, split: 0 };
    if (e) shoot(pr.card, e, o);
    else shoot(pr.card, hit, { ...o, noHome: true });
  }
  burst(pr.x, pr.y, COL[pr.card], 8, 160);
}

function hitEnemy(pr, e) {
  if (e.dead) return;                   // already killed this frame by another hit (a blast, a pierce): count it once
  if (e.boss && e.state === 'enrage') return;   // roaring into phase 2: can't be hurt
  if (e.obi && obiGuard(e, pr)) return;          // OBI ONE: blocking (your shot comes back at you), or arriving (obi.js)
  if (e.makora && (e.down || game.makoraAdapted.has(pr.card))) {   // MAKORA has adapted to this weapon: no effect
    if (!e.down && performance.now() - (e.tink || 0) > 350) {
      e.tink = performance.now();
      game.floaters.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - e.r - 10, text: 'ADAPTED', color: COL.wheel, life: 0.7, vy: -40, big: false });
      SFX.adapted();
    }
    return;
  }
  if (!pr.noCrit && Math.random() < critChance()) {                // a crit (v0.41): rolled per hit; a gold spark on the enemy (v0.42)
    pr = { ...pr, dmg: critHit(pr.dmg), crit: true };
    game.rings.push({ x: e.x, y: e.y, r: e.r * 0.5, max: e.r + 22, life: 0.25, color: COL.wheelHi });
    burst(e.x, e.y, COL.wheelHi, 8, 260);
  }
  if (!e.dummy) tallyHit(pr.card, Math.min(pr.dmg, Math.max(0, e.hp)));   // for the end-of-run screen (flow.js)
  e.hp -= pr.dmg;
  if (e.dummy) {                                    // test dummies never die or move; they count the damage instead
    game.practice.dmg += pr.dmg; e.hp = e.maxHp; pr = { ...pr, knock: 0 };
    renderPrDmg();
  }
  e.hit = 0.1;
  const len = Math.hypot(pr.vx, pr.vy) || 1, kr = e.boss ? BOSS.knockResist : e.makora ? MAKORA.knockResist : e.obi ? OBI.knockResist : e.mrock ? 0 : 1;
  e.kx += (pr.vx / len) * pr.knock * kr;
  e.ky += (pr.vy / len) * pr.knock * kr;
  if (pr.stun) e.stun = Math.max(e.stun || 0, pr.stun);   // Soap Gun (user)
  if (pr.look === 'sonic') sonicMark(pr, e);              // Sonic Kick: the mark, then the astral kick (sins.js)
  if (e.boss) renderBossBar();
  if (e.makora) renderMakoraBar();
  if (e.obi) renderObiBar();
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
  if (e.hp <= 0 && e.obi && obiNextPhase(e)) return;     // … and OBI ONE's
  if (e.hp <= 0 && e.makora) { makoraDown(e, pr.card); return; }   // MAKORA never stays down: it adapts and comes back
  if (e.hp <= 0) {
    e.dead = true;
    SFX.kill(e.r > 15);
    burst(e.x, e.y, enemyCol(e), e.r > 15 ? 30 : 22, 240);
    game.rings.push({ x: e.x, y: e.y, r: 10, max: e.r * 6, life: 0.45, color: enemyCol(e) });
    game.enemies.splice(game.enemies.indexOf(e), 1);
    if (e.split) splitEnemy(e);
    if (e.boss) bossDown(e);
    else if (e.obi) obiDown(e);
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
  if (game.level >= MAKORA.level) return;   // MAKORA's level (30 since v0.48) is the last level (user)
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
const GOLD_BONUS = { level10: 1, boss: 10, obi: 12, makora: 15 };   // obi: OBI ONE (v0.48, a placeholder)
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
  if (deflectHit()) return;                        // DEFLECT's shield takes it (obi.js)
  if (game.sguard && (raw = sinAbsorb(raw)) <= 0) { p.safe = PLAYER.safe; return; }   // Iron Will soaks it up (sins.js)
  if (Math.random() < dodgeChance()) {
    p.safe = PLAYER.safe;
    SFX.dodge();
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: 'DODGE', color: COL.text, life: 0.6, vy: -40, big: false });
    return;
  }
  const dmg = armorCut(raw);
  if (game.tally && isLocal()) game.tally.taken += Math.min(dmg, p.hp);
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
  if (game.practice && !autoTest) { game.cooldown = game.mcool = attackInterval(); return; }
  // the melee deck (v0.53, user): on its own timer, the same length, and it never waits for an enemy in reach. After a
  // card that hit nothing (`mprimed`), the next goes off the moment an enemy comes within its reach (user: they got to
  // you before the attack came), and its timer starts again from then.
  if (mdeck) {
    game.mcool -= dt;
    const seq = mdeck.sequence, pos = mdeck.seqPos;
    if (seq[pos] && (game.mcool <= 0 || (game.mprimed && nearestEnemy(game.player, null, meleeReach(seq, pos))))) {
      const r = fireMelee();
      game.mprimed = !r.hit;
      game.mcdTotal = attackInterval() + (r.reshuffle ? shuffleTime() : 0);
      game.mcool = Math.min(0, game.mcool) + game.mcdTotal;
    }
  }
  if (!deck) return;
  if (game.cooldown <= 0) {
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
  game.shieldHit = Math.max(0, game.shieldHit - dt);
  deflectStep(dt);                      // DEFLECT's shield and cooldown (obi.js)
  // health regen
  if (stats.regen > 0 && p.hp < maxHp()) {
    const before = Math.ceil(p.hp);
    p.hp = Math.min(maxHp(), p.hp + stats.regen * dt);
    if (Math.ceil(p.hp) !== before) renderHp(false);
  }
}

function update(dt) {
  if (first) return;                    // wait until the arena has a real size (see resize)
  zoomStep(dt);                         // a boss fight's bigger arena eases in and out (arena.js)
  if (game.hitstop > 0) { game.hitstop -= dt; return; }   // a BULL hit freezes the frame for a moment
  if (!game.practice) game.runT = (game.runT || 0) + dt;   // how long the run has lasted (the end-of-run screen)
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
  flowStep(dt);                         // the run's clock: the waves, the huge swarm, and when each boss comes (flow.js)
  if (game.bossDue && !game.boss) { startIntro(); return; }   // nothing else happens once the footsteps start
  if (game.obiDue && !game.boss && !game.obi && !game.makora) { startObi(); return; }   // stage 2's boss: OBI ONE (obi.js)
  if (game.makoraDue && !game.boss && !game.obi && !game.makora) { startMakora(); return; }   // stage 3's: the last fight
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && !game.boss && !game.obi && !game.makora && !game.practice && game.flow.state !== 'sweep') {   // (nor while the drops fly in before one)   // no swarm at all while a boss is up (user)
    const S = swarmNow(), n = fieldLoad(), low = n < S.min;    // (co-op: many more of them; a huge swarm: more still)
    if (n < S.max) spawnEnemy();
    game.spawnTimer = (low ? SWARM.refill : S.every) / coopCount();
  }

  // enemies: chase, keep a little apart from each other, get shoved on contact
  const es = game.enemies;
  const decay = Math.exp(-6 * dt);
  for (const e of es) {
    if (e.dummy) { e.hit = Math.max(0, e.hit - dt); continue; }   // the store's test dummies stand still and do no harm
    if (e.stun > 0) { e.stun -= dt; e.hit = Math.max(0, e.hit - dt); continue; }   // Soap Gun (user): frozen in place
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
    e.hit = Math.max(0, e.hit - dt);
    const shielded = game.shield > 0;
    let reach = e.r + PLAYER.r + (shielded ? SHIELD.r : 0);
    if (e.cap) {                                            // a boss: its nearest part (and that part's own size)
      const q = hitPoint(e, p.x, p.y); dx = p.x - q.x; dy = p.y - q.y; d = Math.hypot(dx, dy) || 1;
      reach = (q.r ?? e.r) + PLAYER.r + (shielded ? SHIELD.r : 0);
    }
    if (d < reach && e.state !== 'jump') {   // contact: push out, shove back, and hurt the player (unless shielded; not while the boss is in the air)
      if (e.boss || e.makora || e.obi) { p.x += (dx / d) * (reach - d); p.y += (dy / d) * (reach - d); clampTo(p, PLAYER.r); }   // a boss shoves you, not the other way round
      else {
        e.x -= (dx / d) * (reach - d); e.y -= (dy / d) * (reach - d); e.kx -= (dx / d) * 260; e.ky -= (dy / d) * 260;
        if (e.state === 'charge') { e.state = 'rest'; e.t = RAPTOR.rest; }   // a crab's dash stops when it hits you
        else if (e.state === 'dash' && e.type === 'lunger') { e.state = 'rest'; e.t = LUNGER.rest; }   // … and a lunger's
      }
      if (shielded || game.dash) game.shieldHit = 0.15;
      else { p.flash = 0.2; hurtPlayer(e.dmg); }
    }
  }
  for (const e of es.filter(e => e.blowNow)) blowUp(e);   // exploders whose fuse ran out (after the loop: it can kill others)
  for (let i = es.length - 1; i >= 0; i--) if (es[i].gone) es.splice(i, 1);   // … and gone once they have
  // MAKORA's kicked rocks: their own list (not targets), and they do their own hitting (makora.js)
  for (const k of game.mrocks.slice()) moveKickRock(k, dt);
  game.mrocks = game.mrocks.filter(k => !k.gone && !k.dead);   // (broke on you, blew up, or flew off)
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
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

  updateRocks(dt);
  updateEnemyShots(dt);                 // the shooters' orbs (boss.js)
  updateSabers(dt); updateBolts(dt);    // OBI ONE's thrown saber and the shots he knocks back (obi.js)
  updateDebris(dt); updateBoulders(dt);   // (phase 3's rocks, v0.50)                     // OBI ONE phase 2: the force rains debris down (obi.js)
  updateSprays(dt); updateSoak(dt); updateTrails(dt);   // the Powerwash pack (user)
  updateMelees(dt);                                     // melee swings (melee.js)
  updateSins(dt);                                       // the SINS pack (sins.js)

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
    if (game.practice || es.some(e => hitGap(e, m.x, m.y) < (spec.trigger || spec.r))) { game.mines.splice(i, 1); usePlayerId(m.owner); explode(m); }
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
        if (pr.endBlast && !out) blast(pr.x, pr.y, pr.card, pr.endBlast.radius, pr.endBlast.dmg, { knock: pr.endBlast.knock ?? (pr.big ? 220 : 80), big: pr.big, stun: pr.endBlast.stun || 0 });
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
    const touching = en => !pr.hits.has(en) && hitGap(en, pr.x, pr.y) < pr.r;
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
  for (const b of game.beams) { b.life -= dt; pinBeam(b); }
  game.beams = game.beams.filter(b => b.life > 0);
  for (const f of game.floaters) { f.y += f.vy * dt; f.life -= dt; }
  game.floaters = game.floaters.filter(f => f.life > 0);
  if (game.muzzle && (game.muzzle.life -= dt) <= 0) game.muzzle = null;
  game.shake = Math.max(0, game.shake - dt);
}
