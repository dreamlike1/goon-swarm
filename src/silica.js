/* silica.js — The Silica pack's weapons (v0.42, user): Gatling Gun, Cryo Magus and Druid. Their bursts, the
   frost fields and the ring of ice, the Druid's summoned animals and the chimera's bombs. combat.js, combos.js and
   draw.js call in here. Every number is a placeholder. */
'use strict';

/* What they do (user):
   - Gatling Gun: fires 10 rounds of bullets. ×3: 3 bursts, and every round has a small blast. ×7: two gatlings, one on
     each side of you, 10 rounds each, with the blasts.
   - Cryo Magus: a homing ice blast that leaves a frost field where it lands; enemies in the field are slowed. ×3: the
     field bursts after a moment. ×7: spinning ice circles you, growing out from you to a large ring.
   - Druid: you summon a lion that pounces on the nearest enemy and bites it. ×3: a turtle whose stomping shakes the
     ground and damages enemies round it. ×7: a chimera that screams while bombs rain down. The animals are conjured
     white silhouettes that fight on their own — you stay yourself and keep moving. */
const SILICA = {
  gatling: { rounds: 10, gap: 0.045, spread: 0.12, bursts: 3, burstGap: 0.5, aoe: { radius: 30, dmg: 2 },
             twin: { offset: 16, dmg: 4, aoe: { radius: 42, dmg: 4 } } },          // ×7: each gun's rounds
  cryo: {
    slow: 0.45, chill: 0.25,                                  // chilled enemies move at 45% speed; a field chills for 0.25 s at a time
    field: { r: 72, life: 3 },
    burst: { r: 96, life: 1.5, dmg: 26 },                     // ×3: the field bursts after `life` s
    ring: { shards: 10, from: 24, to: 250, grow: 2.6, hold: 0.5, spin: 3.2, r: 9, dmg: 9, every: 0.35, chill: 1.5 },   // ×7
  },
  lion: { leap: 0.3, stay: 0.4, hop: 18, bite: 22 },          // the leap (s, it can't be hurt), the lion after it, hop height, bite damage
  turtle: { life: 4, speed: 0.55, cut: 0.5, every: 0.7, quake: { r: 125, dmg: 6, knock: 220 } },
  chimera: { life: 5, every: 0.14, fall: 0.55, reach: 320, scream: 0.55, bomb: { r: 58, dmg: 9 } },
};

function resetSilica() { game.fields = []; game.frost = null; game.summons = []; game.bombs = []; game.bites = []; game.muzzles = []; }

// A single card (combat.js shoot): each weapon's own attack. `o.raw` shots are plain projectiles (the bursts use them).
function silicaShot(card, e, o = {}) {
  if (card === 'gatling') { if (e) gatlingBurst(card, e, { rounds: SILICA.gatling.rounds }); }
  else if (card === 'cryo') { if (e) shoot(card, e, { ...o, raw: true, field: 'slow' }); }
  else if (card === 'shifter') { if (e) summonLion(card, e); }
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
    case 'shifter3': summonTurtle(card); return true;
    case 'shifter7': summonChimera(card); return true;
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
    if (from) game.muzzles.push({ x: from.x, y: from.y, a, life: 0.06 });
  });
}

