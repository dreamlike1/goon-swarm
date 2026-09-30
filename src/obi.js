/* obi.js — OBI ONE, the level-20 boss (v0.48, user): a Jedi with a lightsaber, and the DEFLECT relic he drops. */
'use strict';

/* The fight (user):
   - Level 20. The swarm clears and "DO YOU FEEL THAT???" comes up while the air hums. He walks in and opens by
     throwing his spinning lightsaber at you: dodge it, it flies back, and he catches it. Then the fight starts.
   - His attacks: a slice up close, a dash that ends in a slice from mid range, and the throw when you're far away.
     Every long-range attack shows where it's going first (the throw's lane, the dash's line).
   - Sometimes he blocks: his saber twirls in front of him and every shot that hits him is knocked back at you, so
     dodge (your cards keep firing on their own).
   - Phase 2 (a fresh, bigger bar; v0.50): faster, and out of his melee reach he always throws, then dashes a long
     way at you once he has it back. Stay out of his reach for 3–5 s and he drags you in with the force (the screen
     shakes; smash SPACE, or tap, to fill the ring round you and break free before you reach him). Stay inside it
     for 3–5 s and the force shoves you off while debris rains down all over the arena.
   - Phase 3 (v0.50): rocks fall and stay round the arena, and he hurls them at you with the force.
   - Beat him and you get DEFLECT: P raises a shield for 5 s that stops the first hit. Raise it just before a hit
     lands (a perfect deflect) and half its cooldown comes back.
   His music is his own song, obi-music.m4a from about 30 s in (v0.50, user; SKURTOSAURUS's before).
   Numbers are placeholders apart from the user's (level 20, more HP than
   SKURTOSAURUS's phase 2, phase 2 more than phase 1, the 5 s shield). */
const OBI = {
  name: 'OBI ONE', level: 20, hp: 360, r: 40,          // hp: SKURTOSAURUS's phase 2 has 300. `r`: the drawing's size
  hit: { r: 13, cap: [0, 18, 0, -26] },                // his hitbox, in drawing units (30 = r px): legs up to his head
  walk: 110, keep: 110, knockResist: 0.12,
  dmg: 10, dashDmg: 16,                                // touching him / being hit by his dash
  cd: [0.45, 0.95], rest: 0.5,
  slice: { at: 125, tele: 0.36, anim: 0.2, arc: 2.3, range: 120, dmg: 18, lunge: 160 },
  dash: { at: 400, tele: 0.5, time: 0.3, speed: 900, stopAt: 70, sliceTele: 0.14 },   // then a slice as he arrives
  throw: { tele: 0.75, lock: 0.75, speed: 760, back: 980, range: 640, r: 22, dmg: 16, catch: 30, spin: 16 },
  block: { every: [4.5, 7.5], first: 5, time: 1.5, chance: 0.55,
    bolt: { speed: 430, r: 6, dmg: 9, every: 0.12, max: 14, life: 3.2 } },   // what your shots turn into when he blocks
  intro: { hums: [0.15, 0.95, 1.75], spawn: 2.6, arrive: 0.7, tele: 1.1 },
  // Phase 2 (user, v0.49): faster, the blade turns red, and up close his moves are a fixed rotation — small slash,
  // a stabbing dash, a big slash — round and round; his throw curves in on you as it flies (dodge it).
  // v0.50 (user): more HP (450 before); faster, with longer dashes at you; out of his melee reach he always throws;
  // stay out of it for 3–5 s (random each time) and he pulls you in; stay inside it for 3–5 s and the force shoves
  // you off while debris rains over the whole arena (dodge it). (The old pull-on-a-dodged-throw and the steady
  // debris rain are gone.)
  phase2: {
    hp: 600, focus: 1.6, push: 520, walk: 1.35, quick: 0.62,
    melee: 150,                                        // his melee reach: out of it, he throws
    pullAfter: [3, 5], pushAfter: [3, 5],              // seconds out of / inside his reach before he pulls / pushes
    pull: { speed: 185, reach: 62, press: 0.12, decay: 0.25, dmg: 26, knock: 620, stun: 1.2, shake: 0.07, max: 6 },
    rotation: ['smallSlash', 'stabDash', 'bigSlash'],  // up close, round and round
    smallSlash: { tele: 0.16, anim: 0.12, arc: 1.5, range: 105, dmg: 10, lunge: 80 },
    bigSlash: { tele: 0.45, anim: 0.3, arc: 3.1, range: 160, dmg: 26, lunge: 110 },
    stabDash: { tele: 0.24, time: 0.32, speed: 1050, stopAt: 55, sliceTele: 0.08,
      stab: { anim: 0.12, arc: 0.55, range: 80, dmg: 20, lunge: 140 } },
    // after catching his saber with you out of reach: a long dash straight at you (user: longer dashes), then a stab
    lunge: { tele: 0.3, time: 0.55, speed: 1250, stopAt: 60, sliceTele: 0.08,
      stab: { anim: 0.12, arc: 0.7, range: 85, dmg: 22, lunge: 140 } },
    throwTurn: 3.2,                                    // the throw's homing turn rate (rad/s) while it flies out
    push: 720,                                         // the force push's shove
  },
  // The force push's debris (user: over the whole arena, so you dodge through the gaps): the arena is cut into
  // `cell` px squares and about `fill` of them get a rock, each warned by a red circle for `warn` s (+ up to `stagger`).
  storm: { cell: 165, fill: 0.5, warn: 1.1, stagger: 0.6, r: 48, dmg: 22 },
  // Phase 3 (user): rocks fall and stay on the arena (you can walk through them), glowing with the force, and every
  // few seconds he lifts one and hurls it at you down a lane (dodge it). New ones fall to replace them.
  phase3: {
    hp: 750, focus: 2, quick: 0.58,
    rocks: 7, r: 30, fall: 1.2, fallDmg: 20, gap: 150, refill: [3, 4.5],
    hurl: { every: [3, 5], lift: 0.9, lock: 0.7, speed: 760, dmg: 24, knock: 480 },
  },
  xp: 30,
};
// DEFLECT (user): P, or tap its icon. `time`: how long the shield lasts; `perfect`: a hit this soon after raising it
// is a perfect deflect, which gives back half the cooldown. `push`/`knock`: the shove to enemies nearby when it goes.
const DEFLECT = { name: 'DEFLECT', key: 'P', time: 5, cd: 12, perfect: 0.3, safe: 0.45, push: 90, knock: 620 };
// A shield with a blade across it: the relic's icon by the HP bar (next to BULL) and in its message.
const DEFLECT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
  + `<path d="M12 3l7 3v5.5c0 4.2-3 7.6-7 9.5-4-1.9-7-5.3-7-9.5V6z"/><path d="M8 15.5L16.5 7"/><path d="M6.5 17l1.5-1.5"/></svg>`;

/* ---------- the intro ---------- */
// Level 20 (upgrades.js) sets game.obiDue; combat.js starts this once the picks are done.
function startObi() {
  game.obiDue = false;
  for (const e of game.enemies) {                           // the swarm scatters, as for SKURTOSAURUS
    burst(e.x, e.y, enemyCol(e), 6, 140);
    game.rings.push({ x: e.x, y: e.y, r: 2, max: e.r * 2, life: 0.3, color: enemyCol(e) });
  }
  game.enemies = []; game.projectiles = []; game.rocks = [];
  aliveEl.textContent = 0;
  game.intro = { kind: 'obi', t: 0, stomp: 0 };
  startIntroScene('obi');
}
// One frame of it (boss.js updateIntro hands over): a hum in the air three times, each shaking the arena a little
// more while dust drifts in toward the middle, then he's there.
function updateObiIntro(dt) {
  const it = game.intro, I = OBI.intro;
  it.t += dt;
  if (it.stomp < I.hums.length && it.t >= I.hums[it.stomp]) {
    it.stomp++;
    SFX.forceHum(it.stomp);
    game.shake = Math.max(game.shake, 0.06 + it.stomp * 0.04);
    if (!reducedMotion) for (let k = 0; k < 10 + it.stomp * 6; k++) {
      const a = Math.random() * TAU, d = 160 + Math.random() * Math.max(W, H) * 0.4;
      game.particles.push({ x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: -Math.cos(a) * 220, vy: -Math.sin(a) * 220, life: 0.8, color: COL.saber });
    }
  }
  if (it.t >= I.spawn) {
    game.intro = null;
    if (!NET.guest) spawnObi();
    introEl.hidden = true;                                  // his name comes up when he catches his saber
  }
}
// "VS OBI ONE", once he has caught his opening throw (a co-op guest is told by the host).
function showObiName() {
  if (NET.host && NET.run) coopEvent({ e: 'obiName' });
  clearTimeout(introTimer);
  introEl.innerHTML = `<p class="intro-name is-obi"><span class="intro-vs">VS</span>${OBI.name}</p>`;
  introEl.hidden = false;
  introTimer = setTimeout(() => { introEl.hidden = true; }, 1400);
}

