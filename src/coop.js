/* coop.js — Online co-op (v0.45, user): host a room, friends join with its key, and everyone fights the same run. */
'use strict';

/* How it works:
   - The CO-OP screen is a login: your name, then Host (you get a room key) or Join (type a friend's key). Someone has
     to host first; joining a key nobody is hosting says so. Up to 4 players.
   - The host's browser runs the real game. Each friend's browser sends its movement (and Space, picks, revives) and
     gets back a picture of the whole arena 20 times a second, which it draws smoothed out. Your own movement is
     instant on your screen; the host takes your position as you report it, except while it's moving you itself (a
     BULL charge, a shove).
   - Every player has their own deck, HP, stats, level-up picks and BULL. The team shares one level: every level up
     gives each player 3 cards to pick from on a 10 s timer (a random one if it runs out), and the fight doesn't stop.
     Every 10th level augments a random slot.
   - The arena is bigger (×1.6 each way) and scrolls with you, and there are many more enemies, with more HP.
   - A player whose HP runs out is DOWN. Stand next to them and press E: a typing test starts, and 5 words typed
     right before the timer ends brings them back at full health. If everyone is down, the run is over.
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

function netSend(conn, msg) { try { if (conn && conn.open !== false) conn.send(msg); } catch (err) { /* it's closing */ } }
const toHost = msg => netSend(NET.conn, msg);

// Host: open a room under a fresh key.
async function coopHost(name) {
  coopReset();
  Object.assign(NET, { on: true, host: true, name, key: newKey() });
  NET.me = { id: 1, name, color: COOP.colors[0], local: true, ping: 0 };
  NET.lobby = [NET.me];
  if (netLocal()) { NET.peer = localHost(NET.key, onGuestConn); return NET.key; }
  await loadPeer();
  for (let tries = 0; tries < 4; tries++) {
    try {
      NET.peer = await new Promise((ok, fail) => {
        const p = new Peer(COOP.prefix + NET.key);
        p.on('open', () => ok(p));
        p.on('error', err => fail(err));
      });
      NET.peer.on('connection', conn => conn.on('open', () => onGuestConn(conn)));
      NET.peer.on('error', err => console.warn('co-op:', err));
      return NET.key;
    } catch (err) {
      if (err.type === 'unavailable-id') { NET.key = newKey(); continue; }
      throw new Error(err.type === 'network' || err.type === 'server-error' ? 'Could not reach the connection service. Check your internet.' : 'Could not open a room. Try again.');
    }
  }
  throw new Error('Could not open a room. Try again.');
}
function onGuestConn(conn) {
  conn.on('data', m => onHostMsg(conn, m));
  conn.on('close', () => guestLeft(conn));
}
function onHostMsg(conn, m) {
  if (!m || typeof m !== 'object') return;
  let g = NET.conns.get(conn);
  if (m.t === 'hello') {
    if (NET.run) return netSend(conn, { t: 'no', why: 'That game has already started.' });
    if (NET.lobby.length >= COOP.max) return netSend(conn, { t: 'no', why: 'That game is full (4 players).' });
    const id = Math.max(...NET.lobby.map(p => p.id)) + 1;
    g = { id, name: String(m.name || 'Player').slice(0, 14), color: COOP.colors[NET.lobby.length % COOP.colors.length], local: false, ping: null, conn,
      cards: Array.isArray(m.cards) ? m.cards.filter(c => CARDS[c]).slice(0, DECK_LIMIT) : ['bullet'], seed: m.seed >>> 0 };
    NET.conns.set(conn, g);
    NET.lobby.push(g);
    netSend(conn, { t: 'welcome', id, key: NET.key });
    lobbyChanged();
    return;
  }
  if (!g) return;
  if (m.t === 'pong') { g.ping = Math.max(1, Math.round(performance.now() - m.ts)); const c = byId(g.id); if (c) c.ping = g.ping; if (!NET.run) lobbyChanged(); return; }
  const c = byId(g.id);
  if (!c) return;
  if (m.t === 'in') {
    Object.assign(c.net, { mx: +m.mx || 0, my: +m.my || 0, x: +m.x, y: +m.y });
    c.typing = !!m.ty;
    if (m.dash) c.net.dash = true;
  } else if (m.t === 'pick') coopPick(c, m.i | 0);
  else if (m.t === 'revive') coopRevive(byId(m.id), c);
  else if (m.t === 'skip') skipIntro(true);
}
function guestLeft(conn) {
  const g = NET.conns.get(conn);
  NET.conns.delete(conn);
  if (!g) return;
  NET.lobby = NET.lobby.filter(p => p !== g);
  const c = byId(g.id);
  if (c) {
    if (ACTIVE === c) usePlayer(NET.me);
    NET.players = NET.players.filter(p => p !== c);
    toast(`${g.name} LEFT`, '');
    if (NET.run && !living().length) coopOver();
  }
  lobbyChanged();
}
function lobbyChanged() {
  const list = NET.lobby.map(p => ({ id: p.id, name: p.name, color: p.color, ping: p.ping }));
  for (const g of NET.conns.values()) netSend(g.conn, { t: 'lobby', list });
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
      const c = NET.peer.connect(COOP.prefix + key, { reliable: true, serialization: 'json' });
      const t = setTimeout(() => fail(new Error('No game with that key. Ask your friend to host first.')), 9000);
      NET.peer.on('error', err => { clearTimeout(t); fail(new Error(err.type === 'peer-unavailable' ? 'No game with that key. Ask your friend to host first.' : 'Could not connect. Try again.')); });
      c.on('open', () => { clearTimeout(t); ok(c); });
    });
  }
  NET.conn = conn;
  conn.on('data', onGuestMsg);
  conn.on('close', () => { if (NET.guest) { coopLeave(); toast('THE HOST LEFT', 'enrage'); } });
  toHost({ t: 'hello', name, cards: NET.myCards, seed: NET.mySeed });
}
function onGuestMsg(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'welcome') { NET.myId = m.id; renderLobby(); }
  else if (m.t === 'no') { coopLeave(); coopError(m.why); }
  else if (m.t === 'lobby') { NET.lobby = m.list; renderLobby(); }
  else if (m.t === 'ping') toHost({ t: 'pong', ts: m.ts });
  else if (m.t === 'start') guestStart(m);
  else if (m.t === 's') { NET.snap = m; applySnap(m); }
}

