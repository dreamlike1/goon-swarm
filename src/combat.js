/* combat.js — Simulation: spawning, targeting, firing, hits and effects. */
'use strict';

/* ---------- simulation ---------- */
const aliveEl = document.getElementById('alive');

const TYPE_IDS = Object.keys(ENEMY_TYPES);
// A random type among those unlocked at this level, by weight.
function pickType() {
  const ids = TYPE_IDS.filter(k => game.level >= ENEMY_TYPES[k].from);
  const total = ids.reduce((s, k) => s + ENEMY_TYPES[k].weight, 0);
  let x = Math.random() * total;
  for (const k of ids) if ((x -= ENEMY_TYPES[k].weight) < 0) return k;
  return ids[0];
}

function spawnEnemy() {
  const p = game.player;
  const type = pickType(), T = ENEMY_TYPES[type], R = T.r;
  let best = null;
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(Math.random() * 4);
    const t = Math.random();
    const x = side === 0 ? R : side === 1 ? W - R : R + t * (W - 2 * R);
    const y = side === 2 ? R : side === 3 ? H - R : R + t * (H - 2 * R);
    const d = Math.hypot(x - p.x, y - p.y);
    if (!best || d > best.d) best = { x, y, d };
    if (d > Math.min(W, H) * 0.4) break;
  }
  game.enemies.push({
    x: best.x, y: best.y, vx: 0, vy: 0, kx: 0, ky: 0,
    type, shape: T.shape, r: R, dmg: enemyDmg(type, game.level), hp: enemyHp(type, game.level), maxHp: enemyHp(type, game.level),
    hit: 0, born: 0, speed: T.speed * enemySpeedMul(game.level) * (0.85 + Math.random() * 0.3),
  });
  aliveEl.textContent = game.enemies.length;
}

