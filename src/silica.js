/* silica.js — The Silica pack's weapons (v0.42, user): Gatling Gun, Cryo Magus and Gear Toss. Their bursts, the
   frost fields and the ring of ice, the gears. combat.js, combos.js and draw.js call in here. Every number is a
   placeholder. (The Druid, its summoned lion, turtle and chimera, was removed in v0.65, user: "remove the druid card".) */
'use strict';

/* What they do (user):
   - Gatling Gun: fires 10 rounds of bullets. ×3: 3 bursts, and every round has a small blast. ×7: two gatlings, one on
     each side of you, 10 rounds each, with the blasts.
   - Cryo Magus: a homing ice blast that leaves a frost field where it lands; enemies in the field are slowed. ×3: the
     field bursts after a moment. ×7: spinning ice circles you, growing out from you to a large ring.
   - Gear Toss (v0.60, user): throws a gear; what it hits sparks for a moment, then gets zapped and confused (it
     staggers about and leaves you alone). ×3: a spray of gears and other parts, with a little knockback. ×7: a whole
     computer, lobbed onto the enemy: it smashes, and everything round it is hurt and glitched (confused for longer). */
const SILICA = {
  gatling: { rounds: 10, gap: 0.045, spread: 0.12, bursts: 3, burstGap: 0.5, aoe: { radius: 30, dmg: 2 },
             twin: { offset: 16, dmg: 4, aoe: { radius: 42, dmg: 4 } } },          // ×7: each gun's rounds
  cryo: {
    slow: 0.45, chill: 0.25,                                  // chilled enemies move at 45% speed; a field chills for 0.25 s at a time
    field: { r: 72, life: 3, bite: { every: 1, dmg: 2 } },   // (v0.67 balance: the frost bites, `dmg` every `every` s)
    burst: { r: 96, life: 1.5, dmg: 26 },                     // ×3: the field bursts after `life` s
    // ×7 BLIZZARD! (v0.60, user: "a swirling and exploding circle"): a storm round you growing from `from` to `to` px over
    // `grow` s, then holding `hold` s; everything in it is hit every `every` s, chilled and dragged round (`swirl` px/s),
    // and at the end it explodes over the whole circle (`boom`). `shards`: the ice crystals riding its edge.
    ring: { shards: 8, from: 30, to: 230, grow: 1.4, hold: 1.6, spin: 2.6, r: 9, dmg: 6, every: 0.35, chill: 1.5, swirl: 90, boom: { dmg: 30, knock: 280 } },
  },
  // Gear Toss: the zap comes `fuse` s after the hit (`zap` damage), then it's confused for `confuse` s, staggering at
  // `wander` of its speed and turning every `turn` s. Bosses aren't confused, they just take the zap.
  gear: { fuse: 0.8, zap: 8, confuse: 1.6, wander: 0.55, turn: [0.3, 0.7],
          parts: { n: 6, spread: 1.0, dmg: 5, knock: 150, gears: 2 },                    // ×3 SCRAP HEAP!: `gears` of the `n` parts are gears
          pc: { fly: 0.6, h: 120, r: 120, dmg: 26, knock: 220, glitch: 3.2 } },          // ×7 BLUE SCREEN!: lobbed `fly` s, `h` px up at its top
};

function resetSilica() { game.fields = []; game.frost = null; game.muzzles = []; }

// A single card (combat.js shoot): each weapon's own attack. `o.raw` shots are plain projectiles (the bursts use them).
function silicaShot(card, e, o = {}) {
  if (card === 'gatling') { if (e) gatlingBurst(card, e, { rounds: SILICA.gatling.rounds }); }
  else if (card === 'cryo') { if (e) shoot(card, e, { ...o, raw: true, field: 'slow' }); }
  else if (card === 'geartoss') { if (e) shoot(card, e, { ...o, raw: true, extra: { gh: 1, part: 'gear' } }); }
}
// A combo (combos.js runCombo): true if it was one of these.
function silicaCombo(cb, e0) {
  const G = SILICA.gatling, card = cb.card;
  switch (`${card}${cb.n}`) {
    case 'gatling3':
      for (let b = 0; b < G.bursts; b++) gatlingBurst(card, e0, { rounds: G.rounds, aoe: G.aoe, delay: b * G.burstGap });
      return true;
    case 'gatling7':
      for (const gun of [-1, 1]) gatlingBurst(card, e0, { rounds: G.rounds, aoe: G.twin.aoe, dmg: G.twin.dmg, gun, delay: gun > 0 ? G.gap / 2 : 0 });
      game.shake = Math.max(game.shake, 0.1);
      return true;
    case 'cryo3': if (e0) shoot(card, e0, { raw: true, field: 'burst', r: 10 }); return true;
    case 'cryo7': game.frost = { t: 0, card, hits: new Map() }; SFX.freeze(true); return true;
    case 'geartoss3': if (e0) scrapHeap(card, e0); return true;
    case 'geartoss7': if (e0) throwComputer(card, e0); return true;
  }
  return false;
}

/* ---------- Gatling Gun ---------- */
// `rounds` shots, `gap` s apart, sprayed a little, each at the enemy it started on (or the nearest in range once that
// one's gone). `gun`: −1 / 1 fires from a barrel on that side of you (×7), else from you.
function gatlingBurst(card, e0, { rounds, aoe = null, dmg, gun = 0, delay = 0 }) {
  const G = SILICA.gatling;
  for (let k = 0; k < rounds; k++) later(delay + k * G.gap, () => {
    const p = game.player, e = e0 && game.enemies.includes(e0) ? e0 : inRange(card);
    if (!e) return;
    const a = Math.atan2(e.y - p.y, e.x - p.x), side = a + gun * Math.PI / 2;
    const from = gun ? { x: p.x + Math.cos(side) * G.twin.offset, y: p.y + Math.sin(side) * G.twin.offset } : null;
    shoot(card, e, { raw: true, angle: a + (Math.random() - 0.5) * G.spread * 2, homeDelay: 0.05, aoe, dmg, from, quiet: k % 3 > 0 });
    if (from) game.muzzles.push(pinTo({ x: from.x, y: from.y, a, life: 0.06 }));
  });
}

