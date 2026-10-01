/* save.js — The player's collection and equipped deck, saved on this computer (localStorage). */
'use strict';

/* Kept apart from the run: opening a pack changes the collection and the equipped deck,
   never a deck that is already being played.
   Rules from docs/spec-packs-and-stores.md:
   - The equipped deck holds at most 31 cards, with at most 14 copies of one card type (7 until v0.52, 5 until v0.47);
     a card with more than 7 needs at least 7 other cards in the deck with it (BALANCE).
   - v0.53 (user): two decks, ranged and melee, each with those rules. `equipped` holds both (a card's kind says
     which: cards.js isMelee). Either one can be empty, not both.
   - Copies 1–5 of a type are usable. Later copies count toward that type's upgrades
     (tiers and bonuses are still to be decided, so they are only counted for now).
   - Special currency and the stores are not built yet. */
const SAVE_KEY = 'rogue.save';
const SAVE_VERSION = 2;        // v2 (user, v0.6): the starter packs are gone, so older saves start over
const DECK_LIMIT = 31;
const COPY_LIMIT = 14;         // copies of one card a deck can hold (v0.52, user: 14; 7 since v0.47, so its ×7 ult can happen; 5 before)
// v0.52 (user: 14 copies, but you must include 7 other cards to balance it): more than `over` copies of one card, and
// the deck needs at least `others` cards that aren't that one.
const BALANCE = { over: 7, others: 7 };
const OWN_LIMIT = 999;         // copies of one card you can own (v0.46, user: packs kept stopping at 5)
const START_GOLD = 350;
// v0.53 (user: "reset the data of coins"): every save's gold goes back to START_GOLD once, when it next loads.
const GOLD_RESET = 1;
const GOLD_PER = 15;           // 1 gold for every 15 enemies defeated in a run, paid when you die or quit (user; 50 until v0.43)

function blankSave() {
  return {
    v: SAVE_VERSION,
    owned: {},              // card id → copies you own (0–999; a deck holds up to 14 of each)
    equipped: {},           // card id → copies in the deck
    gold: START_GOLD,       // for the store. A new save (or a reset) starts with this (v0.53, user: 350; 100 since v0.30, 0 before)
    goldReset: GOLD_RESET,  // which gold reset this save has had (below)
    starterDone: false,     // the starter pack has been opened (its cards are in the collection)
    starterSeen: false,     // …and its reveal finished
    off: {},                // v0.53 (user): decks switched off in Loadout ('ranged' / 'melee' → true): kept, not played
    meleeGift: 0,           // v0.53: a save from before the melee update got the melee starter cards (MELEE_GIFT)
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
    // v0.46: copies past 5 used to wait as "upgrade copies"; they're simply owned now (up to 999)
    for (const [id, n] of Object.entries(out.upgradeCopies || {})) out.owned[id] = Math.min(OWN_LIMIT, (out.owned[id] || 0) + (n | 0));
    delete out.upgradeCopies;
    for (const id of Object.keys(out.owned)) if (!CARDS[id]) delete out.owned[id];          // a card that was removed
    for (const id of Object.keys(out.equipped)) {
      if (!CARDS[id]) { delete out.equipped[id]; continue; }
      out.equipped[id] = Math.min(out.equipped[id], out.owned[id] || 0, COPY_LIMIT);
    }
    out.gold = Math.max(0, Math.floor(out.gold) || 0);
    if ((s.goldReset || 0) < GOLD_RESET) { out.gold = START_GOLD; out.goldReset = GOLD_RESET; try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch (err) { /* again next time */ } }
    if (!out.off || typeof out.off !== 'object') out.off = {};
    if (out.starterDone && (+out.meleeGift || 0) < MELEE_GIFT) {   // v0.53: the starter pack has melee weapons now; you get them
                                                           //   too (topped up to 10 of each if you'd had the first 5), straight
                                                           //   into your melee deck if it's empty or just the first gift
      const mel = CARD_IDS.filter(k => isMelee(k) && out.equipped[k]);
      const asGiven = !mel.length || (mel.length === 2 && out.equipped.knife === 5 && out.equipped.punch === 5);
      for (const [id, n] of Object.entries(MELEE_STARTER)) {
        out.owned[id] = Math.min(OWN_LIMIT, Math.max(out.owned[id] || 0, n));
        if (asGiven) out.equipped[id] = n;
      }
      out.meleeGift = MELEE_GIFT;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch (err) { /* it's given again next time */ }
    }
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
    if (have < OWN_LIMIT) { save.owned[id] = have + 1; return { id, to: 'copy', copy: have + 1 }; }
    return { id, to: 'max' };                              // already 999: nothing more to add
  });
}

// The equipped deck as a flat list of card ids, in roster order: both decks, or just one `kind` ('ranged' / 'melee').
function equippedCards(kind = null) {
  return CARD_IDS.filter(id => !kind || kindOf(id) === kind).flatMap(id => Array(save.equipped[id] || 0).fill(id));
}

// Why these decks can't start a run, if anything. Either deck may be empty (user: melee only, or ranged only).
function deckProblems() {
  return [...(runCards().length ? [] : [equippedCards().length ? 'Both decks are off.' : 'Both decks are empty.']),
    ...['ranged', 'melee'].filter(deckOn).flatMap(deckProblemsOf)];   // (a deck that's off can't stop a run)
}
// A deck switched off in Loadout (v0.53, user: easy to turn melee or ranged off) keeps its cards but sits out of runs.
const deckOn = kind => !save.off?.[kind];
// The cards a run plays: both decks', less any that's switched off.
const runCards = () => equippedCards().filter(id => deckOn(kindOf(id)));
// One deck's ('ranged' / 'melee').
function deckProblemsOf(kind) {
  const out = [], cards = equippedCards(kind);
  if (cards.length > DECK_LIMIT) out.push(`${cards.length} cards; the limit is ${DECK_LIMIT}.`);
  for (const id of CARD_IDS.filter(k => kindOf(k) === kind)) {
    const n = save.equipped[id] || 0;
    if (n > COPY_LIMIT) out.push(`${CARDS[id].name}: ${n} copies; the limit is ${COPY_LIMIT}.`);
    const others = cards.length - n;
    if (n > BALANCE.over && others < BALANCE.others)
      out.push(`${n} ${CARDS[id].name} needs ${BALANCE.others} other ${kind} cards with it: add ${BALANCE.others - others} more.`);
    if (n > (save.owned[id] || 0)) out.push(`${CARDS[id].name}: more equipped than owned.`);
  }
  return out;
}

// The starter pack (STARTER: the ranged and the melee weapons). They go into the collection and become the first decks.
function openStarter() {
  if (save.starterDone) return starterCards();
  const ids = starterCards();
  addToCollection(ids);
  save.equipped = { ...STARTER.cards };
  save.starterDone = true;
  save.meleeGift = MELEE_GIFT;           // (its melee cards are in it)
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
