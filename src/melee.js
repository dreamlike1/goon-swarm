/* melee.js — Melee (v0.53, THE COMBAT UPDATE!, user): the second deck, its attacks, combos and how they look. */
'use strict';

/* ============================================================
   Your melee deck plays at the same time as your ranged one, with the same sequences, shuffles and combos.
   It never waits (user: it "auto rotates"): when its turn comes and nothing is within reach, the card is used up and
   nothing shows. But it doesn't make you wait either (user: enemies got to you before the attack came): after a card
   that hit nothing, the next one goes off the moment an enemy is in reach (combat.js attackStep, `game.mprimed`).
     Knife Stab  · stabs the nearest enemy in reach
                 ×3 STAB FLURRY!  fast stabs, each in a random direction inside a cone
                 ×7 KNIFE THROW!  throws the knife, through everything in its path
     Punch       · a heavy punch at the nearest enemy in reach
                 ×3 FLURRY!       a flurry of punches
                 ×7 BLACK FLASH!  one huge punch. v0.55 (user's references: the manga's red-and-black impact): an
                                  impact frame (white, black, white, the world frozen and zoomed in, focus lines),
                                  where it lands a burst of red-edged black lightning, different every hit and
                                  flickering, then `time` s of faint red and black streaks of light rising off you:
                                  super fast, more damage and attack speed (upgrades.js reads `game.bflash`), faster
                                  regen (combat.js), and a flurry of punches, each its own burst of lightning.
                                  Yours even if the punch hits nothing.
   Every number is a placeholder.
   ============================================================ */
const MELEE = {
  stab: { arc: 0.55, life: 0.16 },                         // a stab's width (rad) and how long it shows (s)
  punch: { arc: 0.95, life: 0.18 },
  // the weapon rework (v0.58, user): Vessel and Rambo strike twice a turn (`hits`), the second `double` s after the first;
  // Slap is wide; Rambo's slices sweep an arc
  double: 0.11,
  slap: { arc: 1.3, life: 0.2 },
  slice: { arc: 1.5, life: 0.15 },
  whip: { life: 0.3 },                                     // Druidity's vine (v0.65; its width is the card's `arc`)
  // Vessel ×3: the aura fist; what it hit glows in a blue aura for `delay` s, then explodes in a small circle round it
  // (v0.65, user: "after 1 sec … a small AOE"; 0.14 s and radius 80 before)
  vesselBurst: { radius: 52, dmg: 14, delay: 1, knock: 200, size: 1.35 },
  megaSlap: { reach: 1.5, arc: 2.4, dmg: 2, knock: 1500, size: 1.9 },         // Slap ×3
  ramboSlices: { count: 4, gap: 0.09, dmg: 6, reach: 1.1 },                    // Rambo ×3: slices from random directions
  // the Standard pack's new ones (v0.59, user). Hammer: it comes down `drop` s after the swing starts; ×3 FAULT LINE!
  // cracks the ground `len` px toward the enemy (everything within `w` of the crack is hit as it passes, in `steps`);
  // ×7 TRIPLE QUAKE! is 3 slams round you, `gap` s apart, each bigger. Iron Fistopheles: a red astral fist; ×3 is its
  // giant hit, straight punch and clap (`gap` s apart); ×7 a barrage of huge long-range punches.
  hammer: { life: 0.26, drop: 0.12 },
  faultLine: { len: 300, w: 26, dmg: 16, knock: 260, steps: 8, gap: 0.03 },
  quake: { gap: 0.42, radii: [90, 140, 200], dmg: [14, 16, 20], knock: 260 },
  astral: { arc: 0.8, life: 0.17 },
  devil: { gap: 0.3, giant: { size: 2.7, arc: 1.5, dmg: 18, knock: 420, reach: 1.25 }, straight: { size: 1.7, arc: 0.45, dmg: 14, knock: 320, reach: 2.1 },
           clap: { radius: 62, dmg: 16, stun: 0.5, life: 0.36, at: 0.14 } },
  barrage: { count: 16, gap: 0.06, reach: 2.6, size: 2.2, arc: 0.95, dmg: 8, knock: 160, clapEvery: 4,   // every 4th blow is a clap (v0.59, user)
             clap: { radius: 52, dmg: 12, stun: 0.25, life: 0.28, at: 0.1, size: 0.8 } },
  stabFlurry: { count: 6, gap: 0.05, cone: 1.1, dmg: 6, reach: 1.2 },   // Knife ×3: `reach` × the knife's
  throw: { dmg: 40, range: 400, r: 8 },                    // Knife ×7: goes through everything until `range`
  flurry: { count: 8, gap: 0.06, dmg: 5, knock: 90 },      // Punch ×3
  blackFlash: { time: 2, speed: 2, atk: 0.55, dmg: 1.75, regen: 15, hit: 30, reach: 1.25, life: 0.26, size: 1.5, impact: 0.6,   // Punch ×7
    // v0.55 (user): the impact frame (draw.js drawImpactFrame: `a` s white with black ink, `b` s negative, `c` s white
    // again, then `fade`; zoomed in by `zoom` and frozen by `stop`, with `lines` focus lines), the lightning where a
    // punch lands (`bolt`, `small` for the flurry's; it flickers to a new shape every `flick` s), and the flurry of
    // punches after (`flurry`, starting `after` s on)
    frame: { a: 0.07, b: 0.06, c: 0.05, fade: 0.16, zoom: 0.16, stop: 0.16, lines: 60 },
    bolt: { reach: 320, n: 9, w: 10, flick: 0.045, small: { reach: 110, n: 4, w: 4 } },
    flurry: { count: 14, gap: 0.07, after: 0.18, dmg: 5, knock: 90 },
    ghost: 0.035 },
};
const angleTo = (e, p = game.player) => { const q = hitPoint(e, p.x, p.y); return Math.atan2(q.y - p.y, q.x - p.x); };

