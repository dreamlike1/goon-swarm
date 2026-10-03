/* deaths.js — How the bosses die (v0.54, user: death animations). AWAS THE SNEK has its own, the old game-over
   (snek.js); MAKORA never stays down (its wheel turns instead). */
'use strict';

/* When a boss's last bar runs out it doesn't vanish any more. It stays where it fell for a moment, out of the fight
   (it isn't an enemy now, nothing hits it or is hit by it), plays its death, and only then come the rewards
   (bossDown, obiDown: the gold, the XP orb and the relic). While it plays, the arena stays the boss's and the music
   fades out.
   - SKURTOSAURUS: it staggers, shaking and flashing, sparks bursting off it and a last roar; then it topples over
     onto its side, the ground breaks under it with a heavy thud, and it fades away in a cloud of dust.
   - OBI ONE: he staggers, flashing, his saber sputtering; it switches off, he sinks to his knees and fades away into
     blue light, like a Jedi becoming one with the force.
   Times in seconds. */
const DEATH = {
  boss: { time: 2.5, shake: 1.25, fall: [1.25, 1.7], fade: [1.85, 2.5] },
  obi: { time: 2.5, shake: 0.9, saberOff: 0.7, sink: [0.9, 1.6], fade: [1.2, 2.3] },
};

// combat.js hitEnemy: its HP is gone for good. It leaves the enemies (the caller took it out) and its fight ends.
function startDeath(e) {
  const kind = e.boss ? 'boss' : 'obi';
  game.dying = { kind, e, t: 0, puff: 0 };
  Object.assign(e, { state: 'rest', throwing: null, recoil: 0, hit: 0, sl: null, th: null, pull: null, vx: 0, vy: 0, kx: 0, ky: 0 });
  if (kind === 'boss') { game.boss = null; game.rocks = []; renderBossBar(); SFX.roar(); }
  else {
    game.obi = null; game.sabers = []; game.bolts = []; game.debris = [];
    bossBar.hidden = true; bossBar.classList.remove('is-obi', 'is-phase2');
    SFX.saberHum();
  }
  game.hitstop = Math.max(game.hitstop || 0, 0.18);
  game.shake = Math.max(game.shake, 0.35);
  game.rings.push({ x: e.x, y: e.y, r: e.r, max: e.r * 3, life: 0.5, color: COL.player });
}