function spawnObi() {
  const p = game.player, h = Math.min(playH || H, H);
  const x = p.x < W / 2 ? W * 0.76 : W * 0.24, y = Math.max(90, Math.min(h - 90, p.y));   // the side furthest from you (clear of the stats)
  const hp = Math.round(OBI.hp * coopBossHp());
  const o = {
    obi: true, type: 'obi', shape: 'obi', x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: OBI.r, size: OBI.r,
    hp, maxHp: hp, dmg: OBI.dmg, hit: 0, born: 0, speed: OBI.walk,
    state: 'arrive', t: OBI.intro.arrive, cd: 1, blockCd: OBI.block.first, face: x > p.x ? -1 : 1, aim: x > p.x ? Math.PI : 0,
    step: 0, anim: 0, phase: 1, intro: true, sl: null, th: null, pull: null, dodgedBy: null, boltAt: -9,
  };
  sizeObi(o);
  game.enemies = [o];
  game.obi = o;
  SFX.saberOn();
  renderObiBar();
  aliveEl.textContent = game.enemies.length;
}

// His hitbox follows his drawing: a capsule from his legs up to his head, growing in as he arrives.
function sizeObi(o) {
  const u = (o.size || OBI.r) * (0.5 + 0.5 * o.born) / 30, c = OBI.hit.cap;
  o.r = OBI.hit.r * u;
  o.cap = [c[0] * u, c[1] * u, c[2] * u, c[3] * u];
}
const obiUnit = o => (o.size || OBI.r) * (0.5 + 0.5 * o.born) / 30;
const obiQuick = o => (o.phase === 3 ? OBI.phase3.quick : o.phase === 2 ? OBI.phase2.quick : 1);
// Where his hands are in the arena (for the saber leaving and coming back, and the force).
const obiHand = (o, back = false) => {
  const u = obiUnit(o), f = o.face || 1;
  return back ? { x: o.x + f * 16 * u, y: o.y - 18 * u } : { x: o.x + f * 14 * u, y: o.y - 10 * u };
};

function renderObiBar() {
  const o = game.obi;
  if (!o) return;
  bossBar.hidden = false;
  bossBar.classList.remove('is-makora');
  bossBar.classList.add('is-obi');
  bossBar.classList.toggle('is-phase2', o.phase >= 2);
  bossFill.style.transform = `scaleX(${Math.max(0, o.hp) / o.maxHp})`;
  bossBar.setAttribute('aria-label', `${OBI.name} health`);
  bossBar.setAttribute('aria-valuenow', Math.max(0, Math.ceil(o.hp)));
  bossBar.setAttribute('aria-valuemax', o.maxHp);
  bossBar.querySelector('.boss-name').textContent = o.phase === 3 ? `${OBI.name} · UNLEASHED` : o.phase === 2 ? `${OBI.name} · THE FORCE` : OBI.name;
  const sub = bossBar.querySelector('.boss-sub');
  if (sub) sub.hidden = true;
}

/* ---------- his moves ---------- */
// One frame of OBI ONE (combat.js calls this instead of the normal chase; game.player is whoever is nearest).
function moveObi(o, dt) {
  const p = game.player, dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1, toward = Math.atan2(dy, dx);
  const decay = Math.exp(-6 * dt), P2 = o.phase >= 2 ? OBI.phase2 : null, q = obiQuick(o);   // (phase 3 keeps phase 2's rules)
  o.kx *= decay; o.ky *= decay;
  o.t -= dt; o.anim += dt; o.cd -= dt; o.blockCd -= dt;
  let aim = toward;
  // Phase 2 on (user): stay inside his reach for 3–5 s and the force shoves you off (and debris rains down), whatever
  // he's doing; stay out of it for 3–5 s and he pulls you in, as soon as his hands are free.
  if (P2 && o.state !== 'pull' && o.state !== 'stun' && o.state !== 'focus' && o.state !== 'arrive') {
    if (o.pushAt == null) o.pushAt = between(P2.pushAfter);
    if (o.pullAt == null) o.pullAt = between(P2.pullAfter);
    if (d < P2.melee) {
      o.farT = 0; o.closeT = (o.closeT || 0) + dt;
      if (o.closeT >= o.pushAt) { obiForcePush(o); o.closeT = 0; o.pushAt = between(P2.pushAfter); }
    } else {
      o.closeT = 0; o.farT = (o.farT || 0) + dt;
      // (it cuts in on a throw's wind-up, or while his saber is in the air: his other hand is free)
      if (o.farT >= o.pullAt && ['walk', 'rest', 'throwwind', 'thrown'].includes(o.state)) { o.th = null; startPull(o, ownerId()); o.farT = 0; o.pullAt = between(P2.pullAfter); }
    }
  }
  if (o.state === 'arrive') {                                // walks in, then opens with a throw (user)
    o.vx = o.kx; o.vy = o.ky;
    if (o.t <= 0) startThrow(o, OBI.intro.tele);
  } else if (o.state === 'walk') {
    const speed = OBI.walk * (P2 ? P2.walk : 1);
    const go = d > OBI.keep ? 1 : 0;
    o.vx = (dx / d) * speed * go + o.kx; o.vy = (dy / d) * speed * go + o.ky;
    o.step += dt * 9 * (go || 0.3);
    if (P2) {                                                // phase 2 on: out of reach he throws; up close, a fixed rotation (user)
      if (o.cd <= 0) {
        if (d > P2.melee) startThrow(o, OBI.throw.tele * q);
        else {
          const move = P2.rotation[(o.rot || 0) % P2.rotation.length]; o.rot = (o.rot || 0) + 1;
          if (move === 'smallSlash') startSlice(o, P2.smallSlash.tele * q, 1, P2.smallSlash);
          else if (move === 'bigSlash') startSlice(o, P2.bigSlash.tele * q, 1, P2.bigSlash);
          else startDash(o, P2.stabDash);
        }
      }
    } else if (o.cd <= 0) {
      if (o.blockCd <= 0 && Math.random() < OBI.block.chance) startBlock(o);
      else if (d < OBI.slice.at) startSlice(o, OBI.slice.tele * q, 1);
      else if (d < OBI.dash.at) startDash(o);
      else startThrow(o, OBI.throw.tele * q);
    }
  } else if (o.state === 'slice') {                          // the warning cone, then the cut (a little lunge with it)
    const s = o.sl, S = s.spec || OBI.slice;
    s.t += dt;
    aim = s.a;
    o.vx = o.kx * 0.3; o.vy = o.ky * 0.3;
    if (!s.struck && s.t >= s.tele) { s.struck = true; obiStrike(o, s); o.kx += Math.cos(s.a) * S.lunge; o.ky += Math.sin(s.a) * S.lunge; }
    if (s.struck && s.t >= s.tele + S.anim) {
      if (s.n > 1) { o.sl = { t: 0, tele: S.tele * q * 0.7, a: toward, struck: false, n: s.n - 1, dir: -s.dir, spec: S }; }   // phase 1's backswing
      else { o.sl = null; obiRest(o); }
    }
  } else if (o.state === 'dashwind') {                       // crouched, saber drawn back; the line shows where he'll go
    const D = o.dashSpec || OBI.dash;
    o.vx = o.kx; o.vy = o.ky;
    if (o.t > D.tele * q * 0.25) o.dir = toward;             // it locks just before he goes
    aim = o.dir;
    if (o.t <= 0) { o.state = 'dash'; o.t = D.time; SFX.bullDash(); }
  } else if (o.state === 'dash') {
    const D = o.dashSpec || OBI.dash;
    aim = o.dir;
    o.vx = Math.cos(o.dir) * D.speed; o.vy = Math.sin(o.dir) * D.speed;
    o.step += dt * 28;
    if (!reducedMotion && Math.random() < 0.8) game.particles.push({ x: o.x, y: o.y + o.r, vx: -o.vx * 0.12, vy: -25 * Math.random(), life: 0.3, color: COL.rock });
    if (o.t <= 0 || d < D.stopAt) startSlice(o, D.sliceTele, 1, D.stab);   // … and slices (or, mid-phase 2, stabs) as he arrives
  } else if (o.state === 'throwwind') {                      // arm back, the other pointing: the lane shows (user: an indicator)
    const th = o.th;
    th.t += dt;
    o.vx = o.kx; o.vy = o.ky;
    if (!th.locked) { th.a = toward; th.L = throwLength(o, th.a); if (th.t >= th.tele * OBI.throw.lock) th.locked = true; }
    aim = th.a;
    if (th.t >= th.tele) throwSaber(o);
  } else if (o.state === 'thrown') {                         // hand out, waiting for it to come back (updateSabers catches it)
    o.vx = o.kx * 0.5; o.vy = o.ky * 0.5;
    const sb = game.sabers[0];
    aim = sb ? Math.atan2(sb.y - o.y, sb.x - o.x) : toward;
    if (!sb) obiCatch(o);                                    // (it's gone: he has it back)
  } else if (o.state === 'block') {                          // planted, the saber twirling in front of him
    o.vx = o.kx * 0.3; o.vy = o.ky * 0.3;
    if (o.t <= 0) obiRest(o);
  } else if (o.state === 'focus') {                          // phase 2 starts: can't be hurt, the force pushes you back
    o.vx = o.kx; o.vy = o.ky;
    if (!reducedMotion && Math.random() < dt * 30) {
      const a = Math.random() * TAU;
      game.particles.push({ x: o.x + Math.cos(a) * 60, y: o.y + Math.sin(a) * 60, vx: -Math.cos(a) * 120, vy: -Math.sin(a) * 120, life: 0.45, color: COL.saber });
    }
    if (o.t <= 0) { o.state = 'walk'; o.cd = 0.6; o.blockCd = 3; o.closeT = o.farT = 0; }
  } else if (o.state === 'pull') {
    aim = pullStep(o, dt) ?? toward;
  } else if (o.state === 'stun') {                           // you broke free: he staggers
    o.vx = o.kx; o.vy = o.ky;
    if (o.t <= 0) obiRest(o);
  } else {                                                   // rest
    o.vx = o.kx * 0.5; o.vy = o.ky * 0.5;
    if (o.t <= 0) { o.state = 'walk'; o.cd = between(OBI.cd) * q; }
  }
  o.aim = aim;
  if (Math.abs(Math.cos(aim)) > 0.08) o.face = Math.cos(aim) < 0 ? -1 : 1;
  o.dmg = o.state === 'dash' ? OBI.dashDmg : OBI.dmg;
  o.x += o.vx * dt; o.y += o.vy * dt;
}
function obiRest(o) { o.state = 'rest'; o.t = OBI.rest * obiQuick(o); }

