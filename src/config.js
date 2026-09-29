/* config.js — Tuning: attack timing, player, enemies, swarm. Card stats live in cards.js; colours come from style.css tokens. */
'use strict';

const ATTACK_INTERVAL = 0.7;   // seconds between cards
const MIN_INTERVAL = 0.25;     // Attack speed upgrades can't take it below this
const SHUFFLE_TIME = 0.6;      // extra pause before the next card when the deck shuffles (trying it out; set 0 to turn off)
const PLAYER = { speed: 230, r: 11, hp: 100, safe: 0.6 };   // `safe`: seconds without damage after being hit

// Enemy types. `weight` is how often each spawns relative to the others; `dmg` is contact damage to the player.
// HP is flat and grows with the player's level: gently up to level 10 (`hpPerLevel`), then faster
// (`hpPerLevelLate`), so early levels stay quick to clear and the pressure builds after 10. `from` is the first
// level a type can spawn. Squares only at first; triangles after level 5 (user). Everything else is a placeholder,
// including big squares from level 8.
const ENEMY_TYPES = {
  square:   { name: 'Square',     shape: 'square',   hp: 3, hpPerLevel: 0.35, hpPerLevelLate: 1.4, speed: 130, r: 13, dmg: 10, weight: 6, xp: 1, from: 1 },
  triangle: { name: 'Triangle',   shape: 'triangle', hp: 2, hpPerLevel: 0.25, hpPerLevelLate: 0.8, speed: 200, r: 11, dmg: 5,  weight: 2, xp: 1, from: 6 },
  big:      { name: 'Big square', shape: 'square',   hp: 6, hpPerLevel: 0.75, hpPerLevelLate: 2.8, speed: 105, r: 20, dmg: 20, weight: 2, xp: 3, from: 8 },
};
const HP_KNEE = 10;          // the level where enemy HP growth speeds up
// Enemies also hit harder and move faster with the player's level (user: they get harder as you level).
const ENEMY_SCALE = { dmgPerLevel: 0.05, speedPerLevel: 0.012, speedMax: 1.5 };
const enemyDmg = (type, level) => Math.round(ENEMY_TYPES[type].dmg * (1 + ENEMY_SCALE.dmgPerLevel * (level - 1)));
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
  cap: 24,                   // never more than this on the field
  every: 1.0, everyPerLevel: 0.04, fastest: 0.3,   // seconds between spawns above the minimum
  refill: 0.2,               // seconds between spawns while below the minimum
};
const swarmMin = level => Math.min(SWARM.cap, SWARM.min + Math.floor(SWARM.minPerLevel * (level - 1)));
const swarmMax = level => Math.min(SWARM.cap, SWARM.max + Math.floor(SWARM.maxPerLevel * (level - 1)));
const spawnEvery = level => Math.max(SWARM.fastest, SWARM.every - SWARM.everyPerLevel * (level - 1));
const AUG_EVERY = 10;        // every 10th level, after the 3 cards, one deck slot gets augmented (fires twice)
const ECHO_DELAY = 0.12;     // seconds between an augmented slot's two shots
// Health potions (user): enemies sometimes drop one; walking over it heals. All numbers are placeholders.
const POTION = { drop: 0.02, heal: 25, r: 7, life: 20, max: 5 };   // 2% (was 5%, user: fewer)
// Diamond (user): a rare drop; picking it up pulls every XP orb on the floor to the player. Placeholders.
const DIAMOND = { drop: 0.015, r: 7, life: 20, max: 2 };   // `life`: seconds before it fades; `max` on the floor at once
// Weapon wheel (user): at levels 5, 15, 25 …, after the stat pick, spin for a weapon that joins this run's deck
// (not the saved loadout). Segment size follows the card's rarity, using the pack weights.
const WHEEL_FIRST = 5, WHEEL_EVERY = 10;
const isWheelLevel = l => l >= WHEEL_FIRST && (l - WHEEL_FIRST) % WHEEL_EVERY === 0;
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
  pull: 560,              // how fast they fly in (px/s²)
};
const xpNeeded = level => Math.round(XP.first * XP.grow ** (level - 1) + XP.step * (level - 1));

const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue(n).trim();
const COL = {
  floor: tok('--floor'), line: tok('--line'), player: tok('--player'), text: tok('--text'), bad: tok('--bad'), xp: tok('--xp'), hp: tok('--hp'), potion: tok('--potion'), diamond: tok('--diamond'), boss: tok('--boss'), rock: tok('--rock'), relic: tok('--relic'),
  square: tok('--enemy'), big: tok('--enemy-big'), triangle: tok('--enemy-fast'), enemy: tok('--enemy'),
  ...Object.fromEntries(CARD_IDS.map(id => [id, tok(`--${id}`)])),
  ...Object.fromEntries(RARITIES.map(r => [`r-${r}`, tok(`--r-${r}`)])),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
