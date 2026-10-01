/* draw.js — Canvas drawing: basic shapes plus effects. */
'use strict';

/* ---------- drawing ---------- */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

const TAU = Math.PI * 2;
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }

// Ready to use (user): your relics show on you while their cooldown is done, fading in and out. BULL: a pair of
// horns on top of you and a soft glow, in its orange. DEFLECT: its shield's three arcs, still and faint, in blue.
// (Gone while you use them: the charge and the shield draw their own.)
function drawRelicReady(p) {
  const t = performance.now() / 1000, pulse = k => reducedMotion ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * TAU / 1.4 + k));
  if (game.relics.includes('deflect') && !(game.deflCd > 0) && !(game.defl > 0)) {
    const a = pulse(Math.PI), R = PLAYER.r + 7;
    ctx.strokeStyle = COL.deflect; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.12 * a; ctx.fillStyle = COL.deflect; circle(p.x, p.y, R);
    ctx.globalAlpha = 0.85 * a;
    for (let i = 0; i < 3; i++) { const s = -Math.PI / 2 + i * TAU / 3 + 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, R, s, s + 1.4); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (game.relics.includes('bull') && !(game.dashCd > 0)) {
    const a = pulse(0), r = PLAYER.r;
    ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = COL.relic; ctx.lineWidth = 3;   // a glow round you, not over you
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.55 + 0.45 * a; ctx.fillStyle = COL.relic;
    for (const s of [-1, 1]) {                               // a horn either side of the top, rooted on your edge, curving up and out
      ctx.beginPath();
      ctx.moveTo(p.x + s * r * 0.45, p.y - r * 0.9);
      ctx.quadraticCurveTo(p.x + s * r * 0.55, p.y - r - 9, p.x + s * (r + 8), p.y - r - 11);
      ctx.quadraticCurveTo(p.x + s * (r + 3), p.y - r * 0.75, p.x + s * r * 0.92, p.y - r * 0.4);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
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

function drawBoss(b) {
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

// A cartoon water spray (user's reference: a converging jet fanning out into a splashy burst, a bright core
// stripe, and droplets round the tip), drawn along local +x out to `len`, from the Powerwash pack. `seed` keeps
// the splash's wobble and the droplets' scatter stable frame to frame (no per-frame flicker); `alpha` fades it.
// The golden-ratio steps below give each droplet a stable, well-spread "random" position without Math.random().
function waterSpray(len, w1, col, seed, alpha = 1) {
  const t = performance.now() / 500, w0 = Math.min(4, w1 * 0.2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 * alpha; ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -w0); ctx.lineTo(len * 0.8, -w1 * 0.85); ctx.lineTo(len, -w1 * 0.3);
  ctx.lineTo(len, w1 * 0.3); ctx.lineTo(len * 0.8, w1 * 0.85); ctx.lineTo(0, w0);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.85 * alpha; ctx.fillStyle = COL.player;   // the bright core stripe down the middle
  ctx.beginPath();
  ctx.moveTo(0, -w0 * 0.4); ctx.lineTo(len * 0.85, -w1 * 0.22); ctx.lineTo(len * 0.85, w1 * 0.22); ctx.lineTo(0, w0 * 0.4);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.45 * alpha; ctx.fillStyle = col;           // the splash, a wobbling spiky burst at the tip
  const spikes = 10, R = w1 * 0.85;
  ctx.beginPath();
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * TAU, wob = 0.65 + 0.35 * Math.sin(a * 3 + t * 3 + seed);
    const r = R * wob;
    const x = len + Math.cos(a) * r * 0.55, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = col;                                          // droplets flung out round the splash
  for (let j = 0; j < 8; j++) {
    const rj = (j * 0.618034) % 1, a0 = rj * TAU + seed, bob = Math.sin(t * 2 + j * 2 + seed) * 2;
    const dl = len * (0.6 + 0.4 * ((j * 7) % 5) / 5), r0 = w1 * (0.4 + 0.5 * ((j * 3) % 5) / 5);
    const x = dl + Math.cos(a0) * r0 * 0.4, y = Math.sin(a0) * r0 + bob;
    ctx.globalAlpha = (0.3 + 0.35 * ((j * 5) % 5) / 5) * alpha;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a0);
    ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
// Super Washer's spinning jet (user): the water spray above, sweeping round the player.
function drawWaterJet(x, y, a, len, seed) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  waterSpray(len, Math.max(16, len * 0.16), COL.superwasher, seed);
  ctx.restore();
}
// A puddle of water on the ground (user's reference: a flat wobbly-edged blob with a couple of small drops beside
// it), for SOAK TRAIL!'s dropped trail. `q` (0→1, near its pop) swells it a little and brightens its rim.
function waterPuddle(x, y, r, seed, q, alpha = 1) {
  const col = COL.superwasher, R = r * (0.85 + 0.3 * q);
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * TAU, wob = 1 + 0.22 * Math.sin(a * 3 + seed) + 0.12 * Math.sin(a * 5 + seed * 1.7);
    const px = Math.cos(a) * R * 1.25 * wob, py = Math.sin(a) * R * 0.7 * wob;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = (0.22 + 0.15 * q) * alpha; ctx.fillStyle = col; ctx.fill();
  ctx.globalAlpha = (0.55 + 0.2 * q) * alpha; ctx.strokeStyle = COL.player; ctx.lineWidth = 1.3; ctx.stroke();
  for (let k = 0; k < 2; k++) {                          // a couple of small satellite drops beside it
    const a2 = seed * 1.3 + k * 2.6, d2 = R * (1.5 + k * 0.4), sx = Math.cos(a2) * d2, sy = Math.sin(a2) * d2 * 0.6;
    const dr = R * (0.22 - k * 0.06);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a2);
    ctx.globalAlpha = (0.2 + 0.12 * q) * alpha; ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, dr, dr * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = (0.5 + 0.15 * q) * alpha; ctx.strokeStyle = COL.player; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, dr, dr * 0.6, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function draw() {
  ctx.save();
  updateCam();                            // co-op's bigger arena, and a boss's square one: the view follows you (coop.js)
  ctx.fillStyle = arenaMode === 'boss' ? COL.crack : COL.line; ctx.fillRect(0, 0, VW, VH);   // beyond the arena's edge (darker round a boss's)
  ctx.scale(viewZoom, viewZoom);          // zoomed out for the swarm, in for a boss (arena.js)
  ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = COL.floor;
  ctx.fillRect(0, 0, W, H);
  const wall = arenaWall();               // a boss fight's arena wall (below) replaces co-op's plain edge
  if (NET.run && wall < 1) { ctx.strokeStyle = COL.bad; ctx.globalAlpha = 0.35 * (1 - wall); ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3); ctx.globalAlpha = 1; }
  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 28;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  boneInv = ctx.getTransform().inverse();   // (the bosses' body parts, for their hitboxes: combat.js boneMark)
  if (wall > 0) drawArenaWall(wall);

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

  for (const r of game.rings) {
    ctx.globalAlpha = Math.max(0, r.life / 0.4);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, r.r), 0, Math.PI * 2); ctx.stroke();
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
    const y = pt.y + (reducedMotion ? 0 : Math.sin(pt.t * 3) * 2);
    ctx.globalAlpha = Math.min(1, pt.t * 4);
    ctx.fillStyle = COL.potion; ctx.globalAlpha *= 0.2; circle(pt.x, y - 2, POTION.r + 7); ctx.globalAlpha = Math.min(1, pt.t * 4);   // soft glow
    ctx.fillStyle = COL.player; ctx.fillRect(pt.x - 2.5, y - 11, 5, 5);            // neck
    ctx.fillStyle = COL.potion; circle(pt.x, y, POTION.r);                          // body (red, user)
    ctx.fillStyle = COL.player; ctx.globalAlpha *= 0.6; circle(pt.x - 2.5, y - 2.5, 2);   // shine
    ctx.globalAlpha = 1;
  }

  drawSilicaFloor();                     // the Cryo Magus's frost fields and where the chimera's bombs land (silica.js)

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

  // enemies: squares (normal and big) and triangles that point where they're heading (no health lines since v0.51,
  // user: only the bosses show their HP)
  for (const k of game.mrocks) drawKickRock(k);   // MAKORA's kicked rocks (makora.js)
  for (const e of game.enemies) {
    if (e.boss) { drawBoss(e); continue; }
    if (e.makora) { if (!e.down) drawMakora(e); continue; }
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
  }
  // the shooters' orbs: slow, red and glowing (they don't home)
  for (const b of game.eshots) {
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
  for (const pr of game.projectiles) {
    const color = COL[pr.card], t = pr.trail;
    if (pr.look === 'ice') { drawIceShot(pr); continue; }   // Cryo Magus (silica.js)
    if (pr.look === 'bubble') {                              // Soap Gun (user): a transparent, soapy bubble
      // A floaty sway (user): drawn a little off its real (hit-tested) position, drifting on its own stable phase.
      const st = performance.now() / 260 + (pr.sway || 0), bx = pr.x + Math.sin(st) * 2.5, by = pr.y + Math.cos(st * 0.8) * 1.6;
      ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, pr.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.14; ctx.fillStyle = color; circle(bx, by, pr.r);
      ctx.globalAlpha = 0.6; ctx.fillStyle = COL.player;
      ctx.beginPath(); ctx.ellipse(bx - pr.r * 0.35, by - pr.r * 0.35, Math.max(1, pr.r * 0.3), Math.max(1, pr.r * 0.18), -0.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (pr.look === 'sniper') {              // Sniper (v0.30): a long, thin tracer with a bright core; the Railgun is a thick one with a glow
      const L = Math.min(pr.flown, pr.big ? 150 : 110), bx = pr.x - Math.cos(pr.a) * L, by = pr.y - Math.sin(pr.a) * L;
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
      continue;
    }
    if (pr.look === 'amissile') {            // Arcane Missiles (v0.30): a glowing dart with a curving, fading trail
      ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 2; i < t.length; i += 2) {
        const k = i / t.length;
        ctx.globalAlpha = k * 0.6; ctx.lineWidth = 1 + k * pr.r;
        ctx.beginPath(); ctx.moveTo(t[i - 2], t[i - 1]); ctx.lineTo(t[i], t[i + 1]); ctx.stroke();
      }
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.globalAlpha = 0.3; ctx.fillStyle = color; circle(pr.x, pr.y, pr.r + 4);
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(pr.r * 2, 0); ctx.lineTo(-pr.r, -pr.r); ctx.lineTo(-pr.r * 0.4, 0); ctx.lineTo(-pr.r, pr.r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COL.player; ctx.beginPath(); ctx.arc(pr.r * 0.5, 0, pr.r * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (pr.look === 'missile') {             // Space Impact: a short body pointing where it flies, with an exhaust trail that grows as it speeds up
      const k = Math.min(1, pr.age / pr.ramp);
      ctx.strokeStyle = color; ctx.lineCap = 'round';
      if (t.length >= 4) {
        ctx.globalAlpha = 0.2 + 0.35 * k; ctx.lineWidth = 2 + k * 2;
        const back = Math.max(0, t.length - 2 - 2 * Math.round(1 + k * 4));   // always an x (trail is x, y pairs)
        ctx.beginPath(); ctx.moveTo(t[back], t[back + 1]); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.a);
      ctx.fillStyle = color; ctx.fillRect(-6, -2.5, 10, 5);
      ctx.beginPath(); ctx.moveTo(4, -2.5); ctx.lineTo(8, 0); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COL.player; ctx.globalAlpha = 0.5 + 0.5 * Math.random(); ctx.fillRect(-9, -1.5, 3, 3);   // flame flicker
      ctx.restore();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (pr.look === 'streak' || pr.look === 'spin' || pr.look === 'gat') {
      if (t.length >= 2) {
        ctx.globalAlpha = pr.look === 'spin' ? 0.25 : 0.45;
        ctx.lineWidth = Math.max(2, pr.r * 0.6); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(t[Math.max(0, t.length - 6)], t[Math.max(1, t.length - 5)]); ctx.lineTo(pr.x, pr.y); ctx.stroke();
      }
      if (pr.dmg >= 15) { ctx.globalAlpha = 0.25; circle(pr.x, pr.y, pr.r + 5); }     // Fire Bolt glow
    } else {
      for (let i = 0; i < t.length; i += 2) {
        const k = i / t.length;
        ctx.globalAlpha = k * 0.35;
        circle(t[i], t[i + 1], pr.r * (0.4 + k * 0.6));
      }
      ctx.globalAlpha = 0.25;
      circle(pr.x, pr.y, pr.r + (pr.look === 'heavy' ? 6 : 3));
    }
    ctx.globalAlpha = 1;
    if (pr.look === 'spin') {
      const s = pr.r * 1.5;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.spin);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    } else {
      circle(pr.x, pr.y, pr.r);
    }
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
  if (game.dash && !game.inMenu && Number.isFinite(game.dash.sx)) swoosh(game.dash.sx, game.dash.sy, game.player.x, game.player.y, 1);

  // BULL charge: afterimages fading out behind you
  ctx.fillStyle = COL.relic;
  for (const g of game.ghosts) {
    ctx.globalAlpha = (g.life / 0.2) * 0.35;
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
    if (trail > 0.02) {
      ctx.fillStyle = COL[sw.card]; ctx.globalAlpha = water ? 0.22 : 0.16;
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.arc(pp.x, pp.y, sw.len, a - trail, a); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (water) drawWaterJet(pp.x, pp.y, a, sw.len, sw.a0);
    else drawBeam(pp.x, pp.y, pp.x + Math.cos(a) * sw.len, pp.y + Math.sin(a) * sw.len, 1, 5, COL[sw.card]);
  }

  // player: a circle (hidden behind the start menu), stretched along a BULL charge
  const p = game.player, dsh = game.dash, da = dsh ? Math.atan2(dsh.dy, dsh.dx) : 0;
  ctx.fillStyle = NET.run ? (NET.me?.down ? COL.line : NET.me?.color || COL.player) : COL.player;   // co-op: your colour; grey when down
  if (!game.inMenu) {
    ctx.globalAlpha = p.safe > 0 && !dsh && Math.floor(p.safe * 20) % 2 ? 0.45 : 1;   // blink while safe after a hit
    if (NET.run && NET.me?.emoji) {     // co-op, with an emoji (v0.46): only the emoji, drawn crisp on the text layer
    } else if (dsh) ellipse(p.x, p.y, PLAYER.r * 1.25, PLAYER.r * 0.82, da);
    else circle(p.x, p.y, PLAYER.r);    // the Druid summons animals separately now (silica.js)
    ctx.globalAlpha = 1;
  }
  if (!game.inMenu && !dsh && !(NET.run && NET.me?.down)) drawRelicReady(p);   // your relics, when they're ready again
  if (dsh && !game.inMenu) {             // BULL charge: speed lines behind, a glowing wedge and a pair of horns in front
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
  if (game.shield > 0 && !game.inMenu) {
    const fade = Math.min(1, game.shield / 0.3), wob = reducedMotion ? 0 : Math.sin(performance.now() / 160) * 0.12;
    const rr = PLAYER.r + SHIELD.r;
    ctx.globalAlpha = fade * (0.1 + (game.shieldHit > 0 ? 0.15 : 0));
    ctx.fillStyle = COL.xp; circle(p.x, p.y, rr);
    ctx.globalAlpha = fade * (0.6 + wob + (game.shieldHit > 0 ? 0.3 : 0));
    ctx.strokeStyle = COL.xp; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (!game.inMenu) drawDeflect(p.x, p.y, game.defl, game.deflAge);   // DEFLECT's shield (obi.js)
  drawPullMeter();                       // the ring you fill to break OBI ONE's pull

  if (p.flash > 0) {                    // contact: a ring, so the player never blends into the swarm
    ctx.globalAlpha = p.flash / 0.2;
    ctx.strokeStyle = COL.bad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (game.muzzle) {
    const m = game.muzzle;
    ctx.globalAlpha = m.life / 0.12;
    ctx.fillStyle = COL[m.card];
    circle(p.x + Math.cos(m.a) * (PLAYER.r + 6), p.y + Math.sin(m.a) * (PLAYER.r + 6), CARDS[m.card].look === 'heavy' ? 12 : 6);
    ctx.globalAlpha = 1;
  }

  for (const q of game.particles) {
    ctx.globalAlpha = Math.min(1, q.life * 3);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Floating numbers and callouts: on their own full-resolution layer, so they stay sharp under the CRT filter
  // (user: text was unreadable at its low resolution). It shakes with the arena.
  tctx.save();
  tctx.clearRect(0, 0, VW, VH);
  tctx.scale(viewZoom, viewZoom);
  tctx.translate(-cam.x, -cam.y);
  if (game.shake > 0 && !reducedMotion) { const s = game.shake * 28; tctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
  drawCoopFaces();                        // co-op: emojis (coop.js), under the numbers
  tctx.textAlign = 'center';
  for (const f of game.floaters) {
    tctx.globalAlpha = Math.min(1, f.life * 3);
    if (f.crit) { drawCritText(f); continue; }
    tctx.fillStyle = f.color;
    // v0.30 (user): bigger, 11/15 px before, with a dark edge so they read over anything
    tctx.font = `700 ${f.crit ? 27 : f.big ? 22 : 16}px "Chakra Petch", system-ui, sans-serif`;   // a crit: 27 px (v0.41)
    tctx.lineWidth = 4; tctx.strokeStyle = 'rgba(0, 0, 0, .8)'; tctx.lineJoin = 'round'; tctx.strokeText(f.text, f.x, f.y);
    tctx.fillText(f.text, f.x, f.y);
  }
  drawCoopNames();
  drawPullText();
  tctx.restore();
}
// A crit (v0.42, user: a GOOD indicator): the number pops in big and settles, on a spiky orange starburst, with a
// small CRIT tag over it. Gold with a dark edge, tilted a little.
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
