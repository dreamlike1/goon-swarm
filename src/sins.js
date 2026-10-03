/* sins.js — The SINS weapons (v0.53, user): no combos. v0.60 (user): the Sins pack is gone; they're the Silica pack's
   Epics now, each with a look of its own and a bit more punch:
   - Sonic Kick: the shot pushes shock rings and a vapour cone ahead of it; the kick comes in with afterimages and
     breaks the sound barrier where it lands: a sonic boom that hits everything round it (`sonic.boom`).
   - Iron Will: a dome of teal hexagon plates with a gold rim, plates knocked out with each hit; 3 hits, 2.5 s, and
     when it breaks it bursts, throwing everything near you back (`guard.burst`).
   - Tempest Slam: wind whirls out with the shockwave, and lightning strikes down where the cracks end (`slam.bolts`).
   - Dragon Kick: the arc is a fire dragon, its head leading; a kicked enemy flies off in its jaws, its body trailing. */
'use strict';

/* ============================================================
   Sonic Kick (ranged)  a sonic shot (teal, a gold core) that marks what it hits; a moment later a flying kick from
                        the astral plane, in the same colours, darts from you into the mark (user's sheet)
   Iron Will (melee)    a teal and gold shield round you that blocks the next `hits` hits whole, for `time` s. It's
                        cast on its turn whatever is close (`self`)
   Tempest Slam (melee) slams the ground: a gold flash, then an orange shockwave; everything within `radius` is hit and
                        thrown out, and the cracked ground (`zone`) slows enemies for a while
   Dragon Kick (melee)  one very heavy kick: an orange arc swung round, a yellow flash where it lands. v0.55 (user): it
                        always takes half the enemy's HP (half its full bar, so two kicks finish anything), and the enemy
                        flies off in a straight line, hitting everything it hits on the way (`fling`). A boss takes the
                        card's own damage and isn't thrown
   Every number is a placeholder.
   ============================================================ */
const SINS = {
  sonic: { mark: 3, delay: 0.32, fly: 0.2, kick: 16, knock: 260, boom: { r: 62, dmg: 5, knock: 220 } },   // (v0.60: kick 28 → 32, and the boom)
  // v0.55 (user): 4 s → 1 s; it blocks 2 hits whole, then breaks (it soaked up 40 damage before). v0.60 (user, Epic):
  // 3 hits, 2.5 s, and it bursts when it breaks
  guard: { hits: 3, time: 2.5, burst: { r: 84, dmg: 8, knock: 340 } },
  // `edge`: an enemy is hit when its edge is inside `radius`, so the slam really reaches about this much further; its
  // look is drawn out to radius + edge (v0.55, user: the effect was smaller than what it hits). v0.60: radius 96 → 104,
  // and `bolts` of lightning at the cracks' ends, `gap` s apart from `delay`, each hitting what's within `r`
  slam: { radius: 104, edge: 16, flash: 0.6, zone: { life: 2.5, chill: 0.3 }, bolts: { n: 4, delay: 0.1, gap: 0.07, r: 36, dmg: 3 } },
  // v0.65 (user: "more 3d and the impact effect"): `stop` s of hit-stop as it lands; `boom`: the impact's fireball,
  // shock ring, flames, burning debris and embers (dragonImpact), and the scorch it leaves on the floor for `scorch` s
  kick: { life: 0.36, flash: 0.3, stop: 0.06, fling: { speed: 900, time: 0.42, dmg: 36, knock: 320 },   // (v0.60: fling 30 → 36)
          boom: { life: 0.62, ring: 92, rocks: 9, embers: 12 }, scorch: { r: 30, life: 1.6 } },
};

// Iron Will: the shield (per player: game.sguard, co-op PKEYS).
function sinGuard(card) {
  const G = SINS.guard, p = game.player, b = tierBonus(card), hits = G.hits + (b.add.blocks || 0);   // (its tier: v0.62)
  game.sguard = { hp: hits, max: hits, t: G.time * b.dur, t0: G.time * b.dur, hit: 0, seed: (Math.random() * 1e9) | 0 };
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 26, life: 0.35, color: COL.ironwill });
  SFX.sin('guard');
}
// combat.js hurtPlayer: the shield takes the whole hit, whatever it was (v0.55, user: it breaks after 2 hits).
function sinAbsorb(raw) {
  const g = game.sguard;
  if (!g || g.hp <= 0) return raw;
  g.hp -= 1; g.hit = 0.2;
  const p = game.player;
  hexShards(p.x, p.y, 5, 120);
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: g.hp > 0 ? 'BLOCKED' : 'BROKEN', color: COL.ironwill, life: 0.5, vy: -40, big: false });
  if (g.hp <= 0) {                                         // broken: it bursts, throwing everything near you back (v0.60)
    const B = SINS.guard.burst;
    blast(p.x, p.y, 'ironwill', B.r, damageOf(B.dmg), { knock: B.knock });
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r + 8, max: B.r, life: 0.35, color: COL.sinGold });
    game.sinfx.push({ kind: 'hexwave', x: p.x, y: p.y, r: B.r, life: 0.45, max: 0.45, fixed: true });
    hexShards(p.x, p.y, 16, 260);
    game.shake = Math.max(game.shake, 0.18);
    game.sguard = null;
    SFX.sin('break');
  }
  return 0;
}

// Bits of the shield's plates, flying off (drawn as 'rock's: teal plates edged in gold).
function hexShards(x, y, n, speed) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * TAU, v = speed * (0.5 + Math.random() * 0.7);
    game.sinfx.push({ kind: 'rock', x: x + Math.cos(a) * (PLAYER.r + 8), y: y + Math.sin(a) * (PLAYER.r + 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: 8, vz: 80 + Math.random() * 120,
      size: 1.8 + Math.random() * 2.4, spin: Math.random() * TAU, life: 0.6, max: 0.6, fixed: true, col: COL.ironwill, edge: COL.sinGold });
  }
}
// Tempest Slam: everything within the radius is hit and thrown out; the ground stays cracked and slows.
function sinSlam(card) {
  const S = { ...SINS.slam, radius: SINS.slam.radius * bigK(), edge: SINS.slam.edge * bigK() }, p = game.player, spec = CARDS[card], dmg = damageOf(spec.dmg), knock = knockOf(spec.knock);   // (a BIG slot, v0.68)
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > S.radius) continue;
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    hitEnemy({ card, look: 'melee', dmg, knock, vx: dx / d, vy: dy / d, x: q.x, y: q.y }, e);
  }
  // Its look (user: red, and its own): a red strike crashes down, the ground splits in glowing fissures that race out to
  // the edge, chunks of rock are thrown up and fall back, and the cracks go on smouldering (the slowing zone).
  const vr = S.radius + S.edge, cracks = fissures(vr), now = { x: p.x, y: p.y };
  game.sinfx.push({ kind: 'slam', ...now, r: vr, cracks, life: S.flash, max: S.flash, seed: Math.random() * 1e6 });
  game.zones.push({ ...now, r: S.radius, vr, cracks, life: S.zone.life * durMul(card), max: S.zone.life * durMul(card), card });
  for (let k = 0; k < 20; k++) {
    const a = Math.random() * TAU, v = 90 + Math.random() * 170;
    game.sinfx.push({ kind: 'rock', x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: 0, vz: 150 + Math.random() * 130,
      size: 3 + Math.random() * 4, spin: Math.random() * TAU, life: 0.9, max: 0.9, fixed: true });
  }
  game.rings.push({ x: p.x, y: p.y, r: 10, max: vr, life: 0.42, color: COL.tempest });
  game.rings.push({ x: p.x, y: p.y, r: 6, max: vr * 0.7, life: 0.3, color: COL.tempestHi });
  game.rings.push({ x: p.x, y: p.y, r: vr * 0.8, max: vr * 1.12, life: 0.5, color: COL.tempest });   // the edge, ringing out
  game.shake = Math.max(game.shake, 0.32);
  SFX.sin('slam');
  // v0.60 (Epic): lightning comes down where `bolts.n` of the cracks end, one after another
  const B = S.bolts, ends = cracks.map(c => c[c.length - 1]).sort(() => Math.random() - 0.5).slice(0, B.n);
  ends.forEach((pt, k) => later(B.delay + k * B.gap, () => tempestBolt(card, now.x + pt[0], now.y + pt[1])));
}
function tempestBolt(card, x, y) {
  const B = SINS.slam.bolts;
  blast(x, y, card, B.r, damageOf(B.dmg), { knock: 120 });
  game.sinfx.push({ kind: 'tbolt', x, y, r: B.r, life: 0.38, max: 0.38, fixed: true, seed: (Math.random() * 1e9) | 0 });
  game.shake = Math.max(game.shake, 0.14);
  SFX.sin('bolt');
}

