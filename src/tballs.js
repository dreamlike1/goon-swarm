/* tballs.js — The T-Balls pack (v0.56, user: an event pack, in red). Two cards: Ranged T-Ball and Melee T-Ball. */
'use strict';

/* ============================================================
   The balls: small white spheres with a dark band, gold speakers and a red light (the user's reference), glowing
   red. They orbit you (the T-Balls' look when nothing's happening): one ball for each copy in your decks, at most 2
   ranged and 2 melee, so 4 in all.
   - They can be played without any other cards (no balance rule for them: save.js deckProblemsOf).
   - Each turn, the card does one of its type's 4 effects at random, and it comes from a ball, not from you; a ball
     that flew off comes straight back (a quick return), and one that blew up fades back in by you.
       Ranged: LUNGE (a quick long-range lunge through what's in its way), BEAM (a red beam), BOMB (it sticks to an
               enemy and explodes, then fades back to you), SHOT (it fires a shot), BOUNCE (v0.56, user: it hits an
               enemy 4 times fast, bouncing off it, each hit shoving it, each leg a red neon streak that fades out
               before the next).
       Melee:  SHIELD (one ball projects a red shield round you, a beam to it, that blocks the next hit; short),
               PUSH (it shoves an enemy far away, light damage), ZAP (it lunges and lets out blue energy, zapping
               the enemy and a couple near it), WHIP (it swipes round in a slash), PULSE (v0.56, user: every ball
               round you pulses red energy, pushing what's near away, light damage).
   - Combos, only in a deck with other cards too (combos.js comboAt): ×3 GO WILD! (every ball flies wild into the
     enemies near you, trailing red), ×7 QUAD SHOT! (4 very fast shots at the nearest enemies, each with a small
     blast of its own size where it hits).
   Every number is a placeholder.
   ============================================================ */
const TB = {
  orbit: { r: 30, speed: 2.4, bob: 2.5 },   // px from you, turns (rad/s), a little bob
  r: 6.5,                                   // a ball's size (you're 11)
  back: 18,                                 // how fast a ball flies home after an effect (higher: quicker)
  sync: 0.5,                                // s between checks of how many balls your decks have
  ranged: {
    lunge: { speed: 1500, far: 300, dmg: 1.2 },          // dmg: × the card's
    beam: { life: 0.24, w: 6, dmg: 1 },
    bomb: { fly: 0.16, stick: 0.45, radius: 72, dmg: 1.6, fade: 0.4 },
    shot: { dmg: 1 },
    bounce: { hits: 4, in: 0.08, out: 0.07, back: 55, dmg: 0.6, knock: 300, streak: 0.075, next: 200 },   // `next`: a new enemy this close if it dies
  },
  melee: {
    shield: { hits: 1, time: 2.5, hold: 16 },            // v0.56 (user: too long): 2.5 s (6 before); `hold`: how much further out its ball sits
    push: { fly: 0.12, dmg: 0.3, knock: 950 },
    zap: { fly: 0.14, dmg: 1.4, chain: 2, chainR: 110, chainDmg: 0.7, life: 0.3 },
    whip: { time: 0.24, arc: 2.6, dmg: 1.1 },
    pulse: { radius: 70, dmg: 0.35, knock: 520 },
  },
  wild: { time: 2.6, speed: 780, reach: 280, dmg: 0.6, bounce: 0.3 },   // ×3 GO WILD!: after a hit a ball bounces off for `bounce` s
  quad: { speedMul: 2.6, aoe: [26, 54], dmg: 1, aoeDmg: 0.6 },   // ×7 QUAD SHOT!: each blast a random size in `aoe`
};
const TB_EFFECTS = { ranged: ['lunge', 'beam', 'bomb', 'shot', 'bounce'], melee: ['shield', 'push', 'zap', 'whip', 'pulse'] };
const TBC = { shell: tok('--tball-shell'), shade: tok('--tball-shade'), band: tok('--tball-band'), gold: tok('--tball-gold'), red: tok('--tball'), zap: tok('--tball-zap') };
const isTBall = id => !!CARDS[id]?.tball;
const tballCard = kind => (kind === 'ranged' ? 'tball' : 'tballm');