// One melee card's turn (combat.js shoot, for a melee card): at `e` if it's within reach, otherwise nothing at all.
// True if it struck.
function meleeStrike(card, e, o = {}) {
  const p = game.player, reach = rangeOf(card), look = CARDS[card].look;
  if (CARDS[card].self) { sinGuard(card); return true; }       // Iron Will (sins.js): on you, whatever is close
  if (CARDS[card].tball) return tballPlay(card, e, o);         // a Melee T-Ball (tballs.js)
  if (!e || hitGap(e, p.x, p.y) > reach) return false;
  if (look === 'slam') { sinSlam(card); return true; }          // the SINS pack's melee (sins.js)
  if (look === 'kick') { sinKick(card, e); return true; }
  if (look === 'hammer') { hammerStrike(card, e); return true; }   // Hammer (v0.59): a circle where it lands
  if (look === 'whip') { swing(card, o.angle ?? angleTo(e), reach, { ...o, arc: CARDS[card].arc, side: Math.random() < 0.5 ? -1 : 1 }); return true; }   // Druidity (v0.65)
  swing(card, o.angle ?? angleTo(e), reach, o);
  for (let k = 1; k < (upSpec(card).hits || 1); k++) later(k * (CARDS[card].gap || MELEE.double), () => {   // (+1 hit at some tiers, v0.62)   // Vessel's second punch, Rambo's second slice, Iron Fistopheles' flurry
    const en = nearestEnemy(game.player, null, reach);
    if (en) swing(card, angleTo(en), reach, { ...o, side: k % 2 ? 6 : -6 });
  });
  return true;
}
// How far the melee deck's next play reaches: a single card's reach, or its combo's (KNIFE THROW! flies far).
function meleeReach(seq, pos) {
  const cb = comboAt(seq, pos), card = seq[pos];
  if (cb && card === 'hammer' && cb.n === 3) return MELEE.faultLine.len * 0.8;       // FAULT LINE! cracks a long way
  if (cb && card === 'hammer' && cb.n === 7) return MELEE.quake.radii[0];
  if (cb && card === 'fistopheles') return rangeOf(card) * (cb.n === 7 ? MELEE.barrage.reach : MELEE.devil.straight.reach);
  if (cb && card === 'druidity') return cb.n === 3 ? MAGUS.druid.seed.reach : MAGUS.druid.grow.radius * 0.8;   // SEED BOMB!, OVERGROWTH! (magus.js)
  return rangeOf(card) * (cb?.n === 7 && card === 'punch' ? MELEE.blackFlash.reach : 1);
}
// A stab or a punch along angle `a`: everything within `reach` and inside its width is hit. `side`: a punch's fist
// off to one side (the flurry's left-right).
// Returns the enemies it hit. o.arc: a wider swing; o.size: a bigger fist or hand; o.aura: VESSEL BURST!'s fist.
function swing(card, a, reach, o = {}) {
  const spec = CARDS[card], M = { knife: MELEE.stab, slap: MELEE.slap, slice: MELEE.slice, astral: MELEE.astral, whip: MELEE.whip }[spec.look] || MELEE.punch, p = game.player;
  const dmg = damageOf(o.dmg ?? spec.dmg), knock = knockOf(o.knock ?? spec.knock), arc = o.arc ?? M.arc, hit = [];
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > reach) continue;
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a));
    if (Math.abs(diff) > arc / 2 + Math.atan2(q.r || e.r, d)) continue;
    hitEnemy({ card, look: 'melee', dmg, knock, vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
    hit.push(e);
  }
  // (a BIG slot, v0.68: its reach already grew with rangeOf; the fist or blade grows here, and only once: `bigged`)
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: spec.look, card, a, reach, arc, side: o.side || 0, size: (o.size || 1) * bigK(), bigged: true, aura: !!o.aura, life: M.life, max: M.life }));
  if (!o.quiet) SFX.melee(spec.look);
  return hit;
}
// VESSEL BURST! (Vessel ×3, v0.58, user): where the aura fist hit, the enemy explodes, light blue and black, hurting
// everything round it. v0.65 (user): it glows in a blue aura first (`vaura`, following it; updateMelees sets it off
// after `delay` s, where it is then, even if it died), and the blast is a small one: a blue dome bursting (`vboom`).
function vesselMark(card, e, V) {
  game.melees.push({ kind: 'vaura', card, target: e, x: e.x, y: e.y, r: e.r || 10, owner: ownerId(), aug: AUG_FX, fixed: true, life: V.delay, max: V.delay, seed: (Math.random() * 1e9) | 0 });
}
function vesselBlast(card, x, y, V) {
  blast(x, y, card, V.radius, damageOf(V.dmg), { knock: V.knock });
  game.melees.push({ kind: 'vboom', card, x, y, r: V.radius, fixed: true, life: 0.42, max: 0.42 });
  SFX.melee('vboom');
  for (let k = 0; k < 16; k++) {
    const sa = Math.random() * TAU, v = 160 + Math.random() * 280;
    game.particles.push({ x, y, vx: Math.cos(sa) * v, vy: Math.sin(sa) * v, life: 0.25 + Math.random() * 0.3, color: k % 2 ? COL.vessel : COL.flash, spark: true });
  }
  game.shake = Math.max(game.shake, 0.18);
}

// A melee combo (combos.js runCombo hands these over). Like a single card, it only shows if it has something to hit,
// except BLACK FLASH!, which is yours either way. True if it did something.
function meleeCombo(cb, echo) {
  if (CARDS[cb.card].tball) return tballCombo(cb, echo);        // the T-Balls' (tballs.js)
  const { card, n } = cb, p = game.player, reach = rangeOf(card);
  const near = nearestEnemy(p, null, reach);
  const callout = () => {
    if (echo) return;
    if (card === 'punch' && n === 7)                        // BLACK FLASH!!, in the manga's lettering (draw.js drawMangaText)
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 30, text: 'BLACK FLASH!!', color: COL.flashHi, life: 1.2, max: 1.2, vy: -18, manga: true });
    else game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: cb.name, color: COL[card], life: 0.9, vy: -40, big: true });
    SFX.combo(n, card);
  };
  switch (`${card}${n}`) {
    case 'knife3': {                                      // STAB FLURRY!
      if (!near) return false;
      const S = MELEE.stabFlurry, a0 = angleTo(near);
      callout();
      for (let k = 0; k < S.count; k++) later(k * S.gap, () => swing(card, a0 + (Math.random() - 0.5) * S.cone, reach * S.reach, { dmg: S.dmg, quiet: k % 2 > 0 }));
      return true;
    }
    case 'punch3': {                                      // VESSEL BURST!: the aura fist, then whatever it hit explodes
      if (!near) return false;
      const V = MELEE.vesselBurst;
      callout();
      const hit = swing(card, angleTo(near), reach, { aura: true, size: V.size, dmg: CARDS[card].dmg * 2 });
      for (const en of hit) vesselMark(card, en, V);
      return true;
    }
    case 'slap3': {                                       // MEGA SLAP!: one huge slap, sending them flying
      if (!near) return false;
      const S = MELEE.megaSlap;
      callout();
      swing(card, angleTo(near), reach * S.reach, { arc: S.arc, dmg: S.dmg, knock: S.knock, size: S.size });
      game.shake = Math.max(game.shake, 0.2);
      return true;
    }
    case 'rambo3': {                                      // RAMBO!: 4 slices, each from a random direction
      if (!near) return false;
      const R = MELEE.ramboSlices;
      callout();
      for (let k = 0; k < R.count; k++) later(k * R.gap, () => swing(card, Math.random() * TAU, reach * R.reach, { dmg: R.dmg, side: k % 2 ? 1 : -1, quiet: k % 2 > 0 }));
      return true;
    }
    case 'punch7': blackFlash(card, echo, callout); return true;   // BLACK FLASH!
    case 'druidity3': {                                   // SEED BOMB! (v0.66, magus.js): lobbed at a random enemy in reach
      const S = MAGUS.druid.seed, all = game.enemies.filter(en => !en.dead && !en.apple && !en.mrock && hitGap(en, p.x, p.y) < S.reach);   // (Test's dummies count too)
      if (!all.length) return false;
      // (v0.66, user: "seed bomb doesn't seem to work": a random enemy was often a stray one, so it hit next to nothing)
      // the crowd: each enemy scored by how many are within the blight's reach of it, one of the best 3 at random
      const crowd = e => all.filter(o => hitGap(o, e.x, e.y) < S.r).length;
      const best = all.map(e => ({ e, n: crowd(e) + Math.random() * 0.5 })).sort((a, b) => b.n - a.n).slice(0, 3);
      callout(); seedBomb(card, best[Math.floor(Math.random() * best.length)].e);
      return true;
    }
    case 'druidity7':                                     // OVERGROWTH!: vines bursting up all round you
      if (!nearestEnemy(p, null, MAGUS.druid.grow.radius * 0.8)) return false;
      callout(); overgrowth(card);
      return true;
    case 'hammer3': {                                     // FAULT LINE!: the ground cracks open in a line toward the enemy
      const F = MELEE.faultLine, e = nearestEnemy(p, null, F.len * 0.8);
      if (!e) return false;
      callout(); faultLine(card, angleTo(e), F);
      return true;
    }
    case 'hammer7': {                                     // TRIPLE QUAKE!: 3 slams round you, each bigger
      if (!nearestEnemy(p, null, MELEE.quake.radii[2])) return false;
      callout();
      MELEE.quake.radii.forEach((R, k) => later(k * MELEE.quake.gap, () => hammerQuake(card, R, MELEE.quake.dmg[k], k)));
      return true;
    }
    case 'fistopheles3': {                                // DEVIL'S COMBO!: a giant hit, a straight punch, a clap
      const D = MELEE.devil;
      if (!nearestEnemy(p, null, reach * D.straight.reach)) return false;
      callout();
      const hitWith = (H, extra = {}) => { const en = nearestEnemy(game.player, null, reach * H.reach) || near; if (en && game.enemies.includes(en)) swing(card, angleTo(en), reach * H.reach, { arc: H.arc, dmg: H.dmg, knock: H.knock, size: H.size, ...extra }); };
      hitWith(D.giant); game.shake = Math.max(game.shake, 0.22);
      later(D.gap, () => hitWith(D.straight, { side: 0 }));
      later(D.gap * 2, () => { const en = nearestEnemy(game.player, null, reach * D.straight.reach); if (en) devilClap(card, en, D.clap); });
      return true;
    }
    case 'fistopheles7': {                                // HELL BARRAGE!: huge, long-range punches
      const B = MELEE.barrage;
      if (!nearestEnemy(p, null, reach * B.reach)) return false;
      callout();
      for (let k = 0; k < B.count; k++) later(k * B.gap, () => {
        const q = game.player, en = nearestEnemy(q, null, reach * B.reach);
        if (en && k % B.clapEvery === B.clapEvery - 1) { devilClap(card, en, B.clap); return; }   // the punches and the clapping hands together
        const a = en ? angleTo(en) : (q.face ?? 0);
        swing(card, a + (Math.random() - 0.5) * 0.4, reach * B.reach, { arc: B.arc, dmg: B.dmg, knock: B.knock, size: B.size * (0.85 + Math.random() * 0.3), side: (k % 2 ? 1 : -1) * (6 + Math.random() * 10), quiet: k % 2 > 0 });
      });
      game.shake = Math.max(game.shake, 0.2);
      return true;
    }
  }
  return false;
}