function startSlice(o, tele, n, spec = OBI.slice) {
  const p = game.player;
  o.state = 'slice';
  o.sl = { t: 0, tele, a: Math.atan2(p.y - o.y, p.x - o.x), struck: false, n, dir: 1, spec };
  o.cd = 0;
}
// The cut: everyone inside the cone is hit.
function obiStrike(o, s) {
  SFX.saberSwing();
  game.shake = Math.max(game.shake, 0.08);
  const S = s.spec || OBI.slice;
  eachLiving(() => {
    const p = game.player, dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    let diff = Math.atan2(dy, dx) - s.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (d > S.range + PLAYER.r || Math.abs(diff) > S.arc / 2 + Math.atan2(PLAYER.r, Math.max(d, 1))) return;
    if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
    p.flash = 0.25;
    hurtPlayer(S.dmg);
  });
}

function startDash(o, spec = OBI.dash) {
  const p = game.player;
  o.state = 'dashwind'; o.t = spec.tele * obiQuick(o); o.dashSpec = spec;
  o.dir = Math.atan2(p.y - o.y, p.x - o.x);
  SFX.saberHum();
}
// The force shoves you off (phase 2 on, user): stay inside his reach for 3–5 s and this fires, whatever he's doing.
function obiForcePush(o) {
  const p = game.player, dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1, push = OBI.phase2.push;
  p.kx = (p.kx || 0) + (dx / d) * push; p.ky = (p.ky || 0) + (dy / d) * push;
  debrisRain();                                              // … and the debris comes down all over the arena (user)
  if (game.shield > 0 || game.dash) game.shieldHit = 0.15; else p.flash = 0.2;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 90, life: 0.4, color: COL.saberBad });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 20, text: 'FORCE PUSH!', color: COL.saberBad, life: 0.9, vy: -34, big: true });
  game.shake = Math.max(game.shake, 0.16);
  SFX.forcePush();
}

function startBlock(o) {
  o.state = 'block';
  o.t = OBI.block.time;
  o.blockCd = between(OBI.block.every);
  o.blocked = 0;
  SFX.saberHum();
  game.floaters.push({ x: o.x, y: o.y - o.r * 2.4, text: 'BLOCKING', color: COL.saber, life: 0.9, vy: -30, big: true });
}
// Anything that hits him (combat.js hitEnemy asks first). While he blocks, the shot is knocked back at whoever fired
// it (true: it did him no harm). He can't be hurt as he arrives, or while phase 2 starts.
function obiGuard(o, pr) {
  if (o.intro || o.state === 'focus' || o.state === 'arrive') return true;
  if (o.state !== 'block') return false;
  const B = OBI.block.bolt;
  if (o.anim - o.boltAt >= B.every && game.bolts.length < B.max) {
    o.boltAt = o.anim;
    const h = obiHand(o), p = game.player, a = Math.atan2(p.y - h.y, p.x - h.x) + (Math.random() - 0.5) * 0.25;
    game.bolts.push({ x: h.x, y: h.y, vx: Math.cos(a) * B.speed, vy: Math.sin(a) * B.speed, r: B.r, t: 0, card: pr.card || 'bullet' });
    SFX.saberClash();
    burst(h.x, h.y, COL.saber, 5, 200);
  }
  if (!o.blocked++) game.floaters.push({ x: o.x, y: o.y - o.r * 2.4, text: 'DEFLECTED!', color: COL.saber, life: 0.7, vy: -40, big: false });
  return true;
}

/* ---------- the thrown saber ---------- */
function startThrow(o, tele) {
  const p = game.player, a = Math.atan2(p.y - o.y, p.x - o.x);
  o.state = 'throwwind';
  o.th = { t: 0, tele, a, L: throwLength(o, a), locked: false };
  o.dodgedBy = null;
  SFX.saberHum();
}
// How far it flies out: its range, or to the arena's edge.
const throwLength = (o, a) => Math.min(OBI.throw.range, edgeDist(o.x, o.y, a) - 8);
function throwSaber(o) {
  const th = o.th, T = OBI.throw, h = obiHand(o);
  game.sabers = [{ x: h.x, y: h.y, vx: Math.cos(th.a) * T.speed, vy: Math.sin(th.a) * T.speed, spin: 0, back: false, flown: 0, L: Math.max(120, th.L), t: 0, hitIds: [] }];
  o.state = 'thrown'; o.th = null;
  SFX.saberThrow();
}
// It flies out down its lane, turns, and homes back into his hand. It hits each player once each way.
function updateSabers(dt) {
  const o = game.obi;
  if (!o || o.dead) { game.sabers = []; return; }
  for (let i = game.sabers.length - 1; i >= 0; i--) {
    const s = game.sabers[i], T = OBI.throw;
    s.t += dt; s.spin += dt * T.spin;
    if (!s.back) {
      if (o.phase >= 2) {                     // it curves in on you as it flies (user): dodge it
        const p = game.player, dx = p.x - s.x, dy = p.y - s.y, sp = Math.hypot(s.vx, s.vy);
        const cur = Math.atan2(s.vy, s.vx), want = Math.atan2(dy, dx), turn = OBI.phase2.throwTurn * dt;
        const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), na = cur + Math.max(-turn, Math.min(turn, diff));
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.flown += Math.hypot(s.vx, s.vy) * dt;
      if (s.flown >= s.L) { s.back = true; s.hitIds = []; SFX.saberThrow(); }
    } else {
      const h = obiHand(o), dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy) || 1, v = T.back * Math.min(1.6, 0.6 + s.t * 0.5);
      if (d < T.catch || d < v * dt) { game.sabers.splice(i, 1); obiCatch(o); continue; }
      s.vx = dx / d * v; s.vy = dy / d * v;
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    if (!reducedMotion && Math.random() < 0.6) game.particles.push({ x: s.x, y: s.y, vx: -s.vx * 0.08, vy: -s.vy * 0.08, life: 0.22, color: COL.saber });
    eachLiving(c => {
      const p = game.player, who = ownerId();
      if (s.hitIds.includes(who) || Math.hypot(p.x - s.x, p.y - s.y) > T.r + PLAYER.r) return;
      s.hitIds.push(who);
      if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
      p.flash = 0.25;
      const a = Math.atan2(s.vy, s.vx);
      p.kx = (p.kx || 0) + Math.cos(a) * 260; p.ky = (p.ky || 0) + Math.sin(a) * 260;
      hurtPlayer(T.dmg);
    });
  }
}
// The force push's debris (user: all over the arena, so you dodge through the gaps): red circles warn where each
// rock will land while it falls, glowing with the force, then it hits.
function debrisRain() {
  if (game.debris.length > 40) return;                       // (one rain at a time)
  const S = OBI.storm, h = Math.min(playH || H, H);
  for (let y = S.cell / 2; y < h; y += S.cell) for (let x = S.cell / 2; x < W; x += S.cell) {
    if (Math.random() > S.fill) continue;
    const jx = x + (Math.random() - 0.5) * S.cell * 0.5, jy = y + (Math.random() - 0.5) * S.cell * 0.5;
    game.debris.push({ x: Math.max(20, Math.min(W - 20, jx)), y: Math.max(20, Math.min(h - 20, jy)), t: 0, warn: S.warn + Math.random() * S.stagger,
      r: S.r, dmg: S.dmg, hit: false, seed: Math.floor(Math.random() * 1000) });
  }
  SFX.forceHum(2);
}
function updateDebris(dt) {
  for (let i = game.debris.length - 1; i >= 0; i--) {
    const k = game.debris[i];
    k.t += dt;
    if (!k.hit && k.t >= k.warn) {
      k.hit = true;
      game.shake = Math.max(game.shake, 0.1);
      burst(k.x, k.y, COL.rock, 18, 240);
      let p = game.player;
      if (NET.run) { const c = living().find(c => Math.hypot(k.x - c.body.x, k.y - c.body.y) < k.r); if (c) usePlayer(c); p = c ? c.body : null; }
      if (p && Math.hypot(k.x - p.x, k.y - p.y) < k.r + PLAYER.r) {
        if (game.shield > 0 || game.dash) game.shieldHit = 0.15;
        else { p.flash = 0.25; hurtPlayer(k.dmg); }
      }
    }
    if (k.t >= k.warn + 0.4) game.debris.splice(i, 1);
  }
}
// Red circles warn where the debris will land, then a burst when it does (draw.js).
function drawDebris() {
  for (const k of game.debris) {
    const q = Math.min(1, k.t / k.warn);
    if (!k.hit) {
      ctx.globalAlpha = (0.15 + 0.25 * q) * (reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(k.t * 14));
      ctx.fillStyle = COL.bad; circle(k.x, k.y, k.r * (0.3 + 0.7 * q));
      ctx.globalAlpha = 0.6; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, TAU); ctx.stroke();
      if (q > 0.35) {                                         // the rock itself, dropping in with the force round it
        const f = (q - 0.35) / 0.65, y = k.y - (1 - f * f) * 260, rr = k.r * 0.55;
        ctx.globalAlpha = 1; forceGlow(k.x, y, rr * 1.6, 0.35);
        drawRockBody(k.x, y, rr, k.t * 3, 0, k.seed || 7);
      }
    } else {
      const f = Math.max(0, 1 - (k.t - k.warn) / 0.4);
      ctx.globalAlpha = 0.5 * f; ctx.fillStyle = COL.rock; circle(k.x, k.y, k.r * (1 + (1 - f) * 0.3));
    }
  }
  ctx.globalAlpha = 1;
}
// How far the nearest living player is (without switching whose turn it is).
function nearestGap(x, y) {
  if (!NET.run) return Math.hypot(game.player.x - x, game.player.y - y);
  let best = Infinity;
  for (const c of living()) best = Math.min(best, Math.hypot(c.body.x - x, c.body.y - y));
  return best;
}
function obiCatch(o) {
  const h = obiHand(o);
  game.rings.push({ x: h.x, y: h.y, r: 4, max: 34, life: 0.3, color: COL.saber });
  SFX.saberCatch();
  if (o.intro) { o.intro = false; showObiName(); }
  if (o.state === 'pull') return;                            // he caught it mid-pull: the pull carries on
  o.dodgedBy = null;
  // phase 2 on, and you're still out of his reach: a long dash straight at you (user: longer dashes to you)
  if (o.phase >= 2 && nearestGap(o.x, o.y) > OBI.phase2.melee) { startDash(o, OBI.phase2.lunge); return; }
  obiRest(o);
}

