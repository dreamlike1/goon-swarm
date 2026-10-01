/* deck.js — Deck: the shuffled attack order. Pure state, no DOM or canvas. */
'use strict';

/* ============================================================
   Deck: pure state. No DOM, no canvas. Combat calls draw().

   Every sequence is exactly 7 cards, never more or fewer.
   The deck is a draw pile and a used pile. A sequence takes the next 7
   cards off the draw pile; when it ends, its cards go to the used pile.
   When the draw pile has fewer than 7 left, the sequence takes those last
   cards and the rest of its slots stay empty (face down). Only once the
   last cards have fired is the used pile shuffled into a new draw pile,
   and the empty slots are filled from it. Nothing is decided early.
   Example, 10 cards: 7, then the last 3 + 4 face down → the 3 fire →
   shuffle the 7 used → the 4 are revealed.

   A deck smaller than 7 has no used cards to shuffle when it runs out,
   so it shuffles the whole deck again instead (5 cards: all 5 + 2 face
   down → shuffle the deck → the 2 are revealed, and so on).
   ============================================================ */
const SEQUENCE_SIZE = 7;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(cards, rng) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Weapon luck (v0.52, user): `luck()` gives this moment's chances { p3, p7 } (upgrades.js deckLuck). It only reorders
// the draw pile as a sequence is dealt, never adds cards: a ×7 needs 7 copies of a card still to be dealt, a ×3 three.
// After a luck-made ×7 the next sequence can't roll for one. The rolls always use the rng the same number of times,
// so a co-op guest's copy of the deck (coop.js) stays in step.
function createDeck(cards, rng, seqSize = SEQUENCE_SIZE, luck = null) {
  cards = cards.slice();                // the run's own list: cards won mid-run are added to it
  let small = cards.length < seqSize;
  const ids = cards.map((_, i) => i);   // piles hold card positions, so copies of a card stay distinct
  let pending = [];                     // cards won mid-run, joining at the next sequence
  let removing = [];                    // cards lost mid-run, leaving at the next sequence
  let drawPile = shuffle(ids, rng);
  let used = [];
  let hand = [];                        // this sequence: card positions, or null for a face-down slot waiting on the shuffle
  let firstNew = [];                    // slots whose cards came from a shuffle during this sequence
  let pos = 0;                          // next slot to fire
  let seqNo = 1;                        // sequences played so far this run, counting from 1
  let shuffles = 1;                     // shuffles so far this run (the first is the one the run starts with)
  let lucky = 0;                        // what weapon luck made of this sequence: 3, 7 or 0
  let rested = false;                   // the last sequence was a lucky ×7: no roll for one this time

  // Shuffle the used pile (or, for a small deck, the whole deck) into a new draw pile.
  function reshuffle() {
    const from = small ? ids : used;
    drawPile = shuffle(from, rng);
    if (!small) used = [];
    shuffles++;
    return from.map(i => cards[i]);
  }
  // Fill empty slots from the draw pile, in order. Returns the slots filled.
  function fill() {
    const filled = [];
    for (let i = 0; i < hand.length && drawPile.length; i++) if (hand[i] === null) { hand[i] = drawPile.shift(); filled.push(i); }
    return filled;
  }
  // A card won mid-run joins at a sequence boundary (nothing in hand), shuffled into the draw pile at a random
  // spot so it can come up this pass. A small deck that reaches 7 switches to the draw + used piles: the used
  // pile is then whatever of the current shuffle has already been played (every id not still in the draw pile).
  function applyAdds() {
    for (const c of pending) {
      const id = cards.length;
      cards.push(c);
      if (small && cards.length >= seqSize) {
        const waiting = new Set(drawPile);
        used = ids.filter(i => !waiting.has(i));
        small = false;
      }
      ids.push(id);
      drawPile.splice(Math.floor(rng() * (drawPile.length + 1)), 0, id);
    }
    pending = [];
    // A lost card leaves at a sequence boundary too: one copy, from the draw or used pile. The deck never
    // goes below 1 card. A deck that drops under 7 goes back to whole-deck shuffles.
    for (const c of removing) {
      if (ids.length <= 1) break;
      const pick = pile => pile.findIndex(i => cards[i] === c);
      let k = pick(drawPile);
      let id;
      if (k >= 0) id = drawPile.splice(k, 1)[0];
      else if ((k = pick(used)) >= 0) id = used.splice(k, 1)[0];
      else continue;
      ids.splice(ids.indexOf(id), 1);
      if (!small && ids.length < seqSize) { small = true; used = []; }
    }
    removing = [];
  }
  function deal() {
    applyAdds();
    hand = Array(seqSize).fill(null);
    firstNew = [];
    pos = 0;
    const shuffled = drawPile.length ? null : reshuffle();   // ran out exactly as the last sequence ended
    lucky = luck ? pullTogether(luck()) : 0;
    fill();
    return shuffled;
  }
  // Weapon luck: maybe gather copies of one card at the front of the draw pile, the next sequence. Swaps only.
  function pullTogether({ p3 = 0, p7 = 0 }) {
    const r7 = rng(), r3 = rng(), r = rng();                // (always three rolls: see above)
    if (small || drawPile.length < seqSize) { rested = false; return 0; }
    const swap = (i, j) => { [drawPile[i], drawPile[j]] = [drawPile[j], drawPile[i]]; };
    const at = (c, from) => { for (let j = from; j < drawPile.length; j++) if (cards[drawPile[j]] === c) return j; return -1; };
    if (!rested && r7 < p7) {
      const n = countCards(drawPile.map(i => cards[i]));
      const ok = Object.keys(n).filter(c => n[c] >= seqSize).sort();
      if (ok.length) {
        const c = ok[Math.floor(r * ok.length)];
        for (let k = 0; k < seqSize; k++) if (cards[drawPile[k]] !== c) swap(k, at(c, k + 1));
        rested = true;
        return 7;
      }
    }
    rested = false;
    if (r3 >= p3) return 0;
    const front = drawPile.slice(0, seqSize).map(i => cards[i]);
    for (let k = 0; k + 2 < seqSize; k++) if (front[k] === front[k + 1] && front[k] === front[k + 2]) return 0;   // one's there already
    for (let t = 0, s0 = Math.floor(r * (seqSize - 2)); t < seqSize - 2; t++) {   // from a random slot, the first that can
      const s = (s0 + t) % (seqSize - 2), c = front[s];
      const a = at(c, s + 1);
      if (a < 0 || at(c, a + 1) < 0) continue;
      if (a !== s + 1) swap(s + 1, a);
      swap(s + 2, at(c, s + 2));
      return 3;
    }
    return 0;
  }
  deal();

  return {
    get size() { return ids.length; },
    get sequence() { return hand.map(id => (id === null ? null : cards[id])); },   // null = face down, not dealt yet
    get seqPos() { return pos; },
    get seqNo() { return seqNo; },
    get passNo() { return shuffles; },
    get lucky() { return lucky; },                                                                 // weapon luck's doing this sequence
    get left() { return hand.slice(pos).filter(id => id !== null).length + drawPile.length; },   // cards left before the next shuffle
    get passBreaks() { return firstNew.slice(); },                                                 // where shuffled-in cards start
    piles() { return { draw: drawPile.slice(), hand: hand.filter(id => id !== null), used: used.slice() }; },   // for checks
    get cards() { return ids.map(i => cards[i]); },                                                // this run's deck, won and lost cards included
    get pendingAdds() { return pending.slice(); },
    // Adds a card to this run's deck only (the saved loadout doesn't change). It joins at the next sequence.
    addCard(card) { pending.push(card); },
    // Removes one copy of a card from this run's deck only. It leaves at the next sequence.
    removeCard(card) { removing.push(card); },
    // True if every card of the deck is in exactly one pile (decks of 7 or more).
    intact() {
      if (small) return true;
      const all = [...drawPile, ...hand.filter(id => id !== null), ...used].sort((a, b) => a - b);
      return all.join() === ids.join();
    },
    // Plays the next card. If that was the last card before an empty slot, the deck shuffles now and
    // fills the empty slots: `reshuffle` holds the cards shuffled in, `filled` the slots filled.
    // `sequence` is set on the 7th card, and the next sequence is dealt straight away.
    draw() {
      const id = hand[pos];
      const ev = { card: cards[id], seqNo, passNo: shuffles, slot: pos, sequence: null, reshuffle: null, filled: null };
      pos++;
      if (pos < hand.length && hand[pos] === null) {
        ev.reshuffle = reshuffle();
        ev.filled = fill();
        firstNew.push(ev.filled[0]);
      }
      if (pos === hand.length) {
        ev.sequence = hand.map(x => cards[x]);
        if (!small) used.push(...hand);
        seqNo++;
        const shuffled = deal();
        if (shuffled) { ev.reshuffle = shuffled; ev.filled = [...hand.keys()]; }
      }
      return ev;
    },
  };
}