function coopReset() {
  try { NET.peer?.destroy(); } catch (err) { /* gone */ }
  try { NET.conn?.close(); } catch (err) { /* gone */ }
  for (const g of NET.conns.keys()) { try { g.close(); } catch (err) { /* gone */ } }
  Object.assign(NET, { on: false, host: false, guest: false, run: false, key: '', me: null, myId: 0, players: [], lobby: [], world: null, peer: null, conn: null, snap: null });
  NET.conns = new Map();
  ACTIVE = null;
  coopHud(false);
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

/* ---------- starting a run ---------- */
function coopStart() {
  if (!NET.host || NET.run || deckProblems().length) return;
  resetRun();
  NET.world = { w: Math.round(Math.max(VW, 640) * COOP.world), h: Math.round(Math.max(VH, 480) * COOP.world) };
  NET.run = true;
  resize();
  const host = newCtx(1, NET.name, COOP.colors[0], true, equippedCards(), seed);
  Object.assign(host, { body: game.player, deck, stats, picks });   // the host's own run, as resetRun made it
  for (const k of PKEYS) host[k] = game[k];
  NET.players = [host, ...NET.lobby.filter(p => !p.local).map(g => Object.assign(newCtx(g.id, g.name, g.color, false, g.cards, g.seed), { conn: g.conn, ping: g.ping }))];
  NET.me = host; ACTIVE = host;
  NET.players.forEach((c, i) => { const a = (i / NET.players.length) * TAU; c.body.x = W / 2 + Math.cos(a) * 60; c.body.y = H / 2 + Math.sin(a) * 60; });
  const roster = NET.players.map(c => ({ id: c.id, name: c.name, color: c.color }));
  for (const c of NET.players) if (c.conn) netSend(c.conn, { t: 'start', world: NET.world, you: c.id, roster, x: c.body.x, y: c.body.y });
  coopEnter();
}
function guestStart(m) {
  resetRun();
  NET.world = m.world;
  NET.run = true;
  resize();
  deck = createDeck(NET.myCards, mulberry32(NET.mySeed));    // the same deck the host is playing for us
  NET.roster = m.roster;
  NET.me = { id: m.you, name: NET.name, local: true, body: game.player, down: false, color: (m.roster.find(r => r.id === m.you) || {}).color };
  NET.players = [NET.me];
  Object.assign(game.player, { x: m.x, y: m.y });
  NET.view = [];
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

/* ---------- the host's frame ---------- */
// Movement for every player (combat.js calls this instead of the single player's).
function coopPlayersStep(dt) {
  for (const c of NET.players) {
    if (c.down) continue;
    usePlayer(c);
    const p = c.body;
    if (c.local) {
      const [mx, my] = c.typing ? [0, 0] : localInput();
      playerStep(dt, mx, my);
    } else {
      if (c.net.dash) { c.net.dash = false; tryDash([c.net.mx, c.net.my]); }
      const px = p.x, py = p.y;
      playerStep(dt, c.typing ? 0 : c.net.mx, c.typing ? 0 : c.net.my);
      // the guest's own position wins, unless the host is moving them (a charge or a shove)
      const forced = game.dash || Math.hypot(p.kx || 0, p.ky || 0) > 5;
      if (!forced && Number.isFinite(c.net.x)) { p.x = c.net.x; p.y = c.net.y; clampTo(p, PLAYER.r); }
      p.px = px; p.py = py;
      c.forced = forced;
    }
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
  for (let l = from + 1; l <= to; l++) {
    if (l === BOSS.level && !game.bossDone && !game.boss) game.bossDue = true;
    if (l === MAKORA.level && !game.makora) game.makoraDue = true;
  }
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
  c.down = true; c.typing = false;
  game.dash = null; game.frost = null;
  const p = c.body;
  p.hp = 0; p.kx = p.ky = 0;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 70, life: 0.6, color: COL.bad });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 16, text: `${c.name} IS DOWN`, color: COL.bad, life: 1.6, vy: -20, big: true });
  coopEvent({ e: 'down', id: c.id });
  if (c.local) { renderHp(true); closeRevive(); }
  if (!living().length) coopOver();
}
function coopRevive(target, by) {
  if (!NET.host || !target || !target.down || !by || by.down) return;
  target.down = false;
  const was = ACTIVE; usePlayer(target);
  target.body.hp = maxHp(); target.body.safe = 2;
  game.shield = 1.2;
  if (target.local) renderHp(false);
  usePlayer(was);
  const p = target.body;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 90, life: 0.6, color: COL.hp });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 16, text: `${target.name} IS BACK!`, color: COL.hp, life: 1.6, vy: -20, big: true });
  SFX.levelUp();
  coopEvent({ e: 'revived', id: target.id });
}
function coopOver() {
  if (game.over) return;
  coopEvent({ e: 'over' });
  flushSnaps(true);
  defeat();
}
// An event for every guest (they get it with their next picture of the arena).
function coopEvent(ev) { if (NET.host) for (const c of NET.players) if (!c.local) c.outbox.push(ev); }