// What your shots turn into when he blocks: they fly back at you (dodge them).
function updateBolts(dt) {
  const B = OBI.block.bolt;
  for (let i = game.bolts.length - 1; i >= 0; i--) {
    const b = game.bolts[i];
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.t > B.life || b.x < -30 || b.y < -30 || b.x > W + 30 || b.y > H + 30) { game.bolts.splice(i, 1); continue; }
    let hit = false;
    eachLiving(() => {
      const p = game.player;
      if (hit || Math.hypot(p.x - b.x, p.y - b.y) > b.r + PLAYER.r) return;
      hit = true;
      burst(b.x, b.y, COL[b.card] || COL.saber, 6, 160);
      if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
      p.flash = 0.2;
      hurtPlayer(B.dmg);
    });
    if (hit) game.bolts.splice(i, 1);
  }
}

/* ---------- phases 2 and 3 ---------- */
// A phase's HP has run out (combat.js asks before killing him): he doesn't fall, he calls on the force (phase 2), or
// brings the arena down round you (phase 3). True if he did.
function obiNextPhase(o) {
  if (o.phase >= 3) return false;
  const next = o.phase + 1, P = next === 3 ? OBI.phase3 : OBI.phase2, hp = Math.round(P.hp * coopBossHp());
  Object.assign(o, { phase: next, hp, maxHp: hp, dead: false, state: 'focus', t: P.focus, sl: null, th: null, pull: null, dodgedBy: null, kx: 0, ky: 0,
    closeT: 0, farT: 0, pushAt: null, pullAt: null, hurlT: 2.5, refillT: 3 });
  game.sabers = []; game.bolts = [];                         // (a saber in the air is back in his hand)
  eachLiving(() => {                                         // the force shoves everyone back
    const q = game.player, dx = q.x - o.x, dy = q.y - o.y, d = Math.hypot(dx, dy) || 1;
    q.kx = (q.kx || 0) + dx / d * P.push; q.ky = (q.ky || 0) + dy / d * P.push;
  });
  game.rings.push({ x: o.x, y: o.y, r: o.r, max: Math.max(W, H) * 0.6, life: 0.7, color: COL.saber });
  game.shake = Math.max(game.shake, 0.5);
  game.hitstop = Math.max(game.hitstop || 0, 0.12);
  SFX.forcePush();
  if (next === 3) {                                          // phase 3: the rocks come down (they stay)
    toast(`PHASE 3 · ${OBI.name} BRINGS THE ARENA DOWN`, 'obi');
    for (let k = 0; k < OBI.phase3.rocks; k++) dropBoulder(0.4 + k * 0.18);
  } else toast(`PHASE 2 · ${OBI.name} USES THE FORCE`, 'obi');
  renderObiBar();
  return true;
}