// Hammer (v0.59, user: "strike a hammer down with a circle hit"): it swings down at the enemy and lands just short of it
// (or at the end of its reach); everything in a circle there is hit and thrown out, with a crack in the ground and dust.
function hammerStrike(card, e) {
  const p = game.player, spec = CARDS[card], H = MELEE.hammer, a = angleTo(e);
  const d = Math.min(rangeOf(card), Math.max(PLAYER.r + 10, Math.hypot(e.x - p.x, e.y - p.y) - (e.r || 8) * 0.3));
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: 'hammer', card, a, reach: d, side: 0, size: 1, life: H.life, max: H.life }));
  SFX.melee('swing');
  later(H.drop, () => {
    const q = game.player, x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d;
    hammerLand(card, x, y, spec.radius, damageOf(spec.dmg), knockOf(spec.knock), 0.6);
  });
}
// Where a hammer lands: the circle hit (to its edge, like the rest), a ring, dust and rock thrown up, a short crack.
function hammerLand(card, x, y, R, dmg, knock, big = 1) {
  R *= bigK();                          // a BIG slot (v0.68)
  for (const e of game.enemies.slice()) {
    if (hitGap(e, x, y) > R) continue;
    const q = hitPoint(e, x, y), dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
    hitEnemy({ card, look: 'melee', dmg, knock, vx: dx / d, vy: dy / d, x: q.x, y: q.y }, e);
  }
  game.sinfx.push({ kind: 'quake', x, y, r: R, cracks: fissures(R * 0.9), life: 0.55 + 0.3 * big, max: 0.55 + 0.3 * big, fixed: true });
  for (let k = 0; k < Math.round(8 + 10 * big); k++) {
    const b = Math.random() * TAU, v = 60 + Math.random() * 140 * (0.6 + big);
    game.sinfx.push({ kind: 'rock', x: x + Math.cos(b) * 6, y: y + Math.sin(b) * 6, vx: Math.cos(b) * v, vy: Math.sin(b) * v, z: 0, vz: 120 + Math.random() * 120,
      size: 2 + Math.random() * 3.5, spin: Math.random() * TAU, life: 0.8, max: 0.8, fixed: true, col: COL.rock, edge: COL.hammerHi });
  }
  game.rings.push({ x, y, r: 6, max: R + 8, life: 0.32, color: COL.hammer });
  game.shake = Math.max(game.shake, 0.12 + 0.14 * big);
  SFX.melee('hammer');
}
// FAULT LINE! (Hammer ×3): the hammer comes down at your feet and the ground splits open in a jagged line along `a`, a
// few short cracks forking off it. Everything within `w` of the line is hit as the crack reaches it.
function faultLine(card, a, F) {
  const p = game.player, x0 = p.x, y0 = p.y, pts = [], forks = [];
  for (let d = 0; d <= F.len; d += 12) {
    const j = d < 10 ? 0 : (Math.random() - 0.5) * 12;
    pts.push([Math.cos(a) * d - Math.sin(a) * j, Math.sin(a) * d + Math.cos(a) * j]);
    if (d > 30 && Math.random() < 0.22) {                 // a fork off it
      const b = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), f = [pts[pts.length - 1]];
      for (let k = 1, L = 14 + Math.random() * 30; k * 9 <= L; k++) f.push([f[0][0] + Math.cos(b) * k * 9 + (Math.random() - 0.5) * 4, f[0][1] + Math.sin(b) * k * 9 + (Math.random() - 0.5) * 4]);
      forks.push(f);
    }
  }
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: 'hammer', card, a, reach: PLAYER.r + 12, side: 0, size: 1.2, life: MELEE.hammer.life, max: MELEE.hammer.life }));
  game.sinfx.push({ kind: 'fault', x: x0, y: y0, a, pts, forks, len: F.len, grow: F.steps * F.gap + 0.05, life: 1.5, max: 1.5, fixed: true });
  const hit = new Set();
  for (let k = 1; k <= F.steps; k++) later(MELEE.hammer.drop + k * F.gap, () => {
    const reachNow = F.len * k / F.steps;
    for (const e of game.enemies.slice()) {
      if (hit.has(e)) continue;
      const ex = e.x - x0, ey = e.y - y0, along = ex * Math.cos(a) + ey * Math.sin(a), off = Math.abs(-ex * Math.sin(a) + ey * Math.cos(a));
      if (along < -e.r || along > reachNow + e.r || off > F.w + e.r) continue;
      hit.add(e);
      const side = Math.sign(-ex * Math.sin(a) + ey * Math.cos(a)) || 1;
      hitEnemy({ card, look: 'melee', dmg: damageOf(F.dmg), knock: knockOf(F.knock), vx: -Math.sin(a) * side + Math.cos(a) * 0.4, vy: Math.cos(a) * side + Math.sin(a) * 0.4, x: e.x, y: e.y }, e);
    }
    const t = pts[Math.min(pts.length - 1, Math.round((pts.length - 1) * k / F.steps))];
    for (let n = 0; n < 3; n++) {
      const b = Math.random() * TAU, v = 50 + Math.random() * 90;
      game.sinfx.push({ kind: 'rock', x: x0 + t[0], y: y0 + t[1], vx: Math.cos(b) * v, vy: Math.sin(b) * v, z: 0, vz: 110 + Math.random() * 110,
        size: 2 + Math.random() * 3, spin: Math.random() * TAU, life: 0.7, max: 0.7, fixed: true, col: COL.rock, edge: COL.hammerHi });
    }
  });
  later(MELEE.hammer.drop, () => { game.shake = Math.max(game.shake, 0.28); SFX.melee('hammer'); SFX.sin('slam'); });
}
// TRIPLE QUAKE! (Hammer ×7): one slam round you (wherever you are by then), `R` across; the `k`th of 3.
function hammerQuake(card, R, dmg, k) {
  const p = game.player;
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: 'hammer', card, a: (p.face ?? -Math.PI / 2), reach: PLAYER.r + 12, side: 0, size: 1.2 + k * 0.2, life: MELEE.hammer.life, max: MELEE.hammer.life }));
  later(MELEE.hammer.drop, () => {
    const q = game.player;
    hammerLand(card, q.x, q.y, R, damageOf(dmg), knockOf(MELEE.quake.knock), 1 + k * 0.4);
    game.rings.push({ x: q.x, y: q.y, r: R * 0.6, max: R * 1.1, life: 0.5, color: COL.hammerHi });
    if (k === 2) SFX.sin('slam');
  });
}
// DEVIL'S COMBO!'s clap: two giant red hands come in from either side of the enemy and clap together on it; everything
// round there is hit and stunned for a moment.
function devilClap(card, e, C) {
  const a = angleTo(e), x = e.x, y = e.y;
  game.melees.push({ x, y, kind: 'clap', card, a: a + Math.PI / 2, fixed: true, life: C.life, max: C.life, at: C.at, size: C.size || 1 });
  later(C.at, () => {
    blast(x, y, card, C.radius, damageOf(C.dmg), { knock: 120, stun: C.stun });
    game.rings.push({ x, y, r: 8, max: C.radius * 1.3, life: 0.35, color: COL.fistopheles });
    for (let k = 0; k < 18; k++) {
      const b = a + (k % 2 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 1.4, v = 200 + Math.random() * 300;
      game.particles.push({ x, y, vx: Math.cos(b) * v, vy: Math.sin(b) * v, life: 0.25 + Math.random() * 0.25, color: k % 3 ? COL.fistopheles : COL.flash, spark: true });
    }
    game.shake = Math.max(game.shake, 0.3 * (C.size || 1));
    SFX.melee('clap');
  });
}

// BLACK FLASH! (user): one punch, bigger than the rest. Where it lands, black lightning with red highlights bursts out;
// then 7 s of a see-through blue aura and super fast movement, attack speed and damage (moveSpeed / attackInterval /
// damageOf in upgrades.js). With nothing in reach the punch hits the air, and the aura is still yours.
function blackFlash(card, echo, callout) {
  const B = MELEE.blackFlash, p = game.player, reach = rangeOf(card) * B.reach, e = nearestEnemy(p, null, reach);
  callout();
  let a = p.face ?? -Math.PI / 2, at = { x: p.x + Math.cos(a) * reach * 0.8, y: p.y + Math.sin(a) * reach * 0.8 };
  if (e) {
    const q = hitPoint(e, p.x, p.y);
    a = Math.atan2(q.y - p.y, q.x - p.x); at = { x: q.x, y: q.y };
    hitEnemy({ card, look: 'melee', dmg: damageOf(B.hit), knock: knockOf(CARDS[card].knock * 1.6), vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
  }
  game.bflash = B.time;                                    // (after the hit: the aura's damage is for what comes next)
  const d = Math.max(PLAYER.r + 14, Math.hypot(at.x - p.x, at.y - p.y));
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: 'punch', card, a, reach: d + 6, side: 0, size: B.size, life: B.life, max: B.life }));
  game.melees.push({ x: at.x, y: at.y, kind: 'impact', card, a, fixed: true, life: B.impact, max: B.impact, seed: Math.random() * 1e6 });
  for (let k = 0; k < 14; k++) {                           // black shards of the ground thrown up, edged in red
    const sa = Math.random() * TAU, v = 90 + Math.random() * 200;
    game.sinfx.push({ kind: 'rock', x: at.x, y: at.y, vx: Math.cos(sa) * v, vy: Math.sin(sa) * v, z: 0, vz: 160 + Math.random() * 160,
      size: 2.5 + Math.random() * 4, spin: Math.random() * TAU, life: 0.9, max: 0.9, fixed: true, col: COL.flash, edge: COL.flashHi });
  }
  for (let k = 0; k < 26; k++) {                           // red sparks bursting out, mostly onward
    const sa = a + (Math.random() - 0.5) * (k % 3 ? 1.8 : TAU), v = 260 + Math.random() * 420;
    game.particles.push({ x: at.x, y: at.y, vx: Math.cos(sa) * v, vy: Math.sin(sa) * v, life: 0.3 + Math.random() * 0.35, color: COL.flashHi, spark: true });
  }
  if (!echo) game.bfFrame = { t: 0, x: at.x, y: at.y };    // the impact frame (draw.js drawImpactFrame)
  if (!echo) game.hitstop = Math.max(game.hitstop || 0, B.frame.stop);
  game.shake = Math.max(game.shake, 0.55);
  game.rings.push({ x: at.x, y: at.y, r: 6, max: 150, life: 0.45, color: COL.flashHi });
  game.rings.push({ x: at.x, y: at.y, r: 4, max: 90, life: 0.32, color: COL.flash });
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 44, life: 0.5, color: COL.flashHi });
  const F = B.flurry;                                      // and the flurry of punches after it, at whatever's in reach
  for (let k = 0; k < F.count; k++) later(F.after + k * F.gap, () => {
    if (!(game.bflash > 0)) return;
    const q = game.player, en = nearestEnemy(q, null, rangeOf(card) * B.reach);
    if (!en) return;
    const t = hitPoint(en, q.x, q.y);
    swing(card, angleTo(en) + (Math.random() - 0.5) * 0.35, rangeOf(card) * B.reach, { dmg: F.dmg, knock: F.knock, side: k % 2 ? 7 : -7, quiet: k % 2 > 0 });
    game.melees.push({ x: t.x, y: t.y, kind: 'impact', small: true, card, a: angleTo(en), fixed: true, life: 0.2, max: 0.2, seed: Math.random() * 1e6 });
  });
  if (!echo) SFX.melee('flash');
}
// BLACK FLASH!'s lightning (v0.55, user: "like lightning, so every hit must be random"): bolts tearing out from where
// a punch lands, most of them onward, the way it went, jagged and forking, thinning to their ends. A new shape every
// `flick` s of fight time (seeded by the hit and the moment, so it holds still while the lab is paused), and every hit
// its own. Segments are [x1, y1, x2, y2, width, how far along from the hit]; they shoot out in the first moments
// (boltReach).
function boltTree(m) {
  const B = MELEE.blackFlash.bolt, S = m.small ? B.small : B, el = m.max - m.life;
  const key = reducedMotion ? 0 : Math.floor(el / B.flick);
  if (m.tree && m.treeKey === key) return m.tree;
  const rnd = mulberry32(((m.seed | 0) + key * 7919) | 0), segs = [];
  const bolt = (px, py, dir, len, w, depth, d0 = 0) => {
    for (let s = 0; s < len;) {
      dir += (rnd() - 0.5) * 0.25;                                    // the bolt's way wanders a little …
      const st = 9 + rnd() * 11, a = dir + (rnd() - 0.5) * 0.95, k = 1 - s / len;   // … and every step zigzags off it
      const nx = px + Math.cos(a) * st, ny = py + Math.sin(a) * st;
      segs.push([px, py, nx, ny, Math.max(0.8, w * k), d0 + s]);
      px = nx; py = ny; s += st;
      if (depth < 2 && rnd() < 0.2) bolt(px, py, dir + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), (len - s) * (0.35 + rnd() * 0.35), w * k * 0.6, depth + 1, d0 + s);
    }
  };
  for (let k = 0; k < S.n; k++) {
    const dir = m.a + (rnd() - 0.5) * (k % 3 === 2 ? TAU : 2.2);
    bolt(m.x, m.y, dir, S.reach * (0.45 + rnd() * 0.55), S.w * (0.7 + rnd() * 0.5), 0);
  }
  m.tree = segs; m.treeKey = key;
  return segs;
}
// Draws a tree of bolts: `fx` red glow, red edge, black heart; `ink` one flat colour (the impact frame's); `neg` red
// glow round white (the impact frame's negative). Batched by width.
const boltReach = m => (m.small ? MELEE.blackFlash.bolt.small : MELEE.blackFlash.bolt).reach * Math.min(1, 0.3 + (m.max - m.life) / 0.05);
function drawBoltTree(segs, a, mode = 'fx', ink = '#000000', R = Infinity) {
  const byW = new Map();
  for (const sg of segs) { if (sg[5] > R) continue; const w = Math.round(sg[4]); (byW.get(w) || byW.set(w, []).get(w)).push(sg); }
  const passes = mode === 'ink' ? [[2, ink, 1, false]]
    : mode === 'neg' ? [[8, COL.flashHi, 0.5, true], [3, COL.flashHi, 1, true], [0, '#ffffff', 1, false]]
    : [[9, COL.flashHi, 0.4, true], [3.5, COL.flashHi, 1, true], [0, COL.flash, 1, false]];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [extra, col, alpha, add] of passes) {
    if (add) fxAdd(col);
    ctx.strokeStyle = col; ctx.globalAlpha = alpha * a;
    for (const [w, list] of byW) {
      ctx.lineWidth = w + extra; ctx.beginPath();
      for (const sg of list) { ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); }
      ctx.stroke();
    }
    if (add) fxNormal();
  }
  ctx.globalAlpha = 1;
}
// Each frame (combat.js update): swings stay on whoever made them (an impact stays where it landed), then fade.
// While BLACK FLASH! lasts you leave afterimages when you move.
function updateMelees(dt) {
  if (game.bflash > 0 && !game.inMenu) {
    const p = game.player, B = MELEE.blackFlash;
    const mv = Math.hypot(p.x - (game.bfLast?.x ?? p.x), p.y - (game.bfLast?.y ?? p.y));
    if ((game.bfGhost = (game.bfGhost || 0) - dt) <= 0 && mv > 0.5) { game.bfGhost = B.ghost; game.ghosts.push({ x: p.x, y: p.y, a: 0, life: 0.2, bf: true }); }
    game.bfLast = { x: p.x, y: p.y };
  }
  for (let i = game.melees.length - 1; i >= 0; i--) {
    const m = game.melees[i];
    if (m.kind === 'vaura') {                                 // VESSEL BURST!'s aura: on its enemy, then it goes off
      if (m.target && game.enemies.includes(m.target) && !m.target.dead) { m.x = m.target.x; m.y = m.target.y; m.r = m.target.r || m.r; }
      else m.target = null;
      if (m.life - dt <= 0) { usePlayerId(m.owner, m.aug); vesselBlast(m.card, m.x, m.y, MELEE.vesselBurst); }
    }
    if ((m.life -= dt) <= 0) { game.melees.splice(i, 1); continue; }
    if (!m.fixed) followOwner(m);
  }
}