// Only T-Balls in this run's decks: MRT plays instead of the level music (sound.js).
const tballOnly = () => { const c = runDeckCards(); return c.length > 0 && c.every(isTBall); };
// How many balls of each kind: one per copy in this run's decks, at most 2 of each. The store's test (or the effects
// lab) of a T-Ball: all 4.
function tballWanted() {
  const pr = game.practice;
  if (pr?.demo) {                                    // the main menu's demo fight: as in a run with your loadout (menus.js)
    const n = id => (pr.cards.includes(id) ? Math.min(2, save.equipped[id] || 0) : 0);
    return { ranged: n('tball'), melee: n('tballm') };
  }
  if (pr && !pr.loadout) return isTBall(pr.card) ? { ranged: 2, melee: 2 } : { ranged: 0, melee: 0 };
  const cards = runDeckCards(), n = id => cards.filter(c => c === id).length;
  return { ranged: Math.min(2, n('tball')), melee: Math.min(2, n('tballm')) };
}
// The run's decks have cards other than T-Balls: their combos are on (user).
function tballMixed() {
  if (game.practice && !game.practice.loadout) return true;
  return runDeckCards().some(c => !isTBall(c));
}
function tballSync() {
  const want = tballWanted(), list = game.tballs, p = game.player;
  for (const kind of ['ranged', 'melee']) {
    const mine = list.filter(b => b.kind === kind);
    for (let i = mine.length; i < want[kind]; i++) list.push({ kind, slot: i, x: p.x, y: p.y, act: null, back: true, alpha: 0, spin: Math.random() * TAU, trail: [], hot: 0 });
    for (let i = mine.length; i > want[kind]; i--) list.splice(list.indexOf(mine[i - 1]), 1);
  }
  list.sort((a, b) => a.slot - b.slot || (a.kind === 'ranged' ? -1 : 1));   // ranged and melee take turns round the ring
}
// Where ball `i` of `n` sits on its orbit.
// The ball holding up the red shield sits further out (`hold`), so its beam to the shield shows (user).
function tballHome(i, n, b = null) {
  const p = game.player, a = (game.tbAng || 0) + (i / Math.max(1, n)) * TAU, bob = Math.sin((game.tbAng || 0) * 2.3 + i) * TB.orbit.bob;
  const r = TB.orbit.r + bob + (b && game.tshield?.ball === b ? TB.melee.shield.hold : 0);
  return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
}