// Phase 3's rocks (user): they fall (a shadow warns where, and it hurts to be under one), then lie on the arena,
// held by the force (you can walk through them). Every few seconds he lifts one and hurls it at you down a lane.
function dropBoulder(delay = 0) {
  const P = OBI.phase3, h = Math.min(playH || H, H), o = game.obi;
  let best = null;
  for (let i = 0; i < 14; i++) {                             // somewhere clear of the others, of him, and of you
    const x = 50 + Math.random() * (W - 100), y = 50 + Math.random() * (h - 100);
    let gap = Math.min(Math.hypot(x - game.player.x, y - game.player.y), o ? Math.hypot(x - o.x, y - o.y) : Infinity);
    for (const b of game.boulders) gap = Math.min(gap, Math.hypot(x - b.x, y - b.y));
    if (!best || gap > best.gap) best = { x, y, gap };
    if (gap > P.gap) break;
  }
  game.boulders.push({ x: best.x, y: best.y, r: P.r, state: 'fall', t: -delay, seed: Math.floor(Math.random() * 1000), spin: Math.random() * TAU, hitIds: [] });
}
function updateBoulders(dt) {
  const o = game.obi, P = OBI.phase3, H3 = P.hurl;
  if (!o || o.phase < 3) { if (!o) game.boulders = []; return; }
  if (o.state !== 'focus') {
    o.hurlT -= dt; o.refillT -= dt;
    const resting = game.boulders.filter(b => b.state === 'rest'), standing = game.boulders.filter(b => b.state === 'rest' || b.state === 'fall');
    if (o.hurlT <= 0 && resting.length && !game.boulders.some(b => b.state === 'lift')) {
      o.hurlT = between(H3.every);
      const b = resting[Math.floor(Math.random() * resting.length)];
      Object.assign(b, { state: 'lift', t: 0, a: Math.atan2(game.player.y - b.y, game.player.x - b.x), locked: false, hitIds: [] });
      SFX.forceHum(2);
    }
    if (o.refillT <= 0 && standing.length < P.rocks) { o.refillT = between(P.refill); dropBoulder(); }
  }
  for (let i = game.boulders.length - 1; i >= 0; i--) {
    const b = game.boulders[i];
    b.t += dt;
    if (b.state === 'fall') {
      if (b.t >= P.fall) {                                     // it lands: a crash, and whoever is under it is hurt
        b.state = 'rest'; b.t = 0;
        game.shake = Math.max(game.shake, 0.14);
        burst(b.x, b.y, COL.rock, 16, 220);
        groundBreak(b.x, b.y + b.r * 0.4, 20);
        SFX.stomp(2);
        eachLiving(() => {
          const p = game.player;
          if (Math.hypot(p.x - b.x, p.y - b.y) > b.r + PLAYER.r) return;
          if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
          p.flash = 0.25; hurtPlayer(P.fallDmg);
        });
      }
    } else if (b.state === 'lift') {                          // raised by the force, shaking, aiming at you
      if (!b.locked) {
        b.a = Math.atan2(game.player.y - b.y, game.player.x - b.x);
        if (b.t >= H3.lift * H3.lock) b.locked = true;
      }
      if (b.t >= H3.lift) { b.state = 'fly'; b.t = 0; b.vx = Math.cos(b.a) * H3.speed; b.vy = Math.sin(b.a) * H3.speed; SFX.kick(); game.shake = Math.max(game.shake, 0.12); }
    } else if (b.state === 'fly') {
      b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 9;
      if (!reducedMotion && Math.random() < 0.7) game.particles.push({ x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, life: 0.3, color: COL.saber });
      if (b.x < -b.r * 2 || b.y < -b.r * 2 || b.x > W + b.r * 2 || b.y > H + b.r * 2) { game.boulders.splice(i, 1); continue; }
      let hit = false;
      eachLiving(() => {
        const p = game.player, who = ownerId();
        if (hit || b.hitIds.includes(who) || Math.hypot(p.x - b.x, p.y - b.y) > b.r + PLAYER.r) return;
        b.hitIds.push(who); hit = true;
        if (game.shield > 0 || game.dash) { game.shieldHit = 0.15; return; }
        p.flash = 0.25;
        p.kx = (p.kx || 0) + Math.cos(b.a) * H3.knock; p.ky = (p.ky || 0) + Math.sin(b.a) * H3.knock;
        hurtPlayer(H3.dmg);
      });
      if (hit) { burst(b.x, b.y, COL.rock, 26, 280); game.shake = Math.max(game.shake, 0.25); SFX.stomp(2); game.boulders.splice(i, 1); }
    }
  }
}
// A soft blue glow: the force holding something.
function forceGlow(x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
  g.addColorStop(0, 'rgba(110, 200, 255, 0)'); g.addColorStop(0.6, `rgba(110, 200, 255, ${a})`); g.addColorStop(1, 'rgba(110, 200, 255, 0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
// Phase 3's rocks (draw.js): lying on the floor (`up` false), or up in the air: falling, lifted, flying (`up` true).
function drawBoulders(up) {
  const o = game.obi, now = performance.now() / 1000, still = reducedMotion;
  for (const b of game.boulders) {
    if (b.state === 'rest' && !up) {
      const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now * 3 + b.seed);
      forceGlow(b.x, b.y, b.r * 1.7, 0.1 + 0.1 * pulse);           // held by the force
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(b.x, b.y + b.r * 0.75, b.r * 0.95, b.r * 0.3); ctx.globalAlpha = 1;
      drawRockBody(b.x, b.y, b.r, b.spin, 0, b.seed);
      ctx.globalAlpha = 0.25 + 0.25 * pulse; ctx.strokeStyle = COL.saber; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, now * 1.5 + b.seed, now * 1.5 + b.seed + 1.2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (b.state === 'fall' && !up) {                        // its shadow, growing where it'll land
      const q = Math.max(0, Math.min(1, b.t / OBI.phase3.fall));
      ctx.globalAlpha = 0.15 + 0.35 * q; ctx.fillStyle = COL.bad; circle(b.x, b.y, b.r * (0.4 + 0.6 * q));
      ctx.globalAlpha = 0.6; ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (b.state === 'fall' && up && b.t > 0) {
      const q = Math.min(1, b.t / OBI.phase3.fall), y = b.y - (1 - q * q) * 320;
      forceGlow(b.x, y, b.r * 1.8, 0.3);
      drawRockBody(b.x, y, b.r, b.spin + b.t * 4, 0, b.seed);
    } else if (b.state === 'lift' && up) {                         // up it comes: shaking, glowing, the lane showing
      const q = Math.min(1, b.t / OBI.phase3.hurl.lift), jit = still ? 0 : (Math.random() - 0.5) * 3 * q, y = b.y - 22 * q;
      const L = Math.hypot(W, H), w = b.r * 2 + 6;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.08 + 0.14 * q; ctx.fillRect(b.r, -w / 2, L, w);
      ctx.globalAlpha = 0.35 + 0.45 * q; ctx.fillRect(b.r, -w / 2, L * q, 2); ctx.fillRect(b.r, w / 2 - 2, L * q, 2);
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(b.x, b.y + b.r * 0.75, b.r * (0.95 - 0.3 * q), b.r * 0.3); ctx.globalAlpha = 1;
      forceGlow(b.x + jit, y, b.r * (1.8 + 0.5 * q), 0.25 + 0.25 * q);
      drawRockBody(b.x + jit, y, b.r, b.spin, 0, b.seed);
      if (o) {                                                     // the force from his hand to it
        const h = obiHand(o, true);
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = COL.saber; ctx.lineCap = 'round';
        for (let j = 0; j < 2; j++) {
          ctx.globalAlpha = 0.18 + 0.12 * j; ctx.lineWidth = 2.5 - j;
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const f = i / 16, wv = Math.sin(f * 10 - now * 14 + j * 2) * 6 * Math.sin(f * Math.PI), dx = b.x - h.x, dy = y - h.y, l = Math.hypot(dx, dy) || 1;
            const x = h.x + dx * f - dy / l * wv, yy = h.y + dy * f + dx / l * wv;
            if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    } else if (b.state === 'fly' && up) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.strokeStyle = COL.saber; ctx.globalAlpha = 0.25; ctx.lineWidth = b.r * 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(a) * 70, b.y - Math.sin(a) * 70); ctx.stroke(); ctx.globalAlpha = 1;
      forceGlow(b.x, b.y, b.r * 2, 0.35);
      drawRockBody(b.x, b.y, b.r, b.spin, 0, b.seed);
    }
  }
}

// The force pull (phase 2, user): he raises his arm and drags you in while the screen shakes. Smash SPACE to fill the
// ring round you; full, you break free and he staggers. If you reach him first, he cuts you and lets go.
function startPull(o, id) {
  o.state = 'pull'; o.t = OBI.phase2.pull.max;
  o.pull = { id, fill: 0 };
  SFX.forceHum(3);
  const c = NET.run ? byId(id) : null, p = c ? c.body : game.player;
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 34, text: 'THE FORCE!', color: COL.saber, life: 1, vy: -20, big: true });
}
// One frame of it: returns his aim (at whoever he's pulling).
function pullStep(o, dt) {
  const P = OBI.phase2.pull, u = o.pull;
  o.vx = o.kx * 0.2; o.vy = o.ky * 0.2;
  const was = ACTIVE;
  if (NET.run) { const c = byId(u.id); if (!c || c.down) { u.id = null; } else usePlayer(c); }
  if (u.id == null || o.t <= 0) { o.pull = null; obiRest(o); usePlayer(was); return null; }
  const p = game.player, dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
  u.fill = Math.max(0, u.fill - P.decay * dt);
  if (!NET.run || ACTIVE === NET.me) game.shake = Math.max(game.shake, P.shake);   // your screen shakes (user; a guest's in coop.js)
  if (d < P.reach + o.r) {                                   // he got you: a cut, and you're thrown back
    o.pull = null; o.state = 'slice';
    o.sl = { t: OBI.slice.tele, tele: OBI.slice.tele, a: Math.atan2(-dy, -dx), struck: true, n: 1, dir: 1 };
    SFX.saberSwing();
    if (game.shield > 0 || game.dash) game.shieldHit = 0.15;
    else { p.flash = 0.3; p.kx = (p.kx || 0) - dx / d * P.knock; p.ky = (p.ky || 0) - dy / d * P.knock; hurtPlayer(P.dmg); }
    game.shake = Math.max(game.shake, 0.3);
  } else {
    const step = Math.min(d - P.reach - o.r + 1, P.speed * dt);
    p.x += dx / d * step; p.y += dy / d * step;
    clampTo(p, PLAYER.r);
    if (!reducedMotion && Math.random() < dt * 40) {
      const t = Math.random();
      game.particles.push({ x: p.x + dx * t, y: p.y + dy * t, vx: dx / d * 90, vy: dy / d * 90, life: 0.3, color: COL.saber });
    }
  }
  const a = Math.atan2(p.y - o.y, p.x - o.x);
  usePlayer(was);
  return a;
}
// Is this player (the active one) being pulled? Their own walking stops (combat.js playerStep).
const pulledNow = () => { const o = game.obi; return !!(o && o.pull && o.pull.id === ownerId()); };
// A press of SPACE (or a tap) while you're being pulled. True if it went to the pull (then it isn't a BULL charge).
function obiMash() {
  const o = game.obi;
  if (NET.guest && NET.run) {                                // the host counts it
    if (!o || !o.pull || o.pull.id !== NET.me.id) return false;
    NET.mashN = (NET.mashN || 0) + 1;
    SFX_RAW.pullPress();
    return true;
  }
  if (!o || !o.pull || o.pull.id !== ownerId()) return false;
  const P = OBI.phase2.pull, u = o.pull;
  u.fill += P.press;
  if (isLocal()) SFX.pullPress();
  if (u.fill >= 1) breakFree(o);
  return true;
}
function breakFree(o) {
  const P = OBI.phase2.pull, p = game.player;
  o.pull = null; o.state = 'stun'; o.t = P.stun;
  const a = Math.atan2(o.y - p.y, o.x - p.x);
  o.kx += Math.cos(a) * 380; o.ky += Math.sin(a) * 380;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 110, life: 0.45, color: COL.saber });
  burst(p.x, p.y, COL.saber, 24, 300);
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 30, text: 'BROKE FREE!', color: COL.saber, life: 1, vy: -34, big: true });
  game.shake = Math.max(game.shake, 0.25);
  SFX.forcePush();
}
// A tap on the arena while you're pulled counts as a press (touch screens).
function pullTap() { return obiMash(); }

/* ---------- beaten ---------- */
function obiDown(o) {
  game.obi = null; game.obiDone = true;
  game.sabers = []; game.bolts = []; game.debris = [];
  for (const b of game.boulders) burst(b.x, b.y, COL.rock, 10, 160);   // his rocks crumble
  game.boulders = [];
  bonusGold('OBI ONE', GOLD_BONUS.obi);
  bossBar.hidden = true; bossBar.classList.remove('is-obi', 'is-phase2');
  SFX.saberOff();
  game.shake = Math.max(game.shake, 0.5);
  burst(o.x, o.y, COL.saber, 60, 380);
  game.rings.push({ x: o.x, y: o.y, r: 10, max: 220, life: 0.7, color: COL.saber });
  game.orbs.push({ x: o.x, y: o.y, vx: 0, vy: 0, value: OBI.xp, r: 11, t: 0, born: 0 });
  if (NET.run) {                                             // co-op: everyone gets DEFLECT, and the fight goes on
    eachPlayer(() => { if (!game.relics.includes('deflect')) game.relics = [...game.relics, 'deflect']; game.deflCd = 0; renderRelics(); });
    toast(`EVERYONE GOT ${DEFLECT.name} · ${DEFLECT.key} TO DEFLECT`, 'obi');
    SFX.upgrade(4);
  } else if (!game.relics.includes('deflect')) {
    game.relics.push('deflect');
    game.deflCd = 0;
    renderRelics();
    SFX.upgrade(4);
    game.upQueue.unshift({ kind: 'relic', relic: 'deflect', level: game.level });   // its message, like BULL's
    if (!game.choosing) openNext();
  }
}

