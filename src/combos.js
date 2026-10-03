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
   inside it (combat.js). Mine ×3/×7 were placeholders (v0.6),
   so every card had both.
   ============================================================ */
const COMBOS = {
  // melee (v0.53, user): melee.js plays these
  // v0.58 (user's weapon rework, 1stchange.md): the Commons have a passive only (×3), no ult.
  knife:       { 3: { name: 'STAB FLURRY!',  does: 'Fast stabs in a cone, one after another.' } },
  punch:       { 3: { name: 'VESSEL BURST!', does: 'A fist wrapped in a light blue and black aura. Whatever it hits glows in a blue aura, then 1 s later explodes, hurting everything close to it.' },
                 7: { name: 'BLACK FLASH!',  does: 'An impact frame and black lightning. For 2 s: super fast, more damage, faster regen and a flurry of punches.' } },
  slap:        { 3: { name: 'MEGA SLAP!',    does: 'One huge slap: even less damage, but it knocks enemies very far.' } },
  rambo:       { 3: { name: 'RAMBO!',        does: '4 slices, each from a random direction all round you.' } },
  // the Standard pack's new ones (v0.59, user)
  hammer:      { 3: { name: 'FAULT LINE!',   does: 'Slams the ground: it cracks open in a line toward the enemy, hitting everything along it.' },
                 7: { name: 'TRIPLE QUAKE!', does: 'Slams the ground 3 times. Each slam hits everything in a circle round you, bigger every time.' } },
  fistopheles: { 3: { name: "DEVIL'S COMBO!", does: 'A 3-hit combo: a giant hit, a long straight punch, then a clap of two giant hands.' },
                 7: { name: 'HELL BARRAGE!', does: 'A flurry of huge, long-range astral punches with a bigger hitbox, and the clapping demon hands between them.' } },
  blowpipe:    { 3: { name: 'SLEEP CONE!',   does: '3 darts in a cone. Each puts what it hits to sleep.' },
                 7: { name: 'BERSERK!',      does: 'A red dart: the enemy it hits goes berserk and attacks the other enemies, its own life draining with every bite.' } },
  karishnikov: { 3: { name: 'LINE SHOT!',    does: 'A red line onto a target, reaching right across the arena, then 3 rounds down it, each one harder than the last, through everything on the line.' },   // (v0.66, user)
                 7: { name: 'JAMMED!',       does: 'A heavy round down a line, then the gun jams. When it clears, it fires a much wider cone.' } },
  enpassant:   { 3: { name: "QUEEN'S GAMBIT!", does: '8 queens, one in every direction, each attacking 6 squares.' },
                 7: { name: 'YOU ARE KING!', does: 'A crown on you: every enemy in the 3 × 3 squares round you is killed (bosses take heavy damage).' } },
  bullet:      { 3: { name: 'RAPID!',        does: 'Fires 3 rounds in rapid fire at one enemy.' } },
  shotgun:     { 3: { name: 'DOUBLE BARREL!', does: 'Fires a second blast right after the first, in a wider spread.' } },
  brickshot:   { 3: { name: 'BRICK TRIO!',   does: '3 bricks at once, each bouncing like a single one.' },
                 7: { name: 'BRICK STORM!',  does: '7 bricks at once, each bouncing like a single one.' } },
  laser:       { 3: { name: 'RAPID ZAP!',    does: '3 lasers in rapid fire.' },
                 7: { name: 'CHAIN ZAP!',    does: 'One laser that jumps from enemy to enemy, 7 of them in super quick succession.' } },
  grapeshot:   { 3: { name: 'BACKSHOT!',     does: 'Fires a second shell behind you too.' },
                 7: { name: 'GRAPE RAIN!',   does: '21 shots rain down at random all over the arena.' } },
  flashbang:   { 3: { name: 'FLASH BURN!',   does: 'The flash hurts too: everything dazed takes damage.' },
                 7: { name: 'WHITEOUT!',     does: 'Thrown at the farthest enemy: a huge flash that dazes and hurts everything in a large area.' } },
  cannon:      { 3: { name: 'CANNONADE!',    does: '3 cannonballs, one after another at random moments.' },
                 7: { name: 'MEGA CANNON!',  does: 'One super large cannonball: ×3 damage, and a huge blast where it lands.' } },
  // v0.60 (user's Ulti Magus pack): ×3 bounces 3 more times, ×7 7 more and splits in two (it was ×4 BOLT FAN!, ×7 BOLT STORM!)
  shuriken:    { 3: { name: 'RICOCHET!',     does: 'An Arcane Bolt that bounces 3 more times.' },
                 7: { name: 'SPLIT BOLT!',   does: 'A faster Arcane Bolt that bounces 7 more times, and splits in two on its first hit.' } },
  spaceimpact: { 3: { name: 'IMPACT!',       does: '12 rockets in every direction.' },
                 7: { name: 'MEGA IMPACT!',  does: '36 rockets that each explode in a big blast where they end.' } },
  mine:        { 3: { name: 'MINEFIELD!',    does: '3 mines at once, spread around you.' } },   // (v0.58, user: no ×7)
  // v0.30 (user): Sniper ×3 fires 3 shots that pierce; ×7 a super large shot that pierces and explodes at the end.
  sniper:      { 3: { name: 'PIERCING SHOTS!', does: '3 shots that pierce through every enemy in their line.' },
                 7: { name: 'RAILGUN!',      does: 'One huge round that pierces everything for ×2 damage, then explodes where it ends.' } },
  // v0.30 (user): Arcane Missiles ×2 fires 4 right away; ×7 fires 7 super-fast missiles that split in two on a hit.
  // v0.66 (user): it fires 4 now, so ×3 fires 7 and ×7 fires 11.
  missiles:    { 3: { name: 'BARRAGE!',      does: 'Fires 7 missiles at once.' },
                 7: { name: 'MISSILE STORM!', does: '11 super-fast missiles. Each splits into 2 more when it hits.' } },
  // The Ulti Magus pack's new ones (v0.60, user). Their attacks are in magus.js. (The Commons have a passive only.)
  twinflame:   { 3: { name: 'FOUR FLAMES!',  does: '4 fire bolts at once, each at its own enemy.' } },
  arcana:      { 3: { name: 'ARCANE PIERCE!', does: 'A bigger diamond that pierces the first enemy it hits. If it hits another one too, both are stunned.' } },
  explomagus:  { 3: { name: 'CHAIN BLAST!',  does: 'If the blast kills, a circle opens where the enemy died and explodes too.' },
                 7: { name: 'BLAST WALK!',   does: 'For 1 s, the ground you walk over explodes behind you.' } },
  gravamagus:  { 3: { name: 'GRAVITY PULL!', does: 'Everything caught in the swirl is pulled into its centre before it goes off.' },
                 7: { name: 'EVENT HORIZON!', does: 'A huge circle round you for 5 s. Everything inside it is slowed.' } },
  darkmagus:   { 3: { name: 'DARK PATH!',    does: 'A large rectangle of dark energy toward the enemy: everything on it is hurt and slowed.' },
                 7: { name: 'VOID LASER!',   does: 'Dark energy is sucked into you, then powerful dark lasers blast out in random directions.' } },
  druidity:    { 3: { name: 'SEED BOMB!',    does: 'Throws a seed bomb into a crowd of enemies; a circle shows where it lands. It bursts into seedlings and corrupts the ground: everything on it is slowed and hurt, and some of that damage heals you.' },   // (v0.66, user; TIMBER! before)
                 7: { name: 'OVERGROWTH!',   does: 'For 3 s, vines burst up out of the ground all round you. Each grabs whatever is on it, holds it and drags it down into the ground, hurting it.' } },
  // The Silica pack (v0.42, user). Their attacks are in silica.js.
  gatling:     { 3: { name: 'BULLET HELL!',  does: '3 bursts of 10 rounds, and every round explodes in a small blast.' },
                 7: { name: 'TWIN GATLINGS!', does: 'Two gatlings, one each side of you: 10 rounds each, harder, with bigger blasts.' } },
  cryo:        { 3: { name: 'FROST BOMB!',   does: 'A bigger ice blast whose frost field bursts after a moment.' },
                 7: { name: 'BLIZZARD!',     does: 'A blizzard swirls round you, growing to a large circle: everything in it is hurt, slowed and dragged round, then it explodes in a burst of ice.' } },
  geartoss:    { 3: { name: 'SCRAP HEAP!',   does: 'Throws a spray of gears and other parts with a little knockback. The gears still zap and confuse.' },   // (v0.60, user)
                 7: { name: 'BLUE SCREEN!',  does: 'Throws a whole computer. It smashes where it lands: everything round it is hurt and glitched, confused for 3 s.' } },
  // The Powerwash pack (user). Their attacks are in combat.js (spray, popBubble, superSweep).
  pressurewasher: { 3: { name: 'WASH CONE!', does: 'A jet of spray, swept left to right.' },
                    7: { name: 'DELUGE!',    does: '7 wide cones of spray, each in a random direction.' } },
  soapgun:        { 3: { name: 'BUBBLE RUSH!', does: '9 rapid bubbles that stun on a hit.' },
                    7: { name: 'BUBBLE TRAP!', does: 'One giant bubble in a single direction that traps enemies inside, then pops, pushing them out.' } },
  superwasher:    { 3: { name: 'TRIPLE SPIN!', does: '3 super fast spins around you, one straight after the other.' },   // (v0.65, user: "spins super fast")
                    7: { name: 'SOAK TRAIL!', does: 'For 4 s the jets spin super fast the whole time and you go slippery: fast, sliding about, leaving a trail of bubbles that burst.' } },
  // The T-Balls pack (v0.56, user): both balls share these, and only in a deck with other cards too (comboAt). tballs.js plays them.
  tball:  { 3: { name: 'GO WILD!',   does: 'Every ball goes wild, flying into the enemies near you with red trails.' },
            7: { name: 'QUAD SHOT!', does: '4 very fast shots at the nearest enemies, each with a little blast where it hits.' } },
  tballm: { 3: { name: 'GO WILD!',   does: 'Every ball goes wild, flying into the enemies near you with red trails.' },
            7: { name: 'QUAD SHOT!', does: '4 very fast shots at the nearest enemies, each with a little blast where it hits.' } },
};
const TUNE = {
  rapidGap: 0.1,                                     // Bullet ×3: seconds between shots
  shotgunSpread: 0.9,                                // Bullet ×7: fan width (radians); cone shots fly straight, no homing
  sweep: { hold: 0.12, dur: 0.4, mult: 4 },          // Laser ×7: holds the line this long, sweeps a full turn in `dur` s, ×4 damage
  minefield: 42, mineRing: 70,                       // Mine ×3 / ×7: how far from you the mines land
  blastCannons: { gap: 0.12, speedMul: 1.8, radius: 60 },   // Cannon ×4
  cannonade: { gaps: [0.08, 0.45] },                 // Cannon ×3 (v0.58): each of the 3 waits a random time in this range after the last
  megaCannon: { r: 32, mult: 3, speedMul: 0.8, radius: 190 },   // Cannon ×7 (v0.58: super large, a huge blast)
  rapidZap: { gap: 0.09 },                           // Laser ×3 (v0.58)
  chainZap: { count: 7, gap: 0.05, reach: 230 },     // Laser ×7 (v0.58): jumps to the nearest enemy it hasn't hit, within `reach`
  brick: { spread: 0.5 },                            // Brickshot ×3 / ×7: how far apart they fan out (radians, each side)
  doubleBarrel: { gap: 0.12, spread: 1.25 },         // Shotgun ×3: the second blast, and how wide it spreads
  backshot: { range: 220 },                          // Grapeshot ×3: how far the shell behind you flies before it bursts
  grapeRain: { count: 21, gap: 0.06, fall: 240, radius: 26, dmg: 6 },   // Grapeshot ×7: shots dropping from `fall` px up, a small blast each
  flashBurn: { dmg: 8 },                             // Flashbang ×3
  whiteout: { radius: 210, dmg: 12, daze: 2.6 },     // Flashbang ×7
  ricochet: { more: 3 },                              // Arcane Bolt ×3 (v0.60): bounces this many more than a single one
  splitBolt: { more: 7, speedMul: 1.6, mult: 1.5 },   // Arcane Bolt ×7: more bounces, faster, harder, and it splits on its first hit (magus.js)
  burst: 12, megaBurst: 36, megaRange: 320, megaBlast: 75, megaDmg: 1.5,   // Space Impact ×3 / ×7 (v0.58: more rockets, bigger blasts)
  pierceShots: { gap: 0.14 },                         // Sniper ×3: seconds between the 3 shots
  railgun: { r: 12, mult: 2, radius: 130 },           // Sniper ×7: size, damage ×, blast radius where it ends
  missile: { spread: 0.75, curve: 0.16, turn: 7 },    // Arcane Missiles: fan-out angle, straight time, turn rate (rad/s, grows)
  barrage: { count: 7, spread: 1.25 },                // Arcane Missiles ×3 (v0.66: 7, it was ×2's 4)
  storm: { count: 11, speedMul: 2.2, split: 2 },       // Arcane Missiles ×7: each splits into `split` on a hit
  // The Powerwash pack (user).
  // Pressure Washer ×3 (user): a toned-down jet swept left to right across `span` radians, in `steps` quick flashes.
  washCone: { arc: 0.3, span: 1.1, steps: 6, gap: 0.035 },
  deluge: { count: 7, gap: 0.12, arc: 1.7 },                     // Pressure Washer ×7 (user): the old wide cone look
  bubbleRush: { count: 9, gap: 0.09, stun: 0.6 },                // Soap Gun ×3
  bubbleTrap: { r: 18, stun: 1.1, radius: 110, knock: 520 },   // Soap Gun ×7
  tripleSpin: { count: 3, gap: 0.13, dur: 0.12 },                // Super Washer ×3 (v0.65, user: super fast; each spin `dur` s, 0.4 before, 0.5 s apart)
  // the Standard pack's new ones (v0.59). Hammer and Iron Fistopheles are melee.js's (MELEE), EN PASSANT chess.js's.
  sleepCone: { count: 3, spread: 0.32 },                        // Blowpipe ×3: darts, and how far apart (radians, each side)
  berserk: { time: 5, dmg: 10, bite: 9, every: 0.35, speedMul: 1.6, drain: 0.15 },   // Blowpipe ×7: how long, the dart's damage, each bite on another enemy, and the share of its own HP each bite costs it
  // Super Washer ×7 (user: nerfed from 7s). v0.65 (user: "same thing and you get slippery"): the spins are ×3's super fast
  // ones (`spin` s each, a new one every `every` s; 1.1 s apart before), and you slide: your speed only catches up with
  // where you're steering at `grip` per second (playerStep), so you skid round corners
  soakTrail: { time: 4, speedMul: 1.6, every: 0.13, spin: 0.12, grip: 3.2, dropEvery: 0.18, trailDelay: 0.5, trailRadius: 55 },
};

