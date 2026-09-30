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
const SAVE_VERSION = 2;        // v2 (user, v0.6): the starter packs are gone, so older saves start over
const DECK_LIMIT = 31;
const COPY_LIMIT = 5;
const GOLD_PER = 50;           // 1 gold for every 50 enemies defeated in a run, paid when you die or quit (user)

function blankSave() {
  return {
    v: SAVE_VERSION,
    owned: {},              // card id → usable copies (0–5)
    upgradeCopies: {},      // card id → extra copies waiting for the upgrade rules
    equipped: {},           // card id → copies in the deck
    gold: 100,              // for the store. A new save (or a reset) starts with 100 (v0.30, user; it was 0)
    starterDone: false,     // the starter pack has been opened (its cards are in the collection)
    starterSeen: false,     // …and its reveal finished
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
    for (const id of Object.keys(out.owned)) if (!CARDS[id]) delete out.owned[id];          // a card that was removed
    for (const id of Object.keys(out.equipped)) {
      if (!CARDS[id]) { delete out.equipped[id]; continue; }
      out.equipped[id] = Math.min(out.equipped[id], out.owned[id] || 0, COPY_LIMIT);
    }
    out.gold = Math.max(0, Math.floor(out.gold) || 0);
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
    if (n > COPY_LIMIT) out.push(`${CARDS[id].name}: ${n} copies; the limit is ${COPY_LIMIT}.`);
    if (n > (save.owned[id] || 0)) out.push(`${CARDS[id].name}: more equipped than owned.`);
  }
  return out;
}

// The starter pack: always 5 Bullets and 5 Lasers (user). They go into the collection and become the first deck.
function openStarter() {
  if (save.starterDone) return starterCards();
  const ids = starterCards();
  addToCollection(ids);
  save.equipped = { ...STARTER.cards };
  save.starterDone = true;
  writeSave();
  return ids;
}

// A store pack: pays, rolls, adds the cards to the collection (not the deck: equip them in Loadout). null if you can't afford it.
function buyPack(key) {
  const pk = PACKS[key];
  if (!pk || save.gold < pk.price) return null;
  save.gold -= pk.price;
  const ids = rollPack(pk, newRng());
  const where = addToCollection(ids);
  writeSave();
  return { ids, where };
}

// Gold for a finished run: 1 per GOLD_PER defeated. Returns what was added.
function payGold(kills) {
  const n = Math.floor(kills / GOLD_PER);
  if (n > 0) { save.gold += n; writeSave(); }
  return n;
}
