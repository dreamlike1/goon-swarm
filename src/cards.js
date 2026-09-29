/* cards.js — The weapon-card roster and rarities. Data only. */
'use strict';

/* Roster from docs/spec-starter-weapon-cards.md. A card's rarity is fixed.
   Damage and effects come from the spec. Speed, size and knockback follow the user's notes
   (Dart faster than Bullet; Arcane Bolt slower with a bit more damage; Fire Bolt fast and strong)
   and are otherwise placeholders, like each card's colour (the --<id> token in style.css).
   `range` (px) is how close an enemy must be for the card to fire, and roughly how far its shots fly (user: every
   weapon has its own range, halved from the first numbers; placeholders). The Attack range upgrade stretches it. `look` picks how the projectile is drawn: streak, orb, heavy (Cannon's trail, ring and shake), spin or missile. */
const CARDS = {
  bullet:   { name: 'Bullet',      rarity: 'common',   range: 180, dmg: 5,  speed: 580, r: 4,  knock: 40,  look: 'streak', desc: 'Basic attack.' },
  dart:     { name: 'Dart',        rarity: 'common',   range: 230, dmg: 5,  speed: 820, r: 3,  knock: 25,  look: 'streak', desc: 'Basic attack. Faster than a Bullet.' },
  arcane:   { name: 'Arcane Bolt', rarity: 'common',   range: 150, dmg: 6,  speed: 400, r: 5,  knock: 40,  look: 'orb',    desc: 'Basic attack. Slower than a Bullet, with a little more damage.' },
  cannon:   { name: 'Cannon',      rarity: 'uncommon', range: 160, dmg: 10, speed: 290, r: 11, knock: 300, look: 'heavy',  desc: 'Cannon attack. Big and slow, with heavy knockback.' },
  shuriken: { name: 'Shuriken',    rarity: 'uncommon', range: 150, dmg: 5,  speed: 520, r: 5,  knock: 30,  look: 'spin',   bounces: 2, desc: 'Bounces to up to 2 more enemies after its first hit, 3 hits in all.' },
  // Space Impact (user): a Common missile, 5 damage. Flies straight (no homing), starts slow then speeds up,
  // and pierces its first enemy; the second hit stops it. 3 in a row fire as one burst in every direction.
  // `speed` is its top speed, reached `ramp` s after launch from `start`. Those three are placeholders.
  spaceimpact: { name: 'Space Impact', rarity: 'common', range: 260, dmg: 5, speed: 900, start: 110, ramp: 0.45, r: 4, knock: 35, look: 'missile', homing: false, pierce: 1,
                 desc: 'Missile. Flies straight, starts slow then speeds up, and pierces 1 enemy. 3 in a row fire in every direction.' },
  // Mine (user): leaves a landmine where the player stands. When an enemy touches it, it explodes: 30 damage to
  // every enemy within `radius`. It arms `arm` s after it's placed. The rarity, radius, arm time and knockback are placeholders.
  mine: { name: 'Mine', rarity: 'uncommon', range: 110, dmg: 30, speed: 0, r: 7, knock: 260, look: 'mine', radius: 75, arm: 0.35,
          desc: 'Drops a landmine where you stand. An enemy that touches it sets off an explosion: 30 damage to everything nearby.' },
  firebolt: { name: 'Fire Bolt',   rarity: 'rare',     range: 210, dmg: 20, speed: 760, r: 6,  knock: 90,  look: 'streak', desc: 'Fire Bolt attack. Fast and strong.' },
};
const CARD_IDS = Object.keys(CARDS);   // roster order, used for sorting

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'sss'];
const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', sss: 'Triple S' };

// Plain words for the Loadout, worked out from the numbers.
function paceWord(speed) { return speed >= 700 ? 'Very fast' : speed >= 500 ? 'Fast' : speed >= 380 ? 'Medium' : 'Slow'; }
function pushWord(knock) { return knock >= 200 ? 'Heavy' : knock >= 60 ? 'Medium' : 'Light'; }
