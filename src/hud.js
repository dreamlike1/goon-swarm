/* hud.js — HUD: deck tray, card animations, attack log and checks. */
'use strict';

/* ============================================================
   HUD: reads deck state and the fired record, never the reverse.
   ============================================================ */
const $ = id => document.getElementById(id);
const trayEl = $('tray'), logEl = $('log'), checksEl = $('checks');
const selftest = selfTest(2000);
const packtests = STORE_PACKS.map(k => ({ k, ...packSelfTest(PACKS[k], 20000) }));
const packtest = { ok: packtests.every(t => t.ok), packs: packtests.reduce((n, t) => n + t.packs, 0), rows: packtests.flatMap(t => t.rows) };
let nextCard = null;

function onAttack(ev) {
  record.current.push(ev.card);            // what combat fired
  record.passFired.push(ev.card);
  let fresh = false;
  if (ev.sequence) {
    const fired = record.current;
    const matches = fired.length === ev.sequence.length && fired.every((c, i) => c === ev.sequence[i]);
    if (!matches) record.logOk = false;
    record.seqs.unshift({ n: ev.seqNo, cards: fired, valid: matches && fired.length === SEQUENCE_SIZE });
    if (record.seqs.length > 200) record.seqs.pop();
    record.current = [];
    fresh = true;
  }
  if (ev.reshuffle) {
    record.passes++;
    // After the shuffle, every card of the deck is in exactly one pile: nothing lost or doubled.
    if (deck.intact()) record.passesOk++;
    record.passFired = [];
    flashShuffle();
    SFX.shuffle();
  }
  renderTray(fresh, fresh ? null : ev.filled);
  renderLog();
  renderChecks();
}

// Player HP bar. `hit` flashes it red for a moment.
function renderHp(hit) {
  const p = game.player, el = $('hp');
  $('hp-fill').style.transform = `scaleX(${p.hp / maxHp()})`;
  el.setAttribute('aria-valuemax', maxHp());
  $('hp-num').textContent = Math.ceil(p.hp);
  el.setAttribute('aria-valuenow', Math.ceil(p.hp));
  if (hit) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
}

// XP bar: how far into the current level. `up` flashes it after a level up.
function renderXp(up) {
  const need = xpNeeded(game.level), el = $('xp'), fill = $('xp-fill');
  fill.style.transition = up ? 'none' : '';               // a new level starts from empty, without draining back
  fill.style.transform = `scaleX(${game.xp / need})`;
  if (up) void fill.offsetWidth, fill.style.transition = '';
  $('xp-lv').textContent = game.level;
  const max = game.level >= MAKORA.level;                 // the last level: the bar stays full
  if (max) fill.style.transform = 'scaleX(1)';
  $('xp-num').textContent = max ? 'MAX' : `${Math.floor(game.xp)}/${need}`;
  el.setAttribute('aria-valuenow', Math.floor(game.xp));
  el.setAttribute('aria-valuemax', need);
  el.setAttribute('aria-valuetext', `Level ${game.level}, ${Math.floor(game.xp)} of ${need} XP`);
  if (up) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
}

// Card width + gap in px, read from the CSS so it follows the phone layout.
function slotPx() {
  const cs = getComputedStyle(trayEl);
  return parseFloat(cs.getPropertyValue('--cw')) + parseFloat(cs.getPropertyValue('--gap'));
}
const NEXT_LIFT = -8;           // matches .card.is-next
const animOk = !reducedMotion && !!trayEl.animate;

// Shrinks any card name or rarity label that is too wide for its card (SHURIKEN, UNCOMMON on a phone).
function fitNames(root) {
  for (const n of root.querySelectorAll('.card-name, .card-rarity')) {
    n.style.fontSize = '';
    let size = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > n.clientWidth + 0.5 && size > 5) { size -= 0.5; n.style.fontSize = `${size}px`; }
  }
}

// Rapid-fire runs (3+ Bullets in a row): a glowing bar under those cards. It dims once the run has fired.
const rapidEl = $('rapid');
function renderRapid(seq, pos) {
  rapidEl.style.setProperty('--n', seq.length);
  const cbs = combosIn(seq, pos);
  rapidEl.innerHTML = cbs.map(c =>
    `<span class="rapid-bar${c.n >= 7 ? ' is-max' : ''}" style="--from:${c.start}; --len:${c.n}; --bc: var(--${c.card})"></span>`).join('');
  for (const li of trayEl.children) li.classList.remove('is-combo');
  for (const c of cbs) for (let i = c.start; i < c.start + c.n; i++) trayEl.children[i]?.classList.add('is-combo');
}