// Tempest Slam's fissures: jagged lines from the middle out to about the edge, a few with a fork.
function fissures(R) {
  const out = [], n = 9, a0 = Math.random() * TAU;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * TAU / n + (Math.random() - 0.5) * 0.45, len = R * (0.82 + Math.random() * 0.2), pts = [];
    for (let d = 6; d <= len; d += 11) { const j = (Math.random() - 0.5) * 10; pts.push([Math.cos(a) * d - Math.sin(a) * j, Math.sin(a) * d + Math.cos(a) * j]); }
    out.push(pts);
    if (Math.random() < 0.5 && pts.length > 4) {                       // a fork off its middle
      const m = pts[Math.floor(pts.length / 2)], b = a + (Math.random() < 0.5 ? -0.7 : 0.7), fork = [m];
      for (let d = 10; d <= len * 0.45; d += 10) fork.push([m[0] + Math.cos(b) * d, m[1] + Math.sin(b) * d]);
      out.push(fork);
    }
  }
  return out;
}

// Dragon Kick: one heavy kick at `e`.
const flingable = e => !(e.boss || e.obi || e.makora || e.apple || e.hugeSnek || e.mrock || e.dummy);
function sinKick(card, e) {
  const K = SINS.kick, p = game.player, spec = CARDS[card], q = hitPoint(e, p.x, p.y), a = Math.atan2(q.y - p.y, q.x - p.x);
  const fling = flingable(e), dmg = fling ? Math.max(1, Math.ceil(e.maxHp / 2)) : damageOf(spec.dmg);
  hitEnemy({ card, look: 'melee', dmg, noCrit: fling, knock: fling ? 0 : knockOf(spec.knock), vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
  if (fling && !e.dead && game.enemies.includes(e)) {
    e.kx = e.ky = 0;
    e.fling = { vx: Math.cos(a), vy: Math.sin(a), t: K.fling.time, card, owner: ownerId(), aug: AUG_FX, hits: new Set([e]), trail: [] };
  }
  // v0.55 (user: it reaches further than it looked): the arc is swung out to the kick's full reach (`range`), not just
  // to where it landed, and the impact is bigger: a big gold flash, two rings and a spray of sparks the way it went.
  game.sinfx.push(pinTo({ kind: 'kick', x: p.x, y: p.y, a, reach: Math.hypot(q.x - p.x, q.y - p.y), range: rangeOf(card), life: K.life, max: K.life }));
  game.sinfx.push({ kind: 'flash', x: q.x, y: q.y, life: K.flash, max: K.flash, fixed: true, big: true });
  dragonImpact(q.x, q.y, a, 1);                                      // (v0.65: the 3D impact, in place of two flat rings)
  game.hitstop = Math.max(game.hitstop || 0, K.stop);
  for (let k = 0; k < 16; k++) {
    const da = a + (Math.random() - 0.5) * 1.3, v = 280 + Math.random() * 360;
    game.particles.push({ x: q.x, y: q.y, vx: Math.cos(da) * v, vy: Math.sin(da) * v, life: 0.25 + Math.random() * 0.25, color: k % 3 ? COL.dragonkick : COL.sinGold, spark: true });
  }
  game.shake = Math.max(game.shake, 0.24);
  SFX.sin('kick');
}
// combat.js update: a kicked enemy flies straight on, slowing a little, and everything it runs into is hit and
// knocked aside. It stops when its time is up or it reaches the edge.
function flingStep(e, dt) {
  const F = SINS.kick.fling, f = e.fling, k = f.t / F.time, v = F.speed * (0.35 + 0.65 * k);
  usePlayerId(f.owner, f.aug);
  f.trail.push({ x: e.x, y: e.y }); if (f.trail.length > 8) f.trail.shift();
  const ox = e.x, oy = e.y;
  e.x += f.vx * v * dt; e.y += f.vy * v * dt;
  clampTo(e, e.r);
  const stuck = Math.hypot(e.x - ox, e.y - oy) < v * dt * 0.5;
  for (const o of [...game.enemies]) {
    if (f.hits.has(o) || o.dead || o.dummy || hitGap(o, e.x, e.y) > e.r) continue;
    f.hits.add(o);
    const side = Math.sign(f.vx * (o.y - e.y) - f.vy * (o.x - e.x)) || 1;   // knocked out of the way, to the side it was on
    const nx = f.vx * 0.6 - f.vy * side * 0.8, ny = f.vy * 0.6 + f.vx * side * 0.8;
    hitEnemy({ card: f.card, look: 'melee', dmg: damageOf(F.dmg), knock: knockOf(F.knock), vx: nx, vy: ny, x: o.x, y: o.y }, o);
    game.sinfx.push({ kind: 'flash', x: (o.x + e.x) / 2, y: (o.y + e.y) / 2, life: 0.22, max: 0.22, fixed: true });
    game.shake = Math.max(game.shake, 0.12);
  }
  if ((f.t -= dt) <= 0 || stuck) {
    if (stuck) { burst(e.x, e.y, COL.dragonkick, 12, 220); dragonImpact(e.x, e.y, Math.atan2(f.vy, f.vx), 0.6); game.shake = Math.max(game.shake, 0.15); SFX.hit(true); }
    e.fling = null;
  }
}

// Dragon Kick's impact (v0.65), `s` its size (1: the kick, smaller where a flung enemy hits the edge): the fireball,
// shock ring and flames (sinfx 'dkboom', drawSins), the scorch on the floor ('dkscorch', drawSinZones), chunks of
// burning ground thrown up ('rock', which fall back with their shadows) and embers drifting up.
function dragonImpact(x, y, a, s = 1) {
  const B = SINS.kick.boom, C = SINS.kick.scorch;
  game.sinfx.push({ kind: 'dkboom', x, y, a, s, life: B.life, max: B.life, fixed: true, seed: (Math.random() * 1e9) | 0 });
  game.sinfx.push({ kind: 'dkscorch', x, y, r: C.r * s, life: C.life, max: C.life, fixed: true, seed: (Math.random() * 1e9) | 0 });
  for (let k = 0; k < Math.round(B.rocks * s); k++) {
    const b = a + (Math.random() - 0.5) * 2.6, v = (90 + Math.random() * 200) * s;
    game.sinfx.push({ kind: 'rock', x: x + Math.cos(b) * 6, y: y + Math.sin(b) * 6, vx: Math.cos(b) * v, vy: Math.sin(b) * v, z: 2, vz: 170 + Math.random() * 200,
      size: 1.6 + Math.random() * 2.6 * s, spin: Math.random() * TAU, life: 0.85, max: 0.85, fixed: true, col: COL.dragonDark, edge: COL.dragonFire });
  }
  if (!reducedMotion) for (let k = 0; k < Math.round(B.embers * s); k++) {
    game.particles.push({ x: x + (Math.random() - 0.5) * 30 * s, y: y + (Math.random() - 0.5) * 14 * s, vx: (Math.random() - 0.5) * 90, vy: -90 - Math.random() * 150,
      life: 0.5 + Math.random() * 0.6, color: Math.random() < 0.5 ? COL.dragonFire : COL.dragonkick });
  }
}

// Sonic Kick: its shot landed on `e` (combat.js hitEnemy) → the mark, then the astral kick.
function sonicMark(pr, e) {
  const S = SINS.sonic;
  if (e.dead) return;
  e.smark = S.mark;
  SFX.sin('mark');
  later(S.delay, () => {
    if (!game.enemies.includes(e) || e.dead) return;
    const p = game.player;
    game.kicks.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, target: e, t: 0, card: pr.card, owner: ownerId(), aug: AUG_FX, a: Math.atan2(e.y - p.y, e.x - p.x) });
    SFX.sin('fly');
  });
}