/* ---------- a card's turn (combat.js shoot, melee.js meleeStrike) ---------- */
// One random effect of the card's kind (o.effect picks one: the effects lab). True if it did something.
function tballPlay(card, e, o = {}) {
  const kind = CARDS[card].tball, p = game.player, list = TB_EFFECTS[kind], pick = o.effect || list[Math.floor(Math.random() * list.length)];
  if (!game.tballs.some(b => b.kind === kind)) tballSync();
  if (pick === 'shield') { tballShield(card); return true; }
  if (!e || e.dead || (kind === 'melee' && hitGap(e, p.x, p.y) > rangeOf(card))) return false;
  if (pick === 'pulse') { tballPulse(card); return true; }
  const b = pickBall(kind, e);
  if (!b) return false;
  startAct(b, pick, card, e);
  SFX.tball(pick);
  return true;
}
// A free ball of that kind, nearest the target (or, if they're all busy, the one closest to done).
function pickBall(kind, e) {
  const mine = game.tballs.filter(b => b.kind === kind);
  const free = mine.filter(b => !b.act);
  const from = free.length ? free : mine;
  return from.sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0] || null;
}
function startAct(b, type, card, e) {
  const R = TB.ranged, M = TB.melee, dmg = m => damageOf(CARDS[card].dmg * m);
  b.trail.length = 0;
  if (type === 'beam') {                                     // instant: a red beam from the ball
    hitEnemy({ card, look: 'laser', dmg: dmg(R.beam.dmg), knock: knockOf(CARDS[card].knock), vx: e.x - b.x, vy: e.y - b.y, x: e.x, y: e.y }, e);
    game.tfx.push({ kind: 'beam', x1: b.x, y1: b.y, x2: e.x, y2: e.y, life: R.beam.life, max: R.beam.life });
    b.hot = 0.25;
    return;
  }
  if (type === 'shot') {                                     // instant: it fires
    shoot(card, e, { from: { x: b.x, y: b.y }, raw: true, dmg: CARDS[card].dmg * R.shot.dmg, quiet: true });
    game.rings.push({ x: b.x, y: b.y, r: TB.r, max: TB.r + 12, life: 0.2, color: TBC.red });
    b.hot = 0.25;
    return;
  }
  const a = Math.atan2(e.y - b.y, e.x - b.x);
  b.act = { type, card, e, t: 0, x0: b.x, y0: b.y, a, hits: new Set(), dmg: dmg(1) };
  if (type === 'lunge') Object.assign(b.act, { far: Math.max(R.lunge.far, Math.hypot(e.x - b.x, e.y - b.y) + 60), gone: 0, trail: true });
  if (type === 'whip') {                                     // round you, through where the enemy is
    const p = game.player, ae = Math.atan2(e.y - p.y, e.x - p.x), side = Math.random() < 0.5 ? 1 : -1;
    Object.assign(b.act, { a0: ae - side * M.whip.arc / 2, side, rad: Math.min(rangeOf(card), Math.hypot(e.x - p.x, e.y - p.y) + 4), trail: true });
  }
  if (type === 'push' || type === 'zap' || type === 'bomb') b.act.trail = true;
  if (type === 'bounce') Object.assign(b.act, { left: R.bounce.hits, phase: 'in' });
}
// Each frame, for a ball doing something.
function actStep(b, dt) {
  const A = b.act, R = TB.ranged, M = TB.melee, p = game.player, e = A.e, alive = e && !e.dead && game.enemies.includes(e);
  A.t += dt;
  const end = () => { b.act = null; b.back = true; };
  const flyTo = (fly, stop = 0) => {                         // eases from where it started to the enemy (followed as it moves)
    const k = Math.min(1, A.t / fly), q = 1 - (1 - k) ** 2, tx = alive ? e.x : A.tx ?? b.x, ty = alive ? e.y : A.ty ?? b.y;
    if (alive) { A.tx = e.x; A.ty = e.y; }
    const d = Math.hypot(tx - A.x0, ty - A.y0) || 1, f = Math.max(0, d - stop) / d;
    b.x = A.x0 + (tx - A.x0) * f * q; b.y = A.y0 + (ty - A.y0) * f * q;
    return k >= 1;
  };
  switch (A.type) {
    case 'lunge': {                                          // straight on, fast and far, through everything in its way
      const step = R.lunge.speed * dt;
      b.x += Math.cos(A.a) * step; b.y += Math.sin(A.a) * step; A.gone += step;
      for (const en of game.enemies.slice()) {
        if (A.hits.has(en) || hitGap(en, b.x, b.y) > TB.r + 2) continue;
        A.hits.add(en);
        hitEnemy({ card: A.card, look: 'melee', dmg: Math.round(A.dmg * R.lunge.dmg), knock: knockOf(CARDS[A.card].knock), vx: Math.cos(A.a), vy: Math.sin(A.a), x: en.x, y: en.y }, en);
      }
      if (A.gone >= A.far || b.x < 0 || b.y < 0 || b.x > W || b.y > (playH || H)) end();
      break;
    }
    case 'bomb': {                                           // flies on, sticks, blinks, blows up, fades back in by you
      if (A.t < R.bomb.fly) { flyTo(R.bomb.fly, (e?.r || 0) * 0.6); break; }
      if (alive) { b.x = e.x + Math.cos(A.a + Math.PI) * e.r * 0.6; b.y = e.y + Math.sin(A.a + Math.PI) * e.r * 0.6; }
      b.hot = 0.5 + 0.5 * Math.sin(A.t * 40);
      if (A.t >= R.bomb.fly + R.bomb.stick || !alive) {
        blast(b.x, b.y, A.card, R.bomb.radius, Math.round(A.dmg * R.bomb.dmg), { knock: 260 });
        game.rings.push({ x: b.x, y: b.y, r: 8, max: R.bomb.radius * 1.15, life: 0.4, color: TBC.red });
        game.shake = Math.max(game.shake, 0.12);
        SFX.tball('boom');
        const h = tballHome(game.tballs.indexOf(b), game.tballs.length);
        b.x = h.x; b.y = h.y; b.alpha = 0; b.hot = 0; b.trail.length = 0;
        b.act = null; b.back = false;
      }
      break;
    }
    case 'push': {                                           // a quick bump, and the enemy goes flying
      if (!flyTo(M.push.fly, (e?.r || 0) + TB.r)) break;
      if (alive) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        hitEnemy({ card: A.card, look: 'melee', dmg: Math.max(1, Math.round(A.dmg * M.push.dmg)), knock: knockOf(M.push.knock), vx: Math.cos(a), vy: Math.sin(a), x: e.x, y: e.y }, e);
        game.rings.push({ x: b.x, y: b.y, r: 4, max: 34, life: 0.25, color: TBC.red });
      }
      end();
      break;
    }
    case 'zap': {                                            // lunges in, then blue energy arcs out of it
      if (!flyTo(M.zap.fly, (e?.r || 0) + TB.r + 6)) break;
      if (alive) {
        const hit = [e, ...game.enemies.filter(o => o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < M.zap.chainR)
          .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y)).slice(0, M.zap.chain)];
        hit.forEach((en, k) => {
          const from = k ? e : b;
          game.tfx.push({ kind: 'zap', x1: from.x, y1: from.y, x2: en.x, y2: en.y, seed: Math.random() * 1e6, life: M.zap.life, max: M.zap.life });
          hitEnemy({ card: A.card, look: 'laser', dmg: Math.round(A.dmg * (k ? M.zap.chainDmg : M.zap.dmg)), knock: knockOf(60), vx: en.x - from.x, vy: en.y - from.y, x: en.x, y: en.y }, en);
        });
        game.tfx.push({ kind: 'spark', x: b.x, y: b.y, life: 0.25, max: 0.25 });
      }
      end();
      break;
    }
    case 'whip': {                                           // swings round you through the enemy, hitting all it touches
      const k = Math.min(1, A.t / M.whip.time), q = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, ang = A.a0 + A.side * M.whip.arc * q;
      b.x = p.x + Math.cos(ang) * A.rad; b.y = p.y + Math.sin(ang) * A.rad;
      for (const en of game.enemies.slice()) {
        if (A.hits.has(en) || hitGap(en, b.x, b.y) > TB.r + 6) continue;
        A.hits.add(en);
        const t = ang + A.side * Math.PI / 2;
        hitEnemy({ card: A.card, look: 'melee', dmg: Math.round(A.dmg * M.whip.dmg), knock: knockOf(CARDS[A.card].knock), vx: Math.cos(t), vy: Math.sin(t), x: en.x, y: en.y }, en);
      }
      if (k >= 1) end();
      break;
    }
    case 'bounce': {                                         // in, hit, bounce off, again: 4 hits, each leg a neon streak
      const B = R.bounce;
      if (A.phase === 'in') {
        if (!alive) {                                        // it died: the nearest other enemy, if there's one close
          const nx = game.enemies.filter(o => !o.dead && !o.apple && Math.hypot(o.x - b.x, o.y - b.y) < B.next).sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y))[0];
          if (!nx) { end(); break; }
          A.e = nx; A.t = 0; A.x0 = b.x; A.y0 = b.y; break;
        }
        if (!flyTo(B.in, e.r * 0.5)) break;
        const a = Math.atan2(e.y - A.y0, e.x - A.x0);   // the way it came in: the hit shoves the enemy on that way
        hitEnemy({ card: A.card, look: 'melee', dmg: Math.max(1, Math.round(A.dmg * B.dmg)), knock: knockOf(B.knock), vx: Math.cos(a), vy: Math.sin(a), x: e.x, y: e.y }, e);
        game.tfx.push({ kind: 'streak', x1: A.x0, y1: A.y0, x2: b.x, y2: b.y, life: B.streak, max: B.streak });
        SFX.tball('shot');
        if (--A.left <= 0) { end(); break; }
        const away = a + Math.PI + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);   // off it at an angle
        Object.assign(A, { phase: 'out', t: 0, x0: b.x, y0: b.y, ox: b.x + Math.cos(away) * B.back, oy: b.y + Math.sin(away) * B.back });
      } else {
        const k = Math.min(1, A.t / B.out), q = 1 - (1 - k) ** 2;
        b.x = A.x0 + (A.ox - A.x0) * q; b.y = A.y0 + (A.oy - A.y0) * q;
        if (k >= 1) {
          game.tfx.push({ kind: 'streak', x1: A.x0, y1: A.y0, x2: b.x, y2: b.y, life: B.streak, max: B.streak });
          Object.assign(A, { phase: 'in', t: 0, x0: b.x, y0: b.y });
        }
      }
      break;
    }
    default: end();
  }
}

