/* magus.js — The Ulti Magus pack (v0.60, user): Twin Flame, Arcana, Explomagus, Gravamagus, Darkmagus and Druidity,
   their combos, and Arcane Bolt's SPLIT BOLT!. (Arcane Missiles keep their code in combat.js, the Cryo Magus in
   silica.js.) combat.js, combos.js and draw.js call in here. Every number is a placeholder. */
'use strict';

/* What they do (user):
   - Twin Flame (Common): 2 light fire bolts, pink and red, low damage, each at its own enemy. ×3: 4 of them.
   - Arcana (Common): a diamond that marks what it hits; the next hit on a marked enemy does more. ×3: it pierces the
     first enemy it hits, and if it hits another one too, both are stunned.
   - Explomagus (Uncommon): a slow spark that explodes in a small circle where it hits. ×3: a kill opens another circle
     that explodes too. ×7: for a while, the ground you walk over explodes behind you.
   - Gravamagus (Uncommon): a swirl of laser light on the ground under the enemy; it goes off after 1 s. ×3: it pulls
     everything caught in it to its centre first. ×7: a huge circle round you that slows everything in it.
   - Darkmagus (Uncommon): dark energy that drains what it hits (you get a little back). ×3: a large rectangle of dark
     energy that hurts and slows what's on it. ×7: dark energy is sucked into you, then dark lasers blast out in random
     directions.
   - Druidity (v0.65, user: Legendary and melee now; it was an Epic bolt that rooted, ×3 VINE THRASH!, ×7 BEAR CLAWS!):
     it whips a thorny vine across what's close. ×3 SEED BOMB! (v0.66; TIMBER!'s falling tree before): a seed bomb
     lobbed at a random enemy bursts and corrupts the ground, which slows and hurts what's on it and heals you. ×7 OVERGROWTH!: vines burst up out of the ground at random round you, grab what's on them, hold
     it and drag it down into the ground, hurting it. It plays from the melee deck (melee.js hands these over).
   Enemy state they use: e.amark (Arcana's mark, s left), e.mslow (slowed, s left: combat.js moves it less), e.root
   (rooted, s left; it's also stunned), e.drain / e.drainT / e.drainBy (Darkmagus). magusStep counts them down. */
const MAGUS = {
  slow: 0.45,                                                          // a slowed enemy gets this far each frame
  twin: { spread: 0.3, home: 0.07, four: 0.22 },                       // the bolts fan out this far (rad) for `home` s, then home in
  arcana: { mark: 4, mul: 1.6, stun: 1.2, bossStun: 0.5, seek: 170 },  // the mark lasts `mark` s, and the next hit does ×`mul`
  explo: { radius: 40, dmg: 4, chain: { radius: 58, dmg: 12, fuse: 0.42 },
           walk: { time: 1, step: 22, wait: 0.45, fuse: 0.5, radius: 40, dmg: 9 } },   // ×7 (1 s, user; it was 5): a new spot every `step` px (or `wait` s)
  grav: { r: 44, delay: 1, lead: 0.35, pull: 160, pullR: 1.35, more: 6,                // ×3: pulls from `pullR` × its size, +`more` damage
          well: { r: 165, time: 5, every: 0.5, dmg: 2, slow: 0.3 } },
  dark: { drain: { time: 1.5, every: 0.3, dmg: 3, heal: 0.5 },
          path: { len: 330, w: 64, dmg: 16, life: 1.4, grow: 0.14, slow: 1.5 },
          ult: { charge: 0.75, count: 7, gap: 0.12, w: 24, dmg: 34, knock: 220 } },
  // Druidity (v0.65). SEED BOMB! (v0.66, user; TIMBER!'s tree before): thrown at a random enemy within `reach`, landing
  // up to `scatter` px off it, `fly` s in the air (`arc` px high at the top), with a circle on the floor showing where. It
  // bursts (`burst` damage within `r`) and leaves the ground there corrupted for `time` s, sprouting `sprouts` seedlings:
  // everything on it is slowed and takes `dmg` every `every` s, and `heal` of that damage comes back to you (at most
  // `healMax` a tick). OVERGROWTH!: for `time` s, a burst of vines every `every` s somewhere within
  // `radius` of you (on an enemy `near` of the time); each one rises in `rise` s, grabs what's within `r`, holds it for
  // `hold` s (longer at some tiers: durMul) hurting it by `dmg` as it grabs and `drag` as it drags it under; it sinks
  // down to `sink` of its height. A boss is held only `bossRoot` s and not dragged under.
  druid: { bossRoot: 0.5,
           seed: { reach: 230, scatter: 22, fly: 0.62, arc: 90, r: 88, burst: 14, knock: 90, time: 4, every: 0.5, dmg: 5, heal: 0.3, healMax: 3, sprouts: 15 },
           grow: { time: 3, every: 0.2, radius: 190, near: 0.65, r: 30, rise: 0.22, hold: 1.1, dmg: 6, drag: 16, sink: 0.6 } },
};
const ARC_FIRST = new WeakMap(), DPATH_HITS = new WeakMap();   // (kept off the shots and effects: co-op sends those to guests)

/* ---------- firing ---------- */
// A single card (combat.js shoot).
function magusShot(card, e, o = {}) {
  if (!e) return;
  if (card === 'gravamagus') { gravSwirl(card, e, false, o.quiet); return; }
  if (card === 'twinflame') { twinFlames(card, e, 2, MAGUS.twin.spread, o); return; }
  const fx = card === 'arcana' ? { mark: true } : card === 'explomagus' ? { boom: true } : card === 'darkmagus' ? { drain: true } : {};
  shoot(card, e, { ...o, raw: true, extra: { mh: true, ...fx, ...(o.extra || {}) } });
}
// A combo (combos.js runCombo).
function magusCombo(cb, e0) {
  const card = cb.card, spec = CARDS[card];
  switch (`${card}${cb.n}`) {
    case 'twinflame3': if (e0) twinFlames(card, e0, 4, MAGUS.twin.four); break;          // FOUR FLAMES!
    case 'arcana3':                                                                        // ARCANE PIERCE!
      if (e0) shoot(card, e0, { raw: true, r: spec.r + 3, dmg: spec.dmg + 3, speedMul: 1.15, extra: { mh: true, mark: true, pierce1: true } });
      break;
    case 'explomagus3': if (e0) shoot(card, e0, { raw: true, r: spec.r + 2, extra: { mh: true, boom: true, chain: true } }); break;   // CHAIN BLAST!
    case 'explomagus7': blastWalk(card); break;                                            // BLAST WALK!
    case 'gravamagus3': if (e0) gravSwirl(card, e0, true); break;                          // GRAVITY PULL!
    case 'gravamagus7': gravWell(card); break;                                             // EVENT HORIZON!
    case 'darkmagus3': if (e0) darkPath(card, e0); break;                                  // DARK PATH!
    case 'darkmagus7': voidLaser(card); break;                                             // VOID LASER!
  }
}
// Twin Flame: `n` bolts fanned out, each after its own enemy; they alternate pink and red (`tone`).
function twinFlames(card, e, n, spread, o = {}) {
  const p = game.player, ts = targets(n, rangeOf(card)), a0 = Math.atan2(e.y - p.y, e.x - p.x);
  for (let k = 0; k < n; k++) {
    shoot(card, ts[k] || e, { ...o, raw: true, angle: a0 + (k - (n - 1) / 2) * spread, homeDelay: MAGUS.twin.home, quiet: o.quiet || k > 0, extra: { tone: k % 2 } });
  }
}

/* ---------- on a hit (combat.js, once the shot's own damage is done) ---------- */
// 'keep': the shot flies on (ARCANE PIERCE! going through its first enemy).
function magusHit(pr, e) {
  if (pr.mark) markEnemy(e);
  if (pr.drain) drainEnemy(e);
  if (pr.root) rootEnemy(e, pr.root);
  if (pr.boom) exploBoom(pr.card, e.x, e.y, !!pr.chain);   // (centred on the enemy it hit)
  if (pr.splitBolt) { pr.splitBolt = false; splitBolt(pr, e); }
  if (pr.pierce1) {
    const first = ARC_FIRST.get(pr);
    if (!first) {                                  // through the first one, on toward the nearest enemy ahead (or straight on)
      ARC_FIRST.set(pr, e);
      const next = arcanaNext(pr);
      pr.target = next; pr.homeDelay = next ? 0 : Infinity;
      pr.flown = 0; pr.maxDist = MAGUS.arcana.seek * 1.5;
      return 'keep';
    }
    arcanaStun(first, e);
  }
  return null;
}

// Arcana: the mark, and cashing it in (combat.js hitEnemy calls arcanaCash for any hit on a marked enemy).
function markEnemy(e) { if (!e.dead) e.amark = MAGUS.arcana.mark; }
function arcanaCash(pr, e) {
  e.amark = 0;
  game.sinfx.push({ kind: 'acash', x: e.x, y: e.y, r: (e.r || 10) + 6, life: 0.35, max: 0.35, fixed: true, seed: Math.random() * 6 });
  SFX.magus('mark');
  return { ...pr, dmg: Math.round(pr.dmg * MAGUS.arcana.mul) };
}
// The nearest enemy ahead of a shot that it hasn't hit yet, within `seek`.
function arcanaNext(pr) {
  const a = Math.atan2(pr.vy, pr.vx);
  let best = null, bd = MAGUS.arcana.seek;
  for (const o of game.enemies) {
    if (pr.hits.has(o)) continue;
    const d = hitGap(o, pr.x, pr.y);
    if (d >= bd || Math.cos(Math.atan2(o.y - pr.y, o.x - pr.x) - a) < 0.2) continue;
    bd = d; best = o;
  }
  return best;
}
// ARCANE PIERCE! hit a second enemy: both are stunned, with an arcane bolt crackling between them.
function arcanaStun(a, b) {
  const A = MAGUS.arcana;
  for (const e of [a, b]) {
    if (!game.enemies.includes(e) || e.dummy) continue;
    const t = bossLike(e) ? A.bossStun : A.stun;
    e.stun = Math.max(e.stun || 0, t); e.dazed = Math.max(e.dazed || 0, t);
  }
  game.sinfx.push({ kind: 'alink', x1: a.x, y1: a.y, x2: b.x, y2: b.y, life: 0.42, max: 0.42, fixed: true });
  game.floaters.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16, text: 'STUNNED!', color: COL.arcana, life: 0.8, vy: -36, big: true });
  SFX.magus('stun');
}