// One deck card. `c` null is a face-down slot, waiting on the shuffle.
function trayCard(c, i, isNew) {
  if (c === null) {
    return `<li class="card is-down" data-card="" style="--i:${i}; --c: var(--line)">`
      + `<span class="card-idx">${i + 1}</span><span class="card-back" aria-hidden="true"></span><span class="cd"></span></li>`;
  }
  return `<li class="card" data-card="${c}" style="--i:${i}; --c: var(--${c})">` + trayFace(c, i, isNew) + `</li>`;
}
function trayFace(c, i, isNew) {
  return `<span class="card-idx">${i + 1}</span>`
    + (isNew ? `<span class="card-new" title="From the shuffle">↻</span>` : '')
    + `<span class="card-name">${CARDS[c].name}</span>`
    + `<span class="cd"></span>`;
}

// A new sequence rebuilds the cards in its order; later attacks only update their state.
// `filled`: slots the shuffle just dealt into, which flip face up where they are.
function renderTray(fresh, filled = null) {
  if (!deck) { trayEl.innerHTML = ''; nextCard = null; return; }
  const seq = deck.sequence, pos = deck.seqPos, breaks = deck.passBreaks;
  if (filled && !fresh) {
    filled.forEach((i, k) => {
      const li = trayEl.children[i];
      if (li) revealCard(li, seq[i], i, breaks.includes(i), k);
    });
  }
  const same = trayEl.children.length === seq.length && [...trayEl.children].every((li, i) => li.dataset.card === (seq[i] || ''));
  if (fresh || !same) {
    trayEl.style.setProperty('--n', seq.length);
    trayEl.innerHTML = seq.map((c, i) => trayCard(c, i, breaks.includes(i))).join('');
    fitNames(trayEl);
    if (fresh && animOk) animateReset();
  } else if (pos > 0 && animOk) {
    animatePlay(trayEl.children[pos - 1]);   // the card that just fired
  }
  [...trayEl.children].forEach((li, i) => {
    li.classList.toggle('is-fired', i < pos);
    li.classList.toggle('is-next', i === pos);
    li.classList.toggle('is-aug', game.aug.has(i));   // augmented slot: its card fires twice
    li.setAttribute('aria-label', seq[i] === null ? `${i + 1}: face down, dealt at the next shuffle`
      : `${i + 1}: ${CARDS[seq[i]].name}${game.aug.has(i) ? ', fires twice' : ''}${li.classList.contains('is-combo') ? ', part of a combo' : ''}${i < pos ? ', fired' : i === pos ? ', next' : ''}`);
  });
  nextCard = trayEl.querySelector('.is-next');
  renderRapid(seq, pos);
  $('cycle').textContent = deck.seqNo;

  // Deck counter: cards left to fire before the next shuffle, out of the whole deck.
  $('deckLeft').innerHTML = `Deck <b>${deck.left}</b>/${deck.size}`;
  $('deckStatus').setAttribute('aria-label', `${deck.left} of ${deck.size} cards left before the next shuffle`);

  // The tray must show exactly the deck's current sequence, with fired cards matching what combat fired.
  const shown = [...trayEl.children].map(li => li.dataset.card);
  const firedShown = trayEl.querySelectorAll('.is-fired').length;
  const ok = shown.join() === seq.join() && firedShown === record.current.length
    && record.current.every((c, i) => c === shown[i]) && shown.length === SEQUENCE_SIZE;
  if (!ok) record.trayOk = false;
}

// Every card has fired and the deck just reshuffled: swap the "cards left" text for a
// spinning shuffle icon for a moment, then let renderTray's next call show it again.
let shuffleTimer = 0;
function flashShuffle() {
  $('deckLeft').hidden = true;
  $('shuffleIcon').hidden = false;
  clearTimeout(shuffleTimer);
  shuffleTimer = setTimeout(() => {
    $('deckLeft').hidden = false;
    $('shuffleIcon').hidden = true;
  }, 700);
}

const T = (x, y = 0, s = 1) => `translate(${x}px, ${y}px) scale(${s})`;

// A played card pops up with a glow in its colour, then settles back down as fired.
// The highlight moving to the next card is the CSS transition on --lift.
function animatePlay(li) {
  const home = Number(li.style.getPropertyValue('--i')) * slotPx();
  const glow = COL[li.dataset.card];
  li.animate([
    { transform: T(home, NEXT_LIFT), boxShadow: `0 0 0 0 ${glow}`, opacity: 1 },
    { transform: T(home, -22, 1.08), boxShadow: `0 0 16px 2px ${glow}`, opacity: 1, offset: 0.35 },
    { transform: T(home, 0), boxShadow: `0 0 0 0 ${glow}`, opacity: 0.35 },
  ], { duration: 320, easing: 'ease-out' });
}

