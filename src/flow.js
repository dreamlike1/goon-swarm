/* flow.js — The run's clock (v0.52, user): swarms by the clock, then a boss, three times over, and the bar at the top
   that shows how far along you are. Levelling up no longer calls the bosses; it's just for your upgrades. */
'use strict';

/* The stages (user): a normal swarm (50 s since v0.57; 30 s before), then a huge one, then the stage's boss; after it's down, the next stage.
   The clock stops while a boss is up. Each stage's time is cut into waves, one per entry of its `plan`, and every wave
   is one swarm type (below). Numbers are placeholders apart from the user's 30 s and 1:30. */
const FLOW = {
  stages: [
    // v0.57 (user: "make the HUGE swarm shorter but more challenging", and before it, time to meet the enemies and
    // adapt): 50 s of normal swarm in steps (PLAN_DEFS), then 30 s of huge swarm (30 s + 60 s before)
    { boss: 'boss',   name: 'SKURTOSAURUS', normal: 50, huge: 30 },
    { boss: 'obi',    name: 'OBI ONE',      normal: 50, huge: 30 },
    { boss: 'snek',   name: 'AWAS THE SNEK', normal: 50, huge: 30 },   // v0.54 (user): a new boss; MAKORA, which never stays down, stays last
    { boss: 'makora', name: 'MAKORA',       normal: 50, huge: 30 },
  ],
  // a huge swarm: this many times the field's usual count (`min`, `max`, capped at `cap`) and the spawn gap (`every`)
  // (v0.57: shorter, so denser and faster: ×1.6 / ×1.8 / ×0.6, cap 50, before)
  huge: { min: 2, max: 2.3, every: 0.45, cap: 60 },
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
  bossHp: { window: 30, cap: 2.5, last: { boss: 40, obi: 55, snek: 45, makora: 70 } },   // (makora: 12, its first life, before v0.69)
  sprinkle: 0.15,     // the extra enemy's share of a wave
  // v0.55 (user: a fast weapon like the Gatling shreds the swarm, a slow one like the Bullet or Cannon lets it pile up
  // and it's too tanky): the swarm follows how well you keep up. How full the field is (against this moment's most)
  // is smoothed over `tau` s; above `aim` (it's piling up) the swarm shrinks, below it (you clear it as fast as it
  // comes) it grows, between `min` and `max` times
  // its size. It eases toward keeping the field `aim` full: the further off, the faster (`up` / `down` a second for
  // each 10% off). It carries over from stage to stage, and stands still while a boss is up. The field never goes
  // past `cap`. Placeholders.
  press: { tau: 4, aim: 0.8, up: 0.012, down: 0.025, min: 0.55, max: 2, cap: 72 },
  // v0.57 (user: "the first swarm, even after the boss, is a test swarm"): each stage's first wave (easy enemies)
  // measures you. If you defeat at least `at` of what spawned in it (user: 80%; half at first), part of the rest of
  // the stage's swarm comes in tougher: `share` of the enemies (from the first number at `at`, to the second when you
  // kill as many as spawn) get `hp` times their health (the same from–to). Only some, so it stays fair, and nothing
  // says so or marks them (user: subtle, they adapt on their own). (Tougher rather than double the spawns: the field
  // is already up to ×2 from `press`, and more at once would crowd the screen and slow it.) Each stage tests again.
  test: { at: 0.8, share: [0.15, 0.4], hp: [1.5, 2.2] },
  // v0.57 (user: easy types first, then tougher types, "then the reds become tougher in health"): from the stage's
  // wave `from` on, the basic shapes (`units`) get more health, rising wave by wave to `max` more at the stage's end.
  vet: { from: 3, max: 0.5, units: ['red', 'split', 'tri', 'big'] },
  // v0.57 (user: "the enemies adapt to your stats, but not right away: a bit of breathing room"): new enemies' health
  // follows your damage output (damage, attack speed, crits) and their hits how hard you are to kill (HP, dodge,
  // regen; and your armor), as they were `delay` s ago, eased in over `tau` s, and only a share of each gain (`hp`,
  // `dmg`, `armor`) so an upgrade still feels like one. It counts swarm time only (not boss fights). (Before: health
  // followed your Base damage at once, ENEMY_HP_SCALE.power.) Placeholders.
  adapt: { delay: 20, tau: 12, hp: 0.3, dmg: 0.3, armor: 0.35 },
};
const stageTime = S => S.normal + S.huge;
// v0.69 (user): beating MAKORA sends you back to stage 1 as the next run (makora.js nextRun), keeping your level and
// deck. Each run after the first: the swarm's health and damage, and the other bosses' health, go up by this share.
const RUN = { enemyHp: 0.5, enemyDmg: 0.25, bossHp: 0.4 };
const runHp = () => 1 + RUN.enemyHp * ((game.flow?.run || 1) - 1);
const runDmg = () => 1 + RUN.enemyDmg * ((game.flow?.run || 1) - 1);
const runBossHp = () => 1 + RUN.bossHp * ((game.flow?.run || 1) - 1);
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
for (const k in UNITS) UNITS[k].id = k;   // (FLOW.vet: which unit spawned)
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
//   4 (v0.54, MAKORA's since AWAS THE SNEK took stage 3): mixes of up to 3
// v0.52 (user: more variety): 10 s waves (15 before), picks from everything your level allows (not just the newest
// three) without repeating the last two, and a 'pick' or a mix also gets a sprinkle of one other enemy (FLOW.sprinkle).
// v0.57 (user: let the player adapt): each stage's normal swarm goes in steps, one 10 s wave each: easy enemies
// first (the test swarm, FLOW.test), then the stage's tougher types on their own, then mixes with the easy ones back
// in (now with more health, FLOW.vet); then the huge swarm deals out mixes. 'easy': one of stage 1's easier types.
const PLAN_DEFS = [
  { normal: ['reds', 'pick', 'pick', { mix: 2, with: 'reds' }, { mix: 2, with: 'reds' }], huge: { mix: 3 } },
  { normal: ['easy', 'crabs', 'lungers', 'booms', { mix: 3, with: 'reds' }], huge: { mix: 3 } },
  { normal: ['easy', 'shooters', { mix: 2, with: 'shooters' }, { mix: 2, with: 'reds' }, { mix: 3, with: 'reds' }], huge: { mix: 3 } },
  { normal: ['easy', { mix: 3, with: 'shooters' }, { mix: 3 }, { mix: 3, with: 'reds' }, { mix: 3, with: 'reds' }], huge: { mix: 3 } },
];
const PLANS = PLAN_DEFS.map((P, i) => {
  const S = FLOW.stages[i], nN = Math.round(S.normal / FLOW.wave), nH = Math.round(S.huge / FLOW.wave);
  return [...Array.from({ length: nN }, (_, k) => P.normal[Math.min(k, P.normal.length - 1)]), ...Array(nH).fill(P.huge)];
});
const NEW_SWARMS = [[], ['crabs', 'lungers', 'booms'], ['shooters', 'crabs', 'lungers', 'booms'], ['shooters', 'crabs', 'lungers', 'booms']];   // what each stage brings in

