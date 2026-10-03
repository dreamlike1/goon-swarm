/* snek.js — AWAS THE SNEK, stage 3's boss (v0.54, user): the old phone screen it brings, the snake and its apples, and
   the VAMPIRIC BALLSACK relic it drops. */
'use strict';

/* The fight (user):
   - The arena turns into an old phone's screen: a neon-green LCD with big pixels, and everything on it black. It's
     smaller too: a grid the snake moves round one cell at a time, the way the old Snake game moves.
   - There's an apple. AWAS goes for it, and if it gets there first it eats it and grows. AWAS can't be hurt itself:
     shoot the apple. Every point the apple loses comes off AWAS's health (and stays off, even if it then eats
     that apple: v0.55). A popped apple makes it a little shorter, and a new apple comes.
   - Touch it and you're hurt and bumped away. It never wanders: it always heads straight for the nearest apple (v0.55,
     user), and it's long and fast, faster still as it closes in on the apple.
   - Phase 2 (when phase 1's bar is gone): faster again, 2 apples at once, and now and then it hisses and cuts across
     where you're heading instead, for a moment.
   Every number is a placeholder. */
const SNEK = {
  name: 'AWAS THE SNEK',
  cell: 24,                                  // world px per grid cell: 8 of the screen's big pixels (NOKIA.px)
  fit: 0.76, min: { cols: 18, rows: 10 }, max: { cols: 44, rows: 26 },   // the grid: this share of the view's width
  len: 18, grow: 5, shrink: 2, minLen: 12, maxLen: 50,  // its length; +grow per apple eaten (up to maxLen), −shrink per apple popped (v0.55, user: longer, twice)
  step: 0.065, stepMin: 0.052, quicken: 0.97, // s per cell (v0.55, user: faster, four times; then phase 1 a bit slower); ×quicken for every apple it has eaten (one you pop takes one back off)
  rush: { cells: 9, mul: 0.5 },              // closing in on an apple it speeds up: up to 1/mul × as fast, from this many cells away
  frenzy: { at: 20, mul: 0.75 },             // v0.55 (user): from `at` apples eaten it's faster still (its step × mul)
  hp: 100, appleHp: 20, apples: 1,           // phase 1's health; each apple's (both × bossHpMul, flow.js)
  far: [0.5, 0.85],                          // a new apple: this share of the grid's size (cols + rows) from its head
  respawn: 0.35,                             // s before the next apple, once one is gone
  dmg: { head: 18, body: 10 }, bump: 460,    // touching it; the shove
  intro: { beeps: [0.1, 0.3, 0.5], lcd: 0.75, grow: [1.05, 2.3], spawn: 2.7 },
  phase2: { hp: 150, appleHp: 20, apples: 2, step: 0.046, stepMin: 0.038,   // (v0.55, user: a bit slower: 0.04 / 0.033)
            enrage: 1.5, push: 480, dmg: 1.25,
            block: { every: [5, 8], time: 1.9, lead: 0.75 } },   // now and then it cuts across where you're heading (user)
  // v0.55 (user): if it eats `at` apples, the phone screen goes and you're both back in the arena, and AWAS is a huge
  // snake slithering after you. It's slower, but now and then it stops, rears and dashes at you, jaws open (`dash`:
  // `tele` s of warning, then `time` s at `speed`). Here you can hurt the snake itself, once it starts moving: a new,
  // bigger bar, `hp` (× bossHpMul; v0.55, user: 300 before).
  // `px`: its big pixels (8 to a square, as on the phone); `segs` points `gap` px apart make its body. `feast`: the change (s).
  huge: { at: 25, hp: 480, px: 6, segs: 64, gap: 15, speed: 225, turn: 3, wiggle: { amp: 0.5, freq: 2.4 },
          dash: { every: [3.2, 5], tele: 0.7, time: 0.55, speed: 960, rest: 0.45, range: 600 },   // PLUNGE!
          // SPIT! (user): it stops, rears and sprays `volleys` cones of `n` apples at you (`cone` rad wide), to dodge.
          // `repeat`: the chance it does the same move twice running (it mostly takes turns with PLUNGE!)
          spit: { tele: 0.65, volleys: 3, gap: 0.24, n: 7, cone: 1.2, speed: [310, 400], dmg: 13, r: 13, px: 4, rest: 0.55, range: 700, repeat: 0.3 },
          dmg: { head: 22, body: 12, dash: 34 }, bump: 540, feast: { off: 0.9, grow: 1.8 }, xp: 60 },
  death: { blink: 1.1, pop: 1.5, after: 0.7, back: 0.6 },   // blinks; its body pops from the tail in `pop` s; the screen comes back
  xp: 30,
};
// The phone screen: `px` world px to one of its big pixels.
const NOKIA = { px: 3 };
const SNEK_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const SNEK_INTRO = `<p class="intro-line is-snek">ITS SO BIG…</p>`;   // (user)

/* ---------- the fight ---------- */
const nokiaNow = () => !!game.snek?.lcd;
const snekCellX = (s, c) => s.box.x + (c + 0.5) * SNEK.cell;
const snekCellY = (s, r) => s.box.y + (r + 0.5) * SNEK.cell;
const lcdSnap = v => Math.round(v / NOKIA.px) * NOKIA.px;
const snekP = s => (s.phase === 2 ? SNEK.phase2 : null);

// The grid, fitted to the screen: under the run's bar and the boss bar (and room for its score), above the HUD, and
// clear of your stats down the left (the same gap on the right, so it's centred). In co-op the world is bigger than
// the view, so it sits in the middle of it.
function snekBox() {
  const C = SNEK.cell, P = NOKIA.px, head = 18 * P + 6;            // the score over the frame (drawSnekFrame)
  const bar = document.getElementById('runbar')?.getBoundingClientRect(), ar = arena.getBoundingClientRect();
  const vw = VW / viewZoom, vh = (NET.viewSafe || VH) / viewZoom;
  const top = Math.max(40, (bar ? bar.bottom - ar.top : 50) + 70) / viewZoom + head;
  const fit = (n, a, b) => Math.max(a, Math.min(b, n));
  const stats = document.getElementById('statpanel')?.getBoundingClientRect();
  const side = Math.max(vw * (1 - SNEK.fit) / 2, stats && stats.width ? (stats.right - ar.left) / viewZoom + 14 : 0);
  const cols = fit(Math.floor((vw - 2 * side) / C), SNEK.min.cols, SNEK.max.cols);
  const rows = fit(Math.floor((vh - top - 18) / C), SNEK.min.rows, SNEK.max.rows);
  const w = cols * C, h = rows * C;
  const x = NET.run ? (W - w) / 2 : (W - w) / 2, y = NET.run ? (H - h) / 2 : Math.max(top, top + (vh - top - 18 - h) / 2);
  return { x: lcdSnap(x), y: lcdSnap(y), w, h, cols, rows };
}