/* ---------- Cryo Magus ---------- */
const chill = (e, t) => { if (!e.dummy) e.chill = Math.max(e.chill || 0, t); };
// A frost field where an ice blast lands. `kind` 'burst' (×3) is bigger and shatters when it runs out.
function iceField(x, y, kind, card) {
  const C = SILICA.cryo, F = kind === 'burst' ? C.burst : C.field;
  game.fields.push({ x, y, r: F.r, life: F.life * durMul(card), t: 0,   // (longer at some tiers, v0.62)
    burst: kind === 'burst', card, owner: ownerId(), aug: AUG_FX, seed: Math.random() * 10 });
  game.rings.push({ x, y, r: 6, max: F.r, life: 0.3, color: COL.ice });
  burst(x, y, COL.ice, 10, 200);
  snowBurst(x, y, 12, 150);
  SFX.freeze(false);
}
// v0.60 (user: "more frosty"): snowflakes thrown out, drifting and turning as they slow (draw.js draws `flake`s).
function snowBurst(x, y, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = speed * (0.25 + Math.random() * 0.75);
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55 + Math.random() * 0.45, color: Math.random() < 0.5 ? COL.ice : COL.player, flake: true, rot: Math.random() * TAU });
  }
}
function updateFields(dt) {
  const C = SILICA.cryo;
  for (let i = game.fields.length - 1; i >= 0; i--) {
    const f = game.fields[i];
    usePlayerId(f.owner, f.aug);
    f.t += dt;
    const bite = !f.burst && (f.bite = (f.bite ?? C.field.bite.every) - dt) <= 0;
    if (bite) f.bite += C.field.bite.every;
    for (const e of game.enemies.slice()) {
      if (e.dead || hitGap(e, f.x, f.y) >= f.r) continue;
      chill(e, C.chill);
      if (bite) hitEnemy({ card: f.card, look: 'ice', dmg: damageOf(C.field.bite.dmg), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
    }
    if (f.t < f.life) continue;
    game.fields.splice(i, 1);
    if (!f.burst) continue;
    blast(f.x, f.y, f.card, f.r * 1.05, damageOf(C.burst.dmg), { knock: 140, big: true, sized: true });   // ×3: it shatters
    burst(f.x, f.y, COL.ice, 24, 340);
    snowBurst(f.x, f.y, 22, 260);
    SFX.shatter();
  }
}
// ×7: how far the storm reaches at time f.t (it eases out to its full size).
function frostRadius(f) {
  const R = SILICA.cryo.ring, k = Math.min(1, f.t / R.grow);
  return R.from + (R.to - R.from) * (1 - (1 - k) ** 2);
}
function updateFrost(dt) {
  const f = game.frost, R = SILICA.cryo.ring, p = game.player;
  if (!f) return;
  f.t += dt;
  const rad = frostRadius(f);
  if (f.t >= R.grow + R.hold) { game.frost = null; blizzardBoom(f, p, rad); return; }
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > rad) continue;
    chill(e, R.chill);
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (!e.dummy && !e.fling && !bossLike(e)) { e.x += (-dy / d) * R.swirl * dt; e.y += (dx / d) * R.swirl * dt; }   // dragged round by the wind
    if ((f.hits.get(e) || 0) > f.t) continue;
    f.hits.set(e, f.t + R.every);
    hitEnemy({ card: f.card, look: 'ice', dmg: damageOf(R.dmg), knock: knockOf(30), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  }
}
// The storm's end: it explodes over the whole circle, ice spikes bursting up out of the ground (drawIceBoom).
function blizzardBoom(f, p, rad) {
  const B = SILICA.cryo.ring.boom;
  blast(p.x, p.y, f.card, rad, damageOf(B.dmg), { knock: B.knock, big: true });
  for (const e of game.enemies) if (hitGap(e, p.x, p.y) < rad) chill(e, 2);
  game.sinfx.push({ kind: 'iceboom', x: p.x, y: p.y, r: rad, life: 0.8, max: 0.8, fixed: true, seed: Math.random() * 10 });
  snowBurst(p.x, p.y, 40, 420);
  game.shake = Math.max(game.shake, 0.3);
  SFX.shatter();
}

// Everything here that runs each frame (combat.js update, after movement).
function updateSilica(dt) {
  updateFields(dt);
  gearStep(dt);
  if (!NET.run) updateFrost(dt);                             // co-op: each player's own ring (coop.js)
  for (const m of game.muzzles) { m.life -= dt; followOwner(m); }
  game.muzzles = game.muzzles.filter(m => m.life > 0);
}

/* ---------- drawing ---------- */
// On the floor, under everything: the frost fields.
function drawSilicaFloor() {
  const now = reducedMotion ? 0 : performance.now() / 1000;
  for (const f of game.fields) drawFrostField(f, now);
}
// Over the enemies: frost on chilled enemies, the ring of ice.
// Chilled (v0.46, user: no circle, but it should look slowed): the enemy is frosted over (draw.js `chilled`, its legs
// and pincers in slow motion if it's a crab), with little ice sparkles drifting slowly up off it. The bosses also get
// frost at their feet.
function frostSparkles(e) {
  const big = e.boss || e.makora || e.obi, n = big ? 6 : 3, now = performance.now() / 1000, seed = e.fs ?? (e.fs = e._id ? (e._id * 7.31) % 100 : Math.random() * 100);
  for (let i = 0; i < n; i++) {
    const ph = reducedMotion ? (i + 0.5) / n : (now * 0.3 + i / n + seed) % 1;          // slow: a whole rise takes over 3 s
    const x = e.x + Math.sin(seed * 7 + i * 2.4) * e.r * 0.9, y = e.y + e.r * 0.5 - ph * e.r * 1.9, z = (big ? 5.5 : 4) * (0.6 + 0.4 * Math.sin(ph * Math.PI));
    ctx.globalAlpha = Math.sin(ph * Math.PI);
    ctx.fillStyle = COL.ice; ctx.fillRect(x - z, y - 1, z * 2, 2); ctx.fillRect(x - 1, y - z, 2, z * 2);   // a little four-point glint
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}
function drawSilicaTop() {
  for (const e of game.enemies) if (e.chill > 0 && !e.down && !e.dummy) frostSparkles(e);
  for (const e of [game.boss, game.obi, game.makora]) if (e && e.chill > 0 && !e.down) {   // the big ones: frost at their feet
    ctx.globalAlpha = 0.4; ctx.fillStyle = COL.ice; ellipse(e.x, e.y + e.r * 0.6, e.r * 0.9, e.r * 0.25); ctx.globalAlpha = 1;
  }
  if (game.frost) drawFrostAt(game.frost, game.player);
  for (const f of game.sinfx) if (f.kind === 'iceboom') drawIceBoom(f);
  for (const m of game.muzzles) drawMuzzle(m.x + Math.cos(m.a) * 5, m.y + Math.sin(m.a) * 5, m.a, m.life / 0.06, 7, COL.gatling, m.seed ??= (Math.random() * 1e9) | 0);   // (v0.57: draw.js drawMuzzle)
  drawGearTop();                                             // Gear Toss: sparks, zaps, the confused and the glitched, the computer
}
// A six-armed snowflake, `s` across from its middle, in the current stroke style (v0.60: the Cryo Magus's frost).
function snowflake(x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, c = Math.cos(a), sn = Math.sin(a), bx = c * s * 0.55, by = sn * s * 0.55, l = s * 0.32;
    ctx.moveTo(0, 0); ctx.lineTo(c * s, sn * s);
    for (const side of [0.7, -0.7]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + side) * l, by + Math.sin(a + side) * l); }
  }
  ctx.stroke(); ctx.restore();
}
// A four-point glint of light.
function iceGlint(x, y, z) { ctx.fillRect(x - z, y - 0.7, z * 2, 1.4); ctx.fillRect(x - 0.7, y - z, 1.4, z * 2); }
// A long crystal of ice, `r` wide, pointing along `rot`: two shaded faces, a bright ridge down its middle.
function iceCrystal(x, y, r, rot, len = 1.6) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const pts = [[0, -len * r], [0.55 * r, -0.6 * r], [0.55 * r, 0.6 * r], [0, len * r], [-0.55 * r, 0.6 * r], [-0.55 * r, -0.6 * r]];
  ctx.fillStyle = COL.cryo; ctx.beginPath(); pts.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v))); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COL.ice; ctx.beginPath(); ctx.moveTo(0, -len * r); ctx.lineTo(0.55 * r, -0.6 * r); ctx.lineTo(0.55 * r, 0.6 * r); ctx.lineTo(0, len * r); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.player; ctx.lineWidth = 1; ctx.globalAlpha *= 0.9;
  ctx.beginPath(); ctx.moveTo(0, -len * r * 0.85); ctx.lineTo(0, len * r * 0.6); ctx.stroke();
  ctx.beginPath(); pts.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v))); ctx.closePath(); ctx.globalAlpha *= 0.6; ctx.stroke();
  ctx.restore();
}
// A frost field (v0.60, user: "more frosty"): frosted ground, palest at its heart, with frost creeping out from the
// middle in feathery branches, little ice crystals jutting up round its rim, a big faint snowflake turning slowly in it
// and glints twinkling over it.
function drawFrostField(f, now) {
  const k = f.t / f.life, fade = Math.min(1, (f.life - f.t) * 3, f.t * 8), sd = f.seed ?? 0, grow = Math.min(1, f.t * 4);
  const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
  g.addColorStop(0, hexA(COL.ice, 0.42)); g.addColorStop(0.6, hexA(COL.ice, 0.2)); g.addColorStop(1, hexA(COL.cryo, 0.08));
  ctx.globalAlpha = fade; ctx.fillStyle = g; circle(f.x, f.y, f.r);
  ctx.strokeStyle = COL.ice; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6 * fade;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = sd + i / 9 * TAU + Math.sin(sd * 3 + i) * 0.2, L = f.r * (0.7 + 0.22 * Math.sin(sd * 5 + i * 2.1)) * grow, ca = Math.cos(a), sa = Math.sin(a);
    ctx.moveTo(f.x + ca * f.r * 0.12, f.y + sa * f.r * 0.12); ctx.lineTo(f.x + ca * L, f.y + sa * L);
    for (const v of [0.4, 0.62, 0.82]) {
      const bx = f.x + ca * L * v, by = f.y + sa * L * v, l = L * 0.2 * (1.1 - v);
      for (const side of [-0.75, 0.75]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + side) * l, by + Math.sin(a + side) * l); }
    }
  }
  ctx.stroke();
  ctx.fillStyle = COL.ice; ctx.globalAlpha = 0.75 * fade;
  for (let i = 0; i < 18; i++) {
    const a = sd * 2 + i / 18 * TAU, h = (4 + 3 * ((i * 7) % 3)) * grow, ca = Math.cos(a), sa = Math.sin(a), bx = f.x + ca * f.r, by = f.y + sa * f.r;
    ctx.beginPath(); ctx.moveTo(bx - sa * 2.2, by + ca * 2.2); ctx.lineTo(f.x + ca * (f.r + h), f.y + sa * (f.r + h)); ctx.lineTo(bx + sa * 2.2, by - ca * 2.2); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = COL.player; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.35 * fade; ctx.lineWidth = 1.4; snowflake(f.x, f.y, f.r * 0.32, now * 0.3 + sd);
  ctx.fillStyle = COL.player;
  for (let i = 0; i < 6; i++) {
    const tw = reducedMotion ? 0.5 : (now * 1.5 + i * 0.37 + sd) % 1, a = sd * 7 + i * 2.3, d = f.r * (0.2 + 0.65 * ((i * 0.37 + sd) % 1));
    ctx.globalAlpha = Math.sin(tw * Math.PI) * fade; iceGlint(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 2.5 + 1.5 * Math.sin(tw * Math.PI));
  }
  if (f.burst) {                                              // ×3: a countdown ring closing in, and a flicker at the end
    ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = COL.player; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k), 0, TAU); ctx.stroke();
    if (k > 0.75 && !reducedMotion && Math.floor(now * 16) % 2) { ctx.globalAlpha = 0.25; ctx.fillStyle = COL.player; circle(f.x, f.y, f.r); }
  }
  ctx.globalAlpha = 1;
}
// BLIZZARD! round a player (yours, or a friend's in co-op). v0.60 (user: "a better blizzard, swirling and exploding"):
// frozen ground filling the circle; walls of wind stacked up round its edge, each higher one fainter and turning a
// little faster, so the storm has height; snow blowing round inside, each flake at its own height over its shadow;
// ice crystals riding high on the edge; and once it's full size, its rim charges up, flickering, until it bursts.
function drawFrostAt(f, p) {
  const R = SILICA.cryo.ring, life = R.grow + R.hold, fade = Math.min(1, (life - f.t) * 4, f.t * 5), rad = frostRadius(f), t = f.t;
  const now = reducedMotion ? 0 : performance.now() / 1000, build = Math.max(0, (t - R.grow) / R.hold);
  const g = ctx.createRadialGradient(p.x, p.y, rad * 0.1, p.x, p.y, rad);
  g.addColorStop(0, hexA(COL.ice, 0.08)); g.addColorStop(0.75, hexA(COL.ice, 0.2 + 0.15 * build)); g.addColorStop(1, hexA(COL.cryo, 0.35));
  ctx.globalAlpha = fade; ctx.fillStyle = g; circle(p.x, p.y, rad);
  ctx.lineCap = 'round';
  for (let L = 0; L < 4; L++) {                               // the walls of wind, stacked up
    const z = L * 9, a0 = t * R.spin * (1 + L * 0.15) + L;
    ctx.globalAlpha = fade * (0.6 - L * 0.12); ctx.strokeStyle = L % 2 ? COL.ice : COL.player; ctx.lineWidth = 3 - L * 0.5;
    for (let s = 0; s < 3; s++) { ctx.beginPath(); ctx.arc(p.x, p.y - z, rad * (1 - L * 0.04), a0 + s * TAU / 3, a0 + s * TAU / 3 + 1.2); ctx.stroke(); }
  }
  for (let i = 0; i < 48; i++) {                              // the snow, blowing round
    const u = (i * 0.618) % 1, r = rad * (0.2 + 0.8 * u), a = i * 2.399 + t * R.spin * (1.7 - u), z = 6 + ((i * 7) % 5) * 6 + Math.sin(t * 3 + i) * 4;
    const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r, b = a + Math.PI / 2;
    ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 0.5, 2, 1);
    ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = i % 3 ? COL.player : COL.ice; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y - z); ctx.lineTo(x - Math.cos(b) * 6, y - z - Math.sin(b) * 6); ctx.stroke();
  }
  for (let i = 0; i < R.shards; i++) {                        // ice crystals riding its edge, high up
    const a = t * R.spin + i / R.shards * TAU, x = p.x + Math.cos(a) * rad, y = p.y + Math.sin(a) * rad, z = 16 + Math.sin(t * 4 + i) * 5;
    ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = '#000'; ellipse(x, y + 2, R.r * 0.8, R.r * 0.3);
    fxGlow(x, y - z, R.r * 2.4, COL.cryo, 0.7 * fade);
    ctx.globalAlpha = fade; iceCrystal(x, y - z, R.r * 0.6, a + Math.PI / 2);
  }
  if (build > 0) {                                            // charging up to burst
    ctx.globalAlpha = (0.4 + 0.5 * build) * fade * (reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(now * 30)); ctx.strokeStyle = COL.player; ctx.lineWidth = 2 + 3 * build;
    ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.stroke();
    fxGlow(p.x, p.y, rad * 0.6, COL.cryo, 0.5 * build * fade);
  }
  ctx.globalAlpha = 1;
}
// BLIZZARD!'s burst: a white flash, a shock ring racing out, and rings of ice spikes bursting up out of the ground (lit on
// one side, shaded on the other, each over its shadow), then sinking back.
function drawIceBoom(f) {
  const k = 1 - f.life / f.max, R = f.r, fade = 1 - k, rise = k < 0.3 ? k / 0.3 : Math.max(0, 1 - (k - 0.3) / 0.7);
  fxAdd(COL.ice); ctx.globalAlpha = 0.6 * Math.max(0, 1 - k * 3); ctx.fillStyle = COL.player; circle(f.x, f.y, R); fxNormal();
  ctx.globalAlpha = fade; ctx.strokeStyle = COL.player; ctx.lineWidth = 4 * fade + 1; ctx.beginPath(); ctx.arc(f.x, f.y, R * (0.8 + 0.4 * k), 0, TAU); ctx.stroke();
  const spikes = [];
  for (let ring = 0; ring < 3; ring++) {
    const n = 8 + ring * 6, rr = R * (0.3 + ring * 0.32);
    for (let i = 0; i < n; i++) {
      const a = (f.seed || 0) + i / n * TAU + ring * 0.4;
      spikes.push([f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, (16 + ((i * 5 + ring) % 4) * 8) * rise]);
    }
  }
  spikes.sort((a, b) => a[1] - b[1]);                         // (the far ones first)
  for (const [x, y, h] of spikes) {
    if (h < 1) continue;
    ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#000'; ellipse(x + h * 0.2, y + 1.5, 4.5, 1.8);
    ctx.globalAlpha = fade; ctx.fillStyle = COL.cryo; ctx.beginPath(); ctx.moveTo(x - 5.5, y); ctx.lineTo(x, y - h); ctx.lineTo(x, y + 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.ice; ctx.beginPath(); ctx.moveTo(x, y + 1.5); ctx.lineTo(x, y - h); ctx.lineTo(x + 5.5, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.player; ctx.globalAlpha = 0.8 * fade; ctx.fillRect(x - 0.5, y - h, 1, h * 0.5);
  }
  ctx.globalAlpha = 1;
}
// The Cryo Magus's ice blast (v0.60, user: "more frosty"): a long faceted ice crystal pointing the way it flies, in a
// cold glow, with three small snowflakes circling it, and a trail of frost mist with glints of snow left in it.
function drawIceShot(pr) {
  const t = pr.trail, r = pr.r, a = Math.atan2(pr.vy, pr.vx), now = reducedMotion ? 0 : performance.now() / 1000;
  shotShadow(pr.x, pr.y, r * 1.4);                           // (v0.60: flying over the ground, for a 3D look)
  for (let i = 0; i < t.length; i += 2) {
    const k = i / t.length;
    ctx.globalAlpha = k * 0.24; ctx.fillStyle = COL.ice; circle(t[i], t[i + 1], r * (1.5 - 0.6 * k));
  }
  ctx.fillStyle = COL.player;
  for (let i = 2; i < t.length; i += 4) { const k = i / t.length; ctx.globalAlpha = k * 0.9; iceGlint(t[i] + Math.sin(i * 3.1) * r, t[i + 1] + Math.cos(i * 2.3) * r, 1.2 + k * 1.6); }
  fxGlow(pr.x, pr.y, r * 4 + 10, COL.cryo, 0.85);
  ctx.globalAlpha = 0.25; ctx.fillStyle = COL.ice; circle(pr.x, pr.y, r + 5);
  ctx.globalAlpha = 1; iceCrystal(pr.x, pr.y, r * 0.95, a + Math.PI / 2, 2);
  ctx.strokeStyle = COL.player; ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) { const b = now * 4 + k * TAU / 3; ctx.globalAlpha = 0.8; snowflake(pr.x + Math.cos(b) * (r + 6), pr.y + Math.sin(b) * (r + 6), 2.6, -b); }
  ctx.globalAlpha = 1;
}

resetSilica();

/* ---------- Gear Toss (v0.60, user) ---------- */
// Enemy state: e.gfuse (s to the zap) and e.gby (who threw it); e.confused (s left) with e.ca / e.cturn (the way it's
// staggering, and when it turns); e.glitch (s left: BLUE SCREEN!'s look). gearStep counts them down (all in co-op's
// picture: plain numbers on the enemy).
const GEAR_PARTS = ['gear', 'bolt', 'nut', 'spring', 'chip', 'gear'];
// combat.js, after a gear (or a part) has hit: a gear sets it sparking.
function gearHit(pr, e) {
  if (e.dead || pr.part !== 'gear') return;
  if (!(e.gfuse > 0)) e.gfuse = SILICA.gear.fuse;
  e.gby = pr.owner;
}
function confuseEnemy(e, t) {
  if (e.dead || bossLike(e) || e.fling || e.berserk > 0) return;
  e.confused = Math.max(e.confused || 0, t); e.cturn = 0;
}
// combat.js update: a confused enemy staggers about instead of coming for you (and so can't touch you).
function confuseStep(e, dt) {
  const G = SILICA.gear;
  if ((e.cturn -= dt) <= 0) { e.cturn = G.turn[0] + Math.random() * (G.turn[1] - G.turn[0]); e.ca = Math.random() * TAU; }
  const decay = Math.exp(-6 * dt), sp = e.speed * G.wander, wob = Math.sin(e.confused * 9) * 0.6;
  e.kx *= decay; e.ky *= decay;
  e.vx = Math.cos(e.ca + wob) * sp + e.kx; e.vy = Math.sin(e.ca + wob) * sp + e.ky;
  e.x += e.vx * dt; e.y += e.vy * dt;
  if (e.chill > 0) e.chill -= dt;
}
function gearZap(e) {
  const G = SILICA.gear;
  usePlayerId(e.gby);
  hitEnemy({ card: 'geartoss', look: 'gear', dmg: damageOf(G.zap), noMark: true, knock: 0, vx: 0, vy: 0, x: e.x, y: e.y }, e);
  game.sinfx.push({ kind: 'gzap', x: e.x, y: e.y, r: e.r || 10, life: 0.32, max: 0.32, fixed: true, seed: (Math.random() * 1e9) | 0 });
  game.rings.push({ x: e.x, y: e.y, r: 4, max: (e.r || 10) + 22, life: 0.25, color: COL.zap });
  if (!e.dead) {
    confuseEnemy(e, G.confuse * durMul('geartoss'));   // (longer at some tiers, v0.62)
    if (e.confused > 0) game.floaters.push({ x: e.x, y: e.y - (e.r || 10) - 12, text: '?!', color: COL.zap, life: 0.6, vy: -40, big: false });
  }
  SFX.gear('zap');
}
// ×3 SCRAP HEAP!: `n` parts fanned out, each after its own enemy; they knock back a little, and the gears among them spark.
function scrapHeap(card, e0) {
  const P = SILICA.gear.parts, p = game.player, ts = targets(P.n, rangeOf(card)), a0 = Math.atan2(e0.y - p.y, e0.x - p.x);
  for (let k = 0; k < P.n; k++) {
    const part = k < P.gears ? 'gear' : GEAR_PARTS[1 + (k % 4)];
    shoot(card, ts[k % Math.max(1, ts.length)] || e0, { raw: true, dmg: P.dmg, angle: a0 + (k / (P.n - 1) - 0.5) * P.spread, homeDelay: 0.09,
      speedMul: 0.9 + Math.random() * 0.25, quiet: k > 0, r: part === 'gear' ? 6 : 5,
      extra: { gh: 1, part, knock: knockOf(P.knock), prot: Math.random() * TAU } });
  }
  SFX.gear('scrap');
}
// ×7 BLUE SCREEN!: a whole computer (a monitor on its tower), lobbed in an arc onto where the enemy is going.
function throwComputer(card, e) {
  const C = SILICA.gear.pc, p = game.player;
  const x1 = Math.max(20, Math.min(W - 20, e.x + (e.vx || 0) * C.fly * 0.5)), y1 = Math.max(20, Math.min(H - 20, e.y + (e.vy || 0) * C.fly * 0.5));
  game.sinfx.push({ kind: 'pc', card, owner: ownerId(), aug: AUG_FX, x: p.x, y: p.y, x0: p.x, y0: p.y, x1, y1, t: 0, dur: C.fly, life: C.fly + 0.15, max: C.fly + 0.15,
    fixed: true, spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3), done: false });
  SFX.gear('throw');
}
function computerSmash(f) {
  const C = SILICA.gear.pc, x = f.x1, y = f.y1;
  usePlayerId(f.owner, f.aug);
  for (const e of game.enemies.slice()) {
    if (e.dead || hitGap(e, x, y) > C.r) continue;
    const q = hitPoint(e, x, y), dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
    hitEnemy({ card: f.card, look: 'gear', dmg: damageOf(C.dmg), knock: knockOf(C.knock), vx: dx / d, vy: dy / d, x: q.x, y: q.y }, e);
    if (!e.dead) { e.glitch = Math.max(e.glitch || 0, C.glitch); confuseEnemy(e, C.glitch); }
  }
  game.sinfx.push({ kind: 'bsod', x, y, r: C.r, life: 0.9, max: 0.9, fixed: true, seed: (Math.random() * 1e9) | 0 });
  const bits = [COL.gearHi, COL.glitchA, COL.glitchB, COL.bsod, '#d8d2c2'];
  for (let k = 0; k < 22; k++) {                              // keys, chips and bits of the case thrown up (drawn as sins.js's 'rock')
    const a = Math.random() * TAU, v = 90 + Math.random() * 220;
    game.sinfx.push({ kind: 'rock', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, z: 4, vz: 140 + Math.random() * 180,
      size: 1.6 + Math.random() * 2.6, spin: Math.random() * TAU, life: 0.85, max: 0.85, fixed: true, col: bits[k % bits.length], edge: '#0b0a10' });
  }
  game.rings.push({ x, y, r: 10, max: C.r, life: 0.35, color: COL.bsod });
  game.rings.push({ x, y, r: 6, max: C.r * 0.8, life: 0.28, color: COL.glitchB });
  game.shake = Math.max(game.shake, 0.32);
  SFX.gear('boom');
}
function gearStep(dt) {
  for (const e of game.enemies.slice()) {
    if (e.confused > 0) e.confused = Math.max(0, e.confused - dt);
    if (e.glitch > 0) e.glitch = Math.max(0, e.glitch - dt);
    if (e.gfuse > 0 && (e.gfuse -= dt) <= 0) { e.gfuse = 0; if (!e.dead) gearZap(e); }
  }
  for (const f of game.sinfx) {
    if (f.kind !== 'pc' || f.done) continue;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    f.x = f.x0 + (f.x1 - f.x0) * k; f.y = f.y0 + (f.y1 - f.y0) * k;
    if (k >= 1) { f.done = true; computerSmash(f); }
  }
}