/* ---------- Melee: the red shield, and the pulse ---------- */
// One melee ball projects it (`ball`): a beam from that ball to the shield shows which (user).
function tballShield(card) {
  const S = TB.melee.shield, p = game.player, mine = game.tballs.filter(b => b.kind === 'melee');
  const ball = mine.find(b => !b.act) || mine[0] || null;
  game.tshield = { hits: S.hits, t: S.time, max: S.time, ball };
  if (ball) { ball.hot = 0.4; game.rings.push({ x: ball.x, y: ball.y, r: TB.r, max: TB.r + 14, life: 0.25, color: TBC.red }); }
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 24, life: 0.3, color: TBC.red });
  SFX.tball('shield');
}
// PULSE: every ball round you lets out a ring of red energy, pushing what's near it away from you (light damage).
function tballPulse(card) {
  const P = TB.melee.pulse, p = game.player, hit = new Set(), dmg = Math.max(1, damageOf(CARDS[card].dmg * P.dmg));
  for (const b of game.tballs) {
    game.rings.push({ x: b.x, y: b.y, r: TB.r, max: P.radius, life: 0.35, color: TBC.red });
    game.tfx.push({ kind: 'pulse', x: b.x, y: b.y, life: 0.3, max: 0.3 });
    b.hot = 0.4;
    for (const e of game.enemies.slice()) {
      if (hit.has(e) || hitGap(e, b.x, b.y) > P.radius) continue;
      hit.add(e);
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      hitEnemy({ card, look: 'blast', dmg, knock: knockOf(P.knock), vx: Math.cos(a), vy: Math.sin(a), x: e.x, y: e.y }, e);
    }
  }
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: TB.orbit.r + P.radius * 0.6, life: 0.4, color: TBC.red });
  SFX.tball('pulse');
}
// combat.js hurtPlayer: it takes the hit whole, then it's gone.
function tShieldAbsorb() {
  const p = game.player;
  game.tshield = null;
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: 'BLOCKED', color: TBC.red, life: 0.5, vy: -40, big: false });
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r + 6, max: PLAYER.r + 36, life: 0.3, color: TBC.red });
  burst(p.x, p.y, TBC.red, 12, 200);
  SFX.tball('block');
  return true;
}

