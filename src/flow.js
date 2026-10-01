/* flow.js — The run's clock (v0.52, user): swarms by the clock, then a boss, three times over, and the bar at the top
   that shows how far along you are. Levelling up no longer calls the bosses; it's just for your upgrades. */
'use strict';

/* The stages (user): a normal swarm for 30 s, then a huge one, then the stage's boss; after it's down, the next stage.
   The clock stops while a boss is up. Each stage's time is cut into waves, one per entry of its `plan`, and every wave
   is one swarm type (below). Numbers are placeholders apart from the user's 30 s and 1:30. */
const FLOW = {
  stages: [
    { boss: 'boss',   name: 'SKURTOSAURUS', normal: 30, huge: 60 },
    { boss: 'obi',    name: 'OBI ONE',      normal: 30, huge: 60 },
    { boss: 'makora', name: 'MAKORA',       normal: 30, huge: 60 },
  ],
  // a huge swarm: this many times the field's usual count (`min`, `max`, capped at `cap`) and the spawn gap (`every`)
  huge: { min: 1.6, max: 1.8, every: 0.6, cap: 50 },
  wave: 10,           // seconds a wave (one swarm type) lasts
  sweep: 2.5,         // time's up: drops still on the floor fly to you first, for up to this long, then the boss comes
  // a bigger deck kills faster (user: a full 31-card deck shreds the swarm), so the swarm grows with it: none up to
  // `from` cards, then up to `more` extra at a full deck, and spawns up to `faster` quicker. The field's cap rises by
  // up to `cap`. (v0.52: ×1.6 / ×1.6 / ×1.4 at first; user: too much, the big reds especially.) A swarm of big ones
  // gets only `bigShare` of it.
  deck: { from: 10, more: 0.3, faster: 0.2, cap: 0.15, bigShare: 0.4 },
  // A boss's health follows your damage (user: if you'd kill it too fast, it gets more, but not too beefy): your
  // damage per second over the last `window` s before it comes, times `last` (how long its whole fight should take at
  // that rate; MAKORA: its first life), against its normal health. Only ever more, and at most `cap` times as much.
  // (Damage counted is what the hits actually took off, so overkill on a small enemy doesn't count.)
  bossHp: { window: 30, cap: 2.5, last: { boss: 40, obi: 55, makora: 12 } },
  sprinkle: 0.15,     // the extra enemy's share of a wave
};
const stageTime = S => S.normal + S.huge;
// What a swarm is made of: an enemy type (and its purple version), how often it comes in a mix (`w`), and how much
// room it takes on the field (`n`: the big ones count for more, so a swarm of them is smaller).
const UNITS = {
  red:     { type: 'square', w: 6 },
  split:   { type: 'square', w: 2.5, split: true },
  tri:     { type: 'triangle', w: 5 },
  big:     { type: 'big', w: 3, n: 1.6 },
  crab:    { type: 'raptor', w: 3, n: 1.3 },
  lunger:  { type: 'lunger', w: 3, n: 1.2 },
  boom:    { type: 'triangle', w: 4, boom: true },
  shooter: { type: 'shooter', w: 3, n: 1.3 },
};
// The swarm types (user). `lvl`: you need this level before stage 1 deals it out (user: start with easy swarms, and
// the harder ones only once you've levelled; the hardest at 10). The later stages' mixes draw on them too.
const SWARMS = {
  reds:          { name: 'Reds',                   units: ['red'], lvl: 1 },
  redsSplit:     { name: 'Reds · split reds',      units: ['red', 'split'], lvl: 2 },
  tris:          { name: 'Triangles',              units: ['tri'], lvl: 3 },
  trisReds:      { name: 'Triangles · reds',       units: ['tri', 'red'], lvl: 4 },
  trisRedsSplit: { name: 'Triangles · reds · split', units: ['tri', 'red', 'split'], lvl: 6 },
  bigs:          { name: 'Big reds',               units: ['big'], lvl: 7 },
  bigsTris:      { name: 'Big reds · triangles',   units: ['big', 'tri'], lvl: 8 },
  bigMix:        { name: 'Big reds · triangles · reds · split', units: ['big', 'tri', 'red', 'split'], lvl: 10 },
  crabs:         { name: 'Crabs',     units: ['crab'] },
  lungers:       { name: 'Lungers',   units: ['lunger'] },
  booms:         { name: 'Exploders', units: ['boom'] },
  shooters:      { name: 'Shooters',  units: ['shooter'] },
};
const STAGE1_MENU = ['reds', 'redsSplit', 'tris', 'trisReds', 'trisRedsSplit', 'bigs', 'bigsTris', 'bigMix'];
// Each stage's waves (user): its `intro` in order, then `fill` for the rest of the stage. A wave lasts FLOW.wave s.
//   1: reds first, then picks from the menu above, by your level ('pick')
//   2: crabs, then the lungers, then a mix with crabs in it, exploders only, then mixes of up to 3 swarm types
//   3: shooters, then mixes of 2 swarm types
// v0.52 (user: more variety): 10 s waves (15 before), picks from everything your level allows (not just the newest
// three) without repeating the last two, and a 'pick' or a mix also gets a sprinkle of one other enemy (FLOW.sprinkle).
const PLAN_DEFS = [
  { intro: ['reds'], fill: 'pick' },
  { intro: ['crabs', 'lungers', { mix: 3, with: 'crabs' }, 'booms'], fill: { mix: 3 } },
  { intro: ['shooters'], fill: { mix: 2 } },
];
const PLANS = PLAN_DEFS.map((P, i) => {
  const n = Math.max(P.intro.length, Math.round(stageTime(FLOW.stages[i]) / FLOW.wave));
  return [...P.intro, ...Array(n - P.intro.length).fill(P.fill)];
});
const NEW_SWARMS = [[], ['crabs', 'lungers', 'booms'], ['shooters', 'crabs', 'lungers', 'booms']];   // what each stage brings in

