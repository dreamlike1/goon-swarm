/* upgrades.js — Level-up upgrades: the 13 player stats, rarity rolls, the pick-one-of-3 screen, slot augments and the stats panel. */
'use strict';

/* ============================================================
   Each level up offers 3 different stats, each with its own rolled
   rarity. Rarer = bigger: the Common amount times UP_MULT. Upgrades
   last for this run only. All numbers are placeholders.
   Every 10th level, after the 3 cards, you also augment one deck slot
   (1–7): whatever card is in that slot fires twice.
   ============================================================ */
const UP_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];   // no SSS for upgrades (user)
const UP_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
const UP_MULT = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 };
const LUCK = { rarity: 25, drop: 0.006, dropMax: 1 };     // every 25 Luck doubles the weight of each rarity above Common; each point adds 0.6% orb drop chance, up to 100%

// `base` is the Common amount; `round` keeps whole-number stats whole. `show` formats the total for the panel.
const STATS = {
  hp:    { name: 'HP',           short: 'HP',  base: 10,   round: true,  show: () => `${maxHp()}`,                       gain: v => `+${v} max HP` },
  regen: { name: 'Health regen', short: 'REG', base: 0.5,                show: () => `${stats.regen.toFixed(1)}/s`,      gain: v => `+${v.toFixed(2).replace(/0$/, '')} HP per second` },
  dmg:   { name: 'Base damage',  short: 'DMG', base: 0.08,               show: () => pct(stats.dmg, true),               gain: v => `+${pct(v)} damage` },
  // Crits (v0.41, user): every hit has `crit` chance to deal +`critDmg` more. You start at 10% and +30% (BASE_STATS).
  // Crit rate turns up less often in level ups than the others (`weight`, user: rarer than damage).
  crit:  { name: 'Crit rate',    short: 'CRT', base: 0.02, cap: 1, weight: 0.4, show: () => pct(stats.crit),       gain: v => `+${pct(v)} chance to crit` },
  critDmg: { name: 'Crit damage', short: 'CDM', base: 0.1,              show: () => pct(stats.critDmg, true),           gain: v => `+${pct(v)} damage on a crit` },
  speed: { name: 'Speed',        short: 'SPD', base: 0.06, cap: 1,       show: () => pct(stats.speed, true),             gain: v => `+${pct(v)} move speed` },
  dodge: { name: 'Dodge',        short: 'DGE', base: 0.04, cap: 0.6,     show: () => pct(stats.dodge),                   gain: v => `+${pct(v)} dodge chance` },
  armor: { name: 'Armor',        short: 'ARM', base: 1,    round: true,  show: () => `${stats.armor}`,                   gain: v => `−${v} damage per hit` },
  atk:   { name: 'Attack speed', short: 'ATK', base: 0.06, cap: 1 - MIN_INTERVAL / ATTACK_INTERVAL,
           show: () => `${attackInterval().toFixed(2)}s`,                                                               gain: v => `−${pct(v)} time between cards and shuffles` },
  knock: { name: 'Knockback',    short: 'KNK', base: 0.15,               show: () => pct(stats.knock, true),             gain: v => `+${pct(v)} knockback on every hit` },
  range: { name: 'Attack range', short: 'RNG', base: 0.08,               show: () => pct(stats.range, true),             gain: v => `+${pct(v)} attack range` },
  luck:  { name: 'Luck',         short: 'LCK', base: 5,    round: true,  show: () => `${stats.luck}`,                    gain: v => `+${v} luck: rarer upgrades, more orbs` },
  xp:    { name: 'XP',           short: 'XP',  base: 0.1,                show: () => pct(stats.xp, true),                gain: v => `+${pct(v)} XP from orbs, wider pull` },
};
const STAT_IDS = Object.keys(STATS);

const pct = (v, plus = false) => `${plus ? '+' : ''}${Math.round(v * 100)}%`;
const upAmount = (id, r) => { const v = STATS[id].base * UP_MULT[r]; return STATS[id].round ? Math.round(v) : v; };

