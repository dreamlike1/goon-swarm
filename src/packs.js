/* packs.js — Pack rolls. Pure: give it a pack and a random source, get cards back. */
'use strict';

/* Rules from docs/spec-packs-and-stores.md:
   - A pack reveals 5 cards. Each card gets its own independent weighted rarity roll.
   - No pity, no guarantees, duplicates allowed (even inside one pack).
   - Everything is rolled before the reveal; revealing or skipping can't change it.
   - After the rarity, the card is picked evenly from that rarity's cards.
   A pack may only offer rarities that have at least one card. */
const RARITY_WEIGHTS = { common: 6000, uncommon: 2500, rare: 1000, epic: 400, legendary: 98, sss: 2 };   // out of 10,000

// `cards`, if set, limits a pack to those cards; otherwise it can hold any card of its rarities.
const PACKS = {
  // No Rare or better (user decision), so only the Common and Uncommon weights apply.
  // The original starter cards only: Space Impact comes from the Dan pack.
  beginner: { name: 'Beginner pack', short: 'Beginner', size: 5, rarities: ['common', 'uncommon'], cards: ['bullet', 'dart', 'arcane', 'cannon', 'shuriken'] },
  // Space Impact and Bullets (user). Both are Common, so each card is one or the other, 50/50.
  dan: { name: 'Dan pack', short: 'Dan', size: 5, rarities: ['common'], cards: ['bullet', 'spaceimpact'] },
  // Free pack (user, for now): nothing is rolled. You get every card (5 copies each) and build your own deck in Loadout.
  free: { name: 'Free pack', short: 'Free', free: true },
};
// A new player (and a reset) chooses ONE of these starter packs (user) and opens STARTER_OPENS of it.
// Its cards become the first loadout. 2 keeps the 10-card start from before; set 1 for a single 5-card pack.
const STARTER_PACKS = ['beginner', 'dan', 'free'];
const STARTER_OPENS = 2;

function cardsOfRarity(rarity, pack = null) {
  return CARD_IDS.filter(id => CARDS[id].rarity === rarity && (!pack || !pack.cards || pack.cards.includes(id)));
}

// The real odds for this pack, which are also what the pack screen shows.
function packOdds(pack) {
  const total = pack.rarities.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  return pack.rarities.map(r => ({ rarity: r, weight: RARITY_WEIGHTS[r], chance: RARITY_WEIGHTS[r] / total }));
}

// Anything that would stop this pack being playable (a rarity with no cards).
function packProblems(pack) {
  return pack.rarities.filter(r => !cardsOfRarity(r, pack).length).map(r => `${RARITY_NAME[r]} has no cards`);
}

function rollPack(pack, rng) {
  const odds = packOdds(pack);
  const total = odds.reduce((s, o) => s + o.weight, 0);
  return Array.from({ length: pack.size }, () => {
    let x = rng() * total, rarity = odds[odds.length - 1].rarity;
    for (const o of odds) { if ((x -= o.weight) < 0) { rarity = o.rarity; break; } }
    const pool = cardsOfRarity(rarity, pack);
    return pool[Math.floor(rng() * pool.length)];
  });
}

// Opens many packs and checks the rarity mix lands close to the published odds.
function packSelfTest(pack, packs) {
  const rng = mulberry32(0xBEEF);
  const seen = {}, seenIds = {};
  for (let i = 0; i < packs; i++) for (const id of rollPack(pack, rng)) { seen[CARDS[id].rarity] = (seen[CARDS[id].rarity] || 0) + 1; seenIds[id] = (seenIds[id] || 0) + 1; }
  const cards = packs * pack.size;
  const rows = packOdds(pack).map(o => ({ ...o, got: (seen[o.rarity] || 0) / cards }));
  const outside = Object.keys(seen).filter(r => !pack.rarities.includes(r));
  const wrongCard = pack.cards && Object.keys(seenIds).some(id => !pack.cards.includes(id));
  // Within a rarity, each card is picked evenly.
  const uneven = pack.rarities.some(r => { const pool = cardsOfRarity(r, pack), o = rows.find(x => x.rarity === r);
    return pool.some(id => Math.abs((seenIds[id] || 0) / cards - o.chance / pool.length) > 0.01); });
  const ok = !packProblems(pack).length && !outside.length && !wrongCard && !uneven && rows.every(o => Math.abs(o.got - o.chance) < 0.01);
  return { ok, packs, rows, cards: Object.fromEntries(Object.entries(seenIds).map(([id, n]) => [id, n / cards])) };
}

function newRng() {
  const buf = new Uint32Array(1);
  (self.crypto && crypto.getRandomValues) ? crypto.getRandomValues(buf) : (buf[0] = Math.random() * 2 ** 32);
  return mulberry32(buf[0]);
}
