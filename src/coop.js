/* coop.js — Online co-op (v0.45, user): host a room, friends join with its key, and everyone fights the same run. */
'use strict';

/* How it works:
   - The CO-OP screen is a login: your name, then Host (you get a room key) or Join (type a friend's key). Someone has
     to host first; joining a key nobody is hosting says so. Up to 4 players.
   - The room (v0.46): everyone's deck is listed, and Edit loadout takes you to the Loadout screen and back. Pick a
     colour, or an emoji over it (whichever you picked last). Friends press Ready; once everyone is, the host's Start
     counts down from 3 (press it again to stop).
   - The host's browser runs the real game. Each friend's browser sends its movement (and Space, picks, holding E)
     and gets back a picture of the whole arena 20 times a second. Your own movement is instant on your screen; the
     host takes your position as you report it (carried ahead by half your ping), except while it's moving you
     itself (a BULL charge, a shove).
   - Lag (v0.46): the pictures go on their own channel that doesn't wait for a late one, and one is skipped when a
     friend's connection is still busy with the last. A guest draws everyone else a little in the past, between two
     pictures, so it moves smoothly; how far back follows how unevenly the pictures arrive.
   - Every player has their own deck, HP, stats, level-up picks and BULL. The team shares one level: every level up
     gives each player 3 cards to pick from on a 10 s timer (a random one if it runs out), and the fight doesn't stop.
     Every 10th level augments a random slot.
   - The arena is bigger (×1.6 each way) and scrolls with you, and there are many more enemies, with more HP.
     Everyone's HP shows under them and in the player list.
   - A player whose HP runs out is DOWN. Stand next to them and hold E (or the button on a touch screen): you stand
     still, a ring fills, and they're back at full health, and everyone in it gets a shield (v0.46; a typing test
     before). If everyone is down, the run is over.
   - Gold, cards and decks stay on each player's own computer: each earns from the team's kills and the bonuses.
   - Connecting: PeerJS (a free public service) introduces the two browsers; after that they talk directly. No
     server or database of our own. On localhost, `?net=local` uses a same-browser channel instead, for testing
     with two tabs. Numbers are placeholders. */

// COOP, NET, ACTIVE, the view and the player switching live in net.js, loaded early (other files use them as they load).

/* ---------- connecting ---------- */
const netLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && /[?&]net=local\b/.test(location.search);
const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newKey = () => 'PS-' + Array.from({ length: 4 }, () => KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]).join('');
const cleanKey = k => { const s = k.toUpperCase().replace(/[^A-Z0-9]/g, ''); return s ? 'PS-' + s.replace(/^PS/, '').slice(0, 4) : ''; };
let peerLoading = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!peerLoading) peerLoading = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = COOP.peerjs; s.onload = ok; s.onerror = () => { peerLoading = null; fail(new Error('Could not load the connection library. Check your internet.')); };
    document.head.appendChild(s);
  });
  return peerLoading;
}
// Same-browser channel for testing on localhost (?net=local): acts like PeerJS's connections.
function localConn(room, self, other) {
  const bc = new BroadcastChannel(`ps-coop-${room}`), on = { data: [], close: [] };
  bc.onmessage = e => { const m = e.data; if (m.to === self && m.from === other) { if (m.bye) on.close.forEach(f => f()); else on.data.forEach(f => f(m.d)); } };
  return { send: d => bc.postMessage({ to: other, from: self, d }), on: (k, f) => on[k].push(f), close: () => { bc.postMessage({ to: other, from: self, bye: true }); bc.close(); }, peer: other, open: true };
}
function localHost(room, onConn) {
  const bc = new BroadcastChannel(`ps-coop-${room}`);
  bc.onmessage = e => { const m = e.data; if (m.knock && m.to === 'host') { bc.postMessage({ to: m.from, from: 'host', d: { t: 'knocked' } }); onConn(localConn(room, 'host', m.from)); } };
  return { destroy: () => bc.close() };
}
function localJoin(room) {
  return new Promise((ok, fail) => {
    const me = 'g' + Math.random().toString(36).slice(2, 8), bc = new BroadcastChannel(`ps-coop-${room}`);
    const t = setTimeout(() => { bc.close(); fail(new Error('No game with that key. Ask your friend to host first.')); }, 1500);
    bc.onmessage = e => { if (e.data.to === me && e.data.d?.t === 'knocked') { clearTimeout(t); bc.close(); ok(localConn(room, me, 'host')); } };
    bc.postMessage({ knock: true, to: 'host', from: me });
  });
}

// Everything goes as JSON text on PeerJS's 'raw' channels (v0.46: its 'json' ones refuse anything over 16 KB, which a
// busy arena with 4 players can reach). The local test channel carries the same text.
function netSend(conn, msg) { try { if (conn && conn.open !== false) conn.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (err) { /* it's closing */ } }
const netRead = d => { if (typeof d !== 'string') return d; try { return JSON.parse(d); } catch (err) { return null; } };
// What's still waiting to go out on a connection (bytes, roughly): the browser's queue plus PeerJS's own.
const backlog = conn => (conn?.dataChannel?.bufferedAmount || 0) + (conn?.bufferSize || 0) * 8000;
const toHost = msg => netSend(NET.conn, msg);
const toHostFast = msg => netSend(NET.fast || NET.conn, msg);
const fastOf = c => c.lobby?.fast || c.conn;        // a player's fast channel (their pictures), or the main one

// Host: open a room under a fresh key.
async function coopHost(name) {
  coopReset();
  Object.assign(NET, { on: true, host: true, name, key: newKey() });
  NET.me = { id: 1, name, color: '', emoji: '', local: true, ping: 0, ready: true };
  NET.lobby = [NET.me];
  setLook(NET.me, myLook().color, myLook().emoji);
  if (netLocal()) { NET.peer = localHost(NET.key, onGuestConn); lobbyChanged(); return NET.key; }
  await loadPeer();
  for (let tries = 0; tries < 4; tries++) {
    try {
      NET.peer = await new Promise((ok, fail) => {
        const p = new Peer(COOP.prefix + NET.key);
        p.on('open', () => ok(p));
        p.on('error', err => fail(err));
      });
      NET.peer.on('connection', conn => conn.on('open', () => (conn.metadata?.fast ? attachFast(conn) : onGuestConn(conn))));
      NET.peer.on('error', err => console.warn('co-op:', err));
      lobbyChanged();
      return NET.key;
    } catch (err) {
      if (err.type === 'unavailable-id') { NET.key = newKey(); continue; }
      throw new Error(err.type === 'network' || err.type === 'server-error' ? 'Could not reach the connection service. Check your internet.' : 'Could not open a room. Try again.');
    }
  }
  throw new Error('Could not open a room. Try again.');
}
function onGuestConn(conn) {
  conn.on('data', d => onHostMsg(conn, netRead(d)));
  conn.on('close', () => guestLeft(conn));
}
// A guest's second channel, for the pictures and their movement: it doesn't hold everything up waiting for a late one.
function attachFast(conn) {
  const g = [...NET.conns.values()].find(x => x.conn.peer === conn.peer);
  if (!g) { try { conn.close(); } catch (err) { /* gone */ } return; }
  g.fast = conn;
  conn.on('data', d => onHostMsg(g.conn, netRead(d)));
  conn.on('close', () => { if (g.fast === conn) g.fast = null; });
}
const cleanCards = cards => (Array.isArray(cards) ? cards.filter(c => CARDS[c]).slice(0, DECK_LIMIT) : ['bullet']);
function onHostMsg(conn, m) {
  if (!m || typeof m !== 'object') return;
  let g = NET.conns.get(conn);
  if (m.t === 'hello') {
    if (NET.run) return netSend(conn, { t: 'no', why: 'That game has already started.' });
    if (NET.countEnd) return netSend(conn, { t: 'no', why: 'That game is starting. Try again in a moment.' });
    if (NET.lobby.length >= COOP.max) return netSend(conn, { t: 'no', why: 'That game is full (4 players).' });
    const id = Math.max(...NET.lobby.map(p => p.id)) + 1;
    g = { id, name: String(m.name || 'Player').slice(0, 14), color: '', emoji: '', local: false, ping: null, conn, fast: null, ready: false,
      cards: cleanCards(m.cards), seed: m.seed >>> 0 };
    setLook(g, m.color, m.emoji);
    NET.conns.set(conn, g);
    NET.lobby.push(g);
    netSend(conn, { t: 'welcome', id, key: NET.key });
    lobbyChanged();
    return;
  }
  if (!g) return;
  if (m.t === 'pong') { g.ping = Math.max(1, Math.round(performance.now() - m.ts)); const c = byId(g.id); if (c) c.ping = g.ping; if (!NET.run) lobbyChanged(); return; }
  // the room
  if (m.t === 'cards') { if (!NET.run) { g.cards = cleanCards(m.cards); g.ready = false; cancelCount(); lobbyChanged(); } return; }
  if (m.t === 'ready') { if (!NET.run) { g.ready = !!m.on; if (!g.ready) cancelCount(); lobbyChanged(); } return; }
  if (m.t === 'look') { if (!NET.run) { setLook(g, m.color, m.emoji); lobbyChanged(); } return; }
  // the run
  const c = byId(g.id);
  if (!c) return;
  if (m.t === 'in') {
    if (m.dash) c.net.dash = true;                         // a dash always counts, even in a late message
    // presses that must never go missing (v0.48): running counts, so a lost or late message still adds up
    if ((m.mash | 0) > c.net.mash) { c.net.mashQ += (m.mash | 0) - c.net.mash; c.net.mash = m.mash | 0; }   // fighting OBI ONE's pull
    if ((m.dfl | 0) > c.net.dfl) { c.net.dflQ += (m.dfl | 0) - c.net.dfl; c.net.dfl = m.dfl | 0; }       // DEFLECT
    const q = m.q | 0;
    if (q && q < c.net.seq) return;                        // an older one that arrived after a newer one: skip it
    c.net.seq = q;
    Object.assign(c.net, { mx: +m.mx || 0, my: +m.my || 0, x: +m.x, y: +m.y, rv: !!m.rv, at: performance.now() });
  } else if (m.t === 'pick') coopPick(c, m.i | 0);
  else if (m.t === 'skip') skipIntro(true);
}
function guestLeft(conn) {
  const g = NET.conns.get(conn);
  NET.conns.delete(conn);
  if (!g) return;
  try { g.fast?.close(); } catch (err) { /* gone */ }
  NET.lobby = NET.lobby.filter(p => p !== g);
  cancelCount();
  const c = byId(g.id);
  if (c) {
    if (ACTIVE === c) usePlayer(NET.me);
    NET.players = NET.players.filter(p => p !== c);
    toast(`${g.name} LEFT`, '');
    if (NET.run && !living().length) coopOver();
  }
  lobbyChanged();
}
// A deck as counts, most first: [['bullet', 5], ['cannon', 5]] (the room shows everyone's).
function deckSummary(cards) {
  const n = {};
  for (const c of cards || []) n[c] = (n[c] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1] || CARDS[a[0]].name.localeCompare(CARDS[b[0]].name));
}
function lobbyChanged() {
  const count = NET.countEnd ? Math.max(0, (NET.countEnd - performance.now()) / 1000) : 0;
  NET.list = NET.lobby.map(p => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji || '', ping: p.ping, ready: p.local || !!p.ready,
    deck: deckSummary(p.local ? equippedCards() : p.cards) }));
  for (const g of NET.conns.values()) netSend(g.conn, { t: 'lobby', list: NET.list, count });
  renderLobby();
}

