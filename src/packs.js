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
// Store packs (user, v0.6): 20 gold each, 5 cards, Common and Uncommon only. v0.30 (user): Laser joins Artillery with
// the new Sniper, Cannon leaves it for the starter pack, and Magus gets Arcane Missiles.
const PACK_PRICE = 20;
const PACKS = {
  artillery: { name: 'Artillery pack', short: 'Artillery', size: 5, price: PACK_PRICE, rarities: ['common', 'uncommon'], cards: ['laser', 'mine', 'spaceimpact', 'sniper'] },
  magus:     { name: 'Magus pack',     short: 'Magus',     size: 5, price: PACK_PRICE, rarities: ['common', 'uncommon'], cards: ['arcane', 'shuriken', 'missiles', 'firebolt'] },
  // The Silica pack (v0.42, user): nothing is rolled, you always get 5 of each of its 3 weapons. v0.43 (user): Legendary, 100 gold.
  silica:    { name: 'Silica pack',    short: 'Silica',    size: 15, price: 100, rarities: ['legendary'], cards: ['gatling', 'cryo', 'shifter'], fixed: { gatling: 5, cryo: 5, shifter: 5 } },
  // Powerwash pack (user): Pressure Washer and Soap Gun (Common), Super Washer (Uncommon).
  powerwash: { name: 'Powerwash pack', short: 'Powerwash', size: 5, price: PACK_PRICE, rarities: ['common', 'uncommon'], cards: ['pressurewasher', 'soapgun', 'superwasher'] },
};
const STORE_PACKS = ['artillery', 'magus', 'silica', 'powerwash'];
// Every new player (and a reset) opens this first, before anything else (user). Nothing is rolled.
// v0.30 (user): 5 Bullets and 5 Cannons (it was Bullets and Lasers).
const STARTER = { name: 'Starter pack', short: 'Starter', cards: { bullet: 5, cannon: 5 } };
const starterCards = () => Object.entries(STARTER.cards).flatMap(([id, n]) => Array(n).fill(id));

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

const fixedCards = pack => Object.entries(pack.fixed).flatMap(([id, n]) => Array(n).fill(id));
function rollPack(pack, rng) {
  if (pack.fixed) return fixedCards(pack);            // nothing to roll
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