// This run's bonuses, how many times each stat was picked, and the best rarity picked for it.
const stats = {};
const picks = {};
// Every run starts with these (user, v0.9: +10% base damage and +10% attack speed). Upgrades add on top, and the
// stats panel shows the total (Base damage +10%, Attack speed 0.63s) without marking them as upgraded.
const BASE_STATS = { dmg: 0.1, atk: 0.1, crit: 0.1, critDmg: 0.3 };   // crits: v0.41, user
function resetStats() {
  for (const id of STAT_IDS) { stats[id] = BASE_STATS[id] || 0; picks[id] = { n: 0, best: -1 }; }
  game.choosing = false;
  game.upQueue = [];
  choiceEl.hidden = true;
  renderStats();
}

/* ---------- what the stats do (combat.js reads these) ---------- */
const maxHp = () => PLAYER.hp + stats.hp;
const moveSpeed = () => PLAYER.speed * (1 + Math.min(STATS.speed.cap, stats.speed));
const damageOf = base => Math.max(1, Math.round(base * (1 + stats.dmg)));
const critChance = () => Math.min(STATS.crit.cap, stats.crit);
const critHit = dmg => Math.max(dmg + 1, Math.round(dmg * (1 + stats.critDmg)));   // a crit always adds at least 1
const dodgeChance = () => Math.min(STATS.dodge.cap, stats.dodge);
const armorCut = dmg => Math.max(1, dmg - stats.armor);                        // a hit always does at least 1
const attackInterval = () => Math.max(MIN_INTERVAL, ATTACK_INTERVAL * (1 - stats.atk));
const shuffleTime = () => SHUFFLE_TIME * (1 - Math.min(STATS.atk.cap, stats.atk));
const orbDropChance = () => XP_BOOST.on ? XP_BOOST.drop : Math.min(LUCK.dropMax, XP.drop + stats.luck * LUCK.drop);
const xpGain = v => v * (1 + stats.xp) * (XP_BOOST.on ? XP_BOOST.value : 1);
const magnetRange = () => XP.magnet * (1 + stats.xp * 0.5);
const capped = id => STATS[id].cap != null && stats[id] >= STATS[id].cap - 1e-9;

// Rarity odds with Luck: each rarity above Common gets its weight multiplied by (1 + Luck / 25).
function upOdds() {
  const w = UP_RARITIES.map(r => UP_WEIGHTS[r] * (r === 'common' ? 1 : 1 + stats.luck / LUCK.rarity));
  const total = w.reduce((a, b) => a + b, 0);
  return Object.fromEntries(UP_RARITIES.map((r, i) => [r, w[i] / total]));
}
function rollRarity() {
  const odds = upOdds();
  let x = Math.random();
  for (const r of UP_RARITIES) if ((x -= odds[r]) < 0) return r;
  return 'common';
}
// 3 different stats (skipping any at their limit), each with its own rarity.
function rollChoices() {
  const pool = STAT_IDS.filter(id => !capped(id));
  const out = [];
  while (out.length < 3 && pool.length) {
    // weighted: most stats are 1, Crit rate less (STATS[id].weight)
    const w = pool.map(id => STATS[id].weight ?? 1);
    let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
    while (k < pool.length - 1 && (x -= w[k]) >= 0) k++;
    const id = pool.splice(k, 1)[0];
    out.push({ id, rarity: rollRarity() });
  }
  // Sometimes one card is a random weapon instead (user).
  if (deck && out.length && Math.random() < WEAPON_CARD) out[Math.floor(Math.random() * out.length)] = { id: 'weapon', rarity: 'epic' };
  return out;
}

/* ---------- level up: pause and pick one of 3 (and, every 10th level, a slot to augment) ---------- */
const choiceEl = document.getElementById('levelup');
const choiceCards = document.getElementById('up-cards');
let choices = [];      // the 3 stat cards on screen
let step = null;       // the pick on screen: { kind: 'stat' | 'aug', level }

