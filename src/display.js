/* display.js — The CRT filter (user): a low-res, pixelated look with an old TV screen over it, switched in the gear menu. */
'use strict';

/* With the filter on:
   - The arena is drawn at 1/`pixel` of the screen's resolution and scaled up with hard edges (arena.js), so the game
     world is chunky pixels. The menus and HUD switch to pixel fonts, and the logo to a 240 px wide copy blown up
     the same way.
   - A CRT screen sits over everything: scanlines, faint red/green/blue stripes, a gentle flicker and dark corners.
   - Turning the filter on switches the screen on like an old TV: a bright line that jumps and opens out, and a black
     screen that brightens. Loading the game doesn't (user), and turning the filter off is instant (user).
   - Text stays readable (user): small text uses Pixelify Sans, Silkscreen is kept for big headings and buttons, and
     the arena's floating numbers are drawn crisp on their own full-resolution layer (the `cv-text` canvas).
   After the reference the user shared: Lucas Bebber's "CSS CRT screen effect" on CodePen. Off: everything is back
   to the original full resolution. Saved on this computer (not in the game save), on by default. */
const DISPLAY_KEY = 'rogue.display';
const CRT = { pixel: 3, onMs: 2400 };
const display = { crt: true };
try {
  const d = JSON.parse(localStorage.getItem(DISPLAY_KEY) || 'null');
  if (d && typeof d.crt === 'boolean') display.crt = d.crt;
} catch (err) { /* defaults */ }
const rootEl = document.documentElement;
rootEl.classList.toggle('crt', display.crt);

function saveDisplay() {
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ crt: display.crt })); } catch (err) { /* not saved */ }
}

const crtSwitch = document.getElementById('crt-switch');
function renderDisplay() {
  crtSwitch.setAttribute('aria-checked', String(display.crt));
  crtSwitch.querySelector('.switch-state').textContent = display.crt ? 'On' : 'Off';
}

// The TV animation on the whole page: `crt-on` (switching on) or `crt-off` / `crt-back` (switching off).
let crtTimer = 0;
function crtAnim(name, ms, then) {
  rootEl.classList.remove('crt-on', 'crt-off', 'crt-back');
  clearTimeout(crtTimer);
  if (reducedMotionPref()) { then?.(); return; }
  void rootEl.offsetWidth;                                     // restart the animation if it's already on
  rootEl.classList.add(name);
  // measure the arena again once the page is back to its real size (the HUD's position is read from the screen)
  crtTimer = setTimeout(() => { rootEl.classList.remove(name); resize(); then?.(); }, ms);
}
const reducedMotionPref = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function setCrt(on) {
  if (on === display.crt) return;
  display.crt = on;
  saveDisplay();
  renderDisplay();
  if (on) {
    rootEl.classList.add('crt');
    resize();                                                  // the arena drops to its low resolution
    crtAnim('crt-on', CRT.onMs);
  } else {
    // straight back to full resolution, no animation (user)
    rootEl.classList.remove('crt-on', 'crt-off', 'crt-back', 'crt');
    clearTimeout(crtTimer);
    resize();
  }
}
crtSwitch.addEventListener('click', () => { setCrt(!display.crt); SFX.click(); });
renderDisplay();
// (No switch-on when the game loads, user: it opens straight onto the title. It plays only when you turn the filter on.)