/* ---------- Cryo Magus ---------- */
const chill = (e, t) => { if (!e.dummy) e.chill = Math.max(e.chill || 0, t); };
// A frost field where an ice blast lands. `kind` 'burst' (×3) is bigger and shatters when it runs out.
function iceField(x, y, kind, card) {
  const C = SILICA.cryo, F = kind === 'burst' ? C.burst : C.field;
  game.fields.push({ x, y, r: F.r, life: F.life, t: 0, burst: kind === 'burst', card, owner: ownerId() });
  game.rings.push({ x, y, r: 6, max: F.r, life: 0.3, color: COL.ice });
  burst(x, y, COL.ice, 14, 200);
  SFX.freeze(false);
}
function updateFields(dt) {
  const C = SILICA.cryo;
  for (let i = game.fields.length - 1; i >= 0; i--) {
    const f = game.fields[i];
    usePlayerId(f.owner);
    f.t += dt;
    for (const e of game.enemies) if (hitGap(e, f.x, f.y) < f.r) chill(e, C.chill);
    if (f.t < f.life) continue;
    game.fields.splice(i, 1);
    if (!f.burst) continue;
    blast(f.x, f.y, f.card, f.r * 1.05, damageOf(C.burst.dmg), { knock: 140, big: true });   // ×3: it shatters
    burst(f.x, f.y, COL.ice, 30, 340);
    SFX.shatter();
  }
}
// ×7: shards of ice spinning round you on a ring that grows from you out to `to` px, hitting what they touch.
function frostShards(f = game.frost, p = game.player) {
  const R = SILICA.cryo.ring;
  const k = Math.min(1, f.t / R.grow), ease = 1 - (1 - k) ** 2, rad = R.from + (R.to - R.from) * ease;
  return Array.from({ length: R.shards }, (_, i) => {
    const a = f.t * R.spin + (i / R.shards) * TAU;
    return { x: p.x + Math.cos(a) * rad, y: p.y + Math.sin(a) * rad, a };
  });
}
function updateFrost(dt) {
  const f = game.frost, R = SILICA.cryo.ring;
  if (!f) return;
  f.t += dt;
  if (f.t > R.grow + R.hold) { game.frost = null; return; }
  const shards = frostShards();
  for (const e of game.enemies.slice()) {
    if ((f.hits.get(e) || 0) > f.t) continue;
    const s = shards.find(s => hitGap(e, s.x, s.y) < R.r);
    if (!s) continue;
    f.hits.set(e, f.t + R.every);
    chill(e, R.chill);
    const d = Math.hypot(e.x - game.player.x, e.y - game.player.y) || 1;
    hitEnemy({ card: f.card, look: 'ice', dmg: damageOf(R.dmg), knock: knockOf(60), vx: (e.x - game.player.x) / d, vy: (e.y - game.player.y) / d, x: s.x, y: s.y }, e);
  }
}

/* ---------- Druid ---------- */
// The Druid conjures animals — white silhouettes that fight on their own. You stay yourself and keep moving.
// A summoned lion: springs up beside you and pounces on the enemy, biting it, then fades.
function summonLion(card, e) {
  const p = game.player, a = Math.atan2(e.y - p.y, e.x - p.x);
  const off = PLAYER.r + 14, sx = p.x - Math.cos(a) * off, sy = p.y - Math.sin(a) * off;   // appears just behind you
  const stop = Math.max(0, hitGap(e, sx, sy) - 14);
  game.summons.push({ owner: ownerId(), kind: 'lion', card, t: 0, life: SILICA.lion.leap + SILICA.lion.stay, face: a, x: sx, y: sy,
    leap: { x0: sx, y0: sy, x1: sx + Math.cos(a) * stop, y1: sy + Math.sin(a) * stop, target: e, done: false } });
  poof(sx, sy, '#fff');
  SFX.growl();
}
// A summoned beast that holds its ground where you called it (turtle ×3, chimera ×7).
function summonBeast(kind, card) {
  const S = SILICA[kind], p = game.player;
  game.summons.push({ owner: ownerId(), kind, card, t: 0, life: S.life, face: 0, x: p.x, y: p.y, next: kind === 'turtle' ? 0.25 : 0.3, scream: 0 });
  poof(p.x, p.y, '#fff');
  if (kind === 'chimera') { SFX.roar(); game.shake = Math.max(game.shake, 0.3); }
  else SFX.stomp(1);
}
const summonTurtle = (card) => summonBeast('turtle', card);
const summonChimera = (card) => summonBeast('chimera', card);
function poof(x, y, color) { burst(x, y, color, 16, 180); game.rings.push({ x, y, r: 6, max: 34, life: 0.3, color }); }
// A summoned lion mid-pounce: moves the lion (not you) along its leap, biting the enemy on landing.
function updateLion(s) {
  if (s.leap.done) return;
  const L = s.leap, k = Math.min(1, s.t / SILICA.lion.leap), e = k * (2 - k);
  s.x = L.x0 + (L.x1 - L.x0) * e; s.y = L.y0 + (L.y1 - L.y0) * e;
  if (k >= 1) {                                               // lands and bites
    L.done = true;
    const tg = L.target;
    if (game.enemies.includes(tg) && hitGap(tg, s.x, s.y) < 30) {
      const d = Math.hypot(tg.x - s.x, tg.y - s.y) || 1;
      hitEnemy({ card: s.card, look: 'bite', dmg: damageOf(SILICA.lion.bite), knock: knockOf(CARDS[s.card].knock), vx: (tg.x - s.x) / d, vy: (tg.y - s.y) / d, x: tg.x, y: tg.y }, tg);
      game.bites.push({ x: (s.x + tg.x) / 2, y: (s.y + tg.y) / 2, a: s.face, life: 0.22 });
      game.shake = Math.max(game.shake, 0.1);
      SFX.bite();
    }
  }
}

