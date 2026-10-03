/* archive.js — The Archives (v0.61, user): the Weapon Archive and the enemies.
   Weapons (user: "clicking on them will open up the new tab Weapon Archive: shows all weapons from common to triple s
   and events. Just a preview of a player and a target and each of their skills. You can't move or anything"): every
   weapon, Common to Triple S, then Event, down the left. The chosen one stands in the middle in front of one target
   that never moves or dies. Click a skill (or 1–3) and it fires; leave it 2 s and the skills play on their own,
   Single, then the Passive, then the Ult, round and round (user: "if you haven't clicked a button after 2 sec it auto
   plays"). Its details and skills down the right.
   Enemies (user: "where you unlock enemies: some you need to encounter to unlock"): the swarm's enemies and the
   bosses. Stage 1's four are open from the start; the rest unlock the first time one turns up in your run
   (`save.seen`). An open one plays in the arena (a swarm enemy comes at you, again and again; a boss stands there),
   with what it does on the right.
   Main menu: Archives opens it; a pack page's Random rows open it on Weapons. It's the store's test mode underneath
   (menus.js startPractice, `game.practice.archive`), with no battle, no keys for moving, and nothing saved. */
'use strict';

const ARCHIVE = {
  singles: 3,                            // auto-play: Single fires this many times before the Passive
  gap: { 1: 0.55, 3: 1.9, 7: 3.6 },      // s after each attack before the next (the Ult's last a while)
  pause: 0.5,                            // … and a little more between skills
  idle: 2,                               // s without a click before the skills play on their own (user)
  box: { w: 940, h: 640, pad: 32 },      // the arena between the two panels (px, at most; v0.64, user: "maximize the space": 620 × 420 before)
  alignFrom: 900,                        // from this wide (style.css: the panels either side) it fills the space between them, level with them
  home: 4,                               // how fast you and the target slide back to your places (per s)
  enemyLoop: 5.5,                        // s before a swarm enemy starts its walk in again
  bossLoop: 12,                          // … and a boss its fight (so its long-range moves come round again; v0.62)
};
// Every weapon, Common first, Event last (cards.js RARITIES), in roster order within a rarity.
const archiveIds = () => RARITIES.flatMap(r => CARD_IDS.filter(id => CARDS[id].rarity === r));
let archiveFrom = null;                  // the screen it goes back to
let archiveTab = 'weapons';

