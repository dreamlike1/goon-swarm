/* draw.js — Canvas drawing: basic shapes plus effects. */
'use strict';

/* ---------- drawing ---------- */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function draw() {
  ctx.save();
  ctx.fillStyle = COL.floor;
  ctx.fillRect(0, 0, W, H);
  if (game.shake > 0 && !reducedMotion) {
    const s = game.shake * 28;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

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
    const s = e.r * (0.4 + 0.6 * e.born);
    ctx.fillStyle = e.hit > 0 ? COL.player : COL[e.type];
    if (e.shape === 'triangle') {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.beginPath(); ctx.moveTo(s * 1.3, 0); ctx.lineTo(-s, -s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillRect(e.x - s, e.y - s, s * 2, s * 2);
    }
    if (e.hp < e.maxHp) {
      const bw = e.r * 2, by = e.y - e.r - 7;
      ctx.fillStyle = COL.line; ctx.fillRect(e.x - e.r, by, bw, 2);
      ctx.fillStyle = COL[e.type]; ctx.fillRect(e.x - e.r, by, bw * Math.max(0, e.hp / e.maxHp), 2);
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

  // player: a circle (hidden behind the start menu)
  const p = game.player;
  ctx.fillStyle = COL.player;
  if (!game.inMenu) {
    ctx.globalAlpha = p.safe > 0 && Math.floor(p.safe * 20) % 2 ? 0.45 : 1;   // blink while safe after a hit
    circle(p.x, p.y, PLAYER.r);
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

  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 3);
    ctx.fillStyle = f.color;
    ctx.font = `600 ${f.big ? 15 : 11}px ui-monospace, Menlo, monospace`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