// Each frame (combat.js update): the astral kicks fly, marks wear off, cracked ground slows, effects fade.
function updateSins(dt) {
  const S = SINS.sonic;
  for (let i = game.kicks.length - 1; i >= 0; i--) {
    const k = game.kicks[i], e = k.target;
    usePlayerId(k.owner, k.aug);
    if (!e || !game.enemies.includes(e) || e.dead) { game.kicks.splice(i, 1); continue; }
    k.t += dt;
    const q = hitPoint(e, k.x0, k.y0), f = Math.min(1, k.t / S.fly), ease = f * f;
    k.x = k.x0 + (q.x - k.x0) * ease; k.y = k.y0 + (q.y - k.y0) * ease; k.a = Math.atan2(q.y - k.y0, q.x - k.x0);
    if (f < 1) continue;
    game.kicks.splice(i, 1);
    e.smark = 0;
    hitEnemy({ card: k.card, look: 'melee', dmg: damageOf(S.kick), knock: knockOf(S.knock), vx: Math.cos(k.a), vy: Math.sin(k.a), x: q.x, y: q.y }, e);
    blast(q.x, q.y, k.card, S.boom.r, damageOf(S.boom.dmg), { skip: e, knock: S.boom.knock });   // the sonic boom (v0.60)
    game.sinfx.push({ kind: 'flash', x: q.x, y: q.y, life: 0.25, max: 0.25, fixed: true, teal: true });
    game.sinfx.push({ kind: 'sboom', x: q.x, y: q.y, a: k.a, r: S.boom.r, life: 0.5, max: 0.5, fixed: true });
    game.rings.push({ x: q.x, y: q.y, r: 6, max: 46, life: 0.3, color: COL.sonickick });
    game.shake = Math.max(game.shake, 0.12);
    SFX.sin('boom');
  }
  for (const e of game.enemies) if (e.smark > 0) e.smark -= dt;
  for (let i = game.zones.length - 1; i >= 0; i--) {
    const z = game.zones[i];
    if ((z.life -= dt) <= 0) { game.zones.splice(i, 1); continue; }
    for (const e of game.enemies) if (hitGap(e, z.x, z.y) < z.r) chill(e, SINS.slam.zone.chill);
    if (!reducedMotion && Math.random() < dt * 16 * Math.min(1, z.life)) {   // embers rising off the cracks
      const c = z.cracks[Math.floor(Math.random() * z.cracks.length)], pt = c[Math.floor(Math.random() * c.length)];
      game.particles.push({ x: z.x + pt[0], y: z.y + pt[1], vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * 40, life: 0.4 + Math.random() * 0.4, color: Math.random() < 0.5 ? COL.tempest : COL.tempestHi });
    }
  }
  for (let i = game.sinfx.length - 1; i >= 0; i--) {
    const f = game.sinfx[i];
    if ((f.life -= dt) <= 0) { game.sinfx.splice(i, 1); continue; }
    if (!f.fixed && f.owner != null) followOwner(f);
    if (f.kind === 'rock') {                                           // thrown up, falls back, skids to a stop
      f.x += f.vx * dt; f.y += f.vy * dt; f.spin += dt * 9;
      f.z += f.vz * dt; f.vz -= 900 * dt;
      if (f.z <= 0) { f.z = 0; f.vz = -f.vz * 0.25; f.vx *= 0.6; f.vy *= 0.6; }
    }
  }
  if (game.sguard && (game.sguard.t -= dt) <= 0) game.sguard = null;
  if (game.sguard) game.sguard.hit = Math.max(0, game.sguard.hit - dt);
}