// Stage 3's clock (flow.js) sets game.snekDue; combat.js starts this once the floor is clear.
function startSnek() {
  game.snekDue = false;
  for (const e of game.enemies) {                             // the swarm scatters, as for the others
    burst(e.x, e.y, enemyCol(e), 6, 140);
    game.rings.push({ x: e.x, y: e.y, r: 2, max: e.r * 2, life: 0.3, color: enemyCol(e) });
  }
  game.enemies = []; game.projectiles = []; game.rocks = []; game.eshots = [];
  aliveEl.textContent = 0;
  snekSweepOrbs();
  const box = snekBox(), r = Math.floor(box.rows / 2), c = Math.floor(box.cols / 2) + 3;
  const hp = Math.round(SNEK.hp * bossHpMul());
  game.snek = {
    box, cols: box.cols, rows: box.rows, body: snekCoil(c, r, box.cols, SNEK.len), dir: [1, 0],
    state: 'intro', t: 0, tick: 0, grow: 0, phase: 1, hp, maxHp: hp, lcd: false, reveal: 0,
    eaten: 0, popped: 0, quick: 0, mouth: 0, flash: 0, next: 0,
  };
  game.intro = { kind: 'snek', t: 0, stomp: 0 };
  startIntroScene('snek');
}
// XP left on the floor is yours before the screen shrinks (v0.55, user: it was left behind): every orb flies to you
// during the intro (combat.js orbStep), and any still out there when the fight starts is collected then. Potions and
// diamonds are pulled in too.
function snekSweepOrbs(now) {
  if (NET.guest) return;
  for (const o of game.orbs) { o.magnetized = true; o.vacuum = true; }
  for (const d of game.potions.concat(game.diamonds)) d.vacuum = true;
  if (!now || !game.orbs.length) return;
  for (const o of game.orbs) gainXp(xpGain(o.value));
  SFX.pickup();
  game.orbs = [];
}
// Its body at the start: back from its head along the row, and if it's too long for that, on along the row below
// the other way, and so on (it's long: v0.55).
function snekCoil(c, r, cols, len) {
  const body = [];
  let x = c, y = r, dx = -1;
  while (body.length < len) {
    body.push([x, y]);
    if (x + dx < 1 || x + dx > cols - 2) { y++; dx = -dx; } else x += dx;
  }
  return body;
}
// The intro (boss.js updateIntro hands over): three key beeps, the screen switches to the phone's, AWAS draws itself
// in one segment at a time, then the fight starts.
function updateSnekIntro(dt) {
  const it = game.intro, I = SNEK.intro, s = game.snek;
  it.t += dt;
  if (it.stomp < I.beeps.length && it.t >= I.beeps[it.stomp]) { it.stomp++; SFX.snekBeep(it.stomp); }
  if (s && !s.lcd && it.t >= I.lcd) lcdPower(s, true);
  if (s && it.t >= I.grow[0]) {
    const n = Math.ceil(Math.min(1, (it.t - I.grow[0]) / (I.grow[1] - I.grow[0])) * s.body.length);
    if (n > s.reveal) { s.reveal = n; SFX.snekBlip(n / s.body.length); }
  }
  if (it.t >= I.spawn) {
    game.intro = null;
    if (s) { s.reveal = s.body.length; if (!NET.guest) { s.state = 'go'; s.next = 0.2; } }
    snekSweepOrbs(true);                                      // (any XP still on its way: yours now)
    introEl.innerHTML = `<p class="intro-name is-snek"><span class="intro-vs">VS</span>${SNEK.name}</p>`;
    introTimer = setTimeout(() => { introEl.hidden = true; }, 1400);
    SFX.snekHiss();
    renderSnekBar();
  }
}
// The phone screen on or off (draw.js picks it up each frame: syncLcd). Switching on pulls everyone onto the grid.
function lcdPower(s, on) {
  s.lcd = on;
  SFX.snekBoot(on);
  if (on) eachLiving(() => clampTo(game.player, PLAYER.r));
}

// One frame of AWAS (combat.js, after the enemies): its steps, its apples, and you bumping into it.
function updateSnek(dt) {
  const s = game.snek;
  if (!s || s.state === 'intro') return;
  s.flash = Math.max(0, s.flash - dt);
  if (s.state === 'dead') { snekDeathStep(s, dt); return; }
  snekTune();
  if (s.state === 'feast' || s.state === 'huge' || s.state === 'hugeDead') { updateHuge(s, dt); return; }   // grown huge (below)
  if (s.state === 'enrage') {                                 // phase 2 starts: it thrashes in place for a moment
    if ((s.t -= dt) <= 0) { s.state = 'go'; s.next = 0; }
    snekTouch(s);
    return;
  }
  const P = snekP(s), me = game.player;
  if (s.lastP) { const k = Math.min(1, dt * 6); s.pv = { x: (s.pv?.x || 0) * (1 - k) + (me.x - s.lastP.x) / dt * k, y: (s.pv?.y || 0) * (1 - k) + (me.y - s.lastP.y) / dt * k }; }
  s.lastP = { x: me.x, y: me.y };                             // (how you're moving: where phase 2 cuts you off)
  if (P) {
    if (s.block) { if ((s.block.t -= dt) <= 0) { s.block = null; s.blockCd = between(P.block.every); } }
    else if ((s.blockCd ??= between(P.block.every)) > 0 && (s.blockCd -= dt) <= 0) {
      s.block = { t: P.block.time };
      SFX.snekHiss();
      const [c, r] = s.body[0];
      game.floaters.push({ x: snekCellX(s, c), y: snekCellY(s, r) - 20, text: 'HSSS!', color: COL.lcdInk, life: 0.9, vy: -30, big: true });
    }
  }
  const want = P ? P.apples : SNEK.apples, have = game.enemies.filter(e => e.apple).length;
  if (have < want && (s.next -= dt) <= 0) { spawnApple(s); s.next = SNEK.respawn * 0.5; }
  s.tick += dt;
  const R = SNEK.rush, g = s.block ? null : snekGoal(s), [hc, hr] = s.body[0];
  const near = g ? Math.max(0, 1 - (Math.abs(g[0] - hc) + Math.abs(g[1] - hr)) / R.cells) : 0;
  const st = Math.max(P ? P.stepMin : SNEK.stepMin, (P ? P.step : SNEK.step) * SNEK.quicken ** s.quick) * (1 - (1 - R.mul) * near)
    * (s.eaten >= SNEK.frenzy.at ? SNEK.frenzy.mul : 1);
  s.st = st;                                                  // (drawSnek slides it along by s.tick / s.st)
  for (let n = 0; s.tick >= st && n < 3 && s.state === 'go'; n++) { s.tick -= st; snekStep(s); }
  snekTouch(s);
}

// One cell: it turns toward the nearest apple without doubling back, keeps off its own body and out of corners it
// would coil itself into, and eats an apple it reaches. Nothing random (v0.55, user: it always goes for the apple);
// with no apple up for a moment it keeps straight on, turning toward the middle at a wall.
function snekStep(s) {
  const [hc, hr] = s.body[0], goal = snekGoal(s), occ = new Set(s.body.map(([c, r]) => c * 100 + r));
  if (!s.grow) { const [tc, tr] = s.body[s.body.length - 1]; occ.delete(tc * 100 + tr); }   // the tail moves out of the way
  let best = null, bs = Infinity;
  for (const d of SNEK_DIRS) {
    if (d[0] === -s.dir[0] && d[1] === -s.dir[1]) continue;
    const c = hc + d[0], r = hr + d[1];
    if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) continue;
    const straight = d[0] === s.dir[0] && d[1] === s.dir[1];
    const to = goal || [s.cols >> 1, s.rows >> 1];
    let sc = goal || !straight ? Math.abs(to[0] - c) + Math.abs(to[1] - r) : -1e3;
    if (occ.has(c * 100 + r)) sc += 1e4;                      // through itself: only if there's no other way
    else if (snekRoom(s, c, r, occ) < s.body.length) sc += 500;
    if (straight) sc -= 0.5;
    if (sc < bs) { bs = sc; best = d; }
  }
  s.prev = s.body.map(([c, r]) => [c, r]);                   // where each segment was (drawSnek slides it on from there)
  if (!best) {                                                // boxed into a corner: it turns round
    s.prev = null;
    s.body.reverse();
    const [a, b] = s.body;
    s.dir = [a[0] - b[0], a[1] - b[1]];
    return;
  }
  s.dir = best;
  const head = [hc + best[0], hr + best[1]];
  s.body.unshift(head);
  if (s.grow > 0) s.grow--; else s.body.pop();
  s.mouth = 1 - s.mouth;
  const a = game.enemies.find(e => e.apple && e.gc === head[0] && e.gr === head[1]);
  if (a) eatApple(s, a);
}
// How many free cells it could still reach from (c, r): fewer than its length is a trap.
function snekRoom(s, c, r, occ) {
  const seen = new Set([c * 100 + r]), todo = [[c, r]], need = s.body.length;
  while (todo.length && seen.size < need) {
    const [x, y] = todo.pop();
    for (const [dx, dy] of SNEK_DIRS) {
      const nx = x + dx, ny = y + dy, k = nx * 100 + ny;
      if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows || occ.has(k) || seen.has(k)) continue;
      seen.add(k); todo.push([nx, ny]);
    }
  }
  return seen.size;
}
// The cell it's heading for: the nearest apple (none: null). Phase 2, cutting you off: the cell just ahead of you.
function snekGoal(s) {
  const [hc, hr] = s.body[0];
  if (s.block) {
    const me = game.player, L = SNEK.phase2.block.lead, v = s.pv || { x: 0, y: 0 };
    const x = me.x + v.x * L, y = me.y + v.y * L, cl = (n, hi) => Math.max(0, Math.min(hi - 1, n));
    return [cl(Math.floor((x - s.box.x) / SNEK.cell), s.cols), cl(Math.floor((y - s.box.y) / SNEK.cell), s.rows)];
  }
  let best = null, bd = Infinity;
  for (const e of game.enemies) {
    if (!e.apple) continue;
    const d = Math.abs(e.gc - hc) + Math.abs(e.gr - hr);
    if (d < bd) { bd = d; best = [e.gc, e.gr]; }
  }
  return best;
}