// One frame of it (combat.js update: the rest of the fight carries on round it).
function updateDeath(dt) {
  const d = game.dying;
  if (!d) return;
  const e = d.e, D = DEATH[d.kind], was = d.t;
  d.t += dt;
  e.anim = (e.anim || 0) + dt * 0.4;
  const past = t => was < t && d.t >= t;
  if (d.kind === 'boss') {
    if (d.t < D.shake && (d.puff -= dt) <= 0) {                     // sparks bursting off it
      d.puff = 0.12;
      const a = Math.random() * TAU, q = Math.random() * e.r * 0.8;
      burst(e.x + Math.cos(a) * q, e.y + Math.sin(a) * q * 0.7, Math.random() < 0.5 ? COL.boss : COL.player, 8, 220);
      SFX.hit(true);
    }
    if (past(D.shake * 0.55)) SFX.roar();                            // the last roar
    if (past(D.fall[1])) {                                           // it hits the ground
      const feet = deathFeet(e);
      groundBreak(feet.x, feet.y, e.r * 1.2);
      burst(feet.x, feet.y, COL.rock, 40, 300);
      game.rings.push({ x: feet.x, y: feet.y, r: 10, max: e.r * 3.5, life: 0.6, color: COL.rock });
      game.shake = Math.max(game.shake, 0.55);
      SFX.stomp(4); SFX.boom();
    }
    if (d.t > D.fade[0] && !reducedMotion && Math.random() < dt * 40) {   // dust rising off it as it goes
      const f = deathFeet(e);
      game.particles.push({ x: f.x + (Math.random() - 0.5) * e.r * 2.4, y: f.y - Math.random() * e.r, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 60, life: 0.7, color: COL.rock });
    }
  } else {
    if (d.t < D.shake && (d.puff -= dt) <= 0) {
      d.puff = 0.1;
      burst(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, COL.saber, 6, 200);
      if (Math.random() < 0.5) SFX.saberClash();
    }
    if (past(D.saberOff)) { e.noSaber = true; SFX.saberOff(); burst(e.x + (e.face || 1) * e.r * 0.5, e.y, COL.saber, 24, 260); }
    if (d.t > D.sink[0] && !reducedMotion && Math.random() < dt * 50) {   // blue motes rising off him
      game.particles.push({ x: e.x + (Math.random() - 0.5) * e.r * 1.4, y: e.y + (Math.random() - 0.3) * e.r * 1.4, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 70, life: 0.9, color: Math.random() < 0.3 ? COL.saberCore : COL.saber });
    }
    if (past(D.fade[1] - 0.15)) { game.rings.push({ x: e.x, y: e.y, r: 10, max: e.r * 4, life: 0.7, color: COL.saber }); SFX.forceHum(3); }
  }
  if (d.t >= D.time) endDeath();
}
function endDeath() {
  const d = game.dying;
  game.dying = null;
  if (!d || NET.guest) return;
  if (d.kind === 'boss') bossDown(d.e); else obiDown(d.e);
}
// Where SKURTOSAURUS's feet are: what it topples over round.
const deathFeet = e => ({ x: e.x, y: e.y + (e.size || e.r) * 0.95 });
const ease = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/* ---------- drawing (draw.js) ---------- */
// The boss is drawn on its own layer (with the arena's view), so it can be turned, flashed white and faded as one.
const deathCv = document.createElement('canvas'), deathCtx = deathCv.getContext('2d');
function drawDeath() {
  const d = game.dying;
  if (!d) return;
  const e = d.e, D = DEATH[d.kind], t = d.t, main = ctx;
  if (deathCv.width !== cv.width || deathCv.height !== cv.height) { deathCv.width = cv.width; deathCv.height = cv.height; }
  const c = deathCtx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, deathCv.width, deathCv.height);
  c.setTransform(main.getTransform());
  let alpha = 1, white = 0, tint = 0;
  const jit = still => (reducedMotion || still ? 0 : (Math.random() - 0.5) * 6);
  if (d.kind === 'boss') {
    const shaking = t < D.shake, fall = ease(t, ...D.fall), f = deathFeet(e);
    if (shaking) c.translate(jit(), jit());
    if (fall > 0) {                                              // toppling onto its side, over its feet
      const back = -(e.flip || 1);
      c.translate(f.x, f.y); c.rotate(back * (Math.PI / 2) * fall * fall); c.translate(-f.x, -f.y);
    }
    white = shaking ? (Math.floor(t * 9) % 2 ? 0.75 : 0.15) : Math.max(0, 1 - (t - D.fall[1]) * 6) * 0.6;
    alpha = 1 - ease(t, ...D.fade);
  } else {
    const shaking = t < D.shake, sink = ease(t, ...D.sink);
    if (shaking) c.translate(jit(), jit() * 0.5);
    if (sink > 0) {                                              // down onto his knees
      const fy = e.y + (e.size || e.r) * 0.6;
      c.translate(e.x, fy); c.scale(1, 1 - 0.28 * sink); c.translate(-e.x, -fy);
    }
    white = shaking ? (Math.floor(t * 10) % 2 ? 0.7 : 0.1) : 0;
    tint = ease(t, D.sink[0], D.fade[1]);                        // turning to blue light …
    alpha = 1 - ease(t, ...D.fade) ** 1.4;                       // … and fading out
  }
  ctx = c;                                                       // (the boss's drawing goes to `ctx`)
  try { if (d.kind === 'boss') drawBoss(e); else drawObi(e); } finally { ctx = main; }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  if (tint > 0) { c.globalAlpha = 0.75 * tint; c.fillStyle = COL.saber; c.fillRect(0, 0, deathCv.width, deathCv.height); }
  if (white > 0) { c.globalAlpha = white; c.fillStyle = COL.player; c.fillRect(0, 0, deathCv.width, deathCv.height); }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  if (alpha <= 0) return;
  main.save();
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalAlpha = alpha;
  if (tint > 0.3) main.globalCompositeOperation = 'lighter';    // the force ghost glows
  main.drawImage(deathCv, 0, 0);
  main.restore();
}
