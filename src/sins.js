/* sins.js — The SINS pack (v0.53, user): four Triple S weapons, 2 of each, no combos. */
'use strict';

/* ============================================================
   Sonic Kick (ranged)  a sonic shot (teal, a gold core) that marks what it hits; a moment later a flying kick from
                        the astral plane, in the same colours, darts from you into the mark (user's sheet)
   Iron Will (melee)    a teal and gold shield round you that soaks up the next `absorb` damage, for `time` s. It's
                        cast on its turn whatever is close (`self`)
   Tempest Slam (melee) slams the ground: a gold flash, then an orange shockwave; everything within `radius` is hit and
                        thrown out, and the cracked ground (`zone`) slows enemies for a while
   Dragon Kick (melee)  one very heavy kick: an orange arc swung round, a yellow flash where it lands
   Every number is a placeholder.
   ============================================================ */
const SINS = {
  sonic: { mark: 3, delay: 0.32, fly: 0.2, kick: 28, knock: 260 },
  guard: { absorb: 40, time: 4 },
  slam: { radius: 96, flash: 0.45, zone: { life: 2.5, chill: 0.3 } },
  kick: { life: 0.3, flash: 0.3 },
};

// Iron Will: the shield (per player: game.sguard, co-op PKEYS).
function sinGuard(card) {
  const G = SINS.guard, p = game.player;
  game.sguard = { hp: G.absorb, max: G.absorb, t: G.time, hit: 0 };
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 26, life: 0.35, color: COL.ironwill });
  SFX.sin('guard');
}
// combat.js hurtPlayer: what's left of a hit after the shield has taken its share.
function sinAbsorb(raw) {
  const g = game.sguard;
  if (!g || g.hp <= 0) return raw;
  const took = Math.min(g.hp, raw);
  g.hp -= took; g.hit = 0.2;
  const p = game.player;
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: `-${Math.round(took)}`, color: COL.ironwill, life: 0.5, vy: -40, big: false });
  if (g.hp <= 0) {                                         // broken
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r + 8, max: PLAYER.r + 40, life: 0.35, color: COL.sinGold });
    burst(p.x, p.y, COL.ironwill, 14, 200);
    game.sguard = null;
    SFX.sin('break');
  }
  return raw - took;
}

// Tempest Slam: everything within the radius is hit and thrown out; the ground stays cracked and slows.
function sinSlam(card) {
  const S = SINS.slam, p = game.player, spec = CARDS[card], dmg = damageOf(spec.dmg), knock = knockOf(spec.knock);
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > S.radius) continue;
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    hitEnemy({ card, look: 'melee', dmg, knock, vx: dx / d, vy: dy / d, x: q.x, y: q.y }, e);
  }
  // Its look (user: red, and its own): a red strike crashes down, the ground splits in glowing fissures that race out to
  // the edge, chunks of rock are thrown up and fall back, and the cracks go on smouldering (the slowing zone).
  const cracks = fissures(S.radius), now = { x: p.x, y: p.y };
  game.sinfx.push({ kind: 'slam', ...now, r: S.radius, cracks, life: S.flash, max: S.flash, seed: Math.random() * 1e6 });
  game.zones.push({ ...now, r: S.radius, cracks, life: S.zone.life, max: S.zone.life, card });
  for (let k = 0; k < 12; k++) {
    const a = Math.random() * TAU, v = 60 + Math.random() * 120;
    game.sinfx.push({ kind: 'rock', x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: 0, vz: 150 + Math.random() * 130,
      size: 2.5 + Math.random() * 3, spin: Math.random() * TAU, life: 0.9, max: 0.9, fixed: true });
  }
  game.rings.push({ x: p.x, y: p.y, r: 8, max: S.radius, life: 0.35, color: COL.tempest });
  game.rings.push({ x: p.x, y: p.y, r: 4, max: S.radius * 0.6, life: 0.25, color: COL.tempestHi });
  game.shake = Math.max(game.shake, 0.28);
  SFX.sin('slam');
}