// A new apple: on a free cell well away from its head (and the other apple), not right against the wall (its HP bar
// would sit on the frame). It blinks in (draw: drawApple).
function spawnApple(s) {
  const [hc, hr] = s.body[0], taken = new Set(s.body.map(([c, r]) => c * 100 + r));
  const others = game.enemies.filter(e => e.apple);
  const span = s.cols + s.rows, want = span * between(SNEK.far);
  let cell = null, bestGap = -1;
  for (let i = 0; i < 90; i++) {
    const c = 1 + Math.floor(Math.random() * (s.cols - 2)), r = 1 + Math.floor(Math.random() * (s.rows - 2));
    if (taken.has(c * 100 + r) || others.some(o => Math.abs(o.gc - c) + Math.abs(o.gr - r) < 4)) continue;
    const d = Math.abs(c - hc) + Math.abs(r - hr);
    if (d >= want) { cell = [c, r]; break; }
    if (d > bestGap) { bestGap = d; cell = [c, r]; }          // (the furthest so far, if none is far enough)
  }
  if (!cell) return;
  const hp = Math.round((snekP(s) ? SNEK.phase2.appleHp : SNEK.appleHp) * bossHpMul());
  const x = snekCellX(s, cell[0]), y = snekCellY(s, cell[1]);
  game.enemies.push({ apple: true, type: 'apple', shape: 'apple', gc: cell[0], gr: cell[1], x, y, vx: 0, vy: 0, kx: 0, ky: 0,
    r: SNEK.cell * 0.46, hp, maxHp: hp, dmg: 0, hit: 0, born: 0, speed: 0 });
  aliveEl.textContent = game.enemies.length;
  SFX.snekBlip(1);
}
// It got there first: it grows and gets a little faster. (v0.55: the damage you'd done to that apple stays done; it
// used to come back to AWAS, but now that it always goes straight for the apple that made the fight drag on.)
function eatApple(s, a) {
  game.enemies.splice(game.enemies.indexOf(a), 1);
  aliveEl.textContent = game.enemies.length;
  s.grow = Math.min(s.grow + SNEK.grow, Math.max(0, SNEK.maxLen - s.body.length)); s.eaten++; s.quick++; s.next = SNEK.respawn;
  game.floaters.push({ x: a.x, y: a.y - 24, text: 'CHOMP!', color: COL.lcdInk, life: 1.1, vy: -36, big: true });
  game.rings.push({ x: a.x, y: a.y, r: 6, max: SNEK.cell * 2.5, life: 0.35, color: COL.lcdInk });
  game.shake = Math.max(game.shake, 0.12);
  SFX.snekEat();
  if (s.eaten === SNEK.frenzy.at) {                           // getting close: it speeds up (user)
    toast(`${SNEK.name} IS IN A FRENZY · ${SNEK.huge.at - s.eaten} MORE AND IT GROWS HUGE`, 'snek');
    SFX.snekHiss();
  }
  if (s.eaten >= SNEK.huge.at && !NET.guest) snekFeast(s);   // that's too many: it grows huge (below)
  renderSnekBar();
}
// A shot hit an apple (combat.js hitEnemy, after its damage): the same comes off AWAS. Popped: it shrinks.
function appleHit(e, dealt) {
  const s = game.snek;
  if (!s) return;
  s.hp = Math.max(0, s.hp - dealt);
  if (e.hp <= 0 && game.enemies.includes(e)) popApple(s, e);
  if (s.hp <= 0 && s.state === 'go') { if (s.phase === 1) snekNextPhase(s); else snekDie(s); }
  renderSnekBar();
}
function popApple(s, e) {
  e.dead = true;
  game.enemies.splice(game.enemies.indexOf(e), 1);
  aliveEl.textContent = game.enemies.length;
  s.popped++; s.quick = Math.max(0, s.quick - 1); s.flash = 0.25; s.next = SNEK.respawn;
  const cut = Math.min(SNEK.shrink, s.grow);                  // it loses what it was about to grow first …
  s.grow -= cut;
  for (let k = cut; k < SNEK.shrink && s.body.length > SNEK.minLen; k++) {   // … then segments off its tail
    const [c, r] = s.body.pop();
    burst(snekCellX(s, c), snekCellY(s, r), COL.lcdInk, 8, 160);
  }
  burst(e.x, e.y, COL.lcdInk, 26, 260);
  game.rings.push({ x: e.x, y: e.y, r: 8, max: SNEK.cell * 3, life: 0.4, color: COL.lcdInk });
  game.floaters.push({ x: e.x, y: e.y - 22, text: 'POP!', color: COL.lcdInk, life: 0.8, vy: -40, big: true });
  game.shake = Math.max(game.shake, 0.15);
  game.kills++;
  document.getElementById('kills').textContent = game.kills;
  sackFeed(1);
  SFX.snekPop(false);
}

// Phase 1's bar is gone: it doesn't die, it gets angry (as SKURTOSAURUS does).
function snekNextPhase(s) {
  const P = SNEK.phase2, hp = Math.round(P.hp * bossHpMul());
  game.enemies = game.enemies.filter(e => !e.apple);
  aliveEl.textContent = game.enemies.length;
  Object.assign(s, { phase: 2, hp, maxHp: hp, state: 'enrage', t: P.enrage, flash: P.enrage, block: null, blockCd: between(P.block.every) });
  s.grow += 2;
  const [c, r] = s.body[0], hx = snekCellX(s, c), hy = snekCellY(s, r);
  eachLiving(() => {                                          // the thrash shoves you back
    const q = game.player, dx = q.x - hx, dy = q.y - hy, d = Math.hypot(dx, dy) || 1;
    q.kx = (q.kx || 0) + dx / d * P.push; q.ky = (q.ky || 0) + dy / d * P.push;
  });
  game.rings.push({ x: hx, y: hy, r: 10, max: Math.max(s.box.w, s.box.h) * 0.6, life: 0.7, color: COL.lcdInk });
  game.shake = Math.max(game.shake, 0.5);
  game.hitstop = Math.max(game.hitstop || 0, 0.12);
  SFX.snekEnrage();
  toast(`PHASE 2 · ${SNEK.name} IS ENRAGED · 2 APPLES!`, 'snek');
  renderSnekBar();
}
// Phase 2's bar is gone: the old game-over. It blinks, its body pops away from the tail up, the screen goes back to
// normal, and then the rewards (snekDown).
function snekDie(s) {
  game.enemies = game.enemies.filter(e => !e.apple);
  aliveEl.textContent = game.enemies.length;
  game.projectiles = [];
  Object.assign(s, { state: 'dead', t: 0, block: null, flash: 0, gap: SNEK.death.pop / Math.max(1, s.body.length), popT: 0, gone: null });
  game.hitstop = Math.max(game.hitstop || 0, 0.15);
  game.shake = Math.max(game.shake, 0.4);
  SFX.snekDie();
  renderSnekBar();
}
function snekDeathStep(s, dt) {
  const D = SNEK.death;
  s.t += dt;
  if (s.t < D.blink) return;
  if (s.body.length) {
    s.popT += dt;
    while (s.popT >= s.gap && s.body.length) {
      s.popT -= s.gap;
      const [c, r] = s.body.pop(), x = snekCellX(s, c), y = snekCellY(s, r);
      if (s.body.length) { burst(x, y, COL.lcdInk, 6, 150); SFX.snekBlip(1 - s.body.length / 40); continue; }
      burst(x, y, COL.lcdInk, 50, 360);                       // the head: the last and biggest
      game.rings.push({ x, y, r: 10, max: 220, life: 0.7, color: COL.lcdInk });
      game.shake = Math.max(game.shake, 0.45);
      SFX.snekPop(true);
      s.gone = s.t; s.hx = x; s.hy = y;
    }
    return;
  }
  if (s.lcd && s.t - s.gone >= D.after) lcdPower(s, false);
  if (!s.lcd && s.t - s.gone >= D.after + D.back) snekDown(s);
}
// It's gone: gold, a big XP orb, and the relic.
function snekDown(s) {
  game.snek = null; game.snekDone = true;
  bossBar.hidden = true; bossBar.classList.remove('is-snek', 'is-phase2', 'is-huge');
  rootEl.classList.remove('snek-fight');
  bonusGold('AWAS', GOLD_BONUS.snek);
  const x = s.hx ?? s.box.x + s.box.w / 2, y = s.hy ?? s.box.y + s.box.h / 2;
  game.orbs.push({ x, y, vx: 0, vy: 0, value: SNEK.xp, r: 11, t: 0, born: 0 });
  if (NET.run) {                                              // co-op: everyone gets it, and the fight goes on
    eachPlayer(() => { if (!game.relics.includes('sack')) game.relics = [...game.relics, 'sack']; game.sack = 0; game.sackCd = 0; renderRelics(); });
    toast(`EVERYONE GOT ${SACK.name} · ${SACK.key} TO DRINK`, 'sack');
    SFX.upgrade(4);
  } else if (!game.relics.includes('sack')) {
    game.relics.push('sack');
    game.sack = 0; game.sackCd = 0;
    renderRelics();
    SFX.upgrade(4);
    game.upQueue.unshift({ kind: 'relic', relic: 'sack', level: game.level });   // its message, like the others'
    if (!game.choosing) openNext();
  }
}

