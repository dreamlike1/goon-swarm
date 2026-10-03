/* draw.js — Canvas drawing: basic shapes plus effects. */
'use strict';

/* ---------- drawing ---------- */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

const TAU = Math.PI * 2;
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }

/* ---------- the glow (v0.55, user: "as clean as the effect creator's examples") ----------
   Light adds up: shots, sparks, rings and hit flashes are drawn with 'lighter' over a soft glow, the way the effect
   creator's Fire bolt was. The glow is a radial gradient drawn once per colour and reused (cheap enough for every shot).
   Dark colours (rock, ink) don't glow; on AWAS's phone screen nothing does (it'd turn to ink blobs). */
const FX_GLOW = new Map(), FX_BRIGHT = new Map();
function fxRgb(c) {
  if (!c || c[0] !== '#') return null;
  const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
// Bright enough to glow (and to add up as light)?
function fxBright(c) {
  if (!FX_BRIGHT.has(c)) { const v = fxRgb(c); FX_BRIGHT.set(c, !!v && (0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2]) / 255 > 0.32); }
  return FX_BRIGHT.get(c);
}
function fxGlowSprite(c) {
  let cv2 = FX_GLOW.get(c);
  if (cv2) return cv2;
  const v = fxRgb(c) || [255, 255, 255], R = 64;
  cv2 = document.createElement('canvas'); cv2.width = cv2.height = R * 2;
  const g = cv2.getContext('2d'), gr = g.createRadialGradient(R, R, 0, R, R, R);
  gr.addColorStop(0, `rgba(${v.join(',')},0.85)`); gr.addColorStop(0.3, `rgba(${v.join(',')},0.38)`); gr.addColorStop(1, `rgba(${v.join(',')},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2);
  FX_GLOW.set(c, cv2);
  return cv2;
}
// A soft glow of colour `c`, radius `r`, at strength `a`.
function fxGlow(x, y, r, c, a = 1) {
  if (lcdState || !(r > 0) || !fxBright(c) || a <= 0) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(fxGlowSprite(c), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga;
}
const fxAdd = c => { if (!lcdState && fxBright(c)) ctx.globalCompositeOperation = 'lighter'; };
const fxNormal = () => { ctx.globalCompositeOperation = 'source-over'; };

// Ready to use (user): while a relic's cooldown is done, your circle itself lights up in its colour, fading in and
// out (BULL orange, DEFLECT blue, VAMPIRIC BALLSACK crimson; more than one ready, they take turns). Not while you're using it: the charge and the shield
// draw their own.
function drawRelicReady(p) {
  const cols = [];
  if (game.relics.includes('bull') && !(game.dashCd > 0)) cols.push(COL.relic);
  if (game.relics.includes('deflect') && !(game.deflCd > 0) && !(game.defl > 0)) cols.push(COL.deflect);
  if (sackReady()) cols.push(COL.sack);
  if (!cols.length) return;
  const T = 1.2, t = performance.now() / 1000;
  const glow = reducedMotion ? 0.35 : 0.6 * (0.5 - 0.5 * Math.cos(t * TAU / T));
  ctx.globalAlpha = glow; ctx.fillStyle = cols[Math.floor(t / T) % cols.length];
  circle(p.x, p.y, PLAYER.r);
  ctx.globalAlpha = 1;
}

// A lumpy rock (SKURTOSAURUS throws these).
function rockShape(x, y, r, spin) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  ctx.fillStyle = COL.rock;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rr = r * (0.8 + 0.25 * ((i * 37) % 5) / 4); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

/* ---------- SKURTOSAURUS ----------
   A side-on cartoon T-rex (user's reference): big round head with a smile, tiny arms, a thick tail that
   curls up, two sturdy legs. It's drawn facing right in a 30-unit frame (origin = the middle of its body,
   feet at y ≈ 32) and flipped to face the player. Poses: walking, throwing (rears back with a rock, then
   flings it), winding up a charge (crouches, paws the ground, angry eye), charging (leans in, legs a blur,
   mouth open) and resting (head down, panting). */
function dinoLeg(hx, hy, ph, stride, col, near) {
  const sw = Math.sin(ph) * 7 * stride, lift = Math.max(0, -Math.cos(ph)) * 5 * stride;
  const ax = hx - 3 + sw, fy = 30 - lift;
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ellipse(hx, hy, 10, 12, -0.25);                                                        // thigh
  ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(hx + 1, hy + 6); ctx.lineTo(ax, fy - 2); ctx.stroke();   // shin
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ax - 2, fy); ctx.lineTo(ax + 10, fy); ctx.stroke();      // foot
  if (near) {                                                                            // the thigh's outline, cut into the body
    ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(hx - 9, hy + 7); ctx.quadraticCurveTo(hx - 2, hy + 13, hx + 3, hy + 11);
    ctx.quadraticCurveTo(hx + 11, hy + 2, hx + 5, hy - 11); ctx.stroke();
  }
}
// A horn, like the user's picture: short, the dino's own colour, rising from the top of the skull and curving
// out and up like a bull's. `sx`: which way it leans (+1 forward, −1 back). `seam`: a thin line where it meets the head.
function dinoHorn(bx, by, sx, col, seam) {
  ctx.save(); ctx.translate(bx, by); ctx.scale(sx, 1);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-4.5, 1);
  ctx.quadraticCurveTo(3, -3, 7, -15);       // inner edge (the hollow of the curve), up to the tip
  ctx.quadraticCurveTo(10.5, -5, 4.5, 0);    // outer edge, back down to the skull
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();   // rounds the tip off, as in the picture
  if (seam) {
    ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3.5, 0.5); ctx.quadraticCurveTo(0.5, -2, 4.5, 0); ctx.stroke();
  }
  ctx.restore();
}
// A tiny arm from the shoulder. `raise`: 0 hangs, 1 holds a rock up at the chest, −1 flung forward.
function dinoArm(x, y, raise, col) {
  const up = Math.max(0, raise), fling = Math.max(0, -raise);
  const ex = x + 5 + fling * 3, ey = y + 3 - up * 6 - fling * 3;
  const hx = ex + 4 + fling * 4, hy = ey + 3 - up * 5 - fling * 3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Drawn twice: a wider floor-coloured pass first, so the arm reads as cut out from the body (like the reference).
  for (const [c, w] of [[COL.floor, 2.4], [col, 0]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 3.6 + w; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.lineWidth = 1.6 + w; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 2.5, hy + 1.5); ctx.moveTo(hx, hy); ctx.lineTo(hx + 1, hy + 3); ctx.stroke();
  }
  ctx.strokeStyle = col; ctx.lineWidth = 3.6;                // the upper arm stays joined to the chest
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
}

// A dasher's warning while it winds up (SKURTOSAURUS and the crabs): a faint band as wide as it is and a thick
// dashed line with an arrowhead, down where the charge will go (user: thicker).
function chargeAim(b) {
  const len = b.boss ? BOSS.chargeSpeed * BOSS.charge : RAPTOR.dashSpeed * RAPTOR.dash * enemySpeedMul(game.level);
  const blink = 0.35 + 0.35 * Math.sin(b.t * 30);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.dir);
  ctx.fillStyle = COL.bad;
  ctx.globalAlpha = 0.12; ctx.fillRect(0, -b.r * 0.8, len, b.r * 1.6);
  ctx.globalAlpha = 0.3 + blink; ctx.strokeStyle = COL.bad; ctx.lineCap = 'round';
  ctx.lineWidth = b.boss ? 9 : 5; ctx.setLineDash(b.boss ? [22, 14] : [12, 9]);
  ctx.beginPath(); ctx.moveTo(b.r * 0.5, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = b.boss ? 6 : 4; ctx.lineJoin = 'round';          // an arrowhead at the end
  const h = b.boss ? 16 : 9;
  ctx.beginPath(); ctx.moveTo(len - h, -h); ctx.lineTo(len, 0); ctx.lineTo(len - h, h); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}
// Speed lines streaming off behind a charge.
function chargeLines(b) {
  const cx = Math.cos(b.dir), cy = Math.sin(b.dir);
  ctx.strokeStyle = COL.player; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const off = i * 11 * (b.r / 30), j = reducedMotion ? 0 : Math.random() * 14, bx = b.x - cx * (b.r + 4) - cy * off, by = b.y - cy * (b.r + 4) + cx * off;
    ctx.globalAlpha = 0.25 + (2 - Math.abs(i)) * 0.1;
    const l = (26 + j) * (b.boss ? 1 : 0.5);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - cx * l, by - cy * l); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// v0.71 (user: "revert back the dinosaur and obi; just the effects should be 3D"): SKURTOSAURUS is drawn flat, as
// before v0.70, and once three.js is in, its effects are 3D on top (boss3d.js b3Skurt): burning eyes, the charge's
// streak, the roar's rings, the landing's shockwave, the throw's flash.
function drawBoss(b) {
  drawBossFlat(b);
  if (b.boss && typeof b3Ok === 'function' && b3Ok()) b3Skurt(b);
}
function drawBossFlat(b) {
  const s = (b.size || b.r) * (0.5 + 0.5 * b.born), k = s / 30, t = b.anim, st = b.state, still = reducedMotion;
  if (st === 'windup') chargeAim(b);
  if (b.boss && b.throwing != null) {      // the big rock's lane: a red band down the line it'll be thrown, filling as it winds up
    const q = Math.min(1, b.throwing / BOSS.throwWind), a = b.throwA ?? b.face, w = BOSS.bigRock.r * 2 + 8, L = Math.hypot(W, H);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.fillStyle = COL.bad;
    ctx.globalAlpha = 0.1 + 0.12 * q; ctx.fillRect(b.r * 0.6, -w / 2, L, w);
    ctx.globalAlpha = 0.35 + 0.4 * q; ctx.fillRect(b.r * 0.6, -w / 2, L * q, 2); ctx.fillRect(b.r * 0.6, w / 2 - 2, L * q, 2);   // edges racing out
    ctx.globalAlpha = (0.4 + 0.5 * q) * (reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(b.throwing * 30));
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {                                         // chevrons pointing down the lane
      const x = b.r + 30 + k * 34;
      ctx.beginPath(); ctx.moveTo(x - 7, -8); ctx.lineTo(x + 3, 0); ctx.lineTo(x - 7, 8); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  if (st === 'charge') chargeLines(b);

  if (b.phase === 2) {                      // phase 2: a pulsing red heat around it
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6), R = b.r * (1.5 + 0.15 * pulse);
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.3, b.x, b.y, R);
    g.addColorStop(0, 'rgba(255, 60, 60, 0)'); g.addColorStop(0.55, `rgba(255, 60, 60, ${0.16 + 0.12 * pulse})`); g.addColorStop(1, 'rgba(255, 60, 60, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
  }

  // Pose, from its state.
  const facing = b.flip || (st === 'charge' || st === 'windup' ? Math.cos(b.dir) : game.player.x - b.x);   // the side its hitbox's head is on (boss.js sizeBoss)
  let lean = 0, crouch = 0, jaw = 0, head = 0, arm = 0, hold = 0, stride = 0, tail = still ? 0 : Math.sin(t * 3) * 3, fury = false;
  let nearPh = b.step, farPh = b.step + Math.PI, nearStride = 0;
  if (st === 'walk') {
    stride = nearStride = 1;
    head = Math.sin(b.step * 2) * 0.03;
    if (b.throwing != null) {                               // rearing back, rock held up in its tiny arms
      const q = Math.min(1, b.throwing / (b.wind || BOSS.throwWind));
      stride = nearStride = 0; lean = -0.24 * q; head = -0.18 * q; arm = q; hold = q; jaw = 0.1 * q; tail += 5 * q;
    } else if (b.recoil > 0) {                              // the fling: lunges forward, mouth open
      const q = b.recoil / BOSS.throwRecover;
      lean = 0.24 * q; head = 0.14 * q; jaw = 0.6 * q; arm = -q;
    }
  } else if (st === 'windup') {                             // crouched, pawing the ground with its front foot, snorting
    crouch = 3; lean = 0.14; head = 0.1; fury = true; tail = -5 + (still ? 0 : Math.sin(t * 22) * 2);
    jaw = 0.1 + (still ? 0 : 0.08 * Math.sin(t * 30));
    nearPh = t * 16; nearStride = 0.8; farPh = 0;
  } else if (st === 'charge') {
    stride = nearStride = 1.7; lean = 0.32; jaw = 0.45; head = 0.05; tail = 12; fury = true;
  } else if (st === 'jump') {                               // in the air: tail up, mouth open, feet tucked
    lean = -0.14; jaw = 0.4; head = -0.08; tail = 8; fury = true;
  } else if (st === 'enrage') {                             // phase 2: rears back and roars at the sky, shaking
    lean = -0.3; head = -0.35; jaw = 0.95; arm = 0.6; tail = 14 + (still ? 0 : Math.sin(t * 40) * 3); fury = true;
  } else {                                                  // rest: head down, panting
    lean = 0.1; head = 0.22; tail = 5; jaw = 0.18 + (still ? 0 : 0.14 * Math.sin(t * 14));
  }
  const bob = stride && !still ? Math.abs(Math.sin(b.step)) * 1.6 : 0;
  const jit = (st === 'windup' || st === 'enrage') && !still ? (Math.random() - 0.5) * (st === 'enrage' ? 4 : 2) : 0;
  if (b.phase === 2) fury = true;                            // phase 2: red eyes the whole time
  const body = b.hit > 0 ? COL.player : b.boss ? COL.boss : COL.enemy, dark = b.hit > 0 ? COL.player : b.boss ? COL.bossDark : COL.big;

  ctx.save();
  ctx.translate(b.x + jit, b.y); ctx.scale((facing < 0 ? -1 : 1) * k, k);
  // in a jump it rises off its shadow, which shrinks under it
  const air = st === 'jump' ? Math.sin(Math.PI * Math.min(1, 1 - b.t / BOSS.jump)) : 0;
  ctx.globalAlpha = 0.3 - air * 0.12; ctx.fillStyle = '#000'; ellipse(0, 32, 28 * (1 - air * 0.4), 6 * (1 - air * 0.4)); ctx.globalAlpha = 1;   // shadow
  if (air) ctx.translate(0, -air * BOSS.jumpHeight / k);
  boneMark(b, 'root');                                       // its hitbox's parts (combat.js): the legs, up in a jump …
  dinoLeg(-5, 10 + crouch, farPh, stride, dark, false);                                         // far leg

  ctx.save();                                                // everything above the legs tilts around the hip
  ctx.translate(0, 10 + crouch - bob); ctx.rotate(lean); ctx.translate(0, -10);
  boneMark(b, 'body');                                       // … the body, tail and neck, leaning …
  ctx.fillStyle = body;
  const tipY = -20 + tail;                                   // tail: thick at the hip, curling up to a round tip
  {                                                          // its hitbox part (v0.52, user: the tail's shapes follow it):
    // the body's frame, turned and stretched round the tail's root so its tip goes from where it is at rest to here
    const r0 = Math.atan2(-12, -38), r1 = Math.atan2(tipY + 8, -38), s1 = Math.hypot(-38, tipY + 8) / Math.hypot(-38, -12);
    ctx.save(); ctx.translate(-6, -8); ctx.rotate(r1 - r0); ctx.scale(s1, s1); ctx.translate(6, 8); boneMark(b, 'tail'); ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-6, -8);
  ctx.quadraticCurveTo(-26, -4, -44, tipY);
  ctx.quadraticCurveTo(-47, tipY + 4, -43, tipY + 5);
  ctx.quadraticCurveTo(-30, 14, -2, 14);
  bonePaint(b, 'tail'); ctx.closePath(); ctx.fill(); bonePaint(b, 'body');   // (the editor's part view: the tail is its own part)
  ellipse(3, 2, 18, 15, -0.35);                              // body
  ellipse(11, -12, 9, 13, 0.3);                              // neck

  ctx.save();                                                // head, nodding around the top of the neck
  ctx.translate(12, -20); ctx.rotate(head); ctx.translate(-12, 20);
  boneMark(b, 'head');                                       // … and the head, nodding
  b.pins = {};                                               // where the 3D effects go (boss3d.js fxPin)
  fxPin(b, 'eye', 22.6, -31); fxPin(b, 'mouth', 33, -22); fxPin(b, 'chest', 10, -2);
  const ja = jaw * 0.6, jc = Math.cos(ja), js = Math.sin(ja);
  if (jaw > 0.04) {                                          // inside of the open mouth
    ctx.fillStyle = COL.floor;
    ctx.beginPath(); ctx.moveTo(14, -22); ctx.lineTo(34, -24); ctx.lineTo(14 + 21 * jc - 1 * js, -21 + 21 * js + 1 * jc); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.save(); ctx.translate(14, -21); ctx.rotate(ja); ellipse(10, 1.5, 12, 4.5); ctx.restore();   // lower jaw
  ellipse(18, -30, 13, 10, -0.15);                           // skull
  ellipse(28, -26, 9.5, 7, 0.1);                             // snout
  dinoHorn(11, -36.5, -1, body, true); dinoHorn(25, -37.5, 1, body, false);   // two horns curving out (user's picture)
  ctx.fillStyle = body;
  ctx.strokeStyle = COL.floor; ctx.lineCap = 'round';
  if (jaw < 0.15) {                                          // the smile
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(16, -22); ctx.quadraticCurveTo(25, -17, 33, -23); ctx.stroke();
  }
  ctx.fillStyle = COL.floor; circle(35, -28, 0.9);           // nostril
  ctx.fillStyle = COL.bossEye; circle(22, -31, 2.8);         // eye
  if (fury) {                                                // red eye and a frown when it's about to charge
    ctx.fillStyle = COL.bad; circle(22.6, -31, 1.5);
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(17.5, -36); ctx.lineTo(25.5, -33.5); ctx.stroke();
  }
  ctx.restore();

  dinoArm(12, -6, arm, dark);                                // far arm, a little behind
  // the rock it's about to throw (SKURTOSAURUS: the big one, held up at its chest)
  if (hold > 0) rockShape(25, -12 - 4 * hold, b.boss ? (BOSS.bigRock.r / k) * (0.6 + 0.4 * hold) : 4 + 3 * hold, t * 2);
  dinoArm(15, -4, arm, body);                                // near arm
  fxPin(b, 'hand', 24, -10);
  ctx.restore();

  dinoLeg(2, 10 + crouch, nearPh, nearStride, body, true);   // near leg
  ctx.restore();
}

// Chilled by the Cryo Magus (v0.46, user: no circle, but it should look slowed): its own colour, frosted over toward
// ice. Cached per colour.
const chillCache = new Map();
function chilled(c) {
  if (chillCache.has(c)) return chillCache.get(c);
  const hex = s => (/^#[0-9a-f]{6}$/i.test(s) ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : null);
  const a = hex(c), b = hex(COL.frozen), out = a && b ? `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * 0.62)).join(',')})` : c;
  chillCache.set(c, out);
  return out;
}

// A lunger (v0.52) lighting up before its dash: it brightens toward pale gold, with a halo that grows, and a faint lane
// shows where it'll go (it blinks faster once the aim has locked). Drawn in the square's own frame.
const lungerLit = e => e.state === 'glow' ? 1 - Math.max(0, e.t) / LUNGER.glow : e.state === 'dash' ? 1 : 0;
function drawLungerGlow(e, s) {
  const q = lungerLit(e);
  if (!q) return;
  ctx.fillStyle = COL.lungerHi;
  ctx.globalAlpha = 0.18 * q; ctx.fillRect(-s * (1.3 + 0.4 * q), -s * (1.3 + 0.4 * q), s * (2.6 + 0.8 * q), s * (2.6 + 0.8 * q));
  ctx.globalAlpha = q * 0.85; ctx.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
  ctx.globalAlpha = 1;
}
function lungerAim(e) {
  const len = LUNGER.speed * LUNGER.dash * enemySpeedMul(game.level), locked = e.t <= LUNGER.glow * (1 - LUNGER.lock);
  const blink = reducedMotion ? 0.3 : 0.25 + 0.25 * Math.sin(e.t * (locked ? 40 : 18));
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.dir);
  ctx.fillStyle = COL.lunger; ctx.globalAlpha = 0.1; ctx.fillRect(0, -e.r, len, e.r * 2);
  ctx.strokeStyle = COL.lungerHi; ctx.globalAlpha = 0.25 + blink; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore(); ctx.globalAlpha = 1;
}

/* ---------- the crab (v0.46, user's picture; the mini dino before) ----------
   Front on, in a 17-unit frame (origin = the middle of its shell): a wide glossy orange-red shell with a little smile,
   two pincers held up and three legs a side (v0.46, user: no eyes, and half the size). It keeps the mini dino's moves:
   it scuttles in (legs ticking, bobbing), and when it winds up a dash it shakes and snaps its pincers; in the dash it
   squashes flat and its legs blur. Chilled by the Cryo Magus, it turns icy and moves in slow motion. */
function crabClaw(side, open, lift, col, hi) {
  // one pincer: the arm, then a round palm with two fingers that open and close (`open` 0–1)
  ctx.save(); ctx.scale(side, 1);
  const ax = 27, ay = -19 - lift;
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(24, -8, ax, ay + 4); ctx.stroke();
  ctx.fillStyle = col;
  ellipse(ax, ay, 9.5, 8.5);                                             // palm
  ctx.save(); ctx.translate(ax + 4, ay - 4); ctx.rotate(0.35 + open * 0.5); ellipse(0, -6, 5, 8); ctx.restore();    // outer finger
  ctx.save(); ctx.translate(ax - 4, ay - 4); ctx.rotate(-0.35 - open * 0.5); ellipse(0, -5, 4, 6.5); ctx.restore(); // inner finger
  ctx.fillStyle = hi; ctx.globalAlpha *= 0.55; ellipse(ax - 4, ay + 1, 2.5, 4, 0.5); ctx.globalAlpha /= 0.55;       // shine
  ctx.restore();
}
function drawCrab(e) {
  const s = e.r * (0.5 + 0.5 * e.born), k = s / 17, t = e.anim || 0, st = e.state, still = reducedMotion;
  if (st === 'windup') chargeAim(e);
  if (st === 'charge') chargeLines(e);
  const hit = e.hit > 0, cold = e.chill > 0;
  const body = hit ? COL.player : cold ? chilled(COL.crab) : COL.crab, dark = hit ? COL.player : cold ? chilled(COL.crabDark) : COL.crabDark, hi = cold ? chilled(COL.crabHi) : COL.crabHi;
  const walking = st === 'walk';
  const step = e.step || 0, bob = walking && !still ? Math.abs(Math.sin(step)) * 1.5 : 0;
  const jit = st === 'windup' && !still ? (Math.random() - 0.5) * 2.4 : 0;
  const squash = st === 'charge' ? 0.84 : st === 'rest' ? 0.94 : 1;       // flat in a dash, sagging while it rests
  // pincers: up and slowly opening and closing as it walks; snapping fast in a wind-up; tucked in a dash
  const tt = cold ? t * SILICA.cryo.slow : t;                             // chilled: everything in slow motion
  const open = still ? 0.4 : st === 'windup' ? 0.5 + 0.5 * Math.sin(tt * 40) : st === 'charge' ? 0 : 0.35 + 0.25 * Math.sin(tt * 4);
  const lift = st === 'windup' ? 4 : st === 'charge' ? -6 : st === 'rest' ? -3 : 0;

  ctx.save();
  ctx.translate(e.x + jit, e.y); ctx.scale(k, k);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(0, 20, 26, 5); ctx.globalAlpha = 1;   // shadow
  ctx.translate(0, -bob); ctx.scale(1 / squash, squash);

  // legs: three a side, behind the shell, ticking in turn as it walks (a blur in a dash)
  ctx.strokeStyle = dark; ctx.lineCap = 'round';
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const ph = step * (st === 'charge' ? 1.6 : 1) + i * 2.1 + (side > 0 ? Math.PI : 0);
    const kick = walking || st === 'charge' ? Math.sin(ph) * 2.5 : 0, rise = walking ? Math.max(0, Math.cos(ph)) * 2.5 : 0;
    const hx = side * 17, hy = 1 + i * 5.5, fx = side * (29 + i * 1.5) + kick * side, fy = 9 + i * 5 - rise;
    ctx.lineWidth = 8; ctx.strokeStyle = i === 1 ? dark : body;          // chunky, like the picture; the middle one a shade darker
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(side * 27, hy - 2, fx, fy); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = hi; ctx.globalAlpha = 0.55;       // a shine along each
    ctx.beginPath(); ctx.moveTo(side * 22, hy - 2); ctx.quadraticCurveTo(side * 26, hy - 2.6, side * 27.5, hy); ctx.stroke(); ctx.globalAlpha = 1;
  }

  crabClaw(-1, open, lift, body, hi); crabClaw(1, open, lift, body, hi);

  // the shell: a wide oval, a darker lower half and a glossy highlight up and to the left
  ctx.fillStyle = body; ellipse(0, 0, 22, 17);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 22, 17, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = dark; ctx.globalAlpha = hit ? 0 : 0.35; ellipse(6, 12, 24, 12, -0.25); ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = hi; ctx.globalAlpha = 0.6; ellipse(-9, -7, 8, 4, -0.45); ctx.globalAlpha = 1;
  ctx.strokeStyle = COL.crabPupil; ctx.lineWidth = 1.6; ctx.lineCap = 'round';   // the smile (an O while it dashes)
  if (st === 'charge') { ctx.fillStyle = COL.crabPupil; ellipse(0, -5, 2.2, 2.6); }
  else { ctx.beginPath(); ctx.moveTo(-3.2, -6.5); ctx.quadraticCurveTo(0, -3.4, 3.2, -6.5); ctx.stroke(); }
  ctx.restore();
}

// The store's test dummy: a target on a post, which flashes when hit.
function drawDummy(e) {
  const r = e.r, hit = e.hit > 0;
  ctx.fillStyle = COL.line; ctx.fillRect(e.x - 3, e.y, 6, r * 1.6);                 // post
  ctx.fillRect(e.x - r * 0.7, e.y + r * 1.5, r * 1.4, 4);                           // foot
  const rings = [COL.text, COL.bad, COL.text, COL.bad];
  rings.forEach((c, i) => { ctx.fillStyle = hit ? COL.player : c; circle(e.x, e.y, r * (1 - i * 0.24)); });
  ctx.fillStyle = hit ? COL.bad : COL.floor; circle(e.x, e.y, r * 0.12);
}

// The boss arena's wall (v0.50, user: a visible boundary): a glowing edge round the arena in the boss's own colour,
// with an energy dash running along it and bright brackets at the corners. It fades in as the view zooms out for the
// fight (arena.js) and out again after. `f`: how far in (0–1).
const arenaWall = () => (game.practice || game.inMenu ? 0 : Math.max(0, Math.min(1, (viewZoom - VIEW.normal) / (VIEW.boss - VIEW.normal))));
function wallColor() {
  const o = game.obi, b = game.boss;
  if (game.makora || game.cine) return COL.wheel;
  if (o) return o.phase >= 2 ? COL.saberBad : COL.saber;
  if (game.intro?.kind === 'obi') return COL.saber;
  if (b) return b.phase === 2 ? COL.bad : COL.boss;
  return game.intro ? COL.boss : null;               // (none: it keeps the last one as it fades out)
}
let wallLast = null;
function drawArenaWall(f) {
  const col = (wallLast = wallColor() || wallLast || COL.line), t = performance.now() / 1000, still = reducedMotion;
  const i = 5, x0 = i, y0 = i, w = W - 2 * i, h = (NET.run || arenaMode === 'boss' ? H : Math.min(playH || H, H)) - 2 * i;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.strokeStyle = col;
  ctx.globalAlpha = f * 0.12; ctx.lineWidth = 44; ctx.strokeRect(x0, y0, w, h);          // the glow, soft and wide …
  ctx.globalAlpha = f * 0.22; ctx.lineWidth = 18; ctx.strokeRect(x0, y0, w, h);
  ctx.globalAlpha = f * (0.85 + 0.15 * pulse); ctx.lineWidth = 7; ctx.strokeRect(x0, y0, w, h);   // … the wall itself …
  ctx.globalAlpha = f * 0.7; ctx.lineWidth = 3; ctx.setLineDash([22, 16]);                 // … energy running round it …
  ctx.lineDashOffset = still ? 0 : -t * 60; ctx.strokeRect(x0 + 9, y0 + 9, w - 18, h - 18);
  ctx.setLineDash([]);
  ctx.globalAlpha = f; ctx.lineWidth = 9; ctx.lineCap = 'round';                            // … and brackets at the corners
  const L = Math.min(70, w / 6, h / 6);
  for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); ctx.stroke();
  }
  ctx.restore();
}

// Laser zaps: a wide soft glow with a thin bright core, flickering as it fades.
function drawBeam(x1, y1, x2, y2, k, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color; ctx.globalAlpha = 0.3 * k; ctx.lineWidth = w * 3.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = k; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = COL.player; ctx.globalAlpha = 0.9 * k; ctx.lineWidth = Math.max(1, w * 0.35);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.globalAlpha = 1;
}

// A water spray (the Powerwash pack), drawn along local +x out to `len`, `w1` wide at the front. v0.55 (user: "more
// fluid, like actual water"): smooth, rippling outlines in place of the old straight-edged polygon. Ripples run out
// along its edges, streaks of light rush down the middle, foam churns at the front and drops fly off it, all
// adding up as light, over a mist. `seed` keeps one spray's shape steady frame to frame; `alpha` fades it.
// The golden-ratio steps give each drop and blob of foam a steady, well-spread "random" place without Math.random().
const WATER = { strands: [-0.5, -0.18, 0.12, 0.42], drops: 14, foam: 7 };
function smoothShape(pts) {                     // a closed outline through `pts`, curved through their midpoints: liquid
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s0 = mid(pts[n - 1], pts[0]);
  ctx.beginPath(); ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  ctx.closePath();
}
function waterSpray(len, w1, col, seed, alpha = 1) {
  if (!(len > 4) || alpha <= 0) return;
  const t = reducedMotion ? 0 : performance.now() / 1000, w0 = Math.min(4, w1 * 0.2), N = 16;
  const prof = u => w0 + (w1 - w0) * Math.sin(Math.min(1, u) * Math.PI / 2) ** 1.3;   // pinched at the nozzle, full at the front
  const edge = (u, k, ph) => {                  // the edge at u (k: how far out, signed): waves that travel out along it
    const wave = 0.13 * Math.sin(u * 10 - t * 24 + seed + ph) + 0.06 * Math.sin(u * 23 - t * 41 + seed * 1.7 + ph);
    return prof(u) * k * (1 + wave * Math.min(1, u * 2.5));
  };
  const body = (k, reach, ph) => {              // one side out, a rounded wobbling front, the other side back
    const pts = [], L = len * reach, R = prof(1) * k;
    for (let i = 0; i <= N; i++) pts.push([i / N * L, edge(i / N, -k, ph)]);
    for (let i = 1; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 6, wob = 1 + 0.16 * Math.sin(a * 4 + t * 18 + seed + ph);
      pts.push([L + Math.cos(a) * Math.min(R * 0.45, len * 0.25) * wob, Math.sin(a) * R * wob]);
    }
    for (let i = N; i >= 0; i--) pts.push([i / N * L, edge(i / N, k, ph + 2.1)]);
    smoothShape(pts); ctx.fill();
  };
  const R = prof(1);
  fxGlow(len * 0.75, 0, Math.max(w1 * 1.5, len * 0.4) + 10, col, 0.5 * alpha);   // mist round it
  fxAdd(col);
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.24 * alpha; body(1.15, 1.03, 0);       // the thin outer sheet of spray
  ctx.globalAlpha = 0.38 * alpha; body(0.8, 0.97, 1.3);      // the jet
  ctx.fillStyle = COL.player;
  ctx.globalAlpha = 0.26 * alpha; body(0.32, 0.9, 2.6);      // its glassy core
  ctx.strokeStyle = COL.player; ctx.lineCap = 'round';      // streaks of light rushing out down the jet
  WATER.strands.forEach((off, s) => {
    ctx.globalAlpha = (0.6 - Math.abs(off) * 0.6) * alpha; ctx.lineWidth = 0.8 + (1 - Math.abs(off)) * 1.4;
    ctx.setLineDash([len * 0.14, len * 0.1]); ctx.lineDashOffset = -(t * 560 + s * 41 + seed * 23);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) ctx[i ? 'lineTo' : 'moveTo'](i / N * len * 0.94, edge(i / N, off * 0.85, s * 1.7));
    ctx.stroke();
  });
  ctx.setLineDash([]);
  const fr = Math.min(R * 0.32, 5 + len * 0.05);             // foam churning at the front
  for (let j = 0; j < WATER.foam; j++) {
    const v = (j + 0.5) / WATER.foam * 2 - 1, wob = Math.sin(t * 11 + j * 1.9 + seed);
    const x = len * 0.97 + Math.sqrt(1 - v * v) * Math.min(R * 0.4, len * 0.2) + wob * 2, y = v * R * 0.85 + Math.cos(t * 9 + j) * 1.5;
    const r = fr * (0.7 + 0.35 * ((j * 0.618034 + seed) % 1)) * (0.85 + 0.15 * wob);
    ctx.fillStyle = col; ctx.globalAlpha = 0.3 * alpha; circle(x, y, r);
    ctx.fillStyle = COL.player; ctx.globalAlpha = 0.32 * alpha; circle(x - r * 0.2, y - r * 0.25, r * 0.5);
  }
  for (let j = 0; j < WATER.drops; j++) {                   // drops flying off the front, fading as they go
    const r1 = (j * 0.618034 + seed) % 1, r2 = (j * 0.754878 + seed * 0.37) % 1;
    const u = (r1 + t * (1.3 + r2)) % 1, side = r2 * 2 - 1;
    const x = len * (0.72 + 0.5 * u), y = side * R * (0.55 + 0.75 * u), sz = 1.2 + 1.8 * (1 - u);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(side * R * 0.75, len * 0.5));
    ctx.globalAlpha = (1 - u) * 0.8 * alpha; ctx.fillStyle = j % 3 ? col : COL.player;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 2.3, sz, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  fxNormal(); ctx.globalAlpha = 1;
}
// Super Washer in 3D (v0.65, user: "much more looking like watery 3d effect"; a flat spray and its wake before, v0.55).
// Each jet is a stream of water arcing out of a nozzle at your side: up off the floor and down onto it at its reach
// (`nozzle` and `arc` px high), widening from `w0` to `w1` as it goes. It's lit like glass: a deep teal underside, a
// pale rim of light along its top, streaks of light racing down it. Under it the floor is wet and it casts a shadow;
// drops break off it and fall with their shadows; where it lands, a crown of splash and a mist.
const SWJ = { nozzle: 8, arc: 16, w0: 4, w1: 12, N: 14 };
function jetPoints(x, y, a, len) {                      // the stream's middle: [x, y on the floor, z its height]
  const ca = Math.cos(a), sa = Math.sin(a), r0 = PLAYER.r + 1, out = [];
  for (let i = 0; i <= SWJ.N; i++) {
    const u = i / SWJ.N, d = r0 + (len - r0) * u;
    out.push([x + ca * d, y + sa * d, SWJ.nozzle * (1 - u) + SWJ.arc * 4 * u * (1 - u)]);
  }
  return out;
}
// A ribbon `w(u)` wide along points `P` (screen x, y), lifted by `lift` × its width toward its top (negative: under).
function ribbon(P, w, lift = 0) {
  const L = [], R = [];
  P.forEach(([x, y], i) => {
    const [ax, ay] = P[Math.max(0, i - 1)], [bx, by] = P[Math.min(P.length - 1, i + 1)], d = Math.hypot(bx - ax, by - ay) || 1;
    let nx = -(by - ay) / d, ny = (bx - ax) / d;
    if (ny > 0) { nx = -nx; ny = -ny; }                   // (its normal pointing up the screen: its top)
    const ww = w(i / (P.length - 1)), cx = x + nx * ww * lift, cy = y + ny * ww * lift;
    L.push([cx + nx * ww / 2, cy + ny * ww / 2]); R.unshift([cx - nx * ww / 2, cy - ny * ww / 2]);
  });
  ctx.beginPath(); [...L, ...R].forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.closePath();
}
function superJet(x, y, a, len, seed) {
  const t = reducedMotion ? 0 : performance.now() / 1000, col = COL.superwasher, P = jetPoints(x, y, a, len), N = SWJ.N;
  const S = P.map(([px, py, z]) => [px, py - z]), wid = u => SWJ.w0 + (SWJ.w1 - SWJ.w0) * u;
  const [ex, ey] = P[N];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  fxAdd(col); ctx.globalAlpha = 0.16; ctx.fillStyle = col;   // the wet floor under it
  ribbon(P.map(([px, py]) => [px, py]), u => wid(u) * 1.9); ctx.fill(); fxNormal();
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';            // its shadow, a little down and right of the floor under it
  ribbon(P.map(([px, py, z]) => [px + z * 0.35, py + 1.5]), u => wid(u) * 0.8); ctx.fill();
  fxGlow(ex, ey, 22, col, 0.55);                             // mist where it lands
  ctx.globalAlpha = 0.55; ctx.fillStyle = COL.swDeep; ribbon(S, u => wid(u) * 1.15); ctx.fill();   // the stream: its deep body …
  fxAdd(col); ctx.globalAlpha = 0.55; ctx.fillStyle = col; ribbon(S, u => wid(u) * 0.9, 0.08); ctx.fill();   // … the water …
  ctx.globalAlpha = 0.8; ctx.fillStyle = COL.swHi; ribbon(S, u => wid(u) * 0.22, 0.3); ctx.fill(); fxNormal();   // … a rim of light along its top
  ctx.strokeStyle = COL.swHi; ctx.lineWidth = 1;             // streaks of light racing down it
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = 0.7; ctx.setLineDash([len * 0.12, len * 0.16]); ctx.lineDashOffset = -(t * 420 + k * 37 + seed * 19);
    ctx.beginPath(); S.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py + (k ? 1.2 : -0.6))); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  // the splash where it lands: rings spreading on the floor (squashed: the floor at an angle) and a crown of drops
  for (let k = 0; k < 2; k++) {
    const u = (t * 3 + k * 0.5 + seed) % 1;
    ctx.globalAlpha = 0.6 * (1 - u); ctx.strokeStyle = COL.swHi; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(ex, ey, 4 + 11 * u, (4 + 11 * u) * 0.45, 0, 0, TAU); ctx.stroke();
  }
  for (let j = 0; j < 7; j++) {
    const ph = (t * 2.6 + j / 7 + seed) % 1, b = a + (j / 6 - 0.5) * 2.2 + Math.sin(seed + j) * 0.3, d = 3 + 12 * ph, z = 16 * ph * (1 - ph) * (0.7 + 0.3 * ((j * 0.618) % 1));
    const dx = ex + Math.cos(b) * d, dy = ey + Math.sin(b) * d * 0.5;
    ctx.globalAlpha = 0.25 * (1 - ph); ctx.fillStyle = '#000'; ellipse(dx, dy + 1, 1.6, 0.7);
    ctx.globalAlpha = 0.9 * (1 - ph * 0.6); ctx.fillStyle = j % 2 ? col : COL.swHi; circle(dx, dy - z, 1.3 + 0.6 * (1 - ph));
  }
  for (let j = 0; j < 4; j++) {                              // drops breaking off the stream and falling, with their shadows
    const ph = (t * 1.7 + j * 0.27 + seed * 0.3) % 1, u = 0.3 + 0.6 * ((j * 0.618 + seed) % 1), [px, py, z0] = P[Math.round(u * N)];
    const z = Math.max(0, z0 + 6 * ph - 34 * ph * ph), out = 3 * ph;
    const dx = px + Math.cos(a) * out, dy = py + Math.sin(a) * out;
    ctx.globalAlpha = 0.22 * (1 - ph); ctx.fillStyle = '#000'; ellipse(dx, dy + 1, 1.5, 0.6);
    ctx.globalAlpha = 0.85 * (1 - ph * 0.5); ctx.fillStyle = COL.swHi; ellipse(dx, dy - z, 1.1, 1.6);
  }
  ctx.globalAlpha = 1;
}
// The water flung off as it spins (`trail` radians behind the jet): a wet sheen left on the floor round you, a sheet of
// spray hanging in the air over it and falling as it fades back, drops falling off its edge with their shadows, and a
// ring of foam swirling round your feet.
function superWake(x, y, a, trail, len, seed) {
  const t = reducedMotion ? 0 : performance.now() / 1000, col = COL.superwasher, N = 16, r0 = PLAYER.r + 2;
  fxAdd(col);
  for (let i = 0; i < N; i++) {                              // the wet floor, fading back from the jet
    const u0 = i / N, u1 = (i + 1) / N, b0 = a - trail * u0, b1 = a - trail * u1;
    ctx.globalAlpha = 0.2 * (1 - u0); ctx.fillStyle = col; ctx.beginPath();
    ctx.arc(x, y, len * 1.02, b1, b0); ctx.arc(x, y, r0, b0, b1, true); ctx.closePath(); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < N; i++) {                              // the sheet of spray in the air: lower and fainter further back
    const u0 = i / N, u1 = (i + 1) / N, z0 = SWJ.arc * 0.9 * (1 - u0) ** 1.5, z1 = SWJ.arc * 0.9 * (1 - u1) ** 1.5, rr = len * (0.62 + 0.25 * u0);
    const b0 = a - trail * u0, b1 = a - trail * u1;
    ctx.globalAlpha = 0.3 * (1 - u0); ctx.strokeStyle = col; ctx.lineWidth = SWJ.w1 * (1 - 0.5 * u0);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(b0) * rr, y + Math.sin(b0) * rr - z0); ctx.lineTo(x + Math.cos(b1) * rr, y + Math.sin(b1) * rr - z1); ctx.stroke();
    ctx.globalAlpha = 0.45 * (1 - u0); ctx.strokeStyle = COL.swHi; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(b0) * rr, y + Math.sin(b0) * rr - z0 - SWJ.w1 * 0.3); ctx.lineTo(x + Math.cos(b1) * rr, y + Math.sin(b1) * rr - z1 - SWJ.w1 * 0.3); ctx.stroke();
  }
  fxNormal();
  for (let j = 0; j < 9; j++) {                              // drops falling off its edge
    const r1 = (j * 0.618034 + seed) % 1, u = (r1 * 0.9 + t * 0.8) % 1, b = a - trail * u, d = len * (0.6 + 0.5 * ((j * 0.754878) % 1));
    const z = SWJ.arc * (1 - u) ** 2, dx = x + Math.cos(b) * d, dy = y + Math.sin(b) * d;
    ctx.globalAlpha = 0.25 * (1 - u); ctx.fillStyle = '#000'; ellipse(dx, dy + 1, 1.5, 0.6);
    ctx.globalAlpha = 0.8 * (1 - u); ctx.fillStyle = j % 3 ? col : COL.swHi; ellipse(dx, dy - z, 1.2, 1.7);
  }
  ctx.globalAlpha = 0.5; ctx.strokeStyle = COL.swHi; ctx.lineWidth = 1.4;   // foam swirling round your feet
  ctx.setLineDash([5, 4]); ctx.lineDashOffset = -a * 18;
  ctx.beginPath(); ctx.ellipse(x, y + PLAYER.r * 0.55, PLAYER.r + 5, (PLAYER.r + 5) * 0.45, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
}
// A puddle of water on the ground (user's reference: a flat wobbly-edged blob with a couple of small drops beside
// it), for SOAK TRAIL!'s dropped trail. `q` (0→1, near its pop) swells it and makes it tremble. v0.55 (user: like
// actual water): a smooth, glassy surface, deeper in the middle, a glint of light, and ripples spreading over it.
function waterPuddle(x, y, r, seed, q, alpha = 1) {
  const col = COL.superwasher, t = reducedMotion ? 0 : performance.now() / 1000, R = r * (0.85 + 0.35 * q), rgb = fxRgb(col) || [33, 196, 196];
  const rgba = a => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`, quiver = 0.05 + 0.12 * q;
  ctx.save(); ctx.translate(x, y);
  fxGlow(0, 0, R * 2.4, col, (0.2 + 0.4 * q) * alpha);
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, wob = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 1.7) + quiver * Math.sin(a * 4 + t * (5 + 16 * q) + seed);
    pts.push([Math.cos(a) * R * 1.25 * wob, Math.sin(a) * R * 0.7 * wob]);
  }
  smoothShape(pts);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.15, 0, 0, 0, R * 1.4);
  g.addColorStop(0, rgba(0.18 + 0.1 * q)); g.addColorStop(0.65, rgba(0.32 + 0.15 * q)); g.addColorStop(1, rgba(0.5 + 0.2 * q));
  ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fill();
  ctx.globalAlpha = (0.5 + 0.3 * q) * alpha; ctx.strokeStyle = COL.player; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.save(); ctx.clip();                              // ripples spreading over it
  ctx.strokeStyle = COL.player; ctx.lineWidth = 0.9;
  for (let k = 0; k < 2; k++) {
    const u = (t * 1.2 + k * 0.5 + seed) % 1;
    ctx.globalAlpha = (1 - u) * 0.45 * alpha;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.25 * (0.2 + u), R * 0.7 * (0.2 + u), 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 0.75 * alpha; ctx.fillStyle = COL.player;   // a glint of light
  ctx.beginPath(); ctx.ellipse(-R * 0.45, -R * 0.22, R * 0.38, R * 0.11, -0.25, 0, TAU); ctx.fill();
  for (let k = 0; k < 2; k++) {                          // a couple of small satellite drops beside it
    const a2 = seed * 1.3 + k * 2.6, d2 = R * (1.5 + k * 0.4), sx = Math.cos(a2) * d2, sy = Math.sin(a2) * d2 * 0.6;
    const dr = R * (0.22 - k * 0.06);
    ctx.save(); ctx.translate(sx, sy);
    ctx.globalAlpha = (0.3 + 0.15 * q) * alpha; ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, dr, dr * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = (0.55 + 0.15 * q) * alpha; ctx.strokeStyle = COL.player; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = COL.player; circle(-dr * 0.35, -dr * 0.15, dr * 0.25);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Behind the menus nothing of the fight is drawn, except the main menu's demo fight (menus.js, v0.57).
const menuHide = () => game.inMenu && !game.practice?.demo;
function draw() {
  const lcd = syncLcd();                  // AWAS THE SNEK's phone screen (snek.js): everything is drawn, then inked (nokiaInk)
  ctx.save();
  updateCam();                            // co-op's bigger arena, and a boss's square one: the view follows you (coop.js)
  if (lcd) ctx.clearRect(0, 0, VW, VH);
  else { ctx.fillStyle = game.practice?.demo ? MENU_BLACK : arenaMode === 'boss' ? COL.crack : COL.line; ctx.fillRect(0, 0, VW, VH); }   // beyond the arena's edge (darker round a boss's)
  ctx.scale(viewZoom, viewZoom);          // zoomed out for the swarm, in for a boss (arena.js)
  ctx.translate(-(lcd ? lcdSnap(cam.x) : cam.x), -(lcd ? lcdSnap(cam.y) : cam.y));   // (on its pixel grid, on the phone)
  if (!lcd) impactZoom();                // BLACK FLASH!'s impact frame zooms in on the hit (below)
  if (!lcd) { ctx.fillStyle = game.practice?.demo ? MENU_BLACK : COL.floor; ctx.fillRect(0, 0, W, H); }   // (the main menu's fight: on matte black)
  const wall = lcd ? 0 : arenaWall();     // a boss fight's arena wall (below) replaces co-op's plain edge
  if (NET.run && wall < 1 && !lcd) { ctx.strokeStyle = COL.bad; ctx.globalAlpha = 0.35 * (1 - wall); ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3); ctx.globalAlpha = 1; }
  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 28, j = () => (Math.random() - 0.5) * s;
    if (lcd) ctx.translate(lcdSnap(j()), lcdSnap(j())); else ctx.translate(j(), j());
  }
  boneInv = ctx.getTransform().inverse();   // (the bosses' body parts, for their hitboxes: combat.js boneMark)
  if (wall > 0) drawArenaWall(wall);
  if (!lcd) drawEdgeGlow();               // close to the edge of a normal arena: it shows where it is (v0.54, user)
  drawPracticeBox();                      // the test arena's walls (menus.js, v0.57)
  // The main menu's demo fight (v0.57, user): everything in it stays inside its box, effects and words too.
  const demoBox = game.practice?.demo ? game.practice.box : null;
  if (demoBox) { ctx.save(); ctx.beginPath(); ctx.rect(demoBox.x + 2, demoBox.y + 2, demoBox.w - 4, demoBox.h - 4); ctx.clip(); }

  // broken ground where the boss landed: under everything else, fading out at the end
  for (const c of game.cracks) {
    const a = Math.max(0, Math.min(1, (BOSS.crack.life - c.t) / BOSS.crack.fade)) * Math.min(1, c.t * 12);
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = a;
    ctx.fillStyle = COL.crack; ellipse(0, 0, 16 * c.s, 10 * c.s);                       // crater
    ctx.strokeStyle = COL.rock; ctx.globalAlpha = a * 0.35; ctx.lineWidth = 2 * c.s;
    ctx.beginPath(); ctx.ellipse(0, 0, 18 * c.s, 11.5 * c.s, 0, 0, TAU); ctx.stroke();  // its broken rim
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const cr of c.cracks) {
      for (const [col, off, wm, al] of [[COL.line, 1, 0.7, 0.5], [COL.crack, 0, 1, 1]]) {   // a lit edge, then the dark crack
        ctx.strokeStyle = col; ctx.globalAlpha = a * al;
        for (const line of [cr.pts, cr.branch].filter(Boolean)) {
          // tapers: each segment a little thinner than the last
          for (let i = 1; i < line.length; i++) {
            ctx.lineWidth = Math.max(0.6, cr.w * wm * (1 - (i - 1) / line.length));
            ctx.beginPath(); ctx.moveTo(line[i - 1][0] + off, line[i - 1][1] + off); ctx.lineTo(line[i][0] + off, line[i][1] + off); ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = a;
    for (const rb of c.rubble) rockShape(rb.x, rb.y, rb.r, rb.spin);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // rings (v0.55: as light; thick and bright as they burst out, thinning and fading as they grow, a flash inside at first)
  for (const r of game.rings) {
    const k = Math.max(0, Math.min(1, r.life / (r.L ??= Math.max(0.05, r.life))));
    fxAdd(r.color);
    ctx.strokeStyle = ctx.fillStyle = r.color;
    if (k > 0.7) { ctx.globalAlpha = (k - 0.7) * 0.5; circle(r.x, r.y, Math.max(0, r.r)); }
    ctx.globalAlpha = Math.min(1, k * 1.2);
    ctx.lineWidth = 1 + 4 * k;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, r.r), 0, Math.PI * 2); ctx.stroke();
    fxNormal();
  }
  ctx.globalAlpha = 1;

  // XP orbs: an outer ring around a solid core, gently pulsing
  ctx.fillStyle = COL.xp; ctx.strokeStyle = COL.xp; ctx.lineWidth = 2;
  for (const o of game.orbs) {
    const k = o.born, pulse = reducedMotion ? 0 : Math.sin(o.t * 5) * 1;
    ctx.globalAlpha = 0.85 * k;
    ctx.beginPath(); ctx.arc(o.x, o.y, (o.r + pulse) * k, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.15 * k;
    circle(o.x, o.y, (o.r + pulse) * k);
    ctx.globalAlpha = k;
    circle(o.x, o.y, o.r * 0.45 * k);
  }
  ctx.globalAlpha = 1;

  // SKURTOSAURUS's rocks: slow, lumpy and easy to see
  for (const k of game.rocks) {
    if (k.big) {                            // the big rock: a streak behind it and a red rim, so it reads as the dangerous one
      const a = Math.atan2(k.vy, k.vx);
      ctx.strokeStyle = COL.rock; ctx.globalAlpha = 0.35; ctx.lineWidth = k.r * 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x - Math.cos(a) * 60, k.y - Math.sin(a) * 60); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = COL.bad; circle(k.x, k.y, k.r + 3);
    }
    rockShape(k.x, k.y, k.r, k.big ? k.t * 9 : k.spin);
  }

  // diamonds: a spinning gem that sparkles, and blinks as it's about to fade
  for (const dm of game.diamonds) {
    if (dm.t > DIAMOND.life - 3 && !reducedMotion && Math.floor(dm.t * 6) % 2) continue;
    const s = DIAMOND.r * Math.min(1, dm.t * 4), y = dm.y + (reducedMotion ? 0 : Math.sin(dm.t * 3) * 2);
    const w = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(dm.t * 2.5));   // turning
    ctx.fillStyle = COL.diamond; ctx.globalAlpha = 0.2; circle(dm.x, y, s + 7);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(dm.x, y - s * 1.3); ctx.lineTo(dm.x + s * w, y); ctx.lineTo(dm.x, y + s * 1.3); ctx.lineTo(dm.x - s * w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.player; ctx.globalAlpha = 0.7; ctx.fillRect(dm.x - 1, y - s * 0.7, 2, 2);
    ctx.globalAlpha = 1;
  }

  // potions: a small red flask that bobs, and blinks as it's about to fade
  for (const pt of game.potions) {
    const fading = pt.t > POTION.life - 3;
    if (fading && !reducedMotion && Math.floor(pt.t * 6) % 2) continue;
    drawPotion(pt);
  }

  drawSilicaFloor();                     // the Cryo Magus's frost fields (silica.js)

  // mines: a disc with a light that blinks once armed, and a faint ring showing the blast radius
  for (const m of game.mines) {
    const spec = CARDS[m.card], armed = m.t >= spec.arm, col = COL[m.card];
    if (armed) {
      ctx.globalAlpha = 0.12; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(m.x, m.y, spec.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = armed ? 1 : 0.5 + 0.5 * (m.t / spec.arm);
    ctx.fillStyle = COL.line; circle(m.x, m.y, spec.r + 2);
    ctx.fillStyle = col; circle(m.x, m.y, spec.r);
    const blink = !armed || reducedMotion || Math.floor(m.t * 4) % 2 === 0;
    ctx.fillStyle = blink ? COL.bad : COL.floor; circle(m.x, m.y, 2.5);
    ctx.globalAlpha = 1;
  }

  drawBoulders(false);                   // OBI ONE phase 3: his rocks lying round the arena (obi.js)
  drawSinZones();                        // Tempest Slam's cracked ground (sins.js)
  drawGroundFx();                        // the Hammer's broken ground and FAULT LINE! (melee.js)
  drawChessGround();                     // EN PASSANT's squares (chess.js)
  drawMagusGround();                     // the Ulti Magus pack's swirls, dark paths and blast circles (magus.js)

  // enemies: squares (normal and big) and triangles that point where they're heading (their HP over them again since
  // v0.55, user: drawEnemyHp below)
  for (const k of game.mrocks) drawKickRock(k);   // MAKORA's kicked rocks (makora.js)
  drawSnek();                                     // AWAS THE SNEK, and the phone's frame round it (snek.js)
  for (const e of game.enemies) {
    // OVERGROWTH! (v0.65): dragged down into the ground, it sinks and is cut off where it meets the floor (restored in
    // the `finally`, which runs on every `continue` below too)
    const sunk = e.sink > 0 && !e.boss && !e.obi && !e.makora;
    if (sunk) { const R = e.r || 10; ctx.save(); ctx.beginPath(); ctx.rect(e.x - R * 3, e.y - R * 4, R * 6, R * 5); ctx.clip(); ctx.translate(0, R * e.sink * 1.4); }
    try {
    if (e.apple) { drawApple(e); continue; }       // … and its apples
    if (e.hugeSnek) { drawHuge(e); continue; }     // … and AWAS grown huge
    if (e.boss) { drawBoss(e); continue; }
    if (e.makora) { drawMakora(e); continue; }   // (going down too: makora.js)
    if (e.obi) { drawObi(e); continue; }
    if (e.dummy) { drawDummy(e); continue; }
    const s = e.r * (0.4 + 0.6 * e.born);
    if (e.shape === 'crab') { drawCrab(e); continue; }       // the crab (v0.46; the mini dino before)
    if (e.type === 'lunger' && e.state === 'glow') lungerAim(e);   // where it's about to dash
    const lit = e.boom && e.fuse != null;                    // an exploder about to go: its blast ring, filling
    if (lit) {
      const q = Math.min(1, e.fuse / EXPLODER.fuse);
      ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.08 + 0.16 * q; circle(e.x, e.y, EXPLODER.r * (0.35 + 0.65 * q));
      ctx.globalAlpha = 0.5 + 0.4 * q; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, EXPLODER.r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // flashing, faster and faster, while its fuse burns (user: a flashing indicator)
    const flash = lit && (reducedMotion ? e.fuse % 0.3 < 0.15 : Math.sin(e.fuse * e.fuse * 40) > 0);
    ctx.fillStyle = e.hit > 0 || flash ? COL.player : e.chill > 0 ? chilled(enemyCol(e)) : enemyCol(e);   // chilled: frosted over
    // Splitters carry a seam down the middle, where they'll split, and exploders a bright core (so it's not colour alone).
    ctx.save(); ctx.translate(e.x + (lit && !reducedMotion ? (Math.random() - 0.5) * 3 : 0), e.y);
    if (e.shape === 'triangle') {
      ctx.rotate(lit ? e.face || 0 : (e.face = Math.atan2(e.vy, e.vx)));
      ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(-s, -s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
      if (e.boom) { ctx.fillStyle = flash ? COL.bad : COL.player; ctx.globalAlpha = 0.85; circle(-s * 0.15, 0, s * 0.32); ctx.globalAlpha = 1; }
    } else {
      ctx.fillRect(-s, -s, s * 2, s * 2);
      if (e.type === 'lunger') drawLungerGlow(e, s);
      if (e.split) { ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); }
      if (e.type === 'shooter') {                            // a dark muzzle toward you, glowing red as it charges
        const p = game.player, a = Math.atan2(p.y - e.y, p.x - e.x), q = e.aim != null ? Math.min(1, e.aim / SHOOTER.tele) : 0;
        ctx.fillStyle = COL.floor; circle(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.36);
        if (q) { ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.4 + 0.6 * q; circle(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.36 * q); ctx.globalAlpha = 1; }
      }
    }
    ctx.restore();
    } finally { if (sunk) ctx.restore(); }
  }
  drawEnemyHp();
  drawDazed();                           // Flashbang's dazed swirls (v0.58, below)
  drawAimLines();                        // KARISHNIKOV's aiming lines (v0.59, below)
  drawDeath();                           // a boss dying (deaths.js)
  // the shooters' orbs: slow, red and glowing (they don't home)
  for (const b of game.eshots) {
    if (b.apple) { drawSpitApple(b); continue; }          // AWAS grown huge spits apples (snek.js)
    const pulse = reducedMotion ? 0 : Math.sin(b.t * 10) * 1.5;
    ctx.fillStyle = b.back ? COL.saber : COL.bad;             // (blue once DEFLECT has sent it back)
    ctx.globalAlpha = 0.18; circle(b.x, b.y, b.r * 2.4 + pulse);
    ctx.globalAlpha = 0.35; circle(b.x, b.y, b.r * 1.5);
    ctx.globalAlpha = 1; circle(b.x, b.y, b.r);
    ctx.fillStyle = COL.player; ctx.globalAlpha = 0.8; circle(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.4); ctx.globalAlpha = 1;
  }
  drawSilicaTop();                       // frost on chilled enemies, the ring of ice, falling bombs, the lion's bite
  drawDebris();                          // OBI ONE phase 2: red circles warn where the force will drop debris (obi.js)
  drawBoulders(true);                    // … and phase 3's rocks in the air: falling, lifted, hurled
  drawObiShots();                        // OBI ONE's thrown saber and the shots he knocked back (obi.js)

  // projectiles, by look: streak (a line trail), orb and heavy (fading circles), spin (a turning square)
  const drawShot = pr => {
    const color = COL[pr.card], t = pr.trail;
    if (drawMagusShot(pr)) return;                       // the Ulti Magus pack's (magus.js)
    if (drawGearShot(pr)) return;                        // Gear Toss's gears and parts (silica.js)
    if (pr.look === 'ice') { drawIceShot(pr); return; }   // Cryo Magus (silica.js)
    if (pr.look === 'knife') { drawThrownKnife(pr); return; }   // KNIFE THROW! (melee.js)
    if (pr.look === 'sonic') { drawSonicShot(pr); return; }     // Sonic Kick (sins.js)
    if (pr.look === 'bubble') {                              // Soap Gun (user): a transparent, soapy bubble
      // A floaty sway (user): drawn a little off its real (hit-tested) position, drifting on its own stable phase.
      const st = performance.now() / 260 + (pr.sway || 0), bx = pr.x + Math.sin(st) * 2.5, by = pr.y + Math.cos(st * 0.8) * 1.6;
      ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, pr.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.14; ctx.fillStyle = color; circle(bx, by, pr.r);
      ctx.globalAlpha = 0.6; ctx.fillStyle = COL.player;
      ctx.beginPath(); ctx.ellipse(bx - pr.r * 0.35, by - pr.r * 0.35, Math.max(1, pr.r * 0.3), Math.max(1, pr.r * 0.18), -0.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (pr.look === 'sniper') {              // Sniper (v0.30): a long, thin tracer with a bright core; the Railgun is a thick one with a glow
      const L = Math.min(pr.flown, pr.big ? 150 : 110), bx = pr.x - Math.cos(pr.a) * L, by = pr.y - Math.sin(pr.a) * L;
      fxGlow(pr.x, pr.y, pr.r * 4 + (pr.big ? 22 : 10), color, 0.8);
      const g = ctx.createLinearGradient(bx, by, pr.x, pr.y);
      g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, color);
      ctx.lineCap = 'round';
      if (pr.big) { ctx.globalAlpha = 0.25; ctx.fillStyle = color; circle(pr.x, pr.y, pr.r + 10); }
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = pr.r * 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      ctx.strokeStyle = COL.player; ctx.lineWidth = Math.max(1, pr.r * 0.7); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(pr.x - Math.cos(pr.a) * L * 0.4, pr.y - Math.sin(pr.a) * L * 0.4); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      ctx.fillStyle = COL.player; circle(pr.x, pr.y, pr.r);
      ctx.globalAlpha = 1;
      return;
    }
    if (pr.look === 'amissile') { drawArcaneMissile(pr); return; }   // Arcane Missiles (v0.66: below)
    if (pr.look === 'missile') {             // Space Impact (v0.58, user: "more like a rocket, new vfx"): a rocket with a nose cone, fins and
                                             // a window, a flickering flame, and puffs of smoke left behind it that swell and fade
      const k = Math.min(1, pr.age / pr.ramp);
      for (let i = 0; i < t.length - 2; i += 4) {
        const u = i / t.length;
        ctx.globalAlpha = u * 0.32 * (0.4 + 0.6 * k); ctx.fillStyle = '#b8bec9';
        circle(t[i], t[i + 1], 2 + (1 - u) * 5);
      }
      ctx.globalAlpha = 1;
      fxGlow(pr.x - Math.cos(pr.a) * 10, pr.y - Math.sin(pr.a) * 10, 12 + 10 * k, COL.relic, 0.55 + 0.4 * k);   // its exhaust's glow
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.a);
      const fl = (6 + 7 * k) * (reducedMotion ? 1 : 0.75 + 0.5 * Math.random());
      ctx.fillStyle = COL.relic; ctx.beginPath(); ctx.moveTo(-8, -2.6); ctx.lineTo(-8 - fl, 0); ctx.lineTo(-8, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COL.player; ctx.beginPath(); ctx.moveTo(-8, -1.3); ctx.lineTo(-8 - fl * 0.55, 0); ctx.lineTo(-8, 1.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(color, 0.75);                                  // fins
      ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-11, -6.5); ctx.lineTo(-4, -3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-11, 6.5); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-9, -3.2, 13, 6.4, 2); ctx.fill();   // body
      ctx.beginPath(); ctx.moveTo(3.5, -3.2); ctx.quadraticCurveTo(10, -1.8, 11, 0); ctx.quadraticCurveTo(10, 1.8, 3.5, 3.2); ctx.closePath(); ctx.fill();   // nose
      ctx.fillStyle = COL.player; circle(0.5, 0, 1.6);                    // window
      ctx.restore();
      return;
    }
    if (pr.look === 'dart') {                // Blowpipe (v0.59): a thin dart with a tuft at its tail, a faint streak behind; BERSERK!'s is red
      const c = pr.red ? COL.berserk : color, a = Math.atan2(pr.vy, pr.vx);
      shotShadow(pr.x, pr.y, 5, 9);                          // (v0.60: a shadow under it, for a 3D look: magus.js)
      if (t.length >= 6) { ctx.globalAlpha = 0.3; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(t[t.length - 6], t[t.length - 5]); ctx.lineTo(pr.x, pr.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (pr.red) fxGlow(pr.x, pr.y, 18, COL.berserk, 0.8);
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
      ctx.fillStyle = COL.fistLine; ctx.fillRect(-9, -1.1, 11, 2.2);               // the shaft …
      ctx.fillStyle = '#6b6276'; ctx.fillRect(-9, -1.1, 11, 0.8);                  // … lit along its top
      ctx.fillStyle = COL.knife; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(1.5, -1.6); ctx.lineTo(1.5, 1.6); ctx.closePath(); ctx.fill();   // the point
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-12, -3.6); ctx.lineTo(-10.5, 0); ctx.lineTo(-12, 3.6); ctx.closePath(); ctx.fill();   // the tuft
      ctx.restore();
      return;
    }
    if (pr.look === 'brick') {               // Brickshot (v0.58): a brick tumbling end over end; v0.64 (user: "looks like an actual
                                             // brick … and make it 3d too"): a clay brick in fake 3D (brick3d, below), a dust streak
      if (t.length >= 6) { ctx.globalAlpha = 0.18; ctx.strokeStyle = color; ctx.lineWidth = pr.r; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(t[t.length - 6], t[t.length - 5]); ctx.lineTo(pr.x, pr.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      fxGlow(pr.x, pr.y, pr.r * 2.4 + 4, color, 0.25);
      brick3d(pr.x, pr.y, pr.r, pr.vx, pr.vy, reducedMotion ? 0.6 : pr.spin * 0.5);
      return;
    }
    if (pr.look === 'grape') {               // Grapeshot's shell (v0.58): a cluster of shot, turning as it flies
      fxGlow(pr.x, pr.y, pr.r * 3 + 6, color, 0.6);
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(reducedMotion ? 0 : pr.spin * 0.4);
      ctx.fillStyle = color;
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5; circle(Math.cos(a) * pr.r * 0.55, Math.sin(a) * pr.r * 0.55, pr.r * 0.5); }
      ctx.fillStyle = COL.player; ctx.globalAlpha = 0.8; circle(-pr.r * 0.25, -pr.r * 0.3, pr.r * 0.25); ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    if (pr.look === 'flashbang') {           // Flashbang (v0.58): a little grenade, spinning, its light blinking
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(reducedMotion ? 0 : pr.spin * 0.5);
      ctx.fillStyle = '#3a3f4a'; ctx.beginPath(); ctx.roundRect(-pr.r, -pr.r * 0.7, pr.r * 2, pr.r * 1.4, pr.r * 0.5); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(-pr.r * 0.25, -pr.r * 0.7, pr.r * 0.5, pr.r * 1.4);   // its band
      ctx.fillStyle = '#c9ced8'; ctx.fillRect(pr.r * 0.85, -pr.r * 0.35, pr.r * 0.5, pr.r * 0.7);   // the cap
      ctx.restore();
      if (reducedMotion || Math.floor(performance.now() / 120) % 2) fxGlow(pr.x, pr.y, pr.r * 3, color, 0.8);
      return;
    }
    if (pr.look === 'rain') {                // GRAPE RAIN! (v0.58): a shot dropping out of the sky, and a ring where it will land
      const land = pr.y + Math.max(0, pr.range - pr.flown);
      ctx.globalAlpha = 0.45; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(pr.x, land, 9, 4, 0, 0, TAU); ctx.stroke();
      const g = ctx.createLinearGradient(pr.x, pr.y - 34, pr.x, pr.y);
      g.addColorStop(0, hexA(color, 0)); g.addColorStop(1, color);
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = pr.r * 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 34); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      ctx.fillStyle = COL.player; circle(pr.x, pr.y, pr.r * 0.8);
      return;
    }
    if (pr.look === 'heavy') {               // Cannon (v0.58, user: "a small glow and grey like a cannon ball"): an iron ball with a
                                             // light on it, a faint grey trail and only a small glow; v0.64: in fake 3D, rolling
      for (let i = 0; i < t.length; i += 4) { ctx.globalAlpha = (i / t.length) * 0.22; ctx.fillStyle = color; circle(t[i], t[i + 1], pr.r * (0.5 + 0.5 * i / t.length)); }
      ctx.globalAlpha = 1;
      fxGlow(pr.x, pr.y, pr.r * 1.9, color, 0.35);
      ironBall(pr.x, pr.y, pr.r, pr.vx, pr.vy, reducedMotion ? 0 : pr.flown / pr.r, color);
      return;
    }
    // v0.55 (user: clean, like the effect creator's Fire bolt): a glow round each shot, a tapered trail that adds up as
    // light (thin and faint at its tail, full width at the shot), and a white-hot heart
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    const fierce = pr.dmg >= 15;                                   // (Arcane Fire and the like: more of everything)
    if (pr.look === 'gat') shotShadow(pr.x, pr.y, pr.r * 1.2, 8);   // (v0.60: the Gatling's rounds fly over their shadows, for a 3D look)
    fxGlow(pr.x, pr.y, pr.r * (pr.look === 'heavy' ? 4 : 3) + (fierce ? 12 : 5), color, pr.look === 'gat' ? 0.45 : fierce ? 0.95 : 0.7);
    fxAdd(color); ctx.lineCap = 'round';
    if (pr.look === 'streak' || pr.look === 'spin' || pr.look === 'gat') {
      const n = Math.min(t.length, pr.look === 'gat' ? 8 : fierce ? 16 : 12), s0 = t.length - n;
      for (let i = s0 + 2; i < t.length; i += 2) {
        const k = (i - s0) / n;
        ctx.globalAlpha = k * (pr.look === 'spin' ? 0.35 : 0.75);
        ctx.lineWidth = Math.max(1, pr.r * (fierce ? 2 : 1.5) * k);
        ctx.beginPath(); ctx.moveTo(t[i - 2], t[i - 1]); ctx.lineTo(i + 2 < t.length ? t[i] : pr.x, i + 2 < t.length ? t[i + 1] : pr.y); ctx.stroke();
      }
    } else {
      for (let i = 0; i < t.length; i += 2) {
        const k = i / t.length;
        ctx.globalAlpha = k * 0.4;
        circle(t[i], t[i + 1], pr.r * (0.4 + k * 0.6));
      }
    }
    fxNormal();
    ctx.globalAlpha = 1;
    if (pr.look === 'spin') {
      const s = pr.r * 1.5;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.spin);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      circle(pr.x, pr.y, pr.r);
      ctx.fillStyle = COL.player; ctx.globalAlpha = 0.85; circle(pr.x, pr.y, pr.r * 0.5); ctx.globalAlpha = 1;   // its white-hot heart
    }
  };
  for (const pr of game.projectiles) {
    if (!pr.bigged) { drawShot(pr); continue; }
    // A BIG slot's shot (v0.68): drawn AUG.big times bigger round where it is. Its r already grew (the hitbox: combat.js
    // bigUp), so it's drawn from the r it had.
    const r = pr.r;
    pr.r = r / AUG.big;
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(AUG.big, AUG.big); ctx.translate(-pr.x, -pr.y);
    drawShot(pr);
    ctx.restore();
    pr.r = r;
  }

  // BULL charge: a swoosh (user), a tapered streak of air from where it started, thin at the back and full width at
  // you, with a bright core; it lingers for a moment after the charge
  const swoosh = (x1, y1, x2, y2, k) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 4) return;
    const nx = -dy / L, ny = dx / L, w = PLAYER.r * 1.15;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(255, 159, 67, 0)'); g.addColorStop(1, `rgba(255, 159, 67, ${0.45 * k})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + dx * 0.6 + nx * w * 0.9, y1 + dy * 0.6 + ny * w * 0.9, x2 + nx * w, y2 + ny * w);
    ctx.lineTo(x2 - nx * w, y2 - ny * w);
    ctx.quadraticCurveTo(x1 + dx * 0.6 - nx * w * 0.9, y1 + dy * 0.6 - ny * w * 0.9, x1, y1);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 240, 220, ${0.55 * k})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1 + dx * 0.25, y1 + dy * 0.25); ctx.lineTo(x2, y2); ctx.stroke();
  };
  for (const w of game.swooshes) swoosh(w.x1, w.y1, w.x2, w.y2, w.life / SWOOSH_LIFE);
  if (game.dash && !menuHide() && Number.isFinite(game.dash.sx)) swoosh(game.dash.sx, game.dash.sy, game.player.x, game.player.y, 1);

  // BULL charge: afterimages fading out behind you
  // (and BLACK FLASH!'s, `bf`: black, edged in red)
  for (const g of game.ghosts) {
    const k = g.life / 0.2;
    if (g.bf) {
      ctx.globalAlpha = 0.5 * k; ctx.fillStyle = COL.flash; circle(g.x, g.y, PLAYER.r * (0.7 + 0.3 * k));
      ctx.strokeStyle = COL.flashHi; ctx.lineWidth = 1.5; ctx.stroke();
      continue;
    }
    ctx.fillStyle = COL.relic; ctx.globalAlpha = k * 0.35;
    ellipse(g.x, g.y, PLAYER.r * 1.2, PLAYER.r * 0.8, g.a);
  }
  ctx.globalAlpha = 1;

  // Pressure Washer (user's reference: a converging jet fanning into a splashy burst): the shared water-spray
  // shape, angled to the cone's centre. WASH CONE! wipes across as it appears (`wipe`) instead of popping in all
  // at once; its width follows the cone's actual arc, so the splash lands exactly where the hit-test reaches.
  for (const s of game.sprays) {
    const fade = Math.max(0, s.life / s.max), q = 1 - fade;
    const reveal = s.wipe ? Math.min(1, q / 0.45) : 1, half = (s.arc / 2) * reveal, rng = s.range * (0.7 + 0.3 * reveal);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    waterSpray(rng, rng * Math.min(3, Math.tan(half)), COL[s.card], s.seed, fade);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // SOAK TRAIL!'s puddles (Super Washer ×7, user): little puddles left behind, swelling just before they dry up.
  for (const tp of game.trails) {
    const q = 1 - Math.max(0, tp.t) / TUNE.soakTrail.trailDelay;
    waterPuddle(tp.x, tp.y, 7, tp.seed, q);
  }

  // lasers: zaps, and Laser ×7's sweep (the beam, with the slice it just swept fading behind it)
  for (const b of game.beams) drawBeam(b.x1, b.y1, b.x2, b.y2, reducedMotion ? b.life / b.max : (b.life / b.max) * (0.75 + Math.random() * 0.25), b.w, COL[b.card]);
  for (const sw of game.sweeps) {
    const pp = game.player, a = sw.a ?? sw.a0, trail = Math.min(1.2, a - sw.a0), water = sw.card === 'superwasher';
    if (trail > 0.02 && water) superWake(pp.x, pp.y, a, trail, sw.len, sw.a0);   // (v0.65: in 3D)
    else if (trail > 0.02) {
      ctx.fillStyle = COL[sw.card]; ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.arc(pp.x, pp.y, sw.len, a - trail, a); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (water) superJet(pp.x, pp.y, a, sw.len, sw.a0);
    else drawBeam(pp.x, pp.y, pp.x + Math.cos(a) * sw.len, pp.y + Math.sin(a) * sw.len, 1, 5, COL[sw.card]);
  }

  if (!menuHide()) { drawMelees(); drawSins(); drawChessTop(); drawMagusTop(); }   // (and the Ulti Magus pack's: magus.js)   // melee stabs, punches and black lightning (melee.js); SINS (sins.js); EN PASSANT's knights and king (chess.js)

  // player: a circle (hidden behind the start menu), stretched along a BULL charge
  const p = game.player, dsh = game.dash, da = dsh ? Math.atan2(dsh.dy, dsh.dx) : 0;
  ctx.fillStyle = NET.run ? (NET.me?.down ? COL.line : NET.me?.color || COL.player) : COL.player;   // co-op: your colour; grey when down
  if (!menuHide()) {
    ctx.globalAlpha = p.safe > 0 && !dsh && Math.floor(p.safe * 20) % 2 ? 0.45 : 1;   // blink while safe after a hit
    if (NET.run && NET.me?.emoji) {     // co-op, with an emoji (v0.46): only the emoji, drawn crisp on the text layer
    } else if (dsh) ellipse(p.x, p.y, PLAYER.r * 1.25, PLAYER.r * 0.82, da);
    else circle(p.x, p.y, PLAYER.r);
    ctx.globalAlpha = 1;
  }
  if (!menuHide() && !dsh && !(NET.run && NET.me?.down)) drawRelicReady(p);   // your relics, when they're ready again
  if (!menuHide() && game.bflash > 0) drawBlackFlashAura(p);                  // BLACK FLASH! (melee.js)
  if (!menuHide()) drawSinGuard(p);                                           // Iron Will (sins.js)
  if (!menuHide()) drawTBalls();                                              // the T-Balls, orbiting you (tballs.js)
  if (dsh && !menuHide()) {             // BULL charge: speed lines behind, a glowing wedge and a pair of horns in front
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(da);
    ctx.strokeStyle = COL.relic; ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
    for (const o of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(-PLAYER.r - 6 - (o ? 10 : 22), o); ctx.lineTo(-PLAYER.r - 4, o); ctx.stroke(); }
    ctx.fillStyle = COL.relic; ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, PLAYER.r + 16, -0.8, 0.8); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(PLAYER.r * 0.55, side * 5);
      ctx.quadraticCurveTo(PLAYER.r + 7, side * 14, PLAYER.r + 12, side * 5);
      ctx.quadraticCurveTo(PLAYER.r + 4, side * 7, PLAYER.r * 0.9, side * 1.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawCoopPlayers();                     // co-op: your friends, and you if you're down (coop.js)

  // mini shield (after a level-up choice): a bubble that flashes when an enemy bumps it
  if (game.shield > 0 && !menuHide()) {
    const fade = Math.min(1, game.shield / 0.3), wob = reducedMotion ? 0 : Math.sin(performance.now() / 160) * 0.12;
    const rr = PLAYER.r + SHIELD.r;
    ctx.globalAlpha = fade * (0.1 + (game.shieldHit > 0 ? 0.15 : 0));
    ctx.fillStyle = COL.xp; circle(p.x, p.y, rr);
    ctx.globalAlpha = fade * (0.6 + wob + (game.shieldHit > 0 ? 0.3 : 0));
    ctx.strokeStyle = COL.xp; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (game.bshield && !menuHide()) {     // Brickshot's light blue shield (v0.58), fading as it runs out
    const fade = Math.min(1, game.bshield.t / 0.4), rr = PLAYER.r + 7;
    fxGlow(p.x, p.y, rr + 12, COL.bshield, 0.45 * fade);
    ctx.globalAlpha = 0.8 * fade; ctx.strokeStyle = COL.bshield; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (!menuHide()) drawDeflect(p.x, p.y, game.defl, game.deflAge);   // DEFLECT's shield (obi.js)
  drawPullMeter();                       // the ring you fill to break OBI ONE's pull

  if (p.flash > 0) {                    // contact: a ring, so the player never blends into the swarm
    ctx.globalAlpha = p.flash / 0.2;
    ctx.strokeStyle = COL.bad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (game.muzzle) {                      // the muzzle flash (v0.57: drawMuzzle below)
    const m = game.muzzle, big = CARDS[m.card].look === 'heavy', ak = CARDS[m.card].look === 'kalash';   // (KARISHNIKOV's is all you see of it: bigger)
    drawMuzzle(p.x + Math.cos(m.a) * (PLAYER.r + 3), p.y + Math.sin(m.a) * (PLAYER.r + 3), m.a, Math.max(0, m.life / (m.max || 0.12)), big ? 15 : ak ? 13 : 9, COL[m.card], m.seed);
  }

  // particles (v0.55): a burst's are sparks, streaks along the way they fly with a white-hot head, adding up as light,
  // thinning as they cool; the rest (dust, embers, smoke) stay soft squares that shrink as they fade
  ctx.lineCap = 'round';
  for (const q of game.particles) {
    const k = Math.max(0, Math.min(1, q.life / (q.max ??= Math.max(0.05, q.life))));
    if (q.drop) {                                    // water (v0.55): a glassy drop stretched the way it flies, a glint at its front
      const v = Math.hypot(q.vx, q.vy) || 1, sz = 0.9 + 1.6 * k, len = sz * (1.2 + Math.min(3, v * 0.012));
      fxAdd(q.color);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx));
      ctx.globalAlpha = Math.min(1, k * 1.5) * 0.85; ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.ellipse(-len * 0.35, 0, len, sz, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha *= 0.85; ctx.fillStyle = COL.player; circle(len * 0.25, -sz * 0.2, sz * 0.45);
      ctx.restore();
      fxNormal();
    } else if (q.flake) {                            // snow (v0.60, the Cryo Magus): a little snowflake, turning as it drifts
      ctx.globalAlpha = Math.min(1, k * 1.5); ctx.strokeStyle = q.color; ctx.lineWidth = 1;
      snowflake(q.x, q.y, 1.6 + 2.6 * k, (q.rot || 0) + q.life * 3);
    } else if (q.spark) {
      const v = Math.hypot(q.vx, q.vy) || 1, len = 2 + Math.min(16, v * 0.035);
      fxAdd(q.color);
      ctx.globalAlpha = Math.min(1, k * 1.6); ctx.strokeStyle = q.color; ctx.lineWidth = 0.8 + 2 * k;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx / v * len, q.y - q.vy / v * len); ctx.stroke();
      if (k > 0.55) { ctx.fillStyle = COL.player; ctx.globalAlpha = (k - 0.55) * 1.6; ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }
      fxNormal();
    } else {
      const sz = 1 + 2.5 * k;
      ctx.globalAlpha = Math.min(1, q.life * 3);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 1;

  if (demoBox) ctx.restore();
  if (!lcd) drawImpactFrame();           // BLACK FLASH!'s impact frame (below)
  ctx.restore();
  if (lcd) nokiaInk();                   // everything black on the phone's green

  // Floating numbers and callouts: on their own full-resolution layer, so they stay sharp under the CRT filter
  // (user: text was unreadable at its low resolution). It shakes with the arena.
  tctx.save();
  tctx.clearRect(0, 0, VW, VH);
  tctx.scale(viewZoom, viewZoom);
  tctx.translate(-cam.x, -cam.y);
  if (game.shake > 0 && !reducedMotion) { const s = game.shake * 28; tctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
  if (demoBox) { tctx.beginPath(); tctx.rect(demoBox.x + 2, demoBox.y + 2, demoBox.w - 4, demoBox.h - 4); tctx.clip(); }   // (the menu's demo: above)
  drawCoopFaces();                        // co-op: emojis (coop.js), under the numbers
  tctx.textAlign = 'center';
  for (const f of game.floaters) {
    tctx.globalAlpha = Math.min(1, f.life * 3);
    if (f.crit && !lcd) { drawCritText(f); continue; }
    if (f.manga && !lcd) { drawMangaText(f); continue; }
    tctx.fillStyle = lcd ? COL.lcdInk : f.color;           // (black on the phone too)
    // v0.30 (user): bigger, 11/15 px before, with a dark edge so they read over anything
    tctx.font = `700 ${f.crit ? 27 : f.big ? 22 : 16}px "Chakra Petch", system-ui, sans-serif`;   // a crit: 27 px (v0.41)
    tctx.lineWidth = 4; tctx.strokeStyle = lcd ? COL.lcd : 'rgba(0, 0, 0, .8)'; tctx.lineJoin = 'round'; tctx.strokeText(f.text, f.x, f.y);
    tctx.fillText(f.text, f.x, f.y);
  }
  drawCoopNames();
  drawPullText();
  tctx.restore();
}
// The edge of a normal arena (v0.54, user: when you're close to it, a nice see-through glow shows where it is): the
// stretch of edge nearest you lights up, brightest right by you and fading along it and into the arena, stronger the
// closer you get. Ticks along it read as a boundary. (Boss arenas have their wall, drawArenaWall.)
const EDGE = { near: 150, reach: 230, deep: 70, tick: 18 };
// The muzzle flash (v0.57, user: "prettier than flat"; a glow and a spiky star before): a glow, a forward flame in
// layers (the weapon's colour outside, white-hot inside) with two smaller side flames, a ring of blast that puffs out
// ahead of it, and a white core. `k`: how much is left (1 → 0); `seed`: each shot's own little differences.
function lensPath(len, w) {             // a pointed flame along +x, widest a third of the way out
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.3, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.3, w, 0, 0);
  ctx.closePath();
}
function drawMuzzle(x, y, a, k, r, c, seed = 1) {
  if (k <= 0) return;
  const e = 1 - k, rnd = mulberry32(seed | 0), L = r * (1.5 + 0.8 * e) * (0.85 + rnd() * 0.3);
  fxGlow(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 3.2, c, 0.85 * k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  fxAdd(c); ctx.fillStyle = c;
  ctx.globalAlpha = 0.5 * k; lensPath(L * 1.15, r * 0.62 * k + 1); ctx.fill();          // the outer flame
  for (const s of [-1, 1]) {                                                            // the side flames
    ctx.save(); ctx.rotate(s * (0.7 + rnd() * 0.35));
    ctx.globalAlpha = 0.6 * k; lensPath(L * (0.4 + rnd() * 0.15), r * 0.26 * k + 0.6); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 0.95 * k; lensPath(L * 0.8, r * 0.36 * k + 0.8); ctx.fill();          // the bright middle
  ctx.fillStyle = COL.player; ctx.globalAlpha = 0.9 * k; lensPath(L * 0.5, r * 0.18 * k + 0.5); ctx.fill();   // white-hot
  ctx.strokeStyle = c; ctx.globalAlpha = 0.55 * k; ctx.lineWidth = 0.8 + 1.6 * k;      // the blast ring, puffing out ahead
  ctx.beginPath(); ctx.ellipse(r * (0.3 + e * 0.7), 0, r * (0.18 + e * 0.35), r * (0.4 + e * 0.55), 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = COL.player; ctx.globalAlpha = 0.9 * k; circle(r * 0.15, 0, r * 0.16 * k + 0.5);   // a small hot point, not a disc
  fxNormal(); ctx.restore(); ctx.globalAlpha = 1;
}
// The test arena (menus.js setupBattle): the floor outside it darker, and its edge, in your colour.
// The main menu's fight is on matte black, like the title (v0.57, user: no purple there).
const MENU_BLACK = '#040405';
function drawPracticeBox() {
  const b = game.practice?.box;
  if (!b) return;
  const demo = game.practice.demo;
  ctx.fillStyle = demo ? MENU_BLACK : COL.floor; ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, W, b.y); ctx.fillRect(0, b.y + b.h, W, H - b.y - b.h);
  ctx.fillRect(0, b.y, b.x, b.h); ctx.fillRect(b.x + b.w, b.y, W - b.x - b.w, b.h);
  ctx.globalAlpha = 0.5; ctx.strokeStyle = demo ? '#24252b' : COL.line; ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 0.35; ctx.strokeStyle = COL.edge || COL.player; ctx.lineWidth = 1;
  const c = 14;                                                       // corner marks
  for (const [x, y, sx, sy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * c, y + sy * 3); ctx.lineTo(x + sx * 3, y + sy * 3); ctx.lineTo(x + sx * 3, y + sy * c); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawEdgeGlow() {
  if (arenaMode !== 'normal' || game.inMenu || game.practice || game.over || (NET.run && NET.me?.down)) return;
  const p = game.player, bot = NET.run ? H : Math.min(playH || H, H), E = EDGE;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, bot); ctx.clip();   // (only on the arena's side of the edge)
  ctx.lineCap = 'round';
  for (const [x, y, side, d] of [[p.x, 0, 'top', p.y], [p.x, bot, 'bottom', bot - p.y], [0, p.y, 'left', p.x], [W, p.y, 'right', W - p.x]]) {
    if (d > E.near) continue;
    const k = Math.min(1, (1 - Math.max(0, d - PLAYER.r) / (E.near - PLAYER.r))) ** 1.5, flat = side === 'top' || side === 'bottom';
    const g = ctx.createRadialGradient(x, y, 0, x, y, E.reach);
    g.addColorStop(0, hexA(COL.edge, 0.5 * k)); g.addColorStop(0.5, hexA(COL.edge, 0.18 * k)); g.addColorStop(1, hexA(COL.edge, 0));
    ctx.save();                                       // the glow: squashed into the arena, so it reaches along the edge further than in
    ctx.translate(x, y); ctx.scale(flat ? 1 : E.deep / E.reach, flat ? E.deep / E.reach : 1); ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, E.reach, 0, TAU); ctx.fill();
    ctx.restore();
    const line = ctx.createRadialGradient(x, y, 0, x, y, E.reach);
    line.addColorStop(0, hexA(COL.edge, k)); line.addColorStop(0.6, hexA(COL.edge, 0.45 * k)); line.addColorStop(1, hexA(COL.edge, 0));
    ctx.strokeStyle = line; ctx.lineWidth = 4;
    ctx.beginPath();
    if (flat) { const yy = side === 'top' ? 2 : bot - 2; ctx.moveTo(x - E.reach, yy); ctx.lineTo(x + E.reach, yy); }
    else { const xx = side === 'left' ? 2 : W - 2; ctx.moveTo(xx, y - E.reach); ctx.lineTo(xx, y + E.reach); }
    ctx.stroke();
    ctx.lineWidth = 2.5;                              // the ticks, pointing in
    ctx.beginPath();
    const at = flat ? x : y, from = Math.ceil((at - E.reach) / E.tick) * E.tick;
    for (let v = from; v <= at + E.reach; v += E.tick) {
      if (flat) { const yy = side === 'top' ? 3 : bot - 3, dir = side === 'top' ? 1 : -1; ctx.moveTo(v, yy); ctx.lineTo(v + 5, yy + dir * 9); }
      else { const xx = side === 'left' ? 3 : W - 3, dir = side === 'left' ? 1 : -1; ctx.moveTo(xx, v); ctx.lineTo(xx + dir * 9, v + 5); }
    }
    ctx.stroke();
  }
  ctx.restore();
}
// Arcane Missiles (v0.30: a glowing dart with a fading trail). v0.66 (user: "make the vfx look more premium and 3d"):
// a crystal shard spinning on its own axis (its lit and shadowed facets swap as it turns) over its shadow on the floor,
// a tapered ribbon of light behind it with a white-hot core, two motes spiralling round the trail (each bigger and
// brighter while it passes in front, so they read as a helix), and a four-point flare pulsing at its tip.
const AMS = { shadow: 12, ribbon: 1.5, core: 0.45, helix: 2.1, twist: 0.85, nose: 3.6, tail: 1.8, girth: 1.5 };
function drawArcaneMissile(pr) {
  const c = COL.missiles, hi = COL.missilesHi, deep = COL.missilesDeep, r = pr.r, a = Math.atan2(pr.vy, pr.vx), t = pr.trail;
  const pts = [];
  for (let i = 0; i + 1 < t.length; i += 2) pts.push([t[i], t[i + 1]]);
  pts.push([pr.x, pr.y]);
  shotShadow(pr.x, pr.y, r * 1.3, AMS.shadow);
  if (pts.length >= 3) {
    const m = pts.length - 1, side = (i, w) => {             // the points either side of the trail, `w` out
      const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(m, i + 1)], d = Math.hypot(x1 - x0, y1 - y0) || 1;
      return [-(y1 - y0) / d * w, (x1 - x0) / d * w];
    };
    const ribbon = (wMul, fill, alpha) => {
      const L = [], R = [];
      for (let i = 0; i <= m; i++) { const [nx, ny] = side(i, r * wMul * (i / m) ** 0.7); L.push([pts[i][0] + nx, pts[i][1] + ny]); R.push([pts[i][0] - nx, pts[i][1] - ny]); }
      ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (const [x, y] of L) ctx.lineTo(x, y);
      for (let i = m; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath(); ctx.fill();
    };
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pr.x, pr.y);
    g.addColorStop(0, hexA(c, 0)); g.addColorStop(0.55, hexA(c, 0.5)); g.addColorStop(1, c);
    const g2 = ctx.createLinearGradient(pts[0][0], pts[0][1], pr.x, pr.y);
    g2.addColorStop(0, hexA(hi, 0)); g2.addColorStop(1, hi);
    fxAdd(c);
    ribbon(AMS.ribbon, g, 0.85);
    ribbon(AMS.core, g2, 0.9);
    for (let s2 = 0; s2 < 2; s2++) for (let i = 1; i <= m; i++) {   // the helix: two motes, half a turn apart
      const u = i / m, ph = i * AMS.twist - pr.spin * 0.8 + s2 * Math.PI, depth = Math.cos(ph), [nx, ny] = side(i, r * AMS.helix * u * Math.sin(ph));
      ctx.globalAlpha = u * (depth > 0 ? 0.95 : 0.35); ctx.fillStyle = depth > 0 ? hi : c;
      circle(pts[i][0] + nx, pts[i][1] + ny, (0.5 + 0.9 * u) * (1 + 0.35 * depth));
    }
    fxNormal();
  }
  fxGlow(pr.x, pr.y, r * 5 + 8, c, 0.8);
  // the shard: nose forward, its widest a little behind the middle; the ridge between its facets rolls with its spin
  const roll = Math.sin(pr.spin * 0.7), N = r * AMS.nose, T = -r * AMS.tail, Wd = r * AMS.girth, mx = r * 0.15, ridge = roll * Wd * 0.75;
  ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
  ctx.globalAlpha = 1;
  const facet = (y1, y2, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(N, 0); ctx.lineTo(mx, y1); ctx.lineTo(T, 0); ctx.lineTo(mx, y2); ctx.closePath(); ctx.fill(); };
  const lit = ctx.createLinearGradient(0, -Wd, 0, Wd);
  lit.addColorStop(0, hi); lit.addColorStop(0.55, c); lit.addColorStop(1, deep);
  facet(-Wd, Wd, lit);                                         // the whole crystal, lit from above …
  facet(ridge, Wd, hexA(deep, 0.55));                          // … its far facet in shadow …
  ctx.strokeStyle = hi; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.9;   // … and a bright edge along the ridge
  ctx.beginPath(); ctx.moveTo(N, 0); ctx.lineTo(mx, ridge); ctx.lineTo(T, 0); ctx.stroke();
  ctx.restore();
  const pulse = reducedMotion ? 1 : 0.8 + 0.35 * Math.sin(pr.spin * 1.3);   // the flare at its tip
  const fx = pr.x + Math.cos(a) * N * 0.75, fy = pr.y + Math.sin(a) * N * 0.75;
  fxAdd(c); ctx.fillStyle = hi; ctx.globalAlpha = 0.9;
  starPath(fx, fy, r * 0.28, r * 1.9 * pulse, 4, a + Math.PI / 4); ctx.fill();
  fxNormal();
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1; circle(fx, fy, r * 0.32 + 0.4);
}
// Where an Arcane Missile hits (v0.66, combat.js arcaneHit): seen at an angle like the rest of the 3D: a ring of runes
// spreading across the floor (squashed), a shaft of light shooting up, shards of the crystal flung out and falling, a flare.
const AMH = { life: 0.42, ring: 22, beam: 34, shards: 6, max: 14, floor: 0.45 };
function drawArcaneHit(f, q) {
  const c = COL.missiles, hi = COL.missilesHi, e = 1 - (1 - q) ** 3, fade = 1 - q, s = f.size, rnd = mulberry32(f.seed | 0), SQ = AMH.floor;
  const R = s * (0.25 + 0.75 * e) * AMH.ring / 10;
  fxGlow(f.x, f.y, R * 2, c, 0.35 * fade);
  fxAdd(c);
  ctx.globalAlpha = 0.1 * fade; ctx.fillStyle = c; ellipse(f.x, f.y, R, R * SQ);
  ctx.globalAlpha = 0.85 * fade; ctx.strokeStyle = c; ctx.lineWidth = 0.6 + 2.2 * fade;
  ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * SQ, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = 0.6 + 1.4 * fade;      // the runes: dashes round an inner ring, turning
  for (let k = 0; k < 8; k++) {
    const a0 = f.rot + q * 1.6 + k * TAU / 8, R2 = R * 0.72;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, R2, R2 * SQ, 0, a0, a0 + 0.42); ctx.stroke();
  }
  const bh = s * AMH.beam / 10 * (q < 0.25 ? q / 0.25 : 1) * (1 - q * 0.3), bw = s * 0.45 * fade;   // the shaft of light
  if (bw > 0.2) {
    const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y - bh);
    g.addColorStop(0, hi); g.addColorStop(0.4, hexA(c, 0.8)); g.addColorStop(1, hexA(c, 0));
    ctx.globalAlpha = fade; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(f.x - bw, f.y); ctx.lineTo(f.x - bw * 0.25, f.y - bh); ctx.lineTo(f.x + bw * 0.25, f.y - bh); ctx.lineTo(f.x + bw, f.y); ctx.closePath(); ctx.fill();
  }
  for (let k = 0; k < AMH.shards; k++) {                        // the shards: thrown up and out, falling back, spinning
    const b = (f.dir ?? f.rot) + (rnd() - 0.5) * 3.2, sp = s * (1.2 + rnd() * 1.6), z = s * (1.6 + rnd()) * Math.sin(Math.PI * Math.min(1, q * 1.15));
    const x = f.x + Math.cos(b) * sp * e, y = f.y + Math.sin(b) * sp * e * SQ - z, w = s * 0.18 * (0.6 + rnd() * 0.6), sp2 = rnd() * TAU + q * 14;
    ctx.globalAlpha = fade; ctx.fillStyle = k % 2 ? hi : c;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(sp2) * w * 2, y + Math.sin(sp2) * w * 2); ctx.lineTo(x + Math.cos(sp2 + 2.4) * w, y + Math.sin(sp2 + 2.4) * w);
    ctx.lineTo(x + Math.cos(sp2 + 3.9) * w, y + Math.sin(sp2 + 3.9) * w); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = hi; ctx.globalAlpha = fade;
  starPath(f.x, f.y - bh * 0.25, s * 0.12, s * (0.6 + 0.9 * (1 - e)), 4, f.rot); ctx.fill();
  fxNormal();
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade; circle(f.x, f.y - bh * 0.25, s * 0.18 * (1 - e) + 0.5);
  ctx.globalAlpha = 1;
}

// '#rrggbb' at alpha a
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// AWAS THE SNEK's phone screen (snek.js) follows its fight: on while its `lcd` is, with the screen's grid over the
// arena (style.css .lcd-grid) and a flicker as it switches. Returns whether it's on.
let lcdState = false;
const lcdGrid = document.getElementById('lcd-grid');
function syncLcd() {
  const on = nokiaNow();
  if (on === lcdState) return on;
  lcdState = on;
  rootEl.classList.toggle('lcd', on);
  lcdGrid.hidden = !on;
  if (!reducedMotion) { arena.classList.remove('lcd-flick'); void arena.offsetWidth; arena.classList.add('lcd-flick'); }
  resize();                                           // its coarser pixels (arena.js)
  return on;
}
// Ink: every pixel something was drawn on turns black, the rest the screen's green. Faint ones (glows, fading
// sparks) are dithered, the way a 1-bit screen shows grey. Where the browser won't hand the pixels back (some block it
// to stop fingerprinting), a blend does the same without the dithering.
const LCD_DITHER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => Math.round((0.16 + 0.6 * (v + 0.5) / 16) * 255));
let lcdRgb = null;
function nokiaInk() {
  const w = cv.width, h = cv.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (readbackOK()) {
    if (!lcdRgb) lcdRgb = [COL.lcdInk, COL.lcd].map(c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
    const [ink, bg] = lcdRgb, im = ctx.getImageData(0, 0, w, h), d = im.data;
    for (let y = 0, i = 0; y < h; y++) {
      const row = (y & 3) * 4;
      for (let x = 0; x < w; x++, i += 4) {
        const c = d[i + 3] > LCD_DITHER[row + (x & 3)] ? ink : bg;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(im, 0, 0);
  } else {
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = COL.lcdInk; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = COL.lcd; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

// A crit (v0.42, user: a GOOD indicator): the number pops in big and settles, on a spiky orange starburst, with a
// small CRIT tag over it. Gold with a dark edge, tilted a little.
// BLACK FLASH!'s impact frame (v0.55, user: "make the screen white for a split second like an impact frame", then
// "more impactful"): the world freezes (melee.js `stop`) and the view kicks in on the hit; the screen goes white with
// everything inked in black (the lightning, the enemies, you) and focus lines rushing in on the hit, then flips to its
// negative (black, the lightning white in a red glow, white lines), then white again, then the white fades out. The
// lines jump to new places every few hundredths of a second. Timed by the fight (combat.js update), so it slows down
// in the effects lab. With reduced motion: only a soft white flash, no zoom, no flicker. (In the world's transform; the
// fills cover the whole view.)
const impactEnd = F => F.a + F.b + F.c + F.fade;
function impactZoom() {
  const f = game.bfFrame;
  if (!f || reducedMotion || game.inMenu) return;
  const F = MELEE.blackFlash.frame, k = 1 + F.zoom * Math.max(0, 1 - f.t / impactEnd(F)) ** 2;
  ctx.translate(f.x, f.y); ctx.scale(k, k); ctx.translate(-f.x, -f.y);
}
function drawImpactFrame() {
  const f = game.bfFrame;
  if (!f) return;
  const F = MELEE.blackFlash.frame, t = f.t, end = impactEnd(F);
  if (t >= end || game.inMenu) { game.bfFrame = null; return; }
  const view = () => { ctx.save(); ctx.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0); ctx.fillRect(0, 0, VW, VH); ctx.restore(); };
  ctx.save();
  if (reducedMotion) {
    ctx.globalAlpha = 0.35 * (1 - t / end); ctx.fillStyle = '#ffffff'; view();
    ctx.restore(); return;
  }
  const neg = t >= F.a && t < F.a + F.b, held = t < F.a + F.b + F.c, a = held ? 1 : 1 - (t - F.a - F.b - F.c) / F.fade;
  const ink = neg ? '#ffffff' : '#000000';
  ctx.globalAlpha = a; ctx.fillStyle = neg ? '#000000' : '#ffffff'; view();
  const rnd = mulberry32((Math.floor(t / 0.03) * 7919 + 17) | 0), far = Math.max(VW, VH) / viewZoom * 1.3;
  ctx.fillStyle = ink; ctx.globalAlpha = a * 0.85;     // the focus lines: thin wedges rushing in on the hit
  ctx.beginPath();
  for (let k = 0; k < F.lines; k++) {
    const ang = (k + rnd()) / F.lines * TAU, w = 0.004 + rnd() * 0.012, inner = 110 + rnd() * 150;
    ctx.moveTo(f.x + Math.cos(ang - w) * far, f.y + Math.sin(ang - w) * far);
    ctx.lineTo(f.x + Math.cos(ang) * inner, f.y + Math.sin(ang) * inner);
    ctx.lineTo(f.x + Math.cos(ang + w) * far, f.y + Math.sin(ang + w) * far);
  }
  ctx.fill();
  for (const m of game.melees) if (m.kind === 'impact' && !m.small) drawBoltTree(boltTree(m), a, neg ? 'neg' : 'ink', '#000000', boltReach(m));   // the lightning
  ctx.globalAlpha = a; ctx.fillStyle = ink;            // the enemies and you, as silhouettes
  for (const e of game.enemies) {
    if (ENEMY_TYPES[e.type]?.shape === 'square' && !e.boss) ctx.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
    else circle(e.x, e.y, e.r);
  }
  circle(game.player.x, game.player.y, PLAYER.r + 1);
  ctx.restore();
}
// BLACK FLASH!! in the manga's lettering (user's reference): heavy black letters, a white edge, a red glow round
// them; it slams in big and settles, tilted a little.
function drawMangaText(f) {
  const q = 1 - f.life / (f.max || 1.2), s = q < 0.1 ? 1.7 - 7 * q : 1, shake = q < 0.25 && !reducedMotion ? (Math.random() - 0.5) * 3 : 0;
  tctx.save(); tctx.translate(f.x + shake, f.y); tctx.rotate(-0.07); tctx.scale(s, s);
  tctx.globalAlpha = Math.min(1, f.life * 3);
  tctx.font = '400 40px Bangers, "Chakra Petch", Impact, sans-serif'; tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
  tctx.lineJoin = 'round';
  tctx.shadowColor = COL.flashHi; tctx.shadowBlur = 22;
  tctx.strokeStyle = COL.flashHi; tctx.lineWidth = 11; tctx.strokeText(f.text, 0, 0);
  tctx.shadowBlur = 0;
  tctx.strokeStyle = '#ffffff'; tctx.lineWidth = 5; tctx.strokeText(f.text, 0, 0);
  tctx.fillStyle = COL.flash; tctx.fillText(f.text, 0, 0);
  tctx.restore();
}
function drawCritText(f) {
  const age = (f.max || 0.9) - f.life, pop = reducedMotion ? 1 : 1 + 1.1 * Math.exp(-age * 14);
  const c = tctx, fade = Math.min(1, f.life * 3);
  c.save(); c.translate(f.x, f.y); c.rotate(-0.1); c.scale(pop, pop);
  c.globalAlpha = fade * 0.9;
  c.beginPath();                                   // the starburst behind the number
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + age * 1.5, r = i % 2 ? 13 : 24; c.lineTo(Math.cos(a) * r * 1.35, -9 + Math.sin(a) * r); }
  c.closePath();
  c.fillStyle = COL.relic; c.fill();
  c.lineWidth = 2.5; c.strokeStyle = 'rgba(0, 0, 0, .75)'; c.stroke();
  c.globalAlpha = fade;
  c.font = '800 26px "Chakra Petch", system-ui, sans-serif';
  c.lineWidth = 5; c.strokeStyle = 'rgba(40, 10, 0, .95)'; c.lineJoin = 'round'; c.strokeText(f.text, 0, 0);
  c.fillStyle = COL.wheelHi; c.fillText(f.text, 0, 0);
  c.font = '800 11px "Chakra Petch", system-ui, sans-serif';   // the tag
  c.lineWidth = 3; c.strokeStyle = 'rgba(0, 0, 0, .9)'; c.strokeText('CRIT', 0, -24);
  c.fillStyle = '#fff'; c.fillText('CRIT', 0, -24);
  c.restore();
}

// Every enemy's HP (v0.55, user): a thin bar over it, a dark track with its colour filling it, brighter once it's hurt.
// Not the bosses (they have their own bars), AWAS's apples (theirs is drawn with them) or the store's dummies.
const ENEMY_HP = { h: 3, gap: 6, min: 18 };
function drawEnemyHp() {
  const H = ENEMY_HP;
  if (game.practice?.demo) return;                   // (none in the main menu's demo fight: user)
  for (const e of game.enemies) {
    if (e.boss || e.obi || e.makora || e.apple || e.hugeSnek || e.dummy || e.mrock || !(e.maxHp > 0) || e.born < 0.6) continue;
    const w = Math.max(H.min, e.r * 2), x = e.x - w / 2, y = e.y - e.r * (e.shape === 'crab' ? 1.6 : 1) - H.gap - H.h;
    const q = Math.max(0, Math.min(1, e.hp / e.maxHp)), hurt = q < 1;
    ctx.globalAlpha = hurt ? 0.75 : 0.45; ctx.fillStyle = COL.floor; ctx.fillRect(x - 1, y - 1, w + 2, H.h + 2);
    ctx.globalAlpha = hurt ? 1 : 0.6; ctx.fillStyle = e.hit > 0 ? COL.player : enemyCol(e); ctx.fillRect(x, y, w * q, H.h);
  }
  ctx.globalAlpha = 1;
}

// KARISHNIKOV's LINE SHOT! (v0.59): a thin red line from you onto its target, a dot on it, getting brighter until the shot.
function drawAimLines() {
  const p = game.player;
  for (const f of game.sinfx) {
    if (f.kind !== 'aim') continue;
    const e = f.target, live = e && game.enemies.includes(e);
    if (live) f.a = Math.atan2(e.y - p.y, e.x - p.x);
    const a = f.a ?? p.face ?? 0, len = f.far ? edgeDist(p.x, p.y, a) : live ? Math.hypot(e.x - p.x, e.y - p.y) : AK.line.range;
    const q = Math.min(1, (f.max - f.life) / AK.aim);   // (×3's stays on, full, through its 3 rounds: v0.66)
    const blink = reducedMotion || q > 0.6 ? 1 : 0.6 + 0.4 * Math.sin(q * 40);
    fxAdd(COL.berserk);
    ctx.globalAlpha = (0.35 + 0.6 * q) * blink; ctx.strokeStyle = COL.berserk; ctx.lineWidth = 1 + q * 1.5;
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * PLAYER.r, p.y + Math.sin(a) * PLAYER.r); ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len); ctx.stroke();
    if (live) { ctx.fillStyle = COL.berserk; circle(e.x, e.y, 2.5 + q * 2); ctx.globalAlpha *= 0.6; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 - q * 3, 0, TAU); ctx.stroke(); }
    fxNormal();
  }
  ctx.globalAlpha = 1;
}
// Flashbang's dazed enemies (v0.58, user: "the enemy stops and a small dazed icon"): little stars circling over each one.
// v0.59: Blowpipe's sleeping ones get a zzz drifting up instead, and BERSERK! ones a red glow and an anger mark.
function drawDazed() {
  const t = reducedMotion ? 0 : performance.now() / 1000;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of game.enemies) {
    if (e.sleep > 0 && e.stun > 0) {
      const R = e.r || 10, a0 = Math.min(1, e.sleep / 0.3);
      for (let k = 0; k < 3; k++) {
        const u = (t * 0.8 + k / 3) % 1, x = e.x + R * 0.7 + u * 12 + Math.sin(u * 6 + k) * 2, y = e.y - R - 10 - u * 20;
        ctx.globalAlpha = a0 * Math.sin(u * Math.PI); ctx.fillStyle = COL.blowpipe;
        ctx.font = `700 ${10 + u * 7}px "Chakra Petch", system-ui, sans-serif`; ctx.fillText('z', x, y);
      }
    }
    if (e.berserk > 0) {
      const R = e.r || 10, a0 = Math.min(1, e.berserk / 0.4), pulse = 0.6 + 0.4 * Math.sin(t * 14);
      fxGlow(e.x, e.y, R * 2.8, COL.berserk, 0.85 * a0 * pulse);
      ctx.globalAlpha = 0.5 * a0; ctx.strokeStyle = COL.berserk; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, R + 5 + pulse * 2, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a0; ctx.strokeStyle = COL.berserk; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const x = e.x + R * 0.7, y = e.y - R - 6;                       // the anger mark: four little corners
      for (let k = 0; k < 4; k++) {
        const b = k * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(b) * 4, cy = y + Math.sin(b) * 4;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(b + 0.9) * 2.6, cy + Math.sin(b + 0.9) * 2.6); ctx.lineTo(cx, cy); ctx.lineTo(cx + Math.cos(b - 0.9) * 2.6, cy + Math.sin(b - 0.9) * 2.6); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffe36b';
  for (const e of game.enemies) {
    if (!(e.dazed > 0 && e.stun > 0) || e.sleep > 0) continue;
    const y = e.y - (e.r || 10) - 9, rx = Math.max(8, (e.r || 10) * 0.8);
    ctx.globalAlpha = Math.min(1, e.dazed / 0.3);
    for (let k = 0; k < 3; k++) {
      const a = t * 4 + k * TAU / 3, x = e.x + Math.cos(a) * rx, yy = y + Math.sin(a) * 3, s = 3.2;
      ctx.beginPath(); ctx.moveTo(x, yy - s); ctx.lineTo(x + s * 0.3, yy - s * 0.3); ctx.lineTo(x + s, yy); ctx.lineTo(x + s * 0.3, yy + s * 0.3);
      ctx.lineTo(x, yy + s); ctx.lineTo(x - s * 0.3, yy + s * 0.3); ctx.lineTo(x - s, yy); ctx.lineTo(x - s * 0.3, yy - s * 0.3); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// A potion (v0.58, user: "3d, like the T-Balls"): a round glass flask lit from the top left. Its shadow on the floor
// shrinks as it bobs up; inside, red liquid sloshes from side to side, its surface seen from a little above, with a few
// bubbles rising; then the glass over it (a rim of light, darker at the bottom right), a glass neck with a lip, a cork,
// and the shine.
const shadeHex = (hex, f) => {                     // lighter (f > 0, toward white) or darker (f < 0, toward black)
  const n = parseInt(hex.slice(1, 7), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
function drawPotion(pt) {
  const r = POTION.r, t = reducedMotion ? 0 : pt.t, bob = Math.sin(t * 3) * 2, x = pt.x, y = pt.y + bob, red = COL.potion;
  const a = Math.min(1, pt.t * 4);
  ctx.globalAlpha = a * (0.32 - bob * 0.03); ctx.fillStyle = '#000000';                  // its shadow on the floor
  ctx.beginPath(); ctx.ellipse(x, pt.y + r + 4, r * (1.05 - bob * 0.05), r * 0.32, 0, 0, TAU); ctx.fill();
  fxGlow(x, y, r * 2.8, red, 0.4 * a);
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  // the glass behind the liquid: faint, darker inside
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; circle(0, 0, r);
  // the liquid: the bottom of the sphere below a surface that tilts as it sloshes
  const lvl = r * 0.12, tilt = Math.sin(t * 2.4) * 0.22;
  ctx.save(); ctx.rotate(tilt);
  const lg = ctx.createRadialGradient(-r * 0.35, -r * 0.1, r * 0.1, 0, r * 0.15, r * 1.05);
  lg.addColorStop(0, shadeHex(red, 0.2)); lg.addColorStop(0.5, red); lg.addColorStop(1, shadeHex(red, -0.55));
  const sa = Math.asin(lvl / (r - 0.6));
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, 0, r - 0.6, sa, Math.PI - sa); ctx.closePath(); ctx.fill();
  const hw = Math.sqrt((r - 0.6) ** 2 - lvl * lvl);                                      // its surface, an ellipse seen from above
  ctx.fillStyle = shadeHex(red, 0.3); ctx.beginPath(); ctx.ellipse(0, lvl, hw, r * 0.17, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.beginPath(); ctx.ellipse(-hw * 0.3, lvl - r * 0.03, hw * 0.35, r * 0.05, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 235, 238, 0.75)';                                            // bubbles rising through it
  for (let k = 0; k < 3; k++) {
    const u = (t * (0.5 + k * 0.17) + k * 0.37) % 1, bx = (k - 1) * r * 0.35 + Math.sin(t * 3 + k) * 0.6, by = r * 0.75 - u * r * 0.6;
    ctx.globalAlpha = a * Math.sin(u * Math.PI) * 0.9; circle(bx, by, 0.55 + k * 0.15);
  }
  ctx.globalAlpha = a;
  // the glass over it: a rim of light, brighter at the top left, and a darker edge at the bottom right
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.85)'); rim.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)'); rim.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.strokeStyle = rim; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r - 0.9, 0.1, 1.7); ctx.stroke();
  // the neck: a glass cylinder, light on its left, with a lip at the top
  const nw = r * 0.42, top = -r - 3.6, ng = ctx.createLinearGradient(-nw, 0, nw, 0);
  ng.addColorStop(0, 'rgba(255, 255, 255, 0.75)'); ng.addColorStop(0.4, 'rgba(255, 255, 255, 0.25)'); ng.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
  ctx.fillStyle = ng; ctx.fillRect(-nw, top, nw * 2, r * 0.25 + 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.beginPath(); ctx.ellipse(0, top, nw + 0.9, 1.1, 0, 0, TAU); ctx.fill();
  // the cork: rounded, lit from the left, its top an ellipse
  const cg = ctx.createLinearGradient(-nw, 0, nw, 0);
  cg.addColorStop(0, '#e2b07a'); cg.addColorStop(0.5, '#b07a45'); cg.addColorStop(1, '#6e4524');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(-nw + 0.3, top - 3.4, nw * 2 - 0.6, 3.6, 1); ctx.fill();
  ctx.fillStyle = '#f0c896'; ctx.beginPath(); ctx.ellipse(0, top - 3.4, nw - 0.3, 0.9, 0, 0, TAU); ctx.fill();
  // the shine on the glass
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.42, r * 0.28, r * 0.13, -0.75, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; circle(r * 0.38, r * 0.35, 0.7);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* The cannonball in fake 3D (v0.64, user: "make the canonball look more 3d like the fake 3d again so it looks nice as it
   spins"): an iron sphere lit from the top left (the light stays put), with a cast seam round it and six rivets that
   roll with it. Its marks are kept in the ball's own frame (u: its flight, a: across it, n: toward you); it rolls
   forward about `a`, `roll` radians (its distance flown over its radius, as if on the ground), so the seam tumbles over
   (a line, an ellipse, the rim) as it goes. Only the half facing you is drawn, each mark squashed and faded toward the
   rim. A shadow under it lifts it off the floor; a soft glint of the weapon's colour on its lower edge. */
const IRON_RIVETS = [[0.62, 0.62, 0.48], [-0.62, 0.62, -0.48], [0.62, -0.62, -0.48], [-0.62, -0.62, 0.48], [0.9, 0, -0.44], [-0.9, 0, 0.44]]
  .map(p => { const l = Math.hypot(...p); return p.map(v => v / l); });
const IRON_SEAM = Array.from({ length: 48 }, (_, i) => {   // a great circle across the flight (tilted 30°: it tumbles, it doesn't just turn)
  const t = i / 48 * TAU, k = Math.PI / 6;
  return [-Math.sin(k) * Math.cos(t), Math.cos(k) * Math.cos(t), Math.sin(t)];
});
function ironBall(x, y, r, vx, vy, roll, color) {
  shotShadow(x, y, r, r * 0.9);
  // the body: dark iron, light on its top left, dark at its rim
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
  g.addColorStop(0, COL.cannonHi); g.addColorStop(0.35, COL.cannonBall); g.addColorStop(0.85, '#16181d'); g.addColorStop(1, '#0a0b0e');
  ctx.globalAlpha = 1; ctx.fillStyle = g; circle(x, y, r);
  // its frame on screen, and its roll: forward about the axis across its flight
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, ax = -uy, ay = ux, c = Math.cos(roll), s = Math.sin(roll);
  const place = ([pu, pa, pn]) => { const u = pu * c + pn * s, n = pn * c - pu * s; return [u * ux + pa * ax, u * uy + pa * ay, n]; };
  // the seam: a dark groove with a faint lit edge, in runs over the side facing you
  const seam = IRON_SEAM.map(place);
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  for (const [w, col, k] of [[r * 0.15, '#07080b', 0.75], [r * 0.05, COL.cannonHi, 0.35]]) {
    ctx.lineWidth = w; ctx.strokeStyle = col;
    for (let i = 0; i < seam.length; i++) {
      const a = seam[i], b = seam[(i + 1) % seam.length];
      if (a[2] <= 0 || b[2] <= 0) continue;
      ctx.globalAlpha = k * Math.min(1, Math.min(a[2], b[2]) * 3);
      const o = k < 0.5 ? -r * 0.05 : 0;              // (the lit edge, just above the groove)
      ctx.beginPath(); ctx.moveTo(x + a[0] * r * 0.98, y + a[1] * r * 0.98 + o); ctx.lineTo(x + b[0] * r * 0.98, y + b[1] * r * 0.98 + o); ctx.stroke();
    }
  }
  // the rivets: little domes, foreshortened toward the rim, lit on their top left
  for (const p of IRON_RIVETS.map(place)) {
    if (p[2] <= 0.05) continue;
    const px = x + p[0] * r * 0.9, py = y + p[1] * r * 0.9, rr = r * 0.14, ang = Math.atan2(p[1], p[0]), sq = rr * (0.2 + 0.8 * p[2]);
    ctx.globalAlpha = Math.min(1, p[2] * 2);
    ctx.fillStyle = '#0b0c10'; ctx.beginPath(); ctx.ellipse(px, py, sq, rr, ang, 0, TAU); ctx.fill();
    ctx.fillStyle = COL.cannonHi; ctx.globalAlpha *= 0.8;
    ctx.beginPath(); ctx.ellipse(px - rr * 0.28, py - rr * 0.3, sq * 0.42, rr * 0.42, ang, 0, TAU); ctx.fill();
  }
  // the light on it (it doesn't turn), and a soft glint of the weapon's colour on its lower right
  ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(255, 255, 255, .9)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.4, y - r * 0.46, r * 0.22, r * 0.13, -0.7, 0, TAU); ctx.fill();
  const rim = ctx.createRadialGradient(x + r * 0.5, y + r * 0.55, 0, x + r * 0.5, y + r * 0.55, r * 0.7);
  rim.addColorStop(0, hexA(color, 0.35)); rim.addColorStop(1, hexA(color, 0));
  ctx.globalAlpha = 1; ctx.fillStyle = rim; circle(x, y, r);
  ctx.lineCap = 'round';
}

/* A clay brick in fake 3D (v0.64, user: "make the brickshot looks like an actual brick … and make it 3d too"): a box
   (2.6 × 1.25 × 0.8 of its radius) turning end over end along its flight (`turn` radians) and slowly rolling about its
   length, so every face comes round. Each face facing you is drawn, lit by how much it faces the light (top left), in
   clay red with darker mortar-stained edges; the two big faces have the three holes a real brick has. A shadow under it
   on the floor. */
const BRICK3D = { size: [1.3, 0.62, 0.4], clay: [182, 84, 52], hole: '#2a1009', edge: 'rgba(40, 14, 6, .55)', light: [-0.45, -0.55, 0.7] };
const BRICK_FACES = [   // corners as ±1 per axis (x: its length, y: its width, z: its height), and the face's normal
  { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] }, { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] }, { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], holes: true }, { n: [0, 0, -1], c: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], holes: true },
];
function brick3d(x, y, r, vx, vy, turn) {
  shotShadow(x, y, r * 1.6, r * 1.4);
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, ax = -uy, ay = ux;
  const c1 = Math.cos(turn), s1 = Math.sin(turn), c2 = Math.cos(turn * 0.37), s2 = Math.sin(turn * 0.37);
  // brick space → screen: roll about its length, then end over end about the axis across its flight
  const rot = ([px, py, pz]) => {
    const y1 = py * c2 - pz * s2, z1 = py * s2 + pz * c2;         // (roll, about x)
    const x2 = px * c1 + z1 * s1, z2 = z1 * c1 - px * s1;         // (end over end, about y)
    return [x2 * ux + y1 * ax, x2 * uy + y1 * ay, z2];
  };
  const [hx, hy, hz] = BRICK3D.size.map(v => v * r), L = BRICK3D.light;
  const pt = ([cx, cy, cz]) => { const p = rot([cx * hx, cy * hy, cz * hz]); return [x + p[0], y + p[1]]; };
  ctx.lineJoin = 'round';
  for (const f of BRICK_FACES) {
    const n = rot(f.n);
    if (n[2] <= 0.01) continue;                                    // (facing away)
    const lit = 0.38 + 0.62 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const [cr, cg, cb] = BRICK3D.clay.map(v => Math.round(Math.min(255, v * lit * 1.15)));
    const ps = f.c.map(pt);
    ctx.globalAlpha = 1; ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    ctx.beginPath(); ps.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = BRICK3D.edge; ctx.lineWidth = Math.max(0.8, r * 0.12); ctx.stroke();
    if (f.holes) {                                                 // the three holes through it, foreshortened with the face
      const z = f.n[2];
      for (const hxk of [-0.55, 0, 0.55]) {
        const ctr = pt([hxk, 0, z]), ex = pt([hxk + 0.17, 0, z]), ey = pt([hxk, 0.42, z]);
        const rx = Math.hypot(ex[0] - ctr[0], ex[1] - ctr[1]), ry = Math.hypot(ey[0] - ctr[0], ey[1] - ctr[1]), a = Math.atan2(ex[1] - ctr[1], ex[0] - ctr[0]);
        ctx.fillStyle = BRICK3D.hole; ctx.globalAlpha = 0.5 + 0.5 * n[2];
        ctx.beginPath(); ctx.ellipse(ctr[0], ctr[1], Math.max(0.3, rx), Math.max(0.3, ry), a, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}