/* ---------- Gear Toss: how it looks ---------- */
// A gear's outline: `n` teeth round a rim, ro out and ri in.
function gearPath(x, y, ro, ri, n, rot) {
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rot + k * TAU / n, w = Math.PI / n;
    ctx.lineTo(x + Math.cos(a - w * 0.55) * ri, y + Math.sin(a - w * 0.55) * ri);
    ctx.lineTo(x + Math.cos(a - w * 0.32) * ro, y + Math.sin(a - w * 0.32) * ro);
    ctx.lineTo(x + Math.cos(a + w * 0.32) * ro, y + Math.sin(a + w * 0.32) * ro);
    ctx.lineTo(x + Math.cos(a + w * 0.55) * ri, y + Math.sin(a + w * 0.55) * ri);
  }
  ctx.closePath();
}
// A copper gear, as a thick disc (v0.60, user: "fake 3D"): `tilt` turns it over (0 flat to the screen, 1 edge on), so
// its face squashes and its thickness shows as a darker rim under it, stacked a layer at a time. Lit from the top
// left: a worn shine across the face, a raised hub with its hole bored through.
function drawGear(x, y, r, rot, a = 1, tilt = 0.35) {
  const sy = Math.max(0.18, Math.cos(tilt * Math.PI / 2)), th = Math.max(1.2, r * 0.38) * Math.sqrt(1 - sy * sy * 0.6);
  ctx.globalAlpha = a;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
  for (let k = 4; k >= 1; k--) {                                    // its thickness: the side of the teeth, darkening down
    ctx.fillStyle = k > 2 ? COL.gearDark : '#8a5226';
    gearPath(0, (th * k / 4) / sy, r, r * 0.74, 8, rot); ctx.fill();
  }
  ctx.fillStyle = COL.geartoss; gearPath(0, 0, r, r * 0.74, 8, rot); ctx.fill();
  ctx.save(); gearPath(0, 0, r, r * 0.74, 8, rot); ctx.clip();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, COL.gearHi); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,230,200,.55)'; ctx.lineWidth = 0.8 / sy;  // a bevel along the rim's top edge
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  ctx.fillStyle = COL.gearDark; circle(0, th * 0.35 / sy, r * 0.42);  // the hub, raised: its side, then its top
  ctx.fillStyle = '#e9a868'; circle(0, 0, r * 0.4);
  ctx.fillStyle = COL.gearHi; circle(-r * 0.1, -r * 0.1, r * 0.22);
  ctx.fillStyle = '#1c0f06'; circle(0, 0, r * 0.17);
  ctx.restore();
  ctx.globalAlpha = 1;
}
// The other parts SCRAP HEAP! throws: a bolt, a hex nut, a spring, a chip with its pins. (v0.60: each with its
// thickness under it, the same shape darkened a few px down.)
function drawPart3D(kind, x, y, r, rot) {
  ctx.save(); ctx.filter = 'brightness(0.42)';
  for (let k = 3; k >= 1; k--) drawPart(kind, x, y + k * 0.9, r, rot);
  ctx.restore();
  drawPart(kind, x, y, r, rot);
}
function drawPart(kind, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'bolt') {
    ctx.fillStyle = COL.gearDark; ctx.fillRect(-r * 0.3, -r * 0.2, r * 1.9, r * 0.6);
    ctx.fillStyle = '#c9ced8'; ctx.fillRect(-r * 0.3, -r * 0.3, r * 1.9, r * 0.55);
    ctx.strokeStyle = '#7b8291'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { const t = r * (0.1 + k * 0.4); ctx.beginPath(); ctx.moveTo(t, -r * 0.3); ctx.lineTo(t + r * 0.2, r * 0.25); ctx.stroke(); }
    ctx.fillStyle = '#e8ebf1'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; ctx.lineTo(-r * 0.6 + Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7b8291'; ctx.stroke();
  } else if (kind === 'nut') {
    ctx.fillStyle = '#d4d8e0'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#6d7383'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = COL.gearDark; circle(0, 0, r * 0.42);
  } else if (kind === 'spring') {
    ctx.strokeStyle = '#e2c27a'; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let k = 0; k <= 12; k++) { const t = k / 12; ctx.lineTo(-r + t * r * 2, (k % 2 ? -1 : 1) * r * 0.55); }
    ctx.stroke();
  } else {                                                         // a chip: a green board, a black die, gold pins
    ctx.fillStyle = '#d9b44a';
    for (let k = -1; k <= 1; k++) { ctx.fillRect(k * r * 0.5 - 0.6, -r * 1.05, 1.2, r * 2.1); ctx.fillRect(-r * 1.05, k * r * 0.5 - 0.6, r * 2.1, 1.2); }
    ctx.fillStyle = '#1f7a45'; ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.fillStyle = '#121218'; ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
  }
  ctx.restore();
}
// draw.js: a thrown gear or part, spinning, its shadow on the ground under it.
function drawGearShot(pr) {
  if (pr.look !== 'gear') return false;
  const rot = pr.spin * (pr.part === 'gear' ? 0.7 : 0.45) + (pr.prot || 0);
  shotShadow(pr.x, pr.y, pr.r, 10);
  const t = pr.trail;                                                 // a faint blur of the way it came
  ctx.lineCap = 'round';
  for (let k = 2; k < t.length; k += 2) {
    const f = k / t.length;
    ctx.globalAlpha = 0.18 * f; ctx.strokeStyle = COL.gearHi; ctx.lineWidth = pr.r * 1.4 * f;
    ctx.beginPath(); ctx.moveTo(t[k - 2], t[k - 1] - 6); ctx.lineTo(t[k], t[k + 1] - 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tumble = 0.5 + 0.45 * Math.sin(pr.spin * 0.35 + (pr.prot || 0));   // (it turns over as it flies)
  if (pr.part === 'gear' || !pr.part) drawGear(pr.x, pr.y - 6, pr.r + 3, rot, 1, tumble);
  else drawPart3D(pr.part, pr.x, pr.y - 6, pr.r + 2, rot);
  return true;
}
// A jagged bolt from (x0, y0) to (x1, y1), `n` kinks, `j` px of jitter.
function zigzag(x0, y0, x1, y1, n, j, rnd) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  for (let k = 1; k < n; k++) { const t = k / n; ctx.lineTo(x0 + (x1 - x0) * t + (rnd() - 0.5) * j, y0 + (y1 - y0) * t + (rnd() - 0.5) * j * 0.4); }
  ctx.lineTo(x1, y1);
}
function drawGearTop() {
  const now = reducedMotion ? 0 : performance.now() / 1000, tick = Math.floor(now * 24);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of game.enemies) {
    const R = e.r || 10;
    if (e.gfuse > 0) {                                                 // sparking: a gear stuck in it, little arcs crackling round it, faster as the zap nears
      const k = 1 - e.gfuse / SILICA.gear.fuse, rnd = mulberry32(tick * 7 + (e._id || (e.x | 0)));
      drawGear(e.x + R * 0.55, e.y - R * 0.45, 4.6, now * 6, 1, 0.45);
      fxAdd(COL.zap);
      for (let i = 0; i < 2 + Math.floor(k * 3); i++) {
        if (rnd() > 0.35 + k * 0.6) continue;
        const a = rnd() * TAU, r0 = R * 0.6, r1 = R + 4 + rnd() * 6;
        ctx.globalAlpha = 0.9; ctx.strokeStyle = COL.zap; ctx.lineWidth = 1.2;
        zigzag(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0, e.x + Math.cos(a + 0.5) * r1, e.y + Math.sin(a + 0.5) * r1, 4, 6, rnd); ctx.stroke();
      }
      fxNormal();
    }
    if (e.glitch > 0) {                                                // glitched: split into magenta and cyan, sliced, with dead pixels round it
      const a0 = Math.min(1, e.glitch / 0.4), rnd = mulberry32(Math.floor(now * 14) * 13 + (e._id || (e.x | 0))), off = 2 + rnd() * 3;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.75 * a0; ctx.strokeStyle = COL.glitchA; ctx.strokeRect(e.x - R - off, e.y - R, R * 2, R * 2);
      ctx.strokeStyle = COL.glitchB; ctx.strokeRect(e.x - R + off, e.y - R + 1, R * 2, R * 2);
      for (let i = 0; i < 3; i++) {
        const y = e.y - R + rnd() * R * 2, w = R * (0.8 + rnd() * 1.6), h = 1.5 + rnd() * 2.5;
        ctx.globalAlpha = 0.65 * a0; ctx.fillStyle = i % 2 ? COL.glitchA : COL.glitchB; ctx.fillRect(e.x - w / 2 + (rnd() - 0.5) * 10, y, w, h);
      }
      for (let i = 0; i < 4; i++) {
        const s = 2 + Math.floor(rnd() * 3);
        ctx.globalAlpha = 0.8 * a0; ctx.fillStyle = [COL.bsod, COL.glitchA, COL.glitchB, '#ffffff'][i];
        ctx.fillRect(e.x + (rnd() - 0.5) * R * 3, e.y + (rnd() - 0.5) * R * 3, s, s);
      }
      if (rnd() < 0.5) {
        ctx.globalAlpha = 0.9 * a0; ctx.fillStyle = COL.bsod; ctx.font = '700 9px "Chakra Petch", system-ui, sans-serif';
        ctx.fillText(rnd() < 0.5 ? 'ERR' : '0x0', e.x + (rnd() - 0.5) * 6, e.y - R - 18);
      }
    }
    if (e.confused > 0) {                                              // confused: question marks and little cogs circling its head
      const a0 = Math.min(1, e.confused / 0.3), y = e.y - R - 9, rx = Math.max(9, R * 0.85);
      for (let k = 0; k < 3; k++) {
        const a = now * 3.2 + k * TAU / 3, x = e.x + Math.cos(a) * rx, yy = y + Math.sin(a) * rx * 0.3, front = Math.sin(a) > 0;
        ctx.globalAlpha = a0 * (front ? 1 : 0.55);
        if (k === 1) drawGear(x, yy, 3.8, now * 5, a0 * (front ? 1 : 0.55), 0.55);
        else { ctx.fillStyle = k ? COL.zap : COL.gearHi; ctx.font = `700 ${front ? 12 : 10}px "Chakra Petch", system-ui, sans-serif`; ctx.fillText('?', x, yy); }
      }
    }
  }
  ctx.globalAlpha = 1;
  for (const f of game.sinfx) {
    if (f.kind === 'gzap') drawGearZap(f);
    else if (f.kind === 'pc' && !f.done) drawComputer(f, now);
    else if (f.kind === 'bsod') drawBlueScreen(f, now);
  }
  ctx.globalAlpha = 1; fxNormal();
}
// The zap: a bolt from the sky onto it, forking at the bottom, a white flash where it lands.
function drawGearZap(f) {
  const q = 1 - f.life / f.max, a = 1 - q, rnd = mulberry32(f.seed + Math.floor(q * 6)), top = f.y - 130;
  fxGlow(f.x, f.y, f.r * 3, COL.zap, 0.9 * a);
  fxAdd(COL.zap);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = COL.zap; ctx.lineWidth = 7; zigzag(f.x + 8, top, f.x, f.y, 7, 22, mulberry32(f.seed)); ctx.stroke();
  ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; zigzag(f.x + 8, top, f.x, f.y, 7, 22, mulberry32(f.seed)); ctx.stroke();
  ctx.strokeStyle = COL.zap; ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { const b = rnd() * TAU; zigzag(f.x, f.y, f.x + Math.cos(b) * (f.r + 10), f.y + Math.sin(b) * (f.r + 10) * 0.6, 3, 6, rnd); ctx.stroke(); }
  fxNormal();
  ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; circle(f.x, f.y, 4 * a + 1);
  ctx.globalAlpha = 1;
}
/* The computer in 3D (v0.60, user: "fake 3D, esp the computer"): an old desktop, a flat beige case with a CRT monitor
   on it, as real boxes. Each corner is turned (it tumbles end over end as it flies) and seen from the game's camera,
   up and to the south, then the faces that look toward the camera are filled back to front, each shaded by how much
   it faces the light (top left), with the blue screen, the drive slot and the power light on their faces. */