// The shuffle deals into a face-down card: it jiggles with the others for a moment (the shuffle),
// then flips over to show its card. Done within one attack interval, before that card can fire.
function revealCard(li, c, i, isNew, k) {
  li.dataset.card = c;
  const show = () => {
    li.classList.remove('is-down');
    li.style.setProperty('--c', `var(--${c})`);
    li.innerHTML = trayFace(c, i, isNew);
    fitNames(li);
  };
  if (!animOk) return show();
  const home = i * slotPx(), at = (x, y, r = 0, sx = 1) => `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(${sx})`;
  const d = k % 2 ? 1 : -1;
  const shuffle = li.animate([
    { transform: at(home, 0) },
    { transform: at(home + 5 * d, -6, 4 * d), offset: 0.25 },
    { transform: at(home - 5 * d, -3, -4 * d), offset: 0.55 },
    { transform: at(home, -4, 0), offset: 0.8 },
    { transform: at(home, -4, 0, 0) },
  ], { duration: 300 + k * 45, easing: 'ease-in-out', fill: 'forwards' });
  shuffle.onfinish = () => {
    show();
    SFX.deal();
    li.animate([{ transform: at(home, -4, 0, 0) }, { transform: at(home, 0) }], { duration: 140, easing: 'ease-out' });
    shuffle.cancel();
  };
}

// New sequence: the fresh cards drop in one after another.
function animateReset() {
  const slot = slotPx();
  [...trayEl.children].forEach((li, i) => {
    const home = i * slot;
    li.animate([
      { transform: T(home, -18, 0.9), opacity: 0 },
      { transform: T(home, i === 0 ? NEXT_LIFT : 0), opacity: 1 },
    ], { duration: 240, delay: i * 40, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' });
  });
}

// Log dots: the card's colour, bigger for harder-hitting cards.
function dots(cards) {
  return cards.map(c => {
    const d = CARDS[c].dmg, size = d >= 15 ? 12 : d >= 10 ? 10 : 6;
    return `<span class="ld" style="--c: var(--${c}); --s: ${size}px"></span>`;
  }).join('');
}
function said(cards) { return cards.map(c => CARDS[c].name).join(', '); }

function renderLog() {
  if (!deck) { logEl.innerHTML = ''; return; }
  const rows = [`<li title="${said(record.current)}"><span class="n">${deck.seqNo}</span><span class="dots">${dots(record.current)}</span><span></span></li>`];
  for (const c of record.seqs.slice(0, 5)) {
    rows.push(`<li title="${said(c.cards)}"><span class="n">${c.n}</span><span class="dots">${dots(c.cards)}</span><span class="${c.valid ? 'ok' : 'bad'}">${c.valid ? '✓' : '✗'}</span></li>`);
  }
  logEl.innerHTML = rows.join('');
}

function renderChecks() {
  const done = record.seqs.length;
  const valid = record.seqs.filter(c => c.valid).length;
  const fails = [];
  if (selftest.ok !== selftest.passes) fails.push('deck self-test');
  if (!packtest.ok) fails.push('pack self-test');
  if (valid !== done) fails.push('sequence');
  if (record.passesOk !== record.passes) fails.push('shuffle');
  if (!record.trayOk) fails.push('deck display');
  if (!record.logOk) fails.push('log');
  checksEl.className = 'check ' + (fails.length ? 'bad' : 'ok');
  checksEl.title = `Deck self-test: ${selftest.ok} of ${selftest.passes} simulated shuffles dealt every card once, in sequences of exactly ${SEQUENCE_SIZE}.\n`
    + `Pack self-test: ${packtest.packs.toLocaleString()} store packs, ` + packtest.rows.map(o => `${RARITY_NAME[o.rarity]} ${(o.got * 100).toFixed(1)}% (odds ${(o.chance * 100).toFixed(1)}%)`).join(', ') + '.\n'
    + `Live: ${valid} of ${done} sequences valid; ${record.passesOk} of ${record.passes} shuffles fired each of their cards once. `
    + `Deck display ${record.trayOk ? 'matches' : 'does not match'} the deck. Log ${record.logOk ? 'matches' : 'does not match'} the attacks fired.`;
  checksEl.innerHTML = fails.length
    ? `✗ ${fails.join(', ')} check failed`
    : `<span>✓</span> ${valid}/${done} sequences valid`;
}
