/* net.js — The co-op basics every other file can use from the start (v0.45): the tuning, who's connected, whose turn
   it is (ACTIVE) and the view. The connecting, the pictures of the arena and the co-op screens are in coop.js. */
'use strict';

const COOP = {
  max: 4, snapMs: 50, inMs: 33, pingMs: 1000, world: 1.6,
  count: 1.0, hp: 0.75, boss: 0.8,                    // per extra player: enemy count +100%, enemy HP +75%, boss HP +80%
  pickTime: 10, reviveReach: 70,
  // v0.46 (user): hold E next to a friend who's down (you stand still while you do). `hold` s brings them back at full
  // health; each extra friend holding adds `help` speed; let go and it drains back at `drain`. Then everyone in it
  // gets the mini shield for `shield` s.
  revive: { hold: 2.5, help: 0.5, drain: 1, shield: 3 },
  countdown: 3,                                        // seconds from Start to the run (everyone must be ready)
  // Lag (v0.46): a guest draws everything else `delay` ms in the past, between two pictures, so it moves smoothly;
  // the delay follows how uneven the pictures arrive (min–max), and past the newest picture it carries on for up to
  // `ext` ms. The host moves each guest ahead by half their ping (up to `lead` s) so where you are on the host
  // matches your own screen. `backlog`: skip a picture when this much is still waiting to go out to that friend.
  interp: { min: 60, max: 260, ext: 110 }, lead: 0.12, backlog: 48 * 1024,
  colors: ['#fff6fb', '#5fd3ff', '#9dff6a', '#ffb347', '#ff7ce0', '#b79cff', '#ffe45c', '#4ef0c8'],
  // Your look (v0.46): a colour, or an emoji over it (whichever you picked last). Some are from the newest emoji sets.
  emojis: ['😎', '🤖', '👽', '👻', '💀', '🤡', '🥷', '🧙', '🐸', '🐱', '🐶', '🦊', '🐼', '🐧', '🦄', '🐙',
    '🦖', '🐢', '🐝', '🦈', '🔥', '⭐', '🍕', '🎃', '🫠', '🫡', '🥹', '🪿', '🫎', '🪼', '🐦‍🔥', '🍄‍🟫'],
  peerjs: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', prefix: 'packs-silica-',
};

// NET: the connection and the players. ACTIVE: whose deck, stats and BULL the game's globals point at right now
// (the host switches between players as it runs each one's part of the frame).
const NET = { on: false, host: false, guest: false, run: false, key: '', name: '', me: null, players: [], lobby: [], world: null,
  peer: null, conn: null, fast: null, conns: new Map(), nid: 0, holdE: false, ready: false, countEnd: 0, myCards: null, mySeed: 0, snap: null, lastIn: 0, lastSnap: 0, lastPing: 0, wantDash: false };
let ACTIVE = null;
let VW = 0, VH = 0;                                    // the view (the arena on screen); W / H are the world in co-op
const cam = { x: 0, y: 0 };

/* ---------- players ---------- */
// What each player has of their own; the game keeps the active player's copy in `game`.
const PKEYS = ['cooldown', 'cdTotal', 'aug', 'echoes', 'shield', 'shieldHit', 'dash', 'dashCd', 'muzzle', 'relics', 'frost', 'defl', 'deflCd', 'deflAge'];
function usePlayer(c) {
  if (!c || c === ACTIVE) return;
  if (ACTIVE) for (const k of PKEYS) ACTIVE[k] = game[k];
  ACTIVE = c;
  for (const k of PKEYS) game[k] = c[k];
  game.player = c.body; deck = c.deck; stats = c.stats; picks = c.picks;
}
const byId = id => NET.players.find(c => c.id === id) || null;
const usePlayerId = id => { if (NET.run) usePlayer(byId(id) || NET.me); };
const ownerId = () => (NET.run && ACTIVE ? ACTIVE.id : 0);
const isLocal = () => !NET.run || NET.guest || ACTIVE === NET.me;   // DOM (HP bar, tray, relic chip) only follows your own player
const living = () => NET.players.filter(c => !c.down);
// Runs fn once as each living player (hazards that can hit anyone), then goes back to whoever was active.
function eachLiving(fn) {
  if (!NET.run) { fn(); return; }
  const was = ACTIVE;
  for (const c of living()) { usePlayer(c); fn(c); }
  usePlayer(was);
}
function eachPlayer(fn) {
  const was = ACTIVE;
  for (const c of NET.players) { usePlayer(c); fn(c); }
  usePlayer(was);
}
// The living player nearest to (x, y), made active; null if everyone is down.
function nearestLiving(x, y) {
  let best = null, bd = Infinity;
  for (const c of NET.players) {
    if (c.down) continue;
    const d = Math.hypot(c.body.x - x, c.body.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) usePlayer(best);
  return best;
}
// Who picks up something at (x, y) this frame (their BULL charge reaches further): their body, made active.
function reacher(x, y, r) {
  if (!NET.run) return playerReach(x, y) < PLAYER.r + (game.dash ? BULL.grab : 2) + r ? game.player : null;
  for (const c of living()) { usePlayer(c); if (playerReach(x, y) < PLAYER.r + (game.dash ? BULL.grab : 2) + r) return c.body; }
  return null;
}
// (a guest only holds itself in NET.players, so it counts the players in the host's pictures)
const coopN = () => (!NET.run ? 1 : NET.guest ? Math.max(1, (NET.pings || NET.roster || []).length) : NET.players.length);
const coopCount = () => 1 + COOP.count * (coopN() - 1);   // enemy count and spawn rate
const coopHp = () => 1 + COOP.hp * (coopN() - 1);         // enemy HP
const coopBossHp = () => 1 + COOP.boss * (coopN() - 1);   // SKURTOSAURUS, OBI ONE and MAKORA

function freshStats() { const s = {}; for (const id of STAT_IDS) s[id] = BASE_STATS[id] || 0; return s; }
function freshPicks() { const s = {}; for (const id of STAT_IDS) s[id] = { n: 0, best: -1 }; return s; }
function newCtx(id, name, color, local, cards, seedN) {
  return { id, name, color, local, body: { x: W / 2, y: H / 2, flash: 0, hp: PLAYER.hp, safe: 0, kx: 0, ky: 0 },
    deck: createDeck(cards, mulberry32(seedN), SEQUENCE_SIZE, deckLuck), stats: freshStats(), picks: freshPicks(),
    cooldown: ATTACK_INTERVAL, cdTotal: ATTACK_INTERVAL, aug: new Set(), echoes: [], shield: 0, shieldHit: 0, dash: null, dashCd: 0,
    muzzle: null, relics: [], frost: null, defl: 0, deflCd: 0, deflAge: 9,
    down: false, rev: 0, reviving: false, ping: 0, fired: 0, outbox: [], pickQ: [], pick: null,
    net: { mx: 0, my: 0, x: null, y: null, dash: false, rv: false, at: 0, seq: 0, mash: 0, mashQ: 0, dfl: 0, dflQ: 0 } };
}