// Touching it: hurt (its head hurts more) and shoved out of it. A BULL charge or the mini shield takes no damage.
// Its body is a wall (v0.55, user: the snake blocks your attacks): a shot whose path from (x0, y0) to (x1, y1) runs
// into it stops there. Returns where, or null. (combat.js: shots in flight, and the Laser's zap.)
function snekWall(x0, y0, x1, y1) {
  const s = game.snek;
  if (!s || (s.state !== 'go' && s.state !== 'enrage')) return null;
  const C = SNEK.cell, cells = new Set(s.body.map(([c, r]) => c * 100 + r));
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let k = 1; k <= n; k++) {
    const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
    const c = Math.floor((x - s.box.x) / C), r = Math.floor((y - s.box.y) / C);
    if (cells.has(c * 100 + r)) return { x, y };
  }
  return null;
}
// A shot stopped by its body: a little puff of ink and a tick.
function snekBlocked(at) {
  burst(at.x, at.y, COL.lcdInk, 5, 120);
  game.rings.push({ x: at.x, y: at.y, r: 2, max: 12, life: 0.18, color: COL.lcdInk });
  const now = performance.now();
  if (now - (game.snek.tink || 0) > 90) { game.snek.tink = now; SFX.snekBlip(0.15); }
}
function snekTouch(s) {
  const half = SNEK.cell / 2 - 2, P = snekP(s), mul = P ? P.dmg : 1;
  eachLiving(() => {
    const p = game.player;
    for (let i = 0; i < s.body.length; i++) {
      const x = snekCellX(s, s.body[i][0]), y = snekCellY(s, s.body[i][1]);
      const qx = Math.max(x - half, Math.min(x + half, p.x)), qy = Math.max(y - half, Math.min(y + half, p.y));
      let dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
      if (d >= PLAYER.r) continue;
      if (d < 0.01) {                                         // right inside a segment: out the way it isn't going
        dx = p.x - x; dy = p.y - y; d = Math.hypot(dx, dy);
        if (d < 0.5) { dx = -s.dir[1]; dy = s.dir[0]; d = 1; }
        p.x = x + dx / d * (half + PLAYER.r + 1); p.y = y + dy / d * (half + PLAYER.r + 1);
      } else { p.x = qx + dx / d * (PLAYER.r + 0.5); p.y = qy + dy / d * (PLAYER.r + 0.5); }
      p.kx = dx / d * SNEK.bump; p.ky = dy / d * SNEK.bump;
      if (game.shield > 0 || game.dash) game.shieldHit = 0.15;
      else if (!(p.safe > 0)) { p.flash = 0.2; hurtPlayer(Math.round((i === 0 ? SNEK.dmg.head : SNEK.dmg.body) * mul)); }
      clampTo(p, PLAYER.r);
      break;
    }
  });
}

// The boss bar, in the phone's style (style.css .bossbar.is-snek).
function renderSnekBar() {
  const s = game.snek;
  if (!s || s.state === 'intro') { if (!s) bossBar.classList.remove('is-snek'); return; }
  bossBar.hidden = s.state === 'dead' || s.state === 'hugeDead';
  bossBar.classList.remove('is-obi', 'is-makora');
  bossBar.classList.add('is-snek');
  bossBar.classList.toggle('is-phase2', s.phase === 2);
  bossFill.style.transform = `scaleX(${Math.max(0, s.hp) / s.maxHp})`;
  bossBar.setAttribute('aria-label', `${SNEK.name} health`);
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(s.hp)));
  bossBar.setAttribute('aria-valuemax', s.maxHp);
  bossBar.querySelector('.boss-name').textContent = s.huge ? `${SNEK.name} · TOO BIG` : s.phase === 2 ? `${SNEK.name} · ENRAGED` : SNEK.name;
  bossBar.classList.toggle('is-huge', !!s.huge);
  rootEl.classList.add('snek-fight');                        // (toasts sit under its taller bar: style.css)
  const sub = bossBar.querySelector('.boss-sub');
  sub.hidden = false;
  sub.textContent = s.huge ? (s.state === 'feast' ? `It ate ${s.eaten} apples · it's growing…` : `It ate ${s.eaten} apples · now you can hurt it`)
    : `Eaten ${s.eaten} / ${SNEK.huge.at} · popped ${s.popped}`;   // (user: a tracker; at ${SNEK.huge.at} it grows huge)
}

function resetSnek() {
  game.snek = null; game.snekDue = false; game.snekDone = false;
  game.sack = 0; game.sackCd = 0; game.sackFx = 0;
  bossBar.classList.remove('is-snek', 'is-huge');
  rootEl.classList.remove('snek-fight');
  snekTuneStop();
}

/* ---------- its music: a little monophonic phone tune, made on the fly (an original one) ---------- */
// Eighth notes at `bpm`; the melody on a square wave, a bass note on each beat. 0 is a rest.
const SNEK_TUNE = {
  bpm: 152,
  lead: 'A4 C5 E5 A5 G5 E5 C5 D5 E5 0 E5 D5 C5 0 A4 0 G4 B4 D5 G5 F5 D5 B4 C5 D5 0 D5 C5 B4 0 G4 0 '
    + 'F4 A4 C5 F5 E5 C5 A4 B4 C5 0 C5 B4 A4 0 E5 0 D5 0 C5 0 B4 0 G#4 0 A4 0 0 0 E4 0 A4 0',
  bass: 'A2 A2 A2 A2 A2 A2 E2 E2 G2 G2 G2 G2 G2 G2 D2 D2 F2 F2 F2 F2 F2 F2 A2 A2 E2 E2 E2 E2 A2 A2 E2 A2',   // one per beat
};
const noteHz = n => {
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  if (!m) return 0;
  const semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (m[3] - 4) * 12;
  return 440 * 2 ** (semi / 12);
};
const tune = { lead: SNEK_TUNE.lead.split(' ').map(noteHz), bass: SNEK_TUNE.bass.split(' ').map(noteHz), i: 0, at: 0, gain: null };
// Called every frame of the fight: schedules the next few notes ahead (so it stops on its own when the game does).
function snekTune() {
  if (!audible()) return;
  const c = audio.ctx, step = 60 / SNEK_TUNE.bpm / 2;
  if (!tune.gain) { tune.gain = c.createGain(); tune.gain.connect(c.destination); }
  tune.gain.gain.value = musicGain('level') * 0.32;
  if (tune.at < c.currentTime) tune.at = c.currentTime + 0.05;
  while (tune.at < c.currentTime + 0.25) {
    const i = tune.i % tune.lead.length, f = tune.lead[i];
    if (f) tuneNote('square', f, tune.at, step * 0.8, 0.5);
    if (i % 2 === 0) { const b = tune.bass[(i / 2) % tune.bass.length]; if (b) tuneNote('triangle', b, tune.at, step * 1.7, 0.9); }
    tune.i++; tune.at += step;
  }
}
function tuneNote(type, f, t, dur, vol) {
  const c = audio.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(tune.gain);
  o.start(t); o.stop(t + dur + 0.02);
}
function snekTuneStop() { tune.i = 0; tune.at = 0; }