/* ---------- how they look (draw.js) ---------- */
// A knife (user: it should look like a KNIFE), its tip at (0, 0), pointing along +x: a pointed blade with a curved
// edge and a bright line along it, a crossguard, a wrapped handle and a pommel. About 36 px long.
function knifeSprite(c = ctx) {
  c.fillStyle = COL.knifeDark;                                        // handle and pommel
  c.beginPath(); c.roundRect(-35, -3.2, 13, 6.4, 2.5); c.fill();
  c.beginPath(); c.arc(-35.5, 0, 3.4, 0, TAU); c.fill();
  c.strokeStyle = COL.knifeGuard; c.lineWidth = 1;                    // the wrap
  for (const x of [-31, -27.5]) { c.beginPath(); c.moveTo(x, -3.2); c.lineTo(x + 1.5, 3.2); c.stroke(); }
  c.fillStyle = COL.knifeGuard;                                       // crossguard
  c.beginPath(); c.roundRect(-23, -6, 3.4, 12, 1.5); c.fill();
  c.fillStyle = COL.knife;                                            // blade: straight spine on top, curving edge below
  c.beginPath(); c.moveTo(-19.6, -3.4); c.lineTo(-5, -3.4); c.lineTo(0, 0); c.quadraticCurveTo(-6, 4.6, -19.6, 3.6); c.closePath(); c.fill();
  c.strokeStyle = COL.knifeGuard; c.lineWidth = 0.9;                  // the fuller
  c.beginPath(); c.moveTo(-18, -1); c.lineTo(-8, -1); c.stroke();
  c.strokeStyle = '#ffffff'; c.globalAlpha *= 0.8; c.lineWidth = 1;   // the sharp edge catching the light
  c.beginPath(); c.moveTo(-18, 3.2); c.quadraticCurveTo(-6, 3.9, -1, 0.6); c.stroke();
  c.globalAlpha /= 0.8;
}
// A fist (user: just a single white fist, closed), its knuckles at (0, 0), facing +x: one white shape with a dark
// edge, the knuckles bumping out along its front, the folds between the fingers and the thumb's line. `s` scales it.
function fistSprite(s = 1, c = ctx, col = COL.fist, line = COL.fistLine) {
  c.save(); c.scale(s, s);
  const shape = grow => {                                            // the whole fist, `grow` px bigger all round
    c.beginPath(); c.roundRect(-14 - grow, -8.5 - grow, 13 + grow * 2, 17 + grow * 2, 5 + grow); c.fill();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-2, -6.3 + k * 4.2, 2.6 + grow, 0, TAU); c.fill(); }
  };
  c.fillStyle = line; shape(1.4);                                    // the edge, then the fist on top of it
  c.fillStyle = col; shape(0);
  c.strokeStyle = line; c.lineWidth = 1.1; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const y = -4.2 + k * 4.2; c.beginPath(); c.moveTo(-6, y); c.lineTo(-1.5, y); c.stroke(); }   // between the fingers
  c.beginPath(); c.moveTo(-12, 3.5); c.quadraticCurveTo(-8, 7, -3.5, 5.5); c.stroke();                                    // the thumb
  c.restore();
}
// Slap's open hand (v0.58, user: "a slap hand, not a fist"), its fingertips at (0, 0), facing +x: a flat palm, four
// long fingers spread out in a fan, the thumb sticking out to the side, the creases of the palm. `s` scales it.
function palmSprite(s = 1, c = ctx, col = COL.slapHand, line = COL.fistLine, demon = false) {
  c.save(); c.scale(s, s);
  const digit = (x, y, a, len, w, g) => {                         // a finger (or the thumb) from (x, y), pointing along `a`
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.roundRect(-w / 2 - g, -w / 2 - g, len + w + g * 2, w + g * 2, w / 2 + g); c.fill();
    c.restore();
  };
  const shape = g => {
    c.beginPath(); c.roundRect(-22 - g, -8 - g, 13 + g * 2, 16 + g * 2, 6 + g); c.fill();            // the palm
    digit(-11, -5.4, -0.42, 11, 3.4, g); digit(-10, -1.8, -0.14, 13.5, 3.6, g);                    // four fingers, spread out
    digit(-10, 1.8, 0.14, 13, 3.6, g); digit(-11, 5.4, 0.44, 10, 3.2, g);
    digit(-15, -7, -1.05, 7.5, 4, g);                                                              // the thumb, out to the side
  };
  c.fillStyle = line; shape(1.3);                                  // a dark edge, then the hand on top of it
  c.fillStyle = col; shape(0);
  c.strokeStyle = line; c.lineWidth = 0.8; c.lineCap = 'round'; c.globalAlpha *= 0.5;   // a crease across the palm
  c.beginPath(); c.moveTo(-19, 3); c.quadraticCurveTo(-15, 5, -11, 2.5); c.stroke();
  c.globalAlpha /= 0.5;
  if (demon) {                                                     // The Iron Fistopheles' hands (v0.59): red veins, black claws
    fxAdd(line); c.strokeStyle = line; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-20, -5); c.lineTo(-16.5, -2); c.lineTo(-13, -4.5); c.lineTo(-10, -2); c.moveTo(-16.5, -2); c.lineTo(-17, 2); c.lineTo(-13, 5); c.stroke();
    fxNormal();
    c.fillStyle = COL.flash; c.strokeStyle = line; c.lineWidth = 0.6;
    for (const [x, y, a, len] of [[-11, -5.4, -0.42, 11], [-10, -1.8, -0.14, 13.5], [-10, 1.8, 0.14, 13], [-11, 5.4, 0.44, 10]]) {
      const tx = x + Math.cos(a) * (len + 1.4), ty = y + Math.sin(a) * (len + 1.4);
      c.save(); c.translate(tx, ty); c.rotate(a);
      c.beginPath(); c.moveTo(0, -1.5); c.lineTo(4.2, 0.6); c.lineTo(0, 1.5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  }
  c.restore();
}
// A jagged line from (x1, y1) to (x2, y2), for the black lightning. `rnd`: a random source, so a bolt can hold still.
function boltPath(x1, y1, x2, y2, rnd, jag = 9) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(d / 12)), nx = -(y2 - y1) / (d || 1), ny = (x2 - x1) / (d || 1);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let k = 1; k < n; k++) { const t = k / n, j = (rnd() - 0.5) * 2 * jag; ctx.lineTo(x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j); }
  ctx.lineTo(x2, y2);
}
// Black lightning: a red glow, then the black bolt over it.
function blackBolt(x1, y1, x2, y2, rnd, a = 1, jag, w = 1) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = (rnd() * 1e9) | 0;
  ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = COL.flashHi; ctx.lineWidth = 4.5 * w;
  boltPath(x1, y1, x2, y2, mulberry32(s), jag); ctx.stroke();
  ctx.globalAlpha = a; ctx.strokeStyle = COL.flash; ctx.lineWidth = 2 * w;
  boltPath(x1, y1, x2, y2, mulberry32(s), jag); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawMelees() {
  for (const m of game.melees) {
    const q = 1 - m.life / m.max, out = Math.sin(Math.min(1, q) * Math.PI);   // out and back
    if (m.kind === 'impact') {                                         // BLACK FLASH!'s impact: black lightning bursting out
      // v0.55 (user: a punch's impact, but lightning, random every hit): a red blaze, a black heart edged in red, and
      // the bolts (boltTree), flickering as they go; `small`: each punch of the flurry after it
      const fade = Math.min(1, m.life / (m.max * 0.6)), z = m.small ? 0.45 : 1;
      const flick = reducedMotion ? 1 : 0.7 + 0.3 * mulberry32(((m.seed | 0) + (m.treeKey ?? 0) * 31) | 0)();
      fxGlow(m.x, m.y, (100 + 80 * q) * z, COL.flashHi, 0.95 * fade);
      drawBoltTree(boltTree(m), fade * flick, 'fx', undefined, boltReach(m));
      ctx.globalAlpha = 0.95 * fade; ctx.fillStyle = COL.flashHi; circle(m.x, m.y, (12 + q * 10) * z + 3);
      ctx.fillStyle = COL.flash; circle(m.x, m.y, (10 + q * 9) * z);    // the black heart where it landed
      ctx.globalAlpha = 1;
      continue;
    }
    if (m.kind === 'flash') {                                          // Flashbang (combat.js flashBurst): a white flash, fading
      const k = m.life / m.max;
      fxGlow(m.x, m.y, m.r * (1.15 + (1 - k) * 0.35), '#ffffff', 0.95 * k);
      ctx.globalAlpha = 0.6 * k * k; ctx.fillStyle = '#ffffff'; circle(m.x, m.y, m.r * (0.45 + 0.55 * (1 - k)));
      ctx.globalAlpha = 1;
      continue;
    }
    if (m.kind === 'vaura') { drawVesselAura(m); continue; }          // VESSEL BURST!'s aura and blast (v0.65, below)
    if (m.kind === 'vboom') { drawVesselBoom(m); continue; }
    if (m.kind === 'whip') { drawWhip(m); continue; }                  // Druidity's vine whip (v0.65, magus.js)
    if (m.kind === 'hammer') { drawHammerSwing(m); continue; }        // Hammer (v0.59, below)
    if (m.kind === 'clap') { drawClap(m); continue; }                  // DEVIL'S COMBO!'s clap
    if (m.kind === 'slice') {                                          // Rambo (v0.58): a slash sweeping across an arc
      // v0.59 (user: "gradually become thicker"): a crescent, a thin wisp where it started and thicker and thicker toward
      // its leading edge, and the whole slash thickens as it sweeps on
      const k = m.life / m.max, r = m.reach * 0.8, dir = m.side < 0 ? -1 : 1, prog = Math.min(1, (1 - k) * 2.4);
      const a0 = m.a - (m.arc / 2) * dir, a1 = a0 + m.arc * prog * dir, W = 18 * (0.3 + 0.7 * Math.min(1, (1 - k) * 2)), steps = 18;
      const band = (wm, col, alpha) => {
        ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.beginPath();
        for (let i = 0; i <= steps; i++) { const t = i / steps, ang = a0 + (a1 - a0) * t, w = W * wm * t ** 1.3; ctx.lineTo(m.x + Math.cos(ang) * (r + w / 2), m.y + Math.sin(ang) * (r + w / 2)); }
        for (let i = steps; i >= 0; i--) { const t = i / steps, ang = a0 + (a1 - a0) * t, w = W * wm * t ** 1.3; ctx.lineTo(m.x + Math.cos(ang) * (r - w / 2), m.y + Math.sin(ang) * (r - w / 2)); }
        ctx.closePath(); ctx.fill();
      };
      if (prog > 0.02) { band(1.6, COL[m.card], 0.35 * k); band(1, COL[m.card], 0.75 * k); band(0.42, '#ffffff', k); }
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    if (m.kind === 'knife') {
      // just the knife, stabbing forward and back (user)
      ctx.translate(PLAYER.r + 16 + out * (m.reach - PLAYER.r - 14), 0); knifeSprite();
    } else {
      // just the fist (or Slap's open hand), punching out and back (user)
      const s = m.size || 1;
      ctx.translate(PLAYER.r + 4 + out * (m.reach - PLAYER.r - 6), m.side);
      if (m.aura) {                                                    // VESSEL BURST!'s fist: a light blue and black aura
        fxGlow(-6 * s, 0, 30 * s, COL.vessel, 0.9);
        ctx.fillStyle = COL.flash; ctx.globalAlpha = 0.75; circle(-6 * s, 0, 14 * s); ctx.globalAlpha = 1;
      }
      if (m.kind === 'slap') palmSprite(s);
      else if (m.kind === 'astral') astralFist(s, 1 - q);               // The Iron Fistopheles (v0.59, below)
      else fistSprite(s);
    }
    ctx.restore();
  }
}
// VESSEL BURST!'s aura (v0.65, user: "a blue aura"): a glassy blue bubble of light round the enemy, lit from the top
// left, black wisps curling up inside it, a ring on the floor closing in as the second runs out, all of it pulsing
// faster and brighter toward the end.
function drawVesselAura(m) {
  const k = 1 - m.life / m.max, t = reducedMotion ? 0 : performance.now() / 1000, R = m.r * 1.5 + 6 + 3 * k;
  const pulse = 0.75 + 0.25 * Math.sin(t * (8 + 26 * k)), grow = Math.min(1, k * 6);
  ctx.globalAlpha = 0.6; ctx.strokeStyle = COL.vessel; ctx.lineWidth = 1.5;           // the ring on the floor, closing in
  ctx.beginPath(); ctx.ellipse(m.x, m.y + m.r * 0.7, R * (1.6 - 0.6 * k), R * (1.6 - 0.6 * k) * 0.42, 0, 0, TAU); ctx.stroke();
  fxGlow(m.x, m.y, R * 2.2, COL.vessel, (0.35 + 0.45 * k) * pulse);
  const g = ctx.createRadialGradient(m.x - R * 0.35, m.y - R * 0.45, R * 0.05, m.x, m.y, R * grow);
  g.addColorStop(0, hexA('#ffffff', 0.55)); g.addColorStop(0.35, hexA(COL.vessel, 0.18)); g.addColorStop(0.85, hexA(COL.vessel, 0.4)); g.addColorStop(1, hexA(COL.vessel, 0.85));
  ctx.globalAlpha = pulse; ctx.fillStyle = g; circle(m.x, m.y, R * grow);
  ctx.lineCap = 'round';
  for (let j = 0; j < 4; j++) {                                        // black wisps curling up inside it
    const u = (t * 1.3 + j / 4) % 1, x = m.x + Math.sin(j * 2.1 + t * 3) * R * 0.45, y = m.y + R * 0.5 - u * R * 1.2;
    ctx.globalAlpha = 0.7 * Math.sin(u * Math.PI) * grow; ctx.strokeStyle = COL.flash; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * Math.sin(t * 5 + j), y - 4, x, y - 7); ctx.stroke();
  }
  ctx.globalAlpha = 0.85 * pulse; ctx.strokeStyle = COL.vessel; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(m.x, m.y, R * grow, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
// … and its blast (v0.65): a blue dome of light swelling over the spot and thinning away, a shock ring across the floor
// (squashed, the floor at an angle), black shards in it.
function drawVesselBoom(m) {
  const q = 1 - m.life / m.max, e = 1 - (1 - q) ** 3, fade = 1 - q, R = m.r * (0.35 + 0.75 * e);
  fxGlow(m.x, m.y, R * 1.6, COL.vessel, 0.55 * fade);
  ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = COL.vessel; ctx.lineWidth = 1 + 4 * fade;
  ctx.beginPath(); ctx.ellipse(m.x, m.y, R * 1.15, R * 1.15 * 0.45, 0, 0, TAU); ctx.stroke();
  const g = ctx.createRadialGradient(m.x - R * 0.3, m.y - R * 0.55, R * 0.05, m.x, m.y - R * 0.1, R);
  g.addColorStop(0, hexA('#ffffff', 0.5 * fade)); g.addColorStop(0.4, hexA(COL.vessel, 0.3 * fade)); g.addColorStop(1, hexA(COL.vessel, 0));
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(m.x, m.y - R * 0.15, R, R * 0.85, 0, Math.PI, TAU); ctx.ellipse(m.x, m.y - R * 0.15, R, R * 0.3, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = COL.flash;
  for (let j = 0; j < 7; j++) {
    const b = j * TAU / 7 + 0.4, d = R * (0.4 + 0.7 * e), x = m.x + Math.cos(b) * d, y = m.y + Math.sin(b) * d * 0.5 - 10 * Math.sin(q * Math.PI);
    ctx.globalAlpha = fade; ctx.save(); ctx.translate(x, y); ctx.rotate(b + q * 6); ctx.fillRect(-2, -1, 4, 2); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// While BLACK FLASH! lasts: v0.55 (user: "just a pulsing red and black faint glowing streak, like light streaks that
// go up"): a faint red glow breathing round you, and thin streaks of light, red and black, rising off you and fading,
// each from a new place every time it rises.
function drawBlackFlashAura(p) {
  const fade = Math.min(1, game.bflash / 0.4), t = reducedMotion ? 0 : performance.now() / 1000, pulse = 0.6 + 0.4 * Math.sin(t * 7);
  fxGlow(p.x, p.y, PLAYER.r * 3.4, COL.flashHi, 0.35 * pulse * fade);
  ctx.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    const rate = 1.1 + ((k * 0.618034) % 1) * 1.1, ph = t * rate + k * 0.381966, u = ph % 1;
    const h = Math.sin((Math.floor(ph) + 1) * 12.9898 + k * 78.233) * 43758.5453, r1 = h - Math.floor(h);
    const x = p.x + (r1 * 2 - 1) * PLAYER.r * 1.2, y = p.y + PLAYER.r * 0.8 - u * PLAYER.r * 3.4, len = 9 + 12 * r1;
    const red = k % 2 === 0, col = red ? COL.flashHi : COL.flash, a = Math.sin(u * Math.PI) * fade * (0.45 + 0.4 * pulse) * (red ? 1 : 0.75);
    const g = ctx.createLinearGradient(x, y - len, x, y);
    g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, 1));
    if (red) fxAdd(col);
    ctx.globalAlpha = a; ctx.strokeStyle = g; ctx.lineWidth = red ? 2.2 : 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len); ctx.stroke();
    if (red) fxNormal();
  }
  ctx.globalAlpha = 1;
}
// KNIFE THROW!'s knife in flight, spinning.
function drawThrownKnife(pr) {
  ctx.globalAlpha = 0.25; ctx.strokeStyle = COL.knife; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - Math.cos(pr.a) * 26, pr.y - Math.sin(pr.a) * 26); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(reducedMotion ? pr.a : performance.now() / 40); ctx.translate(18, 0);
  knifeSprite();
  ctx.restore();
}

