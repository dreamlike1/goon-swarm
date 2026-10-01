/* melee.js — Melee (v0.53, THE COMBAT UPDATE!, user): the second deck, its attacks, combos and how they look. */
'use strict';

/* ============================================================
   Your melee deck plays at the same time as your ranged one, with the same sequences, shuffles and combos.
   It never waits (user: it "auto rotates"): when its turn comes and nothing is within reach, the card is used up and
   nothing shows. But it doesn't make you wait either (user: enemies got to you before the attack came): after a card
   that hit nothing, the next one goes off the moment an enemy is in reach (combat.js attackStep, `game.mprimed`).
     Knife Stab  · stabs the nearest enemy in reach
                 ×3 STAB FLURRY!  fast stabs, each in a random direction inside a cone
                 ×7 KNIFE THROW!  throws the knife, through everything in its path
     Punch       · a heavy punch at the nearest enemy in reach
                 ×3 FLURRY!       a flurry of punches
                 ×7 BLACK FLASH!  one huge punch, black lightning with red highlights where it lands, then 7 s of a
                                  see-through blue aura: super fast movement, attack speed and damage (upgrades.js
                                  reads `game.bflash`). Yours even if the punch hits nothing.
   Every number is a placeholder.
   ============================================================ */
const MELEE = {
  stab: { arc: 0.55, life: 0.16 },                         // a stab's width (rad) and how long it shows (s)
  punch: { arc: 0.95, life: 0.18 },
  stabFlurry: { count: 6, gap: 0.05, cone: 1.1, dmg: 6, reach: 1.2 },   // Knife ×3: `reach` × the knife's
  throw: { dmg: 40, range: 400, r: 8 },                    // Knife ×7: goes through everything until `range`
  flurry: { count: 8, gap: 0.06, dmg: 5, knock: 90 },      // Punch ×3
  blackFlash: { time: 7, speed: 1.6, atk: 0.55, dmg: 1.5, hit: 30, reach: 1.25, life: 0.26, size: 1.5, impact: 0.55 },   // Punch ×7
};
const angleTo = (e, p = game.player) => { const q = hitPoint(e, p.x, p.y); return Math.atan2(q.y - p.y, q.x - p.x); };

// One melee card's turn (combat.js shoot, for a melee card): at `e` if it's within reach, otherwise nothing at all.
// True if it struck.
function meleeStrike(card, e, o = {}) {
  const p = game.player, reach = rangeOf(card), look = CARDS[card].look;
  if (CARDS[card].self) { sinGuard(card); return true; }       // Iron Will (sins.js): on you, whatever is close
  if (!e || hitGap(e, p.x, p.y) > reach) return false;
  if (look === 'slam') { sinSlam(card); return true; }          // the SINS pack's melee (sins.js)
  if (look === 'kick') { sinKick(card, e); return true; }
  swing(card, o.angle ?? angleTo(e), reach, o);
  return true;
}
// How far the melee deck's next play reaches: a single card's reach, or its combo's (KNIFE THROW! flies far).
function meleeReach(seq, pos) {
  const cb = comboAt(seq, pos), card = seq[pos];
  if (cb?.n === 7 && card === 'knife') return MELEE.throw.range;
  return rangeOf(card) * (cb?.n === 7 && card === 'punch' ? MELEE.blackFlash.reach : 1);
}
// A stab or a punch along angle `a`: everything within `reach` and inside its width is hit. `side`: a punch's fist
// off to one side (the flurry's left-right).
function swing(card, a, reach, o = {}) {
  const spec = CARDS[card], knife = spec.look === 'knife', M = knife ? MELEE.stab : MELEE.punch, p = game.player;
  const dmg = damageOf(o.dmg ?? spec.dmg), knock = knockOf(o.knock ?? spec.knock);
  for (const e of game.enemies.slice()) {
    if (hitGap(e, p.x, p.y) > reach) continue;
    const q = hitPoint(e, p.x, p.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a));
    if (Math.abs(diff) > M.arc / 2 + Math.atan2(q.r || e.r, d)) continue;
    hitEnemy({ card, look: 'melee', dmg, knock, vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
  }
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: spec.look, card, a, reach, side: o.side || 0, life: M.life, max: M.life }));
  if (!o.quiet) SFX.melee(spec.look);
}