// Called by gainXp with the levels gained. Each level queues a stat pick; every 10th also queues an augment.
function queueLevelUps(from, to) {
  for (let l = from + 1; l <= to; l++) {
    game.upQueue.push({ kind: 'stat', level: l });
    if (isWheelLevel(l)) game.upQueue.push({ kind: 'wheel', level: l });
    if (l % AUG_EVERY === 0) game.upQueue.push({ kind: 'aug', level: l });
    if (l === BOSS.level && !game.bossDone && !game.boss) game.bossDue = true;   // SKURTOSAURUS arrives once these picks are done
    if (l === MAKORA.level && !game.makora) game.makoraDue = true;             // … and MAKORA at 15, the last level
  }
  if (!game.choosing) openNext();
  else renderMore();
}
function renderMore() {
  const m = document.getElementById('up-more'), n = game.upQueue.length;
  m.hidden = n === 0;
  m.textContent = `${n} more pick${n === 1 ? '' : 's'} after this`;
}

function openNext() {
  // Skip picks that have nothing left to offer (every stat at its limit, or every slot augmented).
  step = null;
  while (game.upQueue.length) {
    step = game.upQueue.shift();
    if (step.kind === 'stat' && (choices = rollChoices()).length) break;
    if (step.kind === 'aug' && game.aug.size < SEQUENCE_SIZE) break;
    if (step.kind === 'wheel' || step.kind === 'relic') break;
    step = null;
  }
  if (!step) { closeChoice(); return; }
  game.choosing = true;                 // the fight pauses; held movement keys are still tracked (arena.js)
  step.at = performance.now();
  document.getElementById('up-eyebrow').textContent = step.kind === 'relic' ? 'Boss defeated' : `Level ${step.level}`;
  renderMore();
  choiceEl.classList.toggle('is-aug', step.kind === 'aug');
  choiceEl.classList.toggle('is-wheel', step.kind === 'wheel');
  choiceEl.classList.toggle('is-relic', step.kind === 'relic');
  const render = { stat: renderStatCards, aug: renderSlots, wheel: renderWheel, relic: renderRelic }[step.kind];
  render();
  choiceEl.hidden = false;
  if (animOk) {
    [...choiceCards.children].forEach((li, i) => li.animate(
      [{ transform: 'translateY(24px) scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 260, delay: 80 + i * (step.kind === 'aug' ? 40 : 70), easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' }));
  }
  choiceEl.focus({ preventScroll: true });   // the dialog, not a card, so no card looks hovered; the number keys and Tab still work
}

function renderStatCards() {
  document.getElementById('up-title').textContent = 'Choose an upgrade';
  document.getElementById('up-sub').hidden = true;
  document.getElementById('up-keys').textContent = 'Press 1, 2 or 3 · hold a direction to move off the moment you pick';
  choiceCards.innerHTML = choices.map((c, i) => {
    if (c.id === 'weapon') {                   // the random weapon card: you find out what it is when you pick it
      const n = deck.size + deck.pendingAdds.length;
      return `<li><button class="upcard is-weapon" type="button" data-i="${i}" style="--rc: var(--xp)">`
        + `<span class="up-key" aria-hidden="true">${i + 1}</span>`
        + `<span class="up-rarity">Weapon</span>`
        + `<span class="up-name">Random weapon</span>`
        + `<span class="up-gain">A random weapon you own joins your deck for this run</span>`
        + `<span class="up-change">${n} cards <span aria-hidden="true">→</span><span class="sr"> to </span> <b>${n + 1}</b></span>`
        + `</button></li>`;
    }
    const s = STATS[c.id], v = upAmount(c.id, c.rarity);
    const before = s.show();
    stats[c.id] += v;
    const after = s.show();
    stats[c.id] -= v;
    return `<li><button class="upcard r-${c.rarity}" type="button" data-i="${i}" style="--rc: var(--r-${c.rarity})">`
      + `<span class="up-key" aria-hidden="true">${i + 1}</span>`
      + `<span class="up-rarity">${RARITY_NAME[c.rarity]}</span>`
      + `<span class="up-name">${s.name}</span>`
      + `<span class="up-gain">${s.gain(v)}</span>`
      + `<span class="up-change">${before} <span aria-hidden="true">→</span><span class="sr"> to </span> <b>${after}</b></span>`
      + `</button></li>`;
  }).join('');
  const best = Math.max(...choices.map(c => UP_RARITIES.indexOf(c.rarity)));   // the weapon card counts as Epic
  setTimeout(() => SFX.flip(UP_RARITIES[best]), 120);
}

// Augment: the 7 deck slots, showing the card in each right now. Slots already augmented can't be picked again.
function renderSlots() {
  document.getElementById('up-title').textContent = 'Augment a slot';
  const sub = document.getElementById('up-sub');
  sub.hidden = false;
  sub.textContent = 'Whatever card is in this slot fires twice, every sequence.';
  document.getElementById('up-keys').textContent = 'Press 1 to 7 · hold a direction to move off the moment you pick';
  const seq = deck.sequence;
  choiceCards.innerHTML = seq.map((c, i) => {
    const done = game.aug.has(i);
    return `<li><button class="slotcard${done ? ' is-aug' : ''}" type="button" data-slot="${i}"${done ? ' disabled' : ''} style="--c: ${c ? `var(--${c})` : 'var(--muted)'}"`
      + ` aria-label="Slot ${i + 1}${c ? `, now ${CARDS[c].name}` : ''}${done ? ', already augmented' : ''}">`
      + `<span class="slot-n">${i + 1}</span>`
      + `<span class="slot-now">${c ? CARDS[c].name : '?'}</span>`
      + `<span class="slot-x2">${done ? '×2' : ''}</span>`
      + `</button></li>`;
  }).join('');
  SFX.flip('epic');
}

/* ---------- weapon wheel (levels 5, 15, 25 …) ---------- */
// Every card is a slice, sized by its rarity's pack weight. Luck widens the rarer slices, like upgrade odds.
function wheelSlices(ids = CARD_IDS) {
  const w = ids.map(id => RARITY_WEIGHTS[CARDS[id].rarity] * (CARDS[id].rarity === 'common' ? 1 : 1 + stats.luck / LUCK.rarity));
  const total = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return ids.map((id, i) => { const from = at; at += (w[i] / total) * 360; return { id, from, to: at, chance: w[i] / total }; });
}
let wheel = null;   // { slices, result, spun, done }

function renderWheel() {
  const slices = wheelSlices();
  wheel = { slices, result: null, spun: false, done: false };
  document.getElementById('up-title').textContent = 'Spin for a weapon';
  const sub = document.getElementById('up-sub');
  sub.hidden = false;
  sub.textContent = 'It joins your deck for this run only. Your saved loadout stays the same.';
  document.getElementById('up-keys').textContent = 'Press Space to spin, or X to take the XP';
  const grad = slices.map(s => `color-mix(in srgb, var(--${s.id}) 34%, var(--card)) ${s.from}deg ${s.to}deg`).join(', ');
  choiceCards.innerHTML = `<li class="wheel-box">`
    + `<div class="wheel-wrap"><span class="wheel-pointer" aria-hidden="true"></span>`
    + `<div class="wheel" id="wheel" style="background: conic-gradient(${grad})" role="img" aria-label="Weapon wheel: ${slices.map(s => `${CARDS[s.id].name} ${(s.chance * 100).toFixed(1)}%`).join(', ')}">`
    + slices.map(s => `<span class="wheel-line" style="--a: ${s.from}deg"></span>`
      + `<span class="wheel-label" style="--a: ${(s.from + s.to) / 2}deg; color: var(--${s.id})">${CARDS[s.id].name}</span>`).join('')
    + `</div><span class="wheel-hub" aria-hidden="true"></span></div>`
    + `<p class="wheel-result" id="wheel-result" aria-live="polite"></p>`
    + `<div class="row wheel-actions"><button class="start" type="button" id="btn-spin">Spin</button>`
    + `<button type="button" id="btn-wheel-xp">Take <b>+${wheelXp()} XP</b> instead</button></div>`
    + `</li>`;
  SFX.flip('rare');
}

// Skipping the spin (user) gives XP instead: a share of what this level needs.
const wheelXp = () => Math.max(1, Math.round(xpNeeded(game.level) * WHEEL_XP));

// A random slice, by the slices' chances (the wheel and the random weapon card share this).
function pickSlice(slices) {
  let x = Math.random();
  for (const sl of slices) if ((x -= sl.chance) < 0) return sl;
  return slices[slices.length - 1];
}

const SPIN = { dur: 3200, turns: 6, stop: 800 };   // ms for a full spin; full turns; ms to brake when you stop it

// Spin, or, while it's spinning, stop it (user): it brakes hard and lands on the same result.
function spinWheel() {
  if (!wheel || wheel.done) return;
  if (wheel.spun) { stopWheel(); return; }
  wheel.spun = true;
  document.getElementById('btn-wheel-xp').hidden = true;
  const s = pickSlice(wheel.slices);
  wheel.result = s.id;
  const btn = document.getElementById('btn-spin');
  btn.textContent = 'Stop';
  document.getElementById('up-keys').textContent = 'Press Space to stop';
  // Land somewhere inside the chosen slice (not on its edge), after several full turns. The pointer is at the top.
  const inside = s.from + (s.to - s.from) * (0.2 + Math.random() * 0.6);
  wheel.target = 360 * SPIN.turns + (360 - inside);
  if (!animOk) { document.getElementById('wheel').style.transform = `rotate(${wheel.target}deg)`; return wheelDone(); }
  turnWheel(0, wheel.target, SPIN.dur);
}

function stopWheel() {
  const w = wheel, tn = w.turn;
  if (!tn || w.stopping) return;
  const k = Math.min(1, (performance.now() - tn.t0) / tn.dur);
  if ((1 - k) * tn.dur <= SPIN.stop) return;                   // it's already slowing down
  w.stopping = true;
  document.getElementById('btn-spin').disabled = true;
  // Brake from the current speed: go on to the same landing angle, with as many extra turns as that speed carries.
  const a = w.angle, speed = (tn.to - tn.from) * 4 * (1 - k) ** 3 / tn.dur;   // degrees per ms (ease-out quart)
  const rest = (((w.target - a) % 360) + 360) % 360;
  const extra = Math.max(0, Math.round((speed * SPIN.stop / 4 - rest) / 360));
  turnWheel(a, a + rest + extra * 360, SPIN.stop);
}

// Turns the wheel from one angle to another, easing out. Driven by animation frames, with a timer as backup so it
// always turns and finishes, even when frames stall (a hidden tab, a busy browser). A new turn replaces the last.
function turnWheel(from, to, dur) {
  const spin = wheel, el = document.getElementById('wheel'), turn = { from, to, t0: performance.now(), dur };
  spin.turn = turn;
  let raf = 0, backup = 0;
  const next = () => {
    cancelAnimationFrame(raf); clearTimeout(backup);
    raf = requestAnimationFrame(tick); backup = setTimeout(tick, 60);
  };
  const tick = () => {
    if (wheel !== spin || spin.done || spin.turn !== turn) return;
    const k = Math.min(1, (performance.now() - turn.t0) / dur), e = 1 - (1 - k) ** 4;
    const a = from + (to - from) * e;
    spin.angle = a;
    el.style.transform = `rotate(${a}deg)`;
    const under = ((360 - (a % 360)) + 360) % 360;             // wheel angle now under the pointer
    const idx = spin.slices.findIndex(sl => under >= sl.from && under < sl.to);
    if (idx !== spin.lastSlice) { if (spin.lastSlice != null) SFX.wheelTick(); spin.lastSlice = idx; }
    if (k < 1) next(); else { cancelAnimationFrame(raf); clearTimeout(backup); wheelDone(); }
  };
  next();
}

function wheelDone() {
  const id = wheel.result, k = CARDS[id];
  wheel.done = true;
  SFX.upgrade(Math.max(0, RARITIES.indexOf(k.rarity)) + 1);
  document.getElementById('wheel-result').innerHTML = `<b style="color: var(--${id})">${k.name}</b> joins your deck for this run.`;
  const btn = document.getElementById('btn-spin');
  btn.disabled = false;
  btn.textContent = 'Continue';
  document.getElementById('up-keys').textContent = 'Press Space to continue';
}

function takeWheelXp() {
  if (!wheel || wheel.spun) return;
  const n = wheelXp();
  wheel = null;
  SFX.upgrade(1);
  celebrate(`+${n} XP`, COL.xp);
  gainXp(n);                             // may add more picks to the queue (queueLevelUps knows a choice is open)
  openNext();
}

// The random weapon card: one of the weapons you own (user), rolled with the wheel's odds, straight into this run's deck.
const ownedIds = () => { const ids = CARD_IDS.filter(id => (save.owned[id] || 0) > 0); return ids.length ? ids : CARD_IDS; };
function takeRandomWeapon() {
  const id = pickSlice(wheelSlices(ownedIds())).id;
  deck.addCard(id);
  game.won.push(id);
  SFX.upgrade(Math.max(0, RARITIES.indexOf(CARDS[id].rarity)) + 1);
  celebrate(`+ ${CARDS[id].name.toUpperCase()}`, COL[id]);
  toast(`Random weapon: ${CARDS[id].name} joins your deck for this run.`, 'weapon');
}

/* ---------- relic message (after the boss) ---------- */
function renderRelic() {
  document.getElementById('up-title').textContent = `Relic earned: ${BULL.name}`;
  const sub = document.getElementById('up-sub');
  sub.hidden = false;
  sub.textContent = `${BOSS.name} dropped it. It's yours for the rest of this run.`;
  document.getElementById('up-keys').textContent = 'Press Enter to continue';
  choiceCards.innerHTML = `<li class="relic-box">`
    + `<span class="relic-art" aria-hidden="true">${BULL_ICON}</span>`
    + `<ul class="relic-facts">`
    + `<li>Press <kbd>Space</kbd>, or tap the bull icon by your HP bar, to <b>charge</b> a short way forward.</li>`
    + `<li>You can't be hurt while charging, and every enemy you hit is <b>thrown aside</b>.</li>`
    + `<li>The charge <b>scoops up</b> potions, diamonds and XP orbs on the way.</li>`
    + `<li>It recharges in ${BULL.cd} seconds: the ring around the icon fills, then glows when it's ready.</li>`
    + `</ul>`
    + `<button class="start" type="button" id="btn-relic-ok">Got it</button>`
    + `</li>`;
  SFX.flip('legendary');
}
function closeRelic() {
  if (!game.choosing || step?.kind !== 'relic') return;
  openNext();
}

function takeWheel() {
  if (!wheel || !wheel.done) return;
  const id = wheel.result;
  deck.addCard(id);                      // this run's deck only; joins at the next sequence
  game.won.push(id);
  celebrate(`+ ${CARDS[id].name.toUpperCase()}`, COL[id]);
  wheel = null;
  openNext();
}

function pickChoice(i) {
  const c = choices[i];
  if (!game.choosing || !step || step.kind !== 'stat' || !c) return;
  if (c.id === 'weapon') { choices = []; takeRandomWeapon(); openNext(); return; }
  const v = upAmount(c.id, c.rarity), rank = UP_RARITIES.indexOf(c.rarity);
  stats[c.id] += v;
  if (STATS[c.id].cap != null) stats[c.id] = Math.min(STATS[c.id].cap, stats[c.id]);
  picks[c.id].n++;
  picks[c.id].best = Math.max(picks[c.id].best, rank);
  if (c.id === 'hp') { game.player.hp = Math.min(maxHp(), game.player.hp + v); renderHp(false); }
  SFX.upgrade(rank);
  celebrate(`${STATS[c.id].short} ↑`, COL[`r-${c.rarity}`]);
  choices = [];
  renderStats(c.id);
  openNext();
}

function pickSlot(i) {
  if (!game.choosing || !step || step.kind !== 'aug' || i < 0 || i >= SEQUENCE_SIZE || game.aug.has(i)) return;
  game.aug.add(i);
  SFX.upgrade(4);
  celebrate(`SLOT ${i + 1} ×2`, COL['r-legendary']);
  renderTray(false);
  const li = trayEl.children[i];
  if (li) { li.classList.remove('aug-new'); void li.offsetWidth; li.classList.add('aug-new'); }
  openNext();
}

function celebrate(text, color) {
  const p = game.player;
  game.floaters = game.floaters.filter(f => !f.pick && !f.text.startsWith('LEVEL'));   // the newest pick's label replaces the last
  game.rings.push({ x: p.x, y: p.y, r: PLAYER.r, max: 70, life: 0.5, color });
  game.floaters.push({ x: p.x, y: p.y - PLAYER.r - 14, text, color, life: 0.9, vy: -34, big: true, pick: true });
}

function closeChoice() {
  step = null;
  wheel = null;
  game.choosing = false;
  game.shield = SHIELD.linger;           // a moment of safety as the fight starts again
  last = performance.now();              // the paused time isn't one long frame
  choiceEl.hidden = true;
  document.activeElement?.blur();
}

choiceCards.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.classList.contains('upcard')) pickChoice(Number(b.dataset.i));
  else if (b.classList.contains('slotcard')) pickSlot(Number(b.dataset.slot));
  else if (b.id === 'btn-spin') { if (wheel?.done) takeWheel(); else spinWheel(); }
  else if (b.id === 'btn-wheel-xp') takeWheelXp();
  else if (b.id === 'btn-relic-ok') closeRelic();
});
// Number keys pick: 1–3 for stat cards, 1–7 for slots (arena.js hands keys over while choosing).
// Returns true if it used the key, so WASD and the arrows keep moving the player.
function onChoiceKey(e) {
  if (step?.kind === 'relic') {
    // Enter or Space closes it, but not in its first moment, so a Space held for BULL doesn't skip the message.
    if (e.code === 'Enter' || e.code === 'Space') { if (!e.repeat && performance.now() - step.at > 600) closeRelic(); e.preventDefault(); return true; }
    return false;
  }
  if (step?.kind === 'wheel') {
    if (e.code === 'Space' || e.code === 'Enter') { if (!e.repeat) { if (wheel?.done) takeWheel(); else spinWheel(); } e.preventDefault(); return true; }
    if (e.code === 'KeyX') { if (!e.repeat) takeWheelXp(); e.preventDefault(); return true; }
    return false;
  }
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
  if (!m) return false;
  if (e.repeat) return true;
  const n = Number(m[1]) - 1;
  if (step?.kind === 'stat') pickChoice(n); else pickSlot(n);
  e.preventDefault();
  return true;
}

