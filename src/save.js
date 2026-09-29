/* save.js — The player's collection and equipped deck, saved on this computer (localStorage). */
'use strict';

/* Kept apart from the run: opening a pack changes the collection and the equipped deck,
   never a deck that is already being played.
   Rules from docs/spec-packs-and-stores.md:
   - The equipped deck holds at most 31 cards, with at most 5 copies of one card type.
   - Copies 1–5 of a type are usable. Later copies count toward that type's upgrades
     (tiers and bonuses are still to be decided, so they are only counted for now).
   - Special currency and the stores are not built yet. */
const SAVE_KEY = 'rogue.save';
const SAVE_VERSION = 1;
const DECK_LIMIT = 31;
const COPY_LIMIT = 5;

function blankSave() {
  return {
    v: SAVE_VERSION,
    owned: {},              // card id → usable copies (0–5)
    upgradeCopies: {},      // card id → extra copies waiting for the upgrade rules
    equipped: {},           // card id → copies in the deck
    beginner: null,         // the chosen starter pack's cards, once rolled
    starter: null,          // which starter pack was chosen ('beginner' or 'dan')
    beginnerSeen: false,    // the player has finished its reveal
  };
}

let save = loadSave();
let saveWorks = true;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blankSave();
    const s = JSON.parse(raw);
    if (!s || s.v !== SAVE_VERSION) return blankSave();
    const out = Object.assign(blankSave(), s);
    // An older save could equip more copies than allowed (a 50/50 pack can roll 6 of one card): trim to the limit.
    if (out.starter === 'free') for (const id of CARD_IDS) out.owned[id] = DECK_LIMIT;   // Free pack: every card, no per-card limit
    const lim = out.starter === 'free' ? DECK_LIMIT : COPY_LIMIT;
    for (const id of Object.keys(out.equipped)) out.equipped[id] = Math.min(out.equipped[id], out.owned[id] || 0, lim);
    return out;
  } catch (err) {
    return blankSave();
  }
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); saveWorks = true; }
  catch (err) { saveWorks = false; }
  return saveWorks;
}

function resetSave() {
  save = blankSave();
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* nothing saved */ }
}

// Adds pulled cards to the collection, one at a time, and says where each went.
function addToCollection(ids) {
  return ids.map(id => {
    const have = save.owned[id] || 0;
    if (have < COPY_LIMIT) { save.owned[id] = have + 1; return { id, to: 'copy', copy: have + 1 }; }
    save.upgradeCopies[id] = (save.upgradeCopies[id] || 0) + 1;
    return { id, to: 'upgrade' };
  });
}

// The equipped deck as a flat list of card ids, in roster order.
function equippedCards() {
  return CARD_IDS.flatMap(id => Array(save.equipped[id] || 0).fill(id));
}

// Why this deck can't start a run, if anything.
function deckProblems() {
  const cards = equippedCards();
  const out = [];
  if (!cards.length) out.push('The deck is empty.');
  if (cards.length > DECK_LIMIT) out.push(`The deck has ${cards.length} cards; the limit is ${DECK_LIMIT}.`);
  for (const id of CARD_IDS) {
    const n = save.equipped[id] || 0;
    if (n > copyLimit()) out.push(`${CARDS[id].name}: ${n} copies; the limit is ${copyLimit()}.`);
    if (n > (save.owned[id] || 0)) out.push(`${CARDS[id].name}: more equipped than owned.`);
  }
  return out;
}

// Free pack: every card, 5 copies each, and an empty deck for the player to build in Loadout.
function openFreePack() {
  if (save.beginner) return;
  save.beginner = [];
  save.starter = 'free';
  save.beginnerSeen = true;
  for (const id of CARD_IDS) save.owned[id] = DECK_LIMIT;   // no per-card limit for the Free pack (user); the deck is still 31 at most
  save.equipped = {};
  writeSave();
}
const canBuildDeck = () => save.starter === 'free';   // only the Free pack's deck can be edited for now
const copyLimit = () => (save.starter === 'free' ? DECK_LIMIT : COPY_LIMIT);

// The chosen starter pack is rolled once per computer. Asking again returns the same cards.
function openBeginnerPack(key) {
  if (save.beginner) return save.beginner;
  const rng = newRng();
  const ids = Array.from({ length: STARTER_OPENS }, () => rollPack(PACKS[key], rng)).flat();
  save.beginner = ids;
  save.starter = key;
  addToCollection(ids);
  // The pack is the first loadout, up to 5 copies of each card (extras are upgrade copies, see addToCollection).
  save.equipped = Object.fromEntries(Object.entries(countCards(ids)).map(([id, n]) => [id, Math.min(n, COPY_LIMIT)]));
  writeSave();
  return ids;
}