// Guest: join the room with this key.
async function coopJoin(name, key) {
  coopReset();
  Object.assign(NET, { on: true, guest: true, name, key, myCards: equippedCards(), mySeed: (Math.random() * 2 ** 32) >>> 0 });
  let conn;
  if (netLocal()) conn = await localJoin(key);
  else {
    await loadPeer();
    NET.peer = await new Promise((ok, fail) => {
      const p = new Peer();
      p.on('open', () => ok(p));
      p.on('error', err => fail(new Error(err.type === 'network' || err.type === 'server-error' ? 'Could not reach the connection service. Check your internet.' : 'Could not connect. Try again.')));
    });
    conn = await new Promise((ok, fail) => {
      const c = NET.peer.connect(COOP.prefix + key, { reliable: true, serialization: 'raw' });
      const t = setTimeout(() => fail(new Error('No game with that key. Ask your friend to host first.')), 9000);
      NET.peer.on('error', err => { clearTimeout(t); fail(new Error(err.type === 'peer-unavailable' ? 'No game with that key. Ask your friend to host first.' : 'Could not connect. Try again.')); });
      c.on('open', () => { clearTimeout(t); ok(c); });
    });
  }
  NET.conn = conn;
  conn.on('data', d => onGuestMsg(netRead(d)));
  conn.on('close', () => { if (NET.guest) { coopLeave(); toast('THE HOST LEFT', 'enrage'); } });
  toHost({ t: 'hello', name, cards: NET.myCards, seed: NET.mySeed, color: myLook().color, emoji: myLook().emoji });
}
// Once we're in: a second channel for the pictures (if it can't open, they come on the main one).
function openFast() {
  if (netLocal() || !NET.peer?.connect || NET.fast) return;
  const f = NET.peer.connect(COOP.prefix + NET.key, { reliable: false, serialization: 'raw', metadata: { fast: 1 } });
  f.on('open', () => { if (NET.guest) NET.fast = f; });
  f.on('data', d => onGuestMsg(netRead(d)));
  f.on('close', () => { if (NET.fast === f) NET.fast = null; });
}
function onGuestMsg(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 's') {
    if (!NET.run || (m.q | 0) <= NET.lastQ) return;       // an older picture that arrived after a newer one
    NET.lastQ = m.q | 0;
    NET.snap = m; applySnap(m);
  } else if (m.t === 'ev') guestEvents(m);
  else if (m.t === 'welcome') { NET.myId = m.id; openFast(); renderLobby(); }
  else if (m.t === 'no') { coopLeave(); coopError(m.why); }
  else if (m.t === 'lobby') {
    NET.lobby = NET.list = m.list;
    NET.countEnd = m.count ? performance.now() + m.count * 1000 : 0;
    const mine = m.list.find(p => p.id === NET.myId);
    if (mine) NET.ready = !!mine.ready;
    renderLobby();
  }
  else if (m.t === 'ping') toHost({ t: 'pong', ts: m.ts });
  else if (m.t === 'start') guestStart(m);
  else if (m.t === 'room') coopToRoom();
}

function coopReset() {
  try { NET.peer?.destroy(); } catch (err) { /* gone */ }
  try { NET.conn?.close(); } catch (err) { /* gone */ }
  for (const g of NET.conns.keys()) { try { g.close(); } catch (err) { /* gone */ } }
  Object.assign(NET, { on: false, host: false, guest: false, run: false, key: '', me: null, myId: 0, players: [], lobby: [], list: [], world: null,
    peer: null, conn: null, fast: null, snap: null, ready: false, countEnd: 0, holdE: false });
  NET.conns = new Map();
  ACTIVE = null;
  coopHud(false);
  $('btn-loadout-test').hidden = false;
}
// Leave co-op for good: back to single player. The run (if any) ends.
function coopLeave() {
  const wasRun = NET.run;
  if (NET.host) for (const g of NET.conns.values()) netSend(g.conn, { t: 'bye' });
  if (wasRun && NET.host) usePlayer(NET.players[0]);        // the host's own run back in the globals
  coopReset();
  closeRevive(); closePick();
  if (wasRun) { stats = SOLO.stats; picks = SOLO.picks; game.player = SOLO.body; resize(); exitToTitle(); }
  else renderLobby();
}
const SOLO = { stats, picks, body: game.player };   // the single-player objects, put back when co-op ends

/* ---------- the room: ready, look, loadout ---------- */
const allReady = () => NET.lobby.length > 1 && NET.lobby.every(p => p.local || p.ready);
function clickStart() {
  if (!NET.host || NET.run) return;
  if (NET.countEnd) { cancelCount(); return; }            // pressed again: stop the countdown
  if (deckProblems().length) { coopError('Fix your deck first (Edit loadout).'); return; }
  if (!allReady()) return;
  coopError('');
  NET.countEnd = performance.now() + COOP.countdown * 1000;
  lobbyChanged();
}
function cancelCount() { if (!NET.countEnd) return; NET.countEnd = 0; if (NET.host) lobbyChanged(); }
setInterval(() => {                                     // the countdown: its number, and the start when it runs out
  if (!NET.on || NET.run || !NET.countEnd) return;
  if (NET.host) {
    if (!allReady()) { cancelCount(); return; }
    if (performance.now() >= NET.countEnd) { NET.countEnd = 0; coopStart(); return; }
  }
  renderLobbyText();
}, 200);
function setReady(on) {
  if (!NET.guest || NET.run) return;
  if (on && deckProblems().length) { coopError('Fix your deck first (Edit loadout).'); return; }
  coopError('');
  NET.ready = on;
  toHost({ t: 'ready', on });
  renderLobby();
}