/* ---------- pictures of the arena (host → guests) ---------- */
const WORLD_KEYS = ['enemies', 'projectiles', 'orbs', 'potions', 'diamonds', 'mines', 'rocks', 'cracks', 'rings', 'floaters', 'beams', 'sweeps',
  'fields', 'summons', 'bombs', 'bites', 'muzzles', 'ghosts', 'swooshes'];
const IDS = new Set(['enemies', 'projectiles', 'orbs', 'summons']);
const SNAP_DROP = new Set(['target', 'hits', 'trail', 'audio', 'conn', 'outbox', 'fn', 'queue']);
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
  return { id: c.id, name: c.name, color: c.color, x: c.body.x, y: c.body.y, hp: c.body.hp, mh: PLAYER.hp + c.stats.hp, down: c.down,
    dash: d ? { dx: d.dx, dy: d.dy, sx: d.sx, sy: d.sy } : null, frost: f ? { t: f.t, card: f.card } : null, safe: c.body.safe, flash: c.body.flash,
    shield: g('shield'), ping: c.local ? 0 : c.ping, forced: !!c.forced, typing: c.typing };
}
function flushSnaps(force = false) {
  const now = performance.now();
  if (!force && now - NET.lastSnap < COOP.snapMs) return;
  NET.lastSnap = now;
  for (const k of IDS) for (const o of game[k]) if (!o._id) o._id = ++NET.nid;
  const world = { t: 's', lv: game.level, xp: game.xp, kills: game.kills, shake: game.shake, over: game.over,
    adapted: game.makoraAdapted ? [...game.makoraAdapted] : [],
    cine: game.cine ? { kind: game.cine.kind, t: game.cine.t, step: game.cine.step } : null,
    intro: game.intro ? { t: game.intro.t, stomp: game.intro.stomp } : null,
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
      fired: c.fired, ev: c.outbox.splice(0) };
    c.fired = 0;
    netSend(c.conn, JSON.parse(base.slice(0, -1) + ',"me":' + JSON.stringify(me, snapReplacer) + '}'));   // … plus their own part
  }
  NET.sfxN = 0; NET.sfxSeen = {};
  if (now - NET.lastPing > COOP.pingMs) { NET.lastPing = now; for (const c of NET.players) if (c.conn) netSend(c.conn, { t: 'ping', ts: now }); }
}