/* ---------- stats panel (left side) ---------- */
const statsEl = document.getElementById('statpanel');
statsEl.innerHTML = STAT_IDS.map(id =>
  `<li data-stat="${id}" title="${STATS[id].name}">`
  + `<span class="st-name"><span class="st-long">${STATS[id].name}</span><span class="st-short">${STATS[id].short}</span></span>`
  + `<b class="st-val"></b><span class="st-pips"></span></li>`).join('');

// Upgraded stats light up in the colour of the best rarity picked for them, with a pip per pick.
// `changed` flashes that row and counts its number up.
function renderStats(changed = null) {
  for (const li of statsEl.children) {
    const id = li.dataset.stat, pk = picks[id];
    li.classList.toggle('is-up', pk.n > 0);
    li.classList.toggle('is-max', capped(id));
    if (pk.best >= 0) li.style.setProperty('--rc', `var(--r-${UP_RARITIES[pk.best]})`);
    else li.style.removeProperty('--rc');
    li.querySelector('.st-pips').innerHTML = pk.n > 5 ? `<i></i>×${pk.n}` : '<i></i>'.repeat(pk.n);
    const val = li.querySelector('.st-val');
    val.countId = (val.countId || 0) + 1;     // stops any count-up still running on this row
    if (id === changed && animOk) countUp(val, STATS[id].show());
    else val.textContent = STATS[id].show();
    li.setAttribute('aria-label', `${STATS[id].name} ${STATS[id].show()}${pk.n ? `, upgraded ${pk.n} time${pk.n === 1 ? '' : 's'}` : ''}${capped(id) ? ', at its limit' : ''}`);
    if (id === changed) { li.classList.remove('bump'); void li.offsetWidth; li.classList.add('bump'); }
  }
}
// Counts the number in a formatted value ("+16%", "0.62s", "120") up from what it showed before.
function countUp(el, to) {
  const from = parseFloat((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
  const m = to.match(/-?\d+(\.\d+)?/);
  if (!m) { el.textContent = to; return; }
  const target = parseFloat(m[0]), dec = (m[1] || '').length - (m[1] ? 1 : 0), t0 = performance.now(), run = el.countId;
  const step = now => {
    if (el.countId !== run) return;
    const k = Math.min(1, (now - t0) / 450), e = 1 - (1 - k) ** 3;
    el.textContent = to.replace(m[0], (from + (target - from) * e).toFixed(dec));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

resetStats();