// Your look: a colour, or an emoji over it (whichever you picked last). Saved on this computer. The host makes sure
// no two players have the same colour.
const LOOK_KEY = 'rogue.coopLook';
function myLook() {
  try { const l = JSON.parse(localStorage.getItem(LOOK_KEY) || '{}'); return { color: l.color || '', emoji: l.emoji || '' }; } catch (err) { return { color: '', emoji: '' }; }
}
function setLook(p, color, emoji) {
  const taken = new Set(NET.lobby.filter(o => o !== p).map(o => o.color));
  if (COOP.colors.includes(color) && !taken.has(color)) p.color = color;
  else if (!p.color || taken.has(p.color)) p.color = COOP.colors.find(c => !taken.has(c)) || COOP.colors[0];
  p.emoji = COOP.emojis.includes(emoji) ? emoji : '';
}
function pickLook(color, emoji) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify({ color, emoji })); } catch (err) { /* not saved */ }
  if (NET.host) { setLook(NET.lobby.find(p => p.local), color, emoji); lobbyChanged(); }
  else if (NET.guest) toHost({ t: 'look', color, emoji });
}
const lobbyMe = () => (NET.list || []).find(p => p.id === (NET.host ? 1 : NET.myId)) || null;

// Edit loadout: the Loadout screen, and back here (menus.js calls backFromLoadout). Changing your deck un-readies you.
function editLoadout() {
  if (NET.guest && NET.ready) setReady(false);
  renderLoadout();
  $('btn-loadout-test').hidden = true;                  // no practice runs from the room
  showScreen('scr-loadout');
}
function backFromLoadout() {
  $('btn-loadout-test').hidden = false;
  if (NET.host) lobbyChanged();
  else if (NET.guest) { NET.myCards = equippedCards(); toHost({ t: 'cards', cards: NET.myCards }); }
  openCoop();
}

/* ---------- starting a run ---------- */
function coopStart() {
  if (!NET.host || NET.run || deckProblems().length) return;
  NET.countEnd = 0;
  resetRun();
  NET.world = { w: Math.round(Math.max(VW, 640) * COOP.world), h: Math.round(Math.max(VH, 480) * COOP.world) };
  NET.run = true;
  resize();
  const mine = NET.lobby.find(p => p.local);
  const host = newCtx(1, NET.name, mine.color, true, equippedCards(), seed);
  Object.assign(host, { body: game.player, deck, stats, picks, emoji: mine.emoji || '' });   // the host's own run, as resetRun made it
  for (const k of PKEYS) host[k] = game[k];
  NET.players = [host, ...NET.lobby.filter(p => !p.local).map(g => Object.assign(newCtx(g.id, g.name, g.color, false, g.cards, g.seed),
    { conn: g.conn, lobby: g, ping: g.ping, emoji: g.emoji || '' }))];
  NET.me = host; ACTIVE = host;
  NET.players.forEach((c, i) => { const a = (i / NET.players.length) * TAU; c.body.x = W / 2 + Math.cos(a) * 60; c.body.y = H / 2 + Math.sin(a) * 60; });
  const roster = NET.players.map(c => ({ id: c.id, name: c.name, color: c.color, emoji: c.emoji }));
  for (const c of NET.players) if (c.conn) netSend(c.conn, { t: 'start', world: NET.world, you: c.id, roster, x: c.body.x, y: c.body.y });
  coopEnter();
}
function guestStart(m) {
  resetRun();
  NET.world = m.world;
  NET.run = true;
  resize();
  deck = createDeck(NET.myCards, mulberry32(NET.mySeed), SEQUENCE_SIZE, deckLuck);    // the same deck the host is playing for us
  NET.roster = m.roster;
  const r = m.roster.find(x => x.id === m.you) || {};
  NET.me = { id: m.you, name: NET.name, local: true, body: game.player, down: false, rev: 0, color: r.color, emoji: r.emoji || '' };
  NET.players = [NET.me];
  Object.assign(game.player, { x: m.x, y: m.y });
  Object.assign(NET, { view: [], pings: null, hist: new Map(), off: null, jit: 0, delay: 100, lastQ: 0, seqIn: 0, mashN: 0, deflN: 0, snapAt: performance.now() });
  coopEnter();
}
function coopEnter() {
  closeRevive(); closePick();
  $('defeat').hidden = true;
  menuEl.hidden = true;
  menuAnimations().forEach(a => a.cancel());
  game.inMenu = false;
  renderTray(true); renderHp(false); renderXp(false); renderStats(); renderRelics();
  coopHud(true);
  SFX.start();
  last = performance.now();
  document.activeElement?.blur();
}
// After a run, the host can take everyone back to the room (v0.46): change decks, looks, then Ready again.
function coopToRoom() {
  if (!NET.run) return;
  if (NET.host) { for (const c of NET.players) if (c.conn) netSend(c.conn, { t: 'room' }); usePlayer(NET.players[0]); }
  NET.run = false; NET.players = []; ACTIVE = null; NET.world = null; NET.ready = false; NET.countEnd = 0; NET.holdE = false;
  for (const p of NET.lobby) if (!p.local) p.ready = false;
  if (NET.host) NET.me = NET.lobby.find(p => p.local);
  closeRevive(); closePick(); coopHud(false);
  stats = SOLO.stats; picks = SOLO.picks; game.player = SOLO.body;
  resetRun(); resize(); setPaused(false);
  game.inMenu = true; menuEl.hidden = false;
  if (NET.host) lobbyChanged();
  openCoop();
}

/* ---------- the host's frame ---------- */
// Movement for every player (combat.js calls this instead of the single player's).
function coopPlayersStep(dt) {
  reviveStep(dt);
  const now = performance.now();
  for (const c of NET.players) {
    if (c.down) continue;
    usePlayer(c);
    const p = c.body;
    if (c.local) {
      const [mx, my] = c.reviving ? [0, 0] : localInput();
      playerStep(dt, mx, my);
    } else {
      if (c.net.dash) { c.net.dash = false; tryDash([c.net.mx, c.net.my]); }
      for (; c.net.mashQ > 0; c.net.mashQ--) obiMash();
      for (; c.net.dflQ > 0; c.net.dflQ--) tryDeflect();
      const px = p.x, py = p.y, mx = c.reviving ? 0 : c.net.mx, my = c.reviving ? 0 : c.net.my;
      playerStep(dt, mx, my);
      // the guest's own position wins, unless the host is moving them (a charge or a shove); carried on along their
      // movement by half their ping plus the time since it came, so it's where they are on their own screen by now
      const forced = game.dash || Math.hypot(p.kx || 0, p.ky || 0) > 5 || pulledNow();   // (OBI ONE's pull drags them)
      if (!forced && Number.isFinite(c.net.x)) {
        const ml = Math.hypot(mx, my), lead = ml ? Math.min(COOP.lead, (c.ping || 0) / 2000 + (now - c.net.at) / 1000) * moveSpeed() / ml : 0;
        p.x = c.net.x + mx * lead; p.y = c.net.y + my * lead; clampTo(p, PLAYER.r);
      }
      p.px = px; p.py = py;
      c.forced = forced;
    }
  }
  // where the host draws each friend: eased toward where they are, since their reports come in steps
  for (const c of NET.players) {
    const p = c.body;
    if (c.local || c.dx == null || Math.hypot(p.x - c.dx, p.y - c.dy) > 120) { c.dx = p.x; c.dy = p.y; continue; }
    const f = Math.min(1, dt * 18);
    c.dx += (p.x - c.dx) * f; c.dy += (p.y - c.dy) * f;
  }
}
// Every player's cards (combat.js).
function coopAttacks(dt) {
  for (const c of NET.players) {
    if (c.down) continue;
    usePlayer(c);
    attackStep(dt);
    updateFrost(dt);
  }
}

