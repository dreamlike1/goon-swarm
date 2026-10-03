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
/* v0.67 balance pass (user: "adjust weapon damage; rarity to balance, some common are stronger than the others"):
   every card's single attack was run in the test arena (a dense swarm of 14 at 60 HP, a minute each) and its damage
   dealt per play tuned so each rarity sits in its own band, about: Common 9–28 (the AoE and melee ones at the top),
   Uncommon 15–30, Rare 22–42, Epic 48–60 (Blowpipe 21 + sleep), Legendary 80–83, Triple S 94, Event 47–65. Utility
   cards (Flashbang, Iron Will, the washers) were left alone. Combos (×3, ×7) weren't retuned; most scale off `dmg`. */
const CARDS = {
  // v0.58 (user's weapon rework, 1stchange.md): the ids stay so saves keep their cards, but Bullet is now Bliky, a white
  // basic shooter; Knife Stab is Stab; Punch is Vessel (2 quick punches, and BLACK FLASH! is its ult); Cannon is a slow,
  // big white cannon. Laser and Space Impact are Rare now, Cannon and Vessel Uncommon. New: Brickshot, Shotgun, Slap
  // (the starter pack), Grapeshot, Flashbang and Rambo (the Bigger Weapons pack). Numbers are placeholders.
  bullet:   { name: 'Bliky',       rarity: 'common',   range: 248, dmg: 8,  speed: 600, r: 4,  knock: 40,  look: 'streak', desc: 'A white basic shot.' },
  // Laser (user): a long zap that hits instantly, the same damage as a Bullet. Twice a Bullet's range at first; it kept
  // its 414 when the rest got +20% in v0.26 (user).
  laser:    { name: 'Laser',       rarity: 'rare',   range: 414, dmg: 16,  speed: 0,   r: 2,  knock: 20,  look: 'laser',  desc: 'A long zap that hits instantly. Much longer range than a Bliky, and hits harder.' },
  cannon:   { name: 'Cannon',      rarity: 'uncommon', range: 230, dmg: 20, speed: 230, r: 13, knock: 320, look: 'heavy',  desc: 'A big, slow white cannonball that hits hard, with heavy knockback.' },
  // v0.60 (user's Ulti Magus pack): Arcane Bolt and Arcane Missiles are Rare now; Arcane Blast and Arcane Fire are gone.
  shuriken: { name: 'Arcane Bolt', rarity: 'rare',   range: 208, dmg: 9,  speed: 520, r: 5,  knock: 30,  look: 'spin',   bounces: 2, desc: 'A spinning bolt that bounces to up to 2 more enemies after its first hit, 3 hits in all.' },
  // Space Impact (user): a Common missile, 5 damage. Flies straight (no homing), starts slow then speeds up,
  // and pierces its first enemy; the second hit stops it. 3 in a row fire as one burst in every direction.
  // `speed` is its top speed, reached `ramp` s after launch from `start`. Those three are placeholders.
  spaceimpact: { name: 'Space Impact', rarity: 'rare', range: 359, dmg: 14, speed: 900, start: 110, ramp: 0.45, r: 4, knock: 35, look: 'missile', homing: false, pierce: 1,
                 desc: 'A rocket. Flies straight, starts slow then speeds up, and pierces 1 enemy.' },
  // Mine (user): leaves a landmine where the player stands. When an enemy touches it, it explodes: 30 damage to
  // every enemy within `radius`. It arms `arm` s after it's placed. The rarity, radius, arm time and knockback are placeholders.
  // v0.40 (user): no attack range. It drops on its own when its turn comes (`auto`), enemy near or not. An enemy sets it
  // off from `trigger` px away (it had to touch the 7 px disc before), and the disc is bigger (r 10, was 7).
  mine: { name: 'Mine', rarity: 'common', auto: true, dmg: 3, speed: 0, r: 10, trigger: 26, knock: 260, look: 'mine', radius: 44, arm: 0.35,
          desc: 'Drops a landmine where you stand. An enemy that touches it sets off an explosion that hurts everything nearby.' },
  // Sniper (user, v0.30): a super long shot that deals 50 damage. It flies straight and very fast (`start` = `speed`,
  // so no climb) until it hits something or leaves the arena. Rarity, range, speed and knockback are placeholders.
  sniper: { name: 'Sniper', rarity: 'uncommon', range: 560, dmg: 32, speed: 1500, start: 1500, ramp: 0.01, r: 3, knock: 140, look: 'sniper', homing: false, pierce: 0,
            desc: 'A super long, super fast shot that hits hard.' },
  // Arcane Missiles (user, v0.30): fires 2 homing missiles (4 since v0.66). They curve out to the sides, then steer in (`volley`
  // missiles per play). Damage, speed, range and rarity are placeholders.
  missiles: { name: 'Arcane Missiles', rarity: 'rare', range: 250, dmg: 7, speed: 430, r: 4, knock: 25, look: 'amissile', volley: 4,
              desc: 'Fires 4 homing missiles that curve in on their targets.' },
  // The Ulti Magus pack's new ones (v0.60, user). Their attacks live in magus.js (`magus`). Twin Flame: 2 light fire
  // bolts, pink and red, each at its own enemy. Arcana: a diamond that marks what it hits; the next hit on a marked
  // enemy does more. Explomagus: a slow spark that explodes where it hits (`radius`). Gravamagus: a swirl of laser
  // light cast on the ground under the enemy, going off a moment later. Darkmagus: dark energy that drains what it
  // hits. Druidity: Epic green magic that rooted what it hit until v0.65 (user), when it became a Legendary melee vine
  // whip (`arc`: how wide it cracks across; its combos are magus.js's). Numbers are placeholders.
  twinflame: { name: 'Twin Flame', rarity: 'common', range: 230, dmg: 5, speed: 560, r: 4, knock: 30, look: 'twin', magus: true, dmgNote: '5 dmg × 2',
               desc: 'Shoots 2 light fire bolts, one pink and one red, each at its own enemy.' },
  arcana: { name: 'Arcana', rarity: 'common', range: 240, dmg: 7, speed: 470, r: 5, knock: 40, look: 'arcana', magus: true,
            desc: 'A diamond of arcane light that marks what it hits. The next hit on a marked enemy deals more damage.' },
  explomagus: { name: 'Explomagus', rarity: 'uncommon', range: 240, dmg: 3, speed: 230, r: 6, knock: 30, look: 'spark', magus: true, radius: 40, dmgNote: '4 blast',
                desc: 'A slow spark. When it hits an enemy it explodes: decent damage to everything in a small circle.' },
  gravamagus: { name: 'Gravamagus', rarity: 'uncommon', range: 280, dmg: 4, speed: 0, r: 0, knock: 50, look: 'swirl', magus: true, dmgNote: 'after 1 s',
                desc: 'Casts a swirl of laser light on the ground under the enemy. After 1 s it hurts everything inside it.' },
  darkmagus: { name: 'Darkmagus', rarity: 'uncommon', range: 250, dmg: 7, speed: 420, r: 6, knock: 30, look: 'dark', magus: true, dmgNote: '7 + drain',
               desc: 'A bolt of dark energy that drains what it hits: it keeps losing life for a moment, and you get a little back.' },
  druidity: { name: 'Druidity', rarity: 'legendary', melee: true, range: 96, dmg: 15, speed: 0, r: 0, knock: 110, look: 'whip', arc: 2.2,
              desc: 'Whips a thorny vine across everything close in front of you.' },
  // The Silica pack (v0.42, user): 5 of each when you buy it. Legendary since v0.43 (user). Their attacks live in silica.js (`silica`). Rarity,
  // range, damage and the rest are placeholders.
  gatling: { name: 'Gatling Gun', rarity: 'epic',   // (Epic since v0.59, user: swapped with the Karishnikov; Legendary before)
             range: 262, dmg: 5, speed: 820, r: 3, knock: 14, look: 'gat', silica: true, dmgNote: '5 dmg × 10 rounds',
             desc: 'Fires 10 rounds of bullets in a fast burst.' },
  // v0.60 (user): Cryo Magus moved to the Ulti Magus pack (its Legendary), with frostier effects; still silica.js's.
  cryo: { name: 'Cryo Magus', rarity: 'legendary', range: 250, dmg: 20, speed: 360, r: 7, knock: 30, look: 'ice', silica: true,
          desc: 'A homing ice blast. Where it lands it leaves a frost field that slows enemies.' },
  // Gear Toss (v0.60, user: the Silica pack's new Uncommon). Throws a gear; what it hits sparks for a moment, then gets
  // zapped and confused (silica.js SILICA.gear). Numbers are placeholders.
  geartoss: { name: 'Gear Toss', rarity: 'uncommon', range: 240, dmg: 8, speed: 430, r: 6, knock: 30, look: 'gear', silica: true, dmgNote: '8 + zap',
              desc: 'Throws a spinning gear. A moment after it hits, the enemy is zapped and confused: it staggers about and leaves you alone.' },
  // The Powerwash pack (user). Their attacks are placeholders apart from the user's rules: Pressure Washer is a
  // thin instant spray that pushes; ×3 widens it into a cone, ×7 fires 7 long sprays in random directions. Soap
  // Gun's bubble pops into 2 more on a hit (`pops`); ×3 is 9 rapid bubbles that stun; ×7 one giant bubble that
  // traps enemies before pushing them out. Super Washer's two sprays spin a full turn around you (combat.js
  // reuses the Laser ×7 sweep for this); ×3 is 3 rapid spins; ×7 is a speed boost with an exploding bubble trail.
  // v0.60 (user): the Powerwash pack is gone, its weapons are in the Silica pack: Pressure Washer and Super Washer are
  // Rare now (Common and Uncommon before), the Soap Gun stays Common.
  // v0.50 (user): 1 damage but a big shove: its point is knockback, not damage (it was 6 dmg, knock 160).
  pressurewasher: { name: 'Pressure Washer', rarity: 'rare', range: 200, dmg: 1, speed: 0, r: 3, knock: 420, look: 'spray', arc: 0.24,
                    desc: 'A thin water spray that blasts enemies back. Barely any damage.' },
  // `start`/`ramp` (user's BUBBLE TRAP! only, combos.js's launch()): the giant bubble's launch speed climb.
  soapgun: { name: 'Soap Gun', rarity: 'common', range: 230, dmg: 4, speed: 340, start: 220, ramp: 0.4, r: 6, knock: 40, look: 'bubble', pops: 2,
             desc: 'A slow bubble that pops into 2 more bubbles, each dealing light damage.' },
  // v0.65 (user): half the reach (150 before), and it's about the shove: 2 damage (5 before), more knockback (90 before)
  superwasher: { name: 'Super Washer', rarity: 'rare', range: 75, dmg: 2, speed: 0, r: 0, knock: 140, look: 'orbit',
                 desc: 'Two short water jets spin all the way round you, shoving enemies away. Barely any damage.' },
  // Melee (v0.53, THE COMBAT UPDATE!, user): `melee` cards go in your second deck, which plays alongside the ranged one
  // (melee.js). `range` is their reach. Knife Stab's `start` / `speed` / `ramp` are for KNIFE THROW! (its ×7) only.
  // Damage, reach and knockback are placeholders.
  // v0.53 (user): reach 72 and 64 at first, then 100 and 90 (longer), 82 and 74 (shorter again: it strikes the moment
  // an enemy comes in reach instead, melee.js), 74 and 66, now 64 and 58 (user: a bit less, twice). The Attack range
  // upgrade doesn't stretch it (v0.55, user; combat.js rangeOf).
  knife: { name: 'Stab', rarity: 'common', melee: true, range: 64, dmg: 7, speed: 980, start: 980, ramp: 0.01, r: 7, knock: 60, look: 'knife',
           desc: 'Stabs the nearest enemy within reach.' },
  // The SINS weapons (v0.53, user): no combos (sins.js plays them). Sonic Kick is ranged; the other three are melee.
  // Iron Will is cast on yourself (`self`) whenever its turn comes. Numbers are placeholders.
  // v0.60 (user): the Sins pack is gone; they're the Silica pack's Epics now (Triple S before), with their own looks
  // and a bit more each (sins.js SINS): Sonic Kick's kick breaks the sound barrier, Iron Will blocks 3 hits for longer
  // and bursts when it breaks, Tempest Slam calls down lightning, Dragon Kick's kick is a fire dragon.
  sonickick: { name: 'Sonic Kick', rarity: 'epic', range: 300, dmg: 14, speed: 640, r: 6, knock: 30, look: 'sonic',
               desc: 'A sonic shot that marks what it hits, then an astral flying kick slams into the mark with a sonic boom that hits everything round it.' },
  ironwill: { name: 'Iron Will', rarity: 'epic', melee: true, self: true, dmg: 0, speed: 0, r: 0, knock: 0, look: 'guard', dmgNote: 'blocks 3 hits',
              desc: 'A teal and gold shield of hexagons that blocks the next 3 hits, for up to 2.5 s. When it breaks it bursts, throwing enemies back.' },
  tempest: { name: 'Tempest Slam', rarity: 'epic', melee: true, range: 78, dmg: 4, speed: 0, r: 0, knock: 190, look: 'slam',
             desc: 'Slams the ground: everything close is hit, lightning strikes where the cracks end, and the cracked ground slows enemies for 2.5 s.' },
  dragonkick: { name: 'Dragon Kick', rarity: 'epic', melee: true, range: 68, dmg: 45, speed: 0, r: 0, knock: 560, look: 'kick',
                dmgNote: 'half its HP',
                desc: 'A fire-dragon kick that always takes half the enemy\'s HP and sends it flying in a straight line, burning everything in its way.' },
  // Vessel (v0.58): 2 quick punches a turn (`hits`), `dmg` each.
  punch: { name: 'Vessel', rarity: 'uncommon', melee: true, range: 58, dmg: 4, hits: 2, speed: 0, r: 0, knock: 150, look: 'punch',
           desc: 'Two quick punches at the nearest enemy within reach.' },
  // The new starter (now Standard) weapons (v0.58, user). Brickshot: a brick (clay red since v0.64, white before) that bounces to 2 more enemies (`bounces`); if the
  // brick kills on its last bounce you get a light blue shield (combat.js BRICK). Shotgun: `pellets` small shots in a
  // cone `spread` wide. Slap: barely any damage, a big shove.
  brickshot: { name: 'Brickshot', rarity: 'rare', range: 260, dmg: 9, speed: 520, r: 6, knock: 70, look: 'brick', bounces: 2,
               desc: 'A clay brick that bounces to 2 more enemies. If it kills on its second bounce, you get a short shield.' },
  shotgun: { name: 'Shotgun', rarity: 'common', range: 200, dmg: 2, speed: 640, r: 3, knock: 30, look: 'streak', pellets: 6, spread: 0.7,
             desc: 'Fires 6 small pellets in a cone. Each does less than a Bliky.' },
  slap: { name: 'Slap', rarity: 'common', melee: true, range: 62, dmg: 3, speed: 0, r: 0, knock: 520, look: 'slap',
          desc: 'Slaps the nearest enemy in reach, pushing it far away. Low damage.' },
  // The Bigger Weapons pack's new ones (v0.58, user). Grapeshot: a shell that bursts into `grape` pellets, each from a
  // random spot inside a hidden circle. Flashbang: no damage; everything within `radius` of where it lands is dazed
  // (stopped) for `daze` s. Rambo: two short slices.
  grapeshot: { name: 'Grapeshot', rarity: 'uncommon', range: 260, dmg: 4, speed: 420, r: 7, knock: 40, look: 'grape', grape: 5,
               desc: 'A shell that bursts into 5 small shots flying out in random directions.' },
  flashbang: { name: 'Flashbang', rarity: 'uncommon', range: 280, dmg: 0, speed: 400, r: 6, knock: 0, look: 'flashbang', radius: 80, daze: 1.6, dmgNote: 'dazes 1.6 s',
               desc: 'Throws a flashbang that blinds enemies where it lands: they stop, dazed, for a moment.' },
  rambo: { name: 'Rambo', rarity: 'common', melee: true, range: 66, dmg: 3, hits: 2, speed: 0, r: 0, knock: 50, look: 'slice',
           desc: 'Two short slices at the nearest enemy within reach.' },
  // The Standard pack's new ones (v0.59, user). Hammer (Rare, melee): strikes down, hitting everything in a circle
  // where it lands (`radius`). Blowpipe (Epic): a dart that puts what it hits to sleep for `sleep` s (it stops, zzz).
  // The Iron Fistopheles (Legendary, melee): a flurry of `hits` red astral punches, `gap` s apart. EN PASSANT (Triple S,
  // the X card: it plays in the ranged deck): each turn a random chess piece attacks its squares (chess.js). Numbers are placeholders.
  hammer: { name: 'Hammer', rarity: 'rare', melee: true, range: 70, dmg: 5, speed: 0, r: 0, knock: 180, look: 'hammer', radius: 40,
            desc: 'Strikes the hammer down in front of you: everything in a circle where it lands is hit.' },
  blowpipe: { name: 'Blowpipe', rarity: 'epic', range: 300, dmg: 26, speed: 780, r: 3, knock: 20, look: 'dart', sleep: 2.2, dmgNote: 'sleeps 2.2 s',
              desc: 'Blows a dart that hurts the enemy and puts it to sleep: it stops where it is for 2.2 s.' },
  fistopheles: { name: 'The Iron Fistopheles', rarity: 'legendary', melee: true, range: 70, dmg: 6, hits: 5, gap: 0.07, speed: 0, r: 0, knock: 70, look: 'astral',
                 desc: 'A flurry of 5 mythic red astral punches at the nearest enemy within reach.' },
  enpassant: { name: 'En Passant', rarity: 'sss', badge: 'X', range: 250, dmg: 26, speed: 0, r: 0, knock: 90, look: 'chess',
               desc: 'Every turn a random chess piece attacks its squares, hitting everything on them. Pawn: 2 squares, and on again if it kills. Knight: an L of 4 squares. Rook: 8 squares straight. Bishop: 8 squares diagonal.' },
  // Karishnikov (v0.59, user: the Bigger Weapons pack's Epic, then Legendary, swapped with the Gatling Gun, and made
  // stronger): no bullets to see, only the muzzle flash. Each turn it fires a quick `burst` into a cone `arc` wide, and
  // everything in the cone within its range is hit (combat.js akBurst).
  karishnikov: { name: 'Karishnikov', rarity: 'legendary', range: 250, dmg: 5, speed: 0, r: 0, knock: 60, look: 'kalash', arc: 0.75, burst: 5, gap: 0.06, dmgNote: '5 dmg × 5',
                 desc: 'Fires a burst into a cone in front of you. You only see the muzzle flash; everything in the cone is hit.' },
  // The T-Balls pack (v0.56, user: an event pack). `tball`: which kind of ball it is. Balls orbit you, and each turn
  // does one of 4 effects at random (tballs.js). They need no other cards in the deck.
  tball:  { name: 'Ranged T-Ball', rarity: 'event', range: 300, dmg: 14, speed: 640, r: 5, knock: 80, look: 'orb', tball: 'ranged',
            desc: 'A T-Ball orbits you. Each turn it does one of 5 things at random: a long lunge, a red beam, it sticks to an enemy and explodes, it fires, or it bounces off an enemy 4 times.' },
  tballm: { name: 'Melee T-Ball', rarity: 'event', melee: true, range: 120, dmg: 18, speed: 0, r: 0, knock: 200, look: 'tball', tball: 'melee',
            desc: 'A T-Ball orbits you. Each turn it does one of 5 things at random: a red shield that blocks a hit, a push, a lunge with a blue zap, a whip, or a red pulse from every ball.' },
};
const CARD_IDS = Object.keys(CARDS);   // roster order, used for sorting
const isMelee = id => !!CARDS[id]?.melee;   // which deck a card goes in: melee or ranged (v0.53)
const kindOf = id => (isMelee(id) ? 'melee' : 'ranged');

// v0.56 (user): Event, in red, for event packs (the T-Balls); after Triple S, so the store sorts it last.
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'sss', 'event'];
const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', sss: 'Triple S', event: 'Event' };

// Plain words for the Loadout, worked out from the numbers.
function paceWord(speed) { return speed >= 700 ? 'Very fast' : speed >= 500 ? 'Fast' : speed >= 380 ? 'Medium' : 'Slow'; }
function pushWord(knock) { return knock >= 200 ? 'Heavy' : knock >= 60 ? 'Medium' : 'Light'; }
