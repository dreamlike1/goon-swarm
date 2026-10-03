/* online.js — Online (v0.56, user): your player name, one per PC, the leaderboard, and your save kept online too.
   All of it on Supabase (docs/supabase-setup.sql makes the tables and functions; the steps are in HANDOFF.md). */
'use strict';

/* ============================================================
   Paste your Supabase project's URL and its anon (public) key below (Project Settings → API). The anon key is meant
   to be public: the database only lets it call the functions in docs/supabase-setup.sql, never touch the table. With
   them empty, the game plays offline as before: no name, no leaderboard.
   - A player: the first time you press Start you pick a name (2–14 letters, numbers, spaces, _ . -). Behind it is an
     anonymous Supabase sign-in, kept in this browser.
   - One per PC (user): the name is tied to this PC (`deviceId`: things about it that stay the same in a private
     window, like its graphics chip, CPU cores and time zone). A PC that already has a name logs straight into it
     (user: "auto login"), in any browser or a private window (claim_device moves it there); it can't make a second
     one. Reset data deletes the name (and its scores), so a new one can be picked.
   - The leaderboard (v0.69, user: "showing highest run and highest dmg"): your highest run (each MAKORA you beat
     sends you round again: run 2, run 3 …, shown as its wheel with the number in it) and your highest damage (the
     biggest single hit). Ranked by highest run, then highest damage (then runs, best level, enemies defeated, and
     whoever got there first). Sent at the end of every run (not test runs). docs/supabase-update-4.sql adds this
     to the database; until it's run, the board shows what it has (the old wheel and level).
   - Your save goes online whenever it's saved here (a couple of seconds later); logging back in on this PC brings
     the newest one back.
   ============================================================ */
const SUPA = {
  url: 'https://awgvapcdpohxersykcqe.supabase.co',   // the packssilica project (Singapore)
  key: 'sb_publishable_svcnA4rqoz6js3ZjJPLwaw_KX76nlG5',   // the publishable (public) key: fine to ship
  lib: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
};
const ONLINE = {
  on: !!(SUPA.url && SUPA.key) && location.protocol !== 'file:' && !!window.crypto?.subtle,
  db: null, me: null, device: '', top: [], err: '', offline: false,
  rows: 10,             // names on the leaderboard
  pushWait: 2000,       // ms after a save before it goes online
  refreshEvery: 15000,  // ms: the leaderboard reloads at most this often when a menu shows it
  shownAt: 0, pushT: 0,
};

const loadScript = src => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.async = true; s.onload = ok; s.onerror = () => fail(new Error('could not load the online library'));
  document.head.appendChild(s);
});

