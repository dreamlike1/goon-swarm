/* menus.js — Menus: title, beginner pack + reveal, main, loadout, deck preview, arena transition, pause exit and run reset. */
'use strict';

/* ---------- menus ---------- */
const menuEl = $('menu');
const screens = [...menuEl.querySelectorAll('.screen')];
const previewEl = $('preview');
const revealEl = $('reveal');
let current = 'scr-title', entering = false, goTimer = 0;
const PREVIEW_MS = 1600;         // how long the deck preview shows before the arena

// A card at menu size. `idx` adds the slot number; `rarity` adds the rarity line.
function mcard(c, { idx = null, rarity = false, down = false } = {}) {
  if (c === null) {                     // a face-down slot in the first sequence, dealt at the first shuffle
    return `<li class="mcard is-down" data-card="" style="--c: var(--line)">`
      + (idx != null ? `<span class="card-idx">${idx + 1}</span>` : '') + `<span class="card-back" aria-hidden="true"></span></li>`;
  }
  const r = CARDS[c].rarity;
  return `<li class="mcard${down ? ' is-down' : ''}" data-card="${c}" style="--c: var(--${c}); --rc: var(--r-${r})">`
    + (idx != null ? `<span class="card-idx">${idx + 1}</span>` : '')
    + `<span class="card-name">${CARDS[c].name}</span>`
    + (rarity ? `<span class="card-rarity">${RARITY_NAME[r]}</span>` : '')
    + (down ? `<span class="card-back" aria-hidden="true"></span>` : '')
    + `</li>`;
}

function showScreen(id) {
  current = id;
  for (const sc of screens) sc.hidden = sc.id !== id;
  // Focus the first button, unless the screen opts out (the pack picker: focusing a pack would look like choosing it).
  const first = $(id).hasAttribute('data-nofocus') ? null : $(id).querySelector('button:not(:disabled):not([hidden])');
  if (first) first.focus(); else $(id).focus({ preventScroll: true });
  fitNames($(id));
}

// Title → the beginner pack if this computer hasn't opened one yet, otherwise the main menu.
function afterTitle() {
  if (!save.beginner) { resetPackChoice(); showScreen('scr-pack'); }
  else if (!save.beginnerSeen) { $('r-eyebrow').textContent = PACKS[save.starter]?.name || 'Starter pack'; startReveal(save.beginner); }
  else { renderLoadout(); showResetConfirm(false); showScreen('scr-main'); }
}

/* ---------- what's new (title screen and main menu) ---------- */
// Newest first. Keep it short: one line per change a player would notice.
const NEWS = [
  { tag: 'Boss', text: 'KURTSAURUS arrives at level 10. Dodge its slow rocks and its charge.' },
  { tag: 'Relic', text: 'Beat KURTSAURUS to earn BULL: press Shift to charge through enemies.' },
  { tag: 'Upgrade', text: 'Knockback is a new upgrade stat, and so is Attack range.' },
  { tag: 'Balance', text: 'Higher levels come quicker. Enemies hit harder and move faster instead.' },
  { tag: 'Combos', text: 'Runs of 3, 4 or 7 of a card play as one big special attack.' },
  { tag: 'Wheel', text: 'Spin for a weapon at levels 5, 15, 25 and so on.' },
  { tag: 'Drops', text: 'Red potions heal. Diamonds pull every XP orb to you.' },
  { tag: 'Weapons', text: 'New: Space Impact missiles and Mines. Every weapon has its own range.' },
  { tag: 'Packs', text: 'Choose a starter pack: Beginner, Dan or Free (build your own deck).' },
];
for (const ul of document.querySelectorAll('.news-list')) {
  ul.innerHTML = NEWS.map(n => `<li><span class="news-tag">${n.tag}</span>${n.text}</li>`).join('');
}