function resetObi() {
  game.obi = null; game.obiDue = false; game.obiDone = false; game.sabers = []; game.bolts = []; game.debris = []; game.boulders = [];
  game.defl = 0; game.deflCd = 0; game.deflAge = 9;
  bossBar.classList.remove('is-obi');
}

/* ---------- DEFLECT ---------- */
function tryDeflect() {
  if (NET.guest && NET.run) {                                // the host raises it
    if (NET.me.down || !game.relics.includes('deflect')) return;
    NET.deflN = (NET.deflN || 0) + 1;
    if (!(game.deflCd > 0)) SFX_RAW.deflectOn();
    return;
  }
  if (!game.relics.includes('deflect') || game.deflCd > 0 || game.inMenu || game.over || (game.paused && !NET.run) || game.choosing || game.intro || game.cine) return;
  if (NET.run && ACTIVE?.down) return;
  const p = game.player;
  game.defl = DEFLECT.time; game.deflAge = 0; game.deflCd = DEFLECT.cd;
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 20, life: 0.3, color: COL.saber });
  if (isLocal()) SFX.deflectOn();
  renderRelics();
}
// Its timers, for the active player (combat.js playerStep).
function deflectStep(dt) {
  game.deflAge = (game.deflAge ?? 9) + dt;
  if (game.defl > 0) { game.defl = Math.max(0, game.defl - dt); if (!game.defl) renderRelics(); }
  if (game.deflCd > 0) {
    game.deflCd = Math.max(0, game.deflCd - dt);
    const icon = isLocal() && relicsEl.querySelector('#relic-deflect');
    if (icon) icon.style.setProperty('--k', 1 - game.deflCd / DEFLECT.cd);
    if (game.deflCd === 0) {
      renderRelics();
      const p = game.player;
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 12, life: 0.3, color: COL.saber });
    }
  }
}
// A hit is about to land (combat.js hurtPlayer): the shield takes it instead. True if it did.
function deflectHit() {
  if (!(game.defl > 0)) return false;
  const p = game.player, perfect = game.deflAge <= DEFLECT.perfect;
  game.defl = 0;
  p.safe = Math.max(p.safe, DEFLECT.safe);
  if (perfect) game.deflCd = Math.max(0, game.deflCd - DEFLECT.cd / 2);   // a perfect deflect: half the cooldown back (user)
  for (const e of game.enemies) {                            // and a shove to whatever is close
    if (e.dummy || hitGap(e, p.x, p.y) > DEFLECT.push) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    const kr = e.boss ? BOSS.knockResist : e.makora ? MAKORA.knockResist : e.obi ? OBI.knockResist : e.mrock ? 0 : 1;
    e.kx += dx / d * DEFLECT.knock * kr; e.ky += dy / d * DEFLECT.knock * kr;
  }
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: perfect ? 120 : 70, life: 0.4, color: COL.saber });
  if (perfect) game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 60, life: 0.3, color: COL.player });
  burst(p.x, p.y, COL.saber, perfect ? 26 : 14, perfect ? 320 : 220);
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 14, text: perfect ? 'PERFECT DEFLECT!' : 'DEFLECT!', color: perfect ? COL.wheelHi : COL.saber, life: 0.9, vy: -40, big: true });
  if (perfect) game.hitstop = Math.max(game.hitstop || 0, 0.06);
  game.shake = Math.max(game.shake, perfect ? 0.14 : 0.08);
  SFX.saberClash();
  if (perfect) SFX.upgrade(2);
  renderRelics();
  return true;
}

/* ---------- drawing (user: a Jedi like their sample; the body and the saber drawn apart so both can move) ----------
   Flat shapes, seen three-quarters from the front in a wide stance: a pale tan tunic crossed at the chest over a
   darker under-tunic, a brown belt, tan trousers into brown boots, auburn hair and beard. The lightsaber is its own
   piece: a silver hilt and a glowing blue blade, held in his front hand at whatever angle the move needs (or flying
   on its own when thrown). Local units: 30 = his size; feet at y ≈ 33; he faces +x. */
