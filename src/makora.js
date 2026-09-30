/* makora.js — MAKORA, the last level (user): summoned at level 15, it adapts to whatever kills it. */
'use strict';

/* The fight (user):
   - At level 15 (the last level) the screen fades to black and furube.m4a plays: "WITH THIS TREASURE…" (3–4 s),
     "I SUMMON" (5–6 s), then "MAKORA!" as its own music (MAKORA.m4a) comes in. Then it stands in the arena, alone:
     the swarm is gone and no more enemies come.
   - It has 20 HP. When it dies the screen goes black again and its wheel appears and turns, with a heavy wooden
     clunk. Then MAKORA is back with ×3 the HP and ×3 the damage, again and again.
   - Adaptation: the weapon that killed it can't hurt it any more (its hits just say ADAPTED).
   - It walks at you, crouches, dashes in and slices a cone in front of it, with 3 different slices: a wide sweep,
     an overhead cleave (narrow, long) and a cross (two quick diagonal cuts). The cone shows in red just before each
     one lands. Sometimes it goes fast and chains all three, with shorter warnings; that gets likelier each time it
     comes back.
   (The user's context for it is Mahoraga, but the name must be MAKORA.) Numbers are placeholders apart from the
   user's 20 HP, level 15 and ×3. */
const MAKORA = {
  name: 'MAKORA', level: 15, hp: 20, mult: 3, r: 56,   // r: 30, then 38; v0.27 bigger still (user: larger, like MAKORA)
  furube: 'assets/furube.m4a',
  dmg: 12, touch: 8,                                   // a slice / touching it, before the ×3s
  walk: 115, sight: 330, windup: 0.42, dashSpeed: 950, dashTime: 0.26, stopAt: 92,
  cd: [0.5, 1.1], rest: 0.6, knockResist: 0.1,
  fastChance: 0.25, fastPerTurn: 0.12, fastMax: 0.7,   // chance it chains all three slices, faster
  slices: {                                            // arc: the cone's full angle; range: how far it reaches
    sweep: { arc: 2.1, range: 150, tele: 0.34, fast: 0.15, anim: 0.2 },   // ranges grew with it in v0.27
    cleave: { arc: 1.05, range: 195, tele: 0.38, fast: 0.16, anim: 0.18 },
    cross: { arc: 1.6, range: 162, tele: 0.34, fast: 0.15, anim: 0.26 },
  },
  cine: {                                              // seconds into each black-screen scene
    // The summoning plays furube.m4a (user) and follows its clock: "WITH THIS TREASURE…" from 3 to 4 s, "I SUMMON"
    // from 5 to 6 s (user), then MAKORA! as its own music comes in, it appears, done.
    summon: [3.0, 4.0, 5.0, 6.0, 6.3, 7.7, 8.4],
    adapt: [0.55, 1.25, 2.5, 3.1],                     // the wheel shows, it turns, back to the fight, done
  },
};
const SLICE_KINDS = Object.keys(MAKORA.slices);
const cineEl = document.getElementById('cine'), cineLine = document.getElementById('cine-line'), cineWheel = document.getElementById('cine-wheel');

// Level 15 (upgrades.js) sets game.makoraDue; combat.js starts this once the level-up picks are done and the boss is gone.
function startMakora() {
  game.makoraDue = false;
  for (const e of game.enemies) burst(e.x, e.y, enemyCol(e), 6, 140);   // the swarm scatters
  game.enemies = []; game.projectiles = []; game.rocks = []; game.mines = [];
  aliveEl.textContent = 0;
  game.cine = { kind: 'summon', t: 0, step: 0 };
  cineEl.className = 'cine';
  cineLine.textContent = ''; cineLine.className = 'cine-line';
  cineWheel.hidden = true;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');                     // fades to black
  game.cine.audio = playFurube();
}
// The summoning's voice (furube.m4a), on the sound effects' volume. A fresh copy each time, so it always starts at 0:00.
let furubeEl = null;
function playFurube() {
  const a = new Audio(MAKORA.furube);
  a.volume = Math.min(1, sfxGain() * 1.8);
  a.play().catch(() => { /* not allowed yet: the scene still runs on its own clock */ });
  return (furubeEl = a);
}
// sound.js keeps it in step with pausing, the tab hiding and the volume sliders
function syncFurube(hold) {
  const a = furubeEl;
  if (!a || a.ended) return;
  if (!game.cine || game.cine.kind !== 'summon') { a.pause(); furubeEl = null; return; }
  a.volume = Math.min(1, sfxGain() * 1.8);
  if (hold && !a.paused) a.pause();
  else if (!hold && a.paused && a.currentTime > 0) a.play().catch(() => {});
}

