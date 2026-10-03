/* hud.js — HUD: deck tray, card animations, attack log and checks. */
'use strict';

/* ============================================================
   HUD: reads deck state and the fired record, never the reverse.
   ============================================================ */
const $ = id => document.getElementById(id);
const trayEl = $('tray'), logEl = $('log'), checksEl = $('checks');
// The two decks' trays (v0.53): each with its own tray, combo bars, counter and shuffle icon. `next`: its next card,
// whose bar fills as its timer runs (main.js).
const DECK_VIEWS = {
  ranged: { kind: 'ranged', get deck() { return deck; }, box: $('rbox'), tray: trayEl, rapid: $('rapid'), left: $('deckLeft'), status: $('deckStatus'), shuffle: $('shuffleIcon'), next: null, timer: 0 },
  melee:  { kind: 'melee', get deck() { return mdeck; }, box: $('mbox'), tray: $('mtray'), rapid: $('mrapid'), left: $('mdeckLeft'), status: $('mdeckStatus'), shuffle: $('mshuffleIcon'), next: null, timer: 0 },
  // the Wild deck (v0.62): a third tray, on top
  wild:   { kind: 'wild', get deck() { return wdeck; }, box: $('wbox'), tray: $('wtray'), rapid: $('wrapid'), left: $('wdeckLeft'), status: $('wdeckStatus'), shuffle: $('wshuffleIcon'), next: null, timer: 0 },
};
const selftest = selfTest(2000);
const packtests = STORE_PACKS.filter(k => !PACKS[k].fixed).map(k => ({ k, ...packSelfTest(PACKS[k], 20000) }));
const packtest = { ok: packtests.every(t => t.ok), packs: packtests.reduce((n, t) => n + t.packs, 0), rows: packtests.flatMap(t => t.rows) };

function onAttack(ev) {
  if (WILD) { onWildAttack(ev); return; }   // (the Wild deck's turn: combat.js wildTurn)
  if (NET.host && NET.run && ACTIVE && !ACTIVE.local) { ACTIVE.fired++; return; }   // a friend's card: their screen shows it (coop.js)
  tallyPlay(ev.card);                       // (the online run log, flow.js)
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
    flashShuffle(DECK_VIEWS.ranged);
    SFX.shuffle();
  }
  renderTrayOf(DECK_VIEWS.ranged, fresh, fresh ? null : ev.filled, true);
  renderLog();
  renderChecks();
}
// The melee deck's card (combat.js fireMelee): only its tray changes (the log and checks follow the ranged deck).
function onMeleeAttack(ev) {
  if (WILD) { onWildAttack(ev); return; }
  if (NET.host && NET.run && ACTIVE && !ACTIVE.local) { ACTIVE.mfired++; return; }   // a friend's: their screen shows it
  tallyPlay(ev.card);
  if (ev.reshuffle) { flashShuffle(DECK_VIEWS.melee); SFX.shuffle(); }
  renderTrayOf(DECK_VIEWS.melee, !!ev.sequence, ev.sequence ? null : ev.filled, true);
}
// The Wild deck's card (v0.62), the same way: only its tray changes.
function onWildAttack(ev) {
  if (NET.host && NET.run && ACTIVE && !ACTIVE.local) { ACTIVE.wfired++; return; }
  tallyPlay(ev.card);
  if (ev.reshuffle) { flashShuffle(DECK_VIEWS.wild); SFX.shuffle(); }
  renderTrayOf(DECK_VIEWS.wild, !!ev.sequence, ev.sequence ? null : ev.filled, true);
}

// v0.57 (user): your stats only while Tab is held, and N hides the decks (kept for next time).
const showStats = on => document.body.classList.toggle('show-stats', !!on);
let glideT = 0;
function toggleDecks(hide = !document.body.classList.contains('hide-decks')) {
  document.body.classList.add('hud-glide');                 // (the bars glide while it plays: style.css)
  clearTimeout(glideT);
  glideT = setTimeout(() => document.body.classList.remove('hud-glide'), 320);
  document.body.classList.toggle('hide-decks', hide);
  try { localStorage.setItem('rogue.hideDecks', hide ? '1' : ''); } catch (err) { /* no storage */ }
}
try { if (localStorage.getItem('rogue.hideDecks')) document.body.classList.add('hide-decks'); } catch (err) { /* no storage */ }

