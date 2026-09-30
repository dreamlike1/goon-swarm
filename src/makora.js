/* makora.js — MAKORA, the last level (user): summoned at level 15, it adapts to whatever kills it. */
'use strict';

/* The fight (user):
   - At level 15 (the last level) the screen fades to black and furube.m4a plays: "WITH THIS TREASURE…" (3–4 s),
     "I SUMMON" (4.6–6 s, on the voice), then "MAKORA!" as its own music (MAKORA.m4a) comes in. Then it stands in the arena, alone:
     the swarm is gone and no more enemies come.
   - It has 150 HP and walks slowly at first (v0.37, user: tanky, slow). When it dies the screen goes black again and
     its wheel appears and turns one notch with a heavy wooden clunk. Then MAKORA is back with ×2 the HP and ×2 the
     damage (v0.37; it was ×3), again and again. It also gets faster every time (v0.38, user): it walks faster, and
     every warning, cooldown and rest gets shorter (`quick`).
   - Adaptation: the weapon that killed it can't hurt it any more (its hits just say ADAPTED). And if you dash a lot
     with BULL, it learns that too: from its next return it dashes at you as well (v0.37, user).
   - Three attacks (v0.38, user), each with a red warning first:
     - the punch: it draws its fist back while a cone fills in front of it, then punches and a shockwave rolls out
       across the cone. The wave travels, so you're hit when its front reaches you;
     - the slice: 1 or 3 cuts of its blade, at random (3 in a row come faster). 3 kinds: a wide sweep, an overhead
       cleave (narrow, long) and a cross (two quick diagonal cuts);
     - the kick, from further away: it stamps, a HUGE rock bursts up out of the ground in front of it, and it kicks
       the rock at you down the lane it shows. The rock can be shot: it has its own HP (every weapon works on it,
       adapted or not), and when it breaks it explodes, hurting MAKORA if it's close. If it reaches you, it hurts.
     Once it has learnt to dash, it crouches, dashes in from further away and slices as it arrives.
   (The user's context for it is Mahoraga, but the name must be MAKORA.) Numbers are placeholders apart from the
   user's 150 HP, level 15 and ×2. */
const MAKORA = {
  name: 'MAKORA', level: 15, hp: 150, mult: 2, r: 56,  // hp 20 and ×3 until v0.37 (user: 150, ×2)
  furube: 'assets/furube.m4a',
  dmg: 12, touch: 8,                                   // a slice / touching it, before the ×2s
  walk: 62, walkPerTurn: 0.2,                          // slow at first (v0.37, user), faster each return
  quick: 0.88, quickMin: 0.55,                         // warnings, cooldowns and rests ×0.88 per wheel turn, down to ×0.55
  attackAt: 150, punchAt: 230,                         // slices or the punch this close; only the punch out to punchAt
  punch: { tele: 0.62, arc: 1.25, range: 250, wave: 640, width: 26, dmg: 14, knock: 460, recover: 0.4 },   // a cone-shaped shockwave rolling out at `wave` px/s
  three: 0.5,                                          // the chance a slice is 3 cuts in a row (user: 1 or 3, at random)
  // From the 2nd wheel turn (v0.39, user): far away it kicks rocks in a row, up close it makes huge slashes to dodge
  rage: { at: 2, rocks: 3, next: 0.55, greatAt: 210, great: 0.6 },   // `next`: each follow-up kick's warning, × the first's;
                                                       // `great`: the chance a close attack is the huge slash
  kick: {                                              // the rock: kicked from `at` px ahead of it
    tele: 0.95, stomp: 0.22, lock: 0.8, cd: [3.2, 5], min: 230, max: 620, at: 84,   // stomp at 22% of the warning; the aim locks at 80%
    r: 46, hp: 45, hpPerTurn: 20, speed: 430, speedPerTurn: 0.12, dmg: 18, knock: 520,
    blast: 130, blastDmg: 0.12, recover: 0.5,          // its explosion: radius, and the share of MAKORA's max HP it takes
  },
  // the dash, once it has learnt it: after you've dashed `learn` times (v0.37, user)
  learn: 3, sight: 480, dashMin: 210, dashCd: [2.2, 3.6], windup: 0.42, dashSpeed: 950, dashTime: 0.26, stopAt: 92,
  cd: [0.7, 1.4], rest: 0.6, knockResist: 0.1,
  slices: {                                            // arc: the cone's full angle; range: how far it reaches
    sweep: { arc: 2.1, range: 150, tele: 0.34, fast: 0.2, anim: 0.2 },   // fast: the warning in a run of 3
    cleave: { arc: 1.05, range: 195, tele: 0.38, fast: 0.22, anim: 0.18 },
    cross: { arc: 1.6, range: 162, tele: 0.34, fast: 0.2, anim: 0.26 },
    // the huge slash (from the 2nd turn, not in the normal mix): nearly a half circle, twice the reach, a long
    // warning so you can get out of it (or dash through it), and 1.6× a slice's damage
    great: { arc: 2.9, range: 310, tele: 0.8, fast: 0.8, anim: 0.3, dmg: 1.6 },
  },
  cine: {                                              // seconds into each black-screen scene
    // The summoning plays furube.m4a (user) and follows its clock: "WITH THIS TREASURE…" from 3 to 4 s, "I SUMMON"
    // from 4.6 to 6 s, then MAKORA! as its own music comes in, it appears, done. In the file the voice says "with this
    // treasure" at 3.0–3.7 s and "I summon" at 4.7–5.4 s (v0.29, user: "I SUMMON" was late; it was at 5 s).
    summon: [3.0, 4.0, 4.6, 6.0, 6.3, 7.7, 8.4],
    adapt: [0.55, 1.1, 2.6, 3.2],                      // the wheel shows, it turns one notch (WHEEL.spin), back to the fight, done
  },
};
const SLICE_KINDS = ['sweep', 'cleave', 'cross'];         // the normal mix (not `great`)
const cineEl = document.getElementById('cine'), cineLine = document.getElementById('cine-line'), cineWheel = document.getElementById('cine-wheel');
const cineSkip = document.getElementById('cine-skip');