// Everyone gets their own picks when the team levels up (combat.js gainXp calls this in co-op).
function coopLevelUps(from, to) {
  // (v0.52: the bosses come by the run's clock now, flow.js)
  eachPlayer(c => {
    for (let l = from + 1; l <= to; l++) {
      c.pickQ.push(l);
      if (l % AUG_EVERY === 0) {                            // a random slot fires twice
        const free = [...Array(SEQUENCE_SIZE).keys()].filter(i => !game.aug.has(i));
        if (free.length) { const i = free[Math.floor(Math.random() * free.length)]; game.aug.add(i); celebrate(`SLOT ${i + 1} ×2`, COL['r-legendary']); if (c.local) renderTray(false); }
      }
    }
    nextPick(c);
  });
}
function nextPick(c) {
  if (c.pick || !c.pickQ.length) return;
  const was = ACTIVE; usePlayer(c);
  const choices = rollChoices().filter(x => x.id !== 'weapon');
  usePlayer(was);
  const level = c.pickQ.shift();
  if (!choices.length) { nextPick(c); return; }
  c.pick = { level, choices, until: performance.now() + COOP.pickTime * 1000 };
  if (c.local) showPick(c.pick);
  else c.outbox.push({ e: 'picks', level, choices, secs: COOP.pickTime, more: c.pickQ.length });
}
function coopPick(c, i) {
  if (!c || !c.pick) return;
  const ch = c.pick.choices[i] || c.pick.choices[0];
  const was = ACTIVE; usePlayer(c);
  const v = upAmount(ch.id, ch.rarity), rank = UP_RARITIES.indexOf(ch.rarity);
  stats[ch.id] += v;
  if (STATS[ch.id].cap != null) stats[ch.id] = Math.min(STATS[ch.id].cap, stats[ch.id]);
  picks[ch.id].n++;
  picks[ch.id].best = Math.max(picks[ch.id].best, rank);
  if (ch.id === 'hp') { game.player.hp = Math.min(maxHp(), game.player.hp + v); if (c.local) renderHp(false); }
  celebrate(`${STATS[ch.id].short} ↑`, COL[`r-${ch.rarity}`]);
  if (c.local) { SFX.upgrade(rank); renderStats(ch.id); closePick(); }
  else c.outbox.push({ e: 'picked', id: ch.id, rank });
  usePlayer(was);
  c.pick = null;
  nextPick(c);
}
function pickTimeouts() {
  const now = performance.now();
  for (const c of NET.players) if (c.pick && now > c.pick.until) coopPick(c, Math.floor(Math.random() * c.pick.choices.length));
}

// HP ran out (combat.js hurtPlayer): down, not out, while anyone's still standing.
function coopDown(c) {
  if (!c || c.down) return;
  c.down = true; c.rev = 0; c.reviving = false;
  game.dash = null; game.frost = null;
  const p = c.body;
  p.hp = 0; p.kx = p.ky = 0;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 70, life: 0.6, color: COL.bad });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 16, text: `${c.name} IS DOWN`, color: COL.bad, life: 1.6, vy: -20, big: true });
  coopEvent({ e: 'down', id: c.id });
  if (c.local) renderHp(true);
  if (!living().length) coopOver();
}
// Reviving (v0.46, user: hold E): everyone standing next to a downed friend and holding E fills their ring (faster
// with more of you); let go and it drains. When it's full they're back at full health, and they and everyone who
// helped get the mini shield.
function reviveStep(dt) {
  const R = COOP.revive;
  for (const c of NET.players) c.reviving = false;
  for (const t of NET.players) {
    if (!t.down) continue;
    const helpers = NET.players.filter(c => !c.down && (c.local ? NET.holdE : c.net.rv)
      && Math.hypot(c.body.x - t.body.x, c.body.y - t.body.y) < COOP.reviveReach);
    if (!helpers.length) { t.rev = Math.max(0, t.rev - dt * R.drain / R.hold); continue; }
    for (const c of helpers) c.reviving = true;
    t.rev = Math.min(1, t.rev + dt * (1 + R.help * (helpers.length - 1)) / R.hold);
    if (t.rev >= 1) coopRevive(t, helpers);
  }
}
function coopRevive(target, helpers) {
  if (!NET.host || !target || !target.down) return;
  target.down = false; target.rev = 0;
  const was = ACTIVE;
  for (const c of [target, ...helpers]) { usePlayer(c); game.shield = Math.max(game.shield, COOP.revive.shield); }
  usePlayer(target);
  target.body.hp = maxHp(); target.body.safe = 2;
  if (target.local) renderHp(false);
  usePlayer(was);
  const p = target.body;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 90, life: 0.6, color: COL.hp });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 16, text: `${target.name} IS BACK!`, color: COL.hp, life: 1.6, vy: -20, big: true });
  if (target.local || helpers.some(c => c.local)) SFX_RAW.levelUp();
  coopEvent({ e: 'revived', id: target.id, by: helpers.map(c => c.id) });
}
function coopOver() {
  if (game.over) return;
  coopEvent({ e: 'over' });
  flushSnaps(true);
  defeat();
}
// An event for every guest (they get it right after their next picture, on the main channel, so none go missing).
function coopEvent(ev) { if (NET.host) for (const c of NET.players) if (!c.local) c.outbox.push(ev); }

/* ---------- pictures of the arena (host → guests) ---------- */
const WORLD_KEYS = ['enemies', 'projectiles', 'orbs', 'potions', 'diamonds', 'mines', 'rocks', 'cracks', 'rings', 'floaters', 'beams', 'sweeps',
  'fields', 'summons', 'bombs', 'bites', 'muzzles', 'ghosts', 'swooshes', 'sabers', 'bolts', 'debris', 'boulders', 'eshots', 'mrocks'];