// Player HP bar. `hit` flashes it red for a moment.
function renderHp(hit) {
  if (!isLocal()) return;
  const p = game.player, el = $('hp');
  $('hp-fill').style.transform = `scaleX(${p.hp / maxHp()})`;
  el.setAttribute('aria-valuemax', maxHp());
  const sh = game.bshield, shEl = $('hp-shield');            // Brickshot's shield (v0.58): on the end of your health
  shEl.hidden = !sh;
  if (sh) Object.assign(shEl.style, { left: `${Math.min(100, p.hp / maxHp() * 100)}%`, width: `${sh.hp / maxHp() * 100}%`, opacity: String(Math.min(1, sh.t / 0.4)) });
  $('hp-num').textContent = Math.ceil(p.hp) + (sh ? ` +${Math.ceil(sh.hp)}` : '');
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
  $('xp-num').textContent = `${Math.floor(game.xp)}/${need}`;   // (v0.57: no last level any more)
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
const NEXT_LIFT = -3;           // matches .decks .card.is-next (v0.53: slim bars)
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
function renderRapid(V, seq, pos) {
  V.rapid.style.setProperty('--n', seq.length);
  const cbs = combosIn(seq, pos);
  V.rapid.innerHTML = cbs.map(c =>
    `<span class="rapid-bar${c.n >= 7 ? ' is-max' : ''}" style="--from:${c.start}; --len:${c.n}; --bc: var(--${c.card})"></span>`).join('');
  for (const li of V.tray.children) li.classList.remove('is-combo');
  for (const c of cbs) for (let i = c.start; i < c.start + c.n; i++) V.tray.children[i]?.classList.add('is-combo');
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

// Both trays (a new run, an augment): which decks show, then each one's cards.
function renderTray(fresh, filled = null) {
  renderTrayOf(DECK_VIEWS.ranged, fresh, filled);
  renderTrayOf(DECK_VIEWS.melee, fresh, null);
  renderTrayOf(DECK_VIEWS.wild, fresh, null);
}
// One deck's tray. A new sequence rebuilds the cards in its order; later attacks only update their state.
// `filled`: slots the shuffle just dealt into, which flip face up where they are. `played`: a card just fired.
function renderTrayOf(V, fresh, filled = null, played = false) {
  const d = V.deck, tray = V.tray;
  const n = [deck, mdeck, wdeck].filter(Boolean).length, two = n >= 2, three = n >= 3;   // (the HUD above moves up for each)
  if (V.box.hidden !== !d || document.body.classList.contains('two-decks') !== two || document.body.classList.contains('three-decks') !== three) {
    V.box.hidden = !d;
    document.body.classList.toggle('two-decks', two);
    document.body.classList.toggle('three-decks', three);
    resize();                                // the HUD moved: how far down you can go changes with it (arena.js)
  }
  if (!d) { tray.innerHTML = ''; V.next = null; return; }
  const seq = d.sequence, pos = d.seqPos, breaks = d.passBreaks;
  if (filled && !fresh) {
    filled.forEach((i, k) => {
      const li = tray.children[i];
      if (li) revealCard(li, seq[i], i, breaks.includes(i), k);
    });
  }
  const same = tray.children.length === seq.length && [...tray.children].every((li, i) => li.dataset.card === (seq[i] || ''));
  if (fresh || !same) {
    tray.style.setProperty('--n', seq.length);
    tray.innerHTML = seq.map((c, i) => trayCard(c, i, breaks.includes(i))).join('');
    fitNames(tray);
    if (fresh && animOk) animateReset(tray);
  } else if (played && pos > 0 && animOk) {
    animatePlay(tray.children[pos - 1]);   // the card that just fired
  }
  [...tray.children].forEach((li, i) => {
    li.classList.toggle('is-fired', i < pos);
    li.classList.toggle('is-next', i === pos);
    const ak = game.aug.get(i);                         // its augment (v0.68): its tag on the card, in its colour
    li.classList.toggle('is-aug', !!ak);
    if (ak) { li.dataset.augTag = AUGS[ak].tag; li.style.setProperty('--ac', `var(${AUGS[ak].col})`); }
    else if (li.dataset.augTag) { delete li.dataset.augTag; li.style.removeProperty('--ac'); }
    li.setAttribute('aria-label', seq[i] === null ? `${i + 1}: face down, dealt at the next shuffle`
      : `${i + 1}: ${CARDS[seq[i]].name}${ak ? `, ${AUGS[ak].name} augment` : ''}${li.classList.contains('is-combo') ? ', part of a combo' : ''}${i < pos ? ', fired' : i === pos ? ', next' : ''}`);
  });
  V.next = tray.querySelector('.is-next');
  renderRapid(V, seq, pos);
  $('cycle').textContent = (deck || mdeck).seqNo;

  // Deck counter: cards left to fire before the next shuffle, out of the whole deck.
  V.left.innerHTML = `<b>${d.left}</b>/${d.size}`;
  V.status.setAttribute('aria-label', `${{ melee: 'Melee', wild: 'Wild', ranged: 'Ranged' }[V.kind]} deck: ${d.left} of ${d.size} cards left before the next shuffle`);
  if (V.kind !== 'ranged') return;

  // The tray must show exactly the deck's current sequence, with fired cards matching what combat fired.
  const shown = [...tray.children].map(li => li.dataset.card);
  const firedShown = tray.querySelectorAll('.is-fired').length;
  const ok = shown.join() === seq.join() && firedShown === record.current.length
    && record.current.every((c, i) => c === shown[i]) && shown.length === SEQUENCE_SIZE;
  if (!ok) record.trayOk = false;
}

// Every card has fired and the deck just reshuffled: swap the "cards left" text for a
// spinning shuffle icon for a moment, then let renderTray's next call show it again.
function flashShuffle(V) {
  V.left.hidden = true;
  V.shuffle.hidden = false;
  clearTimeout(V.timer);
  V.timer = setTimeout(() => {
    V.left.hidden = false;
    V.shuffle.hidden = true;
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
    { transform: T(home, -7, 1.12), boxShadow: `0 0 12px 2px ${glow}`, opacity: 1, offset: 0.35 },
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
function animateReset(tray) {
  const slot = slotPx();
  [...tray.children].forEach((li, i) => {
    const home = i * slot;
    li.animate([
      { transform: T(home, -8, 0.9), opacity: 0 },
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
  checksEl.className = 'check dev-only ' + (fails.length ? 'bad' : 'ok');   // (dev-only: the test version shows it, v0.55)
  checksEl.title = `Deck self-test: ${selftest.ok} of ${selftest.passes} simulated shuffles dealt every card once, in sequences of exactly ${SEQUENCE_SIZE}.\n`
    + `Pack self-test: ${packtest.packs.toLocaleString()} store packs, ` + packtest.rows.map(o => `${RARITY_NAME[o.rarity]} ${(o.got * 100).toFixed(1)}% (odds ${(o.chance * 100).toFixed(1)}%)`).join(', ') + '.\n'
    + `Live: ${valid} of ${done} sequences valid; ${record.passesOk} of ${record.passes} shuffles fired each of their cards once. `
    + `Deck display ${record.trayOk ? 'matches' : 'does not match'} the deck. Log ${record.logOk ? 'matches' : 'does not match'} the attacks fired.`;
  checksEl.innerHTML = fails.length
    ? `✗ ${fails.join(', ')} check failed`
    : `<span>✓</span> ${valid}/${done} sequences valid`;
}