// The wheel scene: MAKORA's wheel, big on the black screen, turning one notch. Flat gold (v0.36): a rim, eight spokes
// with round knobs, a hub, a darker gold offset under each part for depth and a pale glint on top. Redrawn at every
// angle on its own small canvas, which the page blows up with hard edges (v0.37: a little pixelation, user).
const WHEEL = { size: 146, spins: 0, spin: 1.0 };   // canvas px: small, blown up to 440 for a little pixelation (v0.37,
// user); the turn: `spins` full turns and on one notch, over `spin` s
cineWheel.width = cineWheel.height = WHEEL.size;
const wheelCtx = cineWheel.getContext('2d');
function drawWheel(angle, flash = 0) {
  const c = wheelCtx, n = WHEEL.size, u = n / 100;         // drawn in a 100-unit box
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
  c.setTransform(u, 0, 0, u, n / 2, n / 2);
  c.lineCap = 'round';
  const part = (col, dx, dy) => {
    c.save(); c.translate(dx, dy); c.rotate(angle);
    c.strokeStyle = col; c.fillStyle = col;
    c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.stroke();           // the rim
    c.lineWidth = 3.4;
    for (let i = 0; i < 8; i++) {                                                   // spokes, reaching past the rim
      const a = i / 8 * TAU;
      c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 39, Math.sin(a) * 39); c.stroke();
      c.beginPath(); c.arc(Math.cos(a) * 42, Math.sin(a) * 42, 6.5, 0, TAU); c.fill();   // … each ending in a knob
    }
    c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill();                                // the hub
    c.restore();
  };
  part(COL.wheelDark, 1.4, 2);                              // depth: the same wheel in dark gold, a little below
  part(COL.wheel, 0, 0);
  c.save(); c.rotate(angle); c.fillStyle = COL.wheelHi;     // glints on the knobs and hub
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.arc(Math.cos(a) * 42 - 2, Math.sin(a) * 42 - 2, 2.2, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(-2.4, -2.4, 2.6, 0, TAU); c.fill();
  c.restore();
  if (flash > 0) { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = flash; c.fillStyle = '#fff6d8'; c.fillRect(-50, -50, 100, 100); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
}
// The nudge: slow to get going (it's heavy), then it swings a little past the notch and settles back into it.
function wheelEase(k) {
  const x = k ** 1.7, s = 1.6;
  return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
}
// One frame of the spin: draws it, ticks as each spoke passes, and clunks, flashes and shakes as it lands.
function spinMakoraWheel(c, m) {
  const k = Math.min(1, (c.t - MAKORA.cine.adapt[1]) / WHEEL.spin), e = wheelEase(k), notch = Math.PI / 4;
  let a = (m.turns - 1) * notch + (WHEEL.spins * Math.PI * 2 + notch) * e;
  if (c.landed) { const u = c.t - c.landed; a += notch * 0.14 * Math.sin(u * 30) * Math.exp(-u * 8); }   // the catch
  const spoke = Math.floor(a / notch + 0.5);
  if (c.spoke != null && spoke !== c.spoke && !c.landed) SFX.makoraTick(Math.min(1, (1 - k) * 1.6));
  c.spoke = spoke;
  if (!c.landed && e >= 1) {
    c.landed = c.t;
    SFX.wheelLand();
    cineWheel.classList.remove('is-clunk'); void cineWheel.offsetWidth; cineWheel.classList.add('is-clunk');
  }
  drawWheel(a, c.landed ? Math.max(0, 0.7 - (c.t - c.landed) * 3) : 0);
}

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
  cineSkip.hidden = false;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');                     // fades to black
  game.cine.audio = playFurube();
}
// Skip (user): the Skip button, Space or Enter. The voice stops, its music comes in and MAKORA is standing there as
// the screen fades back in, the same as the end of the summoning.
function skipIntro(fromNet = false) {
  const c = game.cine, T = MAKORA.cine.summon;
  if (!c || c.kind !== 'summon' || c.step > 5) return;
  if (NET.guest && NET.run && !fromNet) { toHost({ t: 'skip' }); return; }   // co-op: the host skips it for everyone
  if (NET.host && NET.run) coopEvent({ e: 'skip' });
  if (furubeEl) { furubeEl.pause(); furubeEl = null; }
  c.audio = null; c.music = true;
  cineSkip.hidden = true;
  lineOut();
  c.step = 5; c.t = T[5];                            // straight on to "it appears"
  SFX.click();
}
cineSkip.addEventListener('click', e => { skipIntro(); e.currentTarget.blur(); });   // (a click event is never `fromNet`)
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
  if (c.kind === 'adapt' && c.step >= 2) spinMakoraWheel(c, game.makora);   // every frame of the spin (v0.33: was only on step frames)
  if (c.step >= T.length || c.t < T[c.step]) return;
  const i = c.step++;
  if (c.kind === 'summon') {
    if (i === 0) line('WITH THIS TREASURE…');
    else if (i === 1 || i === 3) lineOut();
    else if (i === 2) line('I SUMMON');
    else if (i === 4) { line('MAKORA!', 'is-name'); c.music = true; SFX.makoraRoar(); game.shake = Math.max(game.shake, 0.5); }   // its music comes in (sound.js)
    else if (i === 5) { if (!NET.guest) spawnMakora(); cineEl.classList.remove('is-on'); cineSkip.hidden = true; }   // fades back in, MAKORA standing there
    else endCine();
  } else {
    const m = game.makora;
    if (i === 0) { line(''); drawWheel((m.turns - 1) * Math.PI / 4); cineWheel.hidden = false; void cineWheel.offsetWidth; cineWheel.classList.add('is-shown'); }
    else if (i === 1) { SFX.wheelSpin(); spinMakoraWheel(c, m); }   // the shove; it spins from here (above)
    else if (i === 2) { if (!NET.guest) makoraReturns(m); cineEl.classList.remove('is-on'); }
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
  game.cine = null; game.cineHold = false;
  cineEl.hidden = true;
  cineSkip.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-clunk');
  last = performance.now();
}

function spawnMakora() {
  const x = W / 2, y = Math.min(playH || H, H) * 0.32;
  const m = {
    makora: true, type: 'makora', shape: 'makora', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: MAKORA.r,
    hp: Math.round(MAKORA.hp * coopBossHp()), maxHp: Math.round(MAKORA.hp * coopBossHp()), dmg: MAKORA.touch,   // co-op: tougher
    hit: 0, born: 0, speed: MAKORA.walk,
    state: 'walk', t: 0, cd: 1, aim: Math.PI / 2, face: 1, step: 0, anim: 0,
    turns: 0, wheelA: 0, queue: [], slice: null, punch: null, kick: null, fast: false, down: false,
    kickCd: 2.5,
    canDash: false, dashCd: 0, dashesSeen: 0,          // it learns to dash from watching you (makoraReturns)
  };
  game.enemies = [m];
  game.makora = m;
  game.makoraAdapted = new Set();
  renderMakoraBar();
}

// Its HP ran out (combat.js asks before killing it): the weapon that did it is adapted to, and the wheel turns.
// (`card` is null when its own rock's explosion finished it: then it adapts to nothing.)
function makoraDown(m, card) {
  if (card) game.makoraAdapted.add(card);
  m.down = true; m.adaptedTo = card; m.hp = 0;
  m.turns++;
  game.projectiles = []; game.mines = [];
  clearKickRocks();
  showAdaptScene(m);
  renderMakoraBar();
}
// The black screen for the wheel (a co-op guest plays just this; the host runs the fight side).
function showAdaptScene(m) {
  game.cine = { kind: 'adapt', t: 0, step: 0 };
  cineEl.className = 'cine';
  line('');
  cineWheel.hidden = true;
  cineEl.hidden = false;
  void cineEl.offsetWidth;
  cineEl.classList.add('is-on');
  SFX.kill(true);
}
// … and it comes back, ×2 the HP and ×2 the damage, and faster.
function makoraReturns(m) {
  const k = MAKORA.mult ** m.turns;
  const hp = Math.round(MAKORA.hp * k * coopBossHp());
  Object.assign(m, { down: false, hp, maxHp: hp, dmg: MAKORA.touch * k, state: 'rest', t: 0.9, queue: [], slice: null, punch: null, kick: null, kickCd: 2, kx: 0, ky: 0, born: 0.3, hit: 0 });
  m.x = W / 2; m.y = Math.min(playH || H, H) * 0.32;
  game.rings.push({ x: m.x, y: m.y, r: m.r, max: m.r * 5, life: 0.6, color: COL.wheel });
  const name = m.adaptedTo ? CARDS[m.adaptedTo].name.toUpperCase() : null;
  if (name) game.floaters.push({ x: m.x, y: m.y - m.r - 40, text: `ADAPTED TO ${name}`, color: COL.wheel, life: 2, vy: -14, big: true });
  game.floaters.push({ x: m.x, y: m.y - m.r - 14, text: 'FASTER · STRONGER', color: COL.bad, life: 1.8, vy: -14, big: false });
  bonusGold('MAKORA', GOLD_BONUS.makora);                    // +15 gold every time it goes down (user, v0.43), shown as it comes back
  if (!m.canDash && m.dashesSeen >= MAKORA.learn) {     // you dashed a lot: now it dashes too
    m.canDash = true; m.dashCd = 1.5;
    game.floaters.push({ x: m.x, y: m.y - m.r - 66, text: 'IT LEARNT YOUR DASH', color: COL.relic, life: 2.2, vy: -12, big: true });
  }
  // nothing left that can hurt it: say so once
  const ids = new Set(deck ? deck.cards : []);
  if (ids.size && [...ids].every(id => game.makoraAdapted.has(id)) && !game.makoraAll) {
    game.makoraAll = true;
    toast(`${MAKORA.name} HAS ADAPTED TO EVERY WEAPON`, 'enrage');
  }
  renderMakoraBar();
}

