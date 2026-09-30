/* config.js — Tuning: attack timing, player, enemies, swarm. Card stats live in cards.js; colours come from style.css tokens. */
'use strict';

const ATTACK_INTERVAL = 0.7;   // seconds between cards
const MIN_INTERVAL = 0.25;     // Attack speed upgrades can't take it below this
const SHUFFLE_TIME = 0.6;      // extra pause before the next card when the deck shuffles (trying it out; set 0 to turn off)
const PLAYER = { speed: 230, r: 11, hp: 100, safe: 0.6 };   // `safe`: seconds without damage after being hit

// Enemy types. `weight` is how often each spawns relative to the others; `dmg` is contact damage to the player.
// `hp` never grows with level (v0.12). `hpPerLevel` / `hpPerLevelLate` are kept at 0 in case it's wanted back.
// `from` is the first level a type can spawn.
const ENEMY_TYPES = {
  // v0.12 (user: the level scaling was a bit hard): HP no longer grows with level at all; only numbers, damage and
  // speed do, so you out-grow them. Each stage brings in one new thing (placeholders):
  //   1–3 red squares only · 4 splitters start (rare, SPLIT) · 7 fast triangles · 10 the boss · 11+ big squares
  //   (rare) and mini dinos.
  square:   { name: 'Square',     shape: 'square',   hp: 3, hpPerLevel: 0, hpPerLevelLate: 0, speed: 130, r: 13, dmg: 10, weight: 6,   xp: 1, from: 1 },
  triangle: { name: 'Triangle',   shape: 'triangle', hp: 2, hpPerLevel: 0, hpPerLevelLate: 0, speed: 200, r: 11, dmg: 5,  weight: 2,   xp: 1, from: 7 },
  big:      { name: 'Big square', shape: 'square',   hp: 8, hpPerLevel: 0, hpPerLevelLate: 0, speed: 105, r: 20, dmg: 20, weight: 0.6, xp: 3, from: 11 },
  // v0.12: red and bigger (user); r 12 before
  raptor:   { name: 'Mini dino',  shape: 'dino',     hp: 8, hpPerLevel: 0, hpPerLevelLate: 0, speed: 90,  r: 18, dmg: 12, weight: 1,   xp: 2, from: 11 },
};
// Mini dinos (user: after level 10, they dash at you): they walk in, and once you're within `sight` they stop,
// wind up (`windup` s, shaking, with a short aim line), dash along that line, then rest. Placeholders.
const RAPTOR = { sight: 230, windup: 0.5, dash: 0.42, dashSpeed: 560, rest: 0.7, every: [1.4, 2.4] };
// Splitters (user): a red-purple version of the squares and triangles, rarer than the red ones but not super
// rare. When one dies it splits into two normal red ones. `chance`: share of spawns; `hp` and `r`: the halves'
// HP and size compared to a normal one. Placeholders.
// v0.12: they only start at level `from`, rare at first (`chance`), + `perLevel` each level after, up to `max`.
const SPLIT = { from: 4, chance: 0.06, perLevel: 0.02, max: 0.18, types: ['square', 'triangle', 'big'], hp: 0.6, r: 0.8, push: 200 };
const splitChance = level => level < SPLIT.from ? 0 : Math.min(SPLIT.max, SPLIT.chance + SPLIT.perLevel * (level - SPLIT.from));
const HP_KNEE = 10;          // the level where enemy HP growth speeds up
// Enemies also hit harder and move faster with the player's level (user: they get harder as you level).
// After level 10 each level adds `dmgPerLevelLate` more on top (user, v0.7: less HP, more damage).
const ENEMY_SCALE = { dmgPerLevel: 0.05, dmgPerLevelLate: 0.15, speedPerLevel: 0.012, speedMax: 1.5 };
const enemyDmg = (type, level) => Math.round(ENEMY_TYPES[type].dmg
  * (1 + ENEMY_SCALE.dmgPerLevel * (level - 1) + ENEMY_SCALE.dmgPerLevelLate * Math.max(0, level - HP_KNEE)));
const enemySpeedMul = level => Math.min(ENEMY_SCALE.speedMax, 1 + ENEMY_SCALE.speedPerLevel * (level - 1));
const enemyHp = (type, level) => {
  const T = ENEMY_TYPES[type];
  return Math.round(T.hp + T.hpPerLevel * (Math.min(level, HP_KNEE) - 1) + T.hpPerLevelLate * Math.max(0, level - HP_KNEE));
};