const isBossUp = () => !!(game.boss || game.obi || game.makora || game.bossDue || game.obiDue || game.makoraDue || game.intro || game.cine);

function resetFlow() {
  game.flow = { stage: 0, t: 0, wave: -1, swarm: null, name: '', huge: false, state: 'swarm', beaten: [], sweep: 0, dmg: [], boost: 1 };
  game.deckN = equippedCards().length;   // for the swarm's size (deckBoost)
  game.runT = 0;
  game.tally = { dealt: {}, taken: 0 };
  renderFlow();
}

// One frame of the clock (combat.js update; the host's in co-op). Deals out the waves, says when the huge swarm
// comes, and calls the boss when the stage's time is up.
function flowStep(dt) {
  flowTick(dt);
  renderFlow();
}
function flowTick(dt) {
  const f = game.flow;
  if (game.practice) return;
  if (f.state === 'boss') {
    if (isBossUp()) return;
    f.beaten.push(FLOW.stages[f.stage].boss);                // its boss is down: on to the next stage
    f.stage++; f.t = 0; f.wave = -1; f.huge = false; f.state = 'swarm'; f.dmg = []; f.boost = 1;
    if (f.stage >= FLOW.stages.length) { f.state = 'done'; f.stage = FLOW.stages.length - 1; return; }
  }
  if (f.state === 'sweep') {                                 // time's up: the drops fly to you, then the boss
    f.sweep += dt;
    pullDrops();
    if (f.sweep >= FLOW.sweep || !dropsLeft()) callBoss(f);
    return;
  }
  if (f.state !== 'swarm' || isBossUp()) return;             // (a boss called up some other way, the test panel's: it waits)
  const S = FLOW.stages[f.stage], plan = PLANS[f.stage], total = stageTime(S);
  f.t += dt;
  const w = Math.min(plan.length - 1, Math.floor(f.t / (total / plan.length)));
  if (w !== f.wave) { f.wave = w; dealWave(f, plan[w]); }
  if (!f.huge && f.t >= S.normal) {
    f.huge = true;
    toast('HUGE SWARM INCOMING', 'enrage');
    SFX.growl();
  }
  if (f.t >= total) {                                        // time's up: the stage's boss, once the floor is clear
    f.t = total; f.sweep = 0;
    if (dropsLeft()) { f.state = 'sweep'; pullDrops(); } else callBoss(f);
  }
}
function callBoss(f) {
  const S = FLOW.stages[f.stage];
  f.state = 'boss';
  f.boost = bossBoost(f, S.boss);
  if (f.boost >= 1.05) toast(`${S.name} TOUGHENS UP · HEALTH ×${f.boost.toFixed(1)}`, 'enrage');
  if (S.boss === 'boss') game.bossDue = true;
  else if (S.boss === 'obi') game.obiDue = true;
  else game.makoraDue = true;
}
// How much more health this stage's boss gets for your damage (FLOW.bossHp): 1 to cap.
const BOSS_FIGHT_HP = { boss: () => BOSS.hp + BOSS.phase2.hp, obi: () => OBI.hp + OBI.phase2.hp + OBI.phase3.hp, makora: () => MAKORA.hp };
function bossBoost(f, kind) {
  const B = FLOW.bossHp, span = Math.min(B.window, f.t);
  if (span < 5) return 1;                                    // (too little to go on: a boss called early, from the test panel)
  let dealt = 0;
  for (let s = Math.max(0, Math.floor(f.t - B.window)); s < f.dmg.length; s++) dealt += f.dmg[s] || 0;
  const want = dealt / span * B.last[kind], has = BOSS_FIGHT_HP[kind]() * coopBossHp();   // (co-op's extra health counts already)
  return Math.round(Math.max(1, Math.min(B.cap, want / has)) * 100) / 100;
}
// Every boss's health (boss.js, obi.js, makora.js): co-op's extra, and the boost for your damage.
const bossHpMul = () => coopBossHp() * (game.flow?.boost || 1);

