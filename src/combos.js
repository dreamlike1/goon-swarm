/* combos.js — Card combos: a run of the same card in a sequence is played as ONE attack that uses up
   all of its slots and does something special. The rules are the user's; every number is a placeholder. */
'use strict';

/* ============================================================
   COMBOS[card][n]: what n of that card in a row does. A run is counted
   from the next card to fire. A run of 7 (the whole sequence) uses the
   7-combo if the card has one; otherwise runs are cut into chunks of the
   smaller size from their start (6 Bullets = two 3-combos; 5 Cannons =
   one 4-combo, then a single). Face-down cards break a run.
   Mines have no combo: their trait is the chain reaction (combat.js).
   ============================================================ */
const COMBOS = {
  bullet:      { 3: { name: 'RAPID!',        does: 'Fires all 3 Bullets in rapid fire.' },
                 7: { name: 'SHOTGUN!',      does: 'All 7 Bullets at once, like a shotgun.' } },
  dart:        { 3: { name: 'VOLLEY!',       does: 'Fires 3 Darts at once.' },
                 7: { name: 'STREAM!',       does: '7 Darts in a fast stream.' } },
  arcane:      { 3: { name: 'BIG BOLT!',     does: 'One large bolt that explodes on hit, +2 damage.' },
                 7: { name: 'PULSE!',        does: 'You pulse 7 times, hitting everything around you.' } },
  cannon:      { 4: { name: 'BLAST CANNONS!', does: 'All 4 fire faster, and each explodes on hit.' },
                 7: { name: 'MEGA CANNON!',  does: 'One massive cannonball: ×3 damage, in a big blast.' } },
  shuriken:    { 4: { name: 'SHURIKEN FAN!', does: 'All 4 fire, and each bounces 3 times.' },
                 7: { name: 'SHURIKEN STORM!', does: 'A super-fast Shuriken that bounces 7 times for ×2 damage.' } },
  spaceimpact: { 3: { name: 'IMPACT!',       does: '12 missiles in every direction.' },
                 7: { name: 'MEGA IMPACT!',  does: '24 missiles that each explode where they end.' } },
  firebolt:    { 3: { name: 'FIRE CONE!',    does: '3 Fire Bolts in a cone, twice.' } },
};
const TUNE = {
  rapidGap: 0.1,                                     // Bullet ×3: seconds between shots
  shotgunSpread: 0.9, spreadFly: 0.12,               // Bullet ×7: fan width (radians); spread shots fly straight this long, then home in
  streamGap: 0.06,                                   // Dart ×7
  bigBolt: { r: 11, add: 2, radius: 70 },            // Arcane ×3: size, extra damage, blast radius
  pulse: { count: 7, gap: 0.2, radius: 120 },        // Arcane ×7
  blastCannons: { gap: 0.12, speedMul: 1.8, radius: 60 },   // Cannon ×4
  megaCannon: { r: 24, mult: 3, speedMul: 0.9, radius: 140 },   // Cannon ×7
  fan: { gap: 0.08, bounces: 3 },                    // Shuriken ×4
  storm: { speedMul: 2.2, bounces: 7, mult: 2, range: 420 },   // Shuriken ×7
  burst: 12, megaBurst: 24, megaRange: 300, megaBlast: 45,     // Space Impact ×3 / ×7
  cone: { spread: 0.45, volleys: 2, gap: 0.2 },      // Fire Bolt ×3: cone width (radians), volleys, seconds between
};

// The combo that starts at `pos` in this sequence, if any: { card, n, name }.
function comboAt(seq, pos) {
  const card = seq[pos], table = card && COMBOS[card];
  if (!table) return null;
  let run = 0;
  while (pos + run < seq.length && seq[pos + run] === card) run++;
  const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (table[7] && run >= 7) return { card, n: 7, ...table[7] };
  const n = sizes.find(k => k !== 7 && run >= k);
  return n ? { card, n, ...table[n] } : null;
}
// Every combo still to come in this sequence, as { start, n, card }, for the tray.
function combosIn(seq, pos) {
  const out = [];
  for (let i = pos; i < seq.length;) {
    const cb = comboAt(seq, i);
    if (cb) { out.push({ start: i, n: cb.n, card: cb.card }); i += cb.n; } else i++;
  }
  return out;
}

// The nearest `n` enemies (repeating the nearest if there are fewer), for shots that each want their own target.
function targets(n) {
  const p = game.player;
  const byDist = game.enemies.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  return Array.from({ length: n }, (_, i) => byDist[i % Math.max(1, byDist.length)]).filter(Boolean);
}
const aimAngle = e => Math.atan2(e.y - game.player.y, e.x - game.player.x);

