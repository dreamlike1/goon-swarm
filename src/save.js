/* save.js — The player's collection and equipped deck, saved on this computer (localStorage). */
'use strict';

/* Kept apart from the run: opening a pack changes the collection and the equipped deck,
   never a deck that is already being played.
   Rules from docs/spec-packs-and-stores.md:
   - The equipped deck holds at most 31 cards, with at most 14 copies of one card type (7 until v0.52, 5 until v0.47);
     a card with more than 7 needs at least 7 other cards in the deck with it (BALANCE).
   - v0.53 (user): two decks, ranged and melee, each with those rules. `equipped` holds both (a card's kind says
     which: cards.js isMelee). Either one can be empty, not both.
   - v0.63 (user): the Wild deck (`wildKind`: 'ranged' / 'melee' / null) doubles one of them: up to 62 cards, played as
     two decks (below). Spare copies upgrade their card, Tier I to V (tiers.js, `up`).
   - Special currency and the stores are not built yet. */
const SAVE_KEY = 'rogue.save';
const SAVE_VERSION = 4;        // v2 (user, v0.6): the starter packs are gone, so older saves start over. v3 (v0.58, user: "reset data
                               // for all" with the weapon and pack rework): every save starts fresh, here and the one online (online.js).
                               // v4 (v0.70, user: "default money is 500; reset all data"): again (docs/supabase-update-6.sql clears the online side)
const DECK_LIMIT = 31;
const COPY_LIMIT = 14;         // copies of one card a deck can hold (v0.52, user: 14; 7 since v0.47, so its ×7 ult can happen; 5 before)
// v0.52 (user: 14 copies, but you must include 7 other cards to balance it): more than `over` copies of one card, and
// the deck needs at least `others` cards that aren't that one.
const BALANCE = { over: 7, others: 7 };
const OWN_LIMIT = 999;         // copies of one card you can own (v0.46, user: packs kept stopping at 5)
const START_GOLD = 500;      // v0.70 (user: "default money is 500"): 500 (900 in v0.64, 1000 in v0.55, 350 in v0.53)
// v0.53 (user: "reset the data of coins"): every save's gold goes back to START_GOLD once, when it next loads.
const GOLD_RESET = 2;        // v0.55: 2, every save gets at least START_GOLD once
const GOLD_PER = 15;           // 1 gold for every 15 enemies defeated in a run, paid when you die or quit (user; 50 until v0.43)

function blankSave() {
  return {
    v: SAVE_VERSION,
    owned: {},              // card id → copies you own (0–999; a deck holds up to 14 of each)
    equipped: {},           // card id → copies in the deck
    gold: START_GOLD,       // for the store. A new save (or a reset) starts with this (v0.55, user: 1000; 350 in v0.53, 100 since v0.30, 0 before)
    goldReset: GOLD_RESET,  // which gold reset this save has had (below)
    starterDone: false,     // the starter pack has been opened (its cards are in the collection)
    starterSeen: false,     // …and its reveal finished
    off: {},                // v0.53 (user): decks switched off in Loadout ('ranged' / 'melee' → true): kept, not played
    meleeGift: 0,           // v0.53: a save from before the melee update got the melee starter cards (MELEE_GIFT)
    starterIds: null,       // v0.58: the starter pack is rolled now: what it gave, so its reveal can show them again
    seen: {},               // v0.61: the enemies you've met (the Archives, archive.js: id → true)
    up: {},                 // v0.62: each card's upgrade (tiers.js): id → { t: tier 1–5, xp: copies in its bar }
    wildKind: null,         // v0.63 (user): the deck the Wild deck doubles, 'ranged' or 'melee' (null: none)
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
      out.equipped[id] = Math.min(out.equipped[id], out.owned[id] || 0, COPY_LIMIT * 2);   // (×2: a Wild deck, v0.63)
    }
    // the Wild deck: v0.62's own third deck (`wild`, never pushed) goes into the deck it was the kind of, now doubled
    if (out.wild && typeof out.wild === 'object') {
      const had = Object.entries(out.wild).filter(([id, n]) => CARDS[id] && n > 0);
      out.wildKind = had.length ? out.wildKind : null;
      for (const [id, n] of had) out.equipped[id] = Math.min((out.equipped[id] || 0) + n, out.owned[id] || 0, COPY_LIMIT * 2);
    }
    delete out.wild;
    if (out.wildKind !== 'ranged' && out.wildKind !== 'melee') out.wildKind = null;
    out.up = cleanTiers(out.up);
    out.gold = Math.max(0, Math.floor(out.gold) || 0);
    if ((s.goldReset || 0) < GOLD_RESET) { out.gold = (s.goldReset || 0) < 1 ? START_GOLD : Math.max(out.gold, START_GOLD); out.goldReset = GOLD_RESET; try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch (err) { /* again next time */ } }
    if (!out.off || typeof out.off !== 'object') out.off = {};
    if (!out.seen || typeof out.seen !== 'object') out.seen = {};
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
  save.at = Date.now();                    // v0.56: when, so the newer of this PC's save and the online one wins (online.js)
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); saveWorks = true; }
  catch (err) { saveWorks = false; }
  if (typeof cloudPush === 'function') cloudPush();
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
// A deck's copies (card id → n) and which kind of card it holds (v0.62 had a separate Wild deck; there are two now).
const deckMap = () => save.equipped;
const deckKind = kind => kind;