// The combo that starts at `pos` in this sequence, if any: { card, n, name }.
function comboAt(seq, pos) {
  const card = seq[pos], table = card && COMBOS[card];
  if (!table || (CARDS[card].tball && !tballMixed())) return null;   // the T-Balls: combos only with other cards in the deck (user)
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
  if (CARDS[cb.card].tball) { tballCombo(cb, echo); return; }   // the T-Balls (tballs.js)
  if (CARDS[cb.card].melee) { meleeCombo(cb, echo); return; }   // the melee deck's (melee.js)
  const p = game.player, { card } = cb, spec = upSpec(card), range = rangeOf(card), e0 = inRange(card) || nearestEnemy(), key0 = `${card}${cb.n}`;
  if (!e0 && card !== 'mine' && card !== 'cryo' && key0 !== 'grapeshot7' && key0 !== 'enpassant7' && !(spec.magus && cb.n === 7)) return;   // nothing to shoot at (mines, forms, the ice ring, GRAPE RAIN! and the Ulti Magus ults still happen)
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
  if (spec.magus) { magusCombo(cb, e0); return; }            // the Ulti Magus pack (magus.js)
  switch (key) {
    case 'bullet3':
      for (let k = 0; k < 3; k++) later(k * TUNE.rapidGap, () => atLocked({}));
      break;
    case 'shotgun3': {                                 // DOUBLE BARREL!: a blast, then another right away, wider
      const D = TUNE.doubleBarrel;
      shoot(card, e0);
      later(D.gap, () => { const e = game.enemies.includes(e0) ? e0 : inRange(card) || e0; shoot(card, e, { spread: D.spread }); });
      game.shake = Math.max(game.shake, 0.12);
      break;
    }
    case 'brickshot3':
    case 'brickshot7': {                               // 3 or 7 bricks, fanned out, each after its own target
      const n = cb.n, ts = targets(n, range), a0 = aimAngle(e0);
      for (let k = 0; k < n; k++) shoot(card, ts[k] || e0, { angle: a0 + (n > 1 ? (k / (n - 1) - 0.5) * 2 * TUNE.brick.spread : 0), homeDelay: 0.08, quiet: k > 0 });
      break;
    }
    case 'laser3':                                      // RAPID ZAP!: 3 in rapid fire
      for (let k = 0; k < 3; k++) later(k * TUNE.rapidZap.gap, () => { const e = game.enemies.includes(e0) ? e0 : inRange(card); if (e) zap(card, e, { quiet: k > 0 && k < 2 }); });
      break;
    case 'laser7':                                      // CHAIN ZAP!: one laser jumping from enemy to enemy
      chainZap(card, e0, TUNE.chainZap);
      break;
    case 'blowpipe3': {                                // SLEEP CONE!: 3 darts fanned out, each after its own target
      const C = TUNE.sleepCone, ts = targets(C.count, range), a0 = aimAngle(e0);
      for (let k = 0; k < C.count; k++) shoot(card, ts[k] || e0, { one: true, angle: a0 + (k - 1) * C.spread, homeDelay: 0.1, quiet: k > 0 });
      break;
    }
    case 'blowpipe7': {                                // BERSERK!: one red dart
      const B = TUNE.berserk;
      shoot(card, e0, { dmg: B.dmg, berserk: B.time, sleep: 0, r: spec.r + 1, red: true, speedMul: 1.15 });
      break;
    }
    case 'karishnikov3': akLine(card, e0, null, true); break;   // LINE SHOT! (combat.js): 3 rounds, harder each time, to the edge
    case 'karishnikov7': akLine(card, e0, a => akJam(card, a)); break;   // JAMMED!: the line, the jam, the wide cone
    case 'enpassant3': chessQueens(card); break;       // QUEEN'S GAMBIT! (chess.js)
    case 'enpassant7': chessKing(card); break;         // YOU ARE KING!
    case 'mine3': {
      const a0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < 3; k++) dropMine(card, a0 + (k / 3) * Math.PI * 2, TUNE.minefield, k > 0);
      break;
    }
    case 'grapeshot3':                                 // BACKSHOT!: one at the enemy, and one behind you
      shoot(card, e0);
      shoot(card, e0, { angle: aimAngle(e0) + Math.PI, noHome: true, maxDist: TUNE.backshot.range, quiet: true });
      break;
    case 'grapeshot7':                                 // GRAPE RAIN!: shots dropping all over the arena
      grapeRain(card, TUNE.grapeRain);
      break;
    case 'flashbang3':                                 // FLASH BURN!: the flash hurts too
      shoot(card, e0, { flashDmg: TUNE.flashBurn.dmg });
      break;
    case 'flashbang7': {                               // WHITEOUT!: at the farthest enemy, huge
      const far = game.enemies.filter(en => !en.dummy || game.practice).reduce((b, en) => (!b || hitGap(en, p.x, p.y) > hitGap(b, p.x, p.y) ? en : b), null) || e0;
      const W0 = TUNE.whiteout;
      shoot(card, far, { flashDmg: W0.dmg, flashR: W0.radius, flashDaze: W0.daze, r: spec.r + 3, speedMul: 1.3 });
      break;
    }
    case 'cannon3': {                                  // CANNONADE!: 3, each a random moment after the last
      const [g0, g1] = TUNE.cannonade.gaps;
      for (let k = 0, t = 0; k < 3; k++, t += g0 + Math.random() * (g1 - g0)) later(t, () => atLocked({}));
      break;
    }
    case 'cannon7': {
      const m = TUNE.megaCannon, dmg = spec.dmg * m.mult;
      shoot(card, e0, { r: m.r, dmg, speedMul: m.speedMul, aoe: { radius: m.radius, dmg } });
      game.shake = Math.max(game.shake, 0.25);
      break;
    }
    case 'shuriken3':                                   // RICOCHET!: one bolt, 3 more bounces
      shoot(card, e0, { bounces: spec.bounces + TUNE.ricochet.more, r: spec.r + 1 });
      break;
    case 'shuriken7': {                                 // SPLIT BOLT!: 7 more bounces, and it splits in two on its first hit
      const S = TUNE.splitBolt;
      shoot(card, e0, { bounces: spec.bounces + S.more, speedMul: S.speedMul, dmg: Math.round(spec.dmg * S.mult), r: spec.r + 2, extra: { mh: true, splitBolt: true } });
      break;
    }
    case 'spaceimpact3':
    case 'spaceimpact7': {
      const mega = cb.n === 7, count = mega ? TUNE.megaBurst : TUNE.burst, a0 = aimAngle(e0);
      const o = mega ? { endBlast: { radius: TUNE.megaBlast, dmg: damageOf(spec.dmg * TUNE.megaDmg), knock: 160 } } : {};
      for (let k = 0; k < count; k++) launch(card, a0 + (k / count) * Math.PI * 2, null, mega ? { ...o, range: TUNE.megaRange * (0.75 + Math.random() * 0.25) } : o);
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
    case 'missiles3':                                   // 7 at once, fanned wide, each at its own target if there are enough
    case 'missiles7': {
      const storm = cb.n === 7, n = storm ? TUNE.storm.count : TUNE.barrage.count, ts = targets(n, range), a0 = aimAngle(e0);
      for (let k = 0; k < n; k++) {
        const side = n > 1 ? k / (n - 1) - 0.5 : 0;
        shoot(card, ts[k] || e0, { one: true, angle: a0 + side * 2 * TUNE.barrage.spread, quiet: k > 0,
          ...(storm ? { speedMul: TUNE.storm.speedMul, split: TUNE.storm.split } : {}) });
      }
      break;
    }
    // The Powerwash pack (user).
    case 'pressurewasher3': {                          // WASH CONE!: a narrow jet, swept left to right
      const W = TUNE.washCone, a0 = (e0 ? aimAngle(e0) : 0) - W.span / 2;
      for (let k = 0; k < W.steps; k++) later(k * W.gap, () => spray(card, a0 + (k / (W.steps - 1)) * W.span, W.arc, range, { dmg: spec.dmg, quiet: k > 0 }));
      break;
    }
    case 'pressurewasher7': {                          // DELUGE!: 7 wide cones of spray, each a random direction
      const D = TUNE.deluge;
      for (let k = 0; k < D.count; k++) later(k * D.gap, () => spray(card, Math.random() * Math.PI * 2, D.arc, range * 1.3, { dmg: spec.dmg, wipe: true, quiet: k > 0 }));
      game.shake = Math.max(game.shake, 0.1);
      break;
    }
    case 'soapgun3': {                                 // BUBBLE RUSH!: 9 rapid bubbles that stun, and still pop into 2 more
      const R = TUNE.bubbleRush;
      for (let k = 0; k < R.count; k++) later(k * R.gap, () => {
        const e = (e0 && game.enemies.includes(e0)) ? e0 : inRange(card);
        if (e) shoot(card, e, { r: spec.r - 1, dmg: Math.round(spec.dmg * 0.6), split: spec.pops, stun: R.stun, quiet: k > 0 });
      });
      break;
    }
    case 'soapgun7': {                                 // BUBBLE TRAP!: one giant bubble that traps, then pops, pushing enemies out
      const T = TUNE.bubbleTrap, a = aim(e0);
      launch(card, a, e0, { r: T.r, dmg: spec.dmg, endBlast: { radius: T.radius, dmg: damageOf(spec.dmg), stun: T.stun, knock: T.knock }, big: true });
      game.shake = Math.max(game.shake, 0.16);
      break;
    }
    case 'superwasher3': {                             // TRIPLE SPIN!: 3 super fast full spins around you, back to back
      const S = TUNE.tripleSpin;
      for (let k = 0; k < S.count; k++) later(k * S.gap, () => superSweep(card, range, spec.dmg, S.dur));
      break;
    }
    case 'superwasher7':                               // SOAK TRAIL!: speed boost + exploding bubble trail, both sprays spinning
      startSoak(card, range, spec.dmg);
      break;
  }
}