// User: drops left on the floor when the boss is about to come fly to you (as a diamond's MAGNET does).
const dropsLeft = () => game.orbs.length + game.potions.length + game.diamonds.length > 0;
function pullDrops() {
  for (const o of game.orbs) { o.magnetized = true; o.vacuum = true; }
  for (const d of game.potions.concat(game.diamonds)) d.vacuum = true;
}

// The next wave's swarm type: a plan entry is a swarm type's id, 'pick' (stage 1's menu) or a mix. A pick or a mix
// gets a sprinkle of one other enemy you've met by now, for variety. `f.swarm`: [unit, weight] pairs.
function dealWave(f, entry) {
  let ids;
  if (entry === 'pick') ids = [pickFromMenu(f.recent || [])];
  else if (typeof entry === 'string') ids = [entry];
  else ids = mixSwarms(f.stage, entry.mix, entry.with);
  f.recent = [ids.join('+'), ...(f.recent || [])].slice(0, 2);
  const units = [...new Set(ids.flatMap(id => SWARMS[id].units))];
  f.swarm = units.map(k => [k, UNITS[k].w]);
  f.name = ids.map(id => SWARMS[id].name).join(' + ');
  if (typeof entry !== 'string' || entry === 'pick') {
    const extra = metUnits(f.stage).filter(k => !units.includes(k));
    if (extra.length) {
      const k = extra[Math.floor(Math.random() * extra.length)], total = f.swarm.reduce((s, [, w]) => s + w, 0);
      f.swarm.push([k, total * FLOW.sprinkle / (1 - FLOW.sprinkle)]);
    }
  }
}
const openMenu = () => STAGE1_MENU.filter(id => game.level >= SWARMS[id].lvl);
// Every enemy you've met by this stage (and your level).
const metUnits = stage => [...new Set([...openMenu(), ...NEW_SWARMS[stage]].flatMap(id => SWARMS[id].units))];
// Stage 1 (user: easy ones first): any swarm type your level allows, the newer ones more often, and not one of the
// last two again if there's a choice.
function pickFromMenu(recent) {
  const open = openMenu();
  let top = open.filter(id => !recent.includes(id));
  if (!top.length) top = open;
  const wt = i => 1 + i * 0.6;
  let x = Math.random() * top.reduce((s, _, i) => s + wt(i), 0);
  for (let i = 0; i < top.length; i++) if ((x -= wt(i)) < 0) return top[i];
  return top[top.length - 1];
}
// A mix (user): 2 or 3 swarm types at once (up to `n`), at least one of them new this stage, the rest from those and
// the four hardest of stage 1's your level allows.
function mixSwarms(stage, n, must) {
  const fresh = NEW_SWARMS[stage], open = openMenu().slice(-4);
  const k = n <= 2 ? 2 : 2 + (Math.random() < 0.5 ? 1 : 0);
  const out = [must || (stage === 2 && Math.random() < 0.5 ? 'shooters' : fresh[Math.floor(Math.random() * fresh.length)])];
  const pool = [...fresh, ...open];
  while (out.length < k) {
    const left = pool.filter(id => !out.includes(id));
    if (!left.length) break;
    out.push(left[Math.floor(Math.random() * left.length)]);
  }
  return out;
}

