/* combos.js — Card combos: a run of the same card in a sequence is played as ONE attack that uses up
   all of its slots and does something special. The rules are the user's; every number is a placeholder. */
'use strict';

/* ============================================================
   COMBOS[card][n]: what n of that card in a row does. A run is counted
   from the next card to fire. A run of 7 (the whole sequence) uses the
   7-combo if the card has one; otherwise runs are cut into chunks of the
   smaller size from their start (6 Bullets = two 3-combos; 5 Cannons =
   one 4-combo, then a single). Face-down cards break a run.
   The smaller combo is the card's "passive" and the 7 its "ult" (the store's
   pack preview calls them that). Mines also chain: a blast sets off any mine
   inside it (combat.js). Mine ×3/×7 and Arcane Fire ×7 are placeholders (v0.6),
   so every card has both.
   ============================================================ */
const COMBOS = {
  bullet:      { 3: { name: 'RAPID!',        does: 'Fires all 3 Bullets in rapid fire at one enemy.' },
                 7: { name: 'SHOTGUN!',      does: 'All 7 Bullets at once in a wide cone, like a shotgun.' } },
  laser:       { 3: { name: 'TRIPLE ZAP!',   does: '3 lasers at once, at up to 3 enemies.' },
                 7: { name: 'LASER SWEEP!',  does: 'Fires a line, then sweeps it all the way round, super fast, hitting everything it touches.' } },
  arcane:      { 3: { name: 'BIG BLAST!',    does: 'One large orb that explodes on hit, +2 damage.' },
                 7: { name: 'PULSE!',        does: 'You pulse 7 times, hitting everything around you.' } },
  cannon:      { 4: { name: 'BLAST CANNONS!', does: 'All 4 fire faster, and each explodes on hit.' },
                 7: { name: 'MEGA CANNON!',  does: 'One massive cannonball: ×3 damage, in a big blast.' } },
  shuriken:    { 4: { name: 'BOLT FAN!',     does: 'All 4 fire, and each bounces 3 times.' },
                 7: { name: 'BOLT STORM!',   does: 'A super-fast Arcane Bolt that bounces 7 times for ×2 damage.' } },
  spaceimpact: { 3: { name: 'IMPACT!',       does: '12 missiles in every direction.' },
                 7: { name: 'MEGA IMPACT!',  does: '24 missiles that each explode where they end.' } },
  firebolt:    { 3: { name: 'FIRE CONE!',    does: '3 bolts of Arcane Fire straight out in a cone, twice.' },
                 7: { name: 'INFERNO!',      does: 'A ring of 14 bolts of Arcane Fire, straight out in every direction.' } },
  mine:        { 3: { name: 'MINEFIELD!',    does: '3 mines at once, spread around you.' },
                 7: { name: 'MINE RING!',    does: '7 mines in a ring around you. One blast can set off the lot.' } },
  // v0.30 (user): Sniper ×3 fires 3 shots that pierce; ×7 a super large shot that pierces and explodes at the end.
  sniper:      { 3: { name: 'PIERCING SHOTS!', does: '3 shots that pierce through every enemy in their line.' },
                 7: { name: 'RAILGUN!',      does: 'One huge round that pierces everything for ×2 damage, then explodes where it ends.' } },
  // v0.30 (user): Arcane Missiles ×2 fires 4 right away; ×7 fires 7 super-fast missiles that split in two on a hit.
  missiles:    { 2: { name: 'BARRAGE!',      does: 'Fires 4 missiles at once.' },
                 7: { name: 'MISSILE STORM!', does: '7 super-fast missiles. Each splits into 2 more when it hits.' } },
  // The Silica pack (v0.42, user). Their attacks are in silica.js.
  gatling:     { 3: { name: 'BULLET HELL!',  does: '3 bursts of 10 rounds, and every round explodes in a small blast.' },
                 7: { name: 'TWIN GATLINGS!', does: 'Two gatlings, one each side of you: 10 rounds each, harder, with bigger blasts.' } },
  cryo:        { 3: { name: 'FROST BOMB!',   does: 'A bigger ice blast whose frost field bursts after a moment.' },
                 7: { name: 'BLIZZARD!',     does: 'Spinning ice circles you, growing out from you to a large ring. It hits and slows what it touches.' } },
  shifter:     { 3: { name: 'QUAKE!',        does: 'Summon a turtle whose stomping shakes the ground and damages enemies around it.' },
                 7: { name: 'CHIMERA!',      does: 'Summon a chimera that screams while bombs rain down on nearby enemies.' } },
  // The Powerwash pack (user). Their attacks are in combat.js (spray, popBubble, superSweep).
  pressurewasher: { 3: { name: 'WASH CONE!', does: 'One wide cone of spray, like a slash.' },
                    7: { name: 'DELUGE!',    does: '7 long sprays, each in a random direction.' } },
  soapgun:        { 3: { name: 'BUBBLE RUSH!', does: '9 rapid bubbles that stun on a hit.' },
                    7: { name: 'BUBBLE TRAP!', does: 'One giant bubble in a single direction that traps enemies inside, then pops, pushing them out.' } },
  superwasher:    { 3: { name: 'TRIPLE SPIN!', does: '3 rapid full spins around you.' },
                    7: { name: 'SOAK TRAIL!', does: '7 seconds of extra speed with an exploding bubble trail, both sprays spinning the whole time.' } },
};
const TUNE = {
  rapidGap: 0.1,                                     // Bullet ×3: seconds between shots
  shotgunSpread: 0.9,                                // Bullet ×7: fan width (radians); cone shots fly straight, no homing
  sweep: { hold: 0.12, dur: 0.4, mult: 4 },          // Laser ×7: holds the line this long, sweeps a full turn in `dur` s, ×4 damage
  inferno: 14,                                       // Arcane Fire ×7: bolts in the ring
  minefield: 42, mineRing: 70,                       // Mine ×3 / ×7: how far from you the mines land
  bigBolt: { r: 11, add: 2, radius: 70 },            // Arcane ×3: size, extra damage, blast radius
  pulse: { count: 7, gap: 0.2, radius: 120 },        // Arcane ×7
  blastCannons: { gap: 0.12, speedMul: 1.8, radius: 60 },   // Cannon ×4
  megaCannon: { r: 24, mult: 3, speedMul: 0.9, radius: 140 },   // Cannon ×7
  fan: { gap: 0.08, bounces: 3 },                    // Shuriken ×4
  storm: { speedMul: 2.2, bounces: 7, mult: 2, range: 420 },   // Shuriken ×7
  burst: 12, megaBurst: 24, megaRange: 300, megaBlast: 45,     // Space Impact ×3 / ×7
  cone: { spread: 0.45, volleys: 2, gap: 0.2 },      // Fire Bolt ×3: cone width (radians), volleys, seconds between
  pierceShots: { gap: 0.14 },                         // Sniper ×3: seconds between the 3 shots
  railgun: { r: 12, mult: 2, radius: 130 },           // Sniper ×7: size, damage ×, blast radius where it ends
  missile: { spread: 0.75, curve: 0.16, turn: 7 },    // Arcane Missiles: fan-out angle, straight time, turn rate (rad/s, grows)
  barrage: { count: 4, spread: 1.25 },                // Arcane Missiles ×2
  storm: { count: 7, speedMul: 2.2, split: 2 },       // Arcane Missiles ×7: each splits into `split` on a hit
  // The Powerwash pack (user).
  washCone: { arc: 1.7 },                                       // Pressure Washer ×3: the cone's width (radians)
  deluge: { count: 7, gap: 0.12 },                              // Pressure Washer ×7
  bubbleRush: { count: 9, gap: 0.09, stun: 0.6 },                // Soap Gun ×3
  bubbleTrap: { r: 18, stun: 1.1, radius: 110, knock: 520 },   // Soap Gun ×7
  tripleSpin: { count: 3, gap: 0.5 },                            // Super Washer ×3
  soakTrail: { time: 7, speedMul: 1.6, every: 1.1, dropEvery: 0.18, trailDelay: 0.5, trailRadius: 55 },   // Super Washer ×7
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

// The nearest `n` enemies within `range` (repeating the nearest if there are fewer), for shots that each want their own target.
function targets(n, range = Infinity) {
  const p = game.player, dist = e => hitGap(e, p.x, p.y);   // to its edge, like nearestEnemy
  const byDist = game.enemies.filter(e => dist(e) <= range).sort((a, b) => dist(a) - dist(b));
  return Array.from({ length: n }, (_, i) => byDist[i % Math.max(1, byDist.length)]).filter(Boolean);
}
const aimAngle = e => Math.atan2(e.y - game.player.y, e.x - game.player.x);

// Plays a combo. `echo`: it's the second play from an augmented slot (no callout).
function runCombo(cb, echo = false) {
  const p = game.player, { card } = cb, spec = CARDS[card], range = rangeOf(card), e0 = inRange(card) || nearestEnemy();
  if (!e0 && card !== 'arcane' && card !== 'mine' && card !== 'shifter' && card !== 'cryo') return;   // nothing to shoot at (the pulse, mines, forms and ice ring still happen)
  const aim = e => aimAt(p.x, p.y, e, spec.speed).a;         // leads a moving target (the Sniper's shots fly straight)
  if (!echo) {
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: cb.name, color: COL[card], life: 0.9, vy: -40, big: true });
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 50, life: 0.3, color: COL[card] });
    SFX.combo(cb.n, card);
  }
  const key = `${card}${cb.n}`;
  // Rapid fire stays on the enemy it started on (user: less aimbot). If that enemy dies, the rest of the
  // shots fly straight on in its last direction instead of finding a new target.
  let lockAngle = e0 ? aimAngle(e0) : 0;
  const atLocked = o => {
    if (game.enemies.includes(e0)) { lockAngle = aimAngle(e0); shoot(card, e0, o); }
    else shoot(card, e0, { ...o, angle: lockAngle, noHome: true });
  };
  if (CARDS[card].silica) { silicaCombo(cb, e0); return; }   // the Silica pack (silica.js)
  switch (key) {
    case 'bullet3':
      for (let k = 0; k < 3; k++) later(k * TUNE.rapidGap, () => atLocked({}));
      break;
    case 'bullet7': {                                  // a fan of 7, all at once, each straight along its own line (no homing)
      const a0 = aimAngle(e0);
      for (let k = 0; k < 7; k++) shoot(card, e0, { angle: a0 + (k / 6 - 0.5) * TUNE.shotgunSpread, noHome: true, quiet: k > 0 });
      game.shake = Math.max(game.shake, 0.12);
      break;
    }
    case 'laser3': {
      const ts = targets(3, range);
      (ts.length ? ts : [e0]).forEach((e, k) => zap(card, e, { quiet: k > 0 }));
      break;
    }
    case 'laser7':                                      // a line at the target, then one fast sweep all the way round
      sweep(card, aimAngle(e0), rangeOf(card), damageOf(spec.dmg * TUNE.sweep.mult));
      break;
    case 'mine3':
    case 'mine7': {
      const n = cb.n === 7 ? 7 : 3, d = cb.n === 7 ? TUNE.mineRing : TUNE.minefield, a0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < n; k++) dropMine(card, a0 + (k / n) * Math.PI * 2, d, k > 0);
      break;
    }
    case 'firebolt7': {
      const a0 = e0 ? aimAngle(e0) : 0;
      for (let k = 0; k < TUNE.inferno; k++) shoot(card, e0, { angle: a0 + (k / TUNE.inferno) * Math.PI * 2, noHome: true, quiet: k > 0 });
      game.shake = Math.max(game.shake, 0.14);
      break;
    }
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
      for (let k = 0; k < 4; k++) later(k * TUNE.blastCannons.gap, () =>
        atLocked({ speedMul: TUNE.blastCannons.speedMul, aoe: { radius: TUNE.blastCannons.radius, dmg: spec.dmg } }));
      break;
    case 'cannon7': {
      const m = TUNE.megaCannon, dmg = spec.dmg * m.mult;
      shoot(card, e0, { r: m.r, dmg, speedMul: m.speedMul, aoe: { radius: m.radius, dmg } });
      game.shake = Math.max(game.shake, 0.25);
      break;
    }
    case 'shuriken4':
      for (let k = 0; k < 4; k++) later(k * TUNE.fan.gap, () => { const e = targets(4, range)[k] || inRange(card); if (e) shoot(card, e, { bounces: TUNE.fan.bounces }); });
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
    case 'sniper3':                                     // 3 quick shots at the same enemy, each piercing everything in its line
      for (let k = 0; k < 3; k++) later(k * TUNE.pierceShots.gap, () => {
        const e = game.enemies.includes(e0) ? e0 : inRange(card);
        if (e) lockAngle = aim(e);
        launch(card, lockAngle, e || e0, { pierce: Infinity });
      });
      break;
    case 'sniper7': {                                   // one huge round through everything, then a blast where it ends
      const r = TUNE.railgun, a = aim(e0), dmg = spec.dmg * r.mult;
      launch(card, a, e0, { pierce: Infinity, r: r.r, dmg, range: edgeDist(p.x, p.y, a), endBlast: { radius: r.radius, dmg: damageOf(dmg) }, big: true });
      game.shake = Math.max(game.shake, 0.22);
      break;
    }
    case 'missiles2':                                   // 4 at once, fanned wide, each at its own target if there are enough
    case 'missiles7': {
      const storm = cb.n === 7, n = storm ? TUNE.storm.count : TUNE.barrage.count, ts = targets(n, range), a0 = aimAngle(e0);
      for (let k = 0; k < n; k++) {
        const side = n > 1 ? k / (n - 1) - 0.5 : 0;
        shoot(card, ts[k] || e0, { one: true, angle: a0 + side * 2 * TUNE.barrage.spread, quiet: k > 0,
          ...(storm ? { speedMul: TUNE.storm.speedMul, split: TUNE.storm.split } : {}) });
      }
      break;
    }
    case 'firebolt3': {                                // both volleys follow the cone aimed at the start, straight (no homing)
      const a0 = aimAngle(e0);
      for (let v = 0; v < TUNE.cone.volleys; v++) later(v * TUNE.cone.gap, () => {
        for (let k = 0; k < 3; k++) shoot(card, e0, { angle: a0 + (k - 1) * TUNE.cone.spread, noHome: true, quiet: k > 0 });
        SFX.fire(card);
      });
      break;
    }
    // The Powerwash pack (user).
    case 'pressurewasher3':                            // WASH CONE!: one wide cone of spray
      spray(card, e0 ? aimAngle(e0) : 0, TUNE.washCone.arc, range, { dmg: spec.dmg });
      break;
    case 'pressurewasher7': {                          // DELUGE!: 7 long sprays, each a random direction
      const D = TUNE.deluge;
      for (let k = 0; k < D.count; k++) later(k * D.gap, () => spray(card, Math.random() * Math.PI * 2, spec.arc, range * 1.3, { dmg: spec.dmg, quiet: k > 0 }));
      game.shake = Math.max(game.shake, 0.1);
      break;
    }
    case 'soapgun3': {                                 // BUBBLE RUSH!: 9 rapid bubbles that stun on a hit
      const R = TUNE.bubbleRush;
      for (let k = 0; k < R.count; k++) later(k * R.gap, () => {
        const e = (e0 && game.enemies.includes(e0)) ? e0 : inRange(card);
        if (e) shoot(card, e, { r: spec.r - 1, dmg: Math.round(spec.dmg * 0.6), split: 0, stun: R.stun, quiet: k > 0 });
      });
      break;
    }
    case 'soapgun7': {                                 // BUBBLE TRAP!: one giant bubble that traps, then pops, pushing enemies out
      const T = TUNE.bubbleTrap, a = aim(e0);
      launch(card, a, e0, { r: T.r, dmg: spec.dmg, endBlast: { radius: T.radius, dmg: damageOf(spec.dmg), stun: T.stun, knock: T.knock }, big: true });
      game.shake = Math.max(game.shake, 0.16);
      break;
    }
    case 'superwasher3': {                             // TRIPLE SPIN!: 3 rapid full spins around you
      const S = TUNE.tripleSpin;
      for (let k = 0; k < S.count; k++) later(k * S.gap, () => superSweep(card, range, spec.dmg));
      break;
    }
    case 'superwasher7':                               // SOAK TRAIL!: speed boost + exploding bubble trail, both sprays spinning
      startSoak(card, range, spec.dmg);
      break;
  }
}