// The nearest enemy to a point, skipping any in `skip`, optionally within `range`.
function nearestEnemy(from = game.player, skip = null, range = Infinity) {
  let best = null, bd = range * range;
  for (const e of game.enemies) {
    if (skip && skip.has(e)) continue;
    const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Velocity from (x, y) toward enemy e at `speed`, leading it a little so slow shots still connect.
function aimAt(x, y, e, speed) {
  const t = Math.hypot(e.x - x, e.y - y) / speed;
  const a = Math.atan2(e.y + e.vy * t - y, e.x + e.vx * t - x);
  return { a, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

// Plays the next card, or a whole combo: a run of the same card (3, 4 or 7 in a row, see COMBOS in combos.js)
// is played as ONE attack that uses up all its slots.
function fire() {
  const cb = comboAt(deck.sequence, deck.seqPos);
  if (cb) {
    const evs = [];
    for (let k = 0; k < cb.n; k++) { const ev = deck.draw(); evs.push(ev); onAttack(ev); }   // one at a time, so the tray and log keep up
    runCombo(cb);
    // An augmented slot anywhere in the combo plays the whole combo a second time, a moment later.
    if (evs.some(ev => game.aug.has(ev.slot))) later(0.3, () => runCombo(cb, true));
    const last = evs[evs.length - 1];
    return { ...last, reshuffle: evs.find(ev => ev.reshuffle)?.reshuffle || null, sequence: evs.find(ev => ev.sequence)?.sequence || null };
  }
  const ev = deck.draw();
  shoot(ev.card, inRange(ev.card) || nearestEnemy());
  // An augmented slot fires its card a second time, a moment later. The extra shot doesn't draw from the deck.
  if (game.aug.has(ev.slot)) game.echoes.push({ card: ev.card, t: ECHO_DELAY });
  onAttack(ev);
  return ev;
}

// The nearest enemy within a card's attack range, or null.
const rangeOf = card => (CARDS[card].range || Infinity) * (1 + stats.range);   // Attack range upgrades stretch every card's range
const inRange = (card, from = game.player) => nearestEnemy(from, null, rangeOf(card));
const knockOf = base => base * (1 + stats.knock);   // the Knockback upgrade pushes every hit harder

// Runs `fn` after `t` seconds of play (paused time doesn't count).
function later(t, fn) { game.timers.push({ t, fn }); }

// Mine: placed where the player stands. Too many on the field and the oldest one is cleared.
function dropMine(card) {
  const p = game.player;
  game.mines.push({ x: p.x, y: p.y, t: 0, card });
  if (game.mines.length > MINE_MAX) game.mines.shift();
  SFX.fire(card);
}

// An area hit: every enemy within `radius` of (x, y) takes `dmg` and is thrown outward. `skip` is an enemy
// that was already hit directly. `big` adds the heavier effects (sound, shake, particles).
function blast(x, y, card, radius, dmg, { skip = null, knock = 160, big = false } = {}) {
  for (const e of game.enemies.slice()) {
    if (e === skip) continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
    if (d > radius + e.r) continue;
    hitEnemy({ card, look: 'blast', dmg, knock: knockOf(knock), vx: dx / d, vy: dy / d, x: e.x, y: e.y }, e);
  }
  game.rings.push({ x, y, r: 6, max: radius, life: big ? 0.45 : 0.3, color: COL[card] });
  burst(x, y, COL[card], big ? 34 : 12, big ? 320 : 200);
  if (big) { SFX.boom(); game.rings.push({ x, y, r: 4, max: radius * 0.6, life: 0.3, color: COL.player }); game.shake = Math.max(game.shake, 0.22); }
  else SFX.hit(true);
}

// A mine goes off. Any other mine inside its blast goes off too, a beat later (chain reaction, user).
function explode(m) {
  const spec = CARDS[m.card];
  blast(m.x, m.y, m.card, spec.radius, damageOf(spec.dmg), { knock: spec.knock, big: true });
  for (const o of game.mines.slice()) {
    if (Math.hypot(o.x - m.x, o.y - m.y) > spec.radius) continue;
    game.mines.splice(game.mines.indexOf(o), 1);
    later(0.09, () => explode(o));
  }
}

// A straight-flying projectile (Space Impact): fixed direction, speed climbs from `start` to `speed` over `ramp` s.
// o.range: it bursts when it has flown this far; o.endBlast: { radius, dmg } where it ends (hit, range or edge).
function launch(card, a, e, o = {}) {
  const spec = CARDS[card], p = game.player;
  game.projectiles.push({
    card, look: spec.look, r: spec.r, dmg: damageOf(spec.dmg), knock: knockOf(spec.knock), speed: spec.start, top: spec.speed,
    start: spec.start, ramp: spec.ramp, age: 0, straight: true, pierce: spec.pierce || 0, bounces: 0, hits: new Set(), spin: 0,
    target: null, a, x: p.x + Math.cos(a) * (PLAYER.r + 4), y: p.y + Math.sin(a) * (PLAYER.r + 4),
    vx: Math.cos(a) * spec.start, vy: Math.sin(a) * spec.start, trail: [], flown: 0, range: o.range || rangeOf(card) * 1.35, endBlast: o.endBlast || null,
  });
  if (!e) return;                       // part of a burst: the burst handles sound and muzzle
  game.muzzle = { a, life: 0.12, card };
  SFX.fire(card);
}

// One homing shot of `card` at enemy `e`. Options (all optional), for combos:
//   dmg: exact damage (before Base damage) · speedMul · r (size) · bounces · bounceRange
//   aoe: { radius, dmg } splash where it hits · angle + homeDelay: fly this way for a moment, then home in
//   angle + noHome: fly straight this way (cone shots) · quiet: no sound or muzzle (the combo plays its own)
// Every shot fizzles once it has flown a bit past its card's range.
function shoot(card, e, o = {}) {
  const spec = CARDS[card];
  const p = game.player;
  if (spec.look === 'mine') { dropMine(card); return; }
  const speed = spec.speed * (o.speedMul || 1);
  if (spec.homing === false) {
    // A straight shot can't correct its course, so it leads using its average speed over the climb.
    const { a } = aimAt(p.x, p.y, e, (spec.start + spec.speed) / 2);
    launch(card, o.angle ?? a, e, o);
    return;
  }
  const aim = aimAt(p.x, p.y, e, speed);
  const a = o.angle ?? aim.a;
  game.projectiles.push({
    card, look: spec.look, r: o.r || spec.r, dmg: damageOf(o.dmg ?? spec.dmg), knock: knockOf(spec.knock), speed,
    bounces: o.bounces ?? (spec.bounces || 0), bounceRange: o.bounceRange || BOUNCE_RANGE, hits: new Set(), spin: 0, target: e,
    aoe: o.aoe ? { radius: o.aoe.radius, dmg: damageOf(o.aoe.dmg) } : null, homeDelay: o.noHome ? Infinity : (o.homeDelay || 0), big: !!o.r,
    flown: 0, maxDist: rangeOf(card) * 1.35,
    x: p.x + Math.cos(a) * (PLAYER.r + 4), y: p.y + Math.sin(a) * (PLAYER.r + 4), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, trail: [],
  });
  if (o.quiet) return;
  game.muzzle = { a, life: 0.12, card };
  SFX.fire(card);
  if (spec.look === 'heavy') game.shake = Math.max(game.shake, 0.08);
}

function hitEnemy(pr, e) {
  e.hp -= pr.dmg;
  e.hit = 0.1;
  const len = Math.hypot(pr.vx, pr.vy) || 1, kr = e.boss ? BOSS.knockResist : 1;
  e.kx += (pr.vx / len) * pr.knock * kr;
  e.ky += (pr.vy / len) * pr.knock * kr;
  if (e.boss) renderBossBar();
  const heavy = pr.look === 'heavy' && !pr.aoe, strong = pr.dmg >= 10;
  SFX.hit(heavy || pr.dmg >= 15);
  burst(pr.x, pr.y, COL[pr.card], heavy ? 16 : strong ? 10 : 5, heavy ? 260 : 180);
  if (heavy) {
    game.rings.push({ x: pr.x, y: pr.y, r: 6, max: 70, life: 0.35, color: COL[pr.card] });
    game.shake = Math.max(game.shake, 0.18);
  }
  game.floaters.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.r - 8, text: String(pr.dmg), color: COL[pr.card], life: 0.6, vy: -50, big: strong });

  if (e.hp <= 0) {
    SFX.kill(e.r > 15);
    burst(e.x, e.y, COL[e.type], e.r > 15 ? 30 : 22, 240);
    game.rings.push({ x: e.x, y: e.y, r: 10, max: e.r * 6, life: 0.45, color: COL[e.type] });
    game.enemies.splice(game.enemies.indexOf(e), 1);
    if (e.boss) bossDown(e);
    else if (Math.random() < orbDropChance()) dropOrb(e);
    if (Math.random() < POTION.drop && game.potions.length < POTION.max) game.potions.push({ x: e.x, y: e.y, t: 0 });
    else if (Math.random() < DIAMOND.drop && game.diamonds.length < DIAMOND.max) game.diamonds.push({ x: e.x, y: e.y, t: 0 });
    game.kills++;
    document.getElementById('kills').textContent = game.kills;
    aliveEl.textContent = game.enemies.length;
  }
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.3, color });
  }
}