// Plays a combo. `echo`: it's the second play from an augmented slot (no callout).
function runCombo(cb, echo = false) {
  const p = game.player, { card } = cb, spec = CARDS[card], e0 = nearestEnemy();
  if (!e0 && card !== 'arcane') return;               // nothing to shoot at (the pulse still happens)
  if (!echo) {
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: cb.name, color: COL[card], life: 0.9, vy: -40, big: true });
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 50, life: 0.3, color: COL[card] });
    SFX.combo(cb.n);
  }
  const key = `${card}${cb.n}`;
  const alive = () => nearestEnemy();
  switch (key) {
    case 'bullet3':
      for (let k = 0; k < 3; k++) later(k * TUNE.rapidGap, () => { const e = alive(); if (e) shoot(card, e); });
      break;
    case 'bullet7': {                                  // a fan of 7, all at once
      const a0 = aimAngle(e0), ts = targets(7);
      for (let k = 0; k < 7; k++) shoot(card, ts[k], { angle: a0 + (k / 6 - 0.5) * TUNE.shotgunSpread, homeDelay: TUNE.spreadFly, quiet: k > 0 });
      game.shake = Math.max(game.shake, 0.12);
      break;
    }
    case 'dart3': {
      const ts = targets(3);
      ts.forEach((e, k) => shoot(card, e, { quiet: k > 0 }));
      break;
    }
    case 'dart7':
      for (let k = 0; k < 7; k++) later(k * TUNE.streamGap, () => { const e = alive(); if (e) shoot(card, e); });
      break;
    case 'arcane3':
      shoot(card, e0, { r: TUNE.bigBolt.r, dmg: spec.dmg + TUNE.bigBolt.add, aoe: { radius: TUNE.bigBolt.radius, dmg: spec.dmg + TUNE.bigBolt.add } });
      break;
    case 'arcane7':                                     // pulses centred on the player, wherever they move
      for (let k = 0; k < TUNE.pulse.count; k++) later(k * TUNE.pulse.gap, () => {
        blast(game.player.x, game.player.y, card, TUNE.pulse.radius, damageOf(spec.dmg), { knock: 120 });
        SFX.pulse();
      });
      break;
    case 'cannon4':
      for (let k = 0; k < 4; k++) later(k * TUNE.blastCannons.gap, () => {
        const e = alive();
        if (e) shoot(card, e, { speedMul: TUNE.blastCannons.speedMul, aoe: { radius: TUNE.blastCannons.radius, dmg: spec.dmg } });
      });
      break;
    case 'cannon7': {
      const m = TUNE.megaCannon, dmg = spec.dmg * m.mult;
      shoot(card, e0, { r: m.r, dmg, speedMul: m.speedMul, aoe: { radius: m.radius, dmg } });
      game.shake = Math.max(game.shake, 0.25);
      break;
    }
    case 'shuriken4':
      for (let k = 0; k < 4; k++) later(k * TUNE.fan.gap, () => { const e = targets(4)[k] || alive(); if (e) shoot(card, e, { bounces: TUNE.fan.bounces }); });
      break;
    case 'shuriken7': {
      const s = TUNE.storm;
      shoot(card, e0, { speedMul: s.speedMul, bounces: s.bounces, dmg: spec.dmg * s.mult, bounceRange: s.range, r: spec.r + 2 });
      break;
    }
    case 'spaceimpact3':
    case 'spaceimpact7': {
      const mega = cb.n === 7, count = mega ? TUNE.megaBurst : TUNE.burst, a0 = aimAngle(e0);
      const o = mega ? { range: TUNE.megaRange, endBlast: { radius: TUNE.megaBlast, dmg: damageOf(spec.dmg) } } : {};
      for (let k = 0; k < count; k++) launch(card, a0 + (k / count) * Math.PI * 2, null, o);
      SFX.burst();
      game.shake = Math.max(game.shake, mega ? 0.16 : 0.1);
      break;
    }
    case 'firebolt3':
      for (let v = 0; v < TUNE.cone.volleys; v++) later(v * TUNE.cone.gap, () => {
        const e = alive();
        if (!e) return;
        const a0 = aimAngle(e), ts = targets(3);
        for (let k = 0; k < 3; k++) shoot(card, ts[k], { angle: a0 + (k - 1) * TUNE.cone.spread, homeDelay: TUNE.spreadFly, quiet: k > 0 });
      });
      break;
  }
}