// The black-screen scenes. The fight is frozen while one plays (combat.js calls this instead of update).
function updateCine(dt) {
  const c = game.cine, T = MAKORA.cine[c.kind];
  // the summoning keeps time with its voice while that plays, so the words land on it
  const a = c.audio;
  if (a && !a.paused && !a.ended && a.currentTime > 0) c.t = Math.max(c.t, a.currentTime);
  else c.t += dt;
  if (c.step >= T.length || c.t < T[c.step]) return;
  const i = c.step++;
  if (c.kind === 'summon') {
    if (i === 0) line('WITH THIS TREASURE…');
    else if (i === 1 || i === 3) lineOut();
    else if (i === 2) line('I SUMMON');
    else if (i === 4) { line('MAKORA!', 'is-name'); c.music = true; SFX.makoraRoar(); game.shake = Math.max(game.shake, 0.5); }   // its music comes in (sound.js)
    else if (i === 5) { spawnMakora(); cineEl.classList.remove('is-on'); }   // fades back in, MAKORA standing there
    else endCine();
  } else {
    const m = game.makora;
    if (i === 0) { line(''); cineWheel.hidden = false; cineWheel.style.setProperty('--turn', `${(m.turns - 1) * 45}deg`); void cineWheel.offsetWidth; cineWheel.classList.add('is-shown'); }
    else if (i === 1) { cineWheel.style.setProperty('--turn', `${m.turns * 45}deg`); cineWheel.classList.add('is-turning'); SFX.wheelTurn(); }
    else if (i === 2) { makoraReturns(m); cineEl.classList.remove('is-on'); }
    else endCine();
  }
}
function lineOut() { cineLine.classList.remove('is-in'); cineLine.classList.add('is-out'); }
function line(text, cls = '') {
  cineLine.className = `cine-line ${cls}`;
  cineLine.textContent = text;
  void cineLine.offsetWidth;
  cineLine.classList.add('is-in');
}
function endCine() {
  game.cine = null;
  cineEl.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-turning');
  last = performance.now();
}

function spawnMakora() {
  const x = W / 2, y = Math.min(playH || H, H) * 0.32;
  const m = {
    makora: true, type: 'makora', shape: 'makora', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: MAKORA.r,
    hp: MAKORA.hp, maxHp: MAKORA.hp, dmg: MAKORA.touch, hit: 0, born: 0, speed: MAKORA.walk,
    state: 'walk', t: 0, cd: 1, aim: Math.PI / 2, face: 1, step: 0, anim: 0,
    turns: 0, wheelA: 0, queue: [], slice: null, fast: false, down: false,
  };
  game.enemies = [m];
  game.makora = m;
  game.makoraAdapted = new Set();
  renderMakoraBar();
}