/* ---------- combos (only with other cards in the deck: combos.js comboAt) ---------- */
function tballCombo(cb, echo) {
  const p = game.player, { card, n } = cb;
  if (!game.tballs.length) tballSync();
  if (!echo) {
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: cb.name, color: TBC.red, life: 0.9, vy: -40, big: true });
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 54, life: 0.3, color: TBC.red });
    SFX.combo(n, card);
  }
  if (n === 7) {                                             // QUAD SHOT!: one very fast shot from each ball
    const Q = TB.quad, ts = targets(4, rangeOf('tball') * 1.3), balls = game.tballs.length ? game.tballs : [{ x: p.x, y: p.y }];
    if (!ts.length) return false;
    for (let k = 0; k < 4; k++) {
      const b = balls[k % balls.length], e = ts[k % ts.length], rad = Q.aoe[0] + Math.random() * (Q.aoe[1] - Q.aoe[0]);
      later(k * 0.05, () => {
        shoot('tball', e, { from: { x: b.x, y: b.y }, raw: true, speedMul: Q.speedMul, dmg: CARDS.tball.dmg * Q.dmg, aoe: { radius: rad, dmg: CARDS.tball.dmg * Q.aoeDmg }, quiet: true });
        b.hot = 0.3;
        SFX.tball('shot');
      });
    }
    return true;
  }
  game.twild = TB.wild.time;                                // GO WILD!
  for (const b of game.tballs) { b.act = null; b.wt = null; b.trail.length = 0; }
  SFX.tball('wild');
  return true;
}
// GO WILD!: each ball picks an enemy near you and flies into it, then another, trailing red.
function wildStep(b, dt, i, n) {
  const W_ = TB.wild, p = game.player;
  if (b.wcd > 0) {                                          // bouncing off what it just hit
    b.wcd -= dt;
    b.x += Math.cos(b.wa) * W_.speed * 0.6 * dt; b.y += Math.sin(b.wa) * W_.speed * 0.6 * dt;
    return;
  }
  if (!b.wt || b.wt.dead || !game.enemies.includes(b.wt)) {
    const near = game.enemies.filter(e => (!e.dummy || game.practice) && !e.apple && hitGap(e, p.x, p.y) < W_.reach);
    b.wt = near.length ? near[Math.floor(Math.random() * Math.min(near.length, 6))] : null;
  }
  const t = b.wt;
  if (!t) {                                                 // nothing near: a fast, wide orbit
    const h = tballHome(i, n), k = 1 - Math.exp(-10 * dt);
    b.x += (h.x - b.x) * k; b.y += (h.y - b.y) * k;
    return;
  }
  const a = Math.atan2(t.y - b.y, t.x - b.x), step = W_.speed * dt;
  b.x += Math.cos(a) * step; b.y += Math.sin(a) * step;
  if (hitGap(t, b.x, b.y) <= TB.r + 2) {
    hitEnemy({ card: b.kind === 'ranged' ? 'tball' : 'tballm', look: 'melee', dmg: damageOf(CARDS.tball.dmg * W_.dmg), knock: knockOf(140), vx: Math.cos(a), vy: Math.sin(a), x: t.x, y: t.y }, t);
    b.wt = null; b.wcd = W_.bounce; b.wa = a + Math.PI + (Math.random() - 0.5) * 1.4;
  }
}