function countCards(cards) {
  const n = {};
  for (const c of cards) n[c] = (n[c] || 0) + 1;
  return n;
}

// Two lists hold the same cards (in any order).
function sameMix(a, b) {
  if (a.length !== b.length) return false;
  const na = countCards(a), nb = countCards(b);
  return Object.keys(na).every(k => na[k] === nb[k]);
}

// Deals many shuffles of several deck sizes and checks the rules above: every sequence is exactly 7,
// each card fired is the one shown, no card fires before it's been dealt face up, a shuffle happens
// only once the counter reaches 0, and (for decks of 7 or more) every card is always in exactly one pile.
function selfTest(shuffles) {
  const decks = [
    ['a', 'b', 'c', 'd', 'e', 'f'].flatMap(c => Array(5).fill(c)).concat('g'),   // 31 cards
    Array.from({ length: 10 }, (_, i) => 'c' + (i % 6)),                         // 10 cards
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'],                                         // exactly 7
    Array.from({ length: 20 }, (_, i) => 'c' + (i % 6)),                         // 20 cards
    ['a', 'a', 'a', 'b', 'c'],                                                   // 5 cards (a beginner pack)
    ['a', 'b', 'c'],                                                             // 3 cards
  ];
  let ok = 0, total = 0;
  decks.forEach((cards, k) => {
    const d = createDeck(cards, mulberry32(0xC0FFEE + k));
    let good = true;
    for (let p = 0; p < shuffles; p++) {
      total++;
      let ev;
      do {
        const seq = d.sequence, expect = seq[d.seqPos], leftBefore = d.left;
        if (seq.length !== SEQUENCE_SIZE || expect == null) good = false;
        ev = d.draw();
        if (ev.card !== expect) good = false;
        if (ev.sequence && (ev.sequence.length !== SEQUENCE_SIZE || ev.sequence.includes(undefined))) good = false;
        if (ev.reshuffle && leftBefore !== 1) good = false;
        if (!d.intact()) good = false;
      } while (!ev.reshuffle);
      if (good) ok++;
    }
  });
  return { ok, passes: total };
}