/* ---------- the enemies ---------- */
// `unit`: a swarm enemy (flow.js UNITS); `boss`: which boss. `start`: open from the start (stage 1's). `stage`: where
// you first meet it. The numbers shown are its base ones (they grow with the run).
const ENEMY_ARCHIVE = [
  { id: 'red', unit: 'red', name: 'Red', stage: 1, start: true, col: '--enemy',
    desc: 'The basic red square. It walks straight at you and hurts on touch.' },
  { id: 'split', unit: 'split', name: 'Split red', stage: 1, start: true, col: '--enemy-split', shot: 'kill', moves: ['SPLIT!'],
    desc: 'A red-purple square. When it dies it splits into two smaller reds.', show: 'You shoot it here, so you can see it split.' },
  { id: 'tri', unit: 'tri', name: 'Triangle', stage: 1, start: true, col: '--enemy-fast', pack: 4, moves: ['PACK!'],
    desc: 'Small, fragile and fast. It comes in packs.' },
  { id: 'big', unit: 'big', name: 'Big red', stage: 1, start: true, col: '--enemy-big', shot: 'soak', moves: ['TOUGH!'],
    desc: 'A big, slow square that takes a lot of hits and hits hard.', show: 'You shoot it here: it keeps on coming.' },
  { id: 'crab', unit: 'crab', name: 'Crab', stage: 2, col: '--crab', moves: ['DASH!'],
    desc: `It walks in, and once you're within ${RAPTOR.sight} px it stops, winds up with a short aim line, and dashes at you.` },
  { id: 'lunger', unit: 'lunger', name: 'Lunger', stage: 2, col: '--enemy-lunger', moves: ['LOCK ON', 'LUNGE!'],
    desc: 'A slow amber square. When you come near it lights up, locks on, and lunges at you very fast.' },
  { id: 'boom', unit: 'boom', name: 'Exploder', stage: 2, col: '--enemy-fast-split', moves: ['BOOM!'],
    desc: `A purple triangle. Close to you it stops and flashes faster and faster, then blows up: ${EXPLODER.dmg} to you, and it hurts other enemies too. Shoot it first and it just dies.` },
  { id: 'shooter', unit: 'shooter', name: 'Shooter', stage: 3, col: '--enemy-shooter', moves: ['SHOT!'],
    desc: `A green square that keeps its distance and, every few seconds, glows and fires a slow red orb at where you are.` },
  { id: 'boss', boss: 'boss', name: 'SKURTOSAURUS', stage: 1, col: '--boss', hp: `${BOSS.hp} + ${BOSS.phase2.hp}`, moves: ['CHARGE!', 'ROCK THROW!'],
    desc: 'Stage 1\'s boss. It walks at you, winds up and charges, leaving a ring of rocks, and throws a big fast rock down a lane it shows first. Phase 2: enraged, faster, more charges and throws.',
    drop: 'BULL: Space charges you forward.' },
  { id: 'obi', boss: 'obi', name: 'OBI ONE', stage: 2, col: '--saber', hp: `${OBI.hp} + ${OBI.phase2.hp}`, moves: ['SLICE!', 'DASH!', 'SABER THROW!', 'BLOCK!'],
    desc: 'Stage 2\'s boss, a Jedi with a lightsaber. Slices up close, dashes in from mid range, throws his saber when you\'re far, and blocks: your shots bounce back at you. Phase 2 drags you in with the Force; phase 3 hurls rocks.',
    drop: 'DEFLECT: Q raises a shield that stops one hit.' },
  { id: 'snek', boss: 'snek', name: 'AWAS THE SNEK', stage: 3, col: '--snek', hp: `${SNEK.hp} + ${SNEK.phase2.hp}`, still: true,
    desc: 'Stage 3\'s boss. The arena turns into an old phone screen and AWAS is the Snake game: it can\'t be hurt, so shoot its apples before it eats them. If it eats too many it turns into a huge snake that plunges and spits apples.',
    drop: 'VAMPIRIC BALLSACK: E drains a boss.' },
  { id: 'makora', boss: 'makora', name: 'MAKORA', stage: 4, col: '--makora', hp: `${MAKORA.hp}, more each run`, moves: ['DASH!', 'SLASH!', 'STAB!', 'ROCK THROW!', 'LASERS!'], show: 'It fights you here as in a run, but can\'t hurt you or be hurt. Its lasers come from its second phase; here it uses them from the start.',
    desc: 'The last boss, in 3D. Dashes in and chains slashes and stabs, slams the ground and throws a rock (dodge it and it lobs it back), fires lasers, and once tears open space and time to heal while enemies pour out. It gets harder as it goes down. Beat it and its wheel turns: back to stage 1 for the next run, tougher. Its wheel has 8 spokes.' },
];
const ENEMY_BY = Object.fromEntries(ENEMY_ARCHIVE.map(x => [x.id, x]));
// v0.62 (user: "also show special things enemies does! like the splitting and dashing those stuff"): when one of them
// does its thing in the arena, its name pops up over it (`moves` in each entry, listed in its details too). Here: the
// AI state each word goes with, per enemy. Split red, Big red (shot at) and the Exploder say theirs in archiveEnemyStep.
const ENEMY_MOVE = {
  crab: { charge: 'DASH!' }, lunger: { glow: 'LOCK ON', dash: 'LUNGE!' },
  boss: { windup: 'CHARGE!' }, obi: { slice: 'SLICE!', dashwind: 'DASH!', throwwind: 'SABER THROW!', block: 'BLOCK!' },
  makora: { dash: 'DASH!', slash: 'SLASH!', stab: 'STAB!', slam: 'ROCK THROW!', laser: 'LASERS!' },
};
const enemySeen = id => !!ENEMY_BY[id]?.start || !!save.seen?.[id];
const enemyOpen = () => ENEMY_ARCHIVE.filter(x => enemySeen(x.id)).length;

// Which archive entry an enemy in a run is (null: not one, like a test dummy or an apple).
function enemyEntry(e) {
  if (e.boss) return 'boss';
  if (e.obi) return 'obi';
  if (e.makora) return 'makora';
  if (e.dummy || e.apple || e.mrock || e.hugeSnek) return null;
  return { square: e.split ? 'split' : 'red', big: 'big', triangle: e.boom ? 'boom' : 'tri', raptor: 'crab', lunger: 'lunger', shooter: 'shooter' }[e.type] || null;
}
// In a run (main.js, every frame; it looks twice a second): anything new you meet unlocks (host or guest alike).
let seenAt = 0;
function archiveSeen() {
  if (game.inMenu || game.practice || game.over) return;
  const now = performance.now();
  if (now - seenAt < 500) return;
  seenAt = now;
  const met = new Set(game.enemies.map(enemyEntry).filter(Boolean));
  if (game.snek) met.add('snek');
  if (game.makora) met.add('makora');
  for (const id of met) {
    if (enemySeen(id)) continue;
    save.seen = { ...(save.seen || {}), [id]: true };
    writeSave();
    toast(`New in the Archives: ${ENEMY_BY[id].name}`);
  }
}