const makoraDamage = m => MAKORA.dmg * MAKORA.mult ** m.turns;
const quick = m => Math.max(MAKORA.quickMin, MAKORA.quick ** m.turns);   // < 1: every timing, shorter each return
const between = ([a, b]) => a + Math.random() * (b - a);

// One frame of MAKORA (combat.js calls this instead of the normal chase).
function moveMakora(m, dt) {
  const p = game.player, dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
  const decay = Math.exp(-6 * dt);
  m.kx *= decay; m.ky *= decay;
  m.t -= dt; m.anim += dt; m.cd -= dt; m.dashCd -= dt; m.kickCd -= dt;
  m.wheelA += (m.turns * Math.PI / 4 - m.wheelA) * Math.min(1, dt * 6);   // its own wheel settles on the new turn
  const toward = Math.atan2(dy, dx), speed = MAKORA.walk * (1 + MAKORA.walkPerTurn * m.turns);
  if (m.state === 'walk') {                                  // a slow, heavy walk at you
    m.aim = toward;
    m.vx = (dx / d) * speed + m.kx; m.vy = (dy / d) * speed + m.ky;
    m.step += dt * 6 * (speed / MAKORA.walk);
    if (m.canDash && m.dashCd <= 0 && d > MAKORA.dashMin && d < MAKORA.sight) { m.state = 'windup'; m.t = MAKORA.windup * quick(m); SFX.growl(); }
    else if (m.cd <= 0) {
      // up close, a slice or the punch; a little further, the punch (its wave reaches further); further still, the rock
      const rage = m.turns >= MAKORA.rage.at;
      if (rage && d < MAKORA.rage.greatAt && Math.random() < MAKORA.rage.great) startGreat(m);
      else if (d < MAKORA.attackAt) { if (Math.random() < 0.55) startSlices(m); else startPunch(m); }
      else if (d < MAKORA.punchAt) startPunch(m);
      else if (m.kickCd <= 0 && d > MAKORA.kick.min && d < MAKORA.kick.max) startKick(m);
    }
  } else if (m.state === 'windup') {                         // crouches with the blade drawn back, aiming
    m.aim = toward;
    m.vx = m.kx; m.vy = m.ky;
    if (m.t <= 0) { m.state = 'dash'; m.t = MAKORA.dashTime; m.dashA = toward; SFX.bullDash(); }
  } else if (m.state === 'dash') {                           // shoots in at you …
    m.vx = Math.cos(m.dashA) * MAKORA.dashSpeed; m.vy = Math.sin(m.dashA) * MAKORA.dashSpeed;
    m.step += dt * 30;
    if (!reducedMotion && Math.random() < 0.8) game.particles.push({ x: m.x - Math.cos(m.dashA) * m.r, y: m.y + m.r * 0.9, vx: -m.vx * 0.12, vy: -25 * Math.random(), life: 0.35, color: COL.rock });
    if (m.t <= 0 || d < MAKORA.stopAt) { m.dashCd = between(MAKORA.dashCd) * quick(m); startSlices(m); }
  } else if (m.state === 'slice') {                          // … and slices: a warning cone, then the cut
    m.vx = m.kx * 0.3; m.vy = m.ky * 0.3;
    const s = m.slice, S = MAKORA.slices[s.kind];
    s.t += dt;
    if (!s.struck && s.t >= s.tele) { s.struck = true; strike(m, s, S); }
    if (s.struck && s.t >= s.tele + S.anim * (m.fast ? 0.7 : 1)) nextSlice(m);
  } else if (m.state === 'punch') {                          // the punch: the cone fills, then the fist and its rolling wave
    m.vx = m.kx * 0.3; m.vy = m.ky * 0.3;
    const u = m.punch, P = MAKORA.punch;
    u.t += dt;
    if (!u.struck && u.t >= u.tele) { u.struck = true; punchHit(m, u); }
    if (u.struck) {
      const was = u.wave;
      u.wave = Math.min(P.range, u.wave + P.wave * dt);
      waveHits(m, u, was);
      if (u.wave >= P.range && u.t >= u.tele + P.range / P.wave + P.recover * quick(m)) { m.punch = null; toRest(m); }
    }
  } else if (m.state === 'kick') {                           // the kick: stamp, the rock comes up, then it's kicked
    m.vx = m.kx * 0.3; m.vy = m.ky * 0.3;
    const K = m.kick, S = MAKORA.kick;
    K.t += dt;
    if (!K.locked) {                                         // it follows you with its aim until just before the kick
      K.a = toward;
      K.x = m.x + Math.cos(K.a) * S.at; K.y = m.y + Math.sin(K.a) * S.at + 16;
      if (K.t >= K.tele * S.lock) K.locked = true;
    }
    m.aim = K.a;
    if (!K.stomped && K.t >= K.tele * S.stomp) { K.stomped = true; kickStomp(m, K); }
    if (!K.kicked && K.t >= K.tele) { K.kicked = true; kickRock(m, K); }
    if (K.kicked && K.left > 0 && K.t >= K.tele + 0.12) startKick(m, K.left - 1);   // from the 2nd turn: the next rock, right away
    else if (K.kicked && K.t >= K.tele + S.recover * quick(m)) { m.kick = null; m.kickCd = between(S.cd) * quick(m); toRest(m); }
  } else {                                                   // rest
    m.vx = m.kx * 0.5; m.vy = m.ky * 0.5;
    m.aim = toward;
    if (m.t <= 0) { m.state = 'walk'; m.cd = between(MAKORA.cd) * quick(m); }
  }
  m.face = Math.cos(m.aim) < 0 ? -1 : 1;
  m.x += m.vx * dt; m.y += m.vy * dt;
}
function toRest(m) { m.state = 'rest'; m.t = MAKORA.rest * quick(m); }

// The punch (v0.38, user: a cone-wave shockwave): it aims, a cone fills in front of it, then the fist lands and a
// wave rolls out across the cone. It locks on as it starts.
function startPunch(m) {
  const p = game.player;
  m.aim = Math.atan2(p.y - m.y, p.x - m.x);
  m.punch = { t: 0, tele: MAKORA.punch.tele * quick(m), struck: false, a: m.aim, wave: m.r * 0.5, hit: false };
  m.state = 'punch';
  SFX.growl();
}
function punchHit(m, u) {
  SFX.punch();
  game.shake = Math.max(game.shake, 0.3);
  const fx = m.x + Math.cos(u.a) * m.r * 0.6, fy = m.y + Math.sin(u.a) * m.r * 0.6;
  game.rings.push({ x: fx, y: fy, r: 6, max: 50, life: 0.25, color: COL.makora });
  burst(fx, fy, COL.rock, 14, 260);
}
// The wave's front moved from `was` to u.wave this frame: you're hit if it passed you inside the cone.
function waveHits(m, u, was) {
  const P = MAKORA.punch, p = game.player;
  if (!reducedMotion && Math.random() < 0.9) {                // dust thrown up along the front
    const a = u.a + (Math.random() - 0.5) * P.arc;
    game.particles.push({ x: m.x + Math.cos(a) * u.wave, y: m.y + Math.sin(a) * u.wave, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, life: 0.3, color: COL.rock });
  }
  eachLiving(() => waveHitOne(m, u, was));                  // co-op: it can catch everyone
}
function waveHitOne(m, u, was) {
  const P = MAKORA.punch, p = game.player, who = ownerId();
  u.hitIds = u.hitIds || [];
  if (u.hitIds.includes(who)) return;
  const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
  let diff = Math.atan2(dy, dx) - u.a;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) > P.arc / 2 + Math.atan2(PLAYER.r, Math.max(d, 1))) return;
  if (d + PLAYER.r < was - P.width || d - PLAYER.r > u.wave + P.width / 2) return;
  u.hitIds.push(who);
  if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
  p.flash = 0.25;
  const a = Math.atan2(dy, dx);                              // the wave throws you back
  p.kx = (p.kx || 0) + Math.cos(a) * P.knock; p.ky = (p.ky || 0) + Math.sin(a) * P.knock;
  game.shake = Math.max(game.shake, 0.25);
  hurtPlayer(P.dmg * MAKORA.mult ** m.turns);
}