// The next enemy for the swarm (combat.js spawnEnemy): one of this wave's units, by weight.
function pickUnit() {
  const list = game.flow?.swarm?.length ? game.flow.swarm : [['red', 1]];
  let x = Math.random() * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list) if ((x -= w) < 0) return UNITS[k];
  return UNITS[list[0][0]];
}
// How much room the swarm takes now (the big ones count for more) and this moment's count and spawn gap.
const fieldLoad = () => game.enemies.reduce((s, e) => s + (e.boss || e.makora || e.obi || e.mrock || e.dummy ? 0 : e.n || 1), 0);
function swarmNow() {
  const H = FLOW.huge, huge = game.flow?.huge, c = coopCount(), D = FLOW.deck, b = deckBoost() * heavyShare(D.bigShare);
  const cap = (huge ? H.cap : SWARM.cap) * (1 + D.cap * b), more = 1 + D.more * b;
  return {
    min: Math.min(cap, swarmMin(game.level) * (huge ? H.min : 1) * more) * c,
    max: Math.min(cap, swarmMax(game.level) * (huge ? H.max : 1) * more) * c,
    every: spawnEvery(game.level) * (huge ? H.every : 1) / (1 + D.faster * b),
  };
}
// How much of the deck's boost this wave gets: all of it, down to `share` for a wave of nothing but big reds.
function heavyShare(share) {
  const list = game.flow?.swarm;
  if (!list?.length) return 1;
  const all = list.reduce((s, [, w]) => s + w, 0), big = list.reduce((s, [k, w]) => s + (k === 'big' ? w : 0), 0);
  return 1 - (1 - share) * big / all;
}
// 0 for a deck of FLOW.deck.from cards or fewer, up to 1 for a full one (DECK_LIMIT)
const deckBoost = () => Math.max(0, Math.min(1, ((game.deckN || 0) - FLOW.deck.from) / (DECK_LIMIT - FLOW.deck.from)));

// For the end-of-run screen: what each weapon dealt, and what you took.
function tallyHit(card, dmg) {
  if (!game.tally || !(dmg > 0) || card === 'boom') return;   // (an exploder's blast hurting the others isn't yours)
  game.tally.dealt[card] = (game.tally.dealt[card] || 0) + dmg;
  const f = game.flow;                                       // and, per second of the stage, for the boss's health
  if (f && f.state === 'swarm' && !isBossUp()) { const s = Math.floor(f.t); f.dmg[s] = (f.dmg[s] || 0) + dmg; }
}