// The swarm grows with the player's level. At level 1 there are always at least 5 on the field (the game
// tops it up quickly) and up to 7 (user). Each level raises both, and spawns come faster. Placeholders.
const SWARM = {
  min: 5, max: 7,            // on the field at level 1
  minPerLevel: 0.35,         // + this many per level (rounded down)
  maxPerLevel: 0.6,
  minPerLevelLate: 0.7,      // after level 10 (user: more enemies), + this many per level on top
  maxPerLevelLate: 1.1,
  cap: 36,                   // never more than this on the field
  every: 1.0, everyPerLevel: 0.04, fastest: 0.3,   // seconds between spawns above the minimum
  refill: 0.2,               // seconds between spawns while below the minimum
};
const lateLevels = level => Math.max(0, level - HP_KNEE);
const swarmMin = level => Math.min(SWARM.cap, SWARM.min + Math.floor(SWARM.minPerLevel * (level - 1) + SWARM.minPerLevelLate * lateLevels(level)));
const swarmMax = level => Math.min(SWARM.cap, SWARM.max + Math.floor(SWARM.maxPerLevel * (level - 1) + SWARM.maxPerLevelLate * lateLevels(level)));
const spawnEvery = level => Math.max(SWARM.fastest, SWARM.every - SWARM.everyPerLevel * (level - 1));
const AUG_EVERY = 10;        // every 10th level, after the 3 cards, one deck slot gets augmented (fires twice)
const ECHO_DELAY = 0.12;     // seconds between an augmented slot's two shots
// Health potions (user): enemies sometimes drop one; walking over it heals. All numbers are placeholders.
const POTION = { drop: 0.01, heal: 25, r: 7, life: 20, max: 5 };   // 1% (was 2%, and 5% before that; user: fewer)
// Diamond (user): a rare drop; picking it up pulls every XP orb on the floor to the player. Placeholders.
const DIAMOND = { drop: 0.015, r: 7, life: 20, max: 2 };   // `life`: seconds before it fades; `max` on the floor at once
// Weapon wheel (user): at levels 5, 15, 25 …, after the stat pick, spin for a weapon that joins this run's deck
// (not the saved loadout). Segment size follows the card's rarity, using the pack weights.
const WHEEL_FIRST = 5, WHEEL_EVERY = 10;
// Turned off in v0.8 (user: remove the wheel at 5, 15 …). The wheel code stays in upgrades.js; flip this back on to use it.
const WHEEL_ON = false;
const isWheelLevel = l => WHEEL_ON && l >= WHEEL_FIRST && (l - WHEEL_FIRST) % WHEEL_EVERY === 0;
const WHEEL_XP = 0.5;        // skip the spin (user): take this share of the current level's XP instead (placeholder)
// Random weapon card (user): sometimes one of the 3 level-up cards is a random weapon for this run (placeholder chance).
const WEAPON_CARD = 0.15;
// Mini shield (user): the fight pauses during a level-up choice; when it closes you get `linger` s of shield: no damage,
// and enemies are held off at its edge.
const SHIELD = { r: 12, linger: 1.0 };
const MINE_MAX = 8;          // mines on the field at once; placing one more removes the oldest (placeholder)
const BOUNCE_RANGE = 280;                          // how far a Shuriken looks for its next enemy

// XP and levels. A defeated enemy sometimes drops an XP orb worth its type's `xp`. Each level needs
// more XP than the last: level 1 → 2 takes `first`, and every level after takes `grow` times more.
// All numbers are placeholders. Each level up offers upgrades (upgrades.js).
const XP = {
  first: 5, grow: 1.12, step: 2,   // XP needed = first × grow^(level−1) + step × (level−1): 5, 8, 10, 13, 16, 19, 22, 25, 28, 32 … 69 at level 15
                                   // (user: higher levels shouldn't be so hard to reach; the enemies get harder instead)
  drop: 0.8,              // chance an enemy drops an orb
  magnet: 90,             // orbs within this many px fly to the player
  chase: 360,             // a pulled orb's speed at the edge of the magnet (px/s; at least 1.4× the player's speed)
  snap: 1500,             // extra speed at point blank (user: super strong up close), rising with closeness²
  vacuum: { start: 600, accel: 5000, max: 2600 },   // a diamond's pull: faster still, from anywhere (px/s, px/s²)
};
// For now (user, v0.25: level up faster): every enemy drops an orb, orbs are worth ×1.5, and every level needs the same
// `flat` XP instead of more each level. Set `on: false` to go back to the normal curve above.
const XP_BOOST = { on: true, drop: 1, value: 1.5, flat: 12 };
const xpNeeded = level => XP_BOOST.on ? XP_BOOST.flat : Math.round(XP.first * XP.grow ** (level - 1) + XP.step * (level - 1));

const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue(n).trim();
const COL = {
  floor: tok('--floor'), line: tok('--line'), player: tok('--player'), text: tok('--text'), bad: tok('--bad'), xp: tok('--xp'), hp: tok('--hp'), potion: tok('--potion'), diamond: tok('--diamond'), boss: tok('--boss'), bossDark: tok('--boss-dark'), bossEye: tok('--boss-eye'), makora: tok('--makora'), makoraDark: tok('--makora-dark'), makoraLine: tok('--makora-line'), makoraBand: tok('--makora-band'), makoraCloth: tok('--makora-cloth'), makoraFeather: tok('--makora-feather'), makoraMouth: tok('--makora-mouth'), wheel: tok('--wheel'), wheelDark: tok('--wheel-dark'), blade: tok('--blade'), rock: tok('--rock'), crack: tok('--crack'), relic: tok('--relic'),
  square: tok('--enemy'), big: tok('--enemy-big'), triangle: tok('--enemy-fast'), enemy: tok('--enemy'), raptor: tok('--enemy'),
  'square-split': tok('--enemy-split'), 'big-split': tok('--enemy-big-split'), 'triangle-split': tok('--enemy-fast-split'),
  ...Object.fromEntries(CARD_IDS.map(id => [id, tok(`--${id}`)])),
  ...Object.fromEntries(RARITIES.map(r => [`r-${r}`, tok(`--r-${r}`)])),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