// Its HP ran out (combat.js asks before killing it): the weapon that did it is adapted to, and the wheel turns.
function makoraDown(m, card) {
  if (card) game.makoraAdapted.add(card);
  m.down = true; m.adaptedTo = card; m.hp = 0;
  m.turns++;
  game.projectiles = []; game.mines = [];
  game.cine = { kind: 'adapt', t: 0, step: 0 };
  cineEl.className = 'cine';
  line('');
  cineWheel.hidden = true;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');
  SFX.kill(true);
  renderMakoraBar();
}
// … and it comes back, ×3 the HP and ×3 the damage.
function makoraReturns(m) {
  const k = MAKORA.mult ** m.turns;
  Object.assign(m, { down: false, hp: MAKORA.hp * k, maxHp: MAKORA.hp * k, dmg: MAKORA.touch * k, state: 'rest', t: 0.9, queue: [], slice: null, kx: 0, ky: 0, born: 0.3, hit: 0 });
  m.x = W / 2; m.y = Math.min(playH || H, H) * 0.32;
  game.rings.push({ x: m.x, y: m.y, r: m.r, max: m.r * 5, life: 0.6, color: COL.wheel });
  const name = m.adaptedTo ? CARDS[m.adaptedTo].name.toUpperCase() : null;
  if (name) game.floaters.push({ x: m.x, y: m.y - m.r - 40, text: `ADAPTED TO ${name}`, color: COL.wheel, life: 2, vy: -14, big: true });
  // nothing left that can hurt it: say so once
  const ids = new Set(deck ? deck.cards : []);
  if (ids.size && [...ids].every(id => game.makoraAdapted.has(id)) && !game.makoraAll) {
    game.makoraAll = true;
    toast(`${MAKORA.name} HAS ADAPTED TO EVERY WEAPON`, 'enrage');
  }
  renderMakoraBar();
}

const makoraDamage = m => MAKORA.dmg * MAKORA.mult ** m.turns;
const fastChance = m => Math.min(MAKORA.fastMax, MAKORA.fastChance + MAKORA.fastPerTurn * m.turns);

// One frame of MAKORA (combat.js calls this instead of the normal chase).
function moveMakora(m, dt) {
  const p = game.player, dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
  const decay = Math.exp(-6 * dt);
  m.kx *= decay; m.ky *= decay;
  m.t -= dt; m.anim += dt; m.cd -= dt;
  m.wheelA += (m.turns * Math.PI / 4 - m.wheelA) * Math.min(1, dt * 6);   // its own wheel settles on the new turn
  const toward = Math.atan2(dy, dx);
  if (m.state === 'walk') {
    m.aim = toward;
    m.vx = (dx / d) * MAKORA.walk + m.kx; m.vy = (dy / d) * MAKORA.walk + m.ky;
    m.step += dt * 10;
    if (m.cd <= 0 && d < MAKORA.sight) { m.state = 'windup'; m.t = MAKORA.windup; SFX.growl(); }
  } else if (m.state === 'windup') {                         // crouches with the blade drawn back, aiming
    m.aim = toward;
    m.vx = m.kx; m.vy = m.ky;
    if (m.t <= 0) { m.state = 'dash'; m.t = MAKORA.dashTime; m.dashA = toward; SFX.bullDash(); }
  } else if (m.state === 'dash') {                           // shoots in at you …
    m.vx = Math.cos(m.dashA) * MAKORA.dashSpeed; m.vy = Math.sin(m.dashA) * MAKORA.dashSpeed;
    m.step += dt * 30;
    if (!reducedMotion && Math.random() < 0.8) game.particles.push({ x: m.x - Math.cos(m.dashA) * m.r, y: m.y + m.r * 0.9, vx: -m.vx * 0.12, vy: -25 * Math.random(), life: 0.35, color: COL.rock });
    if (m.t <= 0 || d < MAKORA.stopAt) startSlices(m);
  } else if (m.state === 'slice') {                          // … and slices: a warning cone, then the cut
    m.vx = m.kx * 0.3; m.vy = m.ky * 0.3;
    const s = m.slice, S = MAKORA.slices[s.kind];
    s.t += dt;
    if (!s.struck && s.t >= s.tele) { s.struck = true; strike(m, s, S); }
    if (s.struck && s.t >= s.tele + S.anim * (m.fast ? 0.7 : 1)) nextSlice(m);
  } else {                                                   // rest
    m.vx = m.kx * 0.5; m.vy = m.ky * 0.5;
    m.aim = toward;
    if (m.t <= 0) { m.state = 'walk'; m.cd = MAKORA.cd[0] + Math.random() * (MAKORA.cd[1] - MAKORA.cd[0]); }
  }
  m.face = Math.cos(m.aim) < 0 ? -1 : 1;
  m.x += m.vx * dt; m.y += m.vy * dt;
}
function startSlices(m) {
  m.fast = Math.random() < fastChance(m);
  // fast: all three in a row, shuffled; otherwise one of the three
  m.queue = m.fast ? SLICE_KINDS.slice().sort(() => Math.random() - 0.5) : [SLICE_KINDS[Math.floor(Math.random() * SLICE_KINDS.length)]];
  m.state = 'slice';
  nextSlice(m);
}
function nextSlice(m) {
  const kind = m.queue.shift();
  if (!kind) { m.slice = null; m.state = 'rest'; m.t = MAKORA.rest; return; }
  const S = MAKORA.slices[kind], p = game.player;
  m.aim = Math.atan2(p.y - m.y, p.x - m.x);                  // locks on as the warning shows
  m.slice = { kind, t: 0, tele: m.fast ? S.fast : S.tele, struck: false, a: m.aim };
}
// The cut: hurts you if you're inside the cone.
function strike(m, s, S) {
  SFX.slice(s.kind);
  game.shake = Math.max(game.shake, 0.1);
  const p = game.player, dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
  let diff = Math.atan2(dy, dx) - s.a;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const inCone = d <= S.range + PLAYER.r && Math.abs(diff) <= S.arc / 2 + Math.atan2(PLAYER.r, Math.max(d, 1));
  if (!inCone) return;
  if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
  p.flash = 0.25;
  hurtPlayer(makoraDamage(m));
}