/* ---------- each frame (combat.js update) ---------- */
const tballHidden = () => game.inMenu && !game.practice?.demo;   // (behind the menus, except the main menu's demo fight)
function tballStep(dt) {
  if (!game.tballs || tballHidden()) return;
  if ((game.tbSync = (game.tbSync || 0) - dt) <= 0) { game.tbSync = TB.sync; tballSync(); }
  const wild = game.twild > 0;
  game.tbAng = (game.tbAng || 0) + dt * TB.orbit.speed * (wild ? 3 : 1);
  if (game.tshield && (game.tshield.t -= dt) <= 0) game.tshield = null;
  const n = game.tballs.length;
  game.tballs.forEach((b, i) => {
    b.spin += dt * 9; b.hot = Math.max(0, b.hot - dt);
    if (wild) wildStep(b, dt, i, n);
    else if (b.act) actStep(b, dt);
    else {
      const h = tballHome(i, n, b);
      if (game.tshield?.ball === b && !b.back) { const k = 1 - Math.exp(-14 * dt); b.x += (h.x - b.x) * k; b.y += (h.y - b.y) * k; }   // (eases out to it)
      else if (b.back) {                                          // flying home, quickly
        const k = 1 - Math.exp(-TB.back * dt);
        b.x += (h.x - b.x) * k; b.y += (h.y - b.y) * k;
        if (Math.hypot(h.x - b.x, h.y - b.y) < 2) b.back = false;
      } else if (game.tshield?.ball !== b) {
        if (Math.hypot(h.x - b.x, h.y - b.y) > 3) b.back = true; else { b.x = h.x; b.y = h.y; }   // (back in from holding the shield, smoothly)
      }
      b.alpha = Math.min(1, b.alpha + dt / TB.ranged.bomb.fade);   // (one that blew up fades back in)
    }
    if (wild || b.act?.trail || b.back) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > (wild ? 12 : 8)) b.trail.shift(); }
    else if (b.trail.length) b.trail.shift();
  });
  if (wild && (game.twild -= dt) <= 0) { game.twild = 0; for (const b of game.tballs) { b.back = true; b.wt = null; } }
  for (let i = game.tfx.length - 1; i >= 0; i--) if ((game.tfx[i].life -= dt) <= 0) game.tfx.splice(i, 1);
}