// A melee combo (combos.js runCombo hands these over). Like a single card, it only shows if it has something to hit,
// except BLACK FLASH!, which is yours either way. True if it did something.
function meleeCombo(cb, echo) {
  const { card, n } = cb, p = game.player, reach = rangeOf(card);
  const near = nearestEnemy(p, null, reach);
  const callout = () => {
    if (echo) return;
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: cb.name, color: COL[card], life: 0.9, vy: -40, big: true });
    SFX.combo(n, card);
  };
  switch (`${card}${n}`) {
    case 'knife3': {                                      // STAB FLURRY!
      if (!near) return false;
      const S = MELEE.stabFlurry, a0 = angleTo(near);
      callout();
      for (let k = 0; k < S.count; k++) later(k * S.gap, () => swing(card, a0 + (Math.random() - 0.5) * S.cone, reach * S.reach, { dmg: S.dmg, quiet: k % 2 > 0 }));
      return true;
    }
    case 'knife7': {                                      // KNIFE THROW!
      const T = MELEE.throw, e = nearestEnemy(p, null, T.range);
      if (!e) return false;
      callout();
      launch(card, angleTo(e), null, { pierce: 999, range: T.range, dmg: T.dmg, r: T.r });
      SFX.melee('throw');
      return true;
    }
    case 'punch3': {                                      // FLURRY!
      if (!near) return false;
      const F = MELEE.flurry;
      callout();
      for (let k = 0; k < F.count; k++) later(k * F.gap, () => {
        const e = nearestEnemy(game.player, null, reach);
        if (e) swing(card, angleTo(e) + (Math.random() - 0.5) * 0.35, reach, { dmg: F.dmg, knock: F.knock, side: k % 2 ? 6 : -6, quiet: k % 2 > 0 });
      });
      return true;
    }
    case 'punch7': blackFlash(card, echo, callout); return true;   // BLACK FLASH!
  }
  return false;
}

// BLACK FLASH! (user): one punch, bigger than the rest. Where it lands, black lightning with red highlights bursts out;
// then 7 s of a see-through blue aura and super fast movement, attack speed and damage (moveSpeed / attackInterval /
// damageOf in upgrades.js). With nothing in reach the punch hits the air, and the aura is still yours.
function blackFlash(card, echo, callout) {
  const B = MELEE.blackFlash, p = game.player, reach = rangeOf(card) * B.reach, e = nearestEnemy(p, null, reach);
  callout();
  let a = p.face ?? -Math.PI / 2, at = { x: p.x + Math.cos(a) * reach * 0.8, y: p.y + Math.sin(a) * reach * 0.8 };
  if (e) {
    const q = hitPoint(e, p.x, p.y);
    a = Math.atan2(q.y - p.y, q.x - p.x); at = { x: q.x, y: q.y };
    hitEnemy({ card, look: 'melee', dmg: damageOf(B.hit), knock: knockOf(CARDS[card].knock * 1.6), vx: Math.cos(a), vy: Math.sin(a), x: q.x, y: q.y }, e);
  }
  game.bflash = B.time;                                    // (after the hit: the aura's damage is for what comes next)
  const d = Math.max(PLAYER.r + 14, Math.hypot(at.x - p.x, at.y - p.y));
  game.melees.push(pinTo({ x: p.x, y: p.y, kind: 'punch', card, a, reach: d + 6, side: 0, size: B.size, life: B.life, max: B.life }));
  game.melees.push({ x: at.x, y: at.y, kind: 'impact', card, a, fixed: true, life: B.impact, max: B.impact, seed: Math.random() * 1e6 });
  game.shake = Math.max(game.shake, 0.35);
  game.rings.push({ x: at.x, y: at.y, r: 6, max: 70, life: 0.35, color: COL.flashHi });
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 40, life: 0.5, color: COL.flashAura });
  if (!echo) SFX.melee('flash');
}

// Each frame (combat.js update): swings stay on whoever made them (an impact stays where it landed), then fade.
function updateMelees(dt) {
  for (let i = game.melees.length - 1; i >= 0; i--) {
    const m = game.melees[i];
    if ((m.life -= dt) <= 0) { game.melees.splice(i, 1); continue; }
    if (!m.fixed) followOwner(m);
  }
}

