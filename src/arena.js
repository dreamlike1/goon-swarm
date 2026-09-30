/* arena.js — Canvas sizing and input (keys, touch, pause). */
'use strict';

/* ---------- canvas ---------- */
const arena = document.getElementById('arena');
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const tcv = document.getElementById('cv-text'), tctx = tcv.getContext('2d');   // floating numbers, drawn crisp on top
let W = 0, H = 0, playH = 0, first = true;

function resize() {
  const r = arena.getBoundingClientRect();
  // The CRT filter (display.js) draws the arena at 1/CRT.pixel resolution; the page scales it up with hard edges.
  const dpr = display.crt ? 1 / CRT.pixel : Math.min(window.devicePixelRatio || 1, 2);
  // the layout size, not the on-screen one: the CRT switch-on squashes the whole page for a moment
  // VW × VH is the view; W × H is the world. They're the same, except in co-op, where the world is bigger and
  // the view follows you round it (coop.js).
  VW = Math.max(1, arena.clientWidth); VH = Math.max(1, arena.clientHeight);
  // (a boss fight zooms the view out, so the world is the view ÷ the zoom: see VIEW below)
  if (NET.run && NET.world) { W = NET.world.w; H = NET.world.h; } else { W = VW / viewZoom; H = VH / viewZoom; }
  cv.width = Math.max(1, Math.round(VW * dpr)); cv.height = Math.max(1, Math.round(VH * dpr));
  ctx.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0);
  // the text layer stays at full resolution, so numbers read even under the CRT filter
  const tdpr = Math.min(window.devicePixelRatio || 1, 2);
  tcv.width = Math.round(VW * tdpr); tcv.height = Math.round(VH * tdpr);
  tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
  NET.viewSafe = bottomSafeY(r);
  playH = NET.run ? H : NET.viewSafe / viewZoom;
  // Centre the player once the arena has a real size (it can measure 0 before layout settles).
  if (first && W > 100 && H > 100) { game.player.x = W / 2; game.player.y = H / 2; first = false; }
  clampTo(game.player, PLAYER.r);
  for (const e of game.enemies) clampTo(e, e.r);
}
new ResizeObserver(resize).observe(arena);

/* ---------- boss arenas (v0.50, user: room to run far away from a boss) ----------
   While a boss is on (its intro, the fight, MAKORA's scenes) the view eases out to `VIEW.boss`: everything is drawn
   smaller and the arena grows round its middle to fill the screen (×1/0.7 each way, about twice the room). When the
   boss is gone it eases back and the walls close in again, pushing anything outside back in. In co-op the arena is
   already bigger than the screen, so there only the view zooms out (the world stays the same size). */
const VIEW = { boss: 0.7, rate: 2.4 };                 // rate: how fast it eases (per second)
let viewZoom = 1;
const bossArena = () => !game.practice && !game.inMenu && !!(game.intro || game.boss || game.obi || game.makora || game.cine);
function zoomStep(dt) {
  const want = bossArena() ? VIEW.boss : 1;
  if (viewZoom === want) return;
  let z = viewZoom + (want - viewZoom) * Math.min(1, dt * VIEW.rate);
  if (Math.abs(want - z) < 0.002) z = want;
  setZoom(z);
}
function setZoom(z) {
  viewZoom = z;
  if (NET.run) return;                                  // co-op: only the view (coop.js updateCam)
  const w0 = W, h0 = H;
  W = VW / z; H = VH / z; playH = NET.viewSafe / z;
  shiftWorld((W - w0) / 2, (H - h0) / 2);               // it grows (or shrinks) round its middle
}
function resetZoom() { viewZoom = 1; resize(); }
// Moves everything in the arena by (dx, dy), then keeps what must stay inside inside.
const WORLD_LISTS = ['enemies', 'projectiles', 'orbs', 'potions', 'diamonds', 'mines', 'rocks', 'cracks', 'rings', 'floaters', 'particles',
  'beams', 'sprays', 'trails', 'fields', 'summons', 'bombs', 'bites', 'muzzles', 'ghosts', 'swooshes', 'sabers', 'bolts', 'debris', 'boulders'];
const PAIRS = [['x', 'y'], ['x0', 'y0'], ['x1', 'y1'], ['x2', 'y2'], ['sx', 'sy'], ['px', 'py']];
function shiftObj(o, dx, dy) {
  if (!o || typeof o !== 'object') return;
  for (const [a, b] of PAIRS) if (typeof o[a] === 'number') { o[a] += dx; o[b] += dy; }
  if (Array.isArray(o.trail)) for (let i = 0; i + 1 < o.trail.length; i += 2) { o.trail[i] += dx; o.trail[i + 1] += dy; }
  for (const k of ['leap', 'kick']) if (o[k] && typeof o[k] === 'object') shiftObj(o[k], dx, dy);   // the lion's leap, MAKORA's kick
}
function shiftWorld(dx, dy) {
  if (!dx && !dy) return;
  for (const k of WORLD_LISTS) for (const o of game[k] || []) shiftObj(o, dx, dy);
  shiftObj(game.player, dx, dy);
  shiftObj(game.dash, dx, dy);
  clampTo(game.player, PLAYER.r);
  for (const e of game.enemies) if (!e.mrock) clampTo(e, e.r);
  for (const k of ['orbs', 'potions', 'diamonds', 'mines', 'boulders']) for (const o of game[k] || []) clampTo(o, o.r || 8);
}

