/* packs.js — Pack rolls. Pure: give it a pack and a random source, get cards back. */
'use strict';

/* Rules from docs/spec-packs-and-stores.md:
   - A pack reveals 5 cards. Each card gets its own independent weighted rarity roll.
   - No pity, no guarantees, duplicates allowed (even inside one pack).
   - Everything is rolled before the reveal; revealing or skipping can't change it.
   - After the rarity, the card is picked evenly from that rarity's cards.
   A pack may only offer rarities that have at least one card. */
// v0.58 (user: "adjust the rates so rarity is rarer"; it was 6000 / 2500 / 1000 / 400 / 98 / 2 / 2)
const RARITY_WEIGHTS = { common: 7600, uncommon: 1900, rare: 420, epic: 70, legendary: 8, sss: 1, event: 1 };   // out of 10,000 (Event: only fixed packs give it; this is for the run's random weapon)

// `cards`, if set, limits a pack to those cards; otherwise it can hold any card of its rarities.
// v0.58 (user: "10 cards per pack only!!!", the starter pack too): every pack is 10 cards, each rolled on its own with the
// rates above (only between the pack's own rarities), then picked evenly from that rarity's cards. Nothing is fixed any
// more (Silica, Sins and T-Balls gave set copies before: 15, 8 and 20 cards).
const PACK_SIZE = 10;
const PACK_PRICE = 20;
// v0.61 (user: "for all packs you get random common and uncommons, throughout all packs"): a pack's Commons and
// Uncommons aren't its own any more. Every pack (Event packs aside) rolls them from every Common and Uncommon in the
// game (`SHARED`, cardsOfRarity), so `cards` only lists a pack's Rare and up. Its page shows a Random Common and a
// Random Uncommon row for them, which open the Weapon Archive (menus.js). Event packs (`event`) keep their own
// weapons at every rarity, Legendary to Common, and show them all (user: "but for events include all legendary to common").
// Where the shared weapons came from (their packs' Commons and Uncommons before v0.61):
//   Standard: Bliky, Stab, Shotgun, Slap (C); Cannon, Vessel (U)
//   Bigger Weapons: Mine, Rambo, Bliky, Shotgun (C); Sniper, Grapeshot, Flashbang (U)
//   Ulti Magus: Twin Flame, Arcana, Slap, Bliky (C); Explomagus, Gravamagus, Darkmagus (U)
//   Silica: Soap Gun, Twin Flame, Mine, Bliky (C); Gear Toss, Grapeshot, Cannon (U)
const SHARED = ['common', 'uncommon'];
// The T-Balls pack's odds (v0.63, out of 10,000; v0.64, user: "event and triple s should have the same rates"): its T-Balls
// (Event) are as rare as a Triple S, and the rest much better than a store pack's.
// Placeholders.
const TBALL_ODDS = { event: 30, sss: 30, legendary: 240, epic: 750, rare: 1850, uncommon: 3000, common: 4100 };
const PACKS = {
  // v0.58 (user's rework), v0.59 (user): renamed the Standard pack (its id stays `starter`), with Hammer (Rare),
  // Blowpipe (Epic), The Iron Fistopheles (Legendary) and EN PASSANT (Triple S); Brickshot is its other Rare.
  // Every new player opens one first (STARTER), and it's in the store too (v0.55: 20 gold).
  starter:   { name: 'Standard pack',  short: 'Standard',  rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'sss'],
               cards: ['brickshot', 'hammer', 'blowpipe', 'fistopheles', 'enpassant'] },
  // v0.58 (user): the Bigger Weapons pack replaces Artillery. Rare: Laser, Space Impact. v0.59 (user): the Gatling Gun
  // (Epic) moved here from the Silica pack, and the Karishnikov (Legendary) is new.
  bigger:    { name: 'Bigger Weapons pack', short: 'Bigger Weapons', rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
               cards: ['laser', 'spaceimpact', 'karishnikov', 'gatling'] },
  // v0.60 (user): the Magus pack is now Ulti Magus (its id stays `magus`). Rare: Arcane Missiles, Arcane Bolt. Epic:
  // Druidity. Legendary: Cryo Magus (from the Silica pack). Arcane Blast and Arcane Fire are gone. v0.65 (user):
  // Druidity is a Legendary now, so the pack has no Epic. v0.66 (user): Druidity moved to the Silica pack.
  magus:     { name: 'Ulti Magus pack', short: 'Ulti Magus', rarities: ['common', 'uncommon', 'rare', 'legendary'],
               cards: ['missiles', 'shuriken', 'cryo'] },
  // The Silica pack (v0.42, user). v0.60 (user): the Powerwash and Sins packs moved into it. Rare: Pressure Washer,
  // Super Washer. Epic: the four SINS weapons. (The Druid, its Legendary, was taken out after that, user, and removed from the game in
  // v0.65. The Gatling Gun went to Bigger Weapons in v0.59, the Cryo Magus to Ulti Magus in v0.60.)
  // v0.66 (user): Druidity (Legendary) moved here from Ulti Magus.
  silica:    { name: 'Silica pack',    short: 'Silica',    rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
               cards: ['pressurewasher', 'superwasher', 'sonickick', 'ironwill', 'tempest', 'dragonkick', 'druidity'] },
  // The T-Balls pack (v0.56, user: an event pack, red). v0.63 (user: "add in the pack random rarities from triple s to
  // all rarity types under"): besides its two T-Balls (Event) it gives a random weapon of every rarity, Triple S to
  // Common, from any store pack (`any`), with its own odds (`weights`, TBALL_ODDS).
  tballs:    { name: 'T-Balls pack',   short: 'T-Balls',   rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'sss', 'event'],
               cards: ['tball', 'tballm'], event: true, any: true },
};
// v0.60 (user): the store's order and prices live in storeconfig.js (the store editor on localhost writes it).
// v0.72 (user: "discounts and a NEW banner on any pack"): the store editor also sets a discount (% off, 0–95) and a NEW flag per
// pack. `base` is the price before the discount, `price` what's charged (everything reads `price`), `isNew` shows the ribbon.
function setStorePricing(k, base, discount = 0, isNew = false) {
  const pk = PACKS[k], off = Math.min(95, Math.max(0, Math.round(Number(discount) || 0)));
  pk.base = base; pk.discount = off; pk.isNew = !!isNew;
  pk.price = off ? Math.max(0, Math.round(base * (100 - off) / 100)) : base;
}
for (const [k, pk] of Object.entries(PACKS)) {
  pk.size = PACK_SIZE;
  setStorePricing(k, STORE_CONFIG.prices[k] ?? pk.price ?? PACK_PRICE, STORE_CONFIG.discounts?.[k], STORE_CONFIG.new?.[k]);
}
PACKS.tballs.weights = TBALL_ODDS;
const STORE_PACKS = STORE_CONFIG.order.filter(k => PACKS[k]);   // the packs in the store, left to right (the editor reorders it in place)
const STARTER = PACKS.starter;
// v0.60 (user: "for the packs with repeating weapons"): a weapon's home is the first pack that has it; in any other pack
// it's one of that pack's "random weapons" from elsewhere. The pack's page shows those as one Random row per rarity,
// and Test pack leaves them out. (The pack still gives the real weapon.) The shared Commons and Uncommons (v0.61) have
// no home: `randRarities` is every rarity a pack's page shows as a Random row.
const cardHome = id => Object.keys(PACKS).find(k => PACKS[k].cards?.includes(id));
const ownCards = k => (PACKS[k].cards || []).filter(id => cardHome(id) === k);
const borrowedCards = k => (PACKS[k].cards || []).filter(id => cardHome(id) !== k);
const sharedIn = pack => !!pack && !pack.event && !pack.sample;         // (a pack whose Commons and Uncommons are the shared ones)
const randRarities = k => { const pk = PACKS[k];
  return RARITIES.filter(r => pk.rarities.includes(r) && ((sharedIn(pk) && SHARED.includes(r)) || (pk.any && !ownCards(k).some(id => CARDS[id].rarity === r))
    || borrowedCards(k).some(id => CARDS[id].rarity === r))); };