// Darkmagus: what it hits keeps losing a little life for a moment (magusStep), and each bit comes back to you.
function drainEnemy(e) {
  const D = MAGUS.dark.drain;
  if (e.dead) return;
  e.drain = D.time * durMul('darkmagus'); e.drainT = D.every; e.drainBy = ownerId();   // (longer at some tiers, v0.62)
}
function drainHeal(e) {
  const D = MAGUS.dark.drain, p = game.player;
  if (!game.practice && p.hp > 0 && p.hp < maxHp()) { p.hp = Math.min(maxHp(), p.hp + D.heal); if (isLocal()) renderHp(false); }
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < 3; k++) {
    const s = 170 + Math.random() * 120;
    game.particles.push({ x: e.x, y: e.y, vx: dx / d * s + (Math.random() - 0.5) * 70, vy: dy / d * s + (Math.random() - 0.5) * 70, life: 0.35, color: COL.darkmagus, spark: true });
  }
}

// Druidity: rooted, it can't move (a boss only for a moment); vines grow round it (drawRoots).
function rootEnemy(e, t) {
  if (e.dead || e.fling) return;
  if (bossLike(e)) t = Math.min(t, MAGUS.druid.bossRoot);
  if (!e.dummy) e.stun = Math.max(e.stun || 0, t);
  e.rootMax = Math.max(t, e.root || 0); e.root = e.rootMax;
  SFX.magus('root');
}

// SPLIT BOLT! (Arcane Bolt ×7): on its first hit the bolt splits. It carries on to the nearest enemy, as a bounce does;
// its twin goes for the next nearest.
function splitBolt(pr, hit) {
  if (pr.bounces <= 0) return;
  const R = pr.bounceRange || BOUNCE_RANGE, gap = o => hitGap(o, pr.x, pr.y);
  const others = game.enemies.filter(o => o !== hit && !pr.hits.has(o) && gap(o) < R).sort((a, b) => gap(a) - gap(b));
  if (!others[1]) return;
  game.projectiles.push({ ...pr, _id: 0, hits: new Set(pr.hits), trail: [], target: others[1], mh: false, splitBolt: false, bounces: pr.bounces - 1, flown: 0, maxDist: R * 1.35 });
  burst(pr.x, pr.y, COL[pr.card], 10, 220);
  game.rings.push({ x: pr.x, y: pr.y, r: 4, max: 26, life: 0.25, color: COL[pr.card] });
  SFX.magus('split');
}

/* ---------- Explomagus ---------- */
// The spark's blast. `chain` (CHAIN BLAST!): every enemy it kills leaves a circle that explodes a moment later.
function exploBoom(card, x, y, chain = false, R = MAGUS.explo.radius, dmg = MAGUS.explo.dmg, small = false) {
  const caught = chain ? game.enemies.filter(e => hitGap(e, x, y) < R) : null;
  blast(x, y, card, R, damageOf(dmg), { knock: small ? 120 : 200 });
  game.sinfx.push({ kind: 'xboom', x, y, r: R, life: 0.6, max: 0.6, fixed: true, seed: Math.random() * 6 });
  game.shake = Math.max(game.shake, small ? 0.05 : 0.1);
  if (!small) SFX.magus('boom');
  if (caught) for (const e of caught) if (e.dead) xRune(card, e.x, e.y, MAGUS.explo.chain);
}
// A circle on the ground that explodes after `fuse` s (CHAIN BLAST!'s, and BLAST WALK!'s `walk` ones).
function xRune(card, x, y, C, walk = false) {
  game.sinfx.push({ kind: 'xrune', card, owner: ownerId(), aug: AUG_FX, x, y, r: C.radius, dmg: C.dmg, fuse: C.fuse, t: 0, walk, done: false,
    life: C.fuse + 0.3, max: C.fuse + 0.3, fixed: true, seed: Math.random() * 6 });
}
// BLAST WALK! (×7): for `time` s, a circle is left wherever you walk, each exploding behind you.
function blastWalk(card) {
  const W = MAGUS.explo.walk, p = game.player;
  game.sinfx.push(pinTo({ kind: 'xwalk', card, x: p.x, y: p.y, lx: p.x, ly: p.y, next: 0, life: W.time, max: W.time }));
}

/* ---------- Gravamagus ---------- */
// A laser swirl on the ground where the enemy is about to be. `pull` (GRAVITY PULL!): it drags what's caught in it to
// its centre until it goes off.
function gravSwirl(card, e, pull = false, quiet = false) {
  const G = MAGUS.grav, h = playH || H;
  const x = Math.max(12, Math.min(W - 12, e.x + (e.vx || 0) * G.lead)), y = Math.max(12, Math.min(h - 12, e.y + (e.vy || 0) * G.lead));
  game.sinfx.push({ kind: 'gswirl', card, owner: ownerId(), aug: AUG_FX, x, y, r: G.r * (pull ? 1.15 : 1), t: 0, delay: G.delay, pull, done: false,
    life: G.delay + 0.45, max: G.delay + 0.45, fixed: true, seed: Math.random() * 6 });
  if (!quiet) SFX.fire(card);
}
// EVENT HORIZON! (×7): a huge circle that moves with you; everything in it is slowed (and crushed a little).
function gravWell(card) {
  const W0 = MAGUS.grav.well, p = game.player;
  game.sinfx.push(pinTo({ kind: 'gwell', card, x: p.x, y: p.y, r: W0.r, tick: W0.every, life: W0.time, max: W0.time, seed: Math.random() * 6 }));
  SFX.magus('well');
}

/* ---------- Darkmagus ---------- */
// DARK PATH! (×3): a long rectangle of dark energy toward the enemy. It grows out in a moment; everything on it is hit
// once and slowed for as long as it's on it (and a moment after).
function darkPath(card, e) {
  const P = MAGUS.dark.path, p = game.player;
  game.sinfx.push({ kind: 'dpath', card, owner: ownerId(), aug: AUG_FX, x: p.x, y: p.y, a: Math.atan2(e.y - p.y, e.x - p.x), len: P.len, w: P.w,
    life: P.life, max: P.life, fixed: true, seed: Math.random() * 6 });
  SFX.fire(card);
  game.shake = Math.max(game.shake, 0.08);
}
// VOID LASER! (×7): dark energy is sucked into you, then dark lasers blast out, one after another, in random directions.
function voidLaser(card) {
  const U = MAGUS.dark.ult, p = game.player;
  game.sinfx.push(pinTo({ kind: 'dcharge', card, x: p.x, y: p.y, life: U.charge, max: U.charge, seed: Math.random() * 6 }));
  SFX.magus('charge');
  later(U.charge, () => { for (let k = 0; k < U.count; k++) later(k * U.gap, () => darkLaser(card, Math.random() * Math.PI * 2)); });
}
function darkLaser(card, a) {
  const U = MAGUS.dark.ult, p = game.player, len = edgeDist(p.x, p.y, a) + 30, ca = Math.cos(a), sa = Math.sin(a);
  for (const e of game.enemies.slice()) {                    // everything on its line, to the arena's edge
    const ex = e.x - p.x, ey = e.y - p.y, along = ex * ca + ey * sa, off = Math.abs(-ex * sa + ey * ca), R = e.r || 10;
    if (along < 0 || along > len + R || off > U.w / 2 + R) continue;
    hitEnemy({ card, look: 'dark', dmg: damageOf(U.dmg), knock: knockOf(U.knock), vx: ca, vy: sa, x: e.x, y: e.y }, e);
  }
  game.sinfx.push({ kind: 'dlaser', card, owner: ownerId(), aug: AUG_FX, x: p.x, y: p.y, a, len, w: U.w, life: 0.34, max: 0.34, fixed: true });
  game.shake = Math.max(game.shake, 0.2);
  SFX.magus('laser');
}