// This PC, as best a web page can tell (user: one name per PC, not per browser): a hash of things that are the same
// in a private window and mostly the same across browsers. Not the screen size (it changes with the monitor).
async function deviceId() {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl'), x = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl) gpu = String(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch (err) { /* no WebGL */ }
  const parts = [navigator.hardwareConcurrency || 0, navigator.maxTouchPoints || 0, navigator.platform || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '', gpu];
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const onlineReady = ONLINE.on ? onlineStart() : Promise.resolve(false);
async function onlineStart() {
  try {
    await loadScript(SUPA.lib);
    ONLINE.db = window.supabase.createClient(SUPA.url, SUPA.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rogue.auth' } });
    ONLINE.device = await deviceId();
    const { data } = await ONLINE.db.auth.getSession();
    if (!data.session) { const r = await ONLINE.db.auth.signInAnonymously(); if (r.error) throw r.error; }
    if (forgetDue() && !await sendForget()) throw new Error('the reset is still to be sent');   // (v0.70: never log back in to a reset name)
    await loadMe();
    if (!ONLINE.me && await rpc('claim_device', { p_device: ONLINE.device })) await loadMe();   // this PC's name: logged in
    refreshBoard(true);
    return true;
  } catch (err) {
    ONLINE.err = err?.message || String(err);
    ONLINE.offline = true;
    renderBoard();
    return false;
  }
}
const rpc = async (fn, args) => {
  const { data, error } = await ONLINE.db.rpc(fn, args);
  if (error) throw error;
  return data;
};

// Who you are online (null: no name yet), and your save if the one online is newer than this PC's.
async function loadMe() {
  const me = await rpc('get_me');
  ONLINE.me = me || null;
  if (me?.save && (me.save.at || 0) > (save.at || 0)) useCloudSave(me.save);
  renderBoard();
  return ONLINE.me;
}
function useCloudSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (err) { /* it stays in memory */ }
  save = loadSave();
  if (!game.inMenu) return;                // (it's in place for the next menu)
  newDeck(); renderTray(true); renderLog(); renderGold();
  if (current === 'scr-main') renderLoadout();
}

// Is there a name to pick before playing? (Online, connected, no name yet, and not chosen to play offline.)
const needName = () => ONLINE.on && !ONLINE.offline && !ONLINE.me;

// Picks a name (or logs back into this PC's). { ok } or { error: 'name' | 'device' | 'bad' | 'net', name }.
async function onlineRegister(name) {
  await onlineReady;
  if (!ONLINE.db) return { error: 'net' };
  try {
    const r = await rpc('register_player', { p_name: name, p_device: ONLINE.device });
    if (!r?.ok) return r || { error: 'net' };
    await loadMe();
    if (!r.reclaimed) cloudPush(true);     // a new name: this PC's save goes up with it
    try { localStorage.setItem('rogue.coopName', ONLINE.me?.name || name); } catch (err) { /* no storage */ }   // (co-op uses it too)
    refreshBoard(true);
    return { ok: true, reclaimed: !!r.reclaimed };
  } catch (err) { ONLINE.err = err?.message || String(err); return { error: 'net' }; }
}

// Reset data: the name goes too (user), and its scores.
// v0.70 (user: "if I reset my data it must be cleared at the database and dashboard, or any data connected to it"):
// delete_player takes the name, the save, the scores, the last 5 runs and every pack pull (docs/supabase-update-5.sql),
// so the leaderboard and the admin view lose them too. `FORGET_KEY` marks a reset still to be sent: a reset before the
// connection is up (or one that failed) is sent the next time the game connects, before it can log this PC back in.
const FORGET_KEY = 'rogue.forget';
async function onlineForget() {
  try { localStorage.setItem(FORGET_KEY, '1'); } catch (err) { /* sent now or not at all */ }
  clearTimeout(ONLINE.pushT);              // (the old save mustn't go up after it)
  ONLINE.me = null;
  renderBoard();
  if (!await onlineReady || !ONLINE.db) return;   // (onlineStart sends it once connected)
  await sendForget();
  ONLINE.me = null;                        // (in case the connection logged in while it was on its way)
  refreshBoard(true);
}
async function sendForget() {
  try { await rpc('delete_player'); } catch (err) { return false; }   // (it's tried again next time)
  try { localStorage.removeItem(FORGET_KEY); } catch (err) { /* no storage */ }
  return true;
}
const forgetDue = () => { try { return localStorage.getItem(FORGET_KEY) === '1'; } catch (err) { return false; } };

// The end of a run: your best so far is kept (the database keeps whichever is better), and how the run went goes
// into your last 5 (the admin view's, v0.57; not co-op runs, where the host counts everyone's hits together).
async function onlineRun() {
  if (!ONLINE.me || game.practice || !(game.level > 0)) return;
  const wheel = game.wheelSpins || 0;                    // MAKORA beaten this many times (v0.69: once a run)
  const run = Math.max(1, game.flow?.run || 1), dmg = Math.min(2e9, Math.round(game.maxHit || 0));   // the highest run reached, the biggest hit
  if (!NET.run) { const rec = runRecord(wheel); rpc('log_run', { p_run: rec }).catch(() => {}); }   // (read now: the run resets next)
  const args = { p_level: Math.min(99, game.level | 0),   // (the database takes 1–99; no level cap since v0.57)
    p_kills: game.kills | 0, p_time: Math.min(86400, Math.round(game.runT || 0)), p_wheel: Math.min(999, wheel) };
  try {
    // (a database without update 4 doesn't know p_run / p_dmg: then the old call, so the run still counts)
    try { await rpc('submit_run', { ...args, p_run: run, p_dmg: dmg }); } catch (err) { await rpc('submit_run', args); }
    await loadMe();
    refreshBoard(true);
  } catch (err) { /* the next run tries again */ }
}

/* One run, for the admin view (v0.57, user: "track the most used weapon of the players, what killed them, the swarm
   count, the swarm type, the level they died on, the weapons they used and how often (in %), their whole stats"; the
   database keeps each player's last 5, the newest replacing the oldest). Card ids, as in cards.js:
   - end 'died' (by: what landed the last hit) or 'quit' (back to the title mid-run); level, stage (1–4) and its boss.
   - where: 'swarm', 'huge' (the huge swarm) or 'boss'; swarm: the wave's swarm type; field: enemies on the field.
   - deck: copies of each card; plays: how many times each came up; dmg: what each dealt; kos: what each finished off;
     combos: each card's ×3 / ×7; hurt: damage taken from each source.
   - stats: every stat as the panel shows it, with how many times it was picked.
   - adj: the swarm when it ended against the level's normal one, and what changed it (flow.js swarmReport). */
function runRecord(wheel) {
  const t = game.tally || {}, f = game.flow || {}, S = FLOW.stages[f.stage || 0];
  const whole = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Math.round(v)]));
  const copies = {};
  for (const id of runDeckCards()) copies[id] = (copies[id] || 0) + 1;
  const fight = !(f.state === 'swarm' || f.state === 'sweep');
  return {
    v: 1, end: game.over ? 'died' : game.cleared?.final ? 'won' : 'quit', by: game.over ? t.by || 'Enemy' : game.cleared?.final ? 'Won' : 'Quit',
    run: f.run || 1, maxHit: Math.round(game.maxHit || 0),
    level: game.level | 0, stage: (f.stage || 0) + 1, boss: S?.name || '',
    where: fight ? 'boss' : f.huge ? 'huge' : 'swarm', swarm: fight ? S?.name || '' : f.name || '',
    field: game.enemies.filter(e => !(e.apple || e.hugeSnek || e.boss || e.obi || e.makora)).length,
    time: Math.round(game.runT || 0), kills: game.kills | 0, wheel, beaten: f.beaten || [],
    dealt: Math.round(Object.values(t.dealt || {}).reduce((a, b) => a + b, 0)), taken: Math.round(t.taken || 0),
    deck: copies, plays: t.plays || {}, dmg: whole(t.dealt), kos: t.kos || {}, combos: t.combos || {}, hurt: whole(t.hurt),
    stats: STAT_IDS.map(id => [STATS[id].name, STATS[id].show(), picks[id]?.n || 0]), relics: game.relics || [],
    adj: swarmReport(),   // the swarm then, against the level's normal one, and what changed it (flow.js)
  };
}

