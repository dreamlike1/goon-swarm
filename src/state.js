/* state.js — Run state: seed, deck, game world and the record of what fired. */
'use strict';

// Each run gets a new seed and a deck built from the equipped cards (see newDeck).
let seed = 0;
let deck = null;

const game = {
  player: { x: 0, y: 0, flash: 0, hp: PLAYER.hp, safe: 0 },
  enemies: [],
  started: false,
  spawnTimer: 0,
  cooldown: ATTACK_INTERVAL,
  projectiles: [],
  particles: [],
  rings: [],
  floaters: [],
  orbs: [],           // XP orbs lying on the floor
  level: 1,
  xp: 0,              // XP toward the next level
  cdTotal: ATTACK_INTERVAL,   // length of the current wait between cards (for the next card's timer bar)
  choosing: false,    // the level-up choice is up; the arena waits
  upQueue: [],        // level-up picks still to make: { kind: 'stat' | 'aug', level }
  aug: new Set(),     // augmented deck slots (0–6): the card in that slot fires twice
  echoes: [],         // second shots waiting to fire
  mines: [],          // landmines on the floor: { x, y, t, card }
  potions: [],        // health potions on the floor: { x, y, t }
  diamonds: [],       // diamonds on the floor: { x, y, t }
  won: [],            // weapons won on the wheel this run; in this run's deck only
  timers: [],         // scheduled combo shots: { t, fn }
  beams: [],          // laser zaps being drawn: { x1, y1, x2, y2, life, max, w, card }
  sweeps: [],         // Laser ×7 sweeps in progress
  sprays: [],         // Pressure Washer / Super Washer spray wedges being drawn (user)
  trails: [],         // SOAK TRAIL!'s bubbles, ticking down to their pop: { x, y, t, card }
  soakT: 0,           // SOAK TRAIL! (Super Washer ×7): seconds of extra speed left …
  soakCard: null, soakRange: 0, soakDmg: 0, soakSweep: 0, soakDrop: 0,   // … and its own timers
  cineHold: false,    // MAKORA's scene is holding while the window is away (arena.js autoPause)
  practice: null,     // the store's test mode: { pack, card, dummies, dmg }
  shield: 0,          // mini shield time left (seconds)
  boss: null,         // SKURTOSAURUS while it's on the field (it's also in `enemies`)
  bossDue: false,     // level 10 reached: it arrives when the picks are done
  bossDone: false,    // beaten (once per run)
  rocks: [],          // its thrown rocks
  cracks: [],         // broken ground where it lands after a charge (fades out)
  relics: [],         // relics earned this run ('bull', 'deflect')
  obi: null,          // OBI ONE while he's on the field (also in `enemies`), level 20
  obiDue: false, obiDone: false,
  sabers: [],         // his lightsaber while it's thrown
  bolts: [],          // your shots, knocked back at you while he blocks
  debris: [],         // phase 2: the force rains debris down; red circle telegraphs, then a hit (user)
  defl: 0,            // DEFLECT: seconds of shield left …
  deflCd: 0,          // … seconds until it can go up again …
  deflAge: 9,         // … and seconds since it went up (a hit this soon is a perfect deflect)
  dash: null,         // BULL charge in progress
  dashCd: 0,          // seconds until BULL can charge again
  ghosts: [],         // BULL afterimages: { x, y, a, life }
  swooshes: [],       // BULL swoosh trails left behind a charge: { x1, y1, x2, y2, life }
  intro: null,        // SKURTOSAURUS's intro in progress: { t, stomp }
  hitstop: 0,         // seconds the fight freezes after a BULL hit lands
  shieldHit: 0,       // flash when an enemy bumps the shield
  muzzle: null,
  shake: 0,
  kills: 0,
  paused: false,
  inMenu: true,
  over: false,        // the player's HP ran out; the defeat screen is up
};

// What combat actually fired, kept separately from the deck so the two can be compared.
const record = {
  current: [],       // cards fired so far in this sequence
  seqs: [],          // finished sequences, newest first: { n, cards, valid }
  passFired: [],     // cards fired so far in this pass (since the last shuffle)
  passes: 0,         // finished passes
  passesOk: 0,       // finished passes that played exactly the equipped deck
  trayOk: true,
  logOk: true,
};

function newDeck() {
  seed = (Math.random() * 2 ** 32) >>> 0;
  const cards = equippedCards();
  deck = cards.length ? createDeck(cards, mulberry32(seed)) : null;
  Object.assign(record, { current: [], seqs: [], passFired: [], passes: 0, passesOk: 0, trayOk: true, logOk: true });
}