// Tempest Slam's fissures: jagged lines from the middle out to about the edge, a few with a fork.
function fissures(R) {
  const out = [], n = 7, a0 = Math.random() * TAU;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * TAU / n + (Math.random() - 0.5) * 0.5, len = R * (0.75 + Math.random() * 0.3), pts = [];
    for (let d = 6; d <= len; d += 10) { const j = (Math.random() - 0.5) * 8; pts.push([Math.cos(a) * d - Math.sin(a) * j, Math.sin(a) * d + Math.cos(a) * j]); }
    out.push(pts);
    if (Math.random() < 0.5 && pts.length > 4) {                       // a fork off its middle
      const m = pts[Math.floor(pts.length / 2)], b = a + (Math.random() < 0.5 ? -0.7 : 0.7), fork = [m];
      for (let d = 10; d <= len * 0.4; d += 10) fork.push([m[0] + Math.cos(b) * d, m[1] + Math.sin(b) * d]);
      out.push(fork);
    }
  }
  return out;
}

// Dragon Kick: one heavy kick at `e`.
function sinKick(card, e) {
  const K = SINS.kick, p = game.player, spec = CARDS[card], q = hitPoint(e, p.x, p.y), a = Math.atan2(q.y - p.y, q.x - p.x);
  hitEnemy({ card, look: 'melee', dmg: damageOf(spec.dmg), knock: knockOf(spec.knock), vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
  game.sinfx.push(pinTo({ kind: 'kick', x: p.x, y: p.y, a, reach: Math.hypot(q.x - p.x, q.y - p.y), life: K.life, max: K.life }));
  game.sinfx.push({ kind: 'flash', x: q.x, y: q.y, life: K.flash, max: K.flash, fixed: true });
  game.shake = Math.max(game.shake, 0.2);
  SFX.sin('kick');
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
    game.kicks.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, target: e, t: 0, card: pr.card, owner: ownerId(), a: Math.atan2(e.y - p.y, e.x - p.x) });
    SFX.sin('fly');
  });
}