/* ---------- the Standard pack's new melee (v0.59) ---------- */
// The hammer (user: "strike a hammer down"), its head at (0, 0), the handle back along -x: a wooden handle with a grip,
// and a heavy steel head across it, lit on top. `s` scales it.
function hammerSprite(s = 1, c = ctx) {
  c.save(); c.scale(s, s);
  c.fillStyle = COL.fistLine;
  c.beginPath(); c.roundRect(-34, -2.6, 32, 5.2, 2.4); c.fill();                // the handle's edge
  c.fillStyle = COL.knifeDark; c.beginPath(); c.roundRect(-33, -1.7, 30, 3.4, 1.6); c.fill();
  c.fillStyle = COL.fistLine; c.beginPath(); c.roundRect(-35, -3, 9, 6, 2); c.fill();   // the grip
  c.fillStyle = COL.fistLine; c.beginPath(); c.roundRect(-7.6, -11.6, 15.2, 23.2, 3); c.fill();   // the head: a dark edge …
  c.fillStyle = COL.hammerHead; c.beginPath(); c.roundRect(-6.4, -10.4, 12.8, 20.8, 2.2); c.fill();   // … steel …
  c.fillStyle = COL.hammerHi; c.globalAlpha *= 0.85; c.beginPath(); c.roundRect(-6.4, -10.4, 4.4, 20.8, 2); c.fill(); c.globalAlpha /= 0.85;   // … lit along one side
  c.fillStyle = COL.fistLine; c.globalAlpha *= 0.5; c.fillRect(-6.4, -6.2, 12.8, 1.2); c.fillRect(-6.4, 5, 12.8, 1.2); c.globalAlpha /= 0.5;   // its bands
  c.restore();
}
// A hammer swing: it comes over from your side and down onto the spot (MELEE.hammer.drop s in), a blur behind it, then
// rests there a moment. Seen from above, the head looks bigger while it's up in the air.
function drawHammerSwing(m) {
  const H = MELEE.hammer, el = m.max - m.life, k = Math.min(1, el / H.drop), e = k * k, s = m.size || 1;
  const a = m.a - (1 - e) * 1.9, len = m.reach, up = Math.sin(k * Math.PI) * 0.35;
  ctx.save(); ctx.translate(m.x, m.y);
  if (k < 1) {                                                       // the blur of the swing
    ctx.globalAlpha = 0.3 * (1 - k * 0.5); ctx.strokeStyle = COL.hammerHi; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, len, m.a - 1.9, a); ctx.stroke();
  }
  ctx.globalAlpha = m.life < 0.08 ? m.life / 0.08 : 1;
  ctx.rotate(a); ctx.translate(len, 0);
  hammerSprite(s * (1 + up));
  ctx.restore(); ctx.globalAlpha = 1;
}
// The Iron Fistopheles' astral fist (v0.59, user: "more demonic, more black details, black and red, more astral"): a
// black fist edged in glowing red, red cracks running over it like veins and lit knuckles with black spikes, black and
// red astral flames licking back off it, a black smoke ghost behind, all in a red glow. `k`: how much of its life is
// left (it fades out).
function astralFist(s, k = 1) {
  const t = reducedMotion ? 0 : performance.now() / 1000;
  fxGlow(-6 * s, 0, 30 * s, COL.fistopheles, 0.9 * k);
  ctx.globalAlpha = 0.45 * k; ctx.save(); ctx.translate(-8 * s, 0); fistSprite(s * 1.18, ctx, COL.flash, COL.flash); ctx.restore();   // its black ghost
  astralFlames(s, k, t, -10, 30);
  ctx.globalAlpha = k; fistSprite(s, ctx, COL.flash, COL.fistopheles);                                                           // the black fist, a red edge
  ctx.save(); ctx.scale(s, s);
  const sheen = ctx.createLinearGradient(0, -9.1, 0, 9.1);       // v0.60 (user: "3D"): lit from above, its underside in shadow
  sheen.addColorStop(0, 'rgba(255, 255, 255, .28)'); sheen.addColorStop(0.35, 'rgba(255, 255, 255, 0)'); sheen.addColorStop(0.7, 'rgba(0, 0, 0, 0)'); sheen.addColorStop(1, 'rgba(0, 0, 0, .5)');
  ctx.globalAlpha = k; ctx.fillStyle = sheen; ctx.beginPath(); ctx.roundRect(-14.6, -9.1, 14.2, 18.2, 5.4); ctx.fill();
  fxAdd(COL.fistopheles); ctx.globalAlpha = 0.6 * k; ctx.lineWidth = 2.6; ctx.strokeStyle = COL.fistopheles;
  ctx.beginPath(); ctx.roundRect(-14.6, -9.1, 14.2, 18.2, 5.4); ctx.stroke();                                                 // the red edge, glowing
  ctx.globalAlpha = k; ctx.lineWidth = 0.9; ctx.lineCap = 'round'; ctx.strokeStyle = COL.fistopheles;                          // red cracks, like veins
  ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(-9.5, -1.5); ctx.lineTo(-7, -4.5); ctx.lineTo(-3.5, -2.5);
  ctx.moveTo(-12.5, 5); ctx.lineTo(-8.5, 2.5); ctx.lineTo(-6, 5.5); ctx.moveTo(-9.5, -1.5); ctx.lineTo(-10, 2); ctx.stroke();
  for (let n = 0; n < 4; n++) { ctx.fillStyle = COL.fistopheles; circle(-2, -6.3 + n * 4.2, 1.1); }                         // lit knuckles
  fxNormal();
  for (let n = 0; n < 4; n++) {                                                                                                 // black spikes off them
    const y = -6.3 + n * 4.2;
    ctx.globalAlpha = k; ctx.fillStyle = COL.flash; ctx.strokeStyle = COL.fistopheles; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(0, y - 1.5); ctx.lineTo(4.6, y); ctx.lineTo(0, y + 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
// Black and red astral flames licking back off a fist or a hand (along -x), flickering: `s` its size, `k` its fade.
function astralFlames(s, k, t, from = -12, len = 22) {
  for (let n = 0; n < 5; n++) {
    const y0 = (n - 2) * 3.6, w = 2.6 + (n % 2), L = len * (0.7 + 0.3 * Math.sin(t * 13 + n * 1.7)), wob = Math.sin(t * 17 + n * 2.3) * 2.4;
    const red = n % 2 === 0;
    if (red) fxAdd(COL.fistopheles);
    ctx.globalAlpha = (red ? 0.75 : 0.85) * k; ctx.fillStyle = red ? COL.fistopheles : COL.flash;
    ctx.beginPath(); ctx.moveTo(from * s, (y0 - w) * s);
    ctx.quadraticCurveTo((from - L * 0.5) * s, (y0 - w * 0.6 + wob) * s, (from - L) * s, (y0 + wob * 1.4) * s);
    ctx.quadraticCurveTo((from - L * 0.5) * s, (y0 + w * 0.6 + wob) * s, from * s, (y0 + w) * s); ctx.closePath(); ctx.fill();
    if (red) fxNormal();
  }
  ctx.globalAlpha = 1;
}
// DEVIL'S COMBO!'s clap: two giant demon hands, black edged in red with red veins and claws, astral flames off them,
// sweeping in from either side and meeting on the spot. (`at`, `size`: HELL BARRAGE!'s quicker, smaller claps.)
function drawClap(m) {
  const at = m.at ?? MELEE.devil.clap.at, z = m.size ?? 1, el = m.max - m.life, k = Math.min(1, el / at), e = k * k, gap = (70 * (1 - e) + 15) * z, fade = Math.min(1, m.life / 0.12);
  const t = reducedMotion ? 0 : performance.now() / 1000, S = 2.2 * z;
  fxGlow(m.x, m.y, (60 + 30 * k) * z, COL.fistopheles, 0.75 * fade);
  for (const side of [-1, 1]) {                                      // fingers pointing on (away from you), thumbs in
    ctx.save(); ctx.translate(m.x + Math.cos(m.a) * gap * side, m.y + Math.sin(m.a) * gap * side);
    ctx.rotate(m.a - Math.PI / 2); ctx.scale(1, -side); ctx.translate(21 * z, 0);
    astralFlames(S, fade, t, -20, 18);
    ctx.globalAlpha = fade; palmSprite(S, ctx, COL.flash, COL.fistopheles, true);
    ctx.restore();
  }
  if (k >= 1) { const q = 1 - m.life / (m.max - at); fxAdd(COL.fistopheles); ctx.globalAlpha = 0.9 * (1 - q); ctx.fillStyle = COL.fistopheles; starPath(m.x, m.y, (10 + 10 * q) * z, (30 + 40 * q) * z, 8, m.a); ctx.fill();
    ctx.fillStyle = COL.flash; circle(m.x, m.y, (12 * (1 - q) + 2) * z); fxNormal(); }
  ctx.globalAlpha = 1;
}
// Under the enemies: the Hammer's broken ground (a dark circle with cracks, fading), and FAULT LINE!'s crack.
function drawGroundFx() {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const f of game.sinfx) {
    if (f.kind === 'quake') {
      const q = 1 - f.life / f.max, fade = Math.min(1, f.life / 0.3), wave = 1 - (1 - Math.min(1, q / 0.25)) ** 3;
      ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = COL.rockDark; circle(f.x, f.y, f.r * wave);
      if (q < 0.35) { const k = 1 - q / 0.35; ctx.globalAlpha = 0.8 * k; ctx.strokeStyle = COL.hammerHi; ctx.lineWidth = 3 + 8 * k; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, f.r * wave), 0, TAU); ctx.stroke(); }
      for (const c of f.cracks) {
        ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = COL.fistLine; ctx.lineWidth = 3.2; crackPath(f, c, Math.min(1, wave * 1.1)); ctx.stroke();
        ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = COL.hammer; ctx.lineWidth = 1; crackPath(f, c, Math.min(1, wave * 1.1)); ctx.stroke();
      }
    } else if (f.kind === 'fault') {
      const el = f.max - f.life, grow = Math.min(1, Math.max(0, el - MELEE.hammer.drop) / f.grow), fade = Math.min(1, f.life / 0.5);
      if (grow <= 0) continue;
      const n = Math.max(2, Math.ceil(f.pts.length * grow)), line = (w, col, a) => {
        ctx.globalAlpha = a * fade; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (let k = 0; k < n; k++) ctx[k ? 'lineTo' : 'moveTo'](f.x + f.pts[k][0], f.y + f.pts[k][1]);
        ctx.stroke();
      };
      line(14, COL.rockDark, 0.35); line(6, COL.fistLine, 0.95); line(1.6, COL.hammerHi, 0.8);
      for (const fk of f.forks) {
        const at = f.pts.indexOf(fk[0]);
        if (at < 0 || at >= n) continue;
        ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = COL.fistLine; ctx.lineWidth = 2.6; ctx.beginPath();
        fk.forEach((pt, k) => ctx[k ? 'lineTo' : 'moveTo'](f.x + pt[0], f.y + pt[1])); ctx.stroke();
      }
      if (grow < 1) {                                                // dust bursting up at the crack's front
        const t = f.pts[n - 1]; fxGlow(f.x + t[0], f.y + t[1], 26, COL.hammerHi, 0.6);
      }
    }
  }
  ctx.globalAlpha = 1;
}