/* ---------- the guest's frame ---------- */
const trails = new Map();
function applySnap(s) {
  if (!NET.run) return;
  const now = performance.now();
  // smoothing: each thing slides from where it's drawn now to its new place over the next picture's time
  const drawn = new Map();
  for (const k of IDS) for (const o of game[k] || []) if (o._id) drawn.set(o._id, o);
  if (s.orbs && typeof s.orbs[0] === 'number') {             // unpacked: x, y, r, id
    const o = s.orbs, out = [];
    for (let i = 0; i + 3 < o.length; i += 4) out.push({ x: o[i], y: o[i + 1], r: o[i + 2], _id: o[i + 3], t: o[i + 3] * 0.7, born: 1 });
    s.orbs = out;
  }
  for (const k of WORLD_KEYS) {
    if (k === 'cracks' && !s.cracks) continue;               // unchanged: keep ours (they fade out on their own)
    const list = s[k] || [];
    if (IDS.has(k)) for (const o of list) {
      const was = drawn.get(o._id);
      o._fx = was ? was.x : o.x; o._fy = was ? was.y : o.y; o._tx = o.x; o._ty = o.y;
      o.x = o._fx; o.y = o._fy;
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
  aliveEl.textContent = game.enemies.length;
  game.boss = game.enemies.find(e => e.boss) || null;
  game.makora = game.enemies.find(e => e.makora) || (s.cine && game.makora) || null;
  game.makoraAdapted = new Set(s.adapted || []);
  if (game.makora) renderMakoraBar(); else if (game.boss) renderBossBar(); else { bossBar.hidden = true; bossBar.classList.remove('is-makora'); }
  // the others, smoothed too
  const views = new Map((NET.view || []).map(v => [v.id, v]));
  NET.view = (s.pl || []).filter(v => v.id !== NET.me.id).map(v => { const w = views.get(v.id); return { ...v, _fx: w ? w.x : v.x, _fy: w ? w.y : v.y, _tx: v.x, _ty: v.y }; });
  NET.pings = (s.pl || []).map(v => ({ id: v.id, name: v.name, color: v.color, ping: v.ping, down: v.down, host: v.id === 1 }));
  // me
  const mine = (s.pl || []).find(v => v.id === NET.me.id), p = game.player;
  if (mine) {
    const hit = mine.hp < p.hp - 0.5;
    if (hit) SFX_RAW.hurt();
    if (mine.forced || mine.down || Math.hypot(mine.x - p.x, mine.y - p.y) > 160) { p.x = mine.x; p.y = mine.y; }
    NET.me.forced = mine.forced;
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
    const hadBull = game.relics.includes('bull');
    game.relics = me.relics || []; game.dashCd = me.dashCd || 0;
    if (hadBull !== game.relics.includes('bull') || game.dashCd > 0 || NET.wasCd) renderRelics();
    NET.wasCd = game.dashCd > 0;
    for (let k = 0; k < (me.fired || 0); k++) onAttack(deck.draw());   // our deck plays along with the host's copy of it
    if (augChanged) renderTray(false);
    for (const ev of me.ev || []) guestEvent(ev);
  }
  guestScenes(s);
}
function guestEvent(ev) {
  if (ev.e === 'sfx') { const f = SFX_RAW[ev.n]; if (f) try { f(...(ev.a || [])); } catch (err) { /* a sound */ } }
  else if (ev.e === 'gold') { save.gold += ev.n; writeSave(); game.goldBonus = (game.goldBonus || 0) + ev.n; toast(`+${ev.n} GOLD · ${ev.why}`, ''); SFX_RAW.coin(); }
  else if (ev.e === 'toast') toastRaw(ev.text, ev.cls);
  else if (ev.e === 'picks') showPick({ level: ev.level, choices: ev.choices, until: performance.now() + ev.secs * 1000, more: ev.more });
  else if (ev.e === 'picked') { SFX_RAW.upgrade(ev.rank); closePick(); renderStats(ev.id); }
  else if (ev.e === 'over') { if (!game.over) defeat(); }
  else if (ev.e === 'down' && ev.id === NET.me.id) { NET.me.down = true; closeRevive(); }
  else if (ev.e === 'skip') skipIntro(true);
}
// SKURTOSAURUS's intro and MAKORA's scenes: the guest plays its own copy (the words, the wheel, the sounds), started
// and ended by the host's.
function guestScenes(s) {
  if (s.intro && !game.intro && !NET.introSeen) { NET.introSeen = true; startIntroScene(); game.intro = { t: s.intro.t, stomp: s.intro.stomp }; }
  if (!s.intro) NET.introSeen = false;
  if (s.cine && !game.cine) {
    if (s.cine.kind === 'summon') startMakora();
    else showAdaptScene(game.makora || { turns: 1 });
    game.cine.t = s.cine.t; game.cine.step = 0;
  } else if (!s.cine && game.cine) endCine();
}
function guestFrame(dt) {
  const p = game.player;
  p.px = p.x; p.py = p.y;
  if (!NET.me.down && !NET.me.forced && !game.dash) {
    const [mx, my] = NET.typing ? [0, 0] : localInput(), ml = Math.hypot(mx, my);
    if (ml) { p.x += (mx / ml) * moveSpeed() * dt; p.y += (my / ml) * moveSpeed() * dt; hintEl.classList.add('gone'); }
    clampTo(p, PLAYER.r);
  }
  const now = performance.now();
  if (now - NET.lastIn > COOP.inMs) {
    NET.lastIn = now;
    const [mx, my] = NET.typing || NET.me.down ? [0, 0] : localInput();
    toHost({ t: 'in', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, mx, my, ty: NET.typing ? 1 : 0, dash: NET.wantDash ? 1 : 0 });
    NET.wantDash = false;
  }
  // slide everything toward where the last picture put it
  const k = Math.min(1, (now - (NET.snapAt || now)) / COOP.snapMs);
  for (const key of IDS) for (const o of game[key]) if (o._tx != null) { o.x = o._fx + (o._tx - o._fx) * k; o.y = o._fy + (o._ty - o._fy) * k; }
  for (const v of NET.view || []) { v.x = v._fx + (v._tx - v._fx) * k; v.y = v._fy + (v._ty - v._fy) * k; }
  for (const pr of game.projectiles) { pr.trail.push(pr.x, pr.y); if (pr.trail.length > 16) pr.trail.splice(0, 2); pr.spin = (pr.spin || 0) + dt * 18; }
  for (const e of game.enemies) e.anim = (e.anim || 0) + dt;
  if (game.intro) updateIntro(dt);
  if (game.cine) updateCine(dt);
  updateEffects(dt);
  tickPick(); reviveTick(dt);
}

/* ---------- input, camera ---------- */
// Your movement this frame: keys, or pointer (held down) in world units.
function localInput() {
  let mx = 0, my = 0;
  for (const k of keys) { mx += MOVE[k][0]; my += MOVE[k][1]; }
  if (!mx && !my && pointer) {
    const p = game.player, dx = pointer.x + cam.x - p.x, dy = pointer.y + cam.y - p.y;
    if (Math.hypot(dx, dy) > 6) { mx = dx; my = dy; }
  }
  return [mx, my];
}
// The view follows you round the bigger arena (draw.js).
function updateCam() {
  if (!NET.run) { cam.x = cam.y = 0; return; }
  const p = game.player, bottom = NET.viewSafe || VH;
  cam.x = W <= VW ? (W - VW) / 2 : Math.max(0, Math.min(W - VW, p.x - VW / 2));
  cam.y = H <= bottom ? (H - bottom) / 2 : Math.max(0, Math.min(H - bottom, p.y - bottom / 2));
}

/* ---------- sounds and callouts go to the guests too ---------- */
const SFX_RAW = { ...SFX };
const toastRaw = toast;
const QUIET = new Set(['click', 'confirm', 'back', 'whoosh', 'start', 'rip', 'coin', 'upgrade', 'hurt', 'dodge', 'defeat', 'shuffle', 'deal', 'pickup', 'levelUp']);
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

/* ---------- drawing the others ---------- */
// Everyone else (draw.js, after your own player): a circle in their colour, a BULL wedge while charging, DOWN with a
// cross, and a name over each (drawn on the text layer, below).
function coopBodies() {
  if (!NET.run) return [];
  if (NET.host) return NET.players.filter(c => c !== NET.me).map(c => ({ ...playerView(c) }));
  return NET.view || [];
}
function drawCoopPlayers() {
  if (!NET.run) return;
  for (const v of coopBodies()) {
    if (v.frost) drawFrostAt(v.frost, v);
    ctx.globalAlpha = v.down ? 0.55 : v.safe > 0 && Math.floor(v.safe * 20) % 2 ? 0.45 : 1;
    ctx.fillStyle = v.down ? COL.line : v.color;
    if (v.dash) ellipse(v.x, v.y, PLAYER.r * 1.25, PLAYER.r * 0.82, Math.atan2(v.dash.dy, v.dash.dx));
    else circle(v.x, v.y, PLAYER.r);
    ctx.globalAlpha = 1;
    if (v.down) {                                             // a cross, and a ring if you can revive them
      ctx.strokeStyle = COL.bad; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(v.x - 6, v.y - 6); ctx.lineTo(v.x + 6, v.y + 6); ctx.moveTo(v.x + 6, v.y - 6); ctx.lineTo(v.x - 6, v.y + 6); ctx.stroke();
      const near = !NET.me.down && Math.hypot(v.x - game.player.x, v.y - game.player.y) < COOP.reviveReach;
      ctx.globalAlpha = near ? 0.9 : 0.35; ctx.strokeStyle = COL.hp; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(v.x, v.y, COOP.reviveReach * 0.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    } else if (v.flash > 0) {
      ctx.globalAlpha = v.flash / 0.2; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(v.x, v.y, PLAYER.r + 5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  if (NET.me.down) {                                          // you: down
    const p = game.player;
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6); ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6); ctx.stroke();
  }
}
// Names, over everyone (on the text layer, which draw.js has moved with the camera).
function drawCoopNames() {
  if (!NET.run) return;
  const c = tctx;
  c.font = '700 12px "Chakra Petch", system-ui, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
  const label = (x, y, text, color) => { c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y); };
  const p = game.player;
  label(p.x, p.y - PLAYER.r - 8, NET.me.down ? `${NET.name} · DOWN` : NET.name, COOP.colors[0] === (NET.me.color || COOP.colors[0]) ? '#fff' : NET.me.color);
  for (const v of coopBodies()) {
    label(v.x, v.y - PLAYER.r - 8, v.down ? `${v.name} · DOWN` : v.name, v.color);
    if (v.down && !NET.me.down && Math.hypot(v.x - p.x, v.y - p.y) < COOP.reviveReach && !NET.typing) label(v.x, v.y + PLAYER.r + 20, 'E · REVIVE', COL.hp);
  }
}

/* ---------- the in-game player list, with pings ---------- */
function coopHud(on) {
  const el = $('coop-list');
  el.hidden = !on;
  document.body.classList.toggle('in-coop', !!on);
  if (on) renderCoopList();
}
function pingClass(ms) { return ms == null ? '' : ms < 80 ? 'is-good' : ms < 150 ? 'is-ok' : 'is-bad'; }
function renderCoopList() {
  if (!NET.run) return;
  const rows = NET.host ? NET.players.map(c => ({ id: c.id, name: c.name, color: c.color, ping: c.local ? null : c.ping, down: c.down, host: c.id === 1 }))
    : (NET.pings || []);
  $('coop-list').innerHTML = rows.map(r => `<li class="${r.down ? 'is-down' : ''}"><i style="background:${r.color}"></i><span class="cl-name">${esc(r.name)}${r.id === (NET.me?.id) ? ' (you)' : ''}</span>`
    + `<b class="cl-ping ${r.host ? '' : pingClass(r.ping)}">${r.down ? 'DOWN' : r.host ? 'host' : r.ping == null ? '…' : `${r.ping} ms`}</b></li>`).join('');
}
setInterval(() => { if (NET.run) renderCoopList(); }, 500);
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

/* ---------- reviving: a typing test ---------- */
const rv = { on: false, target: 0, words: [], i: 0, left: 0 };
function coopTryRevive() {
  if (!NET.run || NET.typing || NET.me.down || game.over) return false;
  const p = game.player;
  const t = coopBodies().find(v => v.down && Math.hypot(v.x - p.x, v.y - p.y) < COOP.reviveReach);
  if (!t) return false;
  const pool = COOP.WORDS.slice().sort(() => Math.random() - 0.5);
  Object.assign(rv, { on: true, target: t.id, name: t.name, words: pool.slice(0, COOP.revive.words), i: 0, left: COOP.revive.time });
  NET.typing = true; if (NET.host) NET.me.typing = true;
  keys.clear();
  $('revive').hidden = false;
  $('rv-name').textContent = t.name;
  $('rv-input').value = '';
  renderRevive();
  $('rv-input').focus();
  return true;
}
function renderRevive() {
  $('rv-word').textContent = rv.words[rv.i] || '';
  $('rv-count').textContent = `${rv.i}/${COOP.revive.words}`;
  $('rv-bar').style.transform = `scaleX(${rv.left / COOP.revive.time})`;
  $('rv-time').textContent = `${Math.ceil(rv.left)}s`;
}
function reviveTick(dt) {
  if (!rv.on) return;
  rv.left -= dt;
  // the one being revived got up (someone else), or left
  const t = coopBodies().find(v => v.id === rv.target);
  if (!t || !t.down) { closeRevive(); return; }
  if (rv.left <= 0) { closeRevive(); toastRaw('TOO SLOW · PRESS E TO TRY AGAIN', ''); return; }
  $('rv-bar').style.transform = `scaleX(${Math.max(0, rv.left) / COOP.revive.time})`;
  $('rv-time').textContent = `${Math.ceil(rv.left)}s`;
}
function closeRevive() {
  if (!rv.on && $('revive').hidden) return;
  rv.on = false; NET.typing = false; if (NET.me) NET.me.typing = false;
  $('revive').hidden = true;
  $('rv-input').blur();
}
$('rv-input').addEventListener('keydown', e => {
  if (e.code === 'Escape') { closeRevive(); e.preventDefault(); return; }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  const typed = e.target.value.trim().toLowerCase();
  if (!typed) return;
  if (typed === rv.words[rv.i]) {
    rv.i++; e.target.value = '';
    SFX_RAW.pickup();
    if (rv.i >= COOP.revive.words) {                          // done: they're back at full health
      const id = rv.target;
      closeRevive();
      if (NET.host) coopRevive(byId(id), NET.me); else toHost({ t: 'revive', id });
      return;
    }
    renderRevive();
  } else {
    SFX_RAW.dodge();
    e.target.value = '';
    const box = $('revive').querySelector('.rv-box');
    box.classList.remove('is-wrong'); void box.offsetWidth; box.classList.add('is-wrong');
  }
});
// the word as you type it: green while right so far, red once it's wrong
$('rv-input').addEventListener('input', e => {
  const w = rv.words[rv.i] || '', v = e.target.value.toLowerCase();
  $('rv-word').className = 'rv-word' + (v && !w.startsWith(v.trim()) ? ' is-wrong' : v ? ' is-right' : '');
});

/* ---------- the CO-OP screen (a login: name, then Host or Join) ---------- */
const NAME_KEY = 'rogue.coopName';
function openCoop() {
  if (!NET.on) {
    try { $('co-name').value = localStorage.getItem(NAME_KEY) || ''; } catch (err) { /* no storage */ }
  }
  coopError('');
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
  if (deckProblems().length) { coopError('Fix your deck in Loadout first.'); return; }
  coopBusy = true; coopError(''); $('co-status').textContent = 'Opening a room…';
  try { await coopHost(n); } catch (err) { coopReset(); coopError(err.message); }
  coopBusy = false; renderLobby();
}
async function clickJoin() {
  if (coopBusy) return;
  const n = coopName(); if (!n) return;
  const key = cleanKey($('co-key').value);
  if (key.length !== 7) { coopError('Type the room key your friend gave you (like PS-7KQX).'); $('co-key').focus(); return; }
  if (deckProblems().length) { coopError('Fix your deck in Loadout first.'); return; }
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
  $('co-players').innerHTML = NET.lobby.map(p => `<li><i style="background:${p.color}"></i><span>${esc(p.name)}${p.id === (NET.host ? 1 : NET.myId) ? ' (you)' : ''}</span>`
    + `<b class="cl-ping ${p.id === 1 ? '' : pingClass(p.ping)}">${p.id === 1 ? 'host' : p.ping == null ? '…' : `${p.ping} ms`}</b></li>`).join('');
  $('co-start').hidden = !NET.host;
  $('co-start').textContent = NET.lobby.length > 1 ? `Start (${NET.lobby.length} players)` : 'Start (waiting for friends…)';
  $('co-start').disabled = NET.lobby.length < 2;
  $('co-wait').hidden = NET.host;
}
setInterval(() => { if (NET.host && !NET.run) { const now = performance.now(); for (const g of NET.conns.values()) netSend(g.conn, { t: 'ping', ts: now }); } }, COOP.pingMs);
$('btn-coop').addEventListener('click', openCoop);
$('co-host').addEventListener('click', clickHost);
$('co-join').addEventListener('click', clickJoin);
$('co-key').addEventListener('keydown', e => { if (e.key === 'Enter') clickJoin(); });
$('co-name').addEventListener('keydown', e => { if (e.key === 'Enter') ($('co-key').value ? clickJoin() : clickHost()); });
$('co-start').addEventListener('click', coopStart);
$('co-leave').addEventListener('click', () => { coopLeave(); coopError(''); });
$('co-back').addEventListener('click', () => { if (NET.on && !NET.run) coopLeave(); goMain(); });
$('co-copy').addEventListener('click', () => {
  navigator.clipboard?.writeText(NET.key).then(() => { $('co-copy').textContent = 'Copied'; setTimeout(() => { $('co-copy').textContent = 'Copy'; }, 1200); }).catch(() => {});
});

// The host keeps the fight going when its tab is hidden (the browser stops drawing it), so the others aren't frozen.
setInterval(() => {
  if (!NET.host || !NET.run || !document.hidden || game.over) return;
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try { update(dt); usePlayer(NET.me); flushSnaps(); } catch (err) { console.error(err); }
}, 50);
