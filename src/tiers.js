/* tiers.js — Card upgrades (v0.62, user): every card goes from Tier I up to Tier V, fed with copies of itself. */
'use strict';

/* How it works (user: "each card can be upgraded to tier V … you can upgrade card using copies of that card … add a
   bar system … you just need only 1 copy to upgrade … higher rarity = higher bar"):
   - A card's tier is for the card, not one copy: every copy you own plays at that tier, in every deck.
   - Each card has a bar. Every copy you feed it fills one notch; a full bar takes it up a tier and starts empty again.
     A Tier I Common's bar is 5 copies (user: "bliky 1 can eat up to 5 cards"); each tier needs TIER_GROW more, and
     the rarer the card, the longer its bar (TIER_BAR).
   - Only spare copies can be fed: not ones in a deck, and never your last one.
   - What each tier gives depends on the weapon (TIER_PLAN, auto-balanced, user): more damage, attack speed (the next
     card of its deck comes sooner), a longer effect (sleep, roots, shield…), or one more bullet, hit or bounce.
   - Where it counts: runs, co-op (each player's own tiers), Test loadout and the main menu's demo fight. The store's
     Test pack and the Archives show every weapon at Tier I.
   Numbers are placeholders. */
const TIER_MAX = 5;
const TIER_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const TIER_BAR = { common: 5, uncommon: 6, rare: 7, epic: 8, legendary: 9, sss: 10, event: 8 };   // copies from Tier I to II
const TIER_GROW = 2;                                   // each tier after that takes this many more
const tierNeed = (id, t) => (TIER_BAR[CARDS[id]?.rarity] || 5) + TIER_GROW * (t - 1);
// One step's size: +15% damage; 8% less time before its deck's next card; +20% to its effect's time; +1 of a count.
const TIER_STEP = { dmg: 0.15, pace: 0.08, dur: 0.2 };
// Each weapon's four steps (Tier II, III, IV, V). 'dmg', 'pace', 'dur', or '+field': one more of that card field
// (pellets, grape, burst, hits, bounces, volley, pops, pierce) or of Iron Will's blocks.
const TIER_PLAN = {
  bullet: ['dmg', 'pace', 'dmg', 'pace'],
  laser: ['dmg', 'pace', 'dmg', 'dmg'],
  cannon: ['dmg', 'pace', 'dmg', 'dmg'],
  shuriken: ['dmg', '+bounces', 'dmg', '+bounces'],
  spaceimpact: ['dmg', '+pierce', 'dmg', 'pace'],
  mine: ['dmg', 'pace', 'dmg', 'dmg'],
  sniper: ['dmg', 'pace', 'dmg', 'pace'],
  missiles: ['dmg', '+volley', 'dmg', '+volley'],
  twinflame: ['dmg', 'pace', 'dmg', 'pace'],
  arcana: ['dmg', 'pace', 'dmg', 'dmg'],
  explomagus: ['dmg', 'pace', 'dmg', 'dmg'],
  gravamagus: ['dmg', 'pace', 'dmg', 'dmg'],
  darkmagus: ['dmg', 'dur', 'dmg', 'dur'],
  druidity: ['dur', 'dmg', 'dur', 'dmg'],
  gatling: ['dmg', 'pace', 'dmg', 'pace'],
  cryo: ['dmg', 'dur', 'dmg', 'dur'],
  geartoss: ['dmg', 'dur', 'dmg', 'pace'],
  pressurewasher: ['pace', 'dmg', 'pace', 'dmg'],
  soapgun: ['dmg', '+pops', 'dmg', '+pops'],
  superwasher: ['dmg', 'pace', 'dmg', 'dmg'],
  knife: ['dmg', 'pace', 'dmg', 'pace'],
  sonickick: ['dmg', 'pace', 'dmg', 'dmg'],
  ironwill: ['dur', '+blocks', 'dur', '+blocks'],
  tempest: ['dmg', 'dur', 'dmg', 'dmg'],
  dragonkick: ['dmg', 'pace', 'dmg', 'pace'],
  punch: ['dmg', '+hits', 'dmg', 'pace'],
  brickshot: ['dmg', '+bounces', 'dmg', 'pace'],
  shotgun: ['+pellets', 'dmg', '+pellets', 'dmg'],
  slap: ['pace', 'dmg', 'pace', 'dmg'],
  grapeshot: ['+grape', 'dmg', '+grape', 'dmg'],
  flashbang: ['dur', 'pace', 'dur', 'pace'],
  rambo: ['dmg', '+hits', 'dmg', 'pace'],
  hammer: ['dmg', 'pace', 'dmg', 'dmg'],
  blowpipe: ['dur', 'dmg', 'dur', 'pace'],
  fistopheles: ['dmg', '+hits', 'dmg', '+hits'],
  enpassant: ['dmg', 'pace', 'dmg', 'dmg'],
  karishnikov: ['+burst', 'dmg', '+burst', 'dmg'],
  tball: ['dmg', 'pace', 'dmg', 'dmg'],
  tballm: ['dmg', 'pace', 'dmg', 'dmg'],
};
const TIER_DEFAULT = ['dmg', 'pace', 'dmg', 'dmg'];
const tierPlan = id => TIER_PLAN[id] || TIER_DEFAULT;
// What a longer effect is, in words, and what one more of a field is.
const DUR_NAME = { blowpipe: 'sleep', flashbang: 'daze', druidity: 'hold', darkmagus: 'drain', cryo: 'frost field', geartoss: 'confusion',
  ironwill: 'shield', tempest: 'cracked ground' };
const ADD_NAME = { pellets: ['pellet', 'pellets'], grape: ['shot', 'shots'], burst: ['round', 'rounds'], hits: ['hit', 'hits'],
  bounces: ['bounce', 'bounces'], volley: ['missile', 'missiles'], pops: ['bubble', 'bubbles'], pierce: ['pierce', 'pierces'], blocks: ['blocked hit', 'blocked hits'] };