// Why these decks can't start a run, if anything. Either deck may be empty (user: melee only, or ranged only).
function deckProblems() {
  return [...(runCards().length ? [] : [equippedCards().length ? 'Both decks are off.' : 'Both decks are empty.']),
    ...['ranged', 'melee'].filter(deckOn).flatMap(deckProblemsOf)];   // (a deck that's off can't stop a run)
}
// A deck switched off in Loadout (v0.53, user: easy to turn melee or ranged off) keeps its cards but sits out of runs.
const deckOn = kind => !save.off?.[kind];
// The Wild deck (v0.63, user: "instead of another deck, if any ranged or melee is selected for wild deck the deck
// increases to 31 × 2, and then 2 decks will use from that pool"; "make wild deck auto off when there is no more than
// 31"). Wild is a choice of ranged or melee (`wildKind`), open once a deck is full (31; v0.70, both before). The chosen deck then holds
// up to 62 cards, 28 of one (the limits ×2), and in a run that pool is dealt into two decks that both play, each on
// its own timer (the second is `wdeck`, combat.js wildDeckStep). Each card's copies are dealt out in turn, so the two
// halves are as even as can be and a ×7 can still happen in both. With 31 cards or fewer it's one deck: Wild is off.
// (v0.62's version was a third deck you built on its own.)
const deckFull = kind => equippedCards(kind).length >= DECK_LIMIT;
const wildOpen = () => deckFull('ranged') || deckFull('melee');   // (v0.70, user: either deck full; both before)
const wildKindNow = () => (save.wildKind === 'ranged' || save.wildKind === 'melee' ? save.wildKind : null);
const doubled = kind => wildKindNow() === kind;
const deckCap = kind => DECK_LIMIT * (doubled(kind) ? 2 : 1);
const copyCap = kind => COPY_LIMIT * (doubled(kind) ? 2 : 1);
const wildOn = () => { const k = wildKindNow(); return !!k && deckOn(k) && equippedCards(k).length > DECK_LIMIT; };
// The doubled deck's two halves: copies dealt to each in turn (roster order keeps a card's copies together).
function wildHalves() {
  const a = [], b = [];
  equippedCards(wildKindNow()).forEach((id, i) => (i % 2 ? b : a).push(id));
  return [a, b];
}
// The cards a run plays: both decks', less any that's switched off (with Wild on, the first half of the doubled one) …
const runCards = () => { const k = wildOn() ? wildKindNow() : null, half = k ? wildHalves()[0] : [];
  return equippedCards().filter(id => deckOn(kindOf(id)) && kindOf(id) !== k).concat(half); };
// … and the second half, the second deck of that kind.
const runWild = () => (wildOn() ? wildHalves()[1] : []);
// One deck's ('ranged' / 'melee'). A doubled one has twice the limits.
function deckProblemsOf(kind) {
  const out = [], cards = equippedCards(kind), m = doubled(kind) ? 2 : 1, cap = deckCap(kind), copies = copyCap(kind);
  if (cards.length > cap) out.push(`${cards.length} cards; the limit is ${cap}.`);
  for (const id of CARD_IDS.filter(k => kindOf(k) === kind)) {
    const n = save.equipped[id] || 0;
    if (n > copies) out.push(`${CARDS[id].name}: ${n} copies; the limit is ${copies}.`);
    const others = cards.length - n;
    if (n > BALANCE.over * m && others < BALANCE.others * m && !CARDS[id].tball)   // (T-Balls need no other cards: tballs.js)
      out.push(`${n} ${CARDS[id].name} needs ${BALANCE.others * m} other ${kind} cards with it: add ${BALANCE.others * m - others} more.`);
    if (usedCopies(id) > (save.owned[id] || 0)) out.push(`${CARDS[id].name}: more equipped than owned.`);
  }
  return out;
}

// The starter pack (STARTER). v0.58 (user): 10 cards, rolled like any pack. They go into the collection and become the
// first decks: every card goes in its own deck (ranged or melee), up to BALANCE.over copies of one, so the decks are
// always fine to play (8+ of one card would need 7 others).
// v0.62 (user: "GET 2 starter packs at the beginning with improve drop rates!"): two packs (STARTER_PACKS), rolled with
// STARTER_ODDS, both opened at once and saved together; the reveal shows them one pack at a time (menus.js).
function openStarter() {
  if (save.starterDone) return save.starterIds || [];
  const rng = newRng(), ids = Array.from({ length: STARTER_PACKS }, () => rollPack(STARTER, rng, STARTER_ODDS)).flat();
  addToCollection(ids);
  save.equipped = {};
  for (const id of ids) save.equipped[id] = Math.min(BALANCE.over, (save.equipped[id] || 0) + 1);
  save.starterIds = ids;
  save.starterDone = true;
  save.meleeGift = MELEE_GIFT;           // (its melee cards are in it)
  writeSave();
  if (typeof onlinePull === 'function') for (let i = 0; i < ids.length; i += PACK_SIZE) onlinePull('starter', 'starter', ids.slice(i, i + PACK_SIZE));   // (one record per pack)
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
  if (typeof onlinePull === 'function') onlinePull('store', key, ids, pk.price);   // (online.js: the admin view's pull rates)
  return { ids, where };
}

// Gold for a finished run: 1 per GOLD_PER defeated. Returns what was added.
function payGold(kills) {
  const n = Math.floor(kills / GOLD_PER);
  if (n > 0) { save.gold += n; writeSave(); }
  return n;
}