/* ---------- drawing (draw.js; it's all black, the phone screen does the rest) ---------- */
// Little bitmaps, 8 × 8 of the screen's pixels: '#' is ink. The head faces right (drawn turned for the other ways).
const SNEK_HEAD = ['........', '.#####..', '.##.###.', '.######.', '.######.', '.######.', '.#####..', '........'];
const SNEK_HEAD_OPEN = ['........', '.#####..', '.##.###.', '.######.', '.####...', '.######.', '.#####..', '........'];
const SNEK_APPLE = ['....#.##', '....##..', '.##.###.', '########', '#####.##', '########', '.######.', '..##.##.'];
const PIXEL_DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
// One of the screen's pixels at (x, y) of a cell whose corner is (ox, oy), for a bitmap turned to face `d`.
let lcdMul = 1;                                               // (× the pixel size: the huge snake's are bigger, drawHugeBody)
function lcdPx(ox, oy, x, y, d, w = 1, h = 1) {
  const P = NOKIA.px * lcdMul;
  let X = x, Y = y;
  if (d && d[0] === -1) X = 7 - x - (w - 1);
  else if (d && d[1] === 1) { X = 7 - y - (h - 1); Y = x; [w, h] = [h, w]; }
  else if (d && d[1] === -1) { X = y; Y = 7 - x - (w - 1); [w, h] = [h, w]; }
  ctx.fillRect(ox + X * P, oy + Y * P, w * P, h * P);
}
function lcdBitmap(ox, oy, rows, d) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '#') lcdPx(ox, oy, x, y, d);
}
function pixelNumber(x, y, n, digits, scale) {
  const P = NOKIA.px * scale, s = String(Math.max(0, Math.floor(n))).padStart(digits, '0').slice(-digits);
  for (let k = 0; k < s.length; k++) {
    const g = PIXEL_DIGITS[+s[k]];
    for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(x + (k * 4 + (i % 3)) * P, y + Math.floor(i / 3) * P, P, P);
  }
}

// The frame round the grid, the way the old phone drew it: a double line, and the score over it (its length) with
// the apples popped on the right.
function drawSnekFrame(s) {
  const P = NOKIA.px, b = s.box;
  ctx.fillStyle = COL.lcdInk;
  for (const o of [2, 4]) {
    ctx.fillRect(b.x - o * P, b.y - o * P, b.w + 2 * o * P, P); ctx.fillRect(b.x - o * P, b.y + b.h + (o - 1) * P, b.w + 2 * o * P, P);
    ctx.fillRect(b.x - o * P, b.y - o * P, P, b.h + 2 * o * P); ctx.fillRect(b.x + b.w + (o - 1) * P, b.y - o * P, P, b.h + 2 * o * P);
  }
  ctx.fillRect(b.x - 4 * P, b.y - 7 * P, b.w + 8 * P, P);   // the line under the score
  // the tracker (user): apples it has eaten, and a meter toward the `huge.at` that make it grow huge (blinking near it)
  const at = SNEK.huge.at, k = Math.min(1, s.eaten / at), mx = b.x - 4 * P + 15 * P, mw = 50 * P;
  pixelNumber(b.x - 4 * P, b.y - 18 * P, s.eaten, 2, 2);
  ctx.fillRect(mx, b.y - 17 * P, mw, P); ctx.fillRect(mx, b.y - 9 * P, mw, P); ctx.fillRect(mx, b.y - 17 * P, P, 9 * P); ctx.fillRect(mx + mw - P, b.y - 17 * P, P, 9 * P);
  if (!(k > 0.8 && Math.floor(performance.now() / 180) % 2)) ctx.fillRect(mx + 2 * P, b.y - 15 * P, Math.round((mw / P - 4) * k) * P, 5 * P);
  for (let q = 10; q < at; q += 10) ctx.clearRect(mx + 2 * P + Math.round((mw / P - 4) * q / at) * P, b.y - 15 * P, P, 5 * P);   // notches every 10
  const n = String(s.popped).length, rx = b.x + b.w + 4 * P - (n * 4 - 1) * 2 * P;
  pixelNumber(rx, b.y - 18 * P, s.popped, n, 2);
  lcdBitmap(rx - 11 * P, b.y - 17 * P, SNEK_APPLE);
}
function drawSnek() {
  const s = game.snek;
  if (!s) return;
  if (s.huge) { if (s.state === 'hugeDead' || s.state === 'feast') drawHugeBody(s, null); return; }   // grown huge: once it moves, drawn as an enemy (drawHuge)
  if (s.lcd) drawSnekFrame(s);
  const C = SNEK.cell, P = NOKIA.px, body = s.body, n = Math.min(s.state === 'intro' ? s.reveal : body.length, body.length);
  if (s.state === 'dead' && s.t < SNEK.death.blink && Math.floor(s.t / 0.14) % 2) return;   // game over: it blinks
  const hollow = s.flash > 0 && Math.floor(s.flash * 20) % 2 === 0;   // hurt (an apple popped) or enraged: it flickers
  // v0.55 (user: smoother): each segment slides from the square it was on to the one it's on, as the next step comes
  // (one step behind where it really is), instead of jumping a whole square at a time
  const f = s.state === 'go' && s.prev ? Math.max(0, Math.min(1, s.tick / (s.st || 1))) : 1;
  const at = i => {
    const b = body[i], a = s.prev?.[i] && f < 1 ? s.prev[i] : b;
    return { x: lcdSnap(s.box.x + (a[0] + (b[0] - a[0]) * f) * C), y: lcdSnap(s.box.y + (a[1] + (b[1] - a[1]) * f) * C) };
  };
  const pos = Array.from({ length: n }, (_, i) => at(i));
  ctx.fillStyle = COL.lcdInk;
  for (let i = 0; i < n - 1; i++) {                           // the bridges: a block between each pair, wherever they are
    const a = pos[i], b = pos[i + 1], mx = lcdSnap((a.x + b.x) / 2) + 3 * P, my = lcdSnap((a.y + b.y) / 2) + 3 * P;
    ctx.fillRect(mx, my, 2 * P, 2 * P);
  }
  for (let i = n - 1; i >= 0; i--) {
    const { x: ox, y: oy } = pos[i];
    if (i === 0) {                                             // the head: an eye, and a mouth that opens every other step
      const d = s.dir;
      lcdBitmap(ox, oy, s.mouth || s.block ? SNEK_HEAD_OPEN : SNEK_HEAD, d);
      if (s.block && Math.floor(s.block.t * 10) % 2) lcdPx(ox, oy, 7, 4, d);   // its tongue flicking: it's coming for you
      continue;
    }
    const tail = i === body.length - 1 && i > 0;
    if (tail) ctx.fillRect(ox + 2 * P, oy + 2 * P, 4 * P, 4 * P);
    else if (hollow) { ctx.fillRect(ox + P, oy + P, 6 * P, P); ctx.fillRect(ox + P, oy + 6 * P, 6 * P, P); ctx.fillRect(ox + P, oy + P, P, 6 * P); ctx.fillRect(ox + 6 * P, oy + P, P, 6 * P); }
    else {                                                     // a bead with a hole in it, like the old game's
      ctx.fillRect(ox + P, oy + P, 6 * P, 6 * P);
      ctx.clearRect(ox + 3 * P, oy + 3 * P, 2 * P, 2 * P);
    }
  }
}
// An apple: blinking in as it appears, hollow for a moment when hit, with its HP over it.
function drawApple(e) {
  const s = game.snek;
  if (!s) return;
  if (e.born < 1 && Math.floor(e.born * 8) % 2) return;
  const C = SNEK.cell, P = NOKIA.px, ox = s.box.x + e.gc * C, oy = s.box.y + e.gr * C;
  ctx.fillStyle = COL.lcdInk;
  if (e.hit > 0) { lcdBitmap(ox, oy, SNEK_APPLE); ctx.clearRect(ox + P, oy + 3 * P, 6 * P, 3 * P); }
  else lcdBitmap(ox, oy, SNEK_APPLE);
  const w = 14, bx = ox + C / 2 - (w / 2) * P, by = oy - 6 * P, k = Math.max(0, e.hp) / e.maxHp;   // its HP: an outlined bar
  ctx.fillRect(bx, by, w * P, P); ctx.fillRect(bx, by + 4 * P, w * P, P); ctx.fillRect(bx, by, P, 5 * P); ctx.fillRect(bx + (w - 1) * P, by, P, 5 * P);
  ctx.fillRect(bx + 2 * P, by + 2 * P, Math.ceil((w - 4) * k) * P, P);
}

