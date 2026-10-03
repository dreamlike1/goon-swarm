/* state.js — Run state: seed, deck, game world and the record of what fired. */
'use strict';

// Each run gets a new seed and a deck built from the equipped cards (see newDeck).
let seed = 0;
let deck = null;
let mdeck = null;     // the melee deck (v0.53, user): plays at the same time as `deck`, the ranged one (melee.js)
let wdeck = null;     // the Wild deck (v0.62, user): a third deck, ranged or melee, on its own timer (combat.js wildStep)
const WILD_OFFSET = 0.5;   // …its first card comes half a turn after the other decks', so the three don't fire as one
// Every card in this run's decks (all three; a Set, so the Wild deck standing in for one isn't counted twice).
const runDeckCards = () => [...new Set([deck, mdeck, wdeck])].filter(Boolean).flatMap(d => d.cards);

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
  aug: new Map(),     // augmented deck slots: slot (0–6) → its augment (AUGS in config.js)
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
  relics: [],         // relics earned this run ('bull', 'deflect', 'sack')
  obi: null,          // OBI ONE while he's on the field (also in `enemies`), level 20
  obiDue: false, obiDone: false,
  snek: null, snekDue: false, snekDone: false,   // AWAS THE SNEK (snek.js)
  dying: null,        // a boss playing its death (deaths.js)
  sabers: [],         // his lightsaber while it's thrown
  bolts: [],          // your shots, knocked back at you while he blocks
  eshots: [],         // the shooters' slow red orbs (v0.51)
  mrocks: [],
  melees: [],         // melee swings, stabs and black lightning, as they show (melee.js)
  zones: [], kicks: [], sinfx: [], sguard: null,   // the SINS pack's slowing ground, astral kicks, effects and shield (sins.js)
  mcool: 0, mcdTotal: 1, bflash: 0, bshield: null,
  wcool: 0, wcdTotal: 1, wprimed: true,           // the Wild deck's timer (v0.62)
    // the melee deck's timer, and BLACK FLASH!'s time left         // MAKORA's kicked rocks (v0.52: their own list, so nothing aims at them)
  boulders: [],       // OBI ONE phase 3: rocks lying round the arena, which he hurls at you (v0.50)
  debris: [],         // phase 2: the force rains debris down; red circle telegraphs, then a hit (user)
  defl: 0,            // DEFLECT: seconds of shield left …
  deflCd: 0,          // … seconds until it can go up again …
  deflAge: 9,         // … and seconds since it went up (a hit this soon is a perfect deflect)
  sack: 0,            // VAMPIRIC BALLSACK: kills in it (snek.js) …
  sackCd: 0,          // … seconds before it starts filling again …
  sackFx: 0,          // … and the glow of a drink
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

// The ranged and the melee deck from a list of cards (either may be null: no cards of that kind). The melee one gets
// its own shuffle from the same seed, so a co-op guest's copy of it matches the host's.
// `wild`: the Wild deck's cards (v0.62), its own deck with its own shuffle.
function splitDecks(cards, s, wild = []) {
  const r = cards.filter(id => !isMelee(id)), m = cards.filter(isMelee);
  return [r.length ? createDeck(r, mulberry32(s), SEQUENCE_SIZE, deckLuck) : null,
          m.length ? createDeck(m, mulberry32((s ^ 0x9E3779B9) >>> 0), SEQUENCE_SIZE, deckLuck) : null,
          wild.length ? createDeck(wild, mulberry32((s ^ 0x85EBCA6B) >>> 0), SEQUENCE_SIZE, deckLuck) : null];
}
function newDeck() {
  seed = (Math.random() * 2 ** 32) >>> 0;
  [deck, mdeck, wdeck] = splitDecks(runCards(), seed, runWild());   // (a deck switched off in Loadout sits out)
  Object.assign(record, { current: [], seqs: [], passFired: [], passes: 0, passesOk: 0, trayOk: true, logOk: true });
}