const IDS = new Set(['enemies', 'projectiles', 'orbs', 'summons', 'sabers', 'bolts', 'boulders', 'eshots']);
const SNAP_DROP = new Set(['target', 'hits', 'trail', 'audio', 'conn', 'outbox', 'fn', 'queue', 'lobby', 'hitIds', 'bones']);
const WHOLE = new Set(['x', 'y', 'vx', 'vy', 'kx', 'ky', 'hp', 'maxHp', 'mh', 'x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'sx', 'sy', 'dmg']);
function snapReplacer(k, v) {
  if (SNAP_DROP.has(k)) return undefined;
  if (typeof v === 'number') return WHOLE.has(k) ? Math.round(v) : Math.round(v * 100) / 100;   // positions and HP: whole numbers
  if (v instanceof Set || v instanceof Map || typeof v === 'function') return undefined;
  return v;
}
function playerView(c) {
  const g = k => (c === ACTIVE ? game[k] : c[k]);
  const d = g('dash'), f = g('frost');
  return { id: c.id, name: c.name, color: c.color, emoji: c.emoji || '', x: c.body.x, y: c.body.y, hp: c.body.hp, mh: PLAYER.hp + c.stats.hp, down: c.down,
    dash: d ? { dx: d.dx, dy: d.dy, sx: d.sx, sy: d.sy } : null, frost: f ? { t: f.t, card: f.card } : null, safe: c.body.safe, flash: c.body.flash,
    shield: g('shield'), defl: g('defl'), ping: c.local ? 0 : c.ping, forced: !!c.forced, rev: c.rev || 0, rv: !!c.reviving,
    lag: !c.local && performance.now() - (c.net.at || 0) > 600 };
}
function flushSnaps(force = false) {
  const now = performance.now();
  if (!force && now - NET.lastSnap < COOP.snapMs - 8) return;   // a little slack, so a beat that comes a moment early isn't skipped
  NET.lastSnap = now;
  for (const k of IDS) for (const o of game[k]) if (!o._id) o._id = ++NET.nid;
  NET.seqOut = (NET.seqOut || 0) + 1;
  const world = { t: 's', q: NET.seqOut, ht: Math.round(now), lv: game.level, xp: game.xp, kills: game.kills, shake: game.shake, over: game.over,
    adapted: game.makoraAdapted ? [...game.makoraAdapted] : [],
    cine: game.cine ? { kind: game.cine.kind, t: game.cine.t, step: game.cine.step } : null,
    intro: game.intro ? { kind: game.intro.kind || '', t: game.intro.t, stomp: game.intro.stomp } : null,
    flow: game.flow, rt: game.runT,
    pl: NET.players.map(playerView) };
  for (const k of WORLD_KEYS) world[k] = game[k];
  // the heavy ones, trimmed: orbs only what's drawn, fewer particles, and the ground cracks (which don't move) only
  // when they change
  world.orbs = game.orbs.flatMap(o => [Math.round(o.x), Math.round(o.y), o.r, o._id]);   // x, y, r, id: all a guest draws
  world.particles = game.particles.slice(-70).map(q => ({ x: q.x, y: q.y, vx: q.vx, vy: q.vy, life: q.life, color: q.color }));
  NET.snapN = (NET.snapN || 0) + 1;
  const crackKey = game.cracks.length + ':' + (game.cracks[game.cracks.length - 1]?.x || 0);
  if (crackKey === NET.crackKey && NET.snapN % 20) delete world.cracks;
  NET.crackKey = crackKey;
  const base = JSON.stringify(world, snapReplacer);          // the same for everyone …
  NET.sentBytes = base.length;
  for (const c of NET.players) {
    if (c.local || !c.conn) continue;
    const g = k => (c === ACTIVE ? game[k] : c[k]);
    const me = { cd: g('cooldown'), cdt: g('cdTotal'), aug: [...g('aug')], st: c.stats, pk: c.picks, relics: g('relics'), dashCd: g('dashCd'),
      defl: g('defl'), dfc: g('deflCd'), dfa: g('deflAge') };
    // … plus their own part. A friend whose connection is still busy with earlier pictures skips this one, so they
    // don't fall further and further behind.
    const ch = fastOf(c);
    if (backlog(ch) > COOP.backlog) c.skipped = (c.skipped || 0) + 1;
    else netSend(ch, base.slice(0, -1) + ',"me":' + JSON.stringify(me, snapReplacer) + '}');
    // their cards fired and their events (picks, gold, sounds …) never get skipped
    if (c.fired || c.outbox.length) { netSend(c.conn, { t: 'ev', fired: c.fired, ev: c.outbox.splice(0) }); c.fired = 0; }
  }
  NET.sfxN = 0; NET.sfxSeen = {};
  if (now - NET.lastPing > COOP.pingMs) { NET.lastPing = now; for (const c of NET.players) if (c.conn) netSend(c.conn, { t: 'ping', ts: now }); }
}

/* ---------- the guest's frame ---------- */
// Smoothing (v0.46): every moving thing keeps its last few positions with the host's time. We draw them `NET.delay`
// ms in the past, between two of them; `NET.off` turns the host's clock into ours (the fastest a picture has ever
// come), and the delay grows while pictures come unevenly and shrinks back when they settle.
function clockSample(now, ht) {
  if (!Number.isFinite(ht)) return;
  const off = now - ht;
  if (NET.off == null || off < NET.off) NET.off = off; else NET.off += (off - NET.off) * 0.002;   // follows slow drift
  const late = off - NET.off;                                // how much later than the fastest picture this one came
  NET.jit = Math.max(late, (NET.jit || 0) * 0.97);
  NET.delay = Math.max(COOP.interp.min, Math.min(COOP.interp.max, COOP.snapMs + NET.jit * 1.1 + 15));
}
function track(key, t, x, y) {
  let h = NET.hist.get(key);
  if (!h) NET.hist.set(key, h = { t: [], x: [], y: [] });
  if (h.t.length && t <= h.t[h.t.length - 1]) return;
  h.t.push(t); h.x.push(x); h.y.push(y);
  if (h.t.length > 5) { h.t.shift(); h.x.shift(); h.y.shift(); }
}
// Where something was at host time `rt`: between the two positions around it, or a little past the newest.
function sampleAt(h, rt, o) {
  const n = h.t.length;
  if (n === 1 || rt <= h.t[0]) { o.x = h.x[0]; o.y = h.y[0]; return; }
  let i = n - 1;
  while (i > 1 && rt < h.t[i - 1]) i--;
  const a = i - 1, span = h.t[i] - h.t[a] || 1, f = Math.min((rt - h.t[a]) / span, 1 + COOP.interp.ext / span);
  o.x = h.x[a] + (h.x[i] - h.x[a]) * f; o.y = h.y[a] + (h.y[i] - h.y[a]) * f;
}
const trails = new Map();
function applySnap(s) {
  if (!NET.run) return;
  const now = performance.now();
  clockSample(now, s.ht);
  if (s.orbs && typeof s.orbs[0] === 'number') {             // unpacked: x, y, r, id
    const o = s.orbs, out = [];
    for (let i = 0; i + 3 < o.length; i += 4) out.push({ x: o[i], y: o[i + 1], r: o[i + 2], _id: o[i + 3], t: o[i + 3] * 0.7, born: 1 });
    s.orbs = out;
  }
  const seen = new Set();
  for (const k of WORLD_KEYS) {
    if (k === 'cracks' && !s.cracks) continue;               // unchanged: keep ours (they fade out on their own)
    const list = s[k] || [];
    if (IDS.has(k)) for (const o of list) {
      track(o._id, s.ht, o.x, o.y); seen.add(o._id);
      if (k === 'projectiles') o.trail = trails.get(o._id) || [];
    }
    game[k] = list;
  }
  trails.clear();
  for (const pr of game.projectiles) trails.set(pr._id, pr.trail);
  NET.snapAt = now;
  game.particles = s.particles || [];
  game.shake = Math.max(game.shake, s.shake || 0);
  const up = s.lv > game.level;
  if (up) SFX_RAW.levelUp();
  if (s.lv !== game.level || s.xp !== game.xp) { game.level = s.lv; game.xp = s.xp; renderXp(up); }
  if (s.kills !== game.kills) { game.kills = s.kills; $('kills').textContent = game.kills; }
  if (s.flow) { game.flow = s.flow; game.runT = s.rt || 0; renderFlow(); }   // the run's bar (flow.js)
  aliveEl.textContent = game.enemies.length;
  game.boss = game.enemies.find(e => e.boss) || null;
  game.makora = game.enemies.find(e => e.makora) || (s.cine && game.makora) || null;
  game.obi = game.enemies.find(e => e.obi) || null;
  game.makoraAdapted = new Set(s.adapted || []);
  if (game.makora) renderMakoraBar(); else if (game.obi) renderObiBar(); else if (game.boss) renderBossBar(); else { bossBar.hidden = true; bossBar.classList.remove('is-makora', 'is-obi'); }
  if (game.obi?.pull && game.obi.pull.id === NET.me.id) game.shake = Math.max(game.shake, OBI.phase2.pull.shake);   // OBI ONE's pull shakes your screen
  // the others, smoothed too
  NET.view = (s.pl || []).filter(v => v.id !== NET.me.id).map(v => { track('p' + v.id, s.ht, v.x, v.y); seen.add('p' + v.id); return v; });
  for (const k of NET.hist.keys()) if (!seen.has(k)) NET.hist.delete(k);
  NET.pings = (s.pl || []).map(v => ({ id: v.id, name: v.name, color: v.color, emoji: v.emoji, ping: v.ping, down: v.down, host: v.id === 1, hp: v.hp, mh: v.mh, lag: v.lag }));
  // me
  const mine = (s.pl || []).find(v => v.id === NET.me.id), p = game.player;
  if (mine) {
    const hit = mine.hp < p.hp - 0.5;
    if (hit) SFX_RAW.hurt();
    if (mine.forced || mine.down || Math.hypot(mine.x - p.x, mine.y - p.y) > 160) { p.x = mine.x; p.y = mine.y; }
    NET.me.forced = mine.forced;
    NET.me.rev = mine.rev || 0;
    if (mine.down !== NET.me.down) { NET.me.down = mine.down; if (mine.down) closeRevive(); }
    Object.assign(p, { hp: mine.hp, safe: mine.safe, flash: mine.flash });
    game.dash = mine.dash; game.frost = mine.frost; game.shield = mine.shield;
    if (hit || Math.round(mine.hp) !== NET.lastHp) { NET.lastHp = Math.round(mine.hp); renderHp(hit); }
  }
  const me = s.me;
  if (me) {
    game.cooldown = me.cd; game.cdTotal = me.cdt;
    const aug = new Set(me.aug || []);
    const augChanged = aug.size !== game.aug.size;
    game.aug = aug;
    Object.assign(stats, me.st || {});
    for (const id in me.pk || {}) picks[id] = me.pk[id];
    const statKey = JSON.stringify(me.pk);
    if (statKey !== NET.statKey) { NET.statKey = statKey; renderStats(); renderHp(false); }
    const had = game.relics.join(), wasOn = game.defl > 0;
    game.relics = me.relics || []; game.dashCd = me.dashCd || 0;
    game.defl = me.defl || 0; game.deflCd = me.dfc || 0; game.deflAge = me.dfa ?? 9;
    const cooling = game.dashCd > 0 || game.deflCd > 0;
    if (had !== game.relics.join() || cooling || NET.wasCd || wasOn !== game.defl > 0) renderRelics();
    NET.wasCd = cooling;
    if (augChanged) renderTray(false);
  }
  guestScenes(s);
}
// Our cards the host fired (our deck plays along with the host's copy of it) and the events, on the main channel.
function guestEvents(m) {
  if (!NET.run) return;
  for (let k = 0; k < (m.fired || 0); k++) onAttack(deck.draw());
  for (const ev of m.ev || []) guestEvent(ev);
}
function guestEvent(ev) {
  if (ev.e === 'sfx') { const f = SFX_RAW[ev.n]; if (f) try { f(...(ev.a || [])); } catch (err) { /* a sound */ } }
  else if (ev.e === 'gold') { save.gold += ev.n; writeSave(); game.goldBonus = (game.goldBonus || 0) + ev.n; toast(`+${ev.n} GOLD · ${ev.why}`, ''); SFX_RAW.coin(); }
  else if (ev.e === 'toast') toastRaw(ev.text, ev.cls);
  else if (ev.e === 'picks') showPick({ level: ev.level, choices: ev.choices, until: performance.now() + ev.secs * 1000, more: ev.more });
  else if (ev.e === 'picked') { SFX_RAW.upgrade(ev.rank); closePick(); renderStats(ev.id); }
  else if (ev.e === 'over') { if (!game.over) defeat(); }
  else if (ev.e === 'down' && ev.id === NET.me.id) { NET.me.down = true; closeRevive(); }
  else if (ev.e === 'revived' && (ev.id === NET.me.id || (ev.by || []).includes(NET.me.id))) SFX_RAW.levelUp();
  else if (ev.e === 'skip') skipIntro(true);
  else if (ev.e === 'obiName') showObiName();
}
// SKURTOSAURUS's intro and MAKORA's scenes: the guest plays its own copy (the words, the wheel, the sounds), started
// and ended by the host's.
function guestScenes(s) {
  if (s.intro && !game.intro && !NET.introSeen) { NET.introSeen = true; startIntroScene(s.intro.kind); game.intro = { kind: s.intro.kind || '', t: s.intro.t, stomp: s.intro.stomp }; }
  if (!s.intro) NET.introSeen = false;
  if (s.cine && !game.cine) {
    if (s.cine.kind === 'summon') startMakora();
    else showAdaptScene(game.makora || { turns: 1 });
    game.cine.t = s.cine.t; game.cine.step = 0;
  } else if (!s.cine && game.cine) endCine();
}
function guestFrame(dt) {
  zoomStep(dt);
  const p = game.player;
  p.px = p.x; p.py = p.y;
  const rooted = NET.holdE && !!reviveNear();              // holding E by a friend who's down: you stand still
  if (!NET.me.down && !NET.me.forced && !game.dash && !rooted) {
    const [mx, my] = localInput(), ml = Math.hypot(mx, my);
    if (ml) { p.x += (mx / ml) * moveSpeed() * dt; p.y += (my / ml) * moveSpeed() * dt; hintEl.classList.add('gone'); }
    clampTo(p, PLAYER.r);
  }
  const now = performance.now();
  if (now - NET.lastIn > COOP.inMs) {
    NET.lastIn = now;
    const [mx, my] = rooted || NET.me.down ? [0, 0] : localInput();
    NET.seqIn = (NET.seqIn || 0) + 1;
    toHostFast({ t: 'in', q: NET.seqIn, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, mx, my, rv: NET.holdE ? 1 : 0, dash: NET.wantDash ? 1 : 0, mash: NET.mashN || 0, dfl: NET.deflN || 0 });
    NET.wantDash = false;
  }
  // everything else, a little in the past (see clockSample)
  const rt = now - (NET.off || 0) - (NET.delay || 100);
  for (const key of IDS) for (const o of game[key]) { const h = o._id && NET.hist.get(o._id); if (h) sampleAt(h, rt, o); }
  for (const v of NET.view || []) { const h = NET.hist.get('p' + v.id); if (h) sampleAt(h, rt, v); }
  for (const pr of game.projectiles) { pr.trail.push(pr.x, pr.y); if (pr.trail.length > 16) pr.trail.splice(0, 2); pr.spin = (pr.spin || 0) + dt * 18; }
  for (const e of game.enemies) e.anim = (e.anim || 0) + dt;
  if (game.intro) updateIntro(dt);
  if (game.cine) updateCine(dt);
  updateEffects(dt);
  tickPick(); reviveHud();
}

/* ---------- input, camera ---------- */
// Your movement this frame: keys, or pointer (held down) in world units.
function localInput() {
  let mx = 0, my = 0;
  for (const k of keys) { mx += MOVE[k][0]; my += MOVE[k][1]; }
  if (!mx && !my && pointer) {
    const p = game.player, dx = pointer.x / viewZoom + cam.x - p.x, dy = pointer.y / viewZoom + cam.y - p.y;
    if (Math.hypot(dx, dy) > 6) { mx = dx; my = dy; }
  }
  return [mx, my];
}
// The view follows you round the bigger arena (draw.js).
// Single player too (v0.51): in a boss's square arena, which is bigger than the screen. There it eases after you, so
// the arena changing size (arena.js) doesn't make it jump; co-op follows you straight.
let camAt = 0;
function updateCam() {
  // (the part of the view above the HUD, in a world you can walk right to the bottom of; otherwise the whole view)
  const p = game.player, z = viewZoom, vw = VW / z, vh = (NET.run || arenaMode === 'boss' ? (NET.viewSafe || VH) : VH) / z;
  // in a boss's square arena it goes a little past the walls (`m`), so you can see where the arena ends (user)
  const m = arenaMode === 'boss' && !NET.run ? VIEW.edge : 0;
  const tx = W <= vw ? (W - vw) / 2 : Math.max(-m, Math.min(W - vw + m, p.x - vw / 2));
  const ty = H <= vh ? (H - vh) / 2 : Math.max(-m, Math.min(H - vh + m, p.y - vh / 2));
  const now = performance.now(), dt = Math.min(0.1, (now - camAt) / 1000);
  camAt = now;
  if (NET.run || camSnap || game.inMenu) { cam.x = tx; cam.y = ty; camSnap = false; return; }
  const f = Math.min(1, dt * VIEW.cam);
  cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
}

/* ---------- sounds and callouts go to the guests too ---------- */
const SFX_RAW = { ...SFX };
const toastRaw = toast;
const QUIET = new Set(['click', 'confirm', 'back', 'whoosh', 'start', 'rip', 'coin', 'upgrade', 'hurt', 'dodge', 'defeat', 'shuffle', 'deal', 'pickup', 'levelUp', 'pullPress', 'deflectOn']);
for (const k of Object.keys(SFX)) {
  if (typeof SFX[k] !== 'function') continue;
  SFX[k] = (...a) => {
    if (NET.host && NET.run && !game.intro && !game.cine && !QUIET.has(k) && NET.sfxN < 10 && (NET.sfxSeen[k] || 0) < 2) {
      NET.sfxN++; NET.sfxSeen[k] = (NET.sfxSeen[k] || 0) + 1;
      coopEvent({ e: 'sfx', n: k, a });
    }
    return SFX_RAW[k](...a);
  };
}
NET.sfxN = 0; NET.sfxSeen = {};                        // at most 10 sounds (2 of each) per picture
toast = (text, cls) => { if (NET.host && NET.run) coopEvent({ e: 'toast', text, cls }); return toastRaw(text, cls); };

/* ---------- drawing everyone ---------- */
// Everyone else (draw.js, after your own player): a circle in their colour (or just their emoji, which goes on the
// text layer, below), a BULL wedge while charging, their HP bar, their shield, and DOWN with a
// cross and a revive ring that fills as someone holds E.
function coopBodies() {
  if (!NET.run) return [];
  if (NET.host) return NET.players.filter(c => c !== NET.me).map(c => ({ ...playerView(c), x: c.dx ?? c.body.x, y: c.dy ?? c.body.y }));
  return NET.view || [];
}
const hpColor = f => (f > 0.5 ? COL.hp : f > 0.25 ? COL['r-legendary'] : COL.bad);
function hpBar(x, y, hp, mh) {
  const w = 30, h = 4, f = Math.max(0, Math.min(1, hp / (mh || 1))), bx = x - w / 2, by = y + PLAYER.r + 6;
  ctx.fillStyle = 'rgba(0, 0, 0, .7)'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = COL.line; ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = hpColor(f); ctx.fillRect(bx, by, w * f, h);
}
function bubble(x, y, shield) {                      // the mini shield, as on your own player (draw.js)
  const fade = Math.min(1, shield / 0.3), rr = PLAYER.r + SHIELD.r;
  ctx.globalAlpha = fade * 0.1; ctx.fillStyle = COL.xp; circle(x, y, rr);
  ctx.globalAlpha = fade * 0.6; ctx.strokeStyle = COL.xp; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
function downed(x, y, rev, near) {                   // a cross, the reach ring, and how far the revive has got
  ctx.strokeStyle = COL.bad; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
  const R = COOP.reviveReach * 0.6;
  ctx.globalAlpha = near || rev > 0 ? 0.9 : 0.35; ctx.strokeStyle = COL.hp; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (rev > 0) {
    ctx.strokeStyle = COL.hp; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + rev * TAU); ctx.stroke();
  }
}
function drawCoopPlayers() {
  if (!NET.run) return;
  const p = game.player;
  for (const v of coopBodies()) {
    if (v.frost) drawFrostAt(v.frost, v);
    ctx.globalAlpha = v.down ? 0.55 : v.safe > 0 && Math.floor(v.safe * 20) % 2 ? 0.45 : 1;
    ctx.fillStyle = v.down ? COL.line : v.color;
    if (v.emoji) { /* just the emoji (drawCoopFaces), for a cleaner look (v0.46, user) */ }
    else if (v.dash) ellipse(v.x, v.y, PLAYER.r * 1.25, PLAYER.r * 0.82, Math.atan2(v.dash.dy, v.dash.dx));
    else circle(v.x, v.y, PLAYER.r);
    ctx.globalAlpha = 1;
    if (v.down) { downed(v.x, v.y, v.rev, !NET.me.down && Math.hypot(v.x - p.x, v.y - p.y) < COOP.reviveReach); continue; }
    if (v.flash > 0) {
      ctx.globalAlpha = v.flash / 0.2; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(v.x, v.y, PLAYER.r + 5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (v.shield > 0) bubble(v.x, v.y, v.shield);
    if (v.defl > 0) drawDeflect(v.x, v.y, v.defl);
    hpBar(v.x, v.y, v.hp, v.mh);
  }
  if (NET.me.down) downed(p.x, p.y, NET.me.rev || 0, false);    // you: down
  else hpBar(p.x, p.y, p.hp, maxHp());
}
// Emojis (crisp, on the text layer, under the numbers) and names over everyone. draw.js has moved the layer with the camera.
const EMOJI_FONT = `${Math.round(PLAYER.r * 2.3)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
function drawCoopFaces() {
  if (!NET.run) return;
  const c = tctx, p = game.player;
  c.save(); c.font = EMOJI_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  const face = (x, y, emoji, down, safe) => {
    if (!emoji) return;
    c.globalAlpha = down ? 0.45 : safe > 0 && Math.floor(safe * 20) % 2 ? 0.5 : 1;
    c.fillText(emoji, x, y + 1);
  };
  face(p.x, p.y, NET.me.emoji, NET.me.down, p.safe);
  for (const v of coopBodies()) face(v.x, v.y, v.emoji, v.down, v.safe);
  c.restore();
}
function drawCoopNames() {
  if (!NET.run) return;
  const c = tctx;
  c.font = '700 12px "Chakra Petch", system-ui, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
  const label = (x, y, text, color) => { c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y); };
  const p = game.player, top = PLAYER.r + (NET.me.emoji ? 12 : 8);
  label(p.x, p.y - top, NET.me.down ? `${NET.name} · DOWN` : NET.name, COOP.colors[0] === (NET.me.color || COOP.colors[0]) ? '#fff' : NET.me.color);
  for (const v of coopBodies()) {
    label(v.x, v.y - PLAYER.r - (v.emoji ? 12 : 8), v.down ? `${v.name} · DOWN` : v.name, v.color);
    if (!v.down || NET.me.down || Math.hypot(v.x - p.x, v.y - p.y) >= COOP.reviveReach) continue;
    label(v.x, v.y + PLAYER.r + 22, v.rev > 0 ? `REVIVING ${Math.floor(v.rev * 100)}%` : 'HOLD E · REVIVE', COL.hp);
  }
}

/* ---------- the in-game player list, with HP and pings ---------- */
function coopHud(on) {
  const el = $('coop-list');
  el.hidden = !on;
  document.body.classList.toggle('in-coop', !!on);
  if (on) renderCoopList();
}
function pingClass(ms) { return ms == null ? '' : ms < 80 ? 'is-good' : ms < 150 ? 'is-ok' : 'is-bad'; }
const dot = r => `<i class="${r.emoji ? 'has-emoji' : ''}" style="--pc:${r.color}">${r.emoji || ''}</i>`;
function renderCoopList() {
  if (!NET.run) return;
  const rows = NET.host ? NET.players.map(c => ({ id: c.id, name: c.name, color: c.color, emoji: c.emoji, ping: c.local ? null : c.ping, down: c.down, host: c.id === 1,
    hp: c.body.hp, mh: PLAYER.hp + c.stats.hp, lag: !c.local && performance.now() - (c.net.at || 0) > 600 }))
    : (NET.pings || []);
  const stale = NET.guest && performance.now() - (NET.snapAt || 0) > 700;   // nothing from the host for a while
  $('coop-list').innerHTML = (stale ? '<li class="cl-warn">Waiting for the host…</li>' : '') + rows.map(r => {
    const f = Math.max(0, Math.min(1, (r.hp || 0) / (r.mh || 1)));
    const ping = r.down ? 'DOWN' : r.host ? 'host' : r.lag ? 'LAG' : r.ping == null ? '…' : `${r.ping} ms`;
    return `<li class="${r.down ? 'is-down' : ''}">${dot(r)}<span class="cl-mid"><span class="cl-name">${esc(r.name)}${r.id === (NET.me?.id) ? ' (you)' : ''}</span>`
      + `<span class="cl-hp"><span style="transform:scaleX(${f.toFixed(3)});background:${hpColor(f)}"></span></span></span>`
      + `<b class="cl-ping ${r.host ? '' : r.lag ? 'is-bad' : pingClass(r.ping)}">${ping}</b></li>`;
  }).join('');
}
setInterval(() => { if (NET.run) renderCoopList(); }, 250);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- level-up picks, without pausing ---------- */
let pickNow = null;
function showPick(pk) {
  pickNow = pk;
  const el = $('coop-pick');
  el.hidden = false;
  $('cp-level').textContent = `LEVEL ${pk.level}`;
  $('cp-cards').innerHTML = pk.choices.map((ch, i) => {
    const s = STATS[ch.id], v = upAmount(ch.id, ch.rarity);
    return `<li><button type="button" data-i="${i}" style="--rc: var(--r-${ch.rarity})"><span class="cp-key">${i + 1}</span>`
      + `<span class="cp-name">${s.name}</span><span class="cp-gain">${s.gain(v)}</span><span class="cp-rar">${RARITY_NAME[ch.rarity]}</span></button></li>`;
  }).join('');
  tickPick();
}
function tickPick() {
  if (!pickNow) return;
  const left = Math.max(0, (pickNow.until - performance.now()) / 1000);
  $('cp-time').textContent = `${Math.ceil(left)}s`;
  $('cp-bar').style.transform = `scaleX(${left / COOP.pickTime})`;
}
function closePick() { pickNow = null; $('coop-pick').hidden = true; }
function choosePick(i) {
  if (!pickNow || i < 0 || i >= pickNow.choices.length) return;
  if (NET.host) coopPick(NET.me, i);
  else { toHost({ t: 'pick', i }); closePick(); }
}
$('cp-cards').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { choosePick(+b.dataset.i); b.blur(); } });

/* ---------- reviving: hold E (or the button, on a touch screen) ---------- */
// The friend who's down within reach of you, if any.
function reviveNear() {
  if (!NET.run || NET.me?.down || game.over) return null;
  const p = game.player;
  return coopBodies().find(v => v.down && Math.hypot(v.x - p.x, v.y - p.y) < COOP.reviveReach) || null;
}
const coarse = matchMedia('(pointer: coarse)');
let rvTouch = false;
function reviveHud() {                               // the touch button, only on a touch screen and only by someone down
  const t = coarse.matches ? reviveNear() : null, btn = $('rv-btn');
  if (!t) { if (!btn.hidden) btn.hidden = true; if (rvTouch) { rvTouch = false; NET.holdE = false; } return; }
  btn.hidden = false;
  $('rv-btn-name').textContent = t.name;
  btn.style.setProperty('--p', (t.rev || 0).toFixed(3));
}
function closeRevive() { NET.holdE = false; rvTouch = false; $('rv-btn').hidden = true; }
const rvHold = on => e => { rvTouch = on; NET.holdE = on; e.preventDefault(); };
$('rv-btn').addEventListener('pointerdown', rvHold(true));
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('rv-btn').addEventListener(ev, rvHold(false));

/* ---------- the CO-OP screen (a login: name, then Host or Join; then the room) ---------- */
const NAME_KEY = 'rogue.coopName';
function openCoop() {
  if (!NET.on) {
    try { $('co-name').value = localStorage.getItem(NAME_KEY) || ''; } catch (err) { /* no storage */ }
  }
  coopError('');
  NET.lookKey = '';
  renderLobby();
  showScreen('scr-coop');
}
function coopName() {
  const n = $('co-name').value.trim().replace(/\s+/g, ' ').slice(0, 14);
  if (!n) { coopError('Type a name first.'); $('co-name').focus(); return null; }
  try { localStorage.setItem(NAME_KEY, n); } catch (err) { /* not saved */ }
  return n;
}
function coopError(text) { const el = $('co-error'); el.textContent = text || ''; el.hidden = !text; }
let coopBusy = false;
async function clickHost() {
  if (coopBusy) return;
  const n = coopName(); if (!n) return;
  coopBusy = true; coopError(''); $('co-status').textContent = 'Opening a room…';
  try { await coopHost(n); } catch (err) { coopReset(); coopError(err.message); }
  coopBusy = false; renderLobby();
}
async function clickJoin() {
  if (coopBusy) return;
  const n = coopName(); if (!n) return;
  const key = cleanKey($('co-key').value);
  if (key.length !== 7) { coopError('Type the room key your friend gave you (like PS-7KQX).'); $('co-key').focus(); return; }
  coopBusy = true; coopError(''); $('co-status').textContent = `Joining ${key}…`;
  try { await coopJoin(n, key); } catch (err) { coopReset(); coopError(err.message); }
  coopBusy = false; renderLobby();
}
function renderLobby() {
  const inRoom = NET.on && (NET.host || NET.myId);
  $('co-login').hidden = !!inRoom;
  $('co-room').hidden = !inRoom;
  $('co-status').textContent = coopBusy ? $('co-status').textContent : '';
  if (!inRoom) return;
  $('co-key-show').textContent = NET.key;
  $('co-role').textContent = NET.host ? 'You are hosting. Send your friends this key:' : 'You joined. Room key:';
  $('co-copy').hidden = !NET.host;
  const you = NET.host ? 1 : NET.myId;
  $('co-players').innerHTML = (NET.list || []).map(p => {
    const deck = (p.deck || []).map(([id, n]) => `<span style="--c: var(--${id})">${n}× ${CARDS[id]?.name || id}</span>`).join('');
    const state = p.id === 1 ? 'Host' : p.ready ? 'Ready' : 'Not ready';
    return `<li class="${p.ready ? 'is-ready' : ''}">${dot(p)}<span class="co-who"><span class="co-pname">${esc(p.name)}${p.id === you ? ' (you)' : ''}</span>`
      + `<span class="co-deck">${deck}</span></span><b class="co-rd">${state}</b>`
      + `<b class="cl-ping ${p.id === 1 ? '' : pingClass(p.ping)}">${p.id === 1 ? '' : p.ping == null ? '…' : `${p.ping} ms`}</b></li>`;
  }).join('');
  renderLook();
  $('co-start').hidden = !NET.host;
  $('co-ready').hidden = NET.host;
  $('co-ready').textContent = NET.ready ? 'Ready ✓' : 'Ready';
  $('co-ready').classList.toggle('is-on', !!NET.ready);
  renderLobbyText();
}
// The words that change with the countdown (every 0.2 s while it runs).
function renderLobbyText() {
  if (!NET.on || NET.run) return;
  const n = NET.lobby.length, secs = NET.countEnd ? Math.max(1, Math.ceil((NET.countEnd - performance.now()) / 1000)) : 0;
  const waiting = (NET.list || []).filter(p => !p.ready).length;
  if (NET.host) {
    const b = $('co-start');
    b.disabled = !secs && !allReady();
    b.textContent = secs ? `Starting in ${secs}… (stop)` : n < 2 ? 'Start (waiting for friends…)' : allReady() ? `Start (${n} players)` : 'Start';
  }
  $('co-wait').textContent = secs ? `Starting in ${secs}…`
    : NET.host ? (n < 2 ? 'Send the key to a friend.' : waiting ? `Waiting for ${waiting === 1 ? '1 player' : `${waiting} players`} to press Ready.` : 'Everyone is ready.')
      : NET.ready ? 'Ready. Waiting for the host to start…' : 'Press Ready when your deck is set.';
}
// Colour swatches and emojis (rebuilt only when your look or the colours taken change, so a click keeps its focus).
function renderLook() {
  const me = lobbyMe();
  if (!me) return;
  const taken = new Map((NET.list || []).filter(p => p.id !== me.id).map(p => [p.color, p.name]));
  const key = me.color + '|' + me.emoji + '|' + [...taken.keys()].join(',');
  if (key === NET.lookKey) return;
  NET.lookKey = key;
  const focused = document.activeElement?.dataset?.look;
  $('co-colors').innerHTML = COOP.colors.map(c => {
    const who = taken.get(c), on = c === me.color && !me.emoji;
    return `<button type="button" class="co-sw${c === me.color ? ' is-mine' : ''}" data-look="c${c}" style="--sw:${c}" aria-pressed="${on}"`
      + `${who ? ` disabled title="Taken by ${esc(who)}"` : ''} aria-label="Colour${who ? `, taken by ${esc(who)}` : ''}"></button>`;
  }).join('');
  $('co-emojis').innerHTML = COOP.emojis.map(e => `<button type="button" class="co-em" data-look="e${e}" aria-pressed="${e === me.emoji}">${e}</button>`).join('');
  if (focused) $('scr-coop').querySelector(`[data-look="${CSS.escape(focused)}"]`)?.focus();
}
$('co-look').addEventListener('click', e => {
  const b = e.target.closest('button[data-look]');
  if (!b || b.disabled) return;
  const me = lobbyMe(), v = b.dataset.look.slice(1);
  if (b.dataset.look[0] === 'c') pickLook(v, '');                     // a colour: back to a plain circle in it
  else pickLook(me?.color || '', me?.emoji === v ? '' : v);            // an emoji (again: off)
});
setInterval(() => { if (NET.host && !NET.run) { const now = performance.now(); for (const g of NET.conns.values()) netSend(g.conn, { t: 'ping', ts: now }); } }, COOP.pingMs);
$('btn-coop').addEventListener('click', openCoop);
$('co-host').addEventListener('click', clickHost);
$('co-join').addEventListener('click', clickJoin);
$('co-key').addEventListener('keydown', e => { if (e.key === 'Enter') clickJoin(); });
$('co-name').addEventListener('keydown', e => { if (e.key === 'Enter') ($('co-key').value ? clickJoin() : clickHost()); });
$('co-start').addEventListener('click', clickStart);
$('co-ready').addEventListener('click', () => setReady(!NET.ready));
$('co-edit').addEventListener('click', editLoadout);
$('co-leave').addEventListener('click', () => { coopLeave(); coopError(''); });
$('co-back').addEventListener('click', () => { if (NET.on && !NET.run) coopLeave(); goMain(); });
$('co-copy').addEventListener('click', () => {
  navigator.clipboard?.writeText(NET.key).then(() => { $('co-copy').textContent = 'Copied'; setTimeout(() => { $('co-copy').textContent = 'Copy'; }, 1200); }).catch(() => {});
});
$('btn-room').addEventListener('click', coopToRoom);

// The host keeps the fight going when its tab is hidden (the browser stops drawing it), so the others aren't frozen.
// v0.46: the beat comes from a Web Worker, since browsers slow a hidden tab's own timers to once a second (the whole
// game ran at a tenth of its speed for everyone while the host was on another tab). A plain timer if that fails.
function hiddenHostStep() {
  if (!NET.host || !NET.run || !document.hidden || game.over) return;
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try { update(dt); usePlayer(NET.me); pickTimeouts(); flushSnaps(); } catch (err) { console.error(err); }
}
try {
  const beat = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50);'], { type: 'text/javascript' })));
  beat.onmessage = hiddenHostStep;
} catch (err) { setInterval(hiddenHostStep, 50); }
