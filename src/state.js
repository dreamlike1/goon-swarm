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
  won: [],            // weapons won on the wheel this run (they're in this run's deck only)
  timers: [],         // scheduled combo shots: { t, fn }
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