// An XP orb pops out of a defeated enemy and settles on the floor.
function dropOrb(e) {
  const value = ENEMY_TYPES[e.type].xp, a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 60;
  game.orbs.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value, r: value > 1 ? 8 : 6, t: Math.random() * 6, born: 0 });
}

// Adds XP, levelling up as many times as it covers. Leftover XP carries into the next level.
function gainXp(n) {
  game.xp += n;
  let up = 0;
  while (game.xp >= xpNeeded(game.level)) {
    game.xp -= xpNeeded(game.level);
    game.level++;
    up++;
  }
  if (up) {
    const p = game.player;
    SFX.levelUp();
    game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 90, life: 0.6, color: COL.xp });
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 18, text: `LEVEL ${game.level}`, color: COL.xp, life: 1.1, vy: -30, big: true });
  }
  renderXp(up > 0);
  if (up) queueLevelUps(game.level - up, game.level);
}

const hintEl = document.getElementById('hint');

// Contact damage, then a short safe window so touching an enemy doesn't drain HP every frame.
// Dodge can avoid the hit entirely; Armor takes a flat amount off it (a hit always does at least 1).
function hurtPlayer(raw) {
  const p = game.player;
  if (p.safe > 0 || game.over) return;
  if (Math.random() < dodgeChance()) {
    p.safe = PLAYER.safe;
    SFX.dodge();
    game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: 'DODGE', color: COL.text, life: 0.6, vy: -40, big: false });
    return;
  }
  const dmg = armorCut(raw);
  p.hp = Math.max(0, p.hp - dmg);
  p.safe = PLAYER.safe;
  SFX.hurt();
  game.shake = Math.max(game.shake, 0.12);
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: `-${dmg}`, color: COL.bad, life: 0.7, vy: -40, big: true });
  renderHp(true);
  if (p.hp <= 0) defeat();
}