/* ---------- how they look (draw.js) ---------- */
// A spiky star, for the hit flashes.
function starPath(x, y, r0, r1, n, rot = 0) {
  ctx.beginPath();
  for (let k = 0; k < n * 2; k++) { const r = k % 2 ? r0 : r1, a = rot + k * Math.PI / n; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
// The flying kick from the astral plane (user: a silhouette of their reference's pose): a flying side kick, the
// kicking leg straight out and up with the sole of the foot leading, the other leg tucked under, fists up in guard,
// head back. Traced from the picture, mirrored to kick along +x, in units about 1/16 of it (hip at 0, 0), then
// turned so the kick points the way it flies. A soft teal glow behind, solid teal over it, gold at the foot.
const KICKER = {
  head: [-5.6, -16.9, 3.6],
  torso: [[-4.6, -13.4], [2.4, -11.2], [3.6, -1.4], [-3.4, 0.4], [-12.6, -8.6]],   // neck, front shoulder, hip, back, back shoulder
  limbs: [                                                                           // [width, points…]
    [5.2, [0, 0], [11.2, -6.9], [20.4, -14.2]],          // the kicking leg
    [5.0, [-1, 0.5], [-12.4, 5.6], [5.2, 7.4]],          // the tucked leg, knee forward under it
    [2.8, [1.6, -10.4], [7.4, -11.2], [11.6, -12.6]],    // the front arm, out in guard
    [2.8, [-12.4, -8.4], [-14.6, -4.6], [-10.6, -9.4]],  // the back arm, fist at the chin
  ],
  fists: [[12.2, -12.8, 2.3], [-10.4, -9.8, 2.1]],
  feet: [[23.4, -17.2, 5.4, 2.6, -0.62], [7.6, 7.6, 3.2, 1.7, 0.1]],                // x, y, rx, ry, turn (the leading sole, the tucked foot)
  turn: 0.62,                                            // the kicking leg's lift, undone so it points straight ahead
};
function kickerShape(grow) {
  const K = KICKER;
  ctx.beginPath(); ctx.arc(K.head[0], K.head[1], K.head[2] + grow, 0, TAU); ctx.fill();
  ctx.beginPath(); K.torso.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 3 + grow * 2; ctx.stroke();
  for (const [w, ...pts] of K.limbs) {
    ctx.lineWidth = w + grow * 2; ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke();
  }
  for (const [x, y, r] of K.fists) { ctx.beginPath(); ctx.arc(x, y, r + grow, 0, TAU); ctx.fill(); }
  for (const [x, y, rx, ry, a] of K.feet) { ctx.beginPath(); ctx.ellipse(x, y, rx + grow, ry + grow, a, 0, TAU); ctx.fill(); }
}
function astralKicker(alpha) {
  ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = COL.sonickick;      // the streak it leaves
  ctx.beginPath(); ctx.moveTo(-40, -6); ctx.lineTo(0, -3); ctx.lineTo(0, 4); ctx.lineTo(-40, 7); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.rotate(KICKER.turn);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = ctx.strokeStyle = COL.sonickick; kickerShape(1.4);   // the glow
  ctx.globalAlpha = alpha * 0.9; ctx.fillStyle = ctx.strokeStyle = COL.sonickick; kickerShape(0);       // the figure
  const [fx, fy, rx, ry, fa] = KICKER.feet[0];
  ctx.globalAlpha = alpha; ctx.fillStyle = COL.sinGold;                // the sole that leads, glowing
  ctx.beginPath(); ctx.ellipse(fx + 0.6, fy - 0.4, rx * 0.7, ry * 0.6, fa, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
// Sonic Kick's shot: a teal comet with a gold core and a long fading tail.
function drawSonicShot(pr) {
  const t = pr.trail;
  ctx.lineCap = 'round';
  for (let k = 2; k < t.length; k += 2) {
    const f = k / t.length;
    ctx.globalAlpha = 0.5 * f; ctx.strokeStyle = COL.sonickick; ctx.lineWidth = 1 + f * 7;
    ctx.beginPath(); ctx.moveTo(t[k - 2], t[k - 1]); ctx.lineTo(t[k], t[k + 1]); ctx.stroke();
  }
  // v0.60 (Epic): it's breaking the sound barrier: a white vapour cone flaring back off it, and shock rings (flat
  // ellipses across its path) rolling back down its trail
  const a = Math.atan2(pr.vy, pr.vx), ca = Math.cos(a), sa = Math.sin(a), roll = reducedMotion ? 0 : (performance.now() / 1000 * 140) % 13;
  const cone = ctx.createLinearGradient(pr.x, pr.y, pr.x - ca * 30, pr.y - sa * 30);
  cone.addColorStop(0, 'rgba(255,255,255,0.5)'); cone.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = cone; ctx.beginPath();
  ctx.moveTo(pr.x + ca * pr.r, pr.y + sa * pr.r);
  ctx.quadraticCurveTo(pr.x - ca * 8 - sa * (pr.r + 10), pr.y - sa * 8 + ca * (pr.r + 10), pr.x - ca * 30 - sa * (pr.r + 15), pr.y - sa * 30 + ca * (pr.r + 15));
  ctx.lineTo(pr.x - ca * 30 + sa * (pr.r + 15), pr.y - sa * 30 - ca * (pr.r + 15));
  ctx.quadraticCurveTo(pr.x - ca * 8 + sa * (pr.r + 10), pr.y - sa * 8 - ca * (pr.r + 10), pr.x + ca * pr.r, pr.y + sa * pr.r);
  ctx.fill();
  ctx.strokeStyle = COL.sinTealHi;
  for (let j = 0; j < 3; j++) {
    const d = 9 + j * 13 + roll, k = 1 - d / 50;
    if (k <= 0) continue;
    ctx.globalAlpha = 0.7 * k; ctx.lineWidth = 1.6 * k + 0.4;
    ctx.beginPath(); ctx.ellipse(pr.x - ca * d, pr.y - sa * d, 2.2 + d * 0.06, pr.r + 4 + d * 0.32, a, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 0.45; ctx.fillStyle = COL.sonickick; circle(pr.x, pr.y, pr.r + 5);
  ctx.globalAlpha = 1; ctx.fillStyle = COL.sinTealHi; circle(pr.x, pr.y, pr.r + 1);
  ctx.fillStyle = COL.sinGold; circle(pr.x, pr.y, pr.r * 0.6);
}
// Under everything else of SINS: Tempest Slam's ground, split and smouldering red while it slows.
function crackPath(z, c, frac = 1) {
  const n = Math.max(1, Math.ceil(c.length * frac));
  ctx.beginPath(); ctx.moveTo(z.x, z.y);
  for (let k = 0; k < n; k++) ctx.lineTo(z.x + c[k][0], z.y + c[k][1]);
}
function drawSinZones() {
  const t = performance.now() / 1000;
  for (const f of game.sinfx) {                                        // Dragon Kick's scorch (v0.65): burnt ground, its embers dying
    if (f.kind !== 'dkscorch') continue;
    const k = f.life / f.max, rnd = mulberry32(f.seed | 0), SQ = DK3D.floor;
    ctx.globalAlpha = 0.5 * Math.min(1, k * 2.5); ctx.fillStyle = COL.dragonDark; ellipse(f.x, f.y, f.r, f.r * SQ);
    ctx.globalAlpha = 0.45 * Math.min(1, k * 2.5); ctx.fillStyle = '#000'; ellipse(f.x, f.y, f.r * 0.7, f.r * 0.7 * SQ);
    fxGlow(f.x, f.y, f.r * 1.2, COL.dragonkick, 0.45 * k * k);
    fxAdd(COL.dragonFire);
    for (let j = 0; j < 9; j++) {                                      // embers in it, flickering out
      const a = rnd() * TAU, d = f.r * (0.3 + 0.65 * rnd()), fl = reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t * 14 + j * 2.1);
      ctx.globalAlpha = k * fl; ctx.fillStyle = j % 3 ? COL.dragonkick : COL.dragonFire;
      ctx.fillRect(f.x + Math.cos(a) * d - 1, f.y + Math.sin(a) * d * SQ - 1, 2, 2);
    }
    fxNormal();
  }
  for (const z of game.zones) {
    const fade = Math.min(1, z.life / 0.6), glow = reducedMotion ? 0.6 : 0.5 + 0.3 * Math.sin(t * 5 + z.x), R = z.vr ?? z.r;
    ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = COL.tempestDark; circle(z.x, z.y, R);
    fxGlow(z.x, z.y, R * 0.9, COL.tempest, 0.22 * glow * fade);        // the ground, still hot
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(z.x, z.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of z.cracks) {                                        // the fissures: a red glow round a hot core
      ctx.globalAlpha = 0.35 * glow * fade; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 5; crackPath(z, c); ctx.stroke();
      ctx.globalAlpha = 0.9 * glow * fade; ctx.strokeStyle = COL.tempestHi; ctx.lineWidth = 1.4; crackPath(z, c); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
// Over the enemies: marks, astral kicks, the slam's flash, Dragon Kick's arc and flashes.
function drawSins() {
  const now = performance.now() / 1000;
  for (const e of game.enemies) {                                      // Sonic Kick's mark: a ring and a teal sign above
    if (!(e.smark > 0)) continue;
    const a = Math.min(1, e.smark / 0.4), y = e.y - e.r - 14 + (reducedMotion ? 0 : Math.sin(now * 6) * 1.5);
    ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = COL.sonickick; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, now * 2, now * 2 + 4.6); ctx.stroke();
    ctx.fillStyle = COL.sonickick;
    ctx.beginPath(); ctx.moveTo(e.x, y - 8); ctx.quadraticCurveTo(e.x + 7, y, e.x, y + 6); ctx.quadraticCurveTo(e.x - 7, y, e.x, y - 8); ctx.fill();
    ctx.fillStyle = COL.sinGold; circle(e.x, y + 0.5, 1.8);
    ctx.globalAlpha = 1;
  }
  for (const e of game.enemies) {                                      // Dragon Kick: the streak behind a kicked enemy
    const tr = e.fling?.trail;
    if (!tr || tr.length < 2) continue;
    ctx.lineCap = 'round';
    fxGlow(e.x, e.y, e.r * 3.2, COL.dragonkick, 0.8);                // (v0.55: bigger, glowing)
    fxAdd(COL.dragonkick);
    for (let k = 1; k < tr.length; k++) {
      const a = k / tr.length, x2 = k === tr.length - 1 ? e.x : tr[k].x, y2 = k === tr.length - 1 ? e.y : tr[k].y;
      ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = COL.dragonkick; ctx.lineWidth = e.r * 2.2 * a;
      ctx.beginPath(); ctx.moveTo(tr[k - 1].x, tr[k - 1].y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = COL.sinGold; ctx.lineWidth = e.r * 0.8 * a;
      ctx.beginPath(); ctx.moveTo(tr[k - 1].x, tr[k - 1].y); ctx.lineTo(x2, y2); ctx.stroke();
    }
    fxNormal(); ctx.globalAlpha = 1;
    // v0.60 (Epic): the dragon carries it: its body coils back down the trail, its head ahead, the enemy in its jaws.
    // v0.65 (user: "more 3d"): the body is lit and arches up off the floor behind the head, over its own shadow
    const fv = e.fling, now2 = reducedMotion ? 0 : performance.now() / 1000, hd = Math.atan2(fv.vy, fv.vx), px = -Math.sin(hd), py = Math.cos(hd);
    const body = [], n = (tr.length - 1) * 2, ha = Math.min(1, fv.t / 0.12);
    for (let k = 1; k <= n; k++) {                                    // along the trail, two segments per step
      const t = k / n, i = t * (tr.length - 1), i0 = Math.floor(i), i1 = Math.min(tr.length - 1, i0 + 1), u = i - i0;
      const gx = k === n ? e.x : tr[i0].x + (tr[i1].x - tr[i0].x) * u, gy = k === n ? e.y : tr[i0].y + (tr[i1].y - tr[i0].y) * u;
      const wig = Math.sin(now2 * 22 + t * 9) * e.r * 0.5 * t * (1 - t) * 2;
      body.push({ x: gx + px * wig, y: gy + py * wig, z: e.r * 1.1 * Math.sin(Math.PI * t) * (0.6 + 0.4 * t), r: e.r * (0.28 + 0.5 * t), a: 0.9 * Math.min(1, t * 2.5) * ha });
    }
    dragonBody(body, hd);
    dragonHead(e.x + Math.cos(hd) * e.r * 0.4, e.y + Math.sin(hd) * e.r * 0.4, hd, e.r * 1.25 + 6, ha);
  }
  for (const k of game.kicks) {                                       // (flying left it's flipped, not turned upside down: user)
    const flip = Math.cos(k.a) < 0 ? -1.6 : 1.6;
    for (const [back, al] of [[0.42, 0.14], [0.28, 0.24], [0.14, 0.36]]) {   // v0.60: afterimages, fading back the way it came
      const x = k.x - (k.x - k.x0) * back, y = k.y - (k.y - k.y0) * back;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k.a); ctx.scale(1.6, flip); astralKicker(al); ctx.restore();
    }
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.a); ctx.scale(1.6, flip); astralKicker(0.9); ctx.restore();
  }
  for (const f of game.sinfx) {
    const q = 1 - f.life / f.max;
    if (f.kind === 'slam') {                                           // the strike: a red bolt down, the flash, fissures racing out
      // v0.55 (user: it hits further than it looked): all of it reaches the slam's real edge, `f.r`. The ground under
      // it flashes red, a shockwave rolls out to the edge, the cracks shoot out behind it.
      const R = f.r, wave = 1 - (1 - Math.min(1, q / 0.4)) ** 3;        // the wave front, easing out to the edge
      fxGlow(f.x, f.y, R * 1.25, COL.tempest, 0.75 * (1 - q) ** 1.5);
      if (q < 0.55) {                                                   // the shockwave: a bright band, the ground lit inside it
        const k = 1 - q / 0.55, wr = Math.max(4, R * wave);
        ctx.globalAlpha = 0.22 * k; ctx.fillStyle = COL.tempest; circle(f.x, f.y, wr);
        fxAdd(COL.tempest);
        ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 4 + 16 * k;
        ctx.beginPath(); ctx.arc(f.x, f.y, wr, 0, TAU); ctx.stroke();
        ctx.globalAlpha = k; ctx.strokeStyle = COL.tempestHi; ctx.lineWidth = 1.5 + 4 * k;
        ctx.beginPath(); ctx.arc(f.x, f.y, wr, 0, TAU); ctx.stroke();
        fxNormal();
      }
      if (q < 0.45) {                                                   // the strike from above, taller and wider
        const k = 1 - q / 0.45, w = 30 * k, hgt = 150;
        const gr = ctx.createLinearGradient(0, f.y - hgt, 0, f.y);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, COL.tempest);
        fxAdd(COL.tempest);
        ctx.globalAlpha = 0.9 * k; ctx.fillStyle = gr; ctx.fillRect(f.x - w / 2, f.y - hgt, w, hgt);
        ctx.fillStyle = COL.tempestHi; ctx.fillRect(f.x - w / 6, f.y - hgt, w / 3, hgt);
        fxNormal();
      }
      if (q < 0.7) {                                                    // v0.60: the tempest: wind whirling out with the wave
        const k = 1 - q / 0.7;
        ctx.lineCap = 'round';
        for (let j = 0; j < 5; j++) {
          const r = R * (0.35 + 0.7 * wave) * (0.8 + 0.08 * j), a0 = f.seed + j * TAU / 5 + q * 4.5;
          ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = j % 2 ? COL.tempestHi : '#ffffff'; ctx.lineWidth = 1 + 3 * k;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, a0, a0 + 0.9 + 0.5 * k); ctx.stroke();
        }
      }
      fxAdd(COL.tempest); ctx.globalAlpha = 1 - q; ctx.fillStyle = COL.tempest;
      starPath(f.x, f.y, 12 + q * 16, 34 + q * R * 0.45, 9, f.seed); ctx.fill();
      ctx.fillStyle = COL.tempestHi; circle(f.x, f.y, 18 * (1 - q) + 3);
      fxNormal();
      ctx.fillStyle = '#ffffff'; circle(f.x, f.y, 9 * (1 - q) + 1);
      const grow = Math.min(1, wave * 1.05);                            // the cracks shoot out with the wave
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const c of f.cracks) {
        ctx.globalAlpha = 0.9; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 8 * (1 - q * 0.5); crackPath(f, c, grow); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4 * (1 - q * 0.4); crackPath(f, c, grow); ctx.stroke();
      }
    } else if (f.kind === 'sboom') {                                   // Sonic Kick's sonic boom (v0.60): a white vapour disc
      // across the way it flew, two rings going out, and speed lines thrown out round it
      const e = 1 - (1 - q) ** 3, fade = 1 - q, R = f.r * (0.4 + 0.75 * e), ca = Math.cos(f.a), sa = Math.sin(f.a);
      const disc = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      disc.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`); disc.addColorStop(0.7, `rgba(255,255,255,${0.2 * fade})`); disc.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = disc; ctx.beginPath(); ctx.ellipse(f.x - ca * R * 0.15, f.y - sa * R * 0.15, R * 0.32, R, f.a, 0, TAU); ctx.fill();
      fxAdd(COL.sonickick);
      ctx.strokeStyle = COL.sonickick; ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 1 + 4 * fade;
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.7 * fade; ctx.lineWidth = 1 + 1.5 * fade;
      ctx.beginPath(); ctx.arc(f.x, f.y, R * 1.18, 0, TAU); ctx.stroke();
      ctx.strokeStyle = COL.sinTealHi; ctx.lineCap = 'round';
      for (let k = 0; k < 12; k++) {
        const b = k * TAU / 12 + f.a, r0 = R * (0.5 + 0.5 * e), r1 = r0 + 10 + 16 * fade;
        ctx.globalAlpha = 0.8 * fade; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(f.x + Math.cos(b) * r0, f.y + Math.sin(b) * r0); ctx.lineTo(f.x + Math.cos(b) * r1, f.y + Math.sin(b) * r1); ctx.stroke();
      }
      fxNormal();
    } else if (f.kind === 'hexwave') {                                 // Iron Will bursting (v0.60): a hexagon of light going out
      const e = 1 - (1 - q) ** 2, fade = 1 - q, R = f.r * (0.3 + 0.75 * e);
      fxGlow(f.x, f.y, R, COL.ironwill, 0.6 * fade);
      fxAdd(COL.ironwill);
      ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = COL.ironwill; ctx.lineWidth = 2 + 6 * fade; hexPath(f.x, f.y, R, q * 0.8); ctx.stroke();
      ctx.strokeStyle = COL.sinGold; ctx.lineWidth = 1 + 2 * fade; hexPath(f.x, f.y, R * 0.82, -q * 0.6); ctx.stroke();
      fxNormal();
    } else if (f.kind === 'tbolt') {                                   // Tempest Slam's lightning (v0.60): a red bolt down from
      // the sky, branching, white-hot down its middle, a flash and a scorch where it lands
      const fade = 1 - q, flick = q < 0.5 && Math.floor(q * 20) % 3 === 2 ? 0.35 : 1, rnd = mulberry32(f.seed), top = f.y - 190;
      fxGlow(f.x, f.y, f.r * 2.2, COL.tempest, 0.9 * fade);
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = COL.tempestDark; ellipse(f.x, f.y, f.r * 0.8, f.r * 0.32);
      if (q < 0.6) {
        fxAdd(COL.tempest); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const pts = [[f.x + (rnd() - 0.5) * 40, top]];
        for (let k = 1; k <= 8; k++) pts.push([f.x + (rnd() - 0.5) * 26 * (1 - k / 8), top + (f.y - top) * k / 8]);
        pts[8] = [f.x, f.y];
        const line = (w, c, al) => { ctx.globalAlpha = al * fade * flick; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke(); };
        line(9, COL.tempest, 0.45); line(3.5, COL.tempestHi, 0.9); line(1.4, '#ffffff', 1);
        for (let k = 2; k < 7; k += 2) {                                 // branches off it
          const [bx, by] = pts[k], dir = rnd() < 0.5 ? -1 : 1;
          ctx.globalAlpha = 0.8 * fade * flick; ctx.strokeStyle = COL.tempestHi; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir * (10 + rnd() * 14), by + 10 + rnd() * 10); ctx.lineTo(bx + dir * (18 + rnd() * 16), by + 24 + rnd() * 12); ctx.stroke();
        }
        fxNormal();
      }
      ctx.globalAlpha = fade; ctx.fillStyle = '#ffffff'; circle(f.x, f.y, 7 * fade + 1);
    } else if (f.kind === 'rock') {                                    // a chunk of the ground, its shadow under it
      const fade = Math.min(1, f.life / 0.3);
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#000000'; ellipse(f.x, f.y + 1, f.size * 1.1, f.size * 0.5);
      ctx.globalAlpha = fade; ctx.save(); ctx.translate(f.x, f.y - f.z); ctx.rotate(f.spin);
      ctx.fillStyle = f.col || COL.rock; ctx.fillRect(-f.size, -f.size, f.size * 2, f.size * 2);   // (`col`/`edge`: BLACK FLASH!'s shards)
      ctx.strokeStyle = f.edge || COL.tempest; ctx.lineWidth = 1; ctx.strokeRect(-f.size, -f.size, f.size * 2, f.size * 2);
      ctx.restore();
    } else if (f.kind === 'kick') {                                    // an orange arc swung round toward the target
      // a wide crescent (user's sample): thick at its leading edge, thinning to a wisp behind, a gold band inside.
      // v0.55 (user: bigger, it reaches further than it looked): out to the kick's full reach, about twice as thick,
      // swung further round, glowing and adding up as light, with a white-hot leading edge and a wisp outside it
      const out = Math.sin(Math.min(1, q * 1.6) * Math.PI / 2), sweep = 3.3, end = f.a + 0.55, start = end - sweep * out;
      const R = Math.max(PLAYER.r + 30, (f.range ?? f.reach) * 0.8, f.reach * 0.95), w = 38 * (1 - q * 0.45), steps = 22;
      const band = (r0, r1, from, col, a) => {                       // a crescent from `from` to `end`, widening toward `end`
        ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath();
        for (let k = 0; k <= steps; k++) { const t = k / steps, ang = from + (end - from) * t; ctx.lineTo(f.x + Math.cos(ang) * (R + r1 * t), f.y + Math.sin(ang) * (R + r1 * t)); }
        for (let k = steps; k >= 0; k--) { const t = k / steps, ang = from + (end - from) * t; ctx.lineTo(f.x + Math.cos(ang) * (R - r0 * t), f.y + Math.sin(ang) * (R - r0 * t)); }
        ctx.closePath(); ctx.fill();
      };
      const fade = 1 - q * 0.85, lead = R + w * 0.3;
      fxGlow(f.x + Math.cos(end) * lead, f.y + Math.sin(end) * lead, w * 2.4, COL.dragonkick, 0.9 * fade);
      fxAdd(COL.dragonkick);                                           // (v0.65: fainter, the dragon's motion blur now)
      band(w * 0.2, w * 1.45, start + (end - start) * 0.2, COL.dragonkick, 0.2 * fade);   // the wisp outside
      band(w * 0.5, w, start, COL.dragonkick, 0.45 * fade);
      band(w * 0.15, w * 0.5, start + (end - start) * 0.3, COL.sinGold, 0.45 * fade);
      band(0, w * 0.16, start + (end - start) * 0.6, '#ffffff', 0.5 * fade);              // its white-hot edge
      fxNormal();
      // v0.60 (Epic): the arc is a fire dragon, its head at the front, jaws open, breathing fire. v0.65 (user: "more
      // 3d"): a lit body swooping up off the floor round the arc (highest in the middle) and down onto the target, over
      // its own shadow; it burns away from the tail as it fades
      const body = [], n = 40;
      for (let k = 0; k <= n; k++) {
        const t = k / n, ang = start + (end - start) * t, rr = R + w * 0.3 * t;
        body.push({ x: f.x + Math.cos(ang) * rr, y: f.y + Math.sin(ang) * rr, z: DK3D.lift * (0.85 * Math.sin(Math.PI * t) + 0.15 * (1 - t)) * (1 - 0.4 * q),
                    r: w * (0.08 + 0.24 * t ** 0.6), a: fade * Math.max(0, Math.min(1, (t + 0.25 - q * 1.15) * 4)) });
      }
      const h1 = body[n], h0 = body[n - 3];
      dragonBody(body, end + Math.PI / 2);
      dragonHead(h1.x, h1.y - h1.z, Math.atan2((h1.y - h1.z) - (h0.y - h0.z), h1.x - h0.x), 0.6 * w + 8, fade);
    } else if (f.kind === 'amhit') { drawArcaneHit(f, q);            // where an Arcane Missile hits (v0.66, draw.js)
    } else if (f.kind === 'pop') {                                     // any hit's flash (combat.js fxPop)
      // v0.57 (user: prettier than flat; a spiky star before): a soft glow, a shock ring that spreads and thins, sharp
      // streaks thrown out (most of them the way the shot was going), each white-hot at its root, and a white core
      // that blooms and shrinks. A crit's has more streaks and a second, gold ring.
      const e = 1 - (1 - q) ** 3, c = f.color, s = f.size, fade = 1 - q, rnd = mulberry32(f.seed | 0);
      fxGlow(f.x, f.y, s * 2.4, c, 0.75 * fade);
      fxAdd(c);
      ctx.strokeStyle = c; ctx.globalAlpha = 0.85 * fade; ctx.lineWidth = 0.6 + 2.4 * fade;
      ctx.beginPath(); ctx.arc(f.x, f.y, s * (0.3 + 0.85 * e), 0, TAU); ctx.stroke();
      if (f.crit) { ctx.strokeStyle = COL.wheelHi; ctx.globalAlpha = 0.7 * fade; ctx.lineWidth = 1 + 1.5 * fade; ctx.beginPath(); ctx.arc(f.x, f.y, s * (0.5 + 1.15 * e), 0, TAU); ctx.stroke(); }
      const n = f.crit ? 8 : 5;
      for (let k = 0; k < n; k++) {
        const a = f.dir != null ? f.dir + (k === n - 1 ? Math.PI + (rnd() - 0.5) : (rnd() - 0.5) * 2.4) : f.rot + k * TAU / n + rnd() * 0.6;
        const len = s * (0.45 + rnd() * 0.75), d0 = s * 0.12 + len * 0.45 * e, d1 = d0 + len * (1 - 0.55 * q), w = (1.6 + rnd() * 2) * (f.crit ? 1.3 : 1) * (0.4 + 0.6 * fade);
        const ca = Math.cos(a), sa = Math.sin(a), mx = d0 + (d1 - d0) * 0.3;
        ctx.fillStyle = c; ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.moveTo(f.x + ca * d0, f.y + sa * d0);
        ctx.lineTo(f.x + ca * mx - sa * w, f.y + sa * mx + ca * w); ctx.lineTo(f.x + ca * d1, f.y + sa * d1);
        ctx.lineTo(f.x + ca * mx + sa * w, f.y + sa * mx - ca * w); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = COL.player; ctx.globalAlpha = 0.8 * fade; ctx.lineWidth = Math.max(0.6, w * 0.6);
        ctx.beginPath(); ctx.moveTo(f.x + ca * d0, f.y + sa * d0); ctx.lineTo(f.x + ca * (d0 + (d1 - d0) * 0.45), f.y + sa * (d0 + (d1 - d0) * 0.45)); ctx.stroke();
      }
      ctx.fillStyle = COL.player; ctx.globalAlpha = fade;
      circle(f.x, f.y, s * (0.22 + 0.14 * Math.sin(Math.min(1, q * 3) * Math.PI)) * (1 - e * 0.8) + 0.6);
      fxNormal();
    } else if (f.kind === 'splash') {                                  // a water hit (Powerwash, v0.55): a crown of drops
      // thrown out round a ring of water that spreads and thins, a soft mist behind, and a white burst of foam
      const e = 1 - (1 - q) ** 2.5, c = f.color, s = f.size, fade = 1 - q;
      fxGlow(f.x, f.y, s * 2, c, 0.5 * fade);
      fxAdd(c);
      ctx.globalAlpha = 0.75 * fade; ctx.strokeStyle = c; ctx.lineWidth = 0.8 + 3.5 * fade;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, s * (0.35 + 0.95 * e), s * (0.3 + 0.8 * e), f.rot, 0, TAU); ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = f.rot + k * TAU / 8 + Math.sin(k * 2.7 + f.rot) * 0.35, d = s * (0.25 + (1 + 0.35 * Math.sin(k * 5.1)) * e);
        ctx.save(); ctx.translate(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d); ctx.rotate(a);
        ctx.globalAlpha = 0.9 * fade; ctx.fillStyle = k % 2 ? c : COL.player;
        ctx.beginPath(); ctx.ellipse(0, 0, 1.4 + 3.4 * fade, 0.9 + 1.5 * fade, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 0.7 * fade * fade; ctx.fillStyle = COL.player; circle(f.x, f.y, s * 0.4 * (1 - e) + 1);
      fxNormal();
    } else if (f.kind === 'dkboom') {                                  // Dragon Kick's impact (v0.65, user: "the impact effect")
      // seen at an angle like the rest of the 3D: a shock ring racing out across the floor (squashed), flames licking up
      // round it (most of them the way the kick went), and a lit fireball swelling up off the ground, rising as it cools
      // to smoke. The flames behind it are drawn before it, the ones in front after.
      const sc = f.s || 1, e = 1 - (1 - q) ** 3, fade = 1 - q, rnd = mulberry32(f.seed | 0), SQ = DK3D.floor;
      if (q < 0.7) {
        const k = 1 - q / 0.7, R = (12 + SINS.kick.boom.ring * e) * sc;
        fxAdd(COL.dragonkick);
        ctx.globalAlpha = 0.22 * k; ctx.fillStyle = COL.dragonkick; ellipse(f.x, f.y, R, R * SQ);
        ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = COL.dragonkick; ctx.lineWidth = (2 + 9 * k) * sc;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * SQ, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = DK3D.hot; ctx.lineWidth = (1 + 3 * k) * sc;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, R * 0.95, R * 0.95 * SQ, 0, 0, TAU); ctx.stroke();
        fxNormal();
      }
      const flames = [];
      for (let k = 0; k < 10; k++) {
        const b = k < 7 ? f.a + (rnd() - 0.5) * 2.4 : f.a + Math.PI + (rnd() - 0.5) * 2, d = (6 + 34 * e * (0.6 + 0.5 * rnd())) * sc;
        const rise = q < 0.12 ? q / 0.12 : Math.max(0, 1 - (q - 0.12) / 0.6);
        flames.push({ x: f.x + Math.cos(b) * d, y: f.y + Math.sin(b) * d * SQ, b, h: (16 + 22 * rnd()) * sc * rise, w: (3 + 3 * rnd()) * sc });
      }
      const flame = (fl) => {                                          // a tongue of fire: its root on the floor, its tip up and out
        if (fl.h < 1) return;
        const tx = fl.x + Math.cos(fl.b) * fl.h * 0.35, ty = fl.y - fl.h, g = ctx.createLinearGradient(fl.x, fl.y, tx, ty);
        g.addColorStop(0, DK3D.hot); g.addColorStop(0.35, COL.dragonFire); g.addColorStop(0.75, COL.dragonkick); g.addColorStop(1, hexA(COL.dragonkick, 0));
        fxAdd(COL.dragonFire); ctx.globalAlpha = 0.75 * fade; ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(fl.x - fl.w, fl.y); ctx.quadraticCurveTo(fl.x - fl.w * 0.6, fl.y - fl.h * 0.55, tx, ty);
        ctx.quadraticCurveTo(fl.x + fl.w * 0.9, fl.y - fl.h * 0.45, fl.x + fl.w, fl.y); ctx.closePath(); ctx.fill(); fxNormal();
      };
      flames.filter(fl => fl.y < f.y).forEach(flame);
      const fr = (6 + 19 * Math.min(1, q * 3.2)) * sc * (1 - 0.2 * q), z = 26 * sc * e;
      ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = '#000'; ellipse(f.x, f.y + 2, fr * 1.1, fr * 1.1 * SQ);   // its shadow
      fxGlow(f.x, f.y - z, fr * 2.4, COL.dragonkick, 0.5 * fade);
      firePuff(f.x, f.y - z - fr * 0.25, fr, Math.max(0, (q - 0.3) / 0.7), 0.95 * (1 - q * 0.5));
      flames.filter(fl => fl.y >= f.y).forEach(flame);
    } else if (f.kind === 'flash') {                                   // the yellow hit flash (user: "a hit indicator")
      const c = f.teal ? COL.sinTealHi : COL.sinGold, z = f.big ? 2 : 1;   // `big`: Dragon Kick's (v0.55)
      if (f.big) fxGlow(f.x, f.y, 70, COL.dragonkick, 0.9 * (1 - q));
      fxAdd(c); ctx.globalAlpha = 1 - q; ctx.fillStyle = c;
      starPath(f.x, f.y, (6 + q * 8) * z, (16 + q * 18) * z, f.big ? 9 : 7, q * 0.6); ctx.fill();
      fxNormal();
      ctx.fillStyle = '#ffffff'; circle(f.x, f.y, (5 * (1 - q) + 1) * z);
    }
    ctx.globalAlpha = 1;
  }
}
function hexPath(x, y, r, rot = 0) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) { const a = rot + k * TAU / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
// Iron Will on you (v0.60, Epic: a teal ring with a gold glow before): a dome of teal hexagon plates, lit like a glass
// bubble from the top left, a gold rim turning round it. Each hit knocks out a third of the plates (they fly off as
// shards); a hit flashes the rest white. It snaps up from small when it's cast, and fades in its last half second.
function drawSinGuard(p) {
  const g = game.sguard;
  if (!g) return;
  const G = SINS.guard, fade = Math.min(1, g.t / 0.5), grow = Math.min(1, ((g.t0 ?? G.time) - g.t) / 0.18), spin = reducedMotion ? 0 : performance.now() / 1000;
  const R = (PLAYER.r + 13) * (0.55 + 0.45 * (1 - (1 - grow) ** 3)), hs = R * 0.21, flash = g.hit > 0;
  fxGlow(p.x, p.y, R * 1.7, COL.ironwill, 0.4 * fade);
  ctx.globalAlpha = (0.16 + (flash ? 0.25 : 0)) * fade; ctx.fillStyle = COL.ironwill; circle(p.x, p.y, R);
  const plates = [[0, 0]];
  for (let k = 0; k < 6; k++) plates.push([R * 0.44, k * TAU / 6 + Math.PI / 6]);
  for (let k = 0; k < 12; k++) plates.push([R * 0.82, k * TAU / 12 + spin * 0.15]);
  plates.forEach(([d, a], i) => {
    if ((i * 7 + g.seed) % g.max >= g.hp) return;                   // knocked out
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.92, sz = hs * (1 - d / R * 0.25);
    ctx.globalAlpha = (flash ? 0.7 : 0.26) * fade; ctx.fillStyle = flash ? '#ffffff' : COL.ironwill; hexPath(x, y, sz * 0.92); ctx.fill();
    ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = COL.sinTealHi; ctx.lineWidth = 1.1; hexPath(x, y, sz * 0.92); ctx.stroke();
  });
  ctx.globalAlpha = fade; sphereShade(p.x, p.y, R, 0.55);
  ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = COL.sinGold; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = COL.ironwill;
  for (let k = 0; k < g.hp; k++) { const a = spin * 2 + k * TAU / g.max; ctx.beginPath(); ctx.arc(p.x, p.y, R + 4, a, a + TAU / g.max - 0.5); ctx.stroke(); }   // a pip per hit left
  ctx.globalAlpha = 1;
}
// Dragon Kick's dragon in 3D (v0.65, user: "more 3d"): `lift` px its body rises off the floor at most, the floor seen at
// an angle (`floor`: a circle on it is this flat), `hot` its white-hot light.
const DK3D = { lift: 30, floor: 0.45, hot: '#fff3c4', belly: '#ffd98a' };
// Its body, tail first: `segs` [{ x, y on the floor, z its height, r, a its alpha }]. Their shadow on the floor (one
// shape, so it doesn't darken where they overlap), a glow of fire off its back, then each segment lit like a sphere from
// the top left (white-hot highlight, gold, orange, a dark red edge), a pale belly plate under it, a ring of scale, and a
// spike along its back every third one. `a`: the way it's heading (the spikes lean back).
function dragonBody(segs, a) {
  const live = segs.filter(g => g.a > 0.02 && g.r > 0.5);
  if (!live.length) return;
  ctx.globalAlpha = 0.28 * Math.max(...live.map(g => g.a)); ctx.fillStyle = '#000'; ctx.beginPath();
  for (const g of live) { const rx = g.r * (1 + g.z / 60), ry = rx * DK3D.floor; ctx.moveTo(g.x + rx, g.y + 2); ctx.ellipse(g.x, g.y + 2, rx, ry, 0, 0, TAU); }
  ctx.fill();
  for (let i = 0; i < live.length; i += 3) fxGlow(live[i].x, live[i].y - live[i].z, live[i].r * 2.4, COL.dragonkick, 0.35 * live[i].a);
  const bx = -Math.cos(a), by = -Math.sin(a);
  live.forEach((g, i) => {
    const x = g.x, y = g.y - g.z, r = g.r;
    const sk = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r);
    sk.addColorStop(0, DK3D.hot); sk.addColorStop(0.3, COL.dragonFire); sk.addColorStop(0.65, COL.dragonkick); sk.addColorStop(1, COL.dragonDark);
    if (i % 3 === 1 && r > 2) {                                        // a spike along its back, leaning back
      ctx.globalAlpha = g.a; ctx.fillStyle = COL.dragonDark; ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y - r * 0.6); ctx.lineTo(x + bx * r * 0.7, y - r * 1.55 + by * r * 0.3); ctx.lineTo(x + r * 0.45, y - r * 0.6); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = g.a; ctx.fillStyle = sk; circle(x, y, r);
    ctx.globalAlpha = 0.75 * g.a; ctx.fillStyle = DK3D.belly; ctx.beginPath(); ctx.ellipse(x, y + r * 0.62, r * 0.6, r * 0.26, 0, 0, TAU); ctx.fill();
    if (r > 2.5 && i % 2) { ctx.globalAlpha = 0.5 * g.a; ctx.strokeStyle = COL.dragonDark; ctx.lineWidth = Math.max(0.8, r * 0.12); ctx.beginPath(); ctx.arc(x, y, r * 0.78, a + Math.PI * 0.6, a + Math.PI * 1.4); ctx.stroke(); }
  });
  ctx.globalAlpha = 1;
}
// Dragon Kick's dragon head (v0.60), facing `a`, about `s` px long: a snout and an open jaw breathing fire, horns and a
// spiky mane swept back, whiskers trailing, a gold eye. Orange scales over a dark edge, lit gold along the top.
function dragonHead(x, y, a, s, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
  const flip = Math.cos(a) < 0 ? -1 : 1;                                  // (kept upright: its top stays up when it faces left)
  ctx.scale(1, flip);
  ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  fxAdd(COL.dragonFire);                                                   // its fire, out of the open jaws
  const fire = ctx.createLinearGradient(0.6, 0, 1.9, 0);
  fire.addColorStop(0, COL.dragonFire); fire.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = fire; ctx.beginPath(); ctx.moveTo(0.55, 0.14); ctx.quadraticCurveTo(1.4, -0.25, 1.95, 0.05); ctx.quadraticCurveTo(1.4, 0.5, 0.55, 0.2); ctx.fill();
  fxNormal();
  ctx.lineWidth = 0.07; ctx.strokeStyle = COL.dragonFire;                   // whiskers
  ctx.beginPath(); ctx.moveTo(0.9, -0.05); ctx.quadraticCurveTo(0.2, -0.95, -1.1, -0.75); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.85, 0.28); ctx.quadraticCurveTo(0.1, 1.05, -1.2, 0.85); ctx.stroke();
  ctx.fillStyle = COL.dragonDark;                                          // the mane, swept back
  ctx.beginPath(); ctx.moveTo(-0.5, -0.5);
  for (let k = 0; k < 5; k++) { ctx.lineTo(-0.85 - k * 0.2, -0.75 + k * 0.28); ctx.lineTo(-0.7 - k * 0.18, -0.4 + k * 0.26); }
  ctx.lineTo(-0.5, 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.dragonFire; ctx.lineWidth = 0.1;                    // horns
  ctx.beginPath(); ctx.moveTo(-0.35, -0.5); ctx.quadraticCurveTo(-0.9, -0.85, -1.45, -0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.1, -0.55); ctx.quadraticCurveTo(-0.6, -1.05, -1.2, -1.05); ctx.stroke();
  const skin = ctx.createLinearGradient(0, -0.6, 0, 0.6);
  skin.addColorStop(0, COL.dragonFire); skin.addColorStop(0.5, COL.dragonkick); skin.addColorStop(1, COL.dragonDark);
  ctx.fillStyle = skin; ctx.strokeStyle = COL.dragonDark; ctx.lineWidth = 0.06;
  ctx.beginPath();                                                         // the head and upper jaw
  ctx.moveTo(-0.6, -0.45); ctx.quadraticCurveTo(-0.1, -0.68, 0.45, -0.42); ctx.quadraticCurveTo(0.95, -0.3, 1.18, -0.05);
  ctx.lineTo(1.05, 0.08); ctx.lineTo(0.35, 0.06); ctx.lineTo(-0.35, 0.18); ctx.quadraticCurveTo(-0.7, 0, -0.6, -0.45); ctx.fill(); ctx.stroke();
  ctx.beginPath();                                                         // the lower jaw, dropped open
  ctx.moveTo(-0.35, 0.22); ctx.lineTo(0.35, 0.24); ctx.lineTo(0.95, 0.42); ctx.quadraticCurveTo(0.4, 0.62, -0.45, 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';                                               // teeth
  for (let k = 0; k < 4; k++) { const tx = 0.15 + k * 0.22; ctx.beginPath(); ctx.moveTo(tx, 0.07); ctx.lineTo(tx + 0.05, 0.17); ctx.lineTo(tx + 0.1, 0.07); ctx.fill(); }
  // v0.65 (user: "more 3d"): lit like its body: a highlight on the skull, a rim of light along its top, a shadow under the jaw
  const hl = ctx.createRadialGradient(0.1, -0.42, 0.02, 0.1, -0.3, 0.5);
  hl.addColorStop(0, hexA(DK3D.hot, 0.85)); hl.addColorStop(1, hexA(DK3D.hot, 0));
  ctx.fillStyle = hl; ctx.beginPath(); ctx.ellipse(0.12, -0.32, 0.55, 0.26, -0.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = DK3D.hot; ctx.lineWidth = 0.05; ctx.globalAlpha = 0.8 * alpha;
  ctx.beginPath(); ctx.moveTo(-0.5, -0.5); ctx.quadraticCurveTo(-0.1, -0.68, 0.45, -0.42); ctx.quadraticCurveTo(0.95, -0.3, 1.15, -0.06); ctx.stroke();
  ctx.globalAlpha = 0.35 * alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0.25, 0.5, 0.6, 0.1, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = alpha;
  fxGlow(0.2, -0.3, 0.3, COL.sinGold, 0.9 * alpha);                      // the eye, glowing
  ctx.fillStyle = COL.sinGold; ctx.beginPath(); ctx.ellipse(0.2, -0.3, 0.12, 0.07, -0.2, 0, TAU); ctx.fill();   // the eye
  ctx.fillStyle = COL.dragonDark; ctx.beginPath(); ctx.ellipse(0.23, -0.3, 0.03, 0.06, 0, 0, TAU); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}