/* ---------- starter packs (Beginner, then Dan) ---------- */
// Each pack shows its real odds: per rarity, and per card when the pack is limited to a few cards.
function packOddsRows(pack) {
  return packOdds(pack).flatMap(o => {
    const pool = cardsOfRarity(o.rarity, pack);
    if (pack.rarities.length === 1) return pool.map(id =>
      `<tr><th scope="row" style="color: var(--${id})">${CARDS[id].name}</th><td>${(o.chance / pool.length * 100).toFixed(1)}%</td></tr>`);
    return [`<tr><th scope="row" style="color: var(--r-${o.rarity})">${RARITY_NAME[o.rarity]}</th><td>${(o.chance * 100).toFixed(1)}%</td></tr>`];
  }).join('');
}
// Choose one: each pack is a button (a radio in a group). The Open button opens the chosen one.
$('packs').innerHTML = STARTER_PACKS.map(k => {
  const pk = PACKS[k];
  return `<div class="pack" role="radio" tabindex="0" aria-checked="false" data-pack="${k}" style="--pc: var(--pack-${k})">`
    + `<span class="pack-art pack-${k}" aria-hidden="true"><span>${pk.short}</span></span>`
    + `<span class="pack-name">${pk.name}</span>`
    + (pk.free
      ? `<p class="pack-free">Every card, as many as you like.<br>Build your own deck in Loadout.</p>`
      : `<table class="odds" aria-label="${pk.name}: chance per card"><caption>Chance per card</caption><tbody>${packOddsRows(pk)}</tbody></table>`)
    + `<span class="pack-pick" aria-hidden="true">Chosen</span>`
    + `</div>`;
}).join('');
$('pack-size').textContent = STARTER_OPENS * PACKS[STARTER_PACKS[0]].size;
let chosenPack = null;
function choosePack(k) {
  if (k !== chosenPack) SFX.click();
  chosenPack = k;
  for (const b of $('packs').children) b.setAttribute('aria-checked', String(b.dataset.pack === k));
  $('btn-open').disabled = false;
  $('btn-open').textContent = PACKS[k].free ? 'Build my deck' : `Open ${PACKS[k].name}`;
  $('r-eyebrow').textContent = PACKS[k].name;
}
$('packs').addEventListener('click', e => { const b = e.target.closest('.pack'); if (b) choosePack(b.dataset.pack); });
// Arrow keys move between the two packs, like a radio group.
$('packs').addEventListener('keydown', e => {
  const i = STARTER_PACKS.indexOf(chosenPack ?? STARTER_PACKS[0]);
  if (e.key === 'Enter' || e.key === ' ') { const b = e.target.closest('.pack'); if (b) { choosePack(b.dataset.pack); e.preventDefault(); } return; }
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return;
  const k = STARTER_PACKS[(i + d + STARTER_PACKS.length) % STARTER_PACKS.length];
  choosePack(k);
  $('packs').querySelector(`[data-pack="${k}"]`).focus();
  e.preventDefault();
});

function resetPackChoice() {
  chosenPack = null;
  for (const b of $('packs').children) b.setAttribute('aria-checked', 'false');
  $('btn-open').disabled = true;
  $('btn-open').textContent = 'Choose a pack';
}

