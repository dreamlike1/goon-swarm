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
  if (NET.run && NET.world) { W = NET.world.w; H = NET.world.h; } else { W = VW; H = VH; }
  cv.width = Math.max(1, Math.round(VW * dpr)); cv.height = Math.max(1, Math.round(VH * dpr));
  ctx.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0);
  // the text layer stays at full resolution, so numbers read even under the CRT filter
  const tdpr = Math.min(window.devicePixelRatio || 1, 2);
  tcv.width = Math.round(VW * tdpr); tcv.height = Math.round(VH * tdpr);
  tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
  NET.viewSafe = bottomSafeY(r);
  playH = NET.run ? H : NET.viewSafe;
  // Centre the player once the arena has a real size (it can measure 0 before layout settles).
  if (first && W > 100 && H > 100) { game.player.x = W / 2; game.player.y = H / 2; first = false; }
  clampTo(game.player, PLAYER.r);
  for (const e of game.enemies) clampTo(e, e.r);
}
new ResizeObserver(resize).observe(arena);

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