// The slices (v0.38, user: 1 or 3, at random). A run of 3 is all three kinds, shuffled, with shorter warnings.
function startSlices(m) {
  m.fast = Math.random() < MAKORA.three;
  m.queue = m.fast ? SLICE_KINDS.slice().sort(() => Math.random() - 0.5) : [SLICE_KINDS[Math.floor(Math.random() * SLICE_KINDS.length)]];
  m.state = 'slice';
  nextSlice(m);
}
// The huge slash (from the 2nd turn): one enormous cut with a long warning.
function startGreat(m) {
  m.fast = false; m.queue = ['great'];
  m.state = 'slice';
  nextSlice(m);
  SFX.growl();
}
function nextSlice(m) {
  const kind = m.queue.shift();
  if (!kind) { m.slice = null; toRest(m); return; }
  const S = MAKORA.slices[kind], p = game.player;
  m.aim = Math.atan2(p.y - m.y, p.x - m.x);                  // locks on as the warning shows
  m.slice = { kind, t: 0, tele: (m.fast ? S.fast : S.tele) * quick(m), struck: false, a: m.aim };
}
// The cut: hurts you if you're inside the cone.
function strike(m, s, S) {
  SFX.slice(s.kind === 'great' ? 'cleave' : s.kind);
  if (s.kind === 'great') SFX.punch();
  game.shake = Math.max(game.shake, s.kind === 'great' ? 0.35 : 0.1);
  eachLiving(() => strikeOne(m, s, S));                      // co-op: the cut catches everyone in the cone
}
function strikeOne(m, s, S) {
  const p = game.player, dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
  let diff = Math.atan2(dy, dx) - s.a;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const inCone = d <= S.range + PLAYER.r && Math.abs(diff) <= S.arc / 2 + Math.atan2(PLAYER.r, Math.max(d, 1));
  if (!inCone) return;
  if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
  p.flash = 0.25;
  hurtPlayer(makoraDamage(m) * (S.dmg || 1));
}

// The kick (v0.38, user): it stamps, the ground cracks and a huge rock rises in front of it (draw: drawKickRise),
// then it kicks the rock at you down the lane it showed.
// `left`: how many more rocks follow this one (from the 2nd turn, several in a row, each with a shorter warning).
function startKick(m, left) {
  const first = left == null, R = MAKORA.rage;
  if (first) left = m.turns >= R.at ? R.rocks - 1 : 0;
  m.kick = { t: 0, tele: MAKORA.kick.tele * quick(m) * (first ? 1 : R.next), a: m.aim, x: m.x, y: m.y, locked: false, stomped: false, kicked: false, left };
  m.state = 'kick';
  if (first) SFX.growl();
}
function kickStomp(m, K) {
  SFX.kickStomp();
  game.shake = Math.max(game.shake, 0.22);
  game.rings.push({ x: K.x, y: K.y, r: 8, max: MAKORA.kick.r * 2.4, life: 0.35, color: COL.rock });
  burst(K.x, K.y, COL.rock, 18, 220);
  groundBreak(K.x, K.y, 22);                                 // the ground breaks where the rock comes up (boss.js)
}
// The rock goes into game.enemies, so your weapons aim at it and hit it like anything else (combat.js).
function kickRock(m, K) {
  const S = MAKORA.kick, hp = S.hp + S.hpPerTurn * m.turns, v = S.speed * (1 + S.speedPerTurn * m.turns);
  game.enemies.push({
    mrock: true, type: 'mrock', x: K.x, y: K.y, vx: Math.cos(K.a) * v, vy: Math.sin(K.a) * v, kx: 0, ky: 0,
    r: S.r, hp, maxHp: hp, dmg: S.dmg * MAKORA.mult ** m.turns, hit: 0, born: 1, t: 0, spin: Math.random() * TAU,
    seed: Math.floor(Math.random() * 1000),
  });
  SFX.kick();
  game.shake = Math.max(game.shake, 0.2);
  burst(K.x, K.y, COL.rock, 12, 300);
}
// One frame of a kicked rock (combat.js): it flies and tumbles, and breaks on you, or flies off the arena.
function moveKickRock(k, dt) {
  let p = game.player;
  if (NET.run) { const c = living().find(c => Math.hypot(k.x - c.body.x, k.y - c.body.y) < k.r + PLAYER.r); if (c) { usePlayer(c); p = c.body; } }   // co-op: whoever it hits
  k.t += dt; k.spin += dt * Math.hypot(k.vx, k.vy) / k.r * 0.5;
  k.x += k.vx * dt; k.y += k.vy * dt;
  if (!reducedMotion && Math.random() < 0.5) game.particles.push({ x: k.x - k.vx * 0.05, y: k.y + k.r * 0.6, vx: -k.vx * 0.1, vy: -20 * Math.random(), life: 0.3, color: COL.rock });
  if (k.x < -k.r * 2 || k.y < -k.r * 2 || k.x > W + k.r * 2 || k.y > H + k.r * 2) { k.gone = true; return; }
  if (Math.hypot(k.x - p.x, k.y - p.y) > k.r + PLAYER.r) return;
  k.gone = true;                                             // it hits you, and shatters (no explosion: that's for shooting it)
  burst(k.x, k.y, COL.rock, 26, 280);
  game.shake = Math.max(game.shake, 0.3);
  SFX.stomp(2);
  if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
  p.flash = 0.25;
  const a = Math.atan2(k.vy, k.vx);
  p.kx = (p.kx || 0) + Math.cos(a) * MAKORA.kick.knock; p.ky = (p.ky || 0) + Math.sin(a) * MAKORA.kick.knock;
  hurtPlayer(k.dmg);
}
// You shot it apart (combat.js hitEnemy): it explodes. The blast hurts MAKORA if it's inside (not you: you earned it).
function rockBlast(k) {
  const S = MAKORA.kick, m = game.makora;
  const i = game.enemies.indexOf(k);
  if (i >= 0) game.enemies.splice(i, 1);
  k.dead = true;
  SFX.rockBlast();
  game.shake = Math.max(game.shake, 0.35);
  game.rings.push({ x: k.x, y: k.y, r: 10, max: S.blast, life: 0.4, color: COL.relic });
  game.rings.push({ x: k.x, y: k.y, r: 6, max: S.blast * 0.7, life: 0.3, color: COL.wheelHi });
  burst(k.x, k.y, COL.relic, 22, 340);
  burst(k.x, k.y, COL.rock, 30, 300);
  if (!m || m.down || game.cine || Math.hypot(m.x - k.x, m.y - k.y) > S.blast + m.r * 0.6) return;
  const dmg = Math.ceil(m.maxHp * S.blastDmg);
  m.hp -= dmg; m.hit = 0.12;
  const a = Math.atan2(m.y - k.y, m.x - k.x);
  m.kx += Math.cos(a) * 260; m.ky += Math.sin(a) * 260;
  game.floaters.push({ x: m.x, y: m.y - m.r - 8, text: String(dmg), color: COL.relic, life: 0.8, vy: -50, big: true });
  if (m.hp <= 0) makoraDown(m, null);                        // its own rock finished it: it adapts to nothing
  else renderMakoraBar();
}
function clearKickRocks() { game.enemies = game.enemies.filter(e => !e.mrock); }

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
  if (game.makora) clearKickRocks();
  game.makora = null; game.makoraDue = false; game.makoraAdapted = new Set(); game.makoraAll = false; game.cine = null; game.cineHold = false;
  cineEl.hidden = true;
  cineSkip.hidden = true;
  cineWheel.classList.remove('is-shown', 'is-clunk');
  bossBar.classList.remove('is-makora');
  bossBar.setAttribute('aria-label', 'SKURTOSAURUS health');
  const sub = bossBar.querySelector('.boss-sub');
  if (sub) sub.hidden = true;
}