// Each frame (combat.js update): the astral kicks fly, marks wear off, cracked ground slows, effects fade.
function updateSins(dt) {
  const S = SINS.sonic;
  for (let i = game.kicks.length - 1; i >= 0; i--) {
    const k = game.kicks[i], e = k.target;
    usePlayerId(k.owner);
    if (!e || !game.enemies.includes(e) || e.dead) { game.kicks.splice(i, 1); continue; }
    k.t += dt;
    const q = hitPoint(e, k.x0, k.y0), f = Math.min(1, k.t / S.fly), ease = f * f;
    k.x = k.x0 + (q.x - k.x0) * ease; k.y = k.y0 + (q.y - k.y0) * ease; k.a = Math.atan2(q.y - k.y0, q.x - k.x0);
    if (f < 1) continue;
    game.kicks.splice(i, 1);
    e.smark = 0;
    hitEnemy({ card: k.card, look: 'melee', dmg: damageOf(S.kick), knock: knockOf(S.knock), vx: Math.cos(k.a), vy: Math.sin(k.a), x: q.x, y: q.y }, e);
    game.sinfx.push({ kind: 'flash', x: q.x, y: q.y, life: 0.25, max: 0.25, fixed: true, teal: true });
    game.rings.push({ x: q.x, y: q.y, r: 6, max: 46, life: 0.3, color: COL.sonickick });
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
  for (const z of game.zones) {
    const fade = Math.min(1, z.life / 0.6), glow = reducedMotion ? 0.6 : 0.5 + 0.3 * Math.sin(t * 5 + z.x);
    ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = COL.tempestDark; circle(z.x, z.y, z.r);
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
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
  for (const k of game.kicks) {                                       // (flying left it's flipped, not turned upside down: user)
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.a); ctx.scale(1.6, Math.cos(k.a) < 0 ? -1.6 : 1.6); astralKicker(0.9); ctx.restore();
  }
  for (const f of game.sinfx) {
    const q = 1 - f.life / f.max;
    if (f.kind === 'slam') {                                           // the strike: a red bolt down, the flash, fissures racing out
      if (q < 0.45) {
        const k = 1 - q / 0.45, w = 18 * k;
        const gr = ctx.createLinearGradient(0, f.y - 90, 0, f.y);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, COL.tempest);
        ctx.globalAlpha = 0.85 * k; ctx.fillStyle = gr; ctx.fillRect(f.x - w / 2, f.y - 90, w, 90);
        ctx.fillStyle = COL.tempestHi; ctx.fillRect(f.x - w / 6, f.y - 90, w / 3, 90);
      }
      ctx.globalAlpha = 1 - q; ctx.fillStyle = COL.tempest;
      starPath(f.x, f.y, 8 + q * 10, 22 + q * 26, 8, f.seed); ctx.fill();
      ctx.fillStyle = COL.tempestHi; circle(f.x, f.y, 11 * (1 - q) + 2);
      ctx.fillStyle = '#ffffff'; circle(f.x, f.y, 6 * (1 - q) + 1);
      const grow = Math.min(1, q / 0.35);                               // the cracks shoot out
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const c of f.cracks) {
        ctx.globalAlpha = 0.9; ctx.strokeStyle = COL.tempest; ctx.lineWidth = 6 * (1 - q * 0.5); crackPath(f, c, grow); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; crackPath(f, c, grow); ctx.stroke();
      }
    } else if (f.kind === 'rock') {                                    // a chunk of the ground, its shadow under it
      const fade = Math.min(1, f.life / 0.3);
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#000000'; ellipse(f.x, f.y + 1, f.size * 1.1, f.size * 0.5);
      ctx.globalAlpha = fade; ctx.save(); ctx.translate(f.x, f.y - f.z); ctx.rotate(f.spin);
      ctx.fillStyle = COL.rock; ctx.fillRect(-f.size, -f.size, f.size * 2, f.size * 2);
      ctx.strokeStyle = COL.tempest; ctx.lineWidth = 1; ctx.strokeRect(-f.size, -f.size, f.size * 2, f.size * 2);
      ctx.restore();
    } else if (f.kind === 'kick') {                                    // an orange arc swung round toward the target
      // a wide crescent (user's sample): thick at its leading edge, thinning to a wisp behind, a gold band inside
      const out = Math.sin(Math.min(1, q * 1.5) * Math.PI / 2), sweep = 2.9, end = f.a + 0.45, start = end - sweep * out;
      const R = Math.max(PLAYER.r + 22, f.reach * 0.95), w = 18 * (1 - q * 0.5), steps = 14;
      const band = (r0, r1, from, col, a) => {                       // a crescent from `from` to `end`, widening toward `end`
        ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath();
        for (let k = 0; k <= steps; k++) { const t = k / steps, ang = from + (end - from) * t; ctx.lineTo(f.x + Math.cos(ang) * (R + r1 * t), f.y + Math.sin(ang) * (R + r1 * t)); }
        for (let k = steps; k >= 0; k--) { const t = k / steps, ang = from + (end - from) * t; ctx.lineTo(f.x + Math.cos(ang) * (R - r0 * t), f.y + Math.sin(ang) * (R - r0 * t)); }
        ctx.closePath(); ctx.fill();
      };
      const fade = 1 - q * 0.85;
      band(w * 0.5, w, start, COL.dragonkick, 0.9 * fade);
      band(w * 0.15, w * 0.45, start + (end - start) * 0.35, COL.sinGold, 0.85 * fade);
    } else if (f.kind === 'flash') {                                   // the yellow hit flash (user: "a hit indicator")
      ctx.globalAlpha = 1 - q; ctx.fillStyle = f.teal ? COL.sinTealHi : COL.sinGold;
      starPath(f.x, f.y, 6 + q * 8, 16 + q * 18, 7, q * 0.6); ctx.fill();
      ctx.fillStyle = '#ffffff'; circle(f.x, f.y, 5 * (1 - q) + 1);
    }
    ctx.globalAlpha = 1;
  }
}
// Iron Will on you: a teal ring with a warm gold glow inside, turning, flashing when it takes a hit.
function drawSinGuard(p) {
  const g = game.sguard;
  if (!g) return;
  const fade = Math.min(1, g.t / 0.5), left = g.hp / g.max, spin = reducedMotion ? 0 : performance.now() / 500, R = PLAYER.r + 10;
  ctx.globalAlpha = (0.18 + (g.hit > 0 ? 0.25 : 0)) * fade; ctx.fillStyle = COL.sinGold; circle(p.x, p.y, R - 2);
  ctx.globalAlpha = (0.5 + 0.4 * left) * fade; ctx.strokeStyle = COL.ironwill; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = COL.sinTealHi;
  for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3; ctx.beginPath(); ctx.arc(p.x, p.y, R + 4, a, a + 1.1 * left + 0.2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