/* A pack opened (v0.67, user: "does our admin dashboard show pull details, so we can see the pull rate made by players?").
   save.js buyPack / openStarter call this with the pack's key and its cards; the admin view's Pulls tab reads them
   (docs/supabase-update-3.sql: log_pull). Not co-op or test packs (those don't come through here); quietly nothing
   if you've no name yet or the database hasn't had update 3 (the call just fails). */
function onlinePull(kind, pack, ids, price = 0) {
  if (!ONLINE.me || !ONLINE.db || !ids?.length) return;
  rpc('log_pull', { p_pull: { kind, pack, price, ids } }).catch(() => {});
}

// save.js writeSave calls this: the save goes online a moment later (one upload for a burst of saves).
function cloudPush(now = false) {
  if (!ONLINE.me || !ONLINE.db) return;
  clearTimeout(ONLINE.pushT);
  ONLINE.pushT = setTimeout(() => { rpc('put_save', { p_save: save }).catch(() => {}); }, now ? 0 : ONLINE.pushWait);
}

/* ---------- the leaderboard, top right of the title screen and main menu ---------- */
async function refreshBoard(force = false) {
  if (!ONLINE.db || (!force && performance.now() - ONLINE.shownAt < ONLINE.refreshEvery)) { renderBoard(); return; }
  ONLINE.shownAt = performance.now();
  try { ONLINE.top = (await rpc('get_leaderboard', { p_n: ONLINE.rows })) || []; } catch (err) { ONLINE.err = err?.message || String(err); }
  renderBoard();
}
// (names are escaped with coop.js esc)
const runsText = n => `${n} run${n === 1 ? '' : 's'}`;
const dmgText = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : Math.round(n).toLocaleString('en');
// A row's score (v0.69): its highest run, as MAKORA's wheel with the number in it, and its highest damage. A database
// without update 4 has neither: then the old wheel or level.
function boardScore(r, rank = '') {
  if (r.run == null) return `<span class="board-score">${rank}${r.wheel ? `Wheel ×${r.wheel}` : `Lv ${r.level}`}<small>${runsText(r.runs || 0)}</small></span>`;
  return `<span class="board-score"><span class="board-run run-badge" role="img" aria-label="Highest run: ${Math.max(1, r.run)}">${runBadge(Math.max(1, r.run))}</span>`
    + `<span class="board-dmg">${rank}<b>${dmgText(r.dmg || 0)}</b><small>dmg</small></span></span>`;
}
function renderBoard() {
  const el = $('board-list'), meEl = $('board-me');
  if (!el) return;
  const myName = ONLINE.me?.name?.toLowerCase();
  if (!ONLINE.on) el.innerHTML = '<li class="board-note">Offline</li>';
  else if (ONLINE.offline) el.innerHTML = '<li class="board-note">Can’t reach the leaderboard</li>';
  else if (!ONLINE.db) el.innerHTML = '<li class="board-note">Connecting…</li>';
  else if (!ONLINE.top.length) el.innerHTML = '<li class="board-note">No runs yet. Be the first!</li>';
  else el.innerHTML = ONLINE.top.map((r, i) => `<li class="${r.name.toLowerCase() === myName ? 'is-me' : ''}${i < 3 ? ` is-top${i + 1}` : ''}">`
    + `<span class="board-rank">${i + 1}</span><span class="board-name">${esc(r.name)}</span>${boardScore(r)}</li>`).join('');
  const me = ONLINE.me;
  meEl.hidden = !me;
  if (me) meEl.innerHTML = `<span class="board-you">You</span><span class="board-name">${esc(me.name)}</span>`
    + (me.rank ? boardScore(me, `#${me.rank} · `) : `<span class="board-score">No runs yet<small>${runsText(me.runs || 0)}</small></span>`);
}
renderBoard();