/* ---------- drawing (v0.38, user: like their new reference image) ----------
   A flat cartoon with a dark grey outline round every shape, seen from the front in a wide, bent-kneed stance: grey
   and muscular (pecs, a six-pack), a chain mark across the chest, a dark torn cloth knotted at the waist, thick black
   rings on its wrist, forearm and ankles, bare feet. A small eyeless head with an open mouth, feathery tufts fanning
   out from both sides of it, two big horns curling up round it (one hooks into a crescent), and the golden
   eight-spoked wheel above, which turns a notch each time it adapts. A short blade in the hand on the side it faces.
   It's drawn small on its own canvas and blown up with hard edges, for the same pixelation as the rest of the arena
   (v0.37, user). Local units: 30 = its radius, feet at y ≈ 34; it faces +x. */
function drawMakora(m) {
  const k = (m.r * (0.5 + 0.5 * m.born)) / 30, t = m.anim, st = m.state, still = reducedMotion;

  // the warning cone, then the slash itself (world space, along its aim)
  if (st === 'slice' && m.slice) {
    const s = m.slice, S = MAKORA.slices[s.kind];
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(s.a);
    if (!s.struck) warnCone(S.arc, S.range, Math.min(1, s.t / s.tele));
    else {
      const q = Math.min(1, (s.t - s.tele) / S.anim), fade = 1 - q;
      ctx.globalAlpha = fade; ctx.fillStyle = COL.blade;
      if (s.kind === 'sweep') crescent(0, S.range * 0.82, -S.arc / 2, -S.arc / 2 + S.arc * Math.min(1, q * 2.2), 14);
      else if (s.kind === 'great') {                           // a huge crescent sweeping the whole half circle, with an afterglow
        const a1 = -S.arc / 2 + S.arc * Math.min(1, q * 2.4);
        ctx.fillStyle = COL.bad; ctx.globalAlpha = fade * 0.5; crescent(0, S.range * 0.72, -S.arc / 2, a1, 44);
        ctx.fillStyle = COL.blade; ctx.globalAlpha = fade; crescent(0, S.range * 0.72, -S.arc / 2, a1, 24);
        ctx.globalAlpha = fade * 0.5; crescent(0, S.range * 0.45, -S.arc / 2, a1, 10);
      }
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
  // the punch: its cone fills, then the shockwave rolls out across it, a pale band with a red rim, fading as it goes
  if (st === 'punch' && m.punch) {
    const u = m.punch, P = MAKORA.punch;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(u.a);
    if (!u.struck) warnCone(P.arc, P.range, Math.min(1, u.t / u.tele));
    else {
      // full strength for the first half of its run, then fading to nothing as it reaches the end (v0.39, user: it
      // used to sit at the end of the cone, full strength, for the half second of recovery)
      const f = Math.min(1, (1 - u.wave / P.range) * 2.2);
      for (const [back, a] of [[P.width * 1.6, 0.25], [P.width * 0.8, 0.45]]) {   // two fainter ripples behind the front
        if (u.wave - back < m.r * 0.5) continue;
        ctx.globalAlpha = a * f; ctx.fillStyle = COL.makora;
        crescent(0, u.wave - back, -P.arc / 2, P.arc / 2, P.width * 0.35);
      }
      ctx.globalAlpha = f; ctx.fillStyle = COL.bad;
      crescent(0, u.wave, -P.arc / 2 - 0.04, P.arc / 2 + 0.04, P.width);
      ctx.fillStyle = COL.makora;
      crescent(0, u.wave, -P.arc / 2, P.arc / 2, P.width * 0.55);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // the kick: the lane the rock will fly down, filling as it winds up (solid once the aim locks), and the rock coming up
  const K = st === 'kick' ? m.kick : null;
  if (K && !K.kicked) {
    const S = MAKORA.kick, q = Math.min(1, K.t / K.tele), len = 720;
    ctx.save(); ctx.translate(K.x, K.y); ctx.rotate(K.a);
    ctx.fillStyle = COL.bad; ctx.globalAlpha = K.locked ? 0.3 : 0.1 + 0.14 * q;
    ctx.fillRect(0, -S.r, len, S.r * 2);
    ctx.globalAlpha = K.locked ? 0.55 : 0.35 + 0.3 * q; ctx.fillRect(0, -S.r, len * q, S.r * 2);   // filling up the lane
    ctx.globalAlpha = K.locked ? 1 : 0.6; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
    if (!K.locked) ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(0, -S.r); ctx.lineTo(len, -S.r); ctx.moveTo(0, S.r); ctx.lineTo(len, S.r); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  const rising = K && K.stomped && !K.kicked;                // the rock, pushing up out of the broken ground
  const rise = rising ? Math.min(1, (K.t - K.tele * MAKORA.kick.stomp) / (K.tele * 0.35)) : 0;
  const drawRise = () => {
    const S = MAKORA.kick, e = 1 - (1 - rise) ** 3;
    drawRockBody(K.x, K.y - 10 * e + (1 - e) * 10, S.r * (0.35 + 0.65 * e), (1 - e) * 0.6, 0, 7);
  };
  if (rising && K.y <= m.y) drawRise();

  // The pose. `dA` / `dB`: the blade arm's upper arm from the shoulder (0 = out to its side, − = up) and how far the
  // forearm turns from there; `knife`: the blade's angle from the forearm. `fA` / `fB`: the other arm. `fFront`: that
  // arm thrown across the front (the punch). `legN`: the near leg's knee and ankle when it's kicking.
  let lean = 0, crouch = 0, dA = -0.9, dB = 1.5, knife = 0.1, fA = 2.3, fB = -0.75, fFront = false, legN = null, footRot = 0;
  const breathe = still ? 0 : Math.sin(t * 2.4) * 0.8;
  const lerp = (a, b, x) => a + (b - a) * x;
  const stride = st === 'walk' ? Math.sin(m.step) * 0.5 : st === 'dash' ? 0.7 : 0;
  if (st === 'walk') { dA += Math.sin(m.step) * 0.1; fA -= Math.sin(m.step) * 0.12; crouch = Math.abs(Math.sin(m.step)) * 1.5; }
  else if (st === 'windup') { crouch = 5; lean = 0.12; dA = -2.4; dB = 0.6; knife = 0.3; fA = 2.6; fB = -1.2; }
  else if (st === 'dash') { crouch = 2; lean = 0.3; dA = 0.1; dB = 0.1; knife = 0; }
  else if (st === 'slice' && m.slice) {
    const s = m.slice, S = MAKORA.slices[s.kind], q = s.struck ? Math.min(1, (s.t - s.tele) / S.anim) : 0;
    const swing = { sweep: [[-1.5, -0.9], [0.5, 0.3]], cleave: [[-2.5, -0.5], [1.0, 0.3]], cross: [[-2.1, -0.5], [0.6, 0.5]], great: [[-2.8, -0.6], [1.3, 0.4]] }[s.kind];
    knife = 0.2;
    if (!s.struck) { const w = Math.min(1, s.t / s.tele); dA = lerp(-0.9, swing[0][0], w); dB = lerp(1.5, swing[0][1], w); crouch = 4 * w; lean = -0.05 * w; }
    else {
      const x = s.kind === 'cross' ? (q < 0.5 ? q * 2 : 2 - q * 2) : q;
      dA = lerp(swing[0][0], swing[1][0], x); dB = lerp(swing[0][1], swing[1][1], x); lean = 0.18; crouch = 3;
    }
  } else if (st === 'punch' && m.punch) {                     // draws the fist right back, then throws it across
    const u = m.punch;
    if (!u.struck) { const q = Math.min(1, u.t / u.tele); fA = lerp(2.3, 3.5, q); fB = lerp(-0.75, 1.6, q); crouch = 3 * q; lean = -0.1 * q; dA = lerp(-0.9, -0.3, q); dB = lerp(1.5, 1.9, q); }
    else { fFront = true; fA = 0.02; fB = 0; lean = 0.16; crouch = 2; dA = -2.3; dB = -0.5; }   // the blade arm swings up out of the way
  } else if (K) {                                             // lift the near leg, stamp, draw it back, kick
    const S = MAKORA.kick, q = K.t / K.tele;
    const R = [[25, 2], [33, 20]], LIFT = [[26, -10], [31, 5]], BACK = [[20, -4], [14, 12]], KICK = [[32, -6], [50, -10]];
    const mix = (A, B, x) => [[lerp(A[0][0], B[0][0], x), lerp(A[0][1], B[0][1], x)], [lerp(A[1][0], B[1][0], x), lerp(A[1][1], B[1][1], x)]];
    if (K.kicked) { legN = KICK; footRot = -1.5; lean = -0.12; crouch = 2; }
    else if (q < S.stomp) legN = mix(R, LIFT, q / S.stomp);
    else if (q < S.stomp + 0.1) { legN = R; crouch = 4; }    // the stamp
    else { const x = Math.min(1, (q - S.stomp - 0.1) / 0.45); legN = mix(R, BACK, x); lean = -0.1 * x; crouch = 3; footRot = -0.6 * x; }
    fA = 2.1; fB = -0.4; dA = -1.2; dB = 1.2;                // arms out for balance
  } else { crouch = 1; }

  // drawn small on its own canvas and blown up with hard edges: blocks of 2 arena px, like the arena under the CRT filter
  const bs = cv.width / VW, B = Math.max(1, Math.round(2 * bs)), q = k * bs / B;   // B: canvas pixels per block; q: blocks per unit
  const pw = Math.ceil(MK.w * q), ph = Math.ceil(MK.h * q);
  if (!(pw > 0 && ph > 0 && pw < 4096 && ph < 4096)) return;   // a hidden or zero-size view for a moment: skip this frame
  if (mkCv.width !== pw || mkCv.height !== ph) { mkCv.width = pw; mkCv.height = ph; }
  const c = mkx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, ph);
  c.setTransform(q * m.face, 0, 0, q, -MK.x0 * q, -MK.y0 * q);   // MK's box is centred on x, so the flip stays inside it
  drawMakoraBody(c, m, { lean, crouch, dA, dB, knife, fA, fB, fFront, legN, footRot, stride, breathe, t, still });
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (readbackOK()) {                                        // hard edges: every block is there or it isn't
    try {
      const img = c.getImageData(0, 0, pw, ph), d = img.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
      c.putImageData(img, 0, 0);
    } catch (err) { readback.ok = false; }                   // a browser that won't let us read it: soft edges instead
  }
  if (m.hit > 0) {                                           // a hit flashes it pale
    c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.6; c.fillStyle = '#fff';
    c.fillRect(0, 0, pw, ph);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }

  ctx.save();
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(m.x, m.y + 34 * k, 36 * k, 7 * k); ctx.globalAlpha = 1;   // shadow
  const g = B / bs;                                           // one block, in arena px: snap to the block grid
  const x0 = Math.round((m.x + MK.x0 * k) / g) * g, y0 = Math.round((m.y + MK.y0 * k) / g) * g;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mkCv, x0, y0, pw * g, ph * g);
  ctx.restore();
  if (rising && K.y > m.y) drawRise();
}
// A red warning cone along +x (the caller has rotated to the aim): faint, filling, with its edge racing out.
function warnCone(arc, range, q) {
  ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.1 + 0.18 * q;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, range, -arc / 2, arc / 2); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.5 + 0.4 * q; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, range * q, -arc / 2, arc / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-arc / 2) * range, Math.sin(-arc / 2) * range);
  ctx.moveTo(0, 0); ctx.lineTo(Math.cos(arc / 2) * range, Math.sin(arc / 2) * range); ctx.stroke();
  ctx.globalAlpha = 1;
}