// Every weapon a pack can give.
const packPool = pack => [...new Set(pack.rarities.flatMap(r => cardsOfRarity(r, pack)))];
// v0.62 (user: "GET 2 starter packs at the beginning with improve drop rates!"): a new player opens STARTER_PACKS Standard packs, and
// theirs roll with these odds (out of 10,000) instead of the store's: about 3× the Rares, 5× the Epics, 7× the
// Legendaries and 10× the Triple S.
const STARTER_PACKS = 1;   // v0.64 (user: "make the starter pack only 1 on new"): back to 1, keeping the better odds
const STARTER_ODDS = { common: 5300, uncommon: 3000, rare: 1300, epic: 330, legendary: 60, sss: 10, event: 0 };
const MELEE_STARTER = { knife: 10, punch: 10 };
const MELEE_GIFT = 2;          // which melee gift a save has had: 1 was 5 of each, 2 is 10

// A rarity's cards: every one in the game, or a pack's. A pack's Commons and Uncommons are every Common and Uncommon
// in the game (v0.61), except the weapons only an Event pack has.
const eventOnly = id => Object.values(PACKS).some(pk => pk.event && pk.cards.includes(id));
// A pack with `any` (the T-Balls pack, v0.63) gives, at a rarity it has no weapons of its own, any weapon of that rarity
// a store pack can give (`storeCards`: the shared ones and every non-Event pack's own).
const storeCards = rarity => CARD_IDS.filter(id => CARDS[id].rarity === rarity && !eventOnly(id)
  && (SHARED.includes(rarity) || Object.values(PACKS).some(pk => !pk.event && !pk.sample && pk.cards?.includes(id))));
function cardsOfRarity(rarity, pack = null) {
  if (sharedIn(pack) && SHARED.includes(rarity)) return CARD_IDS.filter(id => CARDS[id].rarity === rarity && !eventOnly(id));
  if (pack?.any && !pack.cards.some(id => CARDS[id].rarity === rarity)) return storeCards(rarity);
  return CARD_IDS.filter(id => CARDS[id].rarity === rarity && (!pack || !pack.cards || pack.cards.includes(id)));
}

// The real odds for this pack, which are also what the pack screen shows.
function packOdds(pack, weights = pack.weights || RARITY_WEIGHTS) {   // (a pack's own odds, if it has them: the T-Balls')
  const total = pack.rarities.reduce((s, r) => s + weights[r], 0);
  return pack.rarities.map(r => ({ rarity: r, weight: weights[r], chance: weights[r] / total }));
}

// Anything that would stop this pack being playable (a rarity with no cards).
function packProblems(pack) {
  return pack.rarities.filter(r => !cardsOfRarity(r, pack).length).map(r => `${RARITY_NAME[r]} has no cards`);
}

const fixedCards = pack => Object.entries(pack.fixed).flatMap(([id, n]) => Array(n).fill(id));
function rollPack(pack, rng, weights = pack.weights || RARITY_WEIGHTS) {
  if (pack.fixed) return fixedCards(pack);            // nothing to roll
  const odds = packOdds(pack, weights);
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
  const wrongCard = Object.keys(seenIds).some(id => !cardsOfRarity(CARDS[id].rarity, pack).includes(id));
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