function tierStepText(id, s) {
  if (s === 'dmg') return `+${Math.round(TIER_STEP.dmg * 100)}% damage`;
  if (s === 'pace') return `+${Math.round(TIER_STEP.pace * 100)}% attack speed`;
  if (s === 'dur') return `+${Math.round(TIER_STEP.dur * 100)}% ${DUR_NAME[id] || 'effect'} time`;
  return `+1 ${(ADD_NAME[s.slice(1)] || [s.slice(1)])[0]}`;
}

/* ---------- a card's tier ---------- */
const cardTier = id => Math.max(1, Math.min(TIER_MAX, save.up?.[id]?.t || 1));   // yours
const tierXp = id => save.up?.[id]?.xp || 0;
const myTiers = () => Object.fromEntries(Object.entries(save.up || {}).filter(([, u]) => u.t > 1).map(([id, u]) => [id, u.t]));
// The tier a card plays at right now: whoever's attack this is (co-op: each player's own), or Tier I in the store's
// Test pack and the Archives (every weapon there is shown as it comes).
function tierNow(id) {
  const pr = game.practice;
  if (pr && (pr.archive || pr.pack)) return 1;
  if (NET.run && ACTIVE) return ACTIVE.tiers?.[id] || 1;
  return cardTier(id);
}
// Everything a tier adds: { dmg, pace, dur } multipliers and `add` (field → +n).
const tierCache = new Map();
function tierBonus(id, t = tierNow(id)) {
  const key = id + ':' + t;
  if (tierCache.has(key)) return tierCache.get(key);
  const out = { dmg: 1, pace: 1, dur: 1, add: {} };
  for (const s of tierPlan(id).slice(0, t - 1)) {
    if (s === 'dmg') out.dmg += TIER_STEP.dmg;
    else if (s === 'pace') out.pace *= 1 - TIER_STEP.pace;
    else if (s === 'dur') out.dur += TIER_STEP.dur;
    else out.add[s.slice(1)] = (out.add[s.slice(1)] || 0) + 1;
  }
  tierCache.set(key, out);
  return out;
}
const durMul = id => tierBonus(id).dur;
const paceMul = id => (CARDS[id] ? tierBonus(id).pace : 1);
// The card's stats at its tier (the attacks read their counts and times from this): CARDS[id] itself at Tier I.
const specCache = new Map();
function upSpec(id, t = tierNow(id)) {
  const k = CARDS[id];
  if (!k || t <= 1) return k;
  const key = id + ':' + t;
  if (specCache.has(key)) return specCache.get(key);
  const b = tierBonus(id, t), out = { ...k };
  for (const [f, n] of Object.entries(b.add)) if (f !== 'blocks') out[f] = (k[f] || 0) + n;
  if (k.sleep) out.sleep = k.sleep * b.dur;
  if (k.daze) out.daze = k.daze * b.dur;
  specCache.set(key, out);
  return out;
}
// A hit's damage at its card's tier (combat.js hitEnemy). Rounded up or down at random so a small hit still gains
// on average (a 2-damage pellet at +15% is a 3 now and then).
function tierDmg(card, dmg) {
  const m = CARDS[card] ? tierBonus(card).dmg : 1;
  if (m === 1 || !(dmg > 0)) return dmg;
  const x = dmg * m, lo = Math.floor(x);
  return lo + (Math.random() < x - lo ? 1 : 0);
}

/* ---------- feeding a card ---------- */
// Copies of a card in your decks.
const usedCopies = id => save.equipped[id] || 0;
// Copies you can feed it: not in a deck, and never the last one.
const spareCopies = id => Math.max(0, Math.min((save.owned[id] || 0) - usedCopies(id), (save.owned[id] || 0) - 1));
// Copies still to go to Tier V.
function copiesToMax(id) {
  const t = cardTier(id);
  if (t >= TIER_MAX) return 0;
  let n = tierNeed(id, t) - tierXp(id);
  for (let k = t + 1; k < TIER_MAX; k++) n += tierNeed(id, k);
  return n;
}
// Feeds up to `n` spare copies into the card's bar. Returns { ate, ups } (copies used, tiers gained).
function feedCard(id, n = 1) {
  if (!CARDS[id]) return { ate: 0, ups: 0 };
  save.up = save.up || {};
  const u = save.up[id] || (save.up[id] = { t: 1, xp: 0 });
  let ate = 0, ups = 0;
  while (ate < n && u.t < TIER_MAX && spareCopies(id) > 0) {
    save.owned[id]--; ate++; u.xp++;
    if (u.xp >= tierNeed(id, u.t)) { u.t++; u.xp = 0; ups++; }
  }
  if (u.t >= TIER_MAX) u.xp = 0;
  if (ate) writeSave();
  return { ate, ups };
}
// loadSave: a saved tier list, cleaned up.
function cleanTiers(up) {
  const out = {};
  if (!up || typeof up !== 'object') return out;
  for (const [id, u] of Object.entries(up)) {
    if (!CARDS[id] || !u) continue;
    const t = Math.max(1, Math.min(TIER_MAX, u.t | 0 || 1));
    out[id] = { t, xp: t >= TIER_MAX ? 0 : Math.max(0, Math.min(tierNeed(id, t) - 1, u.xp | 0)) };
  }
  return out;
}
// A co-op guest's tiers as the host gets them: { id: tier }.
function cleanTierMap(m) {
  const out = {};
  if (m && typeof m === 'object') for (const [id, t] of Object.entries(m)) if (CARDS[id] && t > 1) out[id] = Math.min(TIER_MAX, t | 0);
  return out;
}
