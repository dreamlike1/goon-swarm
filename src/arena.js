/* arena.js — Canvas sizing and input (keys, touch, pause). */
'use strict';

/* ---------- canvas ---------- */
const arena = document.getElementById('arena');
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0, playH = 0, first = true;

function resize() {
  const r = arena.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  playH = bottomSafeY(r);
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
  if (!hudEls.length) return H;
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
  if (game.choosing && onChoiceKey(e)) return;   // number keys (and Space on the wheel) pick; movement keys are still recorded
  if (e.target.closest && e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
  if (MOVE[e.code]) { keys.add(e.code); e.preventDefault(); }
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) { tryDash(); e.preventDefault(); }   // BULL relic
  if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); autoPause(); });
// Alt-tab, another window or a hidden tab pauses the run (user).
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
function autoPause() {
  if (!game.inMenu && !game.over && !game.choosing && !game.paused && deck) setPaused(true);
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