/* ---------- the bar at the top (user: progress with the 3 bosses on it) ---------- */
// Three equal stretches, one per stage, each ending at its boss. The red part of each is its huge swarm. A stretch
// fills in its boss's colour; a beaten boss's marker is filled in.
const runbarEl = document.getElementById('runbar');
const RB_COL = ['boss', 'saber', 'wheel'];
// the markers' icons (user: no names on the bar): SKURTOSAURUS's footprint, OBI ONE's saber, MAKORA's wheel
const RB_ICON = [
  '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="16" rx="5" ry="5.5"/><ellipse cx="5.5" cy="8.5" rx="2.2" ry="3.4" transform="rotate(-25 5.5 8.5)"/><ellipse cx="12" cy="5.5" rx="2.2" ry="3.6"/><ellipse cx="18.5" cy="8.5" rx="2.2" ry="3.4" transform="rotate(25 18.5 8.5)"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M8 16L20 4" stroke-width="3"/><path d="M4.5 19.5L8 16" stroke-width="4.5"/><path d="M6 14l4 4" stroke-width="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
];
function buildRunbar() {
  const track = runbarEl.querySelector('.rb-track');
  track.innerHTML = FLOW.stages.map((S, i) => {
    const from = i / FLOW.stages.length, w = 1 / FLOW.stages.length, h = S.huge / stageTime(S);
    return `<span class="rb-huge" style="left:${(from + w * (1 - h)) * 100}%;width:${w * h * 100}%"></span>`
      + `<span class="rb-fill" style="left:${from * 100}%;--c:var(--${RB_COL[i]})" data-i="${i}"></span>`;
  }).join('') + '<span class="rb-knob"></span>' + FLOW.stages.map((S, i) =>
    `<span class="rb-node" style="left:${(i + 1) / FLOW.stages.length * 100}%;--c:var(--${RB_COL[i]})" data-i="${i}" title="${S.name}">${RB_ICON[i]}</span>`).join('');
}
buildRunbar();
let rbKey = '';
function renderFlow() {
  const f = game.flow;
  if (!f) return;
  const n = FLOW.stages.length, S = FLOW.stages[f.stage];
  const frac = f.state === 'swarm' ? f.t / stageTime(S) : 1;
  const at = (f.stage + frac) / n;
  const key = `${f.stage}|${f.state}|${f.huge}|${Math.floor(game.runT || 0)}|${Math.round(at * 400)}`;
  if (key === rbKey) return;
  rbKey = key;
  runbarEl.querySelectorAll('.rb-fill').forEach((el, i) => el.style.width = `${Math.max(0, Math.min(1, (at * n - i))) / n * 100}%`);
  runbarEl.querySelector('.rb-knob').style.left = `${at * 100}%`;
  runbarEl.querySelectorAll('.rb-node').forEach((el, i) => {
    el.classList.toggle('is-done', f.beaten.includes(FLOW.stages[i].boss));
    el.classList.toggle('is-up', i === f.stage && f.state === 'boss');
  });
  const now = f.state === 'sweep' ? 'BOSS INCOMING' : f.state === 'swarm' ? (f.huge ? 'HUGE SWARM' : 'SWARM') : 'BOSS FIGHT';
  runbarEl.querySelector('.rb-now').textContent = now;
  runbarEl.querySelector('.rb-now').className = 'rb-now' + (f.state !== 'swarm' ? ' is-boss' : f.huge ? ' is-huge' : '');
  runbarEl.querySelector('.rb-time').textContent = clockText(game.runT || 0);
  runbarEl.setAttribute('aria-valuenow', Math.round(at * 100));
  runbarEl.setAttribute('aria-valuetext', `Stage ${f.stage + 1} of ${n}: ${now}`);
}
const clockText = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