// The HP/XP bars and ability deck float fixed over the bottom of the arena. Find the topmost
// edge of that cluster so play (player, enemies, orbs) stays clear of it instead of sliding
// underneath and out of sight.
function bottomSafeY(arenaRect) {
  const hudEls = [document.querySelector('.hp'), document.querySelector('.xp'), document.querySelector('.deck'), document.querySelector('.deck-status')].filter(Boolean);
  if (!hudEls.length) return VH;
  const topMost = Math.min(...hudEls.map(el => el.getBoundingClientRect().top));
  return Math.max(40, topMost - arenaRect.top - 12);
}

function clampTo(o, r) {
  o.x = Math.min(W - r, Math.max(r, o.x));
  o.y = Math.min((playH || H) - r, Math.max(r, o.y));
}

/* ---------- input ---------- */
const keys = new Set();
const MOVE = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('input')) return;      // the volume slider handles its own keys
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (game.inMenu) { onMenuKey(e); return; }
  if (game.over) return;
  if (game.practice && onPracticeKey(e)) return;   // the store's test mode: 1–3 fire, Esc goes back
  if (NET.run && e.code === 'KeyE') { NET.holdE = true; e.preventDefault(); return; }   // co-op: hold E to revive a friend who's down
  if (NET.run && !e.repeat) {                      // co-op: 1–3 pick a level-up card
    const d = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
    if (d && pickNow) { choosePick(+d[1] - 1); e.preventDefault(); return; }
  }
  if (game.choosing && onChoiceKey(e)) return;   // number keys (and Space on the wheel) pick; movement keys are still recorded
  if (e.target.closest && e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
  if (game.cine?.kind === 'summon' && !game.paused && (e.code === 'Space' || e.code === 'Enter')) { if (!e.repeat) skipIntro(); e.preventDefault(); return; }   // skip MAKORA's intro (user)
  if (MOVE[e.code]) { keys.add(e.code); e.preventDefault(); }
  if (e.code === 'Space') { if (!e.repeat) tryDash(); e.preventDefault(); }   // BULL relic (user: Space)
  if (e.code === 'KeyP') { if (!e.repeat) tryDeflect(); e.preventDefault(); }   // DEFLECT relic (user, v0.48: P)
  if (e.code === 'Escape') { togglePause(); e.preventDefault(); }             // pause (user: Esc)
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyE') NET.holdE = false; });
addEventListener('blur', () => { keys.clear(); NET.holdE = false; autoPause(); });
// Alt-tab, another window or a hidden tab pauses the run (user).
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); else releaseHold(); });
addEventListener('focus', releaseHold);
function autoPause() {
  if (NET.run) return;                               // co-op: the fight goes on for everyone
  if (game.inMenu || game.over || game.choosing || game.paused || game.practice || !deck) return;
  // During MAKORA's black-screen scenes it just holds, with no pause menu, and carries on when you come back
  // (v0.33, user: alt-tab there froze the scene, or a click landed on the pause menu hidden behind it)
  if (game.cine) { game.cineHold = true; return; }
  setPaused(true);
}
function releaseHold() {
  if (!game.cineHold || document.hidden) return;
  game.cineHold = false;
  last = performance.now();                          // no jump for the time away
}

let pointer = null;
arena.addEventListener('pointerdown', e => {
  if (!game.inMenu && pullTap()) return;              // OBI ONE's force pull: every tap fights it (obi.js)
  arena.setPointerCapture(e.pointerId);
  pointer = localPoint(e);
});
arena.addEventListener('pointermove', e => { if (pointer) pointer = localPoint(e); });
arena.addEventListener('pointerup', () => { pointer = null; });
arena.addEventListener('pointercancel', () => { pointer = null; });
function localPoint(e) {
  const r = arena.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

const pauseBtn = document.getElementById('pause');
const pauseMenu = document.getElementById('pause-menu');
pauseBtn.addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-exit').addEventListener('click', () => exitToTitle());
function togglePause() { if (!game.over && !game.choosing) setPaused(!game.paused); }
function setPaused(on) {
  game.paused = on;
  pauseBtn.textContent = on ? 'Resume' : 'Pause';
  pauseMenu.hidden = !on;
  keys.clear();
  if (on) document.getElementById('btn-resume').focus();
  else document.activeElement?.blur();
}