function openPack() {
  if (!chosenPack) return;
  if (PACKS[chosenPack].free) { openFreePack(); SFX.start(); renderLoadout(); showScreen('scr-loadout'); return; }
  const ids = openBeginnerPack(chosenPack);    // rolled and saved before anything is shown
  SFX.open();
  if (!animOk) return startReveal(ids);
  const art = $('packs').querySelector(`[data-pack="${chosenPack}"] .pack-art`);
  const a = art.animate([
    { transform: 'none' }, { transform: 'rotate(-4deg) scale(1.04)' }, { transform: 'rotate(4deg) scale(1.06)' },
    { transform: 'scale(1.12)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 },
  ], { duration: 320, easing: 'ease-in', fill: 'forwards' });
  // Reveal when the shake ends, or after a moment anyway (animations pause in a hidden tab). Once only, and
  // only if this is still the pack being opened.
  let went = false;
  const go = () => { if (went) return; went = true; a.cancel(); if (save.beginner === ids && current === 'scr-pack') startReveal(ids); };
  a.onfinish = go;
  setTimeout(go, 450);
}

// The cards are already decided; this only shows them. One at a time, each card comes up
// out of the pack face down, then flips. Skip shows the rest at once.
let revealRun = 0;                                   // bumped to stop a reveal in progress
const wait = ms => new Promise(r => setTimeout(r, ms));
const done = anim => anim.finished.catch(() => {});  // a cancelled animation just ends the wait

function startReveal(ids) {
  revealEl.innerHTML = ids.map(c => mcard(c, { rarity: true, down: true })).join('');
  for (const li of revealEl.children) li.classList.add('is-waiting');
  $('btn-reveal-all').hidden = false;
  $('btn-reveal-done').hidden = true;
  $('reveal-tip').hidden = false;
  $('save-warn').hidden = saveWorks;
  showScreen('scr-reveal');
  if (!animOk) return skipReveal();
  playReveal(++revealRun);
}

async function playReveal(run) {
  await wait(120);                                   // quick: every step below was sped up at the user's request
  for (const li of revealEl.children) {
    if (run !== revealRun) return;
    li.classList.remove('is-waiting');
    await done(li.animate([{ transform: 'translateY(30px) scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 140, easing: 'cubic-bezier(.2, .9, .3, 1.2)' }));
    if (run !== revealRun) return;
    await wait(40);
    if (run !== revealRun) return;
    await done(li.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 70, easing: 'ease-in' }));
    if (run !== revealRun) return;
    li.classList.remove('is-down');
    SFX.flip(CARDS[li.dataset.card].rarity);
    const glow = getComputedStyle(li).getPropertyValue('--rc').trim();
    await done(li.animate([
      { transform: 'scaleX(0)', boxShadow: `0 0 0 0 ${glow}` },
      { transform: 'scaleX(1) translateY(-6px)', boxShadow: `0 0 18px 2px ${glow}`, offset: 0.6 },
      { transform: 'none', boxShadow: `0 0 0 0 ${glow}` },
    ], { duration: 200, easing: 'ease-out' }));
    await wait(50);
  }
  if (run === revealRun) finishReveal();
}

function skipReveal() {
  revealRun++;
  const down = [...revealEl.querySelectorAll('.is-down')];   // one flip sound for the rest, with the chime if any beats Common
  if (down.length) SFX.flip(down.some(li => CARDS[li.dataset.card].rarity !== 'common') ? 'uncommon' : 'common');
  for (const li of revealEl.children) {
    li.getAnimations().forEach(a => a.cancel());
    li.classList.remove('is-waiting', 'is-down');
  }
  finishReveal();
}

function finishReveal() {
  $('btn-reveal-all').hidden = true;
  $('reveal-tip').hidden = true;
  $('btn-reveal-done').hidden = false;
  $('btn-reveal-done').focus();
}

$('btn-reveal-all').addEventListener('click', skipReveal);
$('btn-reveal-done').addEventListener('click', () => {
  save.beginnerSeen = true;
  writeSave();
  renderLoadout();
  showScreen('scr-main');
});
$('btn-open').addEventListener('click', openPack);

/* ---------- loadout: one row per card type in the equipped deck ---------- */
// Loadout: the equipped deck. With the Free pack it's a deck builder: every card owned, with − / + for each.
function renderLoadout() {
  const cards = equippedCards(), build = canBuildDeck();
  $('loadout-sub').textContent = `Deck · ${cards.length} card${cards.length === 1 ? '' : 's'} · sequences of ${SEQUENCE_SIZE}`;
  const hint = $('loadout-hint');
  hint.hidden = !build;
  hint.textContent = cards.length ? `Any mix of cards, ${DECK_LIMIT} in all.` : `Add cards to build your deck: any mix, ${DECK_LIMIT} cards in all.`;
  $('types').innerHTML = CARD_IDS.filter(id => build ? save.owned[id] : save.equipped[id]).map(c => {
    const k = CARDS[c], n = save.equipped[c] || 0;
    const extra = k.bounces ? ` · ${k.bounces} bounces` : k.pierce ? ` · pierces ${k.pierce}` : k.radius ? ` · blast ${k.radius}px` : '';
    const pace = k.look === 'mine' ? 'Placed' : paceWord(k.speed);
    const max = Math.min(copyLimit(), save.owned[c] || 0);
    return `<div class="type${build && !n ? ' is-out' : ''}"><ol class="preview">${mcard(c, { rarity: true })}</ol><div>`
      + `<p class="type-name" style="color: var(--${c})">${k.name}${build ? '' : `<b>×${n}</b>`}</p>`
      + `<p class="type-stats">${k.dmg} dmg · ${pace} · ${pushWord(k.knock)} knockback${extra}</p>`
      + `<p class="type-desc">${k.desc}</p>`
      + (COMBOS[c] ? `<p class="type-combo">${Object.entries(COMBOS[c]).map(([n, x]) => `<b>×${n}</b> ${x.does}`).join('<br>')}</p>` : c === 'mine' ? `<p class="type-combo"><b>Chain</b> A blast sets off any mine inside it.</p>` : '')
      + (build ? `<div class="stepper" role="group" aria-label="${k.name} copies">`
        + `<button type="button" data-id="${c}" data-d="-1" aria-label="Remove one ${k.name}"${n <= 0 ? ' disabled' : ''}>−</button>`
        + `<b aria-live="polite">${n}</b>`
        + `<button type="button" data-id="${c}" data-d="1" aria-label="Add one ${k.name}"${n >= max || cards.length >= DECK_LIMIT ? ' disabled' : ''}>+</button>`
        + `</div>` : '')
      + `</div></div>`;
  }).join('');
  fitNames($('types'));
  $('btn-play').disabled = deckProblems().length > 0;
}
$('types').addEventListener('click', e => {
  const b = e.target.closest('.stepper button');
  if (!b || b.disabled || !canBuildDeck()) return;
  const id = b.dataset.id, n = (save.equipped[id] || 0) + Number(b.dataset.d);
  if (n < 0 || n > Math.min(copyLimit(), save.owned[id] || 0) || (Number(b.dataset.d) > 0 && equippedCards().length >= DECK_LIMIT)) return;
  if (n) save.equipped[id] = n; else delete save.equipped[id];
  writeSave();
  renderLoadout();
  $('types').querySelector(`.stepper button[data-id="${id}"][data-d="${b.dataset.d}"]:not(:disabled)`)?.focus()
    || $('types').querySelector(`.stepper button[data-id="${id}"]:not(:disabled)`)?.focus();
});

$('btn-title').addEventListener('click', afterTitle);

// Reset data: wipes this computer's save (cards, deck, beginner pack) after an in-page confirm.
function showResetConfirm(on) {
  $('btn-reset').hidden = on;
  $('reset-confirm').hidden = !on;
  if (on) $('btn-reset-no').focus();
}
function resetData() {
  resetSave();
  newDeck();                    // no cards equipped, so there's no deck until a new pack is opened
  renderTray(true);
  renderLog();
  showResetConfirm(false);
  showScreen('scr-title');
}
$('btn-reset').addEventListener('click', () => showResetConfirm(true));
$('btn-reset-no').addEventListener('click', () => { showResetConfirm(false); $('btn-reset').focus(); });
$('btn-reset-yes').addEventListener('click', resetData);
$('btn-loadout').addEventListener('click', () => showScreen('scr-loadout'));
$('btn-loadout-back').addEventListener('click', () => showScreen('scr-main'));
$('btn-main-back').addEventListener('click', () => showScreen('scr-title'));
$('btn-play').addEventListener('click', startPreview);
$('scr-preview').addEventListener('click', enterArena);   // click to skip the wait

function onMenuKey(e) {
  if (current === 'scr-preview' && (e.code === 'Enter' || e.code === 'Space')) { enterArena(); e.preventDefault(); }
  if (e.code === 'Escape') {
    if (current === 'scr-loadout') showScreen('scr-main');
    else if (current === 'scr-main') showScreen('scr-title');
  }
}

// Start: a fresh run from the equipped deck. Show its first sequence in firing order,
// then fly the cards into the deck spot.
function startPreview() {
  if (deckProblems().length) return;
  resetRun();
  showScreen('scr-preview');
  previewEl.innerHTML = deck.sequence.map((c, i) => mcard(c, { idx: i })).join('');
  fitNames(previewEl);
  if (animOk) {
    [...previewEl.children].forEach((li, i) => li.animate(
      [{ transform: 'translateY(-16px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 260, delay: 120 + i * 60, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' }));
    $('go-bar').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: PREVIEW_MS, fill: 'forwards' });
  }
  goTimer = setTimeout(enterArena, PREVIEW_MS);
}

function enterArena() {
  if (!game.inMenu || entering || current !== 'scr-preview') return;
  entering = true;
  clearTimeout(goTimer);
  renderTray(false);
  if (!animOk) return arrive();

  // Each preview card flies to its deck slot and shrinks to deck size while the scrim clears.
  const cards = [...previewEl.children];
  const targets = [...trayEl.children].map(li => li.getBoundingClientRect());
  cards.forEach((el, i) => {
    el.getAnimations().forEach(a => a.finish());
    const a = el.getBoundingClientRect(), b = targets[i];
    el.animate([
      { transform: 'none' },
      { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})` },
    ], { duration: 620, delay: i * 35, easing: 'cubic-bezier(.6, 0, .2, 1)', fill: 'forwards' });
  });
  for (const el of $('scr-preview').querySelectorAll('.fade')) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  menuEl.animate([{ backgroundColor: getComputedStyle(menuEl).backgroundColor }, { backgroundColor: 'rgba(0, 0, 0, 0)' }],
    { duration: 700, easing: 'ease-in', fill: 'forwards' });
  setTimeout(arrive, 620 + (cards.length - 1) * 35 + 20);
}

// The menu goes away with the cards sitting exactly where the real deck is.
function arrive() {
  menuEl.hidden = true;
  menuAnimations().forEach(a => a.cancel());
  entering = false;
  game.inMenu = false;
  const p = game.player;
  game.rings.push({ x: p.x, y: p.y, r: 4, max: 44, life: 0.4, color: COL.player });
  SFX.start();
  last = performance.now();
  document.activeElement?.blur();
}

function menuAnimations() {
  return document.getAnimations().filter(a => a.effect && menuEl.contains(a.effect.target));
}

// A clean run from the equipped deck: new seed, no enemies, counters and log cleared.
function resetRun() {
  newDeck();
  Object.assign(game, {
    enemies: [], started: false, spawnTimer: 0, cooldown: ATTACK_INTERVAL,
    projectiles: [], particles: [], rings: [], floaters: [], orbs: [], muzzle: null, shake: 0, kills: 0, over: false,
    level: 1, xp: 0, cdTotal: ATTACK_INTERVAL, aug: new Set(), echoes: [], upQueue: [], mines: [], potions: [], diamonds: [], won: [], timers: [], shield: 0, shieldHit: 0,
  });
  resetStats();
  resetBoss();
  Object.assign(game.player, { x: W / 2, y: H / 2, flash: 0, hp: PLAYER.hp, safe: 0 });
  $('defeat').hidden = true;
  renderHp(false);
  renderXp(false);
  $('kills').textContent = 0;
  aliveEl.textContent = 0;
  hintEl.classList.remove('gone');
  renderTray(true);
  renderLog();
  renderChecks();
}

// Pause → Exit to title: throw the run away.
function exitToTitle() {
  resetRun();
  setPaused(false);
  clearTimeout(goTimer);
  entering = false;
  game.inMenu = true;
  menuEl.hidden = false;
  showScreen('scr-title');
}

// HP ran out: stop the run and offer another go, or the main menu.
function defeat() {
  game.over = true;
  SFX.defeat();
  keys.clear();
  $('d-stats').textContent = `Level ${game.level} · Sequence ${deck.seqNo} · ${game.kills} enem${game.kills === 1 ? 'y' : 'ies'} defeated`;
  $('defeat').hidden = false;
  $('btn-retry').focus();
}
$('btn-retry').addEventListener('click', () => {
  resetRun();
  last = performance.now();
  document.activeElement?.blur();
});
$('btn-defeat-menu').addEventListener('click', () => {
  resetRun();
  game.inMenu = true;
  menuEl.hidden = false;
  renderLoadout();
  showScreen('scr-main');
});