// Everything here that runs each frame (combat.js update, after movement).
function updateSilica(dt) {
  updateFields(dt);
  if (!NET.run) updateFrost(dt);                             // co-op: each player's own ring (coop.js)
  for (const b of game.bites) b.life -= dt;
  game.bites = game.bites.filter(b => b.life > 0);
  for (const m of game.muzzles) m.life -= dt;
  game.muzzles = game.muzzles.filter(m => m.life > 0);
  for (let i = game.summons.length - 1; i >= 0; i--) {        // the Druid's summoned animals
    const s = game.summons[i];
    usePlayerId(s.owner);                                      // co-op: it hits as whoever summoned it
    s.t += dt;
    if (s.kind === 'lion') updateLion(s);
    else if (s.kind === 'turtle' && (s.next -= dt) <= 0) {    // the turtle's stomp: the ground shakes and damages enemies round it
      s.next = SILICA.turtle.every;
      const Q = SILICA.turtle.quake;
      blast(s.x, s.y, s.card, Q.r, damageOf(Q.dmg), { knock: Q.knock });
      groundBreak(s.x, s.y + 4, 16);
      game.shake = Math.max(game.shake, 0.18);
      SFX.stomp(1);
    } else if (s.kind === 'chimera') {
      if ((s.scream -= dt) <= 0) { s.scream = SILICA.chimera.scream; game.rings.push({ x: s.x, y: s.y, r: 14, max: 90, life: 0.4, color: '#fff' }); }
      if ((s.next -= dt) <= 0) { s.next = SILICA.chimera.every; dropBomb(s.card, s); }
    }
    if (s.t >= s.life) { poof(s.x, s.y, '#fff'); game.summons.splice(i, 1); }
  }
  for (let i = game.bombs.length - 1; i >= 0; i--) {         // the chimera's bombs: they fall, then go off
    const b = game.bombs[i];
    usePlayerId(b.owner);
    b.t += dt;
    if (b.t < SILICA.chimera.fall) continue;
    game.bombs.splice(i, 1);
    const B = SILICA.chimera.bomb;
    blast(b.x, b.y, b.card, B.r, damageOf(B.dmg), { knock: 150 });
    SFX.boom();
  }
}
// A bomb falls on an enemy near the chimera (or anywhere round it if there are none).
function dropBomb(card, origin) {
  const p = origin || game.player, C = SILICA.chimera;
  const near = game.enemies.filter(e => !e.mrock && hitGap(e, p.x, p.y) < C.reach);
  const e = near[Math.floor(Math.random() * near.length)];
  const a = Math.random() * TAU, d = 40 + Math.random() * (C.reach - 60);
  const x = e ? e.x + (Math.random() - 0.5) * 20 : p.x + Math.cos(a) * d, y = e ? e.y + (Math.random() - 0.5) * 20 : p.y + Math.sin(a) * d;
  game.bombs.push({ x: Math.max(10, Math.min(W - 10, x)), y: Math.max(10, Math.min(H - 10, y)), t: 0, card, owner: origin?.owner ?? ownerId() });
}

