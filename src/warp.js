/* warp.js — The title screen's stars (v0.57, user: "stars randomly zooming out of the centre", like flying through
   hyperspace; it replaced a black hole). Each star flies straight at you out of the middle (behind the logo), at its own
   speed, drawn as a streak from where it was a moment ago to where it is, so the near ones are long, thick and bright
   and the far ones short dots. A star that leaves the screen starts again far away. Only while the title shows. */
'use strict';

const WARP = {
  density: 6500,              // one star per this many square pixels of screen (within min..max; fewer, v0.57 user)
  min: 90, max: 280,
  depth: 3,                   // how far away a new star starts (1 = the screen's edge for the outermost)
  speed: [0.55, 1.5],         // how fast each star comes at you (depth a second)
  trail: 0.14,                // a streak's length, in seconds of travel
  spread: 2.6,                // how far out from the middle stars start (so streaks fill the whole screen)
};

const warp = { el: null, ctx: null, stars: [], w: 0, h: 0, dpr: 1, last: 0, still: false };

function warpStar(s, fresh) {
  const a = Math.random() * Math.PI * 2, r = 0.05 + Math.random() ** 0.55 * WARP.spread;
  s.x = Math.cos(a) * r; s.y = Math.sin(a) * r;
  s.z = fresh ? 0.08 + Math.random() * (WARP.depth - 0.08) : WARP.depth * (0.85 + Math.random() * 0.15);   // (new ones start far away, by the middle)
  s.v = WARP.speed[0] + Math.random() * (WARP.speed[1] - WARP.speed[0]);
  s.b = 0.45 + Math.random() * 0.55;                                         // how bright it gets
  s.tint = Math.random() < 0.82 ? '235, 242, 255' : Math.random() < 0.6 ? '170, 210, 255' : '255, 214, 170';
  return s;
}

function warpSize() {
  const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  if (w === warp.w && h === warp.h && dpr === warp.dpr) return;
  Object.assign(warp, { w, h, dpr });
  warp.el.width = Math.round(w * dpr); warp.el.height = Math.round(h * dpr);
  const n = Math.max(WARP.min, Math.min(WARP.max, Math.round(w * h / WARP.density)));
  while (warp.stars.length < n) warp.stars.push(warpStar({}, true));
  warp.stars.length = n;
}

function warpFrame(now) {
  requestAnimationFrame(warpFrame);
  const title = document.getElementById('scr-title'), menu = document.getElementById('menu');
  const on = title && !title.hidden && !title.classList.contains('is-loading') && menu && !menu.hidden;   // (not before the title is in)
  warp.el.hidden = !on;
  const dt = Math.max(0, Math.min(0.05, (now - (warp.last || now)) / 1000));
  warp.last = now;
  if (!on) return;
  warpSize();
  const { ctx, w, h, dpr } = warp;
  // the middle: across the screen's middle, at the logo's height
  const logo = title.querySelector('.title-logo')?.getBoundingClientRect();
  const cx = w / 2, cy = logo?.height ? logo.top + logo.height * 0.48 : h * 0.4, f = Math.max(w, h) * 0.5;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of warp.stars) {
    if (!warp.still) s.z -= s.v * dt;
    const x1 = cx + (s.x / s.z) * f, y1 = cy + (s.y / s.z) * f;
    if (s.z < 0.18 || x1 < -60 || x1 > w + 60 || y1 < -60 || y1 > h + 60) { warpStar(s, false); continue; }
    const zt = Math.min(WARP.depth * 1.1, s.z + s.v * WARP.trail);
    let x0 = cx + (s.x / zt) * f, y0 = cy + (s.y / zt) * f;
    const len = Math.hypot(x1 - x0, y1 - y0), cap = f * 0.22;            // (a streak never gets longer than this)
    if (len > cap) { x0 = x1 - (x1 - x0) * cap / len; y0 = y1 - (y1 - y0) * cap / len; }
    const near = 1 - s.z / WARP.depth;
    const alpha = s.b * Math.min(1, near * 4) * Math.min(1, near * 1.2 + 0.3);
    const lw = 0.8 + near ** 2 * 3.2 * s.b;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = `rgba(${s.tint}, ${(alpha * 0.14).toFixed(3)})`; ctx.lineWidth = lw * 3; ctx.stroke();   // its glow
    ctx.strokeStyle = `rgba(${s.tint}, ${alpha.toFixed(3)})`; ctx.lineWidth = lw; ctx.stroke();                 // and its core
  }
  ctx.globalCompositeOperation = 'source-over';
}

function startWarp() {
  warp.el = document.getElementById('title-warp');
  if (!warp.el) return;
  warp.ctx = warp.el.getContext('2d');
  warp.still = matchMedia('(prefers-reduced-motion: reduce)').matches;   // (still stars, no flying)
  requestAnimationFrame(warpFrame);
}
startWarp();