// The kicked rock (draw.js): huge, tumbling, with a streak behind it and its HP above, so it reads as something to shoot.
function drawKickRock(k) {
  const a = Math.atan2(k.vy, k.vx);
  ctx.strokeStyle = COL.rock; ctx.globalAlpha = 0.3; ctx.lineWidth = k.r * 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x - Math.cos(a) * 70, k.y - Math.sin(a) * 70); ctx.stroke();
  ctx.globalAlpha = 1;
  drawRockBody(k.x, k.y, k.r, k.spin, k.hit > 0 ? 1 : 0, k.seed);
  const bw = k.r * 1.8, by = k.y - k.r - 14;
  ctx.fillStyle = COL.line; ctx.fillRect(k.x - bw / 2 - 1.5, by - 1.5, bw + 3, 7);
  ctx.fillStyle = COL.relic; ctx.fillRect(k.x - bw / 2, by, bw * Math.max(0, k.hp / k.maxHp), 4);
}
// A big lumpy boulder: a dark outline, flat facets in two shades, cracks. `flash` whitens it when it's hit.
function drawRockBody(x, y, r, spin, flash, seed) {
  const n = 13, pts = [];                                   // lumpy: each corner pushed in or out a little (the same each frame)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (0.8 + 0.22 * (((i + 3) * (seed + 11) * 7919) % 97) / 96) * (1 + 0.08 * Math.sin(i * 2.3));
    pts.push([Math.cos(a) * rr * 1.08, Math.sin(a) * rr * 0.94]);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  path(); ctx.fillStyle = COL.rock; ctx.fill();
  ctx.save(); path(); ctx.clip();                            // a darker lower half and a pale facet on top
  ctx.fillStyle = COL.rockDark; ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.1); ctx.lineTo(r * 1.2, -r * 0.2); ctx.lineTo(r * 1.2, r * 1.2); ctx.lineTo(-r * 1.2, r * 1.2); ctx.fill();
  ctx.fillStyle = COL.rockHi; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(r * 0.2, -r * 0.85); ctx.lineTo(r * 0.05, -r * 0.35); ctx.lineTo(-r * 0.55, -r * 0.3); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = COL.crack; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();                                          // cracks, and a couple of pits
  ctx.moveTo(-r * 0.15, -r * 0.2); ctx.lineTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.15, r * 0.5); ctx.moveTo(r * 0.2, r * 0.1); ctx.lineTo(r * 0.62, 0);
  ctx.moveTo(-r * 0.7, r * 0.1); ctx.lineTo(-r * 0.4, r * 0.3); ctx.lineTo(-r * 0.45, r * 0.6);
  ctx.stroke();
  ctx.fillStyle = COL.rockDark;
  for (const [px, py, pr] of [[-0.35, -0.45, 0.09], [0.45, 0.45, 0.07], [0.55, -0.35, 0.06]]) { ctx.beginPath(); ctx.arc(px * r, py * r, pr * r, 0, TAU); ctx.fill(); }
  path(); ctx.strokeStyle = COL.crack; ctx.lineWidth = Math.max(2, r * 0.09); ctx.stroke();
  if (flash) { path(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

const MK = { x0: -100, y0: -112, w: 200, h: 170 };
// Can we read the canvas back as drawn? (v0.44, user: every browser.) Brave's fingerprinting protection, Firefox's
// resistFingerprinting and Safari's private browsing can add noise to a canvas read, or return blank or random pixels.
// A small noise is harmless here, but a blank or random read would make MAKORA a box of noise, so this draws a known
// pattern once and checks it comes back close. If not, MAKORA is drawn without the hard-edge pass (slightly soft
// edges; everything else is the same).
const readback = { ok: null };
function readbackOK() {
  if (readback.ok !== null) return readback.ok;
  try {
    const t = document.createElement('canvas'); t.width = 8; t.height = 2;
    const x = t.getContext('2d', { willReadFrequently: true });
    const want = [];
    for (let i = 0; i < 8; i++) { const v = [i * 32, 255 - i * 30, (i * 71) % 256]; want.push(v); x.fillStyle = `rgb(${v})`; x.fillRect(i, 0, 1, 1); }
    const d = x.getImageData(0, 0, 8, 2).data;
    let bad = 0;
    for (let i = 0; i < 8; i++) {
      const o = i * 4;
      if (d[o + 3] !== 255 || want[i].some((v, j) => Math.abs(d[o + j] - v) > 6)) bad++;
      if (d[(8 + i) * 4 + 3] > 6) bad++;                     // the second row was left empty: it must read back clear
    }
    readback.ok = bad === 0;
  } catch (err) { readback.ok = false; }
  return readback.ok;
}          // the box it's drawn in, in its units
const mkCv = document.createElement('canvas');
const mkx = mkCv.getContext('2d', { willReadFrequently: true });
function drawMakoraBody(c, m, P) {
  const SK = COL.makora, SH = COL.makoraDark, OL = COL.makoraLine, LW = 1.3;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const trace = pts => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  const ink = (col, lw = LW) => { c.fillStyle = col; c.fill(); c.strokeStyle = OL; c.lineWidth = lw; c.stroke(); };
  const shape = (col, path) => { c.beginPath(); path(); ink(col); };
  const lines = (w, segs, col = OL) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (const s of segs) { c.moveTo(s[0], s[1]); for (let i = 2; i < s.length; i += 2) c.lineTo(s[i], s[i + 1]); } c.stroke(); };
  // a limb through its joints, each segment its own width, outlined: all the outline first, then all the fill
  const limb = (col, pts, ws) => {
    for (const [cc, extra] of [[OL, LW * 2], [col, 0]]) {
      c.strokeStyle = cc;
      for (let i = 1; i < pts.length; i++) { c.lineWidth = ws[i - 1] + extra; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
    }
  };
  // a thick black ring round a limb at (x, y), the limb heading along `a`, `w` across
  const band = (x, y, a, w) => {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.roundRect(-2.6, -w / 2, 5.2, w, 2); ink(COL.makoraBand, 1);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-1.6, -w / 2 + 1, 1.4, w - 2);   // a glint
    c.restore();
  };
  // a curved ribbon along a cubic Bézier, `w0` wide at the start tapering to `w1`: horns, the blade
  const bez = (p, u) => { const v = 1 - u; return [0, 1].map(j => v * v * v * p[0][j] + 3 * v * v * u * p[1][j] + 3 * v * u * u * p[2][j] + u * u * u * p[3][j]); };
  const ribbon = (col, p, w0, w1, n = 16) => {
    const L = [], R = [], mid = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, [x, y] = bez(p, u), [ax, ay] = bez(p, Math.max(0, u - 0.02)), [bx, by] = bez(p, Math.min(1, u + 0.02));
      const tl = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / tl, ny = (bx - ax) / tl, w = (w0 + (w1 - w0) * u) / 2;
      L.push([x + nx * w, y + ny * w]); R.unshift([x - nx * w, y - ny * w]); mid.push([x, y, nx, ny, w]);
    }
    trace(L.concat(R)); ink(col);
    return mid;
  };
  // a feathery tuft along +x from (x, y) at angle a: a long plume with ragged barbs raking out to the tip
  const tuft = (x, y, a, len, wid, col) => {
    c.save(); c.translate(x, y); c.rotate(a);
    const top = [[0, -wid * 0.4]], bot = [];
    const N = 7;
    for (let i = 1; i < N; i++) {
      const u = i / N, env = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * 0.35);
      top.push([len * (u + 0.06), -wid * env * 1.15], [len * u, -wid * env * 0.55]);   // a barb, then the notch behind it
      bot.unshift([len * u, wid * env * 0.45], [len * (u + 0.06), wid * env * 0.95]);
    }
    trace([...top, [len, 0], ...bot, [0, wid * 0.4]]); ink(col);
    lines(0.7, [[1.5, 0, len * 0.82, 0]]);                   // the quill
    c.restore();
  };

  const hipY = -20 + P.crouch + P.breathe * 0.3;
  // legs: a wide, bent-kneed stance, black rings at the ankles, bare feet. The near one (+x) kicks.
  const leg = (sgn, sw, over) => {
    const hx = sgn * 10, hy = hipY + 2;
    const [kn, an] = over || [[sgn * (25 + sw * 4), 2 - Math.max(0, sw) * 3], [sgn * (33 + sw * 7), 20 - Math.max(0, sw) * 4]];
    limb(SK, [[hx, hy], kn, an], [13, 10]);
    lines(0.8, [[kn[0] - sgn * 3, kn[1] + 1, kn[0] + sgn * 1, kn[1] + 3], [kn[0] + sgn * 1, kn[1] + 5, an[0] - sgn * 1, an[1] - 7]]);   // knee, calf
    const sa = Math.atan2(an[1] - kn[1], an[0] - kn[0]);
    // the foot, below the ankle (turned with the shin when it kicks)
    const rot = over ? P.footRot : 0, fx = an[0] + sgn * 3 + Math.cos(sa) * 3, fy = an[1] + 7 + Math.sin(rot) * 3;
    c.save(); c.translate(fx, fy); c.rotate(sgn * rot);
    shape(SK, () => { c.moveTo(-sgn * 6, -5); c.quadraticCurveTo(sgn * 10, -6, sgn * 11, 2); c.quadraticCurveTo(0, 5, -sgn * 7, 3); c.closePath(); });
    lines(0.7, [[sgn * 5, 0.5, sgn * 6, 3.5], [sgn * 7.5, 0, sgn * 8.6, 3], [sgn * 9.6, -0.5, sgn * 10.4, 2.4]]);   // toes
    c.restore();
    band(an[0] - Math.cos(sa) * 3, an[1] - Math.sin(sa) * 3, sa, 13);
  };
  leg(-1, -P.stride, null);
  leg(1, P.stride, P.legN);

  c.save();                                                  // everything above the hips leans with it
  c.translate(0, hipY); c.rotate(P.lean); c.translate(0, -hipY);
  const up = P.crouch;                                       // the upper body sinks with the crouch
  c.translate(0, up);

  // the horns, behind the head: one loops up round behind the wheel, the other sweeps out and hooks into a crescent
  const hl = ribbon(SH, [[-3, -64], [-42, -64], [-46, -100], [-6, -103]], 11, 2.5);   // loops over, behind the wheel
  const hr = ribbon(SK, [[3, -64], [36, -62], [46, -86], [30, -101]], 11, 1);           // out and up …
  ribbon(SK, [[31, -100], [27, -104], [20, -104], [15, -99]], 3.4, 0.5, 6);            // … hooking back in at the tip
  for (const H of [hl, hr]) for (const i of [3, 6, 9, 12]) { const [x, y, nx, ny, w] = H[i]; lines(0.8, [[x + nx * w, y + ny * w, x - nx * w * 0.3, y - ny * w * 0.3]]); }   // ridges
  // the far tufts, behind, a shade darker
  tuft(-2, -64, -2.1, 30, 5.5, SH); tuft(2, -64, -1.0, 30, 5.5, SH);

  // neck and torso: broad shoulders, narrowing to the waist
  c.beginPath(); c.roundRect(-4.5, -60, 9, 10, 2); ink(SK);
  shape(SK, () => {
    c.moveTo(-7, -54); c.quadraticCurveTo(-15, -51, -21, -46); c.quadraticCurveTo(-23, -39, -18, -35);
    c.quadraticCurveTo(-13, -31, -11, -25); c.lineTo(11, -25); c.quadraticCurveTo(13, -31, 18, -35);
    c.quadraticCurveTo(23, -39, 21, -46); c.quadraticCurveTo(15, -51, 7, -54); c.closePath();
  });
  c.strokeStyle = OL; c.lineWidth = 0.9; c.beginPath();
  c.moveTo(-16, -41); c.quadraticCurveTo(-8, -35, -1, -39); c.moveTo(1, -39); c.quadraticCurveTo(8, -35, 16, -41);   // pecs
  c.moveTo(0, -43); c.lineTo(0, -27);                                                                             // down the middle
  for (const y of [-33.5, -30.5, -27.5]) { c.moveTo(-5.5, y); c.quadraticCurveTo(-3, y + 1.2, -0.5, y); c.moveTo(0.5, y); c.quadraticCurveTo(3, y + 1.2, 5.5, y); }   // the six-pack
  c.moveTo(-9, -36); c.quadraticCurveTo(-9.5, -31, -8, -27); c.moveTo(9, -36); c.quadraticCurveTo(9.5, -31, 8, -27);   // obliques
  c.moveTo(-15, -36); c.lineTo(-12, -34.5); c.moveTo(15, -36); c.lineTo(12, -34.5);                             // ribs
  c.stroke();
  // the chain mark across its chest: a curved line with little rings hanging off it
  c.strokeStyle = COL.makoraBand; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-9, -45.5); c.quadraticCurveTo(0, -41.5, 9, -45.5); c.stroke();
  c.lineWidth = 0.8;
  for (const x of [-5, 0, 5]) { const y = -43.4 - Math.abs(x) * 0.25; c.beginPath(); c.ellipse(x, y + 1.5, 0.9, 1.2, 0, 0, TAU); c.stroke(); }

  // the torn cloth: a dark wrap at the waist, flaring out to a ragged hem over the knees, with its knot and hanging end
  const flutter = x => (P.still ? 0 : Math.sin(P.t * 5 + x * 0.4) * 0.7);
  shape(COL.makoraCloth, () => {
    c.moveTo(-13, -27); c.quadraticCurveTo(0, -24, 13, -27);
    c.lineTo(21, -15); c.lineTo(29, -2);
    for (const [x, y] of [[27, 5], [23, 1], [20, 9], [15, 4], [11, 12], [7, 6], [3, 12], [-2, 6], [-7, 11], [-11, 4], [-16, 10], [-20, 2], [-25, 7], [-29, -1]]) c.lineTo(x, y + flutter(x));
    c.lineTo(-21, -15); c.closePath();
  });
  lines(0.9, [[-6, -21, -12, -2, -14, 6], [7, -21, 13, -3, 15, 3], [-17, -12, -23, 2], [18, -12, 24, 0]], COL.makoraClothDark);   // folds
  c.beginPath(); c.ellipse(-3, -24, 4.2, 2.8, -0.2, 0, TAU); ink(COL.makoraClothDark);                                           // the knot …
  shape(COL.makoraClothDark, () => { c.moveTo(-6, -22); c.lineTo(-1, -22); c.lineTo(1, -6 + flutter(0)); c.lineTo(-2, 1 + flutter(1)); c.lineTo(-5, -5); c.closePath(); });   // … and its end

  // the head: small, eyeless, its mouth open
  c.beginPath(); c.ellipse(0, -61, 5.2, 7.2, 0, 0, TAU); ink(SK);
  c.beginPath(); c.ellipse(0, -55.5, 2.5, 2.4, 0, 0, TAU); ink(COL.makoraMouth, 1);
  // the front tufts: feathery wings fanning up and out from the sides of its head
  tuft(-3, -62, -2.55, 34, 6.4, SK); tuft(-4, -58, -2.95, 29, 5.4, SK);
  tuft(3, -62, -0.6, 34, 6.4, SK); tuft(4, -58, -0.2, 29, 5.4, SK);

  // the wheel above its head: gold, eight spokes with knobbed ends, tilted back a little, turned a notch per adaptation
  c.save(); c.translate(0, -84 + (P.still ? 0 : Math.sin(P.t * 2) * 1.2)); c.scale(1, 0.84); c.rotate(m.wheelA);
  for (const [col, extra] of [[COL.wheelDark, 1.6], [COL.wheel, 0]]) {
    c.strokeStyle = col;
    c.lineWidth = 2.6 + extra; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.stroke();
    c.lineWidth = 2 + extra; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5); c.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5); }
    c.stroke();
  }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.arc(Math.cos(a) * 15, Math.sin(a) * 15, 2.9, 0, TAU); c.fillStyle = COL.wheel; c.fill(); c.strokeStyle = COL.wheelDark; c.lineWidth = 1; c.stroke(); }
  c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fillStyle = COL.wheel; c.fill(); c.strokeStyle = COL.wheelDark; c.stroke();
  c.restore();

  // the arms. An arm: shoulder, elbow, hand from its two angles
  const arm = (s0, a, b, l1, l2) => { const e = [s0[0] + Math.cos(a) * l1, s0[1] + Math.sin(a) * l1]; return [s0, e, [e[0] + Math.cos(a + b) * l2, e[1] + Math.sin(a + b) * l2]]; };
  const fist = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); ink(SK); lines(0.7, [[x - r * 0.3, y - r * 0.7, x - r * 0.3, y + r * 0.6]]); };
  const muscle = pts => {                                    // the deltoid over the shoulder and a line for the bicep
    const [s, e] = pts, a = Math.atan2(e[1] - s[1], e[0] - s[0]);
    c.beginPath(); c.ellipse(s[0] + Math.cos(a) * 3.5, s[1] + Math.sin(a) * 3.5, 6, 4.6, a, 0, TAU); ink(SK);
    lines(0.8, [[s[0] + Math.cos(a) * 8 - Math.sin(a) * 2.5, s[1] + Math.sin(a) * 8 + Math.cos(a) * 2.5, e[0] - Math.cos(a) * 2 - Math.sin(a) * 3, e[1] - Math.sin(a) * 2 + Math.cos(a) * 3]]);
  };
  const fistArm = () => {
    const pts = P.fFront ? arm([-6, -45], P.fA, P.fB, 20, 20) : arm([-21, -45], P.fA, P.fB, 17, 15);
    limb(SK, pts, [10.5, 8.5]);
    muscle(pts);
    const fa = Math.atan2(pts[2][1] - pts[1][1], pts[2][0] - pts[1][0]);
    band(pts[2][0] - Math.cos(fa) * 5, pts[2][1] - Math.sin(fa) * 5, fa, 11);
    fist(pts[2][0] + Math.cos(fa) * 1.5, pts[2][1] + Math.sin(fa) * 1.5, P.fFront ? 5.8 : 5.2);
  };
  if (!P.fFront) fistArm();
  // the blade arm: a ring near the elbow, the short blade gripped in its fist
  const sp = arm([21, -45], P.dA, P.dB, 14, 13);
  const fa = Math.atan2(sp[2][1] - sp[1][1], sp[2][0] - sp[1][0]), ka = fa + P.knife;
  const hx = sp[2][0], hy = sp[2][1], dir = [Math.cos(ka), Math.sin(ka)];
  ribbon(COL.blade, [[hx + dir[0] * 3, hy + dir[1] * 3], [hx + dir[0] * 10, hy + dir[1] * 10 - 1], [hx + dir[0] * 18, hy + dir[1] * 18 - 1], [hx + dir[0] * 27, hy + dir[1] * 27]], 4.2, 0.4, 10);
  lines(0.7, [[hx + dir[0] * 6, hy + dir[1] * 6, hx + dir[0] * 21, hy + dir[1] * 21]], '#ffffff');   // its edge catching the light
  c.beginPath(); c.moveTo(hx - dir[0] * 4, hy - dir[1] * 4); c.lineTo(hx + dir[0] * 3, hy + dir[1] * 3); c.strokeStyle = COL.makoraBand; c.lineWidth = 2.6; c.stroke();   // the grip
  limb(SK, sp, [10, 8.5]);
  muscle(sp);
  band(sp[1][0] + Math.cos(fa) * 3.5, sp[1][1] + Math.sin(fa) * 3.5, fa, 10.5);
  fist(hx, hy, 5);
  if (P.fFront) fistArm();                                   // the punch, thrown across in front
  c.restore();
}

// A curved blade trail: an arc band from angle a0 to a1 at radius r, `w` thick, tapering at both ends.
function crescent(cx, r, a0, a1, w) {
  if (a1 <= a0) return;
  ctx.beginPath();
  ctx.arc(cx, 0, r + w / 2, a0, a1);
  ctx.arc(cx, 0, r - w / 2, a1, a0, true);
  ctx.closePath(); ctx.fill();
}