// A two-bone arm or leg: the middle joint for a hand (or foot) at (tx, ty), bending to one side.
function joint(ax, ay, tx, ty, l1, l2, bend) {
  const dx = tx - ax, dy = ty - ay, d = Math.min(l1 + l2 - 0.01, Math.max(0.01, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx), c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const b = a + Math.acos(c) * bend;
  return [ax + Math.cos(b) * l1, ay + Math.sin(b) * l1];
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpA = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
// His pose for this frame, from his state: where his hands are, the saber's angle (local, 0 = forward, −π/2 = up), lean …
function obiPose(o, la) {
  const st = o.state, t = o.anim || 0, still = reducedMotion;
  const ps = { lean: 0, crouch: 0, stride: 0, hand: [10, -4], sa: -1.1, back: [7.5, -2], saber: true, open: false, jit: 0 };
  const reach = (a, n = 17) => [8.5 + Math.cos(a) * n, -14 + Math.sin(a) * n];   // the front hand, out along a
  if (st === 'walk') { ps.stride = 1; }
  else if (st === 'rest') { ps.hand = [11, 3]; ps.sa = 0.75; ps.back = [-11, 1]; }
  else if (st === 'arrive') { ps.hand = [10, -6]; ps.sa = -1.3; ps.back = [7.5, -4]; }
  else if (st === 'slice' && o.sl) {
    const s = o.sl, S = OBI.slice, side = s.dir || 1;
    const local = o.face < 0 ? Math.PI - s.a : s.a;         // the cut's direction, in his own frame
    if (!s.struck) {                                         // raising it: back and up, both hands
      const q = Math.min(1, s.t / Math.max(0.01, s.tele)), up = local - side * 2.1;
      ps.hand = [lerp(10, 3, q), lerp(-4, -28, q)]; ps.sa = lerpA(-1.1, up, q); ps.back = [lerp(7.5, 0, q), lerp(-2, -25, q)];
      ps.lean = -0.08 * q; ps.crouch = 2 * q;
    } else {                                                 // the swing: through the whole arc, arm reaching out
      const q = Math.min(1, (s.t - s.tele) / S.anim), e = 1 - (1 - q) ** 3;
      ps.sa = local - side * (S.arc / 2 + 0.3) + side * (S.arc + 0.6) * e;
      ps.hand = reach(local - side * 0.6 + side * 1.2 * e, 16);
      ps.back = [-11, 2]; ps.lean = 0.2; ps.stride = 0.4;
    }
  } else if (st === 'dashwind') { ps.crouch = 4; ps.lean = 0.18; ps.hand = [-4, 3]; ps.sa = 2.7; ps.back = [13, -9]; ps.open = true; ps.jit = still ? 0 : 0.6; }
  else if (st === 'dash') { ps.lean = 0.34; ps.stride = 1.6; ps.hand = [-6, 1]; ps.sa = 2.95; ps.back = [15, -11]; ps.open = true; }
  else if (st === 'throwwind' && o.th) {                     // the saber back over his shoulder, the other hand pointing (the sample)
    const q = Math.min(1, o.th.t / Math.max(0.01, o.th.tele)), local = o.face < 0 ? Math.PI - o.th.a : o.th.a;
    ps.hand = [lerp(10, -5, q), lerp(-4, -27, q)]; ps.sa = lerpA(-1.1, -2.5 + (still ? 0 : Math.sin(t * 20) * 0.08 * q), q);
    ps.back = [-8.5 + Math.cos(local) * 17 * q + 16 * (1 - q), -14 + Math.sin(local) * 17 * q + 12 * (1 - q)]; ps.open = q > 0.5;
    ps.lean = -0.12 * q;
  } else if (st === 'thrown') {                              // empty-handed, the hand out to catch it
    const sb = game.sabers[0], a = sb ? Math.atan2(sb.y - o.y, sb.x - o.x) : 0, local = o.face < 0 ? Math.PI - a : a;
    ps.saber = false; ps.hand = reach(local, 17); ps.open = true; ps.back = [-11, 0]; ps.lean = 0.06;
  } else if (st === 'block') {                               // two-handed, the blade upright in front of him, twirling
    ps.hand = [11, -8]; ps.back = [9, -5]; ps.sa = -Math.PI / 2 + 0.3 + (still ? 0 : Math.sin(t * 16) * 0.55); ps.crouch = 2;
  } else if (st === 'focus') { ps.hand = [7, -9]; ps.back = [-12, -6]; ps.sa = -Math.PI / 2; ps.open = true; ps.jit = still ? 0 : 0.5; }
  else if (st === 'pull') {                                  // the saber lowered, the other arm raised at you (user)
    const local = o.face < 0 ? Math.PI - la : la;
    ps.hand = [10, 4]; ps.sa = 0.9; ps.back = [-8.5 + Math.cos(local) * 18 + 17, -14 + Math.sin(local) * 18]; ps.open = true; ps.lean = -0.06; ps.jit = still ? 0 : 0.4;
    ps.saber = !game.sabers.length;                          // (his saber may still be on its way back)
  } else if (st === 'stun') { ps.lean = -0.22; ps.hand = [13, 1]; ps.sa = 1.3; ps.back = [-13, -3]; ps.jit = still ? 0 : 0.8; }
  return ps;
}
// The lightsaber on its own: the hilt at (x, y) pointing along a (radians), in the current transform's units.
function drawSaber(x, y, a, len, glow = 1, bad = false) {
  const c = Math.cos(a), s = Math.sin(a), hx = x - c * 3.5, hy = y - s * 3.5, bx = x + c * 4.5, by = y + s * 4.5;
  const col = bad ? COL.saberBad : COL.saber, core = bad ? COL.saberBadCore : COL.saberCore;
  ctx.lineCap = 'round';
  if (len > 0) {
    const ex = bx + c * len, ey = by + s * len;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.22 * glow; ctx.lineWidth = 8.5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 0.55 * glow; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; ctx.strokeStyle = core; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COL.obiHilt; ctx.lineWidth = 3.2;                 // the hilt: silver, with a dark grip and emitter
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = COL.obiHiltDark; ctx.lineWidth = 3.4; ctx.lineCap = 'butt';
  for (const k of [0.3, 0.55]) { const px = hx + (bx - hx) * k, py = hy + (by - hy) * k; ctx.beginPath(); ctx.moveTo(px - c * 0.6, py - s * 0.6); ctx.lineTo(px + c * 0.6, py + s * 0.6); ctx.stroke(); }
  ctx.lineCap = 'round';
}
function drawObi(o) {
  const k = obiUnit(o), t = o.anim || 0, st = o.state, still = reducedMotion, face = o.face || 1;
  const la = o.aim ?? 0;
  // the warnings, on the floor under him (user: an indicator for the long-range ones)
  if (st === 'throwwind' && o.th) obiLane(o);
  if (st === 'dashwind') obiDashLine(o);
  if (st === 'slice' && o.sl) obiCut(o);
  if (o.phase >= 2 || st === 'focus') {                    // phase 2: a pale blue glow round him
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5), R = 44 * k * (1 + 0.1 * pulse);
    const g = ctx.createRadialGradient(o.x, o.y - 6 * k, 6 * k, o.x, o.y - 6 * k, R);
    g.addColorStop(0, 'rgba(110, 200, 255, 0)'); g.addColorStop(0.6, `rgba(110, 200, 255, ${0.1 + 0.1 * pulse + (st === 'focus' ? 0.15 : 0)})`); g.addColorStop(1, 'rgba(110, 200, 255, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y - 6 * k, R, 0, TAU); ctx.fill();
  }
  if (st === 'pull' && o.pull) obiForce(o);

  const ps = obiPose(o, la);
  const white = o.hit > 0, tint = c => (white ? COL.player : o.chill > 0 ? chilled(c) : c);
  const robe = tint(COL.obiRobe), robeDk = tint(COL.obiRobeDark), under = tint(COL.obiUnder), belt = tint(COL.obiBelt);
  const boot = tint(COL.obiBoot), skin = tint(COL.obiSkin), hair = tint(COL.obiHair);
  const jit = ps.jit ? (Math.random() - 0.5) * ps.jit * 3 : 0;
  ctx.save();
  ctx.translate(o.x + jit, o.y); ctx.scale(face * k, k);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ellipse(0, 33, 17, 4.5); ctx.globalAlpha = 1;   // shadow
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // legs: a wide stance (the sample), walking or planted
  const sw = ps.stride && !still ? Math.sin(o.step || 0) : 0, lift = ps.stride && !still ? Math.cos(o.step || 0) : 0;
  const hip = 8 + ps.crouch;
  const leg = (hx, fx, fy, bend) => {
    const [kx, ky] = joint(hx, hip, fx, fy, 13, 13, bend);
    ctx.strokeStyle = robeDk; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.moveTo(hx, hip); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.strokeStyle = boot; ctx.lineWidth = 6.8;                       // boots up to the knee
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fx - 1, fy); ctx.lineTo(fx + 3.5, fy + 0.5); ctx.stroke();   // the foot
  };
  leg(-4, -11 - sw * 4 * ps.stride, 32 - Math.max(0, -lift) * 3 * ps.stride, 1);
  leg(4, 11 + sw * 4 * ps.stride, 32 - Math.max(0, lift) * 3 * ps.stride, -1);

  ctx.save();                                                          // everything above the hips leans
  ctx.translate(0, hip); ctx.rotate(ps.lean); ctx.translate(0, -hip);
  const cy = ps.crouch;
  const SH = [[-8.5, -14 + cy], [8.5, -14 + cy]];                      // shoulders: back, front
  const arm = (sx, sy, tx, ty, bend, open) => {                        // a wide Jedi sleeve and a hand
    const [ex, ey] = joint(sx, sy, tx, ty, 9, 9.5, bend);
    ctx.strokeStyle = robe; ctx.lineWidth = 5.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 6.6; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx - (tx - ex) * 0.25, ty - (ty - ey) * 0.25); ctx.stroke();
    ctx.strokeStyle = robeDk; ctx.lineWidth = 1.2;                     // the sleeve's cuff
    const cxp = tx - (tx - ex) * 0.25, cyp = ty - (ty - ey) * 0.25, na = Math.atan2(ty - ey, tx - ex) + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cxp + Math.cos(na) * 3.2, cyp + Math.sin(na) * 3.2); ctx.lineTo(cxp - Math.cos(na) * 3.2, cyp - Math.sin(na) * 3.2); ctx.stroke();
    ctx.fillStyle = skin; circle(tx, ty, open ? 2.8 : 2.5);
  };
  const bk = [ps.back[0], ps.back[1] + cy], fr = [ps.hand[0], ps.hand[1] + cy];
  arm(SH[0][0], SH[0][1], bk[0], bk[1], 1, ps.open);                   // the far arm, behind the body

  // the tunic's skirt, then the body
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-9, 3 + cy); ctx.lineTo(9, 3 + cy); ctx.lineTo(13.5, 20 + cy * 0.5); ctx.quadraticCurveTo(0, 22.5 + cy * 0.5, -13.5, 20 + cy * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = robeDk; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(2, 4 + cy); ctx.lineTo(5, 21 + cy * 0.5); ctx.stroke();   // where the tunic overlaps
  ctx.fillStyle = robe;
  ctx.beginPath(); ctx.moveTo(-9, 4 + cy); ctx.lineTo(-10.5, -13 + cy); ctx.quadraticCurveTo(0, -18.5 + cy, 10.5, -13 + cy); ctx.lineTo(9, 4 + cy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = under;                                               // the crossed front (a V), over a darker under-tunic
  ctx.beginPath(); ctx.moveTo(-4.5, -16.5 + cy); ctx.lineTo(1.5, 1 + cy); ctx.lineTo(6, -16.5 + cy); ctx.lineTo(3, -16.8 + cy); ctx.lineTo(1.2, -9 + cy); ctx.lineTo(-1.5, -16.8 + cy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = robeDk; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-4.5, -16.5 + cy); ctx.lineTo(1.5, 1 + cy); ctx.lineTo(6, -16.5 + cy); ctx.stroke();
  ctx.fillStyle = belt; ctx.fillRect(-9.6, 0.5 + cy, 19.2, 4.4);        // the belt, with a buckle
  ctx.fillStyle = tint(COL.obiHilt); ctx.fillRect(0, 1.3 + cy, 3.2, 2.8);

  // the head: auburn hair swept back, a beard, looking the way he faces
  ctx.fillStyle = skin; ctx.fillRect(-2.2, -19.5 + cy, 4.6, 4);        // neck
  const hy = -26.5 + cy;
  circle(1.5, hy, 7.2);
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.moveTo(-6, hy + 3); ctx.quadraticCurveTo(-7.5, hy - 7, 0.5, hy - 8.6); ctx.quadraticCurveTo(8, hy - 8.6, 8.8, hy - 2.6);
  ctx.quadraticCurveTo(5, hy - 5.4, 1, hy - 4.2); ctx.quadraticCurveTo(-2, hy - 1, -2.8, hy + 4.2); ctx.closePath(); ctx.fill();   // the hair
  ctx.beginPath(); ctx.moveTo(-2.2, hy + 1.6); ctx.quadraticCurveTo(-1.8, hy + 8.8, 3.5, hy + 8.6); ctx.quadraticCurveTo(8.2, hy + 7.4, 8.6, hy + 1.2);
  ctx.quadraticCurveTo(6, hy + 3.2, 3.8, hy + 3); ctx.quadraticCurveTo(0.6, hy + 3.6, -2.2, hy + 1.6); ctx.closePath(); ctx.fill();   // the beard
  ctx.strokeStyle = hair; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(2.4, hy + 2.6); ctx.quadraticCurveTo(5, hy + 1.4, 7.6, hy + 2.4); ctx.stroke();   // moustache
  ctx.fillStyle = COL.obiEye;
  circle(2.3, hy - 1.2, 0.95); circle(6.3, hy - 1.2, 0.95);                                                     // eyes
  ctx.strokeStyle = hair; ctx.lineWidth = 1;
  const frown = st === 'focus' || st === 'pull' || o.phase >= 2 ? 0.8 : 0;
  ctx.beginPath(); ctx.moveTo(1, hy - 3 - frown * 0.2); ctx.lineTo(3.6, hy - 3 + frown); ctx.moveTo(5, hy - 3 + frown); ctx.lineTo(7.6, hy - 3.2 - frown * 0.2); ctx.stroke();   // brows

  // the near arm and the saber in its hand (the saber is its own piece, so it can swing, twirl or fly)
  if (ps.saber) {
    const glow = st === 'block' && !still ? 0.9 + 0.3 * Math.sin(t * 30) : 1;
    drawSaber(fr[0], fr[1], ps.sa, 36, glow, o.phase >= 2);
  }
  arm(SH[1][0], SH[1][1], fr[0], fr[1], -1, ps.open && !ps.saber);
  ctx.restore();
  if (st === 'block') {                                                // the guard: a shimmer in front of him
    const fl = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 22);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COL.saber; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.25 + 0.25 * fl;
    ctx.beginPath(); ctx.arc(2, -8, 30, -1.35, 1.35); ctx.stroke();
    ctx.globalAlpha = 0.08 + 0.06 * fl; ctx.fillStyle = COL.saber;
    ctx.beginPath(); ctx.arc(2, -8, 30, -1.35, 1.35); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// The throw's lane: a band from him to where it turns, filling as he winds up, with chevrons pointing down it.
function obiLane(o) {
  const th = o.th, q = Math.min(1, th.t / th.tele), w = OBI.throw.r * 2 + 8, L = th.L;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(th.a);
  ctx.fillStyle = COL.bad;
  ctx.globalAlpha = 0.08 + 0.12 * q; ctx.fillRect(20, -w / 2, L - 20, w);
  ctx.globalAlpha = 0.35 + 0.4 * q; ctx.fillRect(20, -w / 2, (L - 20) * q, 2); ctx.fillRect(20, w / 2 - 2, (L - 20) * q, 2);
  ctx.globalAlpha = (0.4 + 0.5 * q) * (reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(th.t * 30));
  ctx.strokeStyle = COL.bad; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * ((L - 80) / 4);
    ctx.beginPath(); ctx.moveTo(x - 7, -8); ctx.lineTo(x + 3, 0); ctx.lineTo(x - 7, 8); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(L, 0, OBI.throw.r, 0, TAU); ctx.stroke();   // where it turns and comes back
  ctx.restore(); ctx.globalAlpha = 1;
}
// The dash's line, like SKURTOSAURUS's charge (draw.js chargeAim).
function obiDashLine(o) {
  const D = o.dashSpec || OBI.dash, len = D.speed * D.time, blink = 0.35 + 0.35 * Math.sin(o.t * 30);
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.dir);
  ctx.fillStyle = COL.bad; ctx.globalAlpha = 0.12; ctx.fillRect(0, -o.r * 1.1, len, o.r * 2.2);
  ctx.globalAlpha = 0.3 + blink; ctx.strokeStyle = COL.bad; ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.setLineDash([16, 11]);
  ctx.beginPath(); ctx.moveTo(o.r, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(len - 12, -12); ctx.lineTo(len, 0); ctx.lineTo(len - 12, 12); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}
// A slice: the red cone as he raises it (makora.js warnCone), then a blue crescent as it cuts.
function obiCut(o) {
  const s = o.sl, S = s.spec || OBI.slice, bad = o.phase >= 2;
  ctx.save(); ctx.translate(o.x, o.y - 6 * obiUnit(o)); ctx.rotate(s.a);
  if (!s.struck) warnCone(S.arc, S.range, Math.min(1, s.t / Math.max(0.01, s.tele)));
  else {
    const q = Math.min(1, (s.t - s.tele) / S.anim), side = s.dir || 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 * (1 - q); ctx.fillStyle = bad ? COL.saberBad : COL.saber;
    const a0 = -S.arc / 2, a1 = a0 + S.arc * Math.min(1, q * 2.4);
    if (side > 0) crescent(0, S.range * 0.78, a0, a1, 14); else crescent(0, S.range * 0.78, -a1, -a0, 14);
    ctx.globalAlpha = 0.9 * (1 - q); ctx.fillStyle = bad ? COL.saberBadCore : COL.saberCore;
    if (side > 0) crescent(0, S.range * 0.78, a0, a1, 4); else crescent(0, S.range * 0.78, -a1, -a0, 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
// The force: rippling lines from his raised hand to whoever he's pulling.
function obiForce(o) {
  const b = pulledBody(o.pull.id);
  if (!b) return;
  const h = obiHand(o, true), dx = b.x - h.x, dy = b.y - h.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const t = o.anim || 0;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COL.saber; ctx.lineCap = 'round';
  for (let j = 0; j < 3; j++) {
    ctx.globalAlpha = 0.18 + 0.1 * j; ctx.lineWidth = 3 - j * 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const f = i / 24, w = Math.sin(f * 14 - t * 16 + j * 2) * 7 * Math.sin(f * Math.PI);
      const x = h.x + dx * f + nx * w, y = h.y + dy * f + ny * w;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function pulledBody(id) {
  if (!NET.run || id === NET.me?.id) return game.player;
  if (NET.host) { const c = byId(id); return c ? { x: c.dx ?? c.body.x, y: c.dy ?? c.body.y } : null; }
  return (NET.view || []).find(v => v.id === id) || null;
}
// The thrown saber (spinning, with a blur) and the shots he knocked back; drawn over the enemies (draw.js).
function drawObiShots() {
  const bad = game.obi && game.obi.phase >= 2;
  for (const s of game.sabers) {
    ctx.save(); ctx.translate(s.x, s.y);
    ctx.globalAlpha = 0.1; ctx.fillStyle = bad ? COL.saberBad : COL.saber; circle(0, 0, 26);
    for (let g = 2; g >= 0; g--) {                                     // afterimages of the last moment of spin
      ctx.save(); ctx.rotate(s.spin - g * 0.4);
      ctx.globalAlpha = g ? 0.25 / g : 1;
      if (g) {
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = bad ? COL.saberBad : COL.saber; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(22, 0); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      } else drawSaber(-8, 0, 0, 28, 1, bad);
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const b of game.bolts) {                                        // your shot, turned round: a bright dart in its colour
    const a = Math.atan2(b.vy, b.vx), col = COL[b.card] || COL.saber;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.globalAlpha = 0.3; ctx.fillStyle = col; ellipse(0, 0, b.r * 2.6, b.r * 1.5);
    ctx.globalAlpha = 1; ellipse(0, 0, b.r * 1.7, b.r * 0.85);
    ctx.fillStyle = COL.player; ellipse(b.r * 0.4, 0, b.r * 0.8, b.r * 0.4);
    ctx.restore();
  }
}
// The ring you fill by smashing SPACE, round whoever is being pulled (drawn over the players).
function drawPullMeter() {
  const o = game.obi;
  if (!o || !o.pull) return;
  const b = pulledBody(o.pull.id);
  if (!b) return;
  const f = Math.max(0, Math.min(1, o.pull.fill)), R = PLAYER.r + 16, pulse = reducedMotion ? 0 : Math.sin(performance.now() / 70) * 1.5;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85; ctx.strokeStyle = 'rgba(0, 0, 0, .6)'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = COL.line; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1; ctx.strokeStyle = COL.saber; ctx.lineWidth = 6 + pulse * 0.4;
  if (f > 0) { ctx.beginPath(); ctx.arc(b.x, b.y, R, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke(); }
}
// "SMASH SPACE!" over your own ring (on the text layer).
function drawPullText() {
  const o = game.obi;
  if (!o || !o.pull) return;
  const mine = NET.run ? o.pull.id === NET.me?.id : true;
  if (!mine) return;
  const p = game.player, c = tctx, s = reducedMotion ? 1 : 1 + 0.08 * Math.sin(performance.now() / 60);
  c.save(); c.translate(p.x, p.y - PLAYER.r - 38); c.scale(s, s);
  c.font = '800 18px "Chakra Petch", system-ui, sans-serif'; c.textAlign = 'center'; c.lineJoin = 'round';
  const txt = matchMedia('(pointer: coarse)').matches ? 'TAP TAP TAP!' : 'SMASH SPACE!';
  c.lineWidth = 5; c.strokeStyle = 'rgba(0, 0, 0, .85)'; c.strokeText(txt, 0, 0);
  c.fillStyle = COL.saberCore; c.fillText(txt, 0, 0);
  c.restore();
}
// The deflect shield round a player: a bright ring of blue, turning, fading in its last second.
function drawDeflect(x, y, left, age) {
  if (!(left > 0)) return;
  const fade = Math.min(1, left / 0.6), R = PLAYER.r + 8, spin = reducedMotion ? 0 : performance.now() / 300;
  const fresh = age != null && age <= DEFLECT.perfect;
  ctx.globalAlpha = fade * (fresh ? 0.3 : 0.12); ctx.fillStyle = COL.saber; circle(x, y, R);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COL.saber; ctx.lineWidth = 2.5; ctx.globalAlpha = fade * 0.9;
  for (let i = 0; i < 3; i++) { const a = spin + i * TAU / 3; ctx.beginPath(); ctx.arc(x, y, R, a, a + 1.5); ctx.stroke(); }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