// The boss bar: MAKORA, how many times the wheel has turned, and what it has adapted to.
function renderMakoraBar() {
  const m = game.makora;
  if (!m) return;
  bossBar.hidden = false;
  bossBar.classList.remove('is-phase2');
  bossBar.classList.add('is-makora');
  bossFill.style.transform = `scaleX(${Math.max(0, m.hp) / m.maxHp})`;
  bossBar.setAttribute('aria-label', `${MAKORA.name} health`);
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(m.hp)));
  bossBar.setAttribute('aria-valuemax', m.maxHp);
  bossBar.querySelector('.boss-name').textContent = m.turns ? `${MAKORA.name} · WHEEL ×${m.turns}` : MAKORA.name;
  const sub = bossBar.querySelector('.boss-sub');
  const list = [...game.makoraAdapted].map(id => CARDS[id].name.toUpperCase());
  sub.hidden = !list.length;
  sub.textContent = `Adapted to: ${list.join(', ')}`;
}

function resetMakora() {
  game.makora = null; game.makoraDue = false; game.makoraAdapted = new Set(); game.makoraAll = false; game.cine = null;
  cineEl.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-turning');
  bossBar.classList.remove('is-makora');
  bossBar.setAttribute('aria-label', 'SKURTOSAURUS health');
  const sub = bossBar.querySelector('.boss-sub');
  if (sub) sub.hidden = true;
}

/* ---------- drawing (v0.27, user: like the reference image, dynamic, bigger) ----------
   Flat colours with a dark outline round every shape, like the reference's line art.
   A grey, muscular fighter in a wide stance: a dark torn cloth at the waist, black bands on the wrists and ankles,
   a chain mark across the chest, pale feathered wings fanning out from its head, two big horns curling back, a
   long blade on its front arm, and a golden eight-spoked wheel floating above its head that turns each time it
   adapts. Local units: 30 = its radius; it faces +x. */