/* ---------- how they look (draw.js) ---------- */
// A knife (user: it should look like a KNIFE), its tip at (0, 0), pointing along +x: a pointed blade with a curved
// edge and a bright line along it, a crossguard, a wrapped handle and a pommel. About 36 px long.
function knifeSprite(c = ctx) {
  c.fillStyle = COL.knifeDark;                                        // handle and pommel
  c.beginPath(); c.roundRect(-35, -3.2, 13, 6.4, 2.5); c.fill();
  c.beginPath(); c.arc(-35.5, 0, 3.4, 0, TAU); c.fill();
  c.strokeStyle = COL.knifeGuard; c.lineWidth = 1;                    // the wrap
  for (const x of [-31, -27.5]) { c.beginPath(); c.moveTo(x, -3.2); c.lineTo(x + 1.5, 3.2); c.stroke(); }
  c.fillStyle = COL.knifeGuard;                                       // crossguard
  c.beginPath(); c.roundRect(-23, -6, 3.4, 12, 1.5); c.fill();
  c.fillStyle = COL.knife;                                            // blade: straight spine on top, curving edge below
  c.beginPath(); c.moveTo(-19.6, -3.4); c.lineTo(-5, -3.4); c.lineTo(0, 0); c.quadraticCurveTo(-6, 4.6, -19.6, 3.6); c.closePath(); c.fill();
  c.strokeStyle = COL.knifeGuard; c.lineWidth = 0.9;                  // the fuller
  c.beginPath(); c.moveTo(-18, -1); c.lineTo(-8, -1); c.stroke();
  c.strokeStyle = '#ffffff'; c.globalAlpha *= 0.8; c.lineWidth = 1;   // the sharp edge catching the light
  c.beginPath(); c.moveTo(-18, 3.2); c.quadraticCurveTo(-6, 3.9, -1, 0.6); c.stroke();
  c.globalAlpha /= 0.8;
}
// A fist (user: just a single white fist, closed), its knuckles at (0, 0), facing +x: one white shape with a dark
// edge, the knuckles bumping out along its front, the folds between the fingers and the thumb's line. `s` scales it.
function fistSprite(s = 1, c = ctx) {
  c.save(); c.scale(s, s);
  const shape = grow => {                                            // the whole fist, `grow` px bigger all round
    c.beginPath(); c.roundRect(-14 - grow, -8.5 - grow, 13 + grow * 2, 17 + grow * 2, 5 + grow); c.fill();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-2, -6.3 + k * 4.2, 2.6 + grow, 0, TAU); c.fill(); }
  };
  c.fillStyle = COL.fistLine; shape(1.4);                            // the edge, then the fist on top of it
  c.fillStyle = COL.fist; shape(0);
  c.strokeStyle = COL.fistLine; c.lineWidth = 1.1; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const y = -4.2 + k * 4.2; c.beginPath(); c.moveTo(-6, y); c.lineTo(-1.5, y); c.stroke(); }   // between the fingers
  c.beginPath(); c.moveTo(-12, 3.5); c.quadraticCurveTo(-8, 7, -3.5, 5.5); c.stroke();                                    // the thumb
  c.restore();
}
// A jagged line from (x1, y1) to (x2, y2), for the black lightning. `rnd`: a random source, so a bolt can hold still.
function boltPath(x1, y1, x2, y2, rnd, jag = 9) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(d / 12)), nx = -(y2 - y1) / (d || 1), ny = (x2 - x1) / (d || 1);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let k = 1; k < n; k++) { const t = k / n, j = (rnd() - 0.5) * 2 * jag; ctx.lineTo(x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j); }
  ctx.lineTo(x2, y2);
}
// Black lightning: a red glow, then the black bolt over it.
function blackBolt(x1, y1, x2, y2, rnd, a = 1, jag) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = (rnd() * 1e9) | 0;
  ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = COL.flashHi; ctx.lineWidth = 4.5;
  boltPath(x1, y1, x2, y2, mulberry32(s), jag); ctx.stroke();
  ctx.globalAlpha = a; ctx.strokeStyle = COL.flash; ctx.lineWidth = 2;
  boltPath(x1, y1, x2, y2, mulberry32(s), jag); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawMelees() {
  for (const m of game.melees) {
    const q = 1 - m.life / m.max, out = Math.sin(Math.min(1, q) * Math.PI);   // out and back
    if (m.kind === 'impact') {                                         // BLACK FLASH!'s impact: black lightning bursting out
      const rnd = reducedMotion ? mulberry32(m.seed | 0) : Math.random, fade = Math.min(1, m.life / (m.max * 0.6));
      ctx.globalAlpha = 0.5 * fade; ctx.fillStyle = COL.flash; circle(m.x, m.y, 10 + q * 10);   // a dark core where it landed
      ctx.globalAlpha = 1;
      for (let k = 0; k < 7; k++) {
        const a = m.a + (rnd() - 0.5) * 2.6, len = 26 + rnd() * 46;   // mostly onward, through the target
        blackBolt(m.x, m.y, m.x + Math.cos(a) * len, m.y + Math.sin(a) * len, rnd, fade, 7);
      }
      continue;
    }
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
    if (m.kind === 'knife') {
      // just the knife, stabbing forward and back (user)
      ctx.translate(PLAYER.r + 16 + out * (m.reach - PLAYER.r - 14), 0); knifeSprite();
    } else {
      // just the fist, punching out and back (user)
      const s = m.size || 1;
      ctx.translate(PLAYER.r + 4 + out * (m.reach - PLAYER.r - 6), m.side); fistSprite(s);
    }
    ctx.restore();
  }
}
// While BLACK FLASH! lasts (user): a see-through blue aura round you, breathing in and out, fading as it ends.
function drawBlackFlashAura(p) {
  const fade = Math.min(1, game.bflash / 0.8), t = performance.now() / 1000;
  const breathe = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6), R = PLAYER.r + 9 + breathe * 3;
  const g = ctx.createRadialGradient(p.x, p.y, PLAYER.r * 0.6, p.x, p.y, R + 6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, COL.flashAura);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = (0.35 + 0.2 * breathe) * fade; ctx.fillStyle = g; circle(p.x, p.y, R + 6);
  ctx.globalAlpha = (0.55 + 0.25 * breathe) * fade; ctx.strokeStyle = COL.flashAura; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
// KNIFE THROW!'s knife in flight, spinning.
function drawThrownKnife(pr) {
  ctx.globalAlpha = 0.25; ctx.strokeStyle = COL.knife; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - Math.cos(pr.a) * 26, pr.y - Math.sin(pr.a) * 26); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(reducedMotion ? pr.a : performance.now() / 40); ctx.translate(18, 0);
  knifeSprite();
  ctx.restore();
}