const isBossUp = () => !!(game.boss || game.obi || game.makora || game.snek || game.dying || game.bossDue || game.obiDue || game.snekDue || game.makoraDue || game.intro || game.cine);

function resetFlow() {
  game.flow = { run: 1, stage: 0, t: 0, wave: -1, swarm: null, name: '', huge: false, state: 'swarm', beaten: [], sweep: 0, dmg: [], boost: 1, press: 1, full: 0.8 };
  game.deckN = runCards().length + runWild().length;   // for the swarm's size (deckBoost; both decks count, v0.53)
  game.runT = 0;
  game.tally = { dealt: {}, taken: 0, plays: {}, kos: {}, combos: {}, hurt: {}, by: '' };
  game.adapt = null;                                         // (FLOW.adapt starts again)   // (plays … by: the online run log, v0.57)
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
    f.stage++; f.t = 0; f.wave = -1; f.huge = false; f.state = 'swarm'; f.dmg = []; f.boost = 1; f.tough = null; f.test = null;
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
  pressStep(f, dt);
  adaptStep(dt);                                             // (FLOW.adapt: swarm time only)
  const w = Math.min(plan.length - 1, Math.floor(f.t / (total / plan.length)));
  if (w !== f.wave) {
    if (f.wave === 0) endTest(f);                            // the test swarm is over: how did you do? (FLOW.test)
    if (w === 0) { f.test = { spawned: 0, killed: 0, on: true }; f.tough = null; }   // the stage's first wave: the test
    f.wave = w; dealWave(f, plan[w]);
  }
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
// The test swarm (FLOW.test): spawnEnemy and hitEnemy count it while `on`; this says what it means for the stage.
function endTest(f) {
  const T = FLOW.test, t = f.test;
  if (!t?.on) return;
  t.on = false;
  t.ratio = t.spawned ? Math.round(t.killed / t.spawned * 100) / 100 : 0;
  if (t.spawned < 4 || t.ratio < T.at) { f.tough = null; return; }    // (too few to judge, or it got on top of you)
  const q = Math.min(1, (t.ratio - T.at) / (1 - T.at)), mix = ([a, b]) => Math.round((a + (b - a) * q) * 100) / 100;
  f.tough = { share: mix(T.share), hp: mix(T.hp) };   // (no word of it: user, v0.57)
}
// FLOW.adapt: your damage output and toughness now, against a fresh run's (BASE_STATS), and the swarm following them.
const offense0 = () => (1 + BASE_STATS.dmg) / (1 - BASE_STATS.atk) * (1 + BASE_STATS.crit * BASE_STATS.critDmg);   // (upgrades.js loads later)
const offenseNow = () => (1 + (stats.dmg || 0)) * ATTACK_INTERVAL / Math.max(MIN_INTERVAL, ATTACK_INTERVAL * (1 - (stats.atk || 0)))
  * (1 + critChance() * (stats.critDmg || 0)) / offense0();
const defenseNow = () => maxHp() / PLAYER.hp / (1 - dodgeChance()) * (1 + (stats.regen || 0) / 5);
function adaptStep(dt) {
  const A = FLOW.adapt, a = game.adapt || (game.adapt = { t: 0, off: 1, def: 1, armor: 0, hist: [], last: -1 });
  a.t += dt;
  if (Math.floor(a.t) !== a.last) { a.last = Math.floor(a.t); a.hist.push([a.t, offenseNow(), defenseNow(), stats.armor || 0]); }
  while (a.hist.length > 1 && a.hist[1][0] <= a.t - A.delay) a.hist.shift();
  const [t0, off, def, armor] = a.hist[0];
  if (t0 > a.t - A.delay) return;                             // the breathing room: nothing that old yet
  const k = Math.min(1, dt / A.tau);
  a.off += (off - a.off) * k; a.def += (def - a.def) * k; a.armor += (armor - a.armor) * k;
}
const adaptHp = () => 1 + FLOW.adapt.hp * Math.max(0, (game.adapt?.off || 1) - 1);
const adaptDmg = () => 1 + FLOW.adapt.dmg * Math.max(0, (game.adapt?.def || 1) - 1);
const adaptArmor = () => Math.round(FLOW.adapt.armor * (game.adapt?.armor || 0));
// FLOW.vet: the basic shapes' extra health in this wave of the stage.
function vetHp(u) {
  const V = FLOW.vet, f = game.flow, plan = f && PLANS[f.stage];
  if (!plan || f.state !== 'swarm' || f.wave < V.from || !V.units.includes(u.id)) return 1;
  return 1 + V.max * Math.min(1, (f.wave - V.from + 1) / (plan.length - V.from));
}
const testCount = (k, n = 1) => { const t = game.flow?.test; if (t?.on && !game.practice) t[k] += n; };
function callBoss(f) {
  const S = FLOW.stages[f.stage];
  f.state = 'boss';
  f.boost = bossBoost(f, S.boss);
  if (f.boost >= 1.05) toast(`${S.name} TOUGHENS UP · HEALTH ×${f.boost.toFixed(1)}`, 'enrage');
  if (S.boss === 'boss') game.bossDue = true;
  else if (S.boss === 'obi') game.obiDue = true;
  else if (S.boss === 'snek') game.snekDue = true;
  else game.makoraDue = true;
}
// How much more health this stage's boss gets for your damage (FLOW.bossHp): 1 to cap.
const BOSS_FIGHT_HP = { boss: () => BOSS.hp + BOSS.phase2.hp, obi: () => OBI.hp + OBI.phase2.hp + OBI.phase3.hp, snek: () => SNEK.hp + SNEK.phase2.hp, makora: () => MAKORA.hp };
function bossBoost(f, kind) {
  const B = FLOW.bossHp, span = Math.min(B.window, f.t);
  if (span < 5) return 1;                                    // (too little to go on: a boss called early, from the test panel)
  let dealt = 0;
  for (let s = Math.max(0, Math.floor(f.t - B.window)); s < f.dmg.length; s++) dealt += f.dmg[s] || 0;
  f.dps = Math.round(dealt / span);                         // (the run log says why: online.js runRecord)
  const want = dealt / span * B.last[kind], has = BOSS_FIGHT_HP[kind]() * coopBossHp() * (kind === 'makora' ? runK('hp') : runBossHp());   // (co-op's and the run's extra health count already)
  return Math.round(Math.max(1, Math.min(B.cap, want / has)) * 100) / 100;
}
// Every boss's health (boss.js, obi.js, snek.js): co-op's extra, the boost for your damage, and the run (RUN). MAKORA
// has its own for the run (makora.js MAKORA.run), so it leaves that out.
const bossHpMul = (run = true) => coopBossHp() * (game.flow?.boost || 1) * (run ? runBossHp() : 1);

// User: drops left on the floor when the boss is about to come fly to you (as a diamond's MAGNET does).
const dropsLeft = () => game.orbs.length + game.potions.length + game.diamonds.length > 0;
function pullDrops() {
  for (const o of game.orbs) { o.magnetized = true; o.vacuum = true; }
  for (const d of game.potions.concat(game.diamonds)) d.vacuum = true;
}

// The next wave's swarm type: a plan entry is a swarm type's id, 'pick' (stage 1's menu) or a mix. A pick or a mix
// gets a sprinkle of one other enemy you've met by now, for variety. `f.swarm`: [unit, weight] pairs.
// v0.70 (user: "runs after run 1, the starting swarm is unique and a combination of all"): from run 2 on, every wave
// of every stage is a mix of swarm types from the whole game (stage 1's, the crabs, lungers, exploders and shooters),
// never the same mix twice in a run, with at least one of each half. `RUN_MIX`: how many types a wave mixes, by run.
const RUN_MIX = { base: 3, every: 2, most: 5 };                 // run 2–3: 3 types, run 4–5: 4, run 6 on: 5
const EARLY_SWARMS = STAGE1_MENU, LATE_SWARMS = ['crabs', 'lungers', 'booms', 'shooters'];
function runMix(f) {
  const n = Math.min(RUN_MIX.most, RUN_MIX.base + Math.floor(((f.run || 1) - 2) / RUN_MIX.every));
  const used = f.mixes || (f.mixes = []), pick = a => a[Math.floor(Math.random() * a.length)];
  let ids = null;
  for (let tries = 0; tries < 30; tries++) {
    const out = [pick(LATE_SWARMS), pick(EARLY_SWARMS)];
    while (out.length < n) { const id = pick([...EARLY_SWARMS, ...LATE_SWARMS].filter(x => !out.includes(x))); if (!id) break; out.push(id); }
    const key = [...new Set(out.flatMap(id => SWARMS[id].units))].sort().join('+');
    ids = out;
    if (!used.includes(key)) { used.push(key); break; }        // (a mix this run hasn't had: by its enemies, not its names)
  }
  return ids;
}
function dealWave(f, entry) {
  let ids;
  if ((f.run || 1) >= 2) ids = runMix(f);
  else if (entry === 'pick') ids = [pickFromMenu(f.recent || [])];
  else if (entry === 'easy') { const e = openMenu().slice(0, 3); ids = [e[Math.floor(Math.random() * e.length)]]; }   // (v0.57: the test swarm after stage 1)
  else if (typeof entry === 'string') ids = [entry];
  else ids = mixSwarms(f.stage, entry.mix, entry.with);
  f.recent = [ids.join('+'), ...(f.recent || [])].slice(0, 2);
  const units = [...new Set(ids.flatMap(id => SWARMS[id].units))];
  f.swarm = units.map(k => [k, UNITS[k].w]);
  f.name = ids.map(id => SWARMS[id].name).join(' + ');
  if ((f.run || 1) < 2 && (typeof entry !== 'string' || entry === 'pick' || entry === 'easy')) {
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
  const open = openMenu().slice(-4), fresh = NEW_SWARMS[stage].length ? NEW_SWARMS[stage] : open.slice(-3);   // (stage 1: its newest types)
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
  const k = game.flow?.press || 1;                          // how well you keep up (pressStep)
  const cap = Math.min(FLOW.press.cap, (huge ? H.cap : SWARM.cap) * (1 + D.cap * b) * Math.max(1, k)), more = (1 + D.more * b) * k;
  return {
    min: Math.max(2, Math.min(cap, swarmMin(game.level) * (huge ? H.min : 1) * more)) * c,
    max: Math.max(3, Math.min(cap, swarmMax(game.level) * (huge ? H.max : 1) * more)) * c,
    every: spawnEvery(game.level) * (huge ? H.every : 1) / (1 + D.faster * b) / Math.sqrt(k),
  };
}
// For the online run log (v0.57, user: the admin view, "how much the swarm changed from the normal to the adjusted,
// what adjusted and why"): this moment's swarm against the level's normal one (solo, no huge swarm, no boosts), and
// each thing that changed it: the huge swarm, your deck's size, how well you kept up, the field's cap, a boss's health.
function swarmReport() {
  const f = game.flow || {}, D = FLOW.deck, H = FLOW.huge, P = FLOW.press, lv = game.level, now = swarmNow();
  const boost = deckBoost(), share = heavyShare(D.bigShare), b = boost * share, k = f.press || 1, r2 = n => Math.round(n * 100) / 100;
  return {
    normal: { min: swarmMin(lv), max: swarmMax(lv), every: r2(spawnEvery(lv)) },
    now: { min: Math.round(now.min), max: Math.round(now.max), every: r2(now.every) },
    huge: f.huge ? { min: H.min, max: H.max, every: H.every } : null,
    deck: { cards: game.deckN || 0, from: D.from, full: DECK_LIMIT, boost: r2(boost), share: r2(share), more: r2(D.more * b), faster: r2(D.faster * b) },
    press: { k: r2(k), full: r2(f.full ?? P.aim), aim: P.aim, min: P.min, max: P.max },
    cap: Math.round(Math.min(P.cap, (f.huge ? H.cap : SWARM.cap) * (1 + D.cap * b) * Math.max(1, k))),
    boss: f.state === 'boss' ? { hp: f.boost || 1, dps: f.dps || 0, cap: FLOW.bossHp.cap, window: FLOW.bossHp.window } : null,
    test: f.test ? { spawned: f.test.spawned, killed: f.test.killed, ratio: f.test.ratio ?? null, on: !!f.test.on, at: FLOW.test.at } : null,
    tough: f.tough || null,
    adapt: game.adapt ? { hp: r2(adaptHp()), dmg: r2(adaptDmg()), armor: adaptArmor(), off: r2(game.adapt.off), def: r2(game.adapt.def), offNow: r2(offenseNow()), defNow: r2(defenseNow()), delay: FLOW.adapt.delay } : null,
    vet: f.state === 'swarm' && f.wave >= FLOW.vet.from ? r2(1 + FLOW.vet.max * Math.min(1, (f.wave - FLOW.vet.from + 1) / (PLANS[f.stage].length - FLOW.vet.from))) : 1,
  };
}
// The swarm's size follows how full you let the field get (FLOW.press): piling up, it shrinks; cleared, it grows.
function pressStep(f, dt) {
  const P = FLOW.press, S = swarmNow(), full = S.max > 0 ? Math.min(1.2, fieldLoad() / S.max) : 0;
  f.full = (f.full ?? 0.8) + (full - (f.full ?? 0.8)) * Math.min(1, dt / P.tau);
  f.press = f.press ?? 1;
  const off = (f.full - P.aim) * 10;                          // (in tens of percent)
  f.press -= (off > 0 ? P.down : P.up) * off * dt;
  f.press = Math.max(P.min, Math.min(P.max, f.press));
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
// For the online run log (v0.57, user: the admin view, to see which weapons to nerf or buff): how often each card came
// up, what each one finished off, its ×3 / ×7 combos, and what hurt you (and what landed the last hit).
const tallyAdd = (o, k, n = 1) => { if (o && k) o[k] = (o[k] || 0) + n; };
const tallyPlay = card => tallyAdd(game.tally?.plays, card);
const tallyKill = card => { if (card !== 'boom') tallyAdd(game.tally?.kos, card); };
function tallyCombo(cb) {
  const c = game.tally?.combos;
  if (!c) return;
  c[cb.card] = c[cb.card] || {};
  tallyAdd(c[cb.card], cb.n);
}
// What hurt you: an enemy (its kind), a name (a boss's attack, an enemy's shot), or, left out, whichever boss is up.
const enemyName = e => e.boom ? 'Exploder' : e.split ? `Split ${(ENEMY_TYPES[e.type]?.name || 'enemy').toLowerCase()}` : ENEMY_TYPES[e.type]?.name || 'Enemy';
function hitName(by) {
  if (typeof by === 'string') return by;
  if (by && !(by.boss || by.obi || by.makora)) return enemyName(by);
  return game.makora ? 'MAKORA' : game.obi ? 'OBI ONE' : game.snek ? 'AWAS THE SNEK' : game.boss ? 'SKURTOSAURUS' : 'Enemy';
}
function tallyHurt(by, dmg, last) {
  const t = game.tally;
  if (!t) return;
  const name = hitName(by);
  tallyAdd(t.hurt, name, dmg);
  if (last) t.by = name;
}

/* ---------- the bar at the top (user: progress with the 3 bosses on it) ---------- */
// Three equal stretches, one per stage, each ending at its boss. The red part of each is its huge swarm. A stretch
// fills in its boss's colour; a beaten boss's marker is filled in.
const runbarEl = document.getElementById('runbar');
const RB_COL = ['boss', 'saber', 'snek', 'wheel'];
// the markers' icons (user: no names on the bar): SKURTOSAURUS's footprint, OBI ONE's saber, AWAS's apple, MAKORA's wheel
const RB_ICON = [
  '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="16" rx="5" ry="5.5"/><ellipse cx="5.5" cy="8.5" rx="2.2" ry="3.4" transform="rotate(-25 5.5 8.5)"/><ellipse cx="12" cy="5.5" rx="2.2" ry="3.6"/><ellipse cx="18.5" cy="8.5" rx="2.2" ry="3.4" transform="rotate(25 18.5 8.5)"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M8 16L20 4" stroke-width="3"/><path d="M4.5 19.5L8 16" stroke-width="4.5"/><path d="M6 14l4 4" stroke-width="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7.5c-1.6-1.2-4.2-1.4-5.9.1C4 9.4 4.2 13 5.6 15.8 7 18.6 9.3 20.6 12 19.2c2.7 1.4 5-.6 6.4-3.4 1.4-2.8 1.6-6.4-.5-8.2-1.7-1.5-4.3-1.3-5.9-.1z"/><path d="M12 7.5c0-1.8.6-3.2 1.8-4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.4 5.2c1.4-1.4 3.4-1.6 4.8-1-.6 1.6-2.6 2.6-4.8 1z"/></svg>',
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
  const key = `${f.run}|${f.stage}|${f.state}|${f.huge}|${Math.floor(game.runT || 0)}|${Math.round(at * 400)}`;
  if (key === rbKey) return;
  rbKey = key;
  runbarEl.querySelectorAll('.rb-fill').forEach((el, i) => el.style.width = `${Math.max(0, Math.min(1, (at * n - i))) / n * 100}%`);
  runbarEl.querySelector('.rb-knob').style.left = `${at * 100}%`;
  runbarEl.querySelectorAll('.rb-node').forEach((el, i) => {
    el.classList.toggle('is-done', f.beaten.includes(FLOW.stages[i].boss));
    el.classList.toggle('is-up', i === f.stage && f.state === 'boss');
  });
  const now = f.state === 'sweep' ? 'BOSS INCOMING' : f.state === 'swarm' ? (f.huge ? 'HUGE SWARM' : 'SWARM') : f.state === 'cleared' ? 'RUN CLEARED' : 'BOSS FIGHT';
  runbarEl.querySelector('.rb-now').textContent = now;
  const run = runbarEl.querySelector('.rb-run');
  if (run && run.dataset.n !== String(f.run || 1)) { run.dataset.n = f.run || 1; run.innerHTML = runBadge(f.run || 1); run.setAttribute('aria-label', `Run ${f.run || 1}`); }
  runbarEl.querySelector('.rb-now').className = 'rb-now' + (f.state !== 'swarm' ? ' is-boss' : f.huge ? ' is-huge' : '');
  runbarEl.querySelector('.rb-time').textContent = clockText(game.runT || 0);
  runbarEl.setAttribute('aria-valuenow', Math.round(at * 100));
  runbarEl.setAttribute('aria-valuetext', `Run ${f.run || 1}, stage ${f.stage + 1} of ${n}: ${now}`);
}
const clockText = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
// The run's badge (v0.69, user: "the icon of the run is a number and a wheel"): MAKORA's gold wheel with the run's
// number in it. The run bar, the end-of-run screen and the leaderboard (online.js) all use it.
function runBadge(n) {
  const spokes = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    return `<path d="M${(12 + c * 8.6).toFixed(2)} ${(12 + s * 8.6).toFixed(2)}L${(12 + c * 10.6).toFixed(2)} ${(12 + s * 10.6).toFixed(2)}"/><circle cx="${(12 + c * 11.2).toFixed(2)}" cy="${(12 + s * 11.2).toFixed(2)}" r="1.25" fill="currentColor" stroke="none"/>`; }).join('');
  return `<svg class="run-wheel" viewBox="-1 -1 26 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/>${spokes}</svg><b>${n}</b>`;
}