/* ---------- opening and closing ---------- */
function openArchive(rarity = 'common', card = null, tab = 'weapons') {
  const ids = archiveIds();
  archiveFrom = current;
  stopMenuDemo();
  archiveTab = tab;
  startPractice(null, card || ids.find(id => CARDS[id].rarity === rarity) || ids[0], { archive: true, battle: false, next: 0, playing: -1, shots: 0, fireT: 0, auto: false, idle: ARCHIVE.idle });
  $('practice').hidden = true;                     // (the archive has its own panels)
  document.body.classList.add('in-archive');
  $('archive').hidden = false;
  archiveShowTab(tab, tab === 'enemies' ? ENEMY_ARCHIVE[0].id : game.practice.card);
}
function exitArchive() {
  if (!game.practice?.archive) return;
  resetRun();
  document.body.classList.remove('in-practice', 'in-archive');
  $('archive').hidden = true;
  game.inMenu = true;
  menuEl.hidden = false;
  if (archiveFrom === 'scr-packview') { renderPackView(); showScreen('scr-packview'); $('pv').querySelector(`.pv-tab[data-card="${viewCard}"]`)?.focus({ preventScroll: true }); }
  else goMain();
}
function archiveShowTab(tab, id) {
  archiveTab = tab;
  for (const b of $('arc-tabs').querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('arc-tab-w').textContent = archiveIds().length;
  $('arc-tab-e').textContent = `${enemyOpen()}/${ENEMY_ARCHIVE.length}`;
  $('archive').dataset.tab = tab;
  renderArchiveList();
  if (tab === 'weapons') archiveCard(id || game.practice.card); else archiveEnemy(id || ENEMY_ARCHIVE[0].id);
}

/* ---------- the list ---------- */
const LOCK_GLYPH = '<svg class="pv-row-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7 10V7.5a5 5 0 0 1 10 0V10h1a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 6 10h1zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0V10z"/></svg>';
// A swarm enemy's or a boss's little picture: its shape, in its colour.
const ENEMY_GLYPH = {
  red: '<rect x="5" y="5" width="14" height="14" rx="2"/>', split: '<rect x="4" y="4" width="9" height="9" rx="1.5"/><rect x="11" y="11" width="9" height="9" rx="1.5"/>',
  tri: '<path d="M12 4l8 15H4z"/>', big: '<rect x="3" y="3" width="18" height="18" rx="2.5"/>',
  crab: '<ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M5 10l-2-4 3 1zM19 10l2-4-3 1z"/>', lunger: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M2 12h3M19 12h3" stroke="currentColor" stroke-width="2"/>',
  boom: '<path d="M12 4l8 15H4z"/><circle cx="12" cy="14" r="2.2" fill="#0b0c12"/>', shooter: '<rect x="5" y="5" width="14" height="14" rx="2"/><circle cx="12" cy="12" r="3" fill="#0b0c12"/>',
  boss: '<path d="M4 18c0-6 4-11 10-11 3 0 6 2 6 5l-3 1 1 3-4-1-2 5H8z"/>', obi: '<circle cx="9" cy="7" r="3"/><path d="M5 21v-7a4 4 0 0 1 8 0v7z"/><path d="M14 13l7-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  snek: '<path d="M4 6h12v4H8v4h12v4H4v-4h0V6z"/>', makora: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.5"/>',
};
function renderArchiveList() {
  if (archiveTab === 'enemies') {
    const groups = [['Swarm', ENEMY_ARCHIVE.filter(x => x.unit)], ['Bosses', ENEMY_ARCHIVE.filter(x => x.boss)]];
    $('arc-rows').innerHTML = groups.map(([name, xs]) => `<div class="arc-group" style="--rc: var(--neon-hi)"><span>${name}</span><i>${xs.filter(x => enemySeen(x.id)).length}/${xs.length}</i></div>`
      + xs.map(x => { const open = enemySeen(x.id);
        return `<button type="button" class="arc-row${open ? '' : ' is-locked'}" role="option" data-enemy="${x.id}" aria-selected="false" style="--c: var(${open ? x.col : '--muted'}); --rc: var(${open ? x.col : '--line'})">`
          + `<span class="pv-row-art">${open ? `<svg class="pv-row-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ENEMY_GLYPH[x.id]}</svg>` : LOCK_GLYPH}</span>`
          + `<span class="arc-name">${open ? x.name : '???'}</span><span class="arc-tag">${x.boss ? `Stage ${x.stage}` : ''}</span></button>`; }).join('')).join('');
    return;
  }
  const ids = archiveIds();
  $('arc-rows').innerHTML = RARITIES.filter(r => ids.some(id => CARDS[id].rarity === r)).map(r => {
    const mine = ids.filter(id => CARDS[id].rarity === r);
    return `<div class="arc-group" style="--rc: var(--r-${r})"><span>${RARITY_NAME[r]}</span><i>${mine.length}</i></div>` + mine.map(id => {
      const c = CARDS[id], m = c.melee;
      return `<button type="button" class="arc-row" role="option" data-card="${id}" aria-selected="false" style="--c: var(--${id}); --rc: var(--r-${c.rarity})">`
        + `<span class="pv-row-art">${cardGlyph(id, 'pv-row-glyph')}</span><span class="arc-name">${c.name}</span>`
        + `<span class="pv-row-kind is-${c.badge ? 'x' : m ? 'm' : 'r'}" title="${m ? 'Melee' : 'Ranged'}">${c.badge || (m ? 'M' : 'R')}</span></button>`;
    }).join('');
  }).join('');
}
function archiveSelectRow(attr, id) {
  for (const b of $('arc-rows').querySelectorAll('.arc-row')) b.setAttribute('aria-selected', String(b.dataset[attr] === id));
  $('arc-rows').querySelector(`[data-${attr}="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// Where a weapon comes from: its pack, every pack (a shared Common or Uncommon), an Event pack, or none yet.
function archiveWhere(id) {
  const ks = STORE_PACKS.filter(k => cardsOfRarity(CARDS[id].rarity, PACKS[k]).includes(id));
  if (!ks.length) return 'Not in any pack yet';
  if (SHARED.includes(CARDS[id].rarity) && ks.every(k => sharedIn(PACKS[k]))) return 'Every pack · a Random weapon';
  return ks.map(k => PACKS[k].name).join(' · ');
}

/* ---------- a weapon ---------- */
function archiveCard(id) {
  const pr = game.practice;
  if (!pr?.archive) return;
  Object.assign(pr, { card: id, enemy: null, next: 0, playing: -1, shots: 0, fireT: 0, dmg: 0, auto: false, idle: ARCHIVE.idle, boss: null });
  archivePlace();
  archiveSelectRow('card', id);
  const c = CARDS[id], t = COMBOS[id] || {};
  const notes = (id === 'mine' ? `<p class="type-combo"><b>Chain</b> A blast sets off any mine inside it.</p>` : '')
    + (c.tball ? `<p class="type-combo"><b>Event</b> Up to 2 balls of each kind orbit you, one per copy.</p>` : '')
    + (!COMBOS[id] ? `<p class="type-combo"><b>No combos</b> ${c.rarity === 'sss' ? 'Triple S: strong' : 'Strong'} enough on its own.</p>` : '');
  $('arc-detail').style.setProperty('--c', `var(--${id})`);
  $('arc-detail').style.setProperty('--rc', `var(--r-${c.rarity})`);
  $('arc-info').innerHTML = `<div class="arc-face">${cardFace(id)}</div><div class="arc-text">`
    + `<p class="type-name" style="color: var(--${id})">${c.name}</p>`
    + `<p class="arc-rar"><span>${RARITY_NAME[c.rarity]}</span>${c.melee ? 'Melee' : 'Ranged'}</p>`
    + `<p class="type-stats">${c.dmgNote || `${c.dmg} dmg`} · ${c.range ? `${c.melee ? 'reach' : 'range'} ${c.range}` : c.self ? 'on you' : 'drops on its own'}</p>`
    + `<p class="arc-where">${archiveWhere(id)}</p></div>`;
  $('arc-skills-head').innerHTML = 'Skills <small id="arc-auto"></small>';
  $('arc-skills').innerHTML = practiceAttacks(id).map((a, i) =>
    `<button type="button" class="arc-skill" data-i="${i}" aria-pressed="false"><span class="up-key" aria-hidden="true">${i + 1}</span>`
    + `<b>${a.label}</b>${a.name ? `<i>${a.name}</i>` : ''}<span class="arc-does">${a.n === 1 ? c.desc : t[a.n].does}</span><span class="arc-bar" aria-hidden="true"><s></s></span></button>`).join('')
    + notes;
  renderArchiveSkill();
}
function renderArchiveSkill() {
  const pr = game.practice;
  for (const b of $('arc-skills').querySelectorAll('.arc-skill')) b.setAttribute('aria-pressed', String(+b.dataset.i === pr.playing));
  const el = $('arc-auto');
  if (el) el.textContent = pr.auto ? 'playing on their own · click one to fire it' : `click one to fire it · they play on their own in ${Math.max(1, Math.ceil(pr.idle))} s`;
}
// Fires skill `i` now, and fills its bar for as long as it plays.
function archiveFire(i) {
  const pr = game.practice, atk = practiceAttacks(pr.card), a = atk[i];
  if (!a) return 0;
  testFire(a.n);
  pr.playing = i;
  const len = ARCHIVE.gap[a.n] ?? ARCHIVE.gap[3];
  const b = $('arc-skills').querySelector(`.arc-skill[data-i="${i}"] .arc-bar s`);
  if (b && animOk) { b.getAnimations().forEach(x => x.cancel()); b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: len * 1000, easing: 'linear' }); }
  return len;
}
// A click (or 1–3): that skill fires, and the auto-play waits again (2 s, or for the skill to finish if it's longer).
function archiveSkill(i) {
  const pr = game.practice;
  if (!pr?.card || pr.enemy || i >= practiceAttacks(pr.card).length) return;
  const len = archiveFire(i);
  Object.assign(pr, { auto: false, idle: Math.max(ARCHIVE.idle, len), shots: 0, next: (i + 1) % practiceAttacks(pr.card).length });   // (then on from the next one)
  renderArchiveSkill();
}

/* ---------- an enemy ---------- */
function archiveEnemy(id) {
  const pr = game.practice, x = ENEMY_BY[id], open = enemySeen(id);
  if (!pr?.archive || !x) return;
  Object.assign(pr, { enemy: id, auto: false, boss: null, loopT: 0, again: 0 });
  archivePlace();
  archiveSelectRow('enemy', id);
  $('arc-detail').style.setProperty('--c', `var(${open ? x.col : '--muted'})`);
  $('arc-detail').style.setProperty('--rc', `var(${open ? x.col : '--line'})`);
  if (!open) {
    $('arc-info').innerHTML = `<div class="arc-text"><p class="type-name">???</p><p class="arc-rar"><span>Locked</span>${x.boss ? 'Boss' : 'Swarm'}</p>`
      + `<p class="type-desc">You haven't met this one yet. It turns up in stage ${x.stage}: meet it in a run to unlock it.</p></div>`;
    $('arc-skills-head').innerHTML = ''; $('arc-skills').innerHTML = '';
    return;
  }
  const T = x.unit ? ENEMY_TYPES[UNITS[x.unit].type] : null;
  const stats = T ? `${x.unit === 'boom' ? '' : `${T.dmg} dmg · `}${T.hp} HP · speed ${T.speed}` : `${x.hp} HP`;
  $('arc-info').innerHTML = `<div class="arc-text"><p class="type-name" style="color: var(${x.col})">${x.name}</p>`
    + `<p class="arc-rar"><span>${x.boss ? 'Boss' : 'Swarm'}</span>from stage ${x.stage}</p><p class="type-stats">${stats}${T ? ' <small>(at the start: they grow with the run)</small>' : ''}</p></div>`;
  $('arc-skills-head').innerHTML = 'What it does';
  $('arc-skills').innerHTML = `<p class="arc-desc">${x.desc}</p>`
    + (x.moves ? `<p class="arc-moves" aria-label="Watch for">${x.moves.map(m => `<span>${m}</span>`).join('')}</p>` : '')
    + (x.show || x.boss && !x.still ? `<p class="arc-show">${x.show || 'It fights you here as in a run (its first phase), but can\'t hurt you or be hurt.'}</p>` : '')
    + (x.drop ? `<p class="type-combo"><b>Drops</b> ${x.drop}</p>` : '');
}
// A swarm enemy walks in from the far side; a boss is drawn standing there (archiveDraw), moving in place.
function archiveSpawn() {
  const pr = game.practice, x = ENEMY_BY[pr.enemy], b = pr.box;
  game.enemies = []; game.eshots = []; game.rocks = [];
  if (!x || !enemySeen(x.id)) return;
  Object.assign(pr, { foe: null, boss: null, real: null, shotT: 0.4, said: {}, was: null, eshots: 0, foeAt: null });
  if (x.unit) {
    const u = UNITS[x.unit], n = x.pack || 1;
    for (let k = 0; k < n; k++) {                  // (a Triangle comes with its pack)
      const e = makeEnemy(u.type, b.x + b.w - 30 - (k % 2) * 26, pr.home.y + (k - (n - 1) / 2) * 34, !!u.split);
      if (u.boom) e.boom = true;
      if (x.shot === 'kill') e.hp = e.maxHp = CARDS.bullet.dmg * 2;   // (shot here: two Bliky shots and it splits)
      else e.hp = e.maxHp = x.shot ? e.maxHp * 4 : 1e6;               // (Big red soaks them up; the rest nothing shoots)
      if (!k) pr.foe = e;
      game.enemies.push(e);
    }
    if (x.pack) archiveSay(pr.foe, 'PACK!');
  } else if (x.still) pr.boss = archiveBoss(x.boss);   // AWAS: the phone and the snake, drawn on their own
  else archiveRealBoss(x.boss);
  pr.loopT = 0;
}
// The boss itself (v0.62: they used to stand there moving in place): spawned as in a run, at the far side of the arena.
// It walks at you and attacks as in its first phase; it can't hurt you (the test arena: combat.js hurtPlayer), and its
// health stays full so it never changes phase (archiveEnemyStep). Its bar stays hidden (style.css .in-archive).
function archiveRealBoss(kind) {
  const pr = game.practice, b = pr.box;
  if (kind === 'boss') spawnBoss(); else if (kind === 'obi') spawnObi(); else spawnMakora();
  const e = game.enemies[0];
  if (!e) return;
  Object.assign(e, { x: b.x + b.w * 0.76, y: pr.home.y });
  // MAKORA (v0.69): its second phase's moves from the start (its lasers), and far enough off to throw its rock first
  if (kind === 'makora') Object.assign(e, { cd: 0.5, phase: 1, rockCd: 0, laserCd: 4, x: Math.max(e.x, pr.home.x + 400) });
  pr.real = e;
}
// A word over an enemy as it does its thing (once per move, until it does something else).
function archiveSay(e, text) {
  const x = ENEMY_BY[game.practice?.enemy];
  if (!e || !x) return;
  const col = getComputedStyle(document.documentElement).getPropertyValue(x.col).trim() || COL.wheelHi;
  game.floaters.push({ x: e.x, y: e.y - (e.r || 14) - 16, text, color: col, life: 1, max: 1, vy: -34, big: true });
}
// The bosses, drawn on their own (like the hitbox editor, hitedit.js): a stand-in with just what their drawing needs.
function archiveBoss(kind) {
  const pr = game.practice, b = pr.box, x = b.x + b.w * 0.66, y = b.y + b.h * 0.55;
  const base = { x, y, vx: 0, vy: 0, kx: 0, ky: 0, hit: 0, born: 1, step: 0, anim: 0, t: 0, phase: 1, dead: false, kind };
  if (kind === 'boss') return { ...base, boss: true, type: 'boss', shape: 'boss', r: BOSS.r, size: BOSS.r, flip: -1, hp: 1, maxHp: 1, state: 'walk', dir: Math.PI, face: Math.PI, throwing: null, recoil: 0 };
  if (kind === 'obi') return { ...base, obi: true, type: 'obi', shape: 'obi', r: OBI.r, size: OBI.r, hp: 1, maxHp: 1, state: 'walk', face: -1, aim: Math.PI, dir: Math.PI, sl: null, th: null, pull: null };
  if (kind === 'makora') return { ...base, makora: true, type: 'makora', shape: 'makora', r: MAKORA.r, size: MAKORA.r, hp: 1, maxHp: 1, state: 'walk', aim: Math.PI, face: -1, act: null, plan: [], phase: 0, run: 1, glow: 0, down: false };
  // AWAS: the phone's grid over the arena, and the snake going round it
  const C = SNEK.cell, cols = Math.floor(b.w / C), rows = Math.floor(b.h / C);
  const box = { x: b.x + (b.w - cols * C) / 2, y: b.y + (b.h - rows * C) / 2, w: cols * C, h: rows * C, cols, rows };
  return { ...base, snek: true, box, cols, rows, body: snekCoil(cols - 4, 2, cols, 14), dir: [-1, 0], state: 'go', tick: 0, st: 0.12, lcd: false, reveal: 99, mouth: 0, flash: 0, prev: null };
}
// AWAS's next step: round the grid's edge, a few cells in, the way the old game's snake goes.
function snekArchiveStep(s) {
  const [hx, hy] = s.body[0], m = 2;
  let [dx, dy] = s.dir;
  const nx = hx + dx, ny = hy + dy;
  if (nx < m || nx > s.cols - 1 - m || ny < m || ny > s.rows - 1 - m) [dx, dy] = [-dy, dx];   // turn at the edge
  s.prev = s.body.map(p => p.slice());
  s.body = [[hx + dx, hy + dy], ...s.body.slice(0, -1)];
  s.dir = [dx, dy];
  s.mouth = s.mouth ? 0 : 1;
}

/* ---------- placing, each frame, drawing ---------- */
// You on the left, the target (or the enemy) on the right, in the middle of the open space between the panels.
function archivePlace() {
  const pr = game.practice, p = game.player, B = ARCHIVE.box, id = pr.enemy ? null : pr.card;
  const list = $('arc-list').getBoundingClientRect(), det = $('arc-detail').getBoundingClientRect();
  const side = det.width && det.left > W / 2;      // (wide: the panels either side; narrow: on top)
  // v0.64 (user: "align them"): wide, it fills the space between the panels, level with them top and bottom
  const fill = side && W >= ARCHIVE.alignFrom, gap = fill ? list.left : B.pad;
  const left = side ? list.right + gap : B.pad, right = side ? det.left - gap : W - B.pad;
  const top = fill ? list.top : side ? 24 : Math.max(list.bottom, det.bottom) + 12, bottom = fill ? list.bottom : H - 24;
  const w = Math.max(220, fill ? right - left : Math.min(B.w, right - left)), h = Math.max(160, fill ? bottom - top : Math.min(B.h, bottom - top));
  pr.box = { x: left + (right - left - w) / 2, y: top + Math.max(0, (bottom - top - h) / 2), w, h };
  const reach = id ? rangeOf(id) : Infinity, close = id && isMelee(id);
  const d = pr.enemy ? w * 0.62 : Math.max(close ? 34 : 110, Math.min(Number.isFinite(reach) ? reach * 0.6 : 200, w - 120));
  const cx = pr.box.x + w / 2, cy = pr.box.y + h / 2;
  pr.home = { x: cx - d / 2, y: cy };
  Object.assign(p, { x: pr.home.x, y: cy, kx: 0, ky: 0, hp: PLAYER.hp });
  resetBoss(); resetMakora();                      // (a real boss from the Enemies tab, v0.62: gone, with its rocks and bar)
  for (const k of WORLD_LISTS) if (Array.isArray(game[k])) game[k] = [];
  Object.assign(game, { timers: [], melees: [], sweeps: [], zones: [], kicks: [], sinfx: [], sguard: null, muzzle: null, shake: 0, tballs: [], echoes: [] });
  game.soakT = 0;
  resetSilica();
  pr.dummies = []; pr.foe = null;
  if (pr.enemy) { archiveSpawn(); return; }
  const t = { dummy: true, type: 'dummy', shape: 'dummy', x: cx + d / 2, y: cy, r: 18, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, speed: 0, dmg: 0, hit: 0, born: 1 };
  pr.target = { x: t.x, y: t.y };
  pr.dummies = [t];
  game.enemies = [t];
}

// One frame (combat.js attackStep): nobody moves (you, and the target, slide back if a skill pushed you); the
// weapon waits for a click, then plays its skills in turn; an enemy comes at you again and again.
function archiveStep(dt) {
  const pr = game.practice, p = game.player, k = Math.min(1, dt * ARCHIVE.home);
  for (const c of Object.keys(MOVE)) keys.delete(c);
  pointer = null;
  if (!game.dash) { p.x += (pr.home.x - p.x) * k; p.y += (pr.home.y - p.y) * k; }
  p.kx = p.ky = 0;
  p.hp = PLAYER.hp;
  if (pr.enemy) { archiveEnemyStep(dt); return; }
  const t = pr.dummies[0];
  if (t) {
    if (!game.enemies.includes(t)) game.enemies.push(t);   // (it never dies, but a skill may clear the field)
    Object.assign(t, { hp: t.maxHp, dead: false, kx: 0, ky: 0 });
    t.x += (pr.target.x - t.x) * k; t.y += (pr.target.y - t.y) * k;
  }
  if (!pr.auto) {                                  // waiting for a click: after 2 s the skills play on their own
    const was = Math.ceil(pr.idle);
    if ((pr.idle -= dt) <= 0) { pr.auto = true; pr.fireT = 0; pr.shots = 0; renderArchiveSkill(); }
    else if (Math.ceil(pr.idle) !== was) renderArchiveSkill();
    return;
  }
  if ((pr.fireT -= dt) > 0) return;
  const atk = practiceAttacks(pr.card), i = pr.next < atk.length ? pr.next : 0;
  pr.fireT = archiveFire(i);
  if (atk[i].n !== 1 || ++pr.shots >= ARCHIVE.singles) { pr.next = (i + 1) % atk.length; pr.shots = 0; pr.fireT += ARCHIVE.pause; }
  renderArchiveSkill();
}
function archiveEnemyStep(dt) {
  const pr = game.practice, p = game.player, b = pr.boss, x = ENEMY_BY[pr.enemy];
  pr.loopT += dt;
  if (b) {                                          // AWAS: going round its phone
    b.anim += dt; b.t += dt;
    if ((b.tick += dt) >= b.st) { b.tick -= b.st; snekArchiveStep(b); }
    game.enemies = [];
    return;
  }
  if (pr.real) {                                    // a boss, fighting you as in a run
    const e = pr.real;
    if (!game.enemies.includes(e)) game.enemies.push(e);
    Object.assign(e, { hp: e.maxHp, dead: false });
    archiveMoves(e);
    if (pr.loopT > ARCHIVE.bossLoop && !e.throwing && /^(walk|rest)$/.test(e.state)) archiveSpawn();   // (from the far side again, between moves)
    return;
  }
  const e = pr.foe;
  if (!e) return;
  const gone = !game.enemies.includes(e) || e.dead;
  if (gone && !pr.foeGone) {                        // its last moment: what became of it
    pr.foeGone = true;
    if (x.shot === 'kill') archiveSay(e, 'SPLIT!');
    else if (e.boom) archiveSay(e, 'BOOM!');
  }
  if (gone) {                                       // (an Exploder blows itself up, a Split red splits: another comes a moment later)
    if ((pr.again = (pr.again || (x.shot === 'kill' ? 2.6 : 0.9)) - dt) <= 0) { pr.again = 0; pr.foeGone = false; archiveSpawn(); }
    return;
  }
  if (pr.loopT > ARCHIVE.enemyLoop * (x.pack ? 1.3 : 1)) { archiveSpawn(); return; }   // (the others start their walk in again now and then)
  if (x.shot) {                                     // Split red and Big red: you shoot it once it's close
    if (Math.hypot(e.x - p.x, e.y - p.y) < 210 && (pr.shotT -= dt) <= 0) { pr.shotT = x.shot === 'kill' ? 0.45 : 0.3; shoot('bullet', e); }
    if (x.shot === 'soak') {
      if (e.hp < e.maxHp && !pr.said.tough) { pr.said.tough = true; archiveSay(e, 'TOUGH!'); }
      e.hp = Math.max(e.hp, e.maxHp * 0.3);         // (it never goes down)
    }
  } else for (const o of game.enemies) if (!o.dead) o.hp = o.maxHp;
  archiveMoves(e);
  if (x.id === 'shooter' && game.eshots.length > pr.eshots) archiveSay(e, 'SHOT!');
  pr.eshots = game.eshots.length;
}
// Its move's name, the moment it starts one (ENEMY_MOVE).
function archiveMoves(e) {
  const pr = game.practice, words = ENEMY_MOVE[pr.enemy];
  if (!words) return;
  let st = e.state;
  if (pr.enemy === 'boss' && e.throwing) st = 'throw';                // SKURTOSAURUS's rock: its own wind-up
  if (st !== pr.was) {
    if (st === 'throw') archiveSay(e, 'ROCK THROW!');
    else if (words[st]) archiveSay(e, words[st]);
  }
  pr.was = st;
}
// The boss in the arena (after the game's own drawing), or a ? for a locked one.
function archiveDraw() {
  const pr = game.practice;
  if (!pr?.archive || !pr.enemy || !pr.box) return;
  const b = pr.box;
  ctx.save();
  ctx.scale(viewZoom, viewZoom); ctx.translate(-cam.x, -cam.y);
  if (!enemySeen(pr.enemy)) {
    ctx.fillStyle = COL.line; ctx.globalAlpha = 0.9;
    ctx.font = `700 ${Math.round(b.h * 0.32)}px Chakra Petch, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', b.x + b.w * 0.66, b.y + b.h / 2);
  } else if (pr.boss?.snek) {
    const s = pr.boss, keep = game.snek;
    ctx.fillStyle = COL.lcd; ctx.fillRect(s.box.x, s.box.y, s.box.w, s.box.h);
    game.snek = s;                                // (drawSnek draws game.snek)
    try { drawSnek(); } catch (err) { console.warn(err); } finally { game.snek = keep; }
    const p = game.player, P = NOKIA.px;              // you, in ink like everything on the phone
    ctx.fillStyle = COL.lcdInk; ctx.fillRect(lcdSnap(p.x - 2 * P), lcdSnap(p.y - 2 * P), 4 * P, 4 * P);
  }                                               // (the other bosses are real ones now: the game draws them)
  ctx.restore();
}
const archiveBaseDraw = draw;
draw = () => { archiveBaseDraw(); archiveDraw(); };

/* ---------- moving through it ---------- */
function archiveStepRow(d) {
  if (archiveTab === 'enemies') {
    const i = ENEMY_ARCHIVE.findIndex(x => x.id === game.practice.enemy);
    archiveEnemy(ENEMY_ARCHIVE[(i + d + ENEMY_ARCHIVE.length) % ENEMY_ARCHIVE.length].id);
    return;
  }
  const ids = archiveIds(), i = ids.indexOf(game.practice.card);
  archiveCard(ids[(i + d + ids.length) % ids.length]);
}
// ← →: the next rarity (Weapons) or the other group (Enemies: the swarm, the bosses).
function archiveStepGroup(d) {
  if (archiveTab === 'enemies') {
    const boss = !!ENEMY_BY[game.practice.enemy]?.boss;
    archiveEnemy(ENEMY_ARCHIVE.find(x => !!x.boss !== boss).id);
    return;
  }
  const ids = archiveIds(), rs = RARITIES.filter(r => ids.some(id => CARDS[id].rarity === r));
  const r = rs[(rs.indexOf(CARDS[game.practice.card].rarity) + d + rs.length) % rs.length];
  archiveCard(ids.find(id => CARDS[id].rarity === r));
}

// Keys (arena.js, through onPracticeKey): ↑ ↓ (or W S) the next one, ← → (or A D) rarity or group, 1–3 fire a skill,
// Q / E the other tab, Esc back. Every other movement key does nothing here.
function onArchiveKey(e) {
  const c = e.code, once = f => { if (!e.repeat) f(); };
  if (c === 'Escape') once(exitArchive);
  else if (c === 'ArrowUp' || c === 'KeyW') archiveStepRow(-1);
  else if (c === 'ArrowDown' || c === 'KeyS') archiveStepRow(1);
  else if (c === 'ArrowLeft' || c === 'KeyA') once(() => archiveStepGroup(-1));
  else if (c === 'ArrowRight' || c === 'KeyD') once(() => archiveStepGroup(1));
  else if (c === 'KeyQ' || c === 'KeyE') once(() => archiveShowTab(archiveTab === 'weapons' ? 'enemies' : 'weapons'));
  else if (/^(?:Digit|Numpad)[1-3]$/.test(c)) once(() => archiveSkill(+c.slice(-1) - 1));
  else if (c !== 'Space' && !MOVE[c]) return false;
  e.preventDefault();
  return true;
}

$('arc-rows').addEventListener('click', e => {
  const b = e.target.closest('.arc-row');
  if (b?.dataset.card) archiveCard(b.dataset.card); else if (b?.dataset.enemy) archiveEnemy(b.dataset.enemy);
});
packTilt($('arc-info'), t => t.closest('.arc-face'), '.cf');   // (user: "make the cards here animated too": it sways like the pack page's card and turns to the pointer)
$('arc-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b && b.dataset.tab !== archiveTab) archiveShowTab(b.dataset.tab); });
$('arc-skills').addEventListener('click', e => { const b = e.target.closest('.arc-skill'); if (b) { archiveSkill(+b.dataset.i); b.blur(); } });
$('btn-arc-back').addEventListener('click', exitArchive);
$('btn-archives').addEventListener('click', () => openArchive());
addEventListener('resize', () => requestAnimationFrame(() => { if (game.practice?.archive) { if (game.practice.enemy) archiveEnemy(game.practice.enemy); else archivePlace(); } }));