/* ---------- Druidity (v0.65, melee: melee.js hands these over) ---------- */
// SEED BOMB! (×3, v0.66, user: "throw a seed bomb randomly … a circle around is the indicator … explodes to seedlings,
// corrupts the ground below, slowing enemies and damage = you gain health"): thrown at enemy `e`, landing a little off
// it; a circle on the floor shows where (drawSeedGround) until it lands (seedLand).
function seedBomb(card, e) {
  const S = MAGUS.druid.seed, p = game.player, b = Math.random() * TAU, d = Math.random() * S.scatter;
  const at = { x: e.x + Math.cos(b) * d, y: e.y + Math.sin(b) * d }; clampTo(at, 12);
  game.sinfx.push({ kind: 'seedbomb', card, owner: ownerId(), aug: AUG_FX, x0: p.x, y0: p.y - PLAYER.r, x: at.x, y: at.y, r: S.r, life: S.fly, max: S.fly, fixed: true, seed: (Math.random() * 1e9) | 0 });
  SFX.magus('toss');
  later(S.fly, () => seedLand(card, at.x, at.y));
}
// It bursts: everything within `r` is hurt and knocked back a little, dirt and seeds are thrown up, and the ground turns
// to blight (blightStep hurts and slows what's on it, and heals you).
function seedLand(card, x, y) {
  const S = MAGUS.druid.seed;
  let dealt = 0;
  for (const e of game.enemies.slice()) {
    if (hitGap(e, x, y) > S.r) continue;
    const a = Math.atan2(e.y - y, e.x - x);
    hitEnemy({ card, look: 'seed', dmg: damageOf(S.burst), knock: knockOf(S.knock), vx: Math.cos(a), vy: Math.sin(a), x: e.x, y: e.y }, e);
    dealt += damageOf(S.burst);
  }
  blightHeal(dealt, x, y);
  game.sinfx.push({ kind: 'blight', card, owner: ownerId(), aug: AUG_FX, x, y, r: S.r, tick: S.every, life: S.time, max: S.time, fixed: true, seed: (Math.random() * 1e9) | 0 });
  game.sinfx.push({ kind: 'sboom', x, y, r: S.r, life: 0.55, max: 0.55, fixed: true, seed: (Math.random() * 1e9) | 0 });
  for (let k = 0; k < 14; k++) {                             // clods of earth and seeds thrown up
    const b = Math.random() * TAU, v = 70 + Math.random() * 130;
    game.sinfx.push({ kind: 'rock', x, y, vx: Math.cos(b) * v, vy: Math.sin(b) * v * 0.6, z: 2, vz: 140 + Math.random() * 160, size: 1.5 + Math.random() * 2.2, spin: Math.random() * TAU, life: 0.7, max: 0.7, fixed: true, col: k % 3 ? COL.oakDark : COL.seed, edge: k % 3 ? COL.blight : COL.blightHi });
  }
  for (let k = 0; k < 16; k++) {                             // a puff of spores
    const b = Math.random() * TAU, v = 40 + Math.random() * 140;
    game.particles.push({ x, y, vx: Math.cos(b) * v, vy: Math.sin(b) * v * 0.6 - 40, life: 0.4 + Math.random() * 0.4, color: k % 2 ? COL.blightHi : COL.leafHi, spark: true });
  }
  game.shake = Math.max(game.shake, 0.16);
  SFX.magus('seed');
}
function blightStep(f, dt) {
  const S = MAGUS.druid.seed, hurt = (f.tick -= dt) <= 0;
  if (hurt) f.tick += S.every;
  usePlayerId(f.owner, f.aug);
  let dealt = 0;
  for (const e of game.enemies.slice()) {
    if (e.dead || hitGap(e, f.x, f.y) > f.r) continue;
    e.mslow = Math.max(e.mslow || 0, 0.25);
    if (!hurt) continue;
    hitEnemy({ card: f.card, look: 'seed', dmg: damageOf(S.dmg), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
    dealt += damageOf(S.dmg);
    for (let k = 0; k < 2; k++) game.particles.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, life: 0.5, color: COL.blightHi, spark: true });
  }
  if (dealt) blightHeal(dealt, f.x, f.y);
  if (!reducedMotion && Math.random() < dt * 10 * Math.min(1, f.life)) {   // spores drifting up off it
    const b = Math.random() * TAU, d = Math.sqrt(Math.random()) * f.r;
    game.particles.push({ x: f.x + Math.cos(b) * d, y: f.y + Math.sin(b) * d, vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 26, life: 0.7 + Math.random() * 0.5, color: Math.random() < 0.6 ? COL.blightHi : COL.leafHi });
  }
}
// Some of the damage the blight does comes back to you as health: a green "+N" and a few motes flying to you.
function blightHeal(dealt, x, y) {
  const S = MAGUS.druid.seed, p = game.player, gain = Math.min(S.healMax, Math.round(dealt * S.heal * 10) / 10);
  if (!(gain > 0) || !(p.hp > 0)) return;
  const was = p.hp;
  if (!game.practice) p.hp = Math.min(maxHp(), p.hp + gain);   // (in Test you can't be hurt: it only shows what it would heal)
  if (p.hp > was || game.practice) {
    if (isLocal() && p.hp > was) renderHp(false);
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: `+${Math.round((game.practice ? gain : p.hp - was) * 10) / 10}`, color: COL.leafHi, life: 0.7, vy: -38 });
  }
  const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < 3; k++) {
    const sp = 200 + Math.random() * 120;
    game.particles.push({ x, y, vx: dx / d * sp + (Math.random() - 0.5) * 80, vy: dy / d * sp + (Math.random() - 0.5) * 80, life: Math.min(0.45, d / sp), color: COL.leafHi, spark: true });
  }
}
// OVERGROWTH! (×7): vines burst up round you for `time` s (overgrowthStep makes them).
function overgrowth(card) {
  const G = MAGUS.druid.grow, p = game.player;
  game.sinfx.push(pinTo({ kind: 'ogrow', card, x: p.x, y: p.y, next: 0, life: G.time, max: G.time }));
}
function overgrowthStep(f, dt) {
  const G = MAGUS.druid.grow;
  if ((f.next -= dt) > 0) return;
  f.next = G.every;
  usePlayerId(f.owner, f.aug);
  const near = game.enemies.filter(e => !e.dead && !e.mrock && !e.apple && !e.dummy && hitGap(e, f.x, f.y) < G.radius);
  let x, y;
  if (near.length && Math.random() < G.near) { const e = near[Math.floor(Math.random() * near.length)]; x = e.x; y = e.y; }
  else { const b = Math.random() * TAU, d = 40 + Math.random() * (G.radius - 40); x = f.x + Math.cos(b) * d; y = f.y + Math.sin(b) * d; }
  const at = { x, y }; clampTo(at, 8);
  game.sinfx.push({ kind: 'vgrab', card: f.card, x: at.x, y: at.y, t: 0, done: false, owner: f.owner, aug: f.aug, life: G.rise + G.hold * durMul(f.card) + 0.35, max: G.rise + G.hold * durMul(f.card) + 0.35, fixed: true, seed: (Math.random() * 1e9) | 0 });
  SFX.magus('vine');
}
// A burst of vines: as it finishes rising it grabs what's on it (hurt, held); while it holds, it drags it down; at the
// end it's dragged under, hurt again, and let go.
const GRABBED = new WeakMap();                                // (kept off the effect: co-op sends those to guests)
function vgrabStep(f, dt) {
  const G = MAGUS.druid.grow, hold = G.hold * durMul(f.card);
  f.t += dt;
  usePlayerId(f.owner, f.aug);
  if (!f.grabbed && f.t >= G.rise) {
    f.grabbed = true;
    const held = game.enemies.filter(e => !e.dead && !e.mrock && !e.apple && !e.fling && hitGap(e, f.x, f.y) < G.r);
    GRABBED.set(f, held);
    for (const e of held) {
      hitEnemy({ card: f.card, look: 'vine', dmg: damageOf(G.dmg), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
      rootEnemy(e, hold);
    }
    if (held.length) game.shake = Math.max(game.shake, 0.08);
  }
  const held = GRABBED.get(f) || [];
  if (f.grabbed && !f.done) for (const e of held) {           // dragged toward its middle and down into the ground
    if (!game.enemies.includes(e) || bossLike(e) || e.dummy) continue;
    const k = Math.min(1, (f.t - G.rise) / hold);
    e.x += (f.x - e.x) * Math.min(1, dt * 6); e.y += (f.y - e.y) * Math.min(1, dt * 6);
    e.sink = Math.max(e.sink || 0, G.sink * k * k);
  }
  if (!f.done && f.t >= G.rise + hold) {
    f.done = true;
    for (const e of held) if (game.enemies.includes(e) && !e.dead) {
      hitEnemy({ card: f.card, look: 'vine', dmg: damageOf(G.drag), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
      burst(e.x, e.y + (e.r || 10) * 0.6, COL.oakDark, 8, 120);
    }
    SFX.magus('root');
  }
}

/* ---------- each frame (combat.js update) ---------- */
function magusStep(dt) {
  const D = MAGUS.dark.drain;
  for (const e of game.enemies) {
    if (e.root > 0) e.root = Math.max(0, e.root - dt);
    if (e.amark > 0) e.amark = Math.max(0, e.amark - dt);
    if (e.mslow > 0) e.mslow = Math.max(0, e.mslow - dt);
  }
  for (const e of game.enemies.slice()) {                    // Darkmagus: a drained enemy loses a little at a time
    if (!(e.drain > 0)) continue;
    e.drain -= dt;
    if ((e.drainT -= dt) > 0) continue;
    e.drainT += D.every;
    usePlayerId(e.drainBy);
    hitEnemy({ card: 'darkmagus', look: 'dark', dmg: damageOf(D.dmg), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
    drainHeal(e);
  }
  for (const f of game.sinfx) {
    if (f.kind === 'gswirl') swirlStep(f, dt);
    else if (f.kind === 'gwell') wellStep(f, dt);
    else if (f.kind === 'dpath') pathStep(f);
    else if (f.kind === 'xrune') runeStep(f, dt);
    else if (f.kind === 'xwalk') walkStep(f, dt);
    else if (f.kind === 'ogrow') overgrowthStep(f, dt);
    else if (f.kind === 'vgrab') vgrabStep(f, dt);
    else if (f.kind === 'blight') blightStep(f, dt);
  }
  for (const e of game.enemies) if (e.sink > 0 && !(e.root > 0)) e.sink = Math.max(0, e.sink - dt * 2.5);   // OVERGROWTH! lets go: it climbs back out
}
function swirlStep(f, dt) {
  const G = MAGUS.grav;
  f.t += dt;
  if (f.pull && f.t < f.delay) for (const e of game.enemies) {   // GRAVITY PULL!: dragged in, harder as it builds
    if (e.dummy || e.fling || bossLike(e)) continue;
    const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy);
    if (d < 1 || d - e.r > f.r * G.pullR) continue;
    const step = Math.min(d, G.pull * (0.4 + f.t / f.delay) * dt);
    e.x += dx / d * step; e.y += dy / d * step;
  }
  if (f.done || f.t < f.delay) return;
  f.done = true;
  usePlayerId(f.owner, f.aug);
  blast(f.x, f.y, f.card, f.r, damageOf(CARDS[f.card].dmg + (f.pull ? G.more : 0)), { knock: f.pull ? 60 : 110, sized: true });
  game.shake = Math.max(game.shake, 0.1);
  SFX.magus('implode');
}
function wellStep(f, dt) {
  const W0 = MAGUS.grav.well, hurt = (f.tick -= dt) <= 0;
  if (hurt) f.tick += W0.every;
  usePlayerId(f.owner, f.aug);
  for (const e of game.enemies.slice()) {
    if (hitGap(e, f.x, f.y) > f.r) continue;
    e.mslow = Math.max(e.mslow || 0, W0.slow);
    if (hurt && W0.dmg) hitEnemy({ card: f.card, look: 'swirl', dmg: damageOf(W0.dmg), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
  }
}
function pathStep(f) {
  const P = MAGUS.dark.path, L = f.len * Math.min(1, (f.max - f.life) / P.grow), ca = Math.cos(f.a), sa = Math.sin(f.a);
  let hits = DPATH_HITS.get(f);
  if (!hits) DPATH_HITS.set(f, hits = new Set());
  usePlayerId(f.owner, f.aug);
  for (const e of game.enemies.slice()) {
    const ex = e.x - f.x, ey = e.y - f.y, along = ex * ca + ey * sa, off = Math.abs(-ex * sa + ey * ca), R = e.r || 10;
    if (along < -R || along > L + R || off > f.w / 2 + R) continue;
    e.mslow = Math.max(e.mslow || 0, P.slow);
    if (hits.has(e)) continue;
    hits.add(e);
    hitEnemy({ card: f.card, look: 'dark', dmg: damageOf(P.dmg), knock: knockOf(60), vx: ca, vy: sa, x: e.x, y: e.y }, e);
  }
}
function runeStep(f, dt) {
  f.t += dt;
  if (f.done || f.t < f.fuse) return;
  f.done = true; f.life = Math.min(f.life, 0.02);
  usePlayerId(f.owner, f.aug);
  exploBoom(f.card, f.x, f.y, false, f.r, f.dmg, f.walk);
}
function walkStep(f, dt) {
  const W0 = MAGUS.explo.walk;
  f.next -= dt;
  if (Math.hypot(f.x - f.lx, f.y - f.ly) < W0.step && f.next > 0) return;
  f.lx = f.x; f.ly = f.y; f.next = W0.wait;
  usePlayerId(f.owner, f.aug);
  xRune(f.card, f.x, f.y, W0, true);
}
/* ---------- drawing ---------- */
const magusNow = () => (reducedMotion ? 0 : performance.now() / 1000);
const fxAge = f => f.max - f.life;                          // seconds since it began (a co-op guest's copy too)
function diamondPath(x, y, hw, hh, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), pt = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  ctx.beginPath();
  [[0, -hh], [hw, 0], [0, hh], [-hw, 0]].forEach(([u, v], i) => { const [px, py] = pt(u, v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.closePath();
}
// v0.60 (user: "make some of the effects 3D"): a shot's shadow on the ground under it, as if it flies at a height …
function shotShadow(x, y, r, h = 11) {
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ellipse(x, y + h, r * 1.15, r * 0.45); ctx.globalAlpha = 1;
}
// … and a ball lit like a sphere: a highlight up on its top left, a shadowed rim at its bottom right.
function sphereShade(x, y, r, a = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.6 * a})`); g.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.75, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, `rgba(0, 0, 0, ${0.5 * a})`);
  ctx.globalAlpha = 1; ctx.fillStyle = g; circle(x, y, r);
}
// A ball of fire cooling into smoke (`smoke` 0 → 1), lit from above like a sphere: Explomagus's explosions.
function firePuff(x, y, r, smoke, a) {
  if (smoke < 1) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
    g.addColorStop(0, '#fff6d0'); g.addColorStop(0.3, COL.exploHot); g.addColorStop(0.68, COL.explomagus); g.addColorStop(1, hexA(COL.explomagus, 0));
    fxAdd(COL.explomagus); ctx.globalAlpha = a * (1 - smoke); ctx.fillStyle = g; circle(x, y, r); fxNormal();
  }
  if (smoke > 0) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 1.1);
    g.addColorStop(0, '#77707c'); g.addColorStop(0.5, '#3b3641'); g.addColorStop(1, 'rgba(22, 20, 26, 0)');
    ctx.globalAlpha = a * smoke * 0.85; ctx.fillStyle = g; circle(x, y, r * 1.1);
  }
  ctx.globalAlpha = 1;
}
function leafShape(x, y, s, rot, col) {                      // a pointed leaf, `s` long
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.6, 0, 0, s); ctx.quadraticCurveTo(-s * 0.6, 0, 0, -s); ctx.fill();
  ctx.restore();
}

// The shots (draw.js, before its own looks): false if it isn't one of these.
function drawMagusShot(pr) {
  const lk = pr.look;
  if (lk !== 'twin' && lk !== 'arcana' && lk !== 'spark' && lk !== 'dark' && lk !== 'seed') return false;
  const t = pr.trail, r = pr.r, a = Math.atan2(pr.vy, pr.vx), now = magusNow(), ph = pr.sway || 0;
  shotShadow(pr.x, pr.y, r * 1.3);
  if (lk === 'twin') {                                         // a little flame, pink or red, shedding embers that cool behind it
    const c = pr.tone ? COL.twinRed : COL.twinflame, c2 = pr.tone ? COL.twinflame : COL.twinRed;
    fxAdd(c);
    for (let i = 2; i < t.length; i += 2) {
      const k = i / t.length, j = Math.sin(i * 1.7 + now * 30 + ph) * 1.6 * (1 - k);
      ctx.globalAlpha = k * 0.55; ctx.fillStyle = k > 0.55 ? c : COL.twinRed;
      circle(t[i] - Math.sin(a) * j, t[i + 1] + Math.cos(a) * j, r * (0.3 + 0.7 * k));
    }
    fxNormal();
    fxGlow(pr.x, pr.y, r * 4 + 9, c, 0.9);
    const fl = reducedMotion ? 1 : 0.82 + 0.3 * Math.abs(Math.sin(now * 37 + ph * 5));
    const flame = (s, col) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(r * 1.5 * s, 0);
      ctx.bezierCurveTo(r * 1.4 * s, -r * 1.25 * s, -r * 0.9 * s, -r * 1.2 * s, -r * 3.8 * s * fl, 0);
      ctx.bezierCurveTo(-r * 0.9 * s, r * 1.2 * s, r * 1.4 * s, r * 1.25 * s, r * 1.5 * s, 0); ctx.fill();
    };
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
    ctx.globalAlpha = 0.95; flame(1.15, c);
    ctx.globalAlpha = 0.9; flame(0.75, c2);
    ctx.globalAlpha = 1; flame(0.42, COL.twinHot);
    ctx.fillStyle = COL.player; circle(r * 0.5, 0, r * 0.38);
    ctx.restore();
  } else if (lk === 'arcana') {                                // a diamond turning like a coin, with little diamonds trailing
    const c = COL.arcana, big = !!pr.pierce1;
    for (let i = 0; i < t.length; i += 4) {
      const k = i / t.length;
      ctx.globalAlpha = k * 0.45; ctx.fillStyle = c; diamondPath(t[i], t[i + 1], r * 0.45 * k, r * 0.8 * k, a + Math.PI / 2); ctx.fill();
    }
    fxGlow(pr.x, pr.y, r * 4.5 + (big ? 12 : 6), c, 0.9);
    const wob = reducedMotion ? 0 : Math.sin(pr.spin * 0.4) * 0.3, w = r * 1.25, hh = r * 1.9;   // a gem, wobbling a little as it flies
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a + Math.PI / 2 + wob);
    ctx.globalAlpha = 1; ctx.fillStyle = shadeHex(c, -0.3); diamondPath(0, 0, w, hh); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(-w, 0); ctx.lineTo(0, hh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.arcanaHi;                                  // its lit facet
    ctx.beginPath(); ctx.moveTo(0, -hh); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = COL.arcanaHi; ctx.lineWidth = 1; diamondPath(0, 0, w, hh); ctx.stroke();
    ctx.restore();
    if (big) {                                                 // ARCANE PIERCE!: a ring of runes turning round it
      ctx.globalAlpha = 0.7; ctx.fillStyle = COL.arcanaHi;
      for (let k = 0; k < 6; k++) { const b = now * 5 + k * Math.PI / 3; diamondPath(pr.x + Math.cos(b) * (r + 7), pr.y + Math.sin(b) * (r + 7), 1.4, 2.6, b); ctx.fill(); }
    }
  } else if (lk === 'spark') {                                 // a fizzing ball of magic, crackling, its light pulsing
    const c = COL.explomagus, hot = COL.exploHot, pulse = reducedMotion ? 1 : 0.8 + 0.35 * Math.sin(now * 22 + ph);
    fxAdd(c);
    for (let i = 0; i < t.length; i += 2) { const k = i / t.length; ctx.globalAlpha = k * 0.35; ctx.fillStyle = c; circle(t[i], t[i + 1], r * (0.3 + 0.6 * k)); }
    fxNormal();
    fxGlow(pr.x, pr.y, (r * 5 + 10) * pulse, c, 0.95);
    fxAdd(hot); ctx.strokeStyle = hot; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {                              // the crackle: short jagged rays, new every frame
      const b = (k / 6) * Math.PI * 2 + now * 3 + (reducedMotion ? 0 : Math.random() * 0.6), L = r * (1.3 + (reducedMotion ? 0.6 : Math.random() * 1.4));
      ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(pr.x + Math.cos(b) * r * 0.6, pr.y + Math.sin(b) * r * 0.6);
      ctx.lineTo(pr.x + Math.cos(b + 0.35) * L * 0.6, pr.y + Math.sin(b + 0.35) * L * 0.6); ctx.lineTo(pr.x + Math.cos(b) * L, pr.y + Math.sin(b) * L); ctx.stroke();
    }
    fxNormal();
    ctx.globalAlpha = 1; ctx.fillStyle = c; circle(pr.x, pr.y, r * pulse);
    ctx.fillStyle = hot; circle(pr.x, pr.y, r * 0.65 * pulse);
    sphereShade(pr.x, pr.y, r * pulse, 0.8);
    ctx.fillStyle = COL.player; circle(pr.x - r * 0.2, pr.y - r * 0.2, r * 0.3);
    if (pr.chain) { ctx.globalAlpha = 0.7; ctx.strokeStyle = hot; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(pr.x, pr.y, r * 2.2, now * 4, now * 4 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  } else if (lk === 'dark') {                                  // a black orb rimmed in violet, dark tendrils turning round it, smoke behind
    const c = COL.darkmagus, core = COL.darkCore;
    for (let i = 0; i < t.length; i += 2) {
      const k = i / t.length, s = r * (0.5 + 0.9 * k);
      ctx.globalAlpha = k * 0.3; ctx.fillStyle = c; circle(t[i], t[i + 1], s + 1.5);
      ctx.globalAlpha = k * 0.55; ctx.fillStyle = core; circle(t[i], t[i + 1], s);
    }
    fxGlow(pr.x, pr.y, r * 5 + 8, c, 0.9);
    ctx.globalAlpha = 1; ctx.fillStyle = c; circle(pr.x, pr.y, r + 1.6);
    ctx.fillStyle = core; circle(pr.x, pr.y, r);
    sphereShade(pr.x, pr.y, r + 1.6, 0.7);
    ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const b = now * 7 + k * Math.PI * 2 / 3 + ph; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(pr.x, pr.y, r * 1.75, b, b + 1.1); ctx.stroke(); }
    ctx.fillStyle = shadeHex(c, 0.5); ctx.globalAlpha = 0.9; circle(pr.x - r * 0.3, pr.y - r * 0.3, r * 0.25);
  } else {                                                     // 'seed': a ball of green magic, two leaves circling it
    const c = COL.druidity;
    fxAdd(c);
    for (let i = 0; i < t.length; i += 2) { const k = i / t.length; ctx.globalAlpha = k * 0.4; ctx.fillStyle = c; circle(t[i], t[i + 1], r * (0.25 + 0.6 * k)); }
    fxNormal();
    fxGlow(pr.x, pr.y, r * 4.5 + 8, c, 0.85);
    ctx.globalAlpha = 1; ctx.fillStyle = COL.vine; circle(pr.x, pr.y, r);
    ctx.fillStyle = c; circle(pr.x - r * 0.15, pr.y - r * 0.15, r * 0.75);
    sphereShade(pr.x, pr.y, r);
    for (let k = 0; k < 2; k++) { const b = pr.spin * 0.5 + k * Math.PI; leafShape(pr.x + Math.cos(b) * r * 1.6, pr.y + Math.sin(b) * r * 1.6, r * 0.9, b, k ? c : COL.vine); }
  }
  ctx.globalAlpha = 1;
  return true;
}

// On the floor, under the enemies (draw.js, after the other ground effects).
function drawMagusGround() {
  const now = magusNow();
  for (const f of game.sinfx) {
    if (f.kind === 'gswirl') drawSwirl(f, now);
    else if (f.kind === 'gwell') drawWell(f, now);
    else if (f.kind === 'dpath') drawDarkPath(f, now);
    else if (f.kind === 'xrune') drawXRune(f, now);
    else if (f.kind === 'vgrab') drawGrabGround(f);                  // OVERGROWTH!'s torn ground (v0.65)
    else if (f.kind === 'blight') drawBlight(f, now);                 // SEED BOMB!'s corrupted ground and seedlings (v0.66)
    else if (f.kind === 'seedbomb') drawSeedMark(f, now);             // … and the circle where it'll land
    else if (f.kind === 'xboom') {                             // Explomagus: the scorched ground where it went off
      const k = 1 - f.life / f.max;
      ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = COL.bearDark; ellipse(f.x, f.y, f.r * 0.75, f.r * 0.6);
      fxGlow(f.x, f.y, f.r * 0.8, COL.explomagus, 0.5 * (1 - k));
    }
  }
  ctx.globalAlpha = 1; fxNormal();
}
// Gravamagus: a disc on the ground, thin laser arms swirling in it, faster and tighter as it builds, a bright arc
// going round its edge as the countdown, then a flash as it goes off.
function swirlArms(x, y, R, n, spin, curl, a1, a2, fade, c, hi) {
  fxAdd(c);
  for (let k = 0; k < n; k++) {
    ctx.beginPath();
    for (let s = 0; s <= 18; s++) {
      const v = s / 18, rad = R * (0.08 + 0.92 * v), b = spin + k * Math.PI * 2 / n + v * curl;
      const px = x + Math.cos(b) * rad, py = y + Math.sin(b) * rad;
      s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.globalAlpha = a1 * fade; ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
    ctx.globalAlpha = a2 * fade; ctx.strokeStyle = hi; ctx.lineWidth = 1.2; ctx.stroke();
  }
  fxNormal();
}
function drawSwirl(f, now) {
  const u = fxAge(f), c = COL.gravamagus, hi = COL.gravHi;
  if (u < f.delay) {
    const q = u / f.delay, fade = Math.min(1, u * 8);
    ctx.globalAlpha = (0.1 + 0.12 * q) * fade; ctx.fillStyle = c; circle(f.x, f.y, f.r);
    ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.95 * fade; ctx.strokeStyle = hi; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); ctx.stroke();
    const fun = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);   // a funnel sinking into the ground at its heart
    fun.addColorStop(0, hexA(COL.darkCore, 0.75)); fun.addColorStop(0.55, hexA(COL.darkCore, 0.25)); fun.addColorStop(1, hexA(COL.darkCore, 0));
    ctx.globalAlpha = fade * (0.6 + 0.4 * q); ctx.fillStyle = fun; circle(f.x, f.y, f.r);
    swirlArms(f.x, f.y, f.r, 5, (f.seed || 0) + now * (4 + 8 * q) * (f.pull ? -1 : 1), (2.2 + 1.6 * q) * (f.pull ? -1 : 1), 0.35, 0.95, fade, c, hi);
    fxGlow(f.x, f.y, f.r * 0.5 * (0.6 + q), c, 0.5 + 0.4 * q);
    if (f.pull) {                                              // GRAVITY PULL!: motes being dragged in from round it
      ctx.fillStyle = hi;
      for (let k = 0; k < 12; k++) {
        const v = (now * 1.4 + k / 12) % 1, rad = f.r * 1.35 * (1 - v), b = k * 2.4 + now * 2;
        ctx.globalAlpha = v * fade; ctx.fillRect(f.x + Math.cos(b) * rad - 1, f.y + Math.sin(b) * rad - 1, 2, 2);
      }
    }
  } else {
    const k = Math.min(1, (u - f.delay) / (f.max - f.delay)), fade = 1 - k;
    fxAdd(hi); ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = hi; circle(f.x, f.y, f.r * (0.9 + 0.2 * k)); fxNormal();
    ctx.globalAlpha = fade; ctx.strokeStyle = hi; ctx.lineWidth = 1 + 3 * fade; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + 0.5 * k), 0, Math.PI * 2); ctx.stroke();
    fxGlow(f.x, f.y, f.r * 1.6, c, 0.9 * fade);
  }
  ctx.globalAlpha = 1;
}
// EVENT HORIZON!: a huge dim circle round you, its rim ticked like a dial, slow arms turning in it, and rings of
// gravity sinking toward its dark heart.
function drawWell(f, now) {
  const u = fxAge(f), fade = Math.min(1, u * 4, f.life * 2), c = COL.gravamagus, hi = COL.gravHi;
  ctx.globalAlpha = 0.11 * fade; ctx.fillStyle = c; circle(f.x, f.y, f.r);
  ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = COL.darkCore; circle(f.x, f.y, f.r * 0.3);
  ctx.strokeStyle = c; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const v = (now * 0.45 + i / 3) % 1;
    ctx.globalAlpha = 0.35 * fade * v; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - v * 0.85), 0, Math.PI * 2); ctx.stroke();
  }
  swirlArms(f.x, f.y, f.r, 3, (f.seed || 0) + now * 1.2, 2.6, 0.18, 0.4, fade, c, hi);
  ctx.globalAlpha = 0.75 * fade; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = 1.5;
  for (let k = 0; k < 28; k++) {
    const b = k / 28 * Math.PI * 2 - now * 0.4, l = k % 4 ? 4 : 9;
    ctx.globalAlpha = (k % 4 ? 0.45 : 0.85) * fade;
    ctx.beginPath(); ctx.moveTo(f.x + Math.cos(b) * f.r, f.y + Math.sin(b) * f.r); ctx.lineTo(f.x + Math.cos(b) * (f.r - l), f.y + Math.sin(b) * (f.r - l)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// DARK PATH!: a long dark slab, violet light streaming along it and glowing at its edges.
function drawDarkPath(f, now) {
  const c = COL.darkmagus, u = fxAge(f), fade = Math.min(1, f.life * 3), L = f.len * Math.min(1, u / MAGUS.dark.path.grow), h = f.w / 2;
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
  ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = COL.darkCore; ctx.fillRect(0, -h, L, f.w);
  fxAdd(c);
  const g = ctx.createLinearGradient(0, -h, 0, h);
  g.addColorStop(0, hexA(c, 0.85)); g.addColorStop(0.22, hexA(c, 0)); g.addColorStop(0.78, hexA(c, 0)); g.addColorStop(1, hexA(c, 0.85));
  ctx.globalAlpha = fade; ctx.fillStyle = g; ctx.fillRect(0, -h, L, f.w);
  ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    const v = (now * 1.6 + k * 0.137 + (f.seed || 0)) % 1, y = (((k * 0.618) % 1) - 0.5) * f.w * 0.8;
    ctx.globalAlpha = 0.7 * fade * Math.sin(v * Math.PI); ctx.beginPath(); ctx.moveTo(v * L, y); ctx.lineTo(Math.max(0, v * L - 28), y); ctx.stroke();
  }
  fxNormal();
  ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(0, -h, L, f.w);
  ctx.restore();
  ctx.globalAlpha = 1;
}
// Explomagus's circles: they fill as the fuse burns, a rune of sparks turning in them, and flicker just before.
function drawXRune(f, now) {
  if (f.done) return;
  const c = COL.explomagus, hot = COL.exploHot, q = Math.min(1, fxAge(f) / f.fuse), blink = q > 0.7 && !reducedMotion && Math.floor(now * 18) % 2;
  ctx.globalAlpha = 0.12 + 0.2 * q; ctx.fillStyle = c; circle(f.x, f.y, f.r * (0.3 + 0.7 * q));
  ctx.globalAlpha = 0.85; ctx.strokeStyle = blink ? COL.player : c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = hot; ctx.lineWidth = 1.5;
  for (let k = 0; k < 8; k++) {
    const b = k * Math.PI / 4 + now * 2 + (f.seed || 0), r1 = f.r * 0.55, r2 = f.r * 0.75;
    ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(b) * r1, f.y + Math.sin(b) * r1); ctx.lineTo(f.x + Math.cos(b + 0.2) * r2, f.y + Math.sin(b + 0.2) * r2); ctx.stroke();
  }
  fxGlow(f.x, f.y, 10 + 12 * q, c, 0.8);
  ctx.globalAlpha = 1; ctx.fillStyle = hot; circle(f.x, f.y, 2 + 2 * q);
}

// Over the enemies (draw.js, with the other attacks' effects): roots, marks, drains, slows, then the effects.
function drawMagusTop() {
  const now = magusNow();
  for (const e of game.enemies) {
    if (e.mslow > 0) drawSlowed(e, now);
    if (e.root > 0) drawRoots(e, now);
    if (e.drain > 0) drawDrain(e, now);
    if (e.amark > 0) drawMark(e, now);
  }
  for (const f of game.sinfx) {
    if (f.kind === 'vgrab') drawGrab(f, now);                      // OVERGROWTH!'s vines (v0.65)
    else if (f.kind === 'seedbomb') drawSeedBomb(f, now);           // SEED BOMB! in the air (v0.66) …
    else if (f.kind === 'sboom') drawSeedBoom(f);                   // … and bursting
    else if (f.kind === 'alink') drawArcLink(f);
    else if (f.kind === 'acash') drawCash(f);
    else if (f.kind === 'xboom') drawXBoom(f);
    else if (f.kind === 'xwalk') drawXWalk(f, now);
    else if (f.kind === 'dcharge') drawCharge(f, now);
    else if (f.kind === 'dlaser') drawDarkLaser(f);
  }
  ctx.globalAlpha = 1; fxNormal();
}
// Slowed (Darkmagus, Gravamagus): a dark violet ring at its feet, turning slowly, and a drag of shadow under it.
function drawSlowed(e, now) {
  const R = e.r || 10, a0 = Math.min(1, e.mslow * 3);
  ctx.globalAlpha = 0.25 * a0; ctx.fillStyle = COL.darkCore; ellipse(e.x, e.y + R * 0.7, R * 1.1, R * 0.35);
  ctx.globalAlpha = 0.7 * a0; ctx.strokeStyle = COL.darkmagus; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -now * 10;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + R * 0.7, R * 1.2, R * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
}
// Rooted: vines curl up round it from a dark patch of ground, growing in, with a leaf on each.
function drawRoots(e, now) {
  const R = e.r || 10, grow = Math.min(1, ((e.rootMax || 1) - e.root) / 0.2), fade = Math.min(1, e.root * 4), sway = Math.sin(now * 3 + (e.x + e.y) * 0.05) * 0.08;
  ctx.globalAlpha = 0.4 * fade; ctx.fillStyle = COL.vineDark; ellipse(e.x, e.y + R * 0.75, R * 1.25, R * 0.4);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const b = i * Math.PI / 2 + 0.4, sx = e.x + Math.cos(b) * R * 1.05, sy = e.y + R * 0.7 + Math.sin(b) * R * 0.3;
    const ex = e.x + Math.cos(b + 1.6 + sway) * R * 0.75, ey = e.y + R * 0.7 - (R * 1.6) * grow;
    const cx = e.x + Math.cos(b + 0.8) * R * 1.5, cy = (sy + ey) / 2;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = COL.vineDark; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
    ctx.strokeStyle = COL.vine; ctx.lineWidth = 1.8; ctx.stroke();
    if (grow > 0.8) leafShape(ex, ey, 3.6, b + 1.6, COL.druidity);
  }
  ctx.globalAlpha = 1;
}
// Drained: a wavering tendril of dark energy from it to whoever cast it, motes of life flowing along it.
function drawDrain(e, now) {
  const p = ownerBody({ owner: e.drainBy }), a0 = Math.min(1, e.drain * 3), dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d, wob = Math.sin(now * 9 + e.x * 0.1) * Math.min(30, d * 0.15);
  const cx = (e.x + p.x) / 2 + nx * wob, cy = (e.y + p.y) / 2 + ny * wob, at = v => [(1 - v) ** 2 * e.x + 2 * (1 - v) * v * cx + v * v * p.x, (1 - v) ** 2 * e.y + 2 * (1 - v) * v * cy + v * v * p.y];
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.45 * a0; ctx.strokeStyle = COL.darkCore; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(cx, cy, p.x, p.y); ctx.stroke();
  fxAdd(COL.darkmagus);
  ctx.globalAlpha = 0.75 * a0; ctx.strokeStyle = COL.darkmagus; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = COL.darkmagus;
  for (let k = 0; k < 4; k++) { const [mx, my] = at((now * 1.8 + k / 4) % 1); ctx.globalAlpha = a0; circle(mx, my, 1.8); }
  fxNormal();
  fxGlow(e.x, e.y, (e.r || 10) * 1.8, COL.darkmagus, 0.5 * a0);
  ctx.globalAlpha = 1;
}
// Arcana's mark: a violet diamond floating over it, turning, and a faint diamond round it.
function drawMark(e, now) {
  const R = e.r || 10, a0 = Math.min(1, e.amark * 3), y = e.y - R - 16 + Math.sin(now * 4) * 1.5, w = (0.45 + 0.55 * Math.abs(Math.cos(now * 3))) * 7;
  fxGlow(e.x, y, 18, COL.arcana, 0.9 * a0);
  ctx.globalAlpha = a0; ctx.fillStyle = COL.arcana; diamondPath(e.x, y, w, 10); ctx.fill();
  ctx.fillStyle = COL.arcanaHi; diamondPath(e.x - w * 0.25, y - 2, w * 0.35, 5); ctx.fill();
  ctx.strokeStyle = COL.arcanaHi; ctx.lineWidth = 1; diamondPath(e.x, y, w, 10); ctx.stroke();
  ctx.globalAlpha = 0.7 * a0 * (0.7 + 0.3 * Math.sin(now * 6)); ctx.strokeStyle = COL.arcana; ctx.lineWidth = 2;
  diamondPath(e.x, e.y, R + 7, R + 7, now * 0.8); ctx.stroke();
  ctx.globalAlpha = 1;
}
// ARCANE PIERCE!'s stun: a crackling violet bolt between the two it hit.
function drawArcLink(f) {
  const k = f.life / f.max, dx = f.x2 - f.x1, dy = f.y2 - f.y1, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = 7;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const v = i / n, j = i && i < n ? (reducedMotion ? (i % 2 ? 4 : -4) : (Math.random() - 0.5) * 12) : 0;
    return [f.x1 + dx * v + nx * j, f.y1 + dy * v + ny * j];
  });
  fxAdd(COL.arcana); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, col, al] of [[5, COL.arcana, 0.45], [1.6, COL.arcanaHi, 1]]) {
    ctx.globalAlpha = al * k; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  fxNormal();
  for (const [x, y] of [[f.x1, f.y1], [f.x2, f.y2]]) fxGlow(x, y, 18, COL.arcana, k);
  ctx.globalAlpha = 1;
}
// A mark cashed in: violet diamond shards flying off it.
function drawCash(f) {
  const k = 1 - f.life / f.max;
  fxAdd(COL.arcana);
  ctx.fillStyle = COL.arcanaHi;
  for (let i = 0; i < 6; i++) {
    const b = (f.seed || 0) + i * Math.PI / 3, d = f.r * (0.4 + k * 1.1);
    ctx.globalAlpha = 1 - k; diamondPath(f.x + Math.cos(b) * d, f.y + Math.sin(b) * d, 2, 4.5, b + Math.PI / 2); ctx.fill();
  }
  ctx.globalAlpha = 0.8 * (1 - k); ctx.strokeStyle = COL.arcana; ctx.lineWidth = 2; diamondPath(f.x, f.y, f.r * (0.6 + k), f.r * (0.6 + k)); ctx.stroke();
  fxNormal(); ctx.globalAlpha = 1;
}
// Explomagus's blast (v0.60, user: "look more like explosions"): a white flash and a shock ring, embers flung out in arcs
// over their shadows, and a fireball of puffs lit from above, swelling and rising as they cool into smoke.
function drawXBoom(f) {
  const k = 1 - f.life / f.max, R = f.r, sd = f.seed || 0, c = COL.explomagus, hot = COL.exploHot;
  if (k < 0.25) { fxAdd(hot); ctx.globalAlpha = 1 - k / 0.25; ctx.fillStyle = COL.player; circle(f.x, f.y, R * (0.35 + k * 1.6)); fxNormal(); }
  ctx.globalAlpha = Math.max(0, 1 - k * 1.8); ctx.strokeStyle = hot; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, R * (0.5 + k * 1.4), 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = sd + i * 2.39, v = R * (0.9 + ((i * 7) % 5) * 0.2), gx = f.x + Math.cos(a) * v * k, gy = f.y + Math.sin(a) * v * k, z = Math.max(0, 60 * k - 70 * k * k) * R / 50;
    ctx.globalAlpha = 0.3 * (1 - k); ctx.fillStyle = '#000'; ctx.fillRect(gx - 1, gy - 0.5, 2, 1);
    ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 3 ? hot : c; ctx.fillRect(gx - 1.2, gy - z - 1.2, 2.4, 2.4);
  }
  const smoke = Math.min(1, Math.max(0, (k - 0.3) / 0.45)), fade = 1 - Math.max(0, (k - 0.65) / 0.35), grow = Math.min(1, k * 3.5);
  const puffs = Array.from({ length: 8 }, (_, i) => {
    const a = sd * 3 + i * 2.1, off = R * 0.38 * ((i * 0.37 + 0.2) % 1);
    return [f.x + Math.cos(a) * off, f.y + Math.sin(a) * off * 0.6 - k * R * 0.55 - (i % 3) * 3, R * (0.26 + 0.3 * grow) * (0.75 + 0.25 * (i % 2))];
  }).sort((a, b) => b[1] - a[1]);                             // (the lower ones behind the rising top)
  for (const [x, y, r] of puffs) firePuff(x, y, r, smoke, fade);
  ctx.globalAlpha = 1;
}
// BLAST WALK!: embers flickering round your feet while it lasts.
function drawXWalk(f, now) {
  const fade = Math.min(1, f.life * 3, fxAge(f) * 6), c = COL.explomagus;
  fxGlow(f.x, f.y, PLAYER.r * 2.4, c, 0.5 * fade);
  ctx.fillStyle = COL.exploHot;
  for (let k = 0; k < 6; k++) {
    const v = (now * 1.3 + k / 6) % 1, b = k * 1.05 + now;
    ctx.globalAlpha = fade * (1 - v); ctx.fillRect(f.x + Math.cos(b) * (PLAYER.r + 3) - 1, f.y + Math.sin(b) * 4 + PLAYER.r * 0.4 - v * 16, 2, 2);
  }
  ctx.globalAlpha = 1;
}
// VOID LASER!'s charge: dark motes sucked in from all round you, and a dark sphere swelling on you.
function drawCharge(f, now) {
  const q = Math.min(1, fxAge(f) / f.max), c = COL.darkmagus;
  ctx.lineCap = 'round';
  for (let k = 0; k < 16; k++) {
    const v = (q * 2.2 + k / 16) % 1, rad = 90 * (1 - v) + PLAYER.r, b = k * 2.39 + (f.seed || 0) + v * 1.5;
    const x = f.x + Math.cos(b) * rad, y = f.y + Math.sin(b) * rad;
    ctx.globalAlpha = 0.8 * v; ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * 10, y + Math.sin(b) * 10); ctx.stroke();
    ctx.fillStyle = COL.darkCore; circle(x, y, 2.2);
  }
  fxGlow(f.x, f.y, PLAYER.r * (2 + 2 * q), c, 0.5 + 0.5 * q);
  ctx.globalAlpha = 0.55 + 0.3 * q; ctx.fillStyle = COL.darkCore; circle(f.x, f.y, PLAYER.r + 3 + 7 * q);
  ctx.globalAlpha = 0.9; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, PLAYER.r + 3 + 7 * q, now * 6, now * 6 + Math.PI * 1.3); ctx.stroke();
  ctx.globalAlpha = 1;
}
// One of VOID LASER!'s lasers: a dark core with violet edges and a hot violet line down it, fading fast.
function drawDarkLaser(f) {
  const k = f.life / f.max, c = COL.darkmagus;
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.lineCap = 'round';
  const line = (w, col, al, add) => { if (add) fxAdd(col); ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(PLAYER.r, 0); ctx.lineTo(f.len, 0); ctx.stroke(); fxNormal(); };
  line(f.w * 1.7 * (0.7 + 0.3 * k), c, 0.35 * k, true);
  line(f.w * k, COL.darkCore, 0.92 * k, false);
  line(f.w * 0.3 * k + 1, c, k, true);
  line(1.5, COL.player, 0.8 * k, false);
  ctx.restore();
  fxGlow(f.x, f.y, f.w * 2, c, k);
  ctx.globalAlpha = 1;
}

/* ---------- Druidity in 3D (v0.65, user: "3D effects please!") ---------- */
// A lit vine along screen points `P` (base first), `w0` thick at its base thinning to `w1` at its tip: dark under, green,
// a line of light along its top; thorns down it. `pal`: [dark, mid, light] for another kind (OVERGROWTH!'s roots).
function vineTube(P, w0, w1, a = 1, thorns = true, pal = [COL.vineDark, COL.vine, COL.leafHi]) {
  const w = u => w0 + (w1 - w0) * u;
  ctx.globalAlpha = a; ctx.fillStyle = pal[0]; ribbon(P, w); ctx.fill();
  ctx.fillStyle = pal[1]; ribbon(P, u => w(u) * 0.62, 0.12); ctx.fill();
  ctx.globalAlpha = 0.85 * a; ctx.fillStyle = pal[2]; ribbon(P, u => w(u) * 0.2, 0.32); ctx.fill();
  if (!thorns) return;
  ctx.globalAlpha = a; ctx.fillStyle = pal[0];
  for (let s = 2; s < P.length - 1; s += 2) {
    const [x0, y0] = P[s - 1], [x1, y1] = P[s], b = Math.atan2(y1 - y0, x1 - x0) + (s % 4 ? 1 : -1) * Math.PI / 2, h = w(s / (P.length - 1)) * 0.5;
    ctx.beginPath(); ctx.moveTo(x1 + Math.cos(b + 1.3) * h, y1 + Math.sin(b + 1.3) * h); ctx.lineTo(x1 + Math.cos(b) * (h + 3.5), y1 + Math.sin(b) * (h + 3.5)); ctx.lineTo(x1 + Math.cos(b - 1.3) * h, y1 + Math.sin(b - 1.3) * h); ctx.fill();
  }
}
// The vine whip (melee.js swing, kind 'whip'): it cracks across the arc in front of you, the tip lagging behind the
// base like a real whip, lifted off the floor over its shadow. (v0.65, user: "the effects are only the hit effect": no
// blur behind the tip or crack of light, just the vine; what it hits gets the usual hit effect.)
function drawWhip(m) {
  const q = 1 - m.life / m.max, dir = m.side < 0 ? -1 : 1, sw = Math.min(1, q / 0.75), e = sw < 0.5 ? 2 * sw * sw : 1 - (-2 * sw + 2) ** 2 / 2;
  const th = m.a - dir * m.arc / 2 + dir * m.arc * e, r0 = PLAYER.r + 2, R = m.reach * (0.95 - 0.25 * Math.max(0, q - 0.75) / 0.25), lag = 0.9 * (1 - e * 0.6);
  const N = 14, floor = [], S = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, ang = th - dir * lag * s * s, rho = r0 + (R - r0) * s, z = 9 * Math.sin(Math.PI * s) * (1 - 0.6 * q) + 6 * (1 - s);
    const x = m.x + Math.cos(ang) * rho, y = m.y + Math.sin(ang) * rho;
    floor.push([x, y]); S.push([x, y - z]);
  }
  const fade = Math.min(1, m.life / (m.max * 0.3));
  ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = '#000'; ribbon(floor.map(([x, y]) => [x + 2, y + 2]), u => 7 - 4.5 * u); ctx.fill();   // its shadow
  vineTube(S, 8, 2.4, fade);
  const [tx, ty] = S[N];
  leafShape(tx, ty, 4.5, th + dir * 1.2, COL.druidity);
  ctx.globalAlpha = 1;
}
// SEED BOMB! (v0.66). Where it'll land: a circle on the floor the size of what it hits, its dashes turning, filling in
// from the middle as the bomb comes down, with ticks round it pointing in.
function drawSeedMark(f, now) {
  const k = Math.min(1, fxAge(f) / f.max), R = f.r, c = COL.blightHi;
  ctx.globalAlpha = 0.14 + 0.12 * k; ctx.fillStyle = COL.blight; circle(f.x, f.y, R);
  ctx.globalAlpha = 0.18 + 0.2 * k; ctx.fillStyle = c; circle(f.x, f.y, R * k);
  ctx.globalAlpha = 0.85; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -now * 40;
  ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineWidth = 2.4;
  for (let j = 0; j < 4; j++) {
    const b = j * Math.PI / 2 + now * 0.8, r0 = R + 8 - 4 * k, r1 = R - 6;
    ctx.beginPath(); ctx.moveTo(f.x + Math.cos(b) * r0, f.y + Math.sin(b) * r0); ctx.lineTo(f.x + Math.cos(b) * r1, f.y + Math.sin(b) * r1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// The bomb in the air: a lumpy seed pod lobbed from you to the circle (highest halfway), turning over, glowing cracks
// in its husk and a sprout poking out, over its shadow on the floor (which sharpens as it comes down).
function drawSeedBomb(f, now) {
  const S = MAGUS.druid.seed, u = Math.min(1, fxAge(f) / f.max), gx = f.x0 + (f.x - f.x0) * u, gy = f.y0 + (f.y - f.y0) * u;
  const z = S.arc * 4 * u * (1 - u), R = 12, spin = u * 7 + (f.seed % 7);
  ctx.globalAlpha = 0.35 * (1 - z / S.arc * 0.5); ctx.fillStyle = '#000'; ellipse(gx, gy + 4, R * (1 - 0.35 * z / S.arc), R * 0.42 * (1 - 0.35 * z / S.arc));
  for (let j = 1; j <= 5; j++) {                                     // a faint trail of spores behind it
    const v = Math.max(0, u - j * 0.035), tx = f.x0 + (f.x - f.x0) * v, ty = f.y0 + (f.y - f.y0) * v - S.arc * 4 * v * (1 - v);
    ctx.globalAlpha = 0.45 * (1 - j / 6); ctx.fillStyle = COL.blightHi; circle(tx, ty, 2.2 - j * 0.3);
  }
  const x = gx, y = gy - z;
  fxGlow(x, y, R * 3, COL.blightHi, 0.45);
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  ctx.globalAlpha = 1; ctx.fillStyle = COL.seed; ctx.beginPath();
  for (let j = 0; j < 9; j++) { const b = j / 9 * TAU, r = R * (j % 2 ? 0.92 : 1.05); ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r * 0.9); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.blightHi; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now * 14);   // the cracks, glowing
  ctx.beginPath(); ctx.moveTo(-R * 0.6, -R * 0.1); ctx.lineTo(-R * 0.15, R * 0.15); ctx.lineTo(R * 0.2, -R * 0.2); ctx.lineTo(R * 0.6, R * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-R * 0.1, R * 0.15); ctx.lineTo(0, R * 0.65); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = COL.oakDark; ctx.fillRect(-0.8, -R * 1.45, 1.6, R * 0.6);   // the sprout
  leafShape(0, -R * 1.4, 4, -0.6, COL.leafHi);
  ctx.restore();
  sphereShade(x, y, R * 0.98);
}
// It bursts: a ring racing out over the floor, a dome of dark earth and spores heaving up and settling, a green flash.
function drawSeedBoom(f) {
  const q = 1 - f.life / f.max, e = 1 - (1 - q) ** 3, fade = 1 - q, R = f.r, rnd = mulberry32(f.seed | 0);
  fxGlow(f.x, f.y, R * 1.4, COL.blightHi, 0.7 * fade);
  fxAdd(COL.blightHi);
  ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = COL.blightHi; ctx.lineWidth = 1 + 6 * fade;
  ctx.beginPath(); ctx.arc(f.x, f.y, R * (0.2 + 0.85 * e), 0, TAU); ctx.stroke();
  fxNormal();
  for (let j = 0; j < 9; j++) {                                      // the dome of earth: lumps thrown up and settling
    const b = rnd() * TAU, d = R * 0.45 * e * rnd(), h = (14 + 18 * rnd()) * Math.sin(Math.PI * Math.min(1, q * 1.4)), r = (8 + 8 * rnd()) * (1 - 0.5 * q);
    const x = f.x + Math.cos(b) * d, y = f.y + Math.sin(b) * d * 0.6 - h;
    ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = j % 3 ? COL.oakDark : COL.blight; circle(x, y, r);
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = COL.oak; circle(x - r * 0.3, y - r * 0.35, r * 0.45);
  }
  ctx.globalAlpha = fade; ctx.fillStyle = '#ffffff'; circle(f.x, f.y - 6, 10 * (1 - e) + 1);
  ctx.globalAlpha = 1;
}
// The corrupted ground: it spreads out from the middle to a blotchy edge, dark, with veins of sickly light pulsing out
// along cracks, pustules bubbling, and seedlings popping up one after another and swaying (each with its own shadow:
// a stalk, two leaves, a glowing bud). It withers back at the end.
function drawBlight(f, now) {
  const S = MAGUS.druid.seed, u = fxAge(f), grow = 1 - (1 - Math.min(1, u / 0.3)) ** 3, fade = Math.min(1, f.life / 0.6), R = f.r * grow, rnd = mulberry32(f.seed | 0);
  ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = COL.blight; ctx.beginPath();
  const lumps = [];
  for (let j = 0; j < 18; j++) lumps.push(0.88 + 0.18 * rnd());
  for (let j = 0; j <= 18; j++) { const b = j / 18 * TAU, r = R * lumps[j % 18]; ctx.lineTo(f.x + Math.cos(b) * r, f.y + Math.sin(b) * r); }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = '#000'; circle(f.x, f.y, R * 0.45);
  const pulse = 0.55 + 0.45 * Math.sin(now * 5);
  fxGlow(f.x, f.y, R * 1.15, COL.blightHi, 0.18 * fade);           // (v0.66: easier to see on the dark floor) a sickly glow over it …
  ctx.globalAlpha = (0.45 + 0.3 * pulse) * fade; ctx.strokeStyle = COL.blightHi; ctx.lineWidth = 2; ctx.beginPath();   // … and its edge lit
  for (let j = 0; j <= 18; j++) { const b = j / 18 * TAU, r = R * lumps[j % 18]; ctx.lineTo(f.x + Math.cos(b) * r, f.y + Math.sin(b) * r); }
  ctx.closePath(); ctx.stroke();
  fxAdd(COL.blightHi); ctx.strokeStyle = COL.blightHi; ctx.lineCap = 'round';
  for (let j = 0; j < 7; j++) {                                      // the veins
    let b = rnd() * TAU, x = f.x, y = f.y;
    ctx.globalAlpha = (0.35 + 0.45 * pulse) * fade; ctx.lineWidth = 2.2 - j * 0.15;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s2 = 0; s2 < 4; s2++) { b += (rnd() - 0.5) * 0.9; const l = R * 0.2; x += Math.cos(b) * l; y += Math.sin(b) * l; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  fxNormal();
  for (let j = 0; j < 5; j++) {                                      // pustules, swelling and popping
    const b = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.85, ph = (now * 0.9 + rnd()) % 1, r = 2 + 4 * ph;
    ctx.globalAlpha = 0.7 * fade * (1 - ph); ctx.fillStyle = COL.blightHi; circle(f.x + Math.cos(b) * d, f.y + Math.sin(b) * d, r);
  }
  const spots = [];                                                  // the seedlings, back to front
  for (let j = 0; j < S.sprouts; j++) { const b = rnd() * TAU, d = Math.sqrt(0.08 + 0.92 * rnd()) * f.r * 0.88; spots.push({ x: f.x + Math.cos(b) * d, y: f.y + Math.sin(b) * d, at: 0.05 + j * 0.04 + rnd() * 0.08, h: 13 + 10 * rnd(), ph: rnd() * TAU }); }
  spots.sort((a, b) => a.y - b.y);
  for (const sp of spots) {
    const g = Math.max(0, Math.min(1, (u - sp.at) / 0.22)), pop = g < 1 ? 1 + 0.35 * Math.sin(g * Math.PI) : 1, h = sp.h * g * pop * (0.4 + 0.6 * fade);
    if (h < 0.5) continue;
    const sway = reducedMotion ? 0 : Math.sin(now * 3 + sp.ph) * 2.2, tx = sp.x + sway, ty = sp.y - h;
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#000'; ellipse(sp.x + 2, sp.y + 1, 3.2, 1.3);
    ctx.globalAlpha = fade; ctx.strokeStyle = '#5a2f5e'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.quadraticCurveTo(sp.x, sp.y - h * 0.6, tx, ty); ctx.stroke();
    leafShape(tx - 1, ty + h * 0.3, 5 * g, Math.PI + 0.6, COL.leaf);
    leafShape(tx + 1, ty + h * 0.18, 5 * g, -0.6, COL.blightHi);
    ctx.globalAlpha = fade; ctx.fillStyle = COL.blightHi; circle(tx, ty, 2.2 * g);
    fxGlow(tx, ty, 6, COL.blightHi, 0.5 * fade * pulse);
  }
  ctx.globalAlpha = 1;
}
// OVERGROWTH!: the torn ground where the vines come up (cracks out from it, a dark hole, a lit rim) …
function drawGrabGround(f) {
  const G = MAGUS.druid.grow, u = fxAge(f), k = Math.min(1, u / G.rise), fade = Math.min(1, f.life / 0.3), rnd = mulberry32(f.seed | 0), R = G.r * (0.5 + 0.5 * k);
  ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = COL.oakDark; ellipse(f.x, f.y, R, R * 0.45);
  ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = '#000'; ellipse(f.x, f.y + 1, R * 0.55, R * 0.25);
  ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = COL.oak; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * 0.45, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();   // the lit far rim
  ctx.strokeStyle = COL.oakDark; ctx.lineWidth = 1.4;
  for (let j = 0; j < 5; j++) {
    const b = rnd() * TAU, l = R * (1.2 + 0.8 * rnd()) * k;
    ctx.beginPath(); ctx.moveTo(f.x + Math.cos(b) * R * 0.8, f.y + Math.sin(b) * R * 0.36);
    ctx.lineTo(f.x + Math.cos(b + 0.2) * (R * 0.8 + l * 0.5), f.y + Math.sin(b + 0.2) * (R * 0.36 + l * 0.22)); ctx.lineTo(f.x + Math.cos(b - 0.1) * (R * 0.8 + l), f.y + Math.sin(b - 0.1) * (R * 0.36 + l * 0.45)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// … and the vines (v0.65, user: "different vine variations"): each burst is one of five kinds (by its seed): thorny
// (four thick thorned tendrils arching over), curling (five thinner ones spiralling up into hooked tips, with leaves),
// roots (three thick gnarled brown roots, knobbly), blooming (four vines and a flower opening over the middle) and
// lashing (six thin whips waving). All are lit tubes rising out of the hole, wrapping in over what they hold, pulling
// down as they drag it under, then sinking back into the ground.
const GRAB_KINDS = [
  { n: 4, w: 5, h: 32, twist: 0.7, thorns: true },                                        // thorny
  { n: 5, w: 3.6, h: 36, twist: 2.4, hook: true, leaves: true },                          // curling
  { n: 3, w: 7.5, h: 26, twist: 0.35, knobs: true, root: true },                          // roots
  { n: 4, w: 4.2, h: 34, twist: 1.1, leaves: true, bloom: true },                         // blooming
  { n: 6, w: 2.6, h: 40, twist: 1.4, wave: true },                                        // lashing
];
function drawGrab(f, now) {
  const G = MAGUS.druid.grow, u = fxAge(f), hold = G.hold * durMul(f.card), rise = Math.min(1, u / G.rise), rnd = mulberry32(f.seed | 0);
  const drag = Math.max(0, Math.min(1, (u - G.rise) / hold)), out = Math.max(0, (u - G.rise - hold) / 0.35), up = rise * (1 - out);
  if (up <= 0.02) return;
  const K = GRAB_KINDS[(f.seed >>> 3) % GRAB_KINDS.length], pal = K.root ? [COL.oakDark, COL.oak, '#d9a86a'] : undefined;
  for (let j = 0; j < K.n; j++) {
    const b = j * TAU / K.n + rnd() * 0.8, spin = (j % 2 ? -1 : 1) * K.twist, R0 = G.r * (0.8 + 0.2 * rnd());
    const h = K.h * (0.8 + 0.4 * rnd()) * up * (1 - 0.55 * drag), P = [];
    for (let i = 0; i <= 12; i++) {                                                  // up out of the hole and in over its middle, turning as it goes
      const s = i / 12, wave = K.wave && !reducedMotion ? Math.sin(now * 9 + j * 1.9 + s * 5) * 4 * s : 0, knob = K.knobs ? Math.sin(s * 17 + j) * 1.6 : 0;
      const ang = b + spin * s, rad = R0 * (1 - 0.82 * s) + knob, z = h * Math.sin(s * Math.PI * 0.62) + (K.hook ? -h * 0.25 * Math.max(0, s - 0.75) * 4 : 0);
      P.push([f.x + Math.cos(ang) * rad + wave, f.y + Math.sin(ang) * rad * 0.45 - z]);
    }
    if (K.hook) {                                                                    // its tip curls round into a hook
      const [ex, ey] = P[P.length - 1], [px, py] = P[P.length - 2], a0 = Math.atan2(ey - py, ex - px);
      for (let i = 1; i <= 4; i++) { const c = a0 + spin * i * 0.7; P.push([P[P.length - 1][0] + Math.cos(c) * 2.4, P[P.length - 1][1] + Math.sin(c) * 2.4]); }
    }
    const [bx, by] = [f.x + Math.cos(b) * R0, f.y + Math.sin(b) * R0 * 0.45];
    ctx.globalAlpha = 0.25 * up; ctx.fillStyle = '#000'; ellipse(bx + 3, by + 2, K.w, K.w * 0.4);
    vineTube(P, K.w, K.w * 0.28, Math.min(1, up * 1.5), !!K.thorns, pal);
    const [tx, ty] = P[P.length - 1];
    if (K.leaves && up > 0.5) { const [mx, my] = P[6]; leafShape(mx, my, 3.4, b + 0.9, COL.druidity); leafShape(tx, ty, 3, b + 2, COL.leaf); }
    else if (!K.root && !K.wave && up > 0.6) leafShape(tx, ty, 3.5, b + 1.2, COL.druidity);
  }
  if (K.bloom && up > 0.4) {                                                         // the flower opening over it
    const k = Math.min(1, (up - 0.4) / 0.4) * (1 - 0.4 * drag), y = f.y - K.h * 0.62 * up;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + f.seed % 6, px = f.x + Math.cos(a) * 4.5 * k, py = y + Math.sin(a) * 2.2 * k;
      ctx.globalAlpha = 0.95; ctx.fillStyle = i % 2 ? COL.bloom : COL.bloomHi; ctx.beginPath(); ctx.ellipse(px, py, 4 * k, 2.4 * k, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = COL.dragonFire; circle(f.x, y, 1.8 * k);
  }
  if (rise >= 1 && u - G.rise < 0.12) fxGlow(f.x, f.y - 10, 26, K.root ? COL.oak : COL.druidity, 1 - (u - G.rise) / 0.12);   // the grab
  ctx.globalAlpha = 1;
}
