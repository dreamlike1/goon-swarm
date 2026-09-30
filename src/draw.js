/* draw.js — Canvas drawing: basic shapes plus effects. */
'use strict';

/* ---------- drawing ---------- */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

const TAU = Math.PI * 2;
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }

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

function drawBoss(b) {
  const s = b.r * (0.5 + 0.5 * b.born), k = s / 30, t = b.anim, st = b.state, still = reducedMotion;
  if (st === 'windup') {                    // where the charge will go (user: thicker): a faint band as wide as the dino, and a thick dashed line
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
  if (st === 'charge') {                    // speed lines streaming off behind it
    const cx = Math.cos(b.dir), cy = Math.sin(b.dir);
    ctx.strokeStyle = COL.player; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const off = i * 11 * (b.r / 30), j = still ? 0 : Math.random() * 14, bx = b.x - cx * (b.r + 4) - cy * off, by = b.y - cy * (b.r + 4) + cx * off;
      ctx.globalAlpha = 0.25 + (2 - Math.abs(i)) * 0.1;
      const l = (26 + j) * (b.boss ? 1 : 0.5);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - cx * l, by - cy * l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (b.phase === 2) {                      // phase 2: a pulsing red heat around it
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6), R = b.r * (1.5 + 0.15 * pulse);
    const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.3, b.x, b.y, R);
    g.addColorStop(0, 'rgba(255, 60, 60, 0)'); g.addColorStop(0.55, `rgba(255, 60, 60, ${0.16 + 0.12 * pulse})`); g.addColorStop(1, 'rgba(255, 60, 60, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
  }

  // Pose, from its state.
  const facing = st === 'charge' || st === 'windup' ? Math.cos(b.dir) : game.player.x - b.x;
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
  // mini dinos are red (user, v0.12), SKURTOSAURUS stays green
  const body = b.hit > 0 ? COL.player : b.boss ? COL.boss : COL.enemy, dark = b.hit > 0 ? COL.player : b.boss ? COL.bossDark : COL.big;

  ctx.save();
  ctx.translate(b.x + jit, b.y); ctx.scale((facing < 0 ? -1 : 1) * k, k);
  // in a jump it rises off its shadow, which shrinks under it
  const air = st === 'jump' ? Math.sin(Math.PI * Math.min(1, 1 - b.t / BOSS.jump)) : 0;
  ctx.globalAlpha = 0.3 - air * 0.12; ctx.fillStyle = '#000'; ellipse(0, 32, 28 * (1 - air * 0.4), 6 * (1 - air * 0.4)); ctx.globalAlpha = 1;   // shadow
  if (air) ctx.translate(0, -air * BOSS.jumpHeight / k);
  dinoLeg(-5, 10 + crouch, farPh, stride, dark, false);                                         // far leg

  ctx.save();                                                // everything above the legs tilts around the hip
  ctx.translate(0, 10 + crouch - bob); ctx.rotate(lean); ctx.translate(0, -10);
  ctx.fillStyle = body;
  const tipY = -20 + tail;                                   // tail: thick at the hip, curling up to a round tip
  ctx.beginPath(); ctx.moveTo(-6, -8);
  ctx.quadraticCurveTo(-26, -4, -44, tipY);
  ctx.quadraticCurveTo(-47, tipY + 4, -43, tipY + 5);
  ctx.quadraticCurveTo(-30, 14, -2, 14);
  ctx.closePath(); ctx.fill();
  ellipse(3, 2, 18, 15, -0.35);                              // body
  ellipse(11, -12, 9, 13, 0.3);                              // neck

  ctx.save();                                                // head, nodding around the top of the neck
  ctx.translate(12, -20); ctx.rotate(head); ctx.translate(-12, 20);
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

// The store's test dummy: a target on a post, which flashes when hit.
function drawDummy(e) {
  const r = e.r, hit = e.hit > 0;
  ctx.fillStyle = COL.line; ctx.fillRect(e.x - 3, e.y, 6, r * 1.6);                 // post
  ctx.fillRect(e.x - r * 0.7, e.y + r * 1.5, r * 1.4, 4);                           // foot
  const rings = [COL.text, COL.bad, COL.text, COL.bad];
  rings.forEach((c, i) => { ctx.fillStyle = hit ? COL.player : c; circle(e.x, e.y, r * (1 - i * 0.24)); });
  ctx.fillStyle = hit ? COL.bad : COL.floor; circle(e.x, e.y, r * 0.12);
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

function draw() {
  ctx.save();
  ctx.fillStyle = COL.floor;
  ctx.fillRect(0, 0, W, H);
  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 28;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

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

  // enemies: squares (normal and big) and triangles that point where they're heading,
  // each with a thin health line above it once it's been hit
  for (const e of game.enemies) {
    if (e.boss) { drawBoss(e); continue; }
    if (e.makora) { if (!e.down) drawMakora(e); continue; }
    if (e.dummy) { drawDummy(e); continue; }
    const s = e.r * (0.4 + 0.6 * e.born);
    if (e.shape === 'dino') drawBoss(e);                     // mini dino: the boss drawing, small
    else {
      ctx.fillStyle = e.hit > 0 ? COL.player : enemyCol(e);
      // Splitters also carry a seam down the middle, where they'll split (so it's not colour alone).
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.shape === 'triangle') {
        ctx.rotate(Math.atan2(e.vy, e.vx));
        ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(-s, -s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
        if (e.split) { ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s * 1.1, 0); ctx.stroke(); }
      } else {
        ctx.fillRect(-s, -s, s * 2, s * 2);
        if (e.split) { ctx.strokeStyle = COL.floor; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (e.hp < e.maxHp) {
      const bw = e.r * 2, by = e.y - e.r - 7;
      ctx.fillStyle = COL.line; ctx.fillRect(e.x - e.r, by, bw, 2);
      ctx.fillStyle = enemyCol(e); ctx.fillRect(e.x - e.r, by, bw * Math.max(0, e.hp / e.maxHp), 2);
    }
  }

  // projectiles, by look: streak (a line trail), orb and heavy (fading circles), spin (a turning square)
  for (const pr of game.projectiles) {
    const color = COL[pr.card], t = pr.trail;
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
    if (pr.look === 'streak' || pr.look === 'spin') {
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
  if (game.dash && !game.inMenu) swoosh(game.dash.sx, game.dash.sy, game.player.x, game.player.y, 1);

  // BULL charge: afterimages fading out behind you
  ctx.fillStyle = COL.relic;
  for (const g of game.ghosts) {
    ctx.globalAlpha = (g.life / 0.2) * 0.35;
    ellipse(g.x, g.y, PLAYER.r * 1.2, PLAYER.r * 0.8, g.a);
  }
  ctx.globalAlpha = 1;

  // lasers: zaps, and Laser ×7's sweep (the beam, with the slice it just swept fading behind it)
  for (const b of game.beams) drawBeam(b.x1, b.y1, b.x2, b.y2, reducedMotion ? b.life / b.max : (b.life / b.max) * (0.75 + Math.random() * 0.25), b.w, COL[b.card]);
  for (const sw of game.sweeps) {
    const pp = game.player, a = sw.a ?? sw.a0, trail = Math.min(1.2, a - sw.a0);
    if (trail > 0.02) {
      ctx.fillStyle = COL[sw.card]; ctx.globalAlpha = 0.16;
      ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.arc(pp.x, pp.y, sw.len, a - trail, a); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawBeam(pp.x, pp.y, pp.x + Math.cos(a) * sw.len, pp.y + Math.sin(a) * sw.len, 1, 5, COL[sw.card]);
  }

  // player: a circle (hidden behind the start menu), stretched along a BULL charge
  const p = game.player, dsh = game.dash, da = dsh ? Math.atan2(dsh.dy, dsh.dx) : 0;
  ctx.fillStyle = COL.player;
  if (!game.inMenu) {
    ctx.globalAlpha = p.safe > 0 && !dsh && Math.floor(p.safe * 20) % 2 ? 0.45 : 1;   // blink while safe after a hit
    if (dsh) ellipse(p.x, p.y, PLAYER.r * 1.25, PLAYER.r * 0.82, da);
    else circle(p.x, p.y, PLAYER.r);
    ctx.globalAlpha = 1;
  }
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
  tctx.clearRect(0, 0, W, H);
  if (game.shake > 0 && !reducedMotion) { const s = game.shake * 28; tctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
  tctx.textAlign = 'center';
  for (const f of game.floaters) {
    tctx.globalAlpha = Math.min(1, f.life * 3);
    tctx.fillStyle = f.color;
    tctx.font = display.crt ? `700 ${f.big ? 17 : 13}px "Pixelify Sans", ui-monospace, monospace` : `600 ${f.big ? 15 : 11}px ui-monospace, Menlo, monospace`;
    if (display.crt) { tctx.lineWidth = 3; tctx.strokeStyle = 'rgba(0, 0, 0, .75)'; tctx.lineJoin = 'round'; tctx.strokeText(f.text, f.x, f.y); }   // a dark edge, for the scanlines
    tctx.fillText(f.text, f.x, f.y);
  }
  tctx.restore();
}