/* ---------- grown huge (v0.55, user) ---------- */
// It has eaten SNEK.huge.at apples. It thrashes on the phone screen, the screen switches off, and you're both back in
// the arena; it swells up to its huge size (`feast`), then comes after you. It's an enemy now (`hugeSnek`, its head
// at e.x, e.y; e.parts its whole body, for hits: combat.js hitPoint), with its own bar; it blocks nothing.
function snekFeast(s) {
  game.enemies = game.enemies.filter(e => !e.apple);
  aliveEl.textContent = game.enemies.length;
  game.projectiles = [];
  Object.assign(s, { state: 'feast', t: 0, flash: SNEK.huge.feast.off, block: null });
  game.shake = Math.max(game.shake, 0.5);
  game.hitstop = Math.max(game.hitstop || 0, 0.15);
  SFX.snekEnrage();
  toast(`${SNEK.name} ATE ${s.eaten} APPLES · IT'S TOO BIG!`, 'snek');
}
const hugeEnemy = () => game.enemies.find(e => e.hugeSnek);
const hugeRad = (h, i) => SNEK.huge.px * 8 * 0.46 * h.k;      // (each square's hitbox: its bead, about)
const hugeEase = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
// Off the phone: its body as it lay on the grid, laid out as the huge one's points (`gap` apart along it).
function hugeFromGrid(s) {
  const H = SNEK.huge, pts = s.body.map(([c, r]) => ({ x: snekCellX(s, c), y: snekCellY(s, r) })), seg = [{ ...pts[0] }];
  let i = 0, at = { ...pts[0] }, left = H.gap;
  while (seg.length < H.segs && i < pts.length - 1) {
    const b = pts[i + 1], d = Math.hypot(b.x - at.x, b.y - at.y);
    if (d >= left) { at = { x: at.x + (b.x - at.x) * left / d, y: at.y + (b.y - at.y) * left / d }; seg.push({ ...at }); left = H.gap; }
    else { left -= d; at = { ...b }; i++; }
  }
  while (seg.length < H.segs) seg.push({ ...seg[seg.length - 1] });   // (the rest straightens out as it moves)
  const hp = Math.round(H.hp * bossHpMul());
  s.huge = { seg, a: Math.atan2(s.dir[1], s.dir[0]), n: seg.length, k: NOKIA.px / H.px, k0: NOKIA.px / H.px, t: 0, mode: 'grow', mt: 0, cd: between(H.dash.every), aim: 0, open: 0 };
  s.hp = s.maxHp = hp;
  s.hp = 0;                                                   // (its new bar fills up as it grows; it's only an enemy once it moves: hugeAwake)
}
// Done growing, it starts to move, and only now can it be hurt (v0.55, user): it becomes an enemy, with its new bar
// full. Until then shots can't aim at it or hit it.
function hugeAwake(s) {
  const h = s.huge;
  s.hp = s.maxHp;
  const e = { hugeSnek: true, type: 'snek', shape: 'snek', x: h.seg[0].x, y: h.seg[0].y, r: hugeRad(h, 0), hp: s.maxHp, maxHp: s.maxHp,
    dmg: 0, hit: 0, born: 1, speed: 0, vx: 0, vy: 0, kx: 0, ky: 0, parts: [] };
  game.enemies.push(e);
  aliveEl.textContent = game.enemies.length;
  hugeBody(h, e);
}
function updateHuge(s, dt) {
  const HG = SNEK.huge, F = HG.feast;
  s.t += dt;
  if (s.state === 'hugeDead') { hugeDeathStep(s, dt); return; }
  if (s.state === 'feast') {
    if (!s.huge && s.t >= F.off) {
      lcdPower(s, false);                                     // back in the arena, the both of you
      hugeFromGrid(s);
      game.rings.push({ x: s.huge.seg[0].x, y: s.huge.seg[0].y, r: 10, max: 320, life: 0.8, color: COL.lcd });
      game.shake = Math.max(game.shake, 0.6);
      SFX.roar();
      renderSnekBar();
    }
    if (s.huge) {
      const q = hugeEase((s.t - F.off) / F.grow);
      s.huge.k = s.huge.k0 + (1 - s.huge.k0) * q;
      s.hp = Math.round(s.maxHp * q);
      hugeBody(s.huge, null);
      renderSnekBar();
      if (s.t >= F.off + F.grow) {
        s.state = 'huge'; s.huge.mode = 'slither';
        hugeAwake(s);
        toast(`${SNEK.name} IS HUGE · YOU CAN HURT IT NOW`, 'snek');
        SFX.snekHiss();
        renderSnekBar();
      }
    }
    return;
  }
  const h = s.huge, e = hugeEnemy(), D = HG.dash;
  if (!h || !e) return;
  h.t += dt;
  const hd = h.seg[0], me = nearestBody(hd.x, hd.y) || game.player;
  const to = Math.atan2(me.y - hd.y, me.x - hd.x), dist = Math.hypot(me.x - hd.x, me.y - hd.y);
  const steer = (want, rate) => { const d = Math.atan2(Math.sin(want - h.a), Math.cos(want - h.a)); h.a += Math.max(-rate * dt, Math.min(rate * dt, d)); };
  let speed = HG.speed;
  h.open = Math.max(0, h.open - dt * 3);
  if (h.mode === 'slither') {                                 // after you, weaving from side to side
    steer(to + Math.sin(h.t * HG.wiggle.freq) * HG.wiggle.amp, HG.turn);
    const Sp = HG.spit, spit = h.last === 'spit' ? Math.random() < Sp.repeat : h.last === 'tele' ? Math.random() >= Sp.repeat : Math.random() < 0.5;
    if ((h.cd -= dt) <= 0 && dist < (spit ? Sp.range : D.range)) {
      h.mode = h.last = spit ? 'spitAim' : 'tele'; h.mt = spit ? Sp.tele : D.tele;
      SFX.snekHiss();
      game.floaters.push({ x: hd.x, y: hd.y - hugeRad(h, 0) - 16, text: spit ? 'SPIT!' : 'PLUNGE!', color: COL.lcd, life: 0.8, vy: -30, big: true });
    }
  } else if (h.mode === 'spitAim') {                          // SPIT!: it rears up and aims, mouth opening
    speed = HG.speed * 0.1;
    if (h.mt > HG.spit.tele * 0.3) steer(to, HG.turn * 4);
    h.open = Math.min(1, h.open + dt * 4);
    if ((h.mt -= dt) <= 0) { h.mode = 'spit'; h.shots = HG.spit.volleys; h.mt = 0; }
  } else if (h.mode === 'spit') {                             // … and sprays the cones of apples
    speed = 0; h.open = 1;
    if ((h.mt -= dt) <= 0) {
      hugeSpit(h, HG.spit.volleys - h.shots);
      h.mt = HG.spit.gap;
      if (--h.shots <= 0) { h.mode = 'rest'; h.mt = HG.spit.rest; }
    }
  } else if (h.mode === 'tele') {                             // it rears back, aims, jaws opening (you can see it coming)
    speed = HG.speed * 0.12;
    if (h.mt > D.tele * 0.25) steer(to, HG.turn * 4);          // (the aim locks a moment before it goes)
    h.open = Math.min(1, h.open + dt * 4);
    if ((h.mt -= dt) <= 0) { h.mode = 'dash'; h.mt = D.time; h.hitDash = false; SFX.dash(); game.shake = Math.max(game.shake, 0.2); }
  } else if (h.mode === 'dash') {                             // the lunge: straight on, fast
    speed = D.speed; h.open = 1;
    if ((h.mt -= dt) <= 0) hugeChomp(s, h);
  } else {                                                    // after a chomp: a moment to recover
    speed = HG.speed * 0.4;
    steer(to, HG.turn);
    if ((h.mt -= dt) <= 0) { h.mode = 'slither'; h.cd = between(D.every); }
  }
  const r0 = hugeRad(h, 0), maxY = (playH || H) - r0;
  let nx = hd.x + Math.cos(h.a) * speed * dt, ny = hd.y + Math.sin(h.a) * speed * dt, hitWall = false;
  if (nx < r0 || nx > W - r0) { h.a = Math.PI - h.a; hitWall = true; }
  if (ny < r0 || ny > maxY) { h.a = -h.a; hitWall = true; }
  hd.x = Math.max(r0, Math.min(W - r0, nx)); hd.y = Math.max(r0, Math.min(maxY, ny));
  if (hitWall && h.mode === 'dash') hugeChomp(s, h);
  hugeBody(h, e);
  hugeTouch(s, h);
}
// The rest of it follows the head, each point `gap` behind the one before, and its hitboxes go with it.
function hugeBody(h, e) {
  const g = SNEK.huge.gap;
  for (let i = 1; i < h.seg.length; i++) {
    const a = h.seg[i - 1], b = h.seg[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > g) { b.x = a.x + dx / d * g; b.y = a.y + dy / d * g; }
  }
  if (!e) return;
  const hd = h.seg[0];
  e.x = hd.x; e.y = hd.y; e.r = hugeRad(h, 0);
  e.parts = [];
  for (let i = 0; i < h.seg.length - 1; i += 2) {
    const a = h.seg[i], b = h.seg[Math.min(h.seg.length - 1, i + 2)];
    e.parts.push([a.x - hd.x, a.y - hd.y, b.x - hd.x, b.y - hd.y, hugeRad(h, i + 1)]);
  }
}
// One cone of apples from its mouth, straight at where it's facing (every other one a half-gap over, to fill the holes).
// They're enemy shots (boss.js updateEnemyShots): they hurt you, a shield stops them and DEFLECT sends them back.
function hugeSpit(h, k) {
  const Sp = SNEK.huge.spit, hd = h.seg[0], r0 = hugeRad(h, 0), step = Sp.cone / (Sp.n - 1), odd = k % 2;
  for (let i = 0; i < Sp.n - odd; i++) {                      // (an odd volley: one fewer, in between the last one's)
    const a = h.a - Sp.cone / 2 + (i + odd * 0.5) * step + (Math.random() - 0.5) * 0.05;
    const v = Sp.speed[0] + Math.random() * (Sp.speed[1] - Sp.speed[0]);
    game.eshots.push({ apple: true, x: hd.x + Math.cos(a) * r0, y: hd.y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Sp.r, t: 0, dmg: Sp.dmg, spin: Math.random() * 4 });
  }
  burst(hd.x + Math.cos(h.a) * r0, hd.y + Math.sin(h.a) * r0, COL.bad, 10, 200);
  game.shake = Math.max(game.shake, 0.12);
  SFX.snekEat();
}
// An apple it spat (draw.js, with the shooters' orbs): the phone's apple in red, in big pixels, with a soft glow.
function drawSpitApple(b) {
  const P = SNEK.huge.spit.px, x = Math.round((b.x - 4 * P) / P) * P, y = Math.round((b.y - 4 * P) / P) * P;
  ctx.fillStyle = b.back ? COL.saber : COL.bad;
  ctx.globalAlpha = 0.18; ctx.fillRect(x - P, y - P, 10 * P, 10 * P); ctx.globalAlpha = 1;
  const was = lcdMul; lcdMul = P / NOKIA.px;
  try { lcdBitmap(x, y, SNEK_APPLE); } finally { lcdMul = was; }
  ctx.fillStyle = COL.snek; ctx.fillRect(x + 4 * P, y, P, 2 * P);   // its stalk, in the snake's green
}
// The end of a dash: its jaws snap shut.
function hugeChomp(s, h) {
  const hd = h.seg[0], r0 = hugeRad(h, 0), mx = hd.x + Math.cos(h.a) * r0, my = hd.y + Math.sin(h.a) * r0;
  h.mode = 'rest'; h.mt = SNEK.huge.dash.rest; h.open = 0;
  game.rings.push({ x: mx, y: my, r: 6, max: r0 * 2.6, life: 0.3, color: COL.lcd });
  game.floaters.push({ x: mx, y: my - 20, text: 'CHOMP!', color: COL.lcd, life: 0.9, vy: -36, big: true });
  burst(mx, my, COL.lcd, 14, 220);
  game.shake = Math.max(game.shake, 0.25);
  SFX.snekEat(); SFX.stomp(2);
}
// Touching it: hurt and shoved out (its head hurts more, and most of all mid-dash).
function hugeTouch(s, h) {
  const H = SNEK.huge;
  eachLiving(() => {
    const p = game.player;
    for (let i = 0; i < h.seg.length; i++) {
      const q = h.seg[i], r = hugeRad(h, i), dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 0.01;
      if (d >= r + PLAYER.r) continue;
      p.x = q.x + dx / d * (r + PLAYER.r + 0.5); p.y = q.y + dy / d * (r + PLAYER.r + 0.5);
      p.kx = dx / d * H.bump; p.ky = dy / d * H.bump;
      if (game.shield > 0 || game.dash) game.shieldHit = 0.15;
      else if (!(p.safe > 0)) { p.flash = 0.2; hurtPlayer(i < 2 ? (h.mode === 'dash' ? H.dmg.dash : H.dmg.head) : H.dmg.body); }
      clampTo(p, PLAYER.r);
      break;
    }
  });
}
// A hit on it (combat.js hitEnemy): its bar, and at 0 it's done.
function hugeHit(e) {
  const s = game.snek;
  if (!s) return;
  s.hp = Math.max(0, e.hp);
  if (e.hp <= 0 && s.state === 'huge') hugeDie(s, e);
  renderSnekBar();
}
// Killed: it thrashes, then bursts apart from the tail up, the head last and biggest; then the rewards (snekDown).
function hugeDie(s, e) {
  e.dead = true;
  game.enemies.splice(game.enemies.indexOf(e), 1);
  aliveEl.textContent = game.enemies.length;
  game.projectiles = [];
  game.eshots = game.eshots.filter(b => !b.apple);            // (its apples in the air go too)
  Object.assign(s, { state: 'hugeDead', t: 0, gap: SNEK.death.pop / s.huge.seg.length, popT: 0 });
  s.huge.open = 1;
  game.hitstop = Math.max(game.hitstop || 0, 0.18);
  game.shake = Math.max(game.shake, 0.45);
  SFX.snekDie();
  renderSnekBar();
}
function hugeDeathStep(s, dt) {
  const h = s.huge, D = SNEK.death;
  if (s.t < D.blink * 0.6) return;
  if (h.seg.length) {
    s.popT += dt;
    while (s.popT >= s.gap && h.seg.length) {
      s.popT -= s.gap;
      const i = h.seg.length - 1, q = h.seg.pop();
      if (h.seg.length) { burst(q.x, q.y, COL.lcd, 8, 200); if (i % 3 === 0) SFX.snekBlip(1 - i / 40); continue; }
      burst(q.x, q.y, COL.lcd, 60, 420);
      game.rings.push({ x: q.x, y: q.y, r: 10, max: 260, life: 0.7, color: COL.lcd });
      game.shake = Math.max(game.shake, 0.55);
      SFX.snekPop(true); SFX.boom();
      s.gone = s.t; s.hx = q.x; s.hy = q.y;
    }
    return;
  }
  if (s.t - s.gone >= D.after) snekDown(s);
}