function drawMakora(m) {
  const k = (m.r * (0.5 + 0.5 * m.born)) / 30, t = m.anim, st = m.state, still = reducedMotion;
  const body = m.hit > 0 ? COL.player : COL.makora, dark = m.hit > 0 ? COL.player : COL.makoraDark;

  // the warning cone, then the slash itself (world space, along its aim)
  if (st === 'slice' && m.slice) {
    const s = m.slice, S = MAKORA.slices[s.kind];
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(s.a);
    if (!s.struck) {
      const q = Math.min(1, s.t / s.tele);
      ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.1 + 0.18 * q;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, S.range, -S.arc / 2, S.arc / 2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5 + 0.4 * q; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, S.range * q, -S.arc / 2, S.arc / 2); ctx.stroke();   // the edge racing out
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-S.arc / 2) * S.range, Math.sin(-S.arc / 2) * S.range);
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(S.arc / 2) * S.range, Math.sin(S.arc / 2) * S.range); ctx.stroke();
    } else {
      const q = Math.min(1, (s.t - s.tele) / S.anim), fade = 1 - q;
      ctx.globalAlpha = fade; ctx.fillStyle = COL.blade;
      if (s.kind === 'sweep') crescent(0, S.range * 0.82, -S.arc / 2, -S.arc / 2 + S.arc * Math.min(1, q * 2.2), 14);
      else if (s.kind === 'cleave') {                          // a long straight chop down the middle
        ctx.fillRect(10, -3, S.range * Math.min(1, q * 3), 6);
        ctx.globalAlpha = fade * 0.35; ctx.fillRect(10, -9, S.range * Math.min(1, q * 3), 18);
      } else {                                                 // cross: two diagonal cuts, one after the other
        const a = S.arc / 2 * 0.8;
        for (const [sgn, q0] of [[1, 0], [-1, 0.35]]) {
          const qq = Math.max(0, Math.min(1, (q - q0) * 2.5));
          if (!qq) continue;
          ctx.save(); ctx.rotate(sgn * a * 0.5);
          ctx.fillRect(18, -2.5, S.range * 0.9 * qq, 5);
          ctx.restore();
        }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  if (st === 'windup') {                                      // the dashed line it'll dash along
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(m.t * 30);
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineCap = 'round';
    const len = MAKORA.dashSpeed * MAKORA.dashTime;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(m.aim) * len, m.y + Math.sin(m.aim) * len); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // pose (user: dynamic): a deep, wide lunge that breathes; the blade arm held high and back, the other fist low
  // `arm`: the upper arm's angle from the shoulder (0 = straight out in front, negative = up); `bend`: how far the
  // forearm (and the blade along it) turns down from there. At rest the arm reaches out with the blade angled down.
  let lean = 0, crouch = 0, arm = -0.35, bend = 1.1, stride = 0, twist = 0;
  const breathe = still ? 0 : Math.sin(t * 2.4) * 0.8;
  if (st === 'walk') { stride = Math.sin(m.step) * 0.5; arm = -0.3 + Math.sin(m.step) * 0.12; lean = 0.06; }
  else if (st === 'windup') { crouch = 5; lean = 0.14; arm = -2.3; bend = 0.45; twist = -0.12; }
  else if (st === 'dash') { crouch = 2; lean = 0.34; arm = -2.0; bend = 0.5; stride = 0.7; }
  else if (st === 'slice' && m.slice) {
    const s = m.slice, S = MAKORA.slices[s.kind], q = s.struck ? Math.min(1, (s.t - s.tele) / S.anim) : 0;
    const swing = { sweep: [-2.2, 0.5], cleave: [-2.8, 0.9], cross: [-2.0, 0.45] }[s.kind];
    const lerp = (a, b, x) => a + (b - a) * x;
    if (!s.struck) { arm = swing[0]; bend = 0.45; crouch = 4; lean = 0.1; twist = -0.1; }
    else if (s.kind === 'cross') { const x = q < 0.5 ? q * 2 : 2 - q * 2; arm = lerp(swing[0], swing[1], x); bend = lerp(0.45, 0.15, x); lean = 0.22; twist = 0.12; }
    else { arm = lerp(swing[0], swing[1], q); bend = lerp(0.45, 0.15, q); lean = 0.26; twist = 0.14 * q; }
  } else { crouch = 2; arm = -0.45; bend = 1.2; lean = -0.02; }

  const OL = m.hit > 0 ? COL.player : COL.makoraLine;       // every shape gets a dark outline, like the reference
  const LW = 1.7;
  const outlined = (fill, path) => { ctx.beginPath(); path(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = LW; ctx.stroke(); };
  // a limb: an outlined thick line through its joints (the outline drawn a little wider underneath)
  const limb = (pts, w, col) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [c, lw] of [[OL, w + LW * 2], [col, w]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  };
  // a black band wrapped round a limb: `a` is the limb's direction there, `w` its width
  const band = (x, y, a, w) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = COL.makoraBand; ctx.strokeStyle = OL; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.roundRect(-2.4, -w / 2, 4.8, w, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-1.6, -w / 2 + 0.8, 3.2, 1);   // a glint
    ctx.restore();
  };
  // a feathered plume: a long tapering feather (smooth edges, the quill down the middle) with a fringe of barbs
  // along its edges, like the reference's feathery wings
  const plume = (x, y, a, len, wid, col) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    outlined(col, () => {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.35, -wid * 1.25, len, -wid * 0.1);
      ctx.lineTo(len + 2.5, 0);
      ctx.quadraticCurveTo(len * 0.35, wid * 0.95, 0, 0);
      ctx.closePath();
    });
    ctx.strokeStyle = OL; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(len * 0.9, -wid * 0.05); ctx.stroke();   // the quill
    ctx.lineWidth = 0.7;                                     // barbs fringing both edges, raking back to the tip
    for (let i = 1; i <= 5; i++) {
      const u = i / 6, x0 = len * u, top = -wid * 1.05 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.75, bot = wid * 0.8 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.75;
      ctx.beginPath(); ctx.moveTo(x0 - 1, top * 0.4); ctx.lineTo(x0 + 3, top - 1.2); ctx.moveTo(x0 - 1, bot * 0.4); ctx.lineTo(x0 + 3, bot + 1); ctx.stroke();
    }
    ctx.restore();
  };

  ctx.save();
  ctx.translate(m.x, m.y); ctx.scale(m.face * k, k);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(0, 37, 34, 7); ctx.globalAlpha = 1;   // shadow

  const hipY = 4 + crouch + breathe * 0.3;
  // legs: a wide, bent-kneed stance, black bands at the ankles, bare feet
  const leg = (sgn, sw, col) => {
    const hx = sgn * 7, kx = sgn * (22 + sw * 6), ky = 18 + crouch * 0.4, ax = sgn * (25 + sw * 10), ay = 32;
    limb([[hx, hipY], [kx, ky], [ax, ay]], 10, col);
    outlined(col, () => { ctx.ellipse(ax + sgn * 4, ay + 2.5, 8, 3.6, 0, 0, TAU); });   // foot
    ctx.strokeStyle = OL; ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ax + sgn * (6 + i * 2), ay + 1); ctx.lineTo(ax + sgn * (7 + i * 2), ay + 4.5); ctx.stroke(); }   // toes
    band(ax - sgn * 0.6, ay - 5, Math.atan2(ay - ky, ax - kx), 13);
    ctx.strokeStyle = OL; ctx.lineWidth = 0.9;               // a knee and calf line
    ctx.beginPath(); ctx.moveTo(kx - sgn * 2, ky + 2); ctx.quadraticCurveTo(kx + sgn * 2, ky + 7, ax - sgn * 1, ay - 9); ctx.stroke();
  };
  leg(-1, -stride, dark);
  leg(1, stride, body);

  ctx.save();                                                // everything above the hips leans and twists
  ctx.translate(0, hipY); ctx.rotate(lean); ctx.scale(1 - Math.abs(twist) * 0.4, 1); ctx.translate(0, -hipY);

  // the back horn: a huge crescent looping up behind the head and the wheel
  outlined(dark, () => { ctx.moveTo(6, -40); ctx.bezierCurveTo(34, -46, 38, -80, 6, -86); ctx.bezierCurveTo(28, -78, 26, -52, 4, -46); ctx.closePath(); });
  // the far plumes, darker
  for (const [a, len, w] of [[-2.05, 36, 6], [-2.4, 32, 5.5], [-2.75, 26, 5]]) plume(-3, -39, a, len, w, COL.makoraDark);

  // the fist arm, low at its side
  limb([[-16, -20], [-24, -8], [-21, 3]], 8, dark);
  outlined(dark, () => { ctx.ellipse(-21, 6, 5, 4.5, 0.3, 0, TAU); });
  band(-22.4, -1.5, Math.atan2(3 - -8, -21 - -24), 11);

  // torso: broad shoulders and chest, narrowing to the waist
  outlined(body, () => {
    ctx.moveTo(-18, -22); ctx.quadraticCurveTo(-8, -30, 0, -29); ctx.quadraticCurveTo(8, -30, 18, -22);
    ctx.quadraticCurveTo(15, -8, 10, 4); ctx.quadraticCurveTo(0, 7, -10, 4); ctx.quadraticCurveTo(-15, -8, -18, -22); ctx.closePath();
  });
  ctx.strokeStyle = OL; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-14, -14); ctx.quadraticCurveTo(-7, -9, -1, -13); ctx.moveTo(1, -13); ctx.quadraticCurveTo(7, -9, 14, -14); ctx.stroke();   // pecs
  for (const y of [-8, -3.5, 1]) {                          // a six-pack
    ctx.beginPath(); ctx.moveTo(-5.5, y); ctx.quadraticCurveTo(-3, y + 1.6, -0.6, y); ctx.moveTo(0.6, y); ctx.quadraticCurveTo(3, y + 1.6, 5.5, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 3); ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-8, -1, -8.5, 3); ctx.moveTo(9, -6); ctx.quadraticCurveTo(8, -1, 8.5, 3); ctx.stroke();   // centre line, obliques
  ctx.strokeStyle = COL.makoraBand; ctx.lineWidth = 1.6;    // the chain mark across the chest, with its hanging rings
  ctx.beginPath(); ctx.moveTo(-11, -20); ctx.quadraticCurveTo(0, -15, 11, -20); ctx.stroke();
  ctx.lineWidth = 1.1;
  for (const x of [-7, -2.3, 2.3, 7]) { const y = -17.6 + Math.abs(x) * -0.12; ctx.beginPath(); ctx.ellipse(x, y + 1.8, 1.3, 1.7, 0, 0, TAU); ctx.stroke(); }

  // the torn cloth: a dark wrap at the waist, flaring out to a ragged hem, with its knot
  outlined(COL.makoraCloth, () => {
    ctx.moveTo(-12, 1); ctx.quadraticCurveTo(0, 4, 12, 1);
    ctx.lineTo(24, 14);
    const hem = [[19, 20], [15, 17], [12, 24], [7, 19], [3, 26], [-2, 20], [-6, 25], [-10, 18], [-14, 23], [-18, 16], [-24, 19]];
    for (const [x, y] of hem) ctx.lineTo(x, y + (still ? 0 : Math.sin(t * 5 + x) * 0.6));
    ctx.closePath();
  });
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(-11, 18); ctx.moveTo(8, 5); ctx.lineTo(14, 16); ctx.stroke();   // folds
  outlined(COL.makoraBand, () => { ctx.ellipse(1, 4, 4.5, 3, 0, 0, TAU); });                                   // the knot …
  outlined(COL.makoraCloth, () => { ctx.moveTo(-1, 6); ctx.lineTo(4, 6); ctx.lineTo(5, 20); ctx.lineTo(1, 22); ctx.lineTo(-2, 19); ctx.closePath(); });   // … and its hanging end

  // head: small and narrow, its eyes hidden under the plumes, mouth open
  outlined(body, () => { ctx.ellipse(0, -35, 5.5, 7.5, 0, 0, TAU); });
  outlined(COL.makoraBand, () => { ctx.ellipse(0.5, -31.5, 2.6, 2.2, 0, 0, TAU); });
  ctx.fillStyle = COL.makoraMouth; ellipse(0.5, -30.8, 1.5, 1);
  // the front plumes: long feathered wings fanning up and out from the sides of the head
  // (fanned upward like wings: none of them lies flat)
  for (const [a, len, w] of [[-1.25, 38, 6.5], [-0.9, 34, 6], [-0.55, 28, 5.5]]) plume(3, -39, a, len, w, COL.makoraFeather);
  for (const [a, len, w] of [[-1.9, 38, 6.5], [-2.25, 34, 6], [-2.6, 28, 5.5]]) plume(-3, -39, a, len, w, COL.makoraFeather);
  // the front horn: a great curved blade of horn sweeping out to the side and up to a point
  outlined(body, () => { ctx.moveTo(-3, -42); ctx.bezierCurveTo(-26, -40, -42, -52, -38, -78); ctx.bezierCurveTo(-34, -58, -20, -48, -2, -47); ctx.closePath(); });
  ctx.strokeStyle = OL; ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-8 - i * 7, -44 - i * 1.5); ctx.lineTo(-9 - i * 7, -48 - i * 2.5); ctx.stroke(); }   // ridges

  // the wheel: gold, eight spokes with knobbed ends, turned a notch per adaptation
  ctx.save(); ctx.translate(0, -76 + (still ? 0 : Math.sin(t * 2) * 1.5)); ctx.rotate(m.wheelA);
  ctx.lineCap = 'round';
  for (const [c, lw] of [[COL.wheelDark, 4.4], [COL.wheel, 2.6]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke(); }
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.fillStyle = COL.wheel; ctx.strokeStyle = COL.wheelDark; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 15, Math.sin(a) * 15, 3.1, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = COL.wheel; ctx.strokeStyle = COL.wheelDark; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();

  // the blade arm, in front: raised from the shoulder, a black band at the wrist, the long blade gripped in its fist
  const sx = 16, sy = -21, fa = arm + bend;
  const ex = sx + Math.cos(arm) * 13, ey = sy + Math.sin(arm) * 13, hx = ex + Math.cos(fa) * 12, hy = ey + Math.sin(fa) * 12;
  limb([[sx, sy], [ex, ey], [hx, hy]], 9, body);
  const ba = Math.atan2(hy - ey, hx - ex);
  band(ex + Math.cos(ba) * 7, ey + Math.sin(ba) * 7, ba, 12);
  const bl = 38, bc = Math.cos(ba), bs = Math.sin(ba);
  outlined(COL.blade, () => {                               // the blade, from the fist along the forearm
    ctx.moveTo(hx - bs * 3, hy + bc * 3); ctx.lineTo(hx + bc * bl, hy + bs * bl); ctx.lineTo(hx + bs * 3, hy - bc * 3); ctx.closePath();
  });
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(hx + bc * 4, hy + bs * 4); ctx.lineTo(hx + bc * (bl - 6), hy + bs * (bl - 6)); ctx.stroke();   // its edge catching the light
  outlined(body, () => { ctx.arc(hx, hy, 4.8, 0, TAU); });  // the fist

  ctx.restore();
  ctx.restore();
}

// A curved blade trail: an arc band from angle a0 to a1 at radius r, `w` thick, tapering at both ends.
function crescent(cx, r, a0, a1, w) {
  if (a1 <= a0) return;
  ctx.beginPath();
  ctx.arc(cx, 0, r + w / 2, a0, a1);
  ctx.arc(cx, 0, r - w / 2, a1, a0, true);
  ctx.closePath(); ctx.fill();
}
