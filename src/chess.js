/* chess.js — EN PASSANT (v0.59, user): the Triple S card of the Standard pack. Every attack is a random chess piece. */
'use strict';

/* ============================================================
   v0.59 (user's sheet: "these are how the attacks should look"): each piece attacks its own squares, laid out from
   you the way that piece moves. The piece slides over them one at a time, and everything on a square is hit as it
   gets there. The squares alternate dark and light along the way, as in the sheet.
     Pawn    2 squares straight at the enemy; if it kills, it goes on 2 more at the next one (once)
     Knight  an L of 4 squares: 3 toward the enemy, then 1 to its side (it leaps over them)
     Rook    8 squares along the nearest of the 4 straight lines
     Bishop  8 squares along the nearest diagonal
     ×3 QUEEN'S GAMBIT!  8 queens, one in every direction, 6 squares each (the ring round you is their first squares)
     ×7 YOU ARE KING!    a crown comes down on you, and the 3 × 3 big squares round you light up: everything in them
                         dies (a boss takes heavy damage instead)
   A piece only comes up when its squares can reach the enemy (the pawn and knight are short). Numbers are placeholders.
   ============================================================ */
const CHESS = {
  tile: 30, size: 0.78,                                   // one square (px), and how much of it is drawn (the rest is the gap)
  pick: { pawn: 0.35, knight: 0.2, rook: 0.225, bishop: 0.225 },
  pawn: { n: 2, dmg: 26, per: 0.08, knock: 120 },
  knight: { dmg: 48, per: 0.07, knock: 240 },
  rook: { n: 8, dmg: 35, per: 0.04, knock: 160 },
  bishop: { n: 8, dmg: 35, per: 0.04, knock: 160 },
  queen: { n: 6, dmg: 43, per: 0.045, knock: 180 },
  king: { cell: 2, bossDmg: 90, bossCap: 0.08, at: 0.22, life: 1.3 },    // its squares are `cell` squares wide
  tileLife: 0.9,
  // v0.59 (user: "spin and look 3D while it's thrown"): every piece is thrown in an arc over its squares, `arc` px high
  // (plus `per` px for each square it goes), tumbling end over end `turns` times so it lands upright on its last square
  throw: { arc: 16, per: 2.5, turns: { pawn: 1, knight: 1, rook: 2, bishop: 2, queen: 2 } },
};
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// One EN PASSANT turn (combat.js shoot): a random piece at `e`, out of the ones whose squares reach it.
function chessShot(card, e, o = {}) {
  if (!e) return;
  const p = game.player, d = Math.hypot(e.x - p.x, e.y - p.y) - (e.r || 8), T = CHESS.tile;
  const reach = { pawn: 2.5 * T, knight: 3.5 * T, rook: 8.5 * T, bishop: 8.5 * T * Math.SQRT2 };
  let kind = o.piece;
  if (!kind) {
    const w = Object.entries(CHESS.pick).filter(([k]) => reach[k] >= d), tot = w.reduce((s, [, v]) => s + v, 0);
    let x = Math.random() * tot; kind = w[w.length - 1][0];
    for (const [k, v] of w) if ((x -= v) < 0) { kind = k; break; }
  }
  chessMove(card, kind, chessCells(kind, p.x, p.y, e), p.x, p.y, o.quiet);
}
// The direction (of `dirs`) that points closest at (tx, ty) from (x, y).
function bestDir(dirs, x, y, tx, ty) {
  const a = Math.atan2(ty - y, tx - x);
  return dirs.reduce((b, v) => (Math.cos(Math.atan2(v[1], v[0]) - a) > Math.cos(Math.atan2(b[1], b[0]) - a) ? v : b));
}
// A piece's squares from (x, y) at enemy `e`, in the order it moves over them: { x, y, dark }.
function chessCells(kind, x, y, e) {
  const T = CHESS.tile, line = (v, n, dark) => Array.from({ length: n }, (_, i) => ({ x: x + v[0] * T * (i + 1), y: y + v[1] * T * (i + 1), dark: dark(i + 1) }));
  if (kind === 'pawn') return line(bestDir(ORTHO, x, y, e.x, e.y), CHESS.pawn.n, k => k % 2 === 0);   // light, then dark (the sheet)
  if (kind === 'rook') return line(bestDir(ORTHO, x, y, e.x, e.y), CHESS.rook.n, k => k % 2 === 1);   // dark first
  if (kind === 'bishop') return line(bestDir(DIAG, x, y, e.x, e.y), CHESS.bishop.n, k => k % 2 === 1);
  // the knight: 3 along the way the enemy mostly is, then 1 toward its side
  const dx = e.x - x, dy = e.y - y, major = Math.abs(dx) >= Math.abs(dy);
  const a = major ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1], b = major ? [0, Math.sign(dy) || 1] : [Math.sign(dx) || 1, 0];
  const out = line(a, 3, k => k % 2 === 1);
  out.push({ x: out[2].x + b[0] * T, y: out[2].y + b[1] * T, dark: false });
  return out;
}
// A piece moving over its squares (chessStep moves it on). `again`: the pawn's second go after a kill.
function chessMove(card, kind, cells, x, y, quiet = false, again = false) {
  const S = CHESS[kind];
  game.sinfx.push({ kind: 'cmove', piece: kind, card, owner: ownerId(), aug: AUG_FX, cells, x0: x, y0: y, x, y, z: 0, t: 0, spin0: Math.random() * Math.PI * 2, tumble: 0, flip: cells[0].x >= x ? 1 : -1, per: S.per, done: 0,
    dmg: damageOf(S.dmg), knock: knockOf(S.knock), hits: new Set(), killed: false, again, life: 9, max: 9, fixed: true });
  if (!quiet) SFX.fire(card);
}
// Does enemy `e` touch the square at (cx, cy)? (Its nearest part, to the square's whole cell.)
function onSquare(e, cx, cy, half) {
  const q = hitPoint(e, cx, cy), r = q.r ?? e.r, dx = Math.max(0, Math.abs(q.x - cx) - half), dy = Math.max(0, Math.abs(q.y - cy) - half);
  return dx * dx + dy * dy < r * r;
}
// Each frame (combat.js update): the pieces move on, lighting each square and hitting what's on it as they get there.
function chessStep(dt) {
  const T = CHESS.tile;
  for (const m of game.sinfx) {
    if (m.kind !== 'cmove' || m.finished) continue;
    usePlayerId(m.owner, m.aug);
    m.t += dt;
    const n = m.cells.length, at = Math.min(n, m.t / m.per);
    while (m.done < Math.min(n, Math.floor(at + 0.5))) {               // it's reached the next square
      const c = m.cells[m.done++];
      game.sinfx.push({ kind: 'tile', x: c.x, y: c.y, s: T, dark: c.dark, life: CHESS.tileLife, max: CHESS.tileLife, fixed: true });
      for (const e of game.enemies.slice()) {
        if (m.hits.has(e) || !onSquare(e, c.x, c.y, T / 2)) continue;
        m.hits.add(e);
        const dx = e.x - m.x0, dy = e.y - m.y0, d = Math.hypot(dx, dy) || 1;
        hitEnemy({ card: m.card, look: 'blast', dmg: m.dmg, knock: m.knock, vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
        if (e.dead) m.killed = true;
      }
    }
    const k = Math.min(n - 1e-6, at), i = Math.floor(k), f = k - i, from = i ? m.cells[i - 1] : { x: m.x0, y: m.y0 }, to = m.cells[i];
    m.x = from.x + (to.x - from.x) * f; m.y = from.y + (to.y - from.y) * f;
    const Th = CHESS.throw, prog = Math.min(1, m.t / (n * m.per));      // thrown in an arc, tumbling, landing upright
    m.z = Math.sin(prog * Math.PI) * (m.piece === 'knight' ? 26 : Th.arc + n * Th.per);
    m.tumble = reducedMotion ? 0 : prog * (Th.turns[m.piece] || 1) * Math.PI * 2 * (m.flip || 1);
    if (at < n) continue;
    m.finished = true; m.life = m.max = 0.3; m.z = 0; m.tumble = 0;  // there: it lands upright and stays a moment, fading
    const end = m.cells[n - 1];
    if (m.piece === 'knight') { game.rings.push({ x: end.x, y: end.y, r: 6, max: T, life: 0.25, color: COL.chessGold }); game.shake = Math.max(game.shake, 0.14); }
    if (m.piece === 'pawn' && m.killed && !m.again) {                  // a kill: it goes on, 2 squares at the next enemy
      const e = nearestEnemy(end, null, 2.5 * T);
      if (e) chessMove(m.card, 'pawn', chessCells('pawn', end.x, end.y, e), end.x, end.y, true, true);
    }
  }
}

// QUEEN'S GAMBIT! (EN PASSANT ×3): 8 queens at once, one along every line. The straight lines' squares alternate
// (dark first); the diagonals' are all light (the user's sheet).
function chessQueens(card) {
  const p = game.player, T = CHESS.tile, Q = CHESS.queen;
  for (const v of ORTHO.concat(DIAG)) {
    const diag = v[0] && v[1];
    const cells = Array.from({ length: Q.n }, (_, i) => ({ x: p.x + v[0] * T * (i + 1), y: p.y + v[1] * T * (i + 1), dark: !diag && i % 2 === 0 }));
    chessMove(card, 'queen', cells, p.x, p.y, true);
  }
  SFX.fire(card);
  game.shake = Math.max(game.shake, 0.14);
}
// YOU ARE KING! (EN PASSANT ×7): a crown comes down on you and the 3 × 3 big squares round you light up (the middle one
// is yours); everything in them dies, and a boss takes `bossDmg`.
function chessKing(card) {
  const p = game.player, K = CHESS.king, s = K.cell * CHESS.tile, half = s * 1.5, x = p.x, y = p.y;
  game.sinfx.push({ kind: 'king', x, y, s, half, life: K.life, max: K.life, fixed: true });
  later(K.at, () => {
    for (const e of game.enemies.slice()) {
      if (!onSquare(e, x, y, half)) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
      // (v0.59, user: never an instant kill on a boss: it takes `bossDmg`, at most `bossCap` of its full bar, no crit)
      const dmg = bossLike(e) ? Math.max(1, Math.min(damageOf(K.bossDmg), Math.round(e.maxHp * K.bossCap))) : Math.max(1, Math.ceil(e.hp));
      hitEnemy({ card, look: 'blast', dmg, noCrit: true, knock: bossLike(e) ? 0 : knockOf(260), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
    }
    game.rings.push({ x, y, r: 10, max: half * 1.4, life: 0.45, color: COL.chessGold });
    burst(x, y, COL.chessGold, 30, 340);
    game.shake = Math.max(game.shake, 0.5);
    SFX.sin('slam'); SFX.boom();
  });
}

/* ---------- how they look (draw.js) ---------- */
// Each piece as one outline, 1 tall, its base at y = 0.5, built once.
const CHESS_PATH = (() => {
  const base = pt => { pt.roundRect(-0.36, 0.33, 0.72, 0.17, 0.05); pt.roundRect(-0.27, 0.24, 0.54, 0.11, 0.03); };
  const body = (pt, top, w0, w1) => { pt.moveTo(-w0, top); pt.lineTo(w0, top); pt.lineTo(w1, 0.25); pt.lineTo(-w1, 0.25); pt.closePath(); };
  const out = {};
  let pt = out.pawn = new Path2D(); base(pt); body(pt, -0.02, 0.1, 0.22); pt.roundRect(-0.17, -0.08, 0.34, 0.08, 0.03); pt.moveTo(0.17, -0.25); pt.arc(0, -0.25, 0.17, 0, Math.PI * 2);
  pt = out.rook = new Path2D(); base(pt); body(pt, -0.18, 0.18, 0.22);
  pt.moveTo(-0.27, -0.2); pt.lineTo(-0.27, -0.47); pt.lineTo(-0.15, -0.47); pt.lineTo(-0.15, -0.38); pt.lineTo(-0.06, -0.38); pt.lineTo(-0.06, -0.47);
  pt.lineTo(0.06, -0.47); pt.lineTo(0.06, -0.38); pt.lineTo(0.15, -0.38); pt.lineTo(0.15, -0.47); pt.lineTo(0.27, -0.47); pt.lineTo(0.27, -0.2); pt.closePath();
  pt = out.bishop = new Path2D(); base(pt); body(pt, 0.02, 0.1, 0.21); pt.roundRect(-0.18, -0.04, 0.36, 0.08, 0.03);
  pt.moveTo(0, -0.42); pt.bezierCurveTo(0.2, -0.3, 0.2, -0.08, 0.1, -0.04); pt.lineTo(-0.1, -0.04); pt.bezierCurveTo(-0.2, -0.08, -0.2, -0.3, 0, -0.42); pt.closePath();
  pt.moveTo(0.055, -0.46); pt.arc(0, -0.46, 0.055, 0, Math.PI * 2);
  pt = out.knight = new Path2D(); base(pt);
  pt.moveTo(-0.22, 0.25); pt.lineTo(0.25, 0.25); pt.bezierCurveTo(0.3, 0, 0.26, -0.22, 0.12, -0.36); pt.lineTo(0.09, -0.5); pt.lineTo(0.0, -0.38);
  pt.bezierCurveTo(-0.12, -0.36, -0.22, -0.26, -0.33, -0.08); pt.lineTo(-0.3, 0.01); pt.lineTo(-0.15, 0.0); pt.lineTo(-0.04, -0.04); pt.bezierCurveTo(-0.14, 0.08, -0.22, 0.16, -0.22, 0.25); pt.closePath();
  pt = out.queen = new Path2D(); base(pt); body(pt, -0.1, 0.12, 0.22);
  pt.moveTo(-0.24, -0.12); pt.lineTo(-0.3, -0.38); pt.lineTo(-0.14, -0.22); pt.lineTo(0, -0.44); pt.lineTo(0.14, -0.22); pt.lineTo(0.3, -0.38); pt.lineTo(0.24, -0.12); pt.closePath();
  for (const [x, y] of [[-0.3, -0.4], [0, -0.47], [0.3, -0.4]]) { pt.moveTo(x + 0.05, y); pt.arc(x, y, 0.05, 0, Math.PI * 2); }
  pt = out.king = new Path2D(); base(pt); body(pt, -0.1, 0.12, 0.22);
  pt.moveTo(-0.24, -0.1); pt.bezierCurveTo(-0.32, -0.3, -0.12, -0.36, 0, -0.26); pt.bezierCurveTo(0.12, -0.36, 0.32, -0.3, 0.24, -0.1); pt.closePath();
  pt.rect(-0.035, -0.5, 0.07, 0.22); pt.rect(-0.1, -0.43, 0.2, 0.07);
  return out;
})();
// A piece `h` px tall standing on (x, y), lifted `z` px (v0.59, user: "spin, with the 3D look", like the T-Balls):
// turned `spin` rad round its upright axis. Ivory, lit from the top left like the rest: round shading across it (a
// bright band, a soft shine, darker toward the right edge and the bottom), a dark edge, and grooves round it that move
// with the turn so you see it spin. The knight's head turns with it (it goes edge-on, then faces the other way).
// `tumble`: turned end over end round its middle (thrown, v0.59); its shadow on the floor shrinks and fades the higher it is.
function chessPiece(kind, x, y, h, z = 0, a = 1, spin = 0, tumble = 0) {
  const path = CHESS_PATH[kind], c = Math.cos(spin), knight = kind === 'knight';
  const sx = knight ? (Math.abs(c) < 0.18 ? 0.18 * (Math.sign(c) || 1) : c) : 1, side = sx < 0 ? -1 : 1, ivory = COL.enpassant;
  const lift = 1 / (1 + z / 28);
  ctx.globalAlpha = 0.35 * a * lift; ctx.fillStyle = '#000000'; ellipse(x, y + h * 0.5, h * 0.34 * (0.5 + 0.5 * lift), h * 0.1 * (0.5 + 0.5 * lift));
  ctx.save(); ctx.translate(x, y - z); ctx.rotate(tumble); ctx.scale(h * sx, h);
  ctx.globalAlpha = a; ctx.lineJoin = 'round';
  ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 2.6 / h; ctx.stroke(path);
  const g = ctx.createLinearGradient(-0.36 * side, 0, 0.36 * side, 0);   // (the light stays on the left as the knight turns)
  g.addColorStop(0, shadeHex(ivory, -0.18)); g.addColorStop(0.3, shadeHex(ivory, 0.5)); g.addColorStop(0.55, ivory);
  g.addColorStop(0.85, shadeHex(ivory, -0.38)); g.addColorStop(1, shadeHex(ivory, -0.55));
  ctx.fillStyle = g; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  const v = ctx.createLinearGradient(0, -0.5, 0, 0.5);                  // lit from above, in shadow at its foot
  v.addColorStop(0, 'rgba(255, 255, 255, 0.22)'); v.addColorStop(0.55, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = v; ctx.fillRect(-1, -1, 2, 2);
  if (!knight) {                                                          // grooves round it, turning with it
    ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 1.1 / h;
    for (let k = 0; k < 6; k++) {
      const f = spin + k * Math.PI / 3, front = Math.cos(f);
      if (front <= 0.05) continue;
      ctx.globalAlpha = a * 0.3 * front; ctx.beginPath(); ctx.moveTo(Math.sin(f) * 0.22, -0.5); ctx.lineTo(Math.sin(f) * 0.22, 0.5); ctx.stroke();
    }
  }
  ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.15 * side - 0.025, -0.5, 0.05, 1);   // the shine
  ctx.restore();
  ctx.globalAlpha = a;
  if (knight) { ctx.fillStyle = COL.chessDark; circle(-0.07, -0.24, 0.035); ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 1.2 / h; ctx.beginPath(); ctx.moveTo(0.12, -0.3); ctx.quadraticCurveTo(0.22, -0.05, 0.16, 0.2); ctx.stroke(); }
  if (kind === 'bishop' && c > 0.1) {                                     // its slit, on the side facing you
    const sx0 = Math.sin(spin) * 0.1; ctx.globalAlpha = a * c; ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 1.4 / h;
    ctx.beginPath(); ctx.moveTo(sx0 - 0.06 * c, -0.16); ctx.lineTo(sx0 + 0.06 * c, -0.3); ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
// A crown (YOU ARE KING!, v0.59, user: "3D looking too"), `w` px wide, its band's bottom at (x, y), seen from a little
// above and turning (`spin`): a gold ring with 5 points round it. The points at the back are darker and behind; inside
// it's in shadow; the band is lit round the front, with red stones; the points at the front have pearls on top.
function crownSprite(x, y, w, a = 1, spin = 0) {
  const R = w / 2, ry = R * 0.34, bh = w * 0.24, ph = w * 0.5, gold = COL.chessGold, N = 5, d = 0.5;
  const rim = (f, top) => [R * Math.sin(f), (top ? -bh : 0) + ry * Math.cos(f)];
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.lineJoin = 'round';
  const spike = (f, back) => {
    const [x1, y1] = rim(f - d, true), [x2, y2] = rim(f + d, true), [tx, ty] = rim(f, true), lean = 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(tx * lean, ty - ph); ctx.lineTo(x2, y2); ctx.closePath();
    const g = ctx.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, shadeHex(gold, back ? -0.55 : -0.1)); g.addColorStop(0.35, shadeHex(gold, back ? -0.35 : 0.5)); g.addColorStop(1, shadeHex(gold, back ? -0.7 : -0.45));
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 1.2; ctx.stroke();
    if (!back) { ctx.fillStyle = '#ffffff'; circle(tx * lean, ty - ph, w * 0.05); }
  };
  const fs = Array.from({ length: N }, (_, k) => spin + k * Math.PI * 2 / N);
  for (const f of fs) if (Math.cos(f) < 0) spike(f, true);              // the back points
  ctx.fillStyle = shadeHex(gold, -0.75); ellipse(0, -bh, R, ry);       // the inside, in shadow
  ctx.beginPath();                                                       // the band's front
  for (let k = 0; k <= 24; k++) { const f = -Math.PI / 2 + Math.PI * k / 24, [px, py] = rim(f, false); ctx[k ? 'lineTo' : 'moveTo'](px, py); }
  for (let k = 24; k >= 0; k--) { const f = -Math.PI / 2 + Math.PI * k / 24, [px, py] = rim(f, true); ctx.lineTo(px, py); }
  ctx.closePath();
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, shadeHex(gold, -0.35)); g.addColorStop(0.3, shadeHex(gold, 0.55)); g.addColorStop(0.55, gold); g.addColorStop(1, shadeHex(gold, -0.6));
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = COL.chessDark; ctx.lineWidth = 1.4; ctx.stroke();
  for (const f of fs) {                                                  // red stones round the band, between the points
    const s = f + Math.PI / N, front = Math.cos(s);
    if (front <= 0.1) continue;
    const [px, py] = rim(s, false);
    ctx.fillStyle = COL.berserk; ellipse(px, py - bh * 0.5, w * 0.06 * front, w * 0.07);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = a * 0.8; circle(px - w * 0.015, py - bh * 0.5 - w * 0.025, w * 0.018); ctx.globalAlpha = a;
  }
  for (const f of fs) if (Math.cos(f) >= 0) spike(f, false);            // the front points
  ctx.restore(); ctx.globalAlpha = 1;
}
// A square: light ones ivory with a dark edge, dark ones walnut with a gold one (the sheet's white and black squares),
// popping in, then fading.
function chessSquare(x, y, s, dark, a) {
  const w = s * CHESS.size;
  ctx.globalAlpha = 0.85 * a; ctx.fillStyle = dark ? COL.chessDark : COL.enpassant; ctx.fillRect(x - w / 2, y - w / 2, w, w);
  ctx.globalAlpha = a; ctx.strokeStyle = dark ? COL.chessGold : COL.chessDark; ctx.lineWidth = dark ? 1.2 : 2.6;
  ctx.strokeRect(x - w / 2, y - w / 2, w, w);
}
// Under the enemies: the squares, and the king's board.
function drawChessGround() {
  for (const f of game.sinfx) {
    if (f.kind === 'tile') {
      const pop = Math.min(1, (f.max - f.life) / 0.07), fade = Math.min(1, f.life / 0.35);
      chessSquare(f.x, f.y, f.s * (0.7 + 0.3 * pop), f.dark, fade);
    } else if (f.kind === 'king') {                                    // 3 × 3: corners light, the sides dark, you in the middle
      const q = 1 - f.life / f.max, fade = Math.min(1, f.life / 0.35), open = Math.min(1, Math.max(0, (q * f.max - CHESS.king.at * 0.6) / 0.12));
      if (open <= 0) continue;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        chessSquare(f.x + i * f.s, f.y + j * f.s, f.s * (0.6 + 0.4 * open), !!i !== !!j, fade);
      }
      if (q < 0.45) { const k = 1 - q / 0.45, w = f.half * (1 + q * 0.8); fxAdd(COL.chessGold); ctx.globalAlpha = 0.8 * k; ctx.strokeStyle = COL.chessGold; ctx.lineWidth = 3 + 10 * k; ctx.strokeRect(f.x - w, f.y - w, w * 2, w * 2); fxNormal(); }
    }
  }
  ctx.globalAlpha = 1;
}
// Over the enemies: the pieces moving over their squares (the big ones big: user), and the crown over you.
function drawChessTop() {
  for (const f of game.sinfx) {
    if (f.kind === 'cmove') {
      const h = f.piece === 'pawn' ? 22 : 32, a = f.finished ? Math.min(1, f.life / 0.3) : 1;
      fxGlow(f.x, f.y - h * 0.2 - f.z, h, COL.chessGold, 0.4 * a);
      chessPiece(f.piece, f.x, f.y - h * 0.2, h, f.z, a, reducedMotion ? 0.5 : f.spin0 + f.t * 11, f.tumble || 0);   // thrown: spinning and tumbling
    } else if (f.kind === 'king') {
      const q = 1 - f.life / f.max, drop = Math.min(1, q / CHESS.king.at), fade = Math.min(1, f.life / 0.3), p = game.player;
      const bounce = drop < 1 ? (1 - drop * drop) * 140 : Math.abs(Math.sin((q * f.max - CHESS.king.at) * 9)) * 6 * Math.max(0, 1 - (q * f.max - CHESS.king.at) * 2);
      fxGlow(p.x, p.y - PLAYER.r - 14, 46, COL.chessGold, 0.8 * fade * drop);
      crownSprite(p.x, p.y - PLAYER.r - 4 - bounce, 30, fade, reducedMotion ? 0.3 : q * f.max * (drop < 1 ? 14 : 3));   // spinning down fast, then turning slowly
    }
  }
}