/* ---------- how they look (draw.js, over you) ---------- */
// One ball (the user's reference, small): a white sphere, shaded, with gold speakers turning round it, a dark band
// round its middle with a red light in it, a shine, and a red glow; `hot` brightens the glow (it just did something).
// (Its shaded shell is drawn once and reused: a new gradient for every ball every frame made the browser pause to
// clear them up every few seconds.)
const TB_SHELL = new Map();
function tballShell(r) {
  let c = TB_SHELL.get(r);
  if (c) return c;
  const s = 4, n = Math.ceil(r * 2 * s) + 2;
  c = document.createElement('canvas'); c.width = c.height = n;
  const g2 = c.getContext('2d');
  g2.translate(n / 2, n / 2); g2.scale(s, s);
  const g = g2.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, TBC.shell); g.addColorStop(1, TBC.shade);
  g2.fillStyle = g; g2.beginPath(); g2.arc(0, 0, r, 0, TAU); g2.fill();
  TB_SHELL.set(r, c);
  return c;
}
function drawTBall(x, y, r, spin, alpha = 1, hot = 0) {
  if (alpha <= 0) return;
  fxGlow(x, y, r * (3.4 + hot * 2), TBC.red, (0.55 + hot * 0.45) * alpha);
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  const shell = tballShell(r), half = shell.width / 8;
  ctx.drawImage(shell, -half, -half, half * 2, half * 2);
  ctx.save();                                                // (no clip: it stalls the canvas now and then; the shapes stay inside)
  for (let k = 0; k < 6; k++) {                              // the speakers, turning with it (only the front ones show)
    const lon = spin + k * TAU / 6, front = Math.cos(lon);
    if (front <= 0.1) continue;
    const sx = Math.sin(lon) * r * 0.6, sy = (k % 2 ? -0.5 : 0.5) * r, w = r * 0.2 * front;
    ctx.fillStyle = TBC.band; ctx.beginPath(); ctx.ellipse(sx, sy, w * 1.25, r * 0.24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = TBC.gold; ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.75, r * 0.15, 0, 0, TAU); ctx.fill();
  }
  ctx.rotate(-0.18);                                         // the band, a little tilted: the sphere between two lines
  const band = (y1, y2) => {
    const a1 = Math.asin(y1 / r), a2 = Math.asin(y2 / r);
    ctx.beginPath(); ctx.arc(0, 0, r, a1, a2); ctx.arc(0, 0, r, Math.PI - a2, Math.PI - a1); ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = TBC.band; band(-r * 0.2, r * 0.22);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; band(-r * 0.2, -r * 0.13);
  const lon = spin * 0.5, f = Math.cos(lon);                 // its red light, turning with it
  if (f > 0) {
    ctx.fillStyle = TBC.red; ctx.beginPath(); ctx.ellipse(Math.sin(lon) * r * 0.7, r * 0.01, r * 0.22 * f + 0.6, r * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(Math.sin(lon) * r * 0.7, r * 0.01, r * 0.08 * f + 0.3, r * 0.08, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.48, r * 0.26, r * 0.14, -0.6, 0, TAU); ctx.fill();   // the shine
  if (hot > 0) { fxAdd(TBC.red); ctx.globalAlpha = alpha * hot * 0.6; ctx.fillStyle = TBC.red; circle(0, 0, r); fxNormal(); }
  ctx.restore();
}
function drawTBalls() {
  if (!game.tballs || tballHidden()) return;
  const p = game.player, t = performance.now() / 1000;
  if (game.tshield) {                                        // the red shield: a circle round you, and the beam from the ball holding it up
    const s = game.tshield, fade = Math.min(1, s.t / 0.35, (s.max - s.t) / 0.12 + 0.2), R = PLAYER.r + 8, b = s.ball;
    fxGlow(p.x, p.y, R * 1.9, TBC.red, 0.35 * fade);
    fxAdd(TBC.red); ctx.strokeStyle = TBC.red; ctx.fillStyle = TBC.red; ctx.lineCap = 'round';
    if (b && game.tballs.includes(b)) {                      // the beam: from that ball to the shield's edge, flowing in
      const a = Math.atan2(b.y - p.y, b.x - p.x), ex = p.x + Math.cos(a) * R, ey = p.y + Math.sin(a) * R;
      fxGlow((b.x + ex) / 2, (b.y + ey) / 2, 22, TBC.red, 0.6 * fade);
      ctx.globalAlpha = 0.45 * fade; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = 0.95 * fade; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = t * 40;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, TB.r + 4 + Math.sin(t * 12) * 1.2, 0, TAU); ctx.stroke();   // a ring round it
      ctx.globalAlpha = fade; circle(ex, ey, 2.5);
    }
    ctx.globalAlpha = 0.16 * fade; circle(p.x, p.y, R);
    ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5 * fade; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R, t * 3, t * 3 + 1.2); ctx.stroke();   // a shimmer going round
    fxNormal(); ctx.globalAlpha = 1;
  }
  for (const f of game.tfx) {                                // beams, zaps and sparks
    const k = f.life / f.max;
    if (f.kind === 'beam') {
      fxGlow(f.x2, f.y2, 22, TBC.red, 0.8 * k);
      fxAdd(TBC.red); ctx.lineCap = 'round'; ctx.strokeStyle = TBC.red;
      ctx.globalAlpha = 0.35 * k; ctx.lineWidth = TB.ranged.beam.w * 2.4 * k; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.globalAlpha = k; ctx.lineWidth = TB.ranged.beam.w * k; ctx.stroke();
      fxNormal(); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = k; ctx.lineWidth = Math.max(1, TB.ranged.beam.w * 0.35 * k); ctx.stroke();
    } else if (f.kind === 'zap') {                           // blue energy: jagged, flickering to a new shape as it goes
      const rnd = mulberry32(((f.seed | 0) + Math.floor((f.max - f.life) / 0.04) * 977) | 0);
      fxGlow(f.x2, f.y2, 26, TBC.zap, 0.8 * k);
      fxAdd(TBC.zap); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, a, c] of [[6, 0.35, TBC.zap], [2.4, 1, TBC.zap], [1, 1, '#ffffff']]) {
        ctx.strokeStyle = c; ctx.globalAlpha = a * k; ctx.lineWidth = w;
        boltPath(f.x1, f.y1, f.x2, f.y2, mulberry32((rnd() * 1e9) | 0 || 1), 8); ctx.stroke();
      }
      fxNormal();
    } else if (f.kind === 'spark') {
      fxGlow(f.x, f.y, 30 * (1.5 - k), TBC.zap, 0.9 * k);
    } else if (f.kind === 'pulse') {
      fxGlow(f.x, f.y, TB.melee.pulse.radius * (1.2 - 0.5 * k), TBC.red, 0.6 * k);
    } else if (f.kind === 'streak') {                       // BOUNCE's legs: red neon, fading and thinning to nothing, cleanly
      const e = k * k;
      fxAdd(TBC.red); ctx.lineCap = 'round'; ctx.strokeStyle = TBC.red;
      ctx.globalAlpha = 0.4 * e; ctx.lineWidth = 9 * k + 1; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
      ctx.globalAlpha = e; ctx.lineWidth = 3.5 * k + 0.5; ctx.stroke();
      fxNormal(); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.9 * e; ctx.lineWidth = 1.2 * k + 0.3; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const b of game.tballs) {                             // the trails, then the balls
    if (b.trail.length > 1) {
      fxAdd(TBC.red); ctx.lineCap = 'round'; ctx.strokeStyle = TBC.red;
      for (let k = 1; k < b.trail.length; k++) {
        const a = k / b.trail.length;
        ctx.globalAlpha = 0.6 * a * b.alpha; ctx.lineWidth = TB.r * 1.6 * a;
        ctx.beginPath(); ctx.moveTo(b.trail[k - 1].x, b.trail[k - 1].y); ctx.lineTo(b.trail[k].x, b.trail[k].y); ctx.stroke();
      }
      fxNormal(); ctx.globalAlpha = 1;
    }
    drawTBall(b.x, b.y, TB.r, b.spin, b.alpha, game.twild > 0 ? 0.5 : b.hot);
  }
}