function update(dt) {
  if (first) return;                    // wait until the arena has a real size (see resize)
  const p = game.player;

  // movement
  let mx = 0, my = 0;
  for (const k of keys) { mx += MOVE[k][0]; my += MOVE[k][1]; }
  if (!mx && !my && pointer) {
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    if (Math.hypot(dx, dy) > 6) { mx = dx; my = dy; }
  }
  const ml = Math.hypot(mx, my);
  if (updateDash(dt)) { /* BULL charge: it moves the player itself */ }
  else if (ml) {
    p.x += (mx / ml) * moveSpeed() * dt; p.y += (my / ml) * moveSpeed() * dt;
    hintEl.classList.add('gone');
  }
  clampTo(p, PLAYER.r);
  p.flash = Math.max(0, p.flash - dt);
  p.safe = Math.max(0, p.safe - dt);
  // Mini shield: a moment of safety right after a level-up choice closes.
  game.shield = Math.max(0, game.shield - dt);
  game.shieldHit = Math.max(0, game.shieldHit - dt);

  // swarm spawning
  // swarm spawning: tops up fast below this level's minimum, then keeps adding up to its maximum
  if (!game.started) {
    game.started = true;
    for (let i = 0; i < 3; i++) spawnEnemy();
  }
  if (game.bossDue && !game.boss) spawnBoss();
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    const mul = game.boss ? BOSS.swarmMul : 1;              // fewer of the rest while the boss is up
    const n = game.enemies.length - (game.boss ? 1 : 0), low = n < Math.floor(swarmMin(game.level) * mul);
    if (n < Math.floor(swarmMax(game.level) * mul)) spawnEnemy();
    game.spawnTimer = low ? SWARM.refill : spawnEvery(game.level);
  }

  // health regen
  if (stats.regen > 0 && p.hp < maxHp()) {
    const before = Math.ceil(p.hp);
    p.hp = Math.min(maxHp(), p.hp + stats.regen * dt);
    if (Math.ceil(p.hp) !== before) renderHp(false);
  }

  // enemies: chase, keep a little apart from each other, get shoved on contact
  const es = game.enemies;
  const decay = Math.exp(-6 * dt);
  for (const e of es) {
    e.born = Math.min(1, e.born + dt * (e.boss ? 1.5 : 4));
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (e.boss) moveBoss(e, dt);
    else {
      e.kx *= decay; e.ky *= decay;
      e.vx = (dx / d) * e.speed + e.kx;
      e.vy = (dy / d) * e.speed + e.ky;
      e.x += e.vx * dt; e.y += e.vy * dt;
    }
    e.hit = Math.max(0, e.hit - dt);
    const shielded = game.shield > 0;
    const reach = e.r + PLAYER.r + (shielded ? SHIELD.r : 0);
    if (d < reach) {                    // contact: push out, shove back, and hurt the player (unless shielded)
      if (e.boss) { p.x += (dx / d) * (reach - d); p.y += (dy / d) * (reach - d); clampTo(p, PLAYER.r); }   // the boss shoves you, not the other way round
      else { e.x -= (dx / d) * (reach - d); e.y -= (dy / d) * (reach - d); e.kx -= (dx / d) * 260; e.ky -= (dy / d) * 260; }
      if (shielded || game.dash) game.shieldHit = 0.15;
      else { p.flash = 0.2; hurtPlayer(e.dmg); }
    }
  }
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const overlap = (a.r + b.r) * 1.1 - d;
      if (overlap > 0) {
        const ox = (dx / d) * overlap / 2, oy = (dy / d) * overlap / 2;
        if (a.boss) { b.x += ox * 2; b.y += oy * 2; }
        else if (b.boss) { a.x -= ox * 2; a.y -= oy * 2; }
        else { a.x -= ox; a.y -= oy; b.x += ox; b.y += oy; }
      }
    }
  }
  for (const e of es) clampTo(e, e.r);

  updateRocks(dt);

  // potions: walk over one to heal; they fade after a while
  for (let i = game.potions.length - 1; i >= 0; i--) {
    const pt = game.potions[i];
    pt.t += dt;
    if (pt.t > POTION.life) { game.potions.splice(i, 1); continue; }
    if (Math.hypot(pt.x - p.x, pt.y - p.y) < PLAYER.r + POTION.r + 2) {
      game.potions.splice(i, 1);
      const healed = Math.min(POTION.heal, maxHp() - p.hp);
      p.hp = Math.min(maxHp(), p.hp + POTION.heal);
      SFX.potion();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 26, life: 0.4, color: COL.potion });
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 10, text: `+${Math.round(healed)}`, color: COL.hp, life: 0.8, vy: -40, big: true });
      renderHp(false);
    }
  }

  // diamonds: walk over one and every XP orb on the floor flies to you
  for (let i = game.diamonds.length - 1; i >= 0; i--) {
    const dm = game.diamonds[i];
    dm.t += dt;
    if (dm.t > DIAMOND.life) { game.diamonds.splice(i, 1); continue; }
    if (Math.hypot(dm.x - p.x, dm.y - p.y) < PLAYER.r + DIAMOND.r + 2) {
      game.diamonds.splice(i, 1);
      for (const o of game.orbs) o.magnetized = true;
      SFX.diamond();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: Math.max(W, H), life: 0.6, color: COL.diamond });
      game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 12, text: 'MAGNET!', color: COL.diamond, life: 0.9, vy: -40, big: true });
    }
  }

  // mines: arm after a moment, then go off when an enemy touches one
  for (let i = game.mines.length - 1; i >= 0; i--) {
    const m = game.mines[i];
    if (!m) continue;                    // a chain reaction removed mines from the list
    const spec = CARDS[m.card];
    m.t += dt;
    if (m.t < spec.arm) continue;
    if (es.some(e => Math.hypot(e.x - m.x, e.y - m.y) < spec.r + e.r)) { game.mines.splice(i, 1); explode(m); }
  }

  // scheduled combo shots
  for (let i = game.timers.length - 1; i >= 0; i--) {
    const tm = game.timers[i];
    if ((tm.t -= dt) > 0) continue;
    game.timers.splice(i, 1);
    tm.fn();
  }

  // an augmented slot's second shot
  for (let i = game.echoes.length - 1; i >= 0; i--) {
    const ec = game.echoes[i];
    if ((ec.t -= dt) > 0) continue;
    game.echoes.splice(i, 1);
    const tg = inRange(ec.card);
    if (tg) shoot(ec.card, tg);
  }

  // attacks: the timer only runs out while the next card has an enemy within its range
  game.cooldown -= dt;
  if (game.cooldown <= 0) {
    const next = deck.sequence[deck.seqPos];
    if (next && inRange(next)) {
      const ev = fire();
      // A shuffle takes a moment: the next card waits for it. Attack speed shortens both.
      game.cdTotal = attackInterval() + (ev.reshuffle ? shuffleTime() : 0);
      game.cooldown += game.cdTotal;
    }
    else game.cooldown = 0;
  }

  // Projectiles home in on their target, so they don't miss it. If the target dies first, the shot doesn't
  // look for another: it flies on straight and can still hit whatever it runs into (user: less aimbot).
  // Each hits the first enemy it touches. A bouncing one (Shuriken) then heads for the nearest enemy it
  // hasn't hit yet, within its bounce range; with none, it ends. Every shot fizzles past its range.
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const pr = game.projectiles[i];
    pr.trail.push(pr.x, pr.y);
    if (pr.trail.length > 16) pr.trail.splice(0, 2);
    // Straight missiles: no homing. They ease in slowly, then speed up. They pierce `pierce` enemies;
    // the next hit stops them. Missing is possible.
    if (pr.straight) {
      pr.age += dt;
      const k = Math.min(1, pr.age / pr.ramp);
      pr.speed = pr.start + (pr.top - pr.start) * k * k;
      pr.vx = Math.cos(pr.a) * pr.speed; pr.vy = Math.sin(pr.a) * pr.speed;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.flown += pr.speed * dt;
      const hit = es.find(en => !pr.hits.has(en) && Math.hypot(pr.x - en.x, pr.y - en.y) < pr.r + en.r);
      let end = false;
      if (hit) {
        hitEnemy(pr, hit);
        pr.hits.add(hit);
        if (pr.pierce > 0) pr.pierce--;
        else end = true;
      }
      if (pr.range && pr.flown >= pr.range) end = true;
      const out = pr.x < -40 || pr.y < -40 || pr.x > W + 40 || pr.y > H + 40;
      if (end || out) {
        game.projectiles.splice(i, 1);
        if (pr.endBlast && !out) blast(pr.x, pr.y, pr.card, pr.endBlast.radius, pr.endBlast.dmg, { knock: 80 });
      }
      continue;
    }
    // A spread shot (shotgun, cone) flies its own way for a moment before homing in.
    const spread = pr.homeDelay > 0;
    if (spread) pr.homeDelay -= dt;
    if (pr.target && !es.includes(pr.target)) pr.target = null;   // its target died: carry on straight
    const tg = spread ? null : pr.target;
    if (spread) { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    else if (tg) {
      const dx = tg.x - pr.x, dy = tg.y - pr.y, d = Math.hypot(dx, dy) || 1;
      pr.vx = (dx / d) * pr.speed; pr.vy = (dy / d) * pr.speed;
      // Arrives this frame: land on it, so a fast shot can't step past its target.
      if (d <= pr.speed * dt + pr.r + tg.r) { pr.x = tg.x - (dx / d) * tg.r * 0.8; pr.y = tg.y - (dy / d) * tg.r * 0.8; }
      else { pr.x += pr.vx * dt; pr.y += pr.vy * dt; }
    } else {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;   // no target: fly on straight
    }
    pr.flown += pr.speed * dt;
    pr.spin += dt * 18;
    const touching = en => !pr.hits.has(en) && Math.hypot(pr.x - en.x, pr.y - en.y) < pr.r + en.r;
    const target = (tg && touching(tg)) ? tg : es.find(touching);
    if (target) {
      hitEnemy(pr, target);
      pr.hits.add(target);
      if (pr.aoe) blast(target.x, target.y, pr.card, pr.aoe.radius, pr.aoe.dmg, { skip: target, big: pr.big });
      const next = pr.bounces > 0 && nearestEnemy(pr, pr.hits, pr.bounceRange || BOUNCE_RANGE);
      if (next) {
        pr.bounces--;
        pr.target = next;
        pr.flown = 0; pr.maxDist = (pr.bounceRange || BOUNCE_RANGE) * 1.35;   // each bounce gets its own reach
        continue;
      }
      game.projectiles.splice(i, 1);
      continue;
    }
    if (pr.flown > pr.maxDist) {           // out of range: fizzle
      burst(pr.x, pr.y, COL[pr.card], 3, 80);
      game.projectiles.splice(i, 1);
      continue;
    }
    if (pr.x < -40 || pr.y < -40 || pr.x > W + 40 || pr.y > H + 40) game.projectiles.splice(i, 1);
  }

  // XP orbs: slide to a stop, then fly to the player once in range. Touching one collects it.
  for (let i = game.orbs.length - 1; i >= 0; i--) {
    const o = game.orbs[i];
    o.t += dt; o.born = Math.min(1, o.born + dt * 5);
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1;
    if (d < PLAYER.r + o.r + 2) {
      game.orbs.splice(i, 1);
      SFX.pickup();
      game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: PLAYER.r + 10, life: 0.2, color: COL.xp });
      gainXp(xpGain(o.value));
      continue;
    }
    const drag = Math.exp(-5 * dt);
    o.vx *= drag; o.vy *= drag;
    // Once an orb is pulled in range, it stays "latched" and keeps chasing no matter how far
    // it falls behind afterwards — otherwise a player sprinting away can shake it off for good.
    if (!o.magnetized && d < magnetRange()) o.magnetized = true;
    if (o.magnetized) {
      // Ramps up quadratically as it closes in (for a satisfying last-second snap), but the
      // floor alone (3x) already gives a terminal speed above the player's top speed, so a
      // latched orb is always guaranteed to catch up eventually, however far behind it is.
      const closeness = Math.max(0, Math.min(1, (magnetRange() - d) / magnetRange()));
      const boost = 3 + closeness * closeness * 3;
      o.vx += (dx / d) * XP.pull * dt * boost;
      o.vy += (dy / d) * XP.pull * dt * boost;
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
    clampTo(o, o.r);
  }

  // effects
  for (const q of game.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.life -= dt; }
  game.particles = game.particles.filter(q => q.life > 0);
  for (const r of game.rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 12); }
  game.rings = game.rings.filter(r => r.life > 0);
  for (const f of game.floaters) { f.y += f.vy * dt; f.life -= dt; }
  game.floaters = game.floaters.filter(f => f.life > 0);
  if (game.muzzle && (game.muzzle.life -= dt) <= 0) game.muzzle = null;
  game.shake = Math.max(0, game.shake - dt);
}
