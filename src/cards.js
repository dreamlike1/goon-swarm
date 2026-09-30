/* cards.js — The weapon-card roster and rarities. Data only. */
'use strict';

/* Roster from docs/spec-starter-weapon-cards.md. A card's rarity is fixed.
   Damage and effects come from the spec. Speed, size and knockback follow the user's notes
   (Dart faster than Bullet; Arcane Bolt slower with a bit more damage; Fire Bolt fast and strong)
   and are otherwise placeholders, like each card's colour (the --<id> token in style.css).
   `range` (px) is how close an enemy must be for the card to fire, and roughly how far its shots fly (user: every
   weapon has its own range, halved from the first numbers, then +15% in v0.8 and +20% in v0.26, all but Laser; placeholders). The Attack range upgrade stretches it. `look` picks how the projectile is drawn: streak, orb, heavy (Cannon's trail, ring and shake), spin or missile. */
// Ids stay as they were so the code and saves keep working; the names changed (user, v0.6): `arcane` is now Arcane
// Blast, `shuriken` is Arcane Bolt and `firebolt` is Arcane Fire. Dart was removed. The rarities follow the packs:
// Artillery (Laser, Mine: Common; Space Impact, Sniper: Uncommon) and Magus (Arcane Blast, Arcane Bolt, Arcane Missiles:
// Common; Arcane Fire: Uncommon). v0.30 (user): Sniper and Arcane Missiles are new, Laser moved to Artillery and
// Cannon to the starter pack.
const CARDS = {
  bullet:   { name: 'Bullet',      rarity: 'common',   range: 248, dmg: 5,  speed: 580, r: 4,  knock: 40,  look: 'streak', desc: 'Basic attack.' },
  // Laser (user): a long zap that hits instantly, the same damage as a Bullet. Twice a Bullet's range at first; it kept
  // its 414 when the rest got +20% in v0.26 (user).
  laser:    { name: 'Laser',       rarity: 'common',   range: 414, dmg: 5,  speed: 0,   r: 2,  knock: 20,  look: 'laser',  desc: 'A long zap that hits instantly. Much longer range than a Bullet, the same damage.' },
  arcane:   { name: 'Arcane Blast', rarity: 'common',  range: 208, dmg: 6,  speed: 400, r: 5,  knock: 40,  look: 'orb',    desc: 'A slow arcane orb, with a little more damage than a Bullet.' },
  cannon:   { name: 'Cannon',      rarity: 'common',   range: 221, dmg: 10, speed: 290, r: 11, knock: 300, look: 'heavy',  desc: 'Cannon attack. Big and slow, with heavy knockback.' },
  shuriken: { name: 'Arcane Bolt', rarity: 'common',   range: 208, dmg: 5,  speed: 520, r: 5,  knock: 30,  look: 'spin',   bounces: 2, desc: 'A spinning bolt that bounces to up to 2 more enemies after its first hit, 3 hits in all.' },
  // Space Impact (user): a Common missile, 5 damage. Flies straight (no homing), starts slow then speeds up,
  // and pierces its first enemy; the second hit stops it. 3 in a row fire as one burst in every direction.
  // `speed` is its top speed, reached `ramp` s after launch from `start`. Those three are placeholders.
  spaceimpact: { name: 'Space Impact', rarity: 'uncommon', range: 359, dmg: 5, speed: 900, start: 110, ramp: 0.45, r: 4, knock: 35, look: 'missile', homing: false, pierce: 1,
                 desc: 'Missile. Flies straight, starts slow then speeds up, and pierces 1 enemy. 3 in a row fire in every direction.' },
  // Mine (user): leaves a landmine where the player stands. When an enemy touches it, it explodes: 30 damage to
  // every enemy within `radius`. It arms `arm` s after it's placed. The rarity, radius, arm time and knockback are placeholders.
  // v0.40 (user): no attack range. It drops on its own when its turn comes (`auto`), enemy near or not. An enemy sets it
  // off from `trigger` px away (it had to touch the 7 px disc before), and the disc is bigger (r 10, was 7).
  mine: { name: 'Mine', rarity: 'common', auto: true, dmg: 30, speed: 0, r: 10, trigger: 26, knock: 260, look: 'mine', radius: 75, arm: 0.35,
          desc: 'Drops a landmine where you stand. An enemy that touches it sets off an explosion: 30 damage to everything nearby.' },
  firebolt: { name: 'Arcane Fire', rarity: 'uncommon', range: 290, dmg: 20, speed: 760, r: 6,  knock: 90,  look: 'streak', desc: 'A fast, strong bolt of arcane fire.' },
  // Sniper (user, v0.30): a super long shot that deals 50 damage. It flies straight and very fast (`start` = `speed`,
  // so no climb) until it hits something or leaves the arena. Rarity, range, speed and knockback are placeholders.
  sniper: { name: 'Sniper', rarity: 'uncommon', range: 560, dmg: 50, speed: 1500, start: 1500, ramp: 0.01, r: 3, knock: 140, look: 'sniper', homing: false, pierce: 0,
            desc: 'A super long, super fast shot: 50 damage.' },
  // Arcane Missiles (user, v0.30): fires 2 homing missiles. They curve out to the sides, then steer in (`volley`
  // missiles per play). Damage, speed, range and rarity are placeholders.
  missiles: { name: 'Arcane Missiles', rarity: 'common', range: 250, dmg: 4, speed: 430, r: 4, knock: 25, look: 'amissile', volley: 2,
              desc: 'Fires 2 homing missiles that curve in on their targets.' },
  // The Silica pack (v0.42, user): 5 of each when you buy it. Legendary since v0.43 (user). Their attacks live in silica.js (`silica`). Rarity,
  // range, damage and the rest are placeholders.
  gatling: { name: 'Gatling Gun', rarity: 'legendary', range: 262, dmg: 2, speed: 820, r: 3, knock: 14, look: 'gat', silica: true, dmgNote: '2 dmg × 10 rounds',
             desc: 'Fires 10 rounds of bullets in a fast burst.' },
  cryo: { name: 'Cryo Magus', rarity: 'legendary', range: 250, dmg: 8, speed: 360, r: 7, knock: 30, look: 'ice', silica: true,
          desc: 'A homing ice blast. Where it lands it leaves a frost field that slows enemies.' },
  shifter: { name: 'Druid',
             rarity: 'legendary', range: 230, dmg: 22, speed: 0, r: 0, knock: 220, look: 'lion', silica: true,
             desc: 'Summon a lion that pounces on the nearest enemy and bites it.' },
  // The Powerwash pack (user). Their attacks are placeholders apart from the user's rules: Pressure Washer is a
  // thin instant spray that pushes; ×3 widens it into a cone, ×7 fires 7 long sprays in random directions. Soap
  // Gun's bubble pops into 2 more on a hit (`pops`); ×3 is 9 rapid bubbles that stun; ×7 one giant bubble that
  // traps enemies before pushing them out. Super Washer's two sprays spin a full turn around you (combat.js
  // reuses the Laser ×7 sweep for this); ×3 is 3 rapid spins; ×7 is a speed boost with an exploding bubble trail.
  // v0.50 (user): 1 damage but a big shove: its point is knockback, not damage (it was 6 dmg, knock 160).
  pressurewasher: { name: 'Pressure Washer', rarity: 'common', range: 200, dmg: 1, speed: 0, r: 3, knock: 420, look: 'spray', arc: 0.24,
                    desc: 'A thin water spray that blasts enemies back. Barely any damage.' },
  // `start`/`ramp` (user's BUBBLE TRAP! only, combos.js's launch()): the giant bubble's launch speed climb.
  soapgun: { name: 'Soap Gun', rarity: 'common', range: 230, dmg: 4, speed: 340, start: 220, ramp: 0.4, r: 6, knock: 40, look: 'bubble', pops: 2,
             desc: 'A slow bubble that pops into 2 more bubbles, each dealing light damage.' },
  superwasher: { name: 'Super Washer', rarity: 'uncommon', range: 150, dmg: 5, speed: 0, r: 0, knock: 90, look: 'orbit',
                 desc: 'Two water sprays spin all the way round you.' },
};
const CARD_IDS = Object.keys(CARDS);   // roster order, used for sorting

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'sss'];
const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', sss: 'Triple S' };

// Plain words for the Loadout, worked out from the numbers.
function paceWord(speed) { return speed >= 700 ? 'Very fast' : speed >= 500 ? 'Fast' : speed >= 380 ? 'Medium' : 'Slow'; }
function pushWord(knock) { return knock >= 200 ? 'Heavy' : knock >= 60 ? 'Medium' : 'Light'; }