const PC_PARTS = [                                                     // [centre x, y, z; size w, d, h; colour; what's on its front]
  [0, 0, -9, 34, 26, 9, '#d8d2c2', 'case'],
  [0, 1, 4, 26, 20, 19, '#e4dfcf', 'monitor'],
  [0, 4, -2.6, 12, 8, 3.6, '#c9c3b2', ''],                             // the monitor's stand
];
const V3 = { view: [0, 0.6, 0.8], light: [-0.45, -0.35, 0.82] };      // toward the camera, toward the light
function pcCorner(p, R) {                                              // turn a point by R (rows), then onto the screen
  const x = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];
  return { x, y, z, sx: x, sy: y * 0.8 - z * 0.6, d: y * 0.6 + z * 0.8 };
}
function drawComputer3D(cx, cy, s, yaw, pitch, a = 1) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const R = [[cyw, -syw * cp, syw * sp], [syw, cyw * cp, -cyw * sp], [0, sp, cp]];   // yaw about z after pitch about x
  const turn = v => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const faces = [];
  for (const [x, y, z, w, d, h, col, front] of PC_PARTS) {
    const c = [];
    for (let i = 0; i < 8; i++) c.push(pcCorner([(x + (i & 1 ? w : -w) / 2) * s, (y + (i & 2 ? d : -d) / 2) * s, (z + (i & 4 ? h : -h) / 2) * s], R));
    for (const [ids, n, kind] of [[[1, 3, 7, 5], [1, 0, 0]], [[0, 4, 6, 2], [-1, 0, 0]], [[2, 6, 7, 3], [0, 1, 0], front], [[0, 1, 5, 4], [0, -1, 0]], [[4, 5, 7, 6], [0, 0, 1]], [[0, 2, 3, 1], [0, 0, -1]]]) {
      const nn = turn(n);
      if (dot(nn, V3.view) <= 0.02) continue;                           // facing away: hidden
      const pts = ids.map(i => c[i]);
      faces.push({ pts, d: pts.reduce((t, q) => t + q.d, 0) / 4, lit: 0.5 + 0.5 * Math.max(0, dot(nn, V3.light)), col, kind });
    }
  }
  faces.sort((p, q) => p.d - q.d);
  ctx.globalAlpha = a; ctx.lineJoin = 'round';
  const quad = (pts, k = 0) => {                                       // the face, `k` of the way in toward its middle
    const mx = pts.reduce((t, q) => t + q.sx, 0) / 4, my = pts.reduce((t, q) => t + q.sy, 0) / 4;
    ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](cx + q.sx + (mx - q.sx) * k, cy + q.sy + (my - q.sy) * k)); ctx.closePath();
    return [cx + mx, cy + my];
  };
  for (const f of faces) {
    ctx.fillStyle = f.col; quad(f.pts); ctx.fill();
    ctx.globalAlpha = a * (1 - f.lit) * 0.85; ctx.fillStyle = '#1a1712'; quad(f.pts); ctx.fill();   // its shade
    ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(40,36,28,.55)'; ctx.lineWidth = 0.8; quad(f.pts); ctx.stroke();
    if (f.kind === 'monitor') {                                         // the screen, blue, with the sad face and a glare
      ctx.fillStyle = COL.bsod; const [mx, my] = quad(f.pts, 0.18); ctx.fill();
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = '#ffffff'; quad(f.pts, 0.5); ctx.fill(); ctx.globalAlpha = a;
      const area = Math.abs((f.pts[1].sx - f.pts[0].sx) * (f.pts[3].sy - f.pts[0].sy) - (f.pts[3].sx - f.pts[0].sx) * (f.pts[1].sy - f.pts[0].sy));
      if (area > 90) { ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.round(Math.sqrt(area) * 0.35)}px "Chakra Petch", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(':(', mx, my); }
    } else if (f.kind === 'case') {                                     // the drive slot and the green power light
      const [p0, p1, , p3] = f.pts, at = (u, v) => [cx + p0.sx + (p3.sx - p0.sx) * u + (p1.sx - p0.sx) * v, cy + p0.sy + (p3.sy - p0.sy) * u + (p1.sy - p0.sy) * v];   // (u across, v up)
      ctx.strokeStyle = '#5d584b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(...at(0.12, 0.55)); ctx.lineTo(...at(0.55, 0.55)); ctx.stroke();
      ctx.fillStyle = COL.druidity; const [lx, ly] = at(0.82, 0.5); circle(lx, ly, 1.3 * s);
    }
  }
  ctx.globalAlpha = 1;
}
// The computer in the air: tumbling end over end, rising and falling in an arc, its shadow on the ground under it
// growing as it comes down.
function drawComputer(f, now) {
  const C = SILICA.gear.pc, k = Math.min(1, f.t / f.dur), z = Math.sin(k * Math.PI) * C.h, s = 1 + Math.sin(k * Math.PI) * 0.35;
  ctx.globalAlpha = 0.25 + 0.35 * k; ctx.fillStyle = '#000000'; ellipse(f.x, f.y + 4, 22 * (0.6 + 0.4 * k), 8 * (0.6 + 0.4 * k));
  ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = COL.bsod; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);            // where it will land
  ctx.beginPath(); ctx.ellipse(f.x1, f.y1, C.r, C.r * 0.42, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  drawComputer3D(f.x, f.y - z, s, 0.6 + f.t * f.spin * 0.55, 0.35 + f.t * f.spin);
  if (!reducedMotion && Math.random() < 0.5) {                                    // it crackles on the way down
    ctx.globalAlpha = 0.9; ctx.fillStyle = Math.random() < 0.5 ? COL.glitchA : COL.glitchB;
    ctx.fillRect(f.x + (Math.random() - 0.5) * 34, f.y - z + (Math.random() - 0.5) * 30, 3, 3);
  }
  ctx.globalAlpha = 1;
}
// BLUE SCREEN!: where it smashes, the ground turns into a blue screen, square and sharp, torn by glitch bars split into
// magenta and cyan; a white flash, rings going out, and a square of dead pixels flying off.
function drawBlueScreen(f, now) {
  const q = 1 - f.life / f.max, a = 1 - q, e = 1 - (1 - Math.min(1, q / 0.35)) ** 3, R = f.r * e, rnd = mulberry32(f.seed + Math.floor(now * 18));
  fxGlow(f.x, f.y, f.r * 1.3, COL.bsod, 0.8 * a);
  ctx.globalAlpha = 0.5 * a; ctx.fillStyle = COL.bsod; ctx.fillRect(f.x - R, f.y - R * 0.62, R * 2, R * 1.24);
  ctx.globalAlpha = 0.85 * a; ctx.lineWidth = 2.5;
  ctx.strokeStyle = COL.glitchA; ctx.strokeRect(f.x - R - 3, f.y - R * 0.62, R * 2, R * 1.24);
  ctx.strokeStyle = COL.glitchB; ctx.strokeRect(f.x - R + 3, f.y - R * 0.62 + 1, R * 2, R * 1.24);
  for (let k = 0; k < 7; k++) {                                                    // the glitch bars
    const y = f.y - R * 0.62 + rnd() * R * 1.24, w = R * (0.4 + rnd() * 1.4), h = 2 + rnd() * 6;
    ctx.globalAlpha = 0.8 * a; ctx.fillStyle = [COL.glitchA, COL.glitchB, '#ffffff'][k % 3]; ctx.fillRect(f.x - w / 2 + (rnd() - 0.5) * R, y, w, h);
  }
  ctx.globalAlpha = 0.18 * a; ctx.fillStyle = '#ffffff';                           // scanlines
  for (let y = f.y - R * 0.62; y < f.y + R * 0.62; y += 4) ctx.fillRect(f.x - R, y, R * 2, 1);
  if (q > 0.1 && q < 0.8) {
    ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(f.r * 0.3)}px "Chakra Petch", system-ui, sans-serif`; ctx.fillText(':(', f.x - R * 0.45, f.y - R * 0.18);
    ctx.font = '700 11px "Chakra Petch", system-ui, sans-serif'; ctx.fillText('FATAL ERROR', f.x + R * 0.18, f.y + R * 0.28);
  }
  if (q < 0.3) { const k = 1 - q / 0.3; fxAdd('#ffffff'); ctx.globalAlpha = k; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x - 26 * k, f.y - 18 * k, 52 * k, 36 * k); fxNormal(); }
  ctx.globalAlpha = 1;
}