// How it looks (v0.55, user: the Nokia snake, only bigger): the phone's snake in big pixels (`px` world px each, 8
// to a square), in the screen's green on the dark arena: beads with a hole in each, spaced a square apart along its
// body (hugeBeads) and joined by a bridge, the 8×8 pixel head (jaws open as it rears and dashes, its tongue flicking) and the little square tail. A
// red lane of pixel blocks shows where it's about to lunge. While it swells up, its pixels grow from the phone's size.
function drawHuge(e) {
  const s = game.snek;
  if (s?.huge) drawHugeBody(s, e);
}
const hugePx = h => Math.max(NOKIA.px, Math.round(SNEK.huge.px * h.k));
// Its beads: points along its body one square (8 big pixels) apart, head first (v0.55, user: smoother than laying it
// onto a grid). Each is snapped to the big pixels, so it stays crisp but glides.
function hugeBeads(h, C) {
  const pts = h.seg, out = [{ x: pts[0].x, y: pts[0].y }];
  let want = C, run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d > 0 && run + d >= want) { const t = (want - run) / d; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); want += C; }
    run += d;
  }
  return out;
}
function drawHugeBody(s, e) {
  const h = s.huge;
  if (!h.seg.length) return;
  if (s.state === 'hugeDead' && s.t < SNEK.death.blink * 0.6 && Math.floor(s.t / 0.1) % 2) return;   // thrashing: it blinks
  const P = hugePx(h), C = 8 * P, D = SNEK.huge.dash, snap = v => Math.round(v / P) * P;
  const beads = hugeBeads(h, C).map(b => ({ x: snap(b.x - 4 * P), y: snap(b.y - 4 * P) }));   // (each one's corner)
  const ca = Math.cos(h.a), sa = Math.sin(h.a), dir = Math.abs(ca) >= Math.abs(sa) ? [Math.sign(ca) || 1, 0] : [0, Math.sign(sa) || 1];
  if (h.mode === 'spitAim' && s.state === 'huge') {           // where it's about to spit: a cone of red pixel blocks
    const Sp = SNEK.huge.spit, q = 1 - h.mt / Sp.tele, on = Math.floor(performance.now() / 110) % 2;
    ctx.fillStyle = COL.bad;
    for (let d = C; d < 340; d += C * 0.8) for (let k = 0; k < 5; k++) {
      const a = h.a - Sp.cone / 2 + Sp.cone * k / 4, x = h.seg[0].x + Math.cos(a) * d, y = h.seg[0].y + Math.sin(a) * d, b = Math.round(P * (1.5 + 1.5 * q));
      ctx.globalAlpha = (0.25 + 0.45 * q) * (on ? 1 : 0.6) * (1 - d / 400);
      ctx.fillRect(snap(x) - b / 2, snap(y) - b / 2, b, b);
    }
    ctx.globalAlpha = 1;
  }
  if (h.mode === 'tele' && s.state === 'huge') {              // where it's about to lunge: a lane of red pixel blocks
    const len = D.speed * D.time, q = 1 - h.mt / D.tele, on = Math.floor(performance.now() / 110) % 2;
    ctx.fillStyle = COL.bad;
    for (let d = C; d < len; d += C * 0.75) {
      const x = h.seg[0].x + ca * d, y = h.seg[0].y + sa * d, b = Math.round(P * (2 + 2 * q));
      ctx.globalAlpha = (0.35 + 0.5 * q) * (on ? 1 : 0.6);
      ctx.fillRect(snap(x) - b / 2, snap(y) - b / 2, b, b);
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = COL.snek; ctx.globalAlpha = 0.12;           // a soft glow round it, the screen's light
  for (const b of beads) ctx.fillRect(b.x, b.y, C, C);
  ctx.globalAlpha = 1;
  const shapes = (fill, hole) => {
    for (let i = 0; i < beads.length - 1; i++) {              // the bridges: a block between each pair
      const a = beads[i], b = beads[i + 1];
      ctx.fillStyle = fill; ctx.fillRect(snap((a.x + b.x) / 2) + 3 * P, snap((a.y + b.y) / 2) + 3 * P, 2 * P, 2 * P);
    }
    for (let i = beads.length - 1; i >= 0; i--) {
      const { x: ox, y: oy } = beads[i];
      ctx.fillStyle = fill;
      if (i === 0) {
        const open = h.open > 0.3 || (s.state === 'feast' && Math.floor(s.t * 6) % 2);
        lcdBitmap(ox, oy, open ? SNEK_HEAD_OPEN : SNEK_HEAD, dir);
        if (hole && (((h.mode === 'tele' || h.mode === 'spitAim') && Math.floor(h.mt * 12) % 2) || (s.state === 'huge' && h.mode === 'slither' && Math.floor(h.t * 2.5) % 3 === 0))) {
          ctx.fillStyle = COL.bad; lcdPx(ox, oy, 7, 4, dir);  // its tongue
        }
      } else if (i === beads.length - 1) ctx.fillRect(ox + 2 * P, oy + 2 * P, 4 * P, 4 * P);   // the tail
      else {                                                   // a bead with a hole in it
        ctx.fillRect(ox + P, oy + P, 6 * P, 6 * P);
        if (hole) { ctx.fillStyle = COL.floor; ctx.fillRect(ox + 3 * P, oy + 3 * P, 2 * P, 2 * P); }
      }
    }
  };
  const was = lcdMul; lcdMul = P / NOKIA.px;                  // (the phone's bitmaps, at this size)
  try {
    shapes(COL.snek, true);
    if (e && e.hit > 0) { ctx.globalAlpha = 0.35 * Math.min(1, e.hit / 0.1); shapes(COL.player, false); }   // hit: a quick light flash
  } finally { lcdMul = was; ctx.globalAlpha = 1; }
}

/* ---------- VAMPIRIC BALLSACK (user): AWAS's relic ---------- */
// Every kill fills the sack (`kills` of them fill it; hits on a boss count too, every `boss` share of its health as one
// kill). Full: E, or tap its icon, and you drink it back: `heal` of your max health. Then it needs `cd` s before it
// starts filling again. Placeholders apart from the user's 15% and E.
const SACK = { name: 'VAMPIRIC BALLSACK', key: 'E', kills: 25, heal: 0.15, cd: 12, boss: 0.03 };
const SACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
  + `<path d="M9.5 4.5h5M10.5 4.5c0 2-1 2.6-2.4 3.8C5.6 10.4 4 12.8 4 15.6 4 18.6 6.2 20 8.4 20c1.6 0 2.8-.7 3.6-1.8.8 1.1 2 1.8 3.6 1.8 2.2 0 4.4-1.4 4.4-4.4 0-2.8-1.6-5.2-4.1-7.3-1.4-1.2-2.4-1.8-2.4-3.8"/>`
  + `<path d="M12 12.5v5.6"/><path d="M9 11.5l.8 1.6.8-1.6M13.4 11.5l.8 1.6.8-1.6"/></svg>`;
const hasSack = () => game.relics.includes('sack');
const sackReady = () => hasSack() && !(game.sackCd > 0) && (game.sack || 0) >= SACK.kills;
// n kills' worth (combat.js: a kill; a hit on a boss: its share of the bar). It doesn't fill while it cools down.
function sackFeed(n) {
  if (!hasSack() || game.sackCd > 0 || !(n > 0)) return;
  const was = game.sack || 0;
  game.sack = Math.min(SACK.kills, was + n);
  if (was < SACK.kills && game.sack >= SACK.kills) {          // full: the chip lights up, and so do you
    const p = game.player;
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 12, life: 0.3, color: COL.sack });
    renderRelics();
  } else sackChip();
}
// A hit on a boss (or an apple, for AWAS) counts toward it by the share of the boss's bar it took.
function sackHit(e, dealt) {
  if (!hasSack() || !(dealt > 0)) return;
  const max = e.apple ? game.snek?.maxHp : e.boss || e.obi || e.makora || e.hugeSnek ? e.maxHp : 0;
  if (max) sackFeed(dealt / max / SACK.boss);
}
function trySack() {
  if (NET.guest && NET.run) {                                 // the host drinks it for us
    if (NET.me.down || !hasSack()) return;
    NET.sackN = (NET.sackN || 0) + 1;
    return;
  }
  if (!hasSack() || game.inMenu || game.over || (game.paused && !NET.run) || game.choosing || game.intro || game.cine) return;
  if (NET.run && ACTIVE?.down) return;
  const p = game.player;
  if (!sackReady()) {                                         // not yet: say how far along it is
    if (isLocal()) {
      const text = game.sackCd > 0 ? `${Math.ceil(game.sackCd)}s` : `${Math.floor(game.sack || 0)}/${SACK.kills}`;
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text, color: COL.sack, life: 0.6, vy: -30, big: false });
    }
    return;
  }
  const heal = Math.round(maxHp() * SACK.heal), got = Math.min(heal, maxHp() - p.hp);
  p.hp = Math.min(maxHp(), p.hp + heal);
  game.sack = 0; game.sackCd = SACK.cd; game.sackFx = 0.6;
  if (!reducedMotion) for (let k = 0; k < 22; k++) {          // blood drawn in to you from all round
    const a = Math.random() * TAU, d = 50 + Math.random() * 60, v = d / 0.35;
    game.particles.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v, life: 0.35, color: COL.sack });
  }
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r + 40, max: PLAYER.r, life: 0.35, color: COL.sack });
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 30, life: 0.4, color: COL.hp });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: `+${Math.round(got)}`, color: COL.hp, life: 0.9, vy: -40, big: true });
  if (isLocal()) { SFX.sackDrink(); renderHp(false); }
  renderRelics();
}
// Its cooldown, for the active player (combat.js playerStep).
function sackStep(dt) {
  game.sackFx = Math.max(0, (game.sackFx || 0) - dt);
  if (!(game.sackCd > 0)) return;
  game.sackCd = Math.max(0, game.sackCd - dt);
  if (game.sackCd === 0) renderRelics(); else sackChip();
}
// The chip's ring (boss.js renderRelics): the cooldown, in a dark red, then the sack filling up.
const sackK = () => (game.sackCd > 0 ? 1 - game.sackCd / SACK.cd : Math.min(1, (game.sack || 0) / SACK.kills));
function sackChip() {
  const icon = isLocal() && relicsEl.querySelector('#relic-sack');
  if (icon) icon.style.setProperty('--k', sackK());
}