/* ---------- drawing ---------- */
// On the floor, under everything: the frost fields and where the bombs will land.
function drawSilicaFloor() {
  const now = performance.now() / 1000;
  for (const f of game.fields) {
    const k = f.t / f.life, fade = Math.min(1, (f.life - f.t) * 3, f.t * 8);
    ctx.globalAlpha = 0.16 * fade; ctx.fillStyle = COL.ice; circle(f.x, f.y, f.r);
    ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = COL.ice; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35 * fade;       // frost crystals: six spokes, slowly turning
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + now * 0.3;
      ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * f.r * 0.2, f.y + Math.sin(a) * f.r * 0.2); ctx.lineTo(f.x + Math.cos(a) * f.r * 0.75, f.y + Math.sin(a) * f.r * 0.75); ctx.stroke();
    }
    if (f.burst) {                                            // ×3: a countdown ring closing in, and a flicker at the end
      ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = COL.player; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - k), 0, TAU); ctx.stroke();
      if (k > 0.75 && !reducedMotion && Math.floor(now * 16) % 2) { ctx.globalAlpha = 0.25; ctx.fillStyle = COL.player; circle(f.x, f.y, f.r); }
    }
    ctx.globalAlpha = 1;
  }
  for (const b of game.bombs) {                               // a red target that closes in as the bomb falls
    const k = b.t / SILICA.chimera.fall, R = SILICA.chimera.bomb.r;
    ctx.globalAlpha = 0.15 + 0.2 * k; ctx.fillStyle = COL.bad; circle(b.x, b.y, R * (0.4 + 0.6 * k));
    ctx.globalAlpha = 0.7; ctx.strokeStyle = COL.bad; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ellipse(b.x, b.y, 7 + 5 * k, 3 + 2 * k);   // its shadow
    ctx.globalAlpha = 1;
  }
}
// Over the enemies: frost on chilled enemies, the ring of ice, the bombs falling, the lion's bite.
// Chilled (v0.46, user: no circle, but it should look slowed): the enemy is frosted over (draw.js `chilled`, its legs
// and pincers in slow motion if it's a crab), with little ice sparkles drifting slowly up off it. The bosses also get
// frost at their feet.
function frostSparkles(e) {
  const big = e.boss || e.makora, n = big ? 6 : 3, now = performance.now() / 1000, seed = e.fs ?? (e.fs = e._id ? (e._id * 7.31) % 100 : Math.random() * 100);
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
  for (const e of [game.boss, game.makora]) if (e && e.chill > 0 && !e.down) {   // the big ones: frost at their feet
    ctx.globalAlpha = 0.4; ctx.fillStyle = COL.ice; ellipse(e.x, e.y + e.r * 0.6, e.r * 0.9, e.r * 0.25); ctx.globalAlpha = 1;
  }
  if (game.frost) drawFrostAt(game.frost, game.player);
  for (const b of game.bombs) {                               // falling in from above, growing as it comes
    const k = b.t / SILICA.chimera.fall, y = b.y - (1 - k) * 140;
    ctx.fillStyle = COL.line; circle(b.x, y, 6 + 2 * k);
    ctx.fillStyle = COL.chimeraWing; circle(b.x, y, 4.5 + 2 * k);
    ctx.fillStyle = COL.relic; circle(b.x + 2, y - 5 - 2 * k, 1.8);   // its fuse
  }
  for (const b of game.bites) {                               // the bite: two rows of teeth snapping shut
    const k = 1 - b.life / 0.22, gap = 10 * (1 - k);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI / 2); ctx.globalAlpha = Math.min(1, b.life * 8);
    ctx.fillStyle = COL.player;
    for (const s of [-1, 1]) for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 5 - 2.5, s * (gap + 6)); ctx.lineTo(i * 5 + 2.5, s * (gap + 6)); ctx.lineTo(i * 5, s * gap); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  for (const m of game.muzzles) { ctx.globalAlpha = m.life / 0.06; ctx.fillStyle = COL.gatling; circle(m.x + Math.cos(m.a) * 6, m.y + Math.sin(m.a) * 6, 5); ctx.globalAlpha = 1; }
  drawSummons();                                             // the Druid's animals, over the enemies
}
// The ring of ice round a player (yours, or a friend's in co-op).
function drawFrostAt(f, p) {
    const R = SILICA.cryo.ring, fade = Math.min(1, (R.grow + R.hold - f.t) * 3);
    for (const s of frostShards(f, p)) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a + Math.PI / 2); ctx.globalAlpha = fade;
      ctx.fillStyle = COL.ice; ctx.globalAlpha = 0.25 * fade; circle(0, 0, R.r + 5);
      ctx.globalAlpha = fade;                                 // a long ice crystal
      ctx.beginPath(); ctx.moveTo(0, -R.r * 1.4); ctx.lineTo(R.r * 0.55, 0); ctx.lineTo(0, R.r * 1.4); ctx.lineTo(-R.r * 0.55, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COL.player; ctx.beginPath(); ctx.moveTo(0, -R.r * 1.1); ctx.lineTo(R.r * 0.2, 0); ctx.lineTo(0, R.r * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
}
// The Cryo Magus's ice blast: a pale crystal with a frosty trail.
function drawIceShot(pr) {
  const t = pr.trail;
  ctx.fillStyle = COL.ice;
  for (let i = 0; i < t.length; i += 2) { ctx.globalAlpha = (i / t.length) * 0.4; circle(t[i], t[i + 1], pr.r * (0.3 + 0.6 * i / t.length)); }
  ctx.globalAlpha = 0.3; circle(pr.x, pr.y, pr.r + 5); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.spin * 0.3);
  ctx.fillStyle = COL.cryo;
  ctx.beginPath(); ctx.moveTo(0, -pr.r * 1.3); ctx.lineTo(pr.r, 0); ctx.lineTo(0, pr.r * 1.3); ctx.lineTo(-pr.r, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COL.player; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(0, -pr.r * 0.9); ctx.lineTo(pr.r * 0.35, 0); ctx.lineTo(0, pr.r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

const FORM_SCALE = 1.6;                                     // the animals are drawn this much bigger than their units
// The Druid's summoned animals (called from drawSilicaTop). Each is a conjured white silhouette at its own spot,
// side view, facing the way it's going.
function drawSummons() {
  if (game.inMenu) return;
  const t = performance.now() / 1000, S = FORM_SCALE;
  for (const s of game.summons) {
    const face = Math.cos(s.face) < 0 ? -1 : 1;
    const ending = s.life - s.t < 0.6 && !reducedMotion && Math.floor(t * 12) % 2;   // blinks as it fades away
    let hop = 0;
    if (s.kind === 'lion' && !s.leap.done) hop = Math.sin(Math.PI * Math.min(1, s.t / SILICA.lion.leap)) * SILICA.lion.hop;
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ellipse(s.x, s.y + 10 * S, 14 * S, 4 * S);
    ctx.globalAlpha = ending ? 0.5 : 0.9;                     // conjured: a translucent white silhouette
    ctx.save(); ctx.translate(s.x, s.y - hop); ctx.scale(face * S, S);
    if (s.kind === 'lion') drawLion(1, !s.leap.done ? 0.7 : 0, s.leap.done && s.t - SILICA.lion.leap < 0.2);
    else if (s.kind === 'turtle') drawTurtle(t);
    else drawChimera(t);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
// White silhouettes only — no interior detail. `s` size, `stretch` mid-leap (legs out), `bite` mouth open.
function drawLion(s, stretch = 0, bite = false) {
  ctx.save(); ctx.scale(s, s); ctx.fillStyle = '#fff';
  const leg = (x) => { ctx.save(); ctx.translate(x, 3); ctx.rotate((x > 0 ? -1 : 1) * stretch * 0.8); ctx.fillRect(-1.8, 0, 3.6, 8); ctx.restore(); };
  leg(-7); leg(6);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round';   // the tail, with its tuft
  ctx.beginPath(); ctx.moveTo(-11, -1); ctx.quadraticCurveTo(-18, -2, -17, -9); ctx.stroke();
  circle(-17, -10, 2.4);
  ellipse(0, 0, 12, 6.5);                                     // body
  leg(-5); leg(8);
  ctx.beginPath();                                           // the mane: a spiky ring round the head
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = i % 2 ? 7 : 9.5; ctx.lineTo(10 + Math.cos(a) * r, -5 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  circle(11, -5, 5.2);                                        // head
  circle(8.5, -10, 1.8);                                      // ear
  if (bite) { ctx.beginPath(); ctx.moveTo(13, -3.5); ctx.lineTo(18, -6); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill(); }   // open jaw
  ctx.restore();
}
function drawTurtle(t) {
  const wob = reducedMotion ? 0 : Math.sin(t * 30) * 0.8;     // the ground's shaking
  ctx.translate(wob, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-10, 3, 4, 6); ctx.fillRect(6, 3, 4, 6);       // legs
  circle(15, 1, 4.2);                                         // head
  ctx.beginPath(); ctx.moveTo(-13, 3); ctx.lineTo(-18, 5); ctx.lineTo(-13, 6); ctx.fill();   // tail
  ctx.beginPath(); ctx.ellipse(0, 4, 14, 13, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();  // the shell: a dome
  ctx.fillRect(-15, 3, 30, 3);                                // rim
}
function drawChimera(t) {
  const flap = reducedMotion ? 0 : Math.sin(t * 16) * 0.35;
  ctx.fillStyle = '#fff';                                     // bat wings over its back, flapping
  for (const [x, sc] of [[-2, 1], [2, 0.8]]) {
    ctx.save(); ctx.translate(x, -4); ctx.rotate(-0.4 - flap * sc);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -20); ctx.lineTo(-10, -12); ctx.lineTo(-16, -16); ctx.lineTo(-14, -6); ctx.lineTo(-20, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';   // a snake for a tail, with its head up
  ctx.beginPath(); ctx.moveTo(-13, 0); ctx.bezierCurveTo(-22, 2, -24, -8, -19, -12); ctx.stroke();
  circle(-18, -13, 2.6);
  drawLion(1.25, 0, true);                                    // a bigger lion, mouth open: screaming
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;               // goat horns
  ctx.beginPath(); ctx.moveTo(11, -12); ctx.quadraticCurveTo(8, -20, 3, -18); ctx.moveTo(15, -12); ctx.quadraticCurveTo(14, -21, 9, -21); ctx.stroke();
  if (!reducedMotion) {                                       // the scream: arcs out of its mouth
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const r = 6 + ((t * 40 + i * 7) % 21);
      ctx.globalAlpha = Math.max(0, 1 - r / 27);
      ctx.beginPath(); ctx.arc(22, -6, r, -0.7, 0.7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

resetSilica();
