/* menus.js — Menus: title, starter pack + reveal, main, loadout, store (packs, preview, test mode), deck preview,
   arena transition, pause exit, gold and run reset. */
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
  $('news').hidden = id !== 'scr-title' && id !== 'scr-main';
  // Focus the first button, unless the screen opts out (the pack picker: focusing a pack would look like choosing it).
  const first = $(id).hasAttribute('data-nofocus') ? null : $(id).querySelector('button:not(:disabled):not([hidden])');
  if (first) first.focus(); else $(id).focus({ preventScroll: true });
  fitNames($(id));
}

// Title → the starter pack if this computer hasn't opened it yet (or didn't finish its reveal), otherwise the main menu.
function afterTitle() {
  $('title-note').hidden = true;
  if (!save.starterDone || !save.starterSeen) { renderStarter(); showScreen('scr-pack'); }
  else goMain();
}
function goMain() { renderLoadout(); renderGold(); showResetConfirm(false); showScreen('scr-main'); }
function renderGold() { for (const el of document.querySelectorAll('.gold-n')) el.textContent = save.gold; }

/* ---------- what's new (title screen and main menu) ---------- */
// Newest first, under version headings. Keep it short: one line per change a player would notice.
const NEWS = [
  { ver: 'v0.28' },
  { tag: 'Loadout', text: 'Test loadout works like the store test now: pick any weapon in your deck and fire its Single, Passive ×3 or Ult ×7 yourself. Whole deck still plays your deck on its own, with damage per second.' },
  { ver: 'v0.27' },
  { tag: 'Boss', text: 'MAKORA is bigger and redrawn: outlined line art, a deep, wide lunging stance, feathered wings, a huge horn and a gold wheel. Its slices reach further to match.' },
  { tag: 'Look', text: 'HUD numbers use a clearer pixel font with the CRT filter on.' },
  { ver: 'v0.26' },
  { tag: 'Balance', text: 'Every weapon except Laser reaches 20% further.' },
  { ver: 'v0.25' },
  { tag: 'Boss', text: 'The summoning plays its chant. "WITH THIS TREASURE…" and "I SUMMON" land on the words, then MAKORA\'s own music kicks in.' },
  { tag: 'Music', text: 'MAKORA has its own fight music.' },
  { tag: 'Balance', text: 'For now: every enemy drops XP, orbs are worth more, and every level needs the same XP, so you level up faster.' },
  { ver: 'v0.24' },
  { tag: 'Look', text: 'The game opens straight onto the title. The TV switch-on only plays when you turn the CRT filter on.' },
  { ver: 'v0.23' },
  { tag: 'Boss', text: 'Level 15 is the last level. The screen goes black… "WITH THIS TREASURE…", "I SUMMON", MAKORA!' },
  { tag: 'Boss', text: 'MAKORA dashes in and slices a cone, three different ways, and sometimes chains all three fast. Stay out of the red cone.' },
  { tag: 'Boss', text: 'It has 20 HP, but it never stays down. Its wheel turns and it comes back with ×3 HP and ×3 damage, and the weapon that killed it can\'t hurt it again.' },
  { tag: 'Look', text: 'Easier to read with the CRT filter on. The floating numbers stay sharp, "AV-1" is gone, and turning the filter off is instant.' },
  { ver: 'v0.22' },
  { tag: 'Look', text: 'A CRT filter: chunky low-res pixels, pixel fonts, scanlines and flicker, and an old TV switching on when the game opens.' },
  { tag: 'Look', text: 'Turn it off in the gear menu (Display → CRT filter) for the original full resolution.' },
  { ver: 'v0.21' },
  { tag: 'Music', text: 'Phase 2 has its own song, and it kicks in straight at the chorus. No more double-speed music.' },
  { tag: 'Boss', text: 'Phase 1 SKURTOSAURUS is a bit weaker: 240 HP, and it throws a little less often.' },
  { tag: 'Relic', text: 'The BULL charge swooshes: a streak of air behind you and a rushing sound, with a heavy impact when you smash into something.' },
  { ver: 'v0.20' },
  { tag: 'Boss', text: 'SKURTOSAURUS has two phases. Phase 1 has 280 HP. Then it roars, shoves you back and returns ENRAGED with a fresh 200 HP bar: faster, charging twice in a row and throwing 3 big rocks in a row.' },
  { tag: 'Music', text: 'SKURTOSAURUS has its own fight music.' },
  { tag: 'Music', text: 'Every change of song is a smooth crossfade, and songs loop seamlessly instead of stopping and restarting.' },
  { ver: 'v0.19' },
  { tag: 'Look', text: 'The menus match the new logo: heavy lettering, blood-red stone buttons and a dark red glow.' },
  { tag: 'Title', text: 'The title is centred on the screen, and the logo tops the main menu.' },
  { tag: 'Music', text: 'Pausing pauses the battle music; it carries on from the same spot when you resume.' },
  { ver: 'v0.18' },
  { tag: 'Music', text: 'No more "click anywhere" hint. Open the game with Play Goon Swarm.command and the music plays the moment it opens.' },
  { ver: 'v0.17' },
  { tag: 'Title', text: 'A new GOON SWARM logo on the title screen. It slams in, with a red glow behind it.' },
  { ver: 'v0.16' },
  { tag: 'Music', text: 'Battles have their own music now. Pressing Start crossfades from the menu music to the level music with a rising whoosh.' },
  { tag: 'Music', text: 'The level music dips during the boss\'s intro, fades out when you\'re defeated, and crossfades back to the menu music when you leave.' },
  { tag: 'Sound', text: 'New Level music slider in the gear menu (3% to start).' },
  { tag: 'Music', text: 'Music now starts as soon as the page opens wherever the browser allows it.' },
  { ver: 'v0.15' },
  { tag: 'Sound', text: 'New starting volumes: Master 10%, Menu music 3%, Sound effects 50%, not muted, so effects sit well above the music. Your sound settings reset to these once.' },
  { ver: 'v0.14' },
  { tag: 'Sound', text: 'A gear (top right) holds the sound settings: Master, Menu music and Sound effects. M still mutes everything.' },
  { tag: 'Sound', text: 'Menu buttons click with a satisfying pop. Start buttons chime and Back buttons dip.' },
  { tag: 'Music', text: 'The lobby music starts as soon as the browser allows it, usually your first click or key press, and is silent during battles.' },
  { ver: 'v0.13' },
  { tag: 'Music', text: 'Lobby music on the title screen and menus. It fades out as you head into the fight, and follows the volume slider and mute (M).' },
  { ver: 'v0.12' },
  { tag: 'Enemies', text: 'A gentler ramp: only red squares at first, then a few purple splitters from level 4, fast triangles from level 7, and big squares (rare) only after level 10.' },
  { tag: 'Balance', text: 'Enemy health no longer goes up with level. There are more of them and they hit harder instead, so you out-grow them.' },
  { tag: 'Enemies', text: 'Mini dinos are red and bigger.' },
  { tag: 'Drops', text: 'A diamond now pulls in every drop on the floor: XP, potions and other diamonds.' },
  { ver: 'v0.11' },
  { tag: 'Boss', text: 'New horns for SKURTOSAURUS and the mini dinos: short, green and curving out like a bull\'s.' },
  { tag: 'Boss', text: 'The rocks in its ring after a charge are bigger, and the big rock flies much faster.' },
  { tag: 'Look', text: 'Thicker dash lines before a dino charges, and a thicker BULL ring by your HP bar.' },
  { ver: 'v0.10' },
  { tag: 'Boss', text: 'SKURTOSAURUS has bull horns now.' },
  { tag: 'Loadout', text: 'New: Test loadout. Watch your whole deck play at practice targets, combos included, with damage per second.' },
  { tag: 'Loadout', text: 'Tidier cards: stats on two lines, and the + button no longer spills out of the card.' },
  { ver: 'v0.9' },
  { tag: 'Boss', text: 'Meet SKURTOSAURUS (new name). Every charge ends in a jump: the ground breaks where it lands, and the ring of rocks bursts out.' },
  { tag: 'Balance', text: 'You start with +10% damage and +10% attack speed. Big squares and mini dinos are easier to kill after level 10.' },
  { ver: 'v0.8' },
  { tag: 'Boss', text: 'SKURTOSAURUS is bigger, with an intro. It lets out a ring of rocks after every charge, and throws a big fast rock down a lane it shows first.' },
  { tag: 'Balance', text: 'Enemies after level 10 have a little less HP and hit harder. Every weapon has 15% more range.' },
  { tag: 'Wheel', text: 'The weapon wheel at levels 5, 15, 25 is gone.' },
  { tag: 'Store', text: 'The pack preview and Loadout fit on one screen. In Test: 1–3 choose, Space fires, Q/E change weapon.' },
  { ver: 'v0.7' },
  { tag: 'Upgrade', text: 'The random weapon card now gives a weapon you own.' },
  { tag: 'Balance', text: 'Enemies and SKURTOSAURUS (now 350 HP) die faster, but enemies hit much harder after level 10.' },
  { tag: 'Gold', text: '+1 gold for reaching level 10, and +1 for beating SKURTOSAURUS.' },
  { ver: 'v0.6' },
  { tag: 'Store', text: 'Buy the Artillery and Magus packs for 20 gold each. Preview them, see the drop rates, and test every weapon first.' },
  { tag: 'Gold', text: 'Earn 1 gold for every 50 enemies defeated, when you die or quit.' },
  { tag: 'Starter', text: 'Everyone starts with the same pack: 5 Bullets and 5 Lasers.' },
  { tag: 'Weapons', text: 'New: Laser, a long instant zap. Dart is gone. Arcane Blast, Arcane Bolt and Arcane Fire are renamed, and Mines and Arcane Fire got combos.' },
  { tag: 'Packs', text: 'Card packs rip open from the top. Space speeds up the reveal.' },
  { tag: 'Balance', text: 'More enemies after level 10, and fewer potions.' },
  { tag: 'Sound', text: 'Every weapon and combo has its own sound.' },
  { ver: 'v0.5' },
  { tag: 'Enemies', text: 'Mini dinos join after level 10: they stop, shake, then dash at you.' },
  { tag: 'Enemies', text: 'Red-purple enemies split into two red ones when they die.' },
  { tag: 'Upgrade', text: 'A level-up card is sometimes a random weapon for this run.' },
  { tag: 'Relic', text: 'Beating SKURTOSAURUS shows what BULL does before you carry on.' },
  { tag: 'Weapons', text: 'Space Impact missiles no longer fizzle out: they fly until they hit or leave the arena.' },
  { tag: 'Wheel', text: 'Press Spin again to stop the wheel early.' },
  { ver: 'v0.4' },
  { tag: 'Controls', text: 'Space is now BULL\'s charge. Esc pauses.' },
  { tag: 'Boss', text: 'SKURTOSAURUS has 700 HP now.' },
  { tag: 'Boss', text: 'SKURTOSAURUS is a green T-rex now, and fights alone: the swarm clears when it arrives.' },
  { tag: 'Relic', text: 'BULL is a short, punchy charge that scoops up drops. Its icon sits by your HP bar.' },
  { tag: 'Wheel', text: 'Don\'t want a weapon? Take XP instead of spinning.' },
  { tag: 'Drops', text: 'XP orbs snap to you up close, and a diamond pulls them in much faster.' },
  { ver: 'Earlier' },
  { tag: 'Boss', text: 'SKURTOSAURUS arrives at level 10. Dodge its slow rocks and its charge.' },
  { tag: 'Relic', text: 'Beat SKURTOSAURUS to earn BULL: charge through enemies.' },
  { tag: 'Upgrade', text: 'Knockback is a new upgrade stat, and so is Attack range.' },
  { tag: 'Balance', text: 'Higher levels come quicker. Enemies hit harder and move faster instead.' },
  { tag: 'Combos', text: 'Runs of 3, 4 or 7 of a card play as one big special attack.' },
  { tag: 'Wheel', text: 'Spin for a weapon at levels 5, 15, 25 and so on.' },
  { tag: 'Drops', text: 'Red potions heal. Diamonds pull every XP orb to you.' },
  { tag: 'Weapons', text: 'New: Space Impact missiles and Mines. Every weapon has its own range.' },
];
for (const ul of document.querySelectorAll('.news-list')) {
  ul.innerHTML = NEWS.map(n => n.ver ? `<li class="news-ver">${n.ver}</li>` : `<li><span class="news-tag">${n.tag}</span>${n.text}</li>`).join('');
}

/* ---------- card packs: the look, and ripping one open ---------- */
// Every pack (the starter and the store's) is drawn the same way: a foil pack with a crimped top strip that tears off.
const PACK_EMBLEM = {
  starter: '<path d="M12 3c2.5 2 3.5 5 3.5 8v8h-7v-8c0-3 1-6 3.5-8z"/><path d="M8.5 15h7"/>',
  artillery: '<path d="M3.5 13.5l13-6 2.2 4.4-13 6z"/><circle cx="8.5" cy="17.5" r="3"/><path d="M8.5 17.5h.01M19.5 8l1.5-.8M19.8 10.6l1.7.2"/>',
  magus: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
};
function packArt(key, { big = false } = {}) {
  const name = key === 'starter' ? STARTER.short : PACKS[key].short, n = key === 'starter' ? starterCards().length : PACKS[key].size;
  return `<span class="pack-art pack-${key}${big ? ' is-big' : ''}" aria-hidden="true">`
    + `<span class="pack-top"></span>`
    + `<span class="pack-body"><svg class="pack-emblem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PACK_EMBLEM[key]}</svg>`
    + `<span class="pack-logo">${name}</span><span class="pack-count">${n} cards</span></span>`
    + `</span>`;
}

// Shake, tear the top strip off, a flash of light from inside, then the pack drops away. Resolves when it's done
// (or after a moment anyway: animations pause in a hidden tab).
function ripPack(art) {
  SFX.rip();
  if (!animOk || !art) return wait(80);
  art.classList.add('is-ripping');
  art.animate([{ transform: 'none' }, { transform: 'rotate(-3deg) scale(1.03)' }, { transform: 'rotate(3deg) scale(1.05)' }, { transform: 'rotate(-1deg) scale(1.05)' }, { transform: 'scale(1.05)' }],
    { duration: 240, easing: 'ease-in-out', fill: 'forwards' });
  art.querySelector('.pack-top').animate([
    { transform: 'none', opacity: 1 },
    { transform: 'translate(-2px, -4px) rotate(-5deg)', opacity: 1, offset: 0.3 },
    { transform: 'translate(70px, -110px) rotate(32deg)', opacity: 0 },
  ], { duration: 420, delay: 200, easing: 'cubic-bezier(.4, 0, .9, .5)', fill: 'forwards' });
  const drop = art.querySelector('.pack-body').animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px) scale(.92)', opacity: 0 }],
    { duration: 240, delay: 660, easing: 'ease-in', fill: 'forwards' });
  return Promise.race([done(drop), wait(1200)]);
}

// Drop rate of each card in a pack: its rarity's chance, shared evenly by that rarity's cards.
function cardOdds(pack) {
  return Object.fromEntries(packOdds(pack).flatMap(o => {
    const pool = cardsOfRarity(o.rarity, pack);
    return pool.map(id => [id, o.chance / pool.length]);
  }));
}

/* ---------- the starter pack (every new player, and after a reset) ---------- */
function renderStarter() { $('btn-starter').innerHTML = packArt('starter', { big: true }); }
let opening = false;
async function openStarterPack() {
  if (opening || current !== 'scr-pack') return;
  opening = true;
  const ids = openStarter();                         // saved before anything is shown
  await ripPack($('btn-starter').querySelector('.pack-art'));
  opening = false;
  if (current !== 'scr-pack') return;
  startReveal(ids, { eyebrow: STARTER.name, title: 'Your first cards', note: 'These are your first deck. Get more cards in the Store.',
    after: () => { save.starterSeen = true; writeSave(); goMain(); } });
}
$('btn-starter').addEventListener('click', openStarterPack);

/* ---------- store ---------- */
function renderStore() {
  renderGold();
  $('store-packs').innerHTML = STORE_PACKS.map(k => {
    const pk = PACKS[k];
    return `<button class="store-pack" type="button" data-pack="${k}" aria-label="${pk.name}, ${pk.price} gold: see what's inside">`
      + packArt(k)
      + `<span class="pack-name">${pk.name}</span>`
      + `<span class="pack-price"><span class="coin" aria-hidden="true"></span>${pk.price}</span>`
      + `</button>`;
  }).join('');
}
$('store-packs').addEventListener('click', e => { const b = e.target.closest('.store-pack'); if (b) openPackView(b.dataset.pack); });

// Pack preview (compact, one screen): the pack, its price and Buy; one tab per weapon with its drop rate; and the
// chosen weapon's details: stats, passive (its smaller combo), ult (×7) and Test it.
let viewing = null, buying = false, viewCard = null;
function openPackView(k) { viewing = k; viewCard = PACKS[k].cards[0]; renderPackView(); showScreen('scr-packview'); }
function renderPackView() {
  const k = viewing, pk = PACKS[k], odds = cardOdds(pk), afford = save.gold >= pk.price;
  $('pv').innerHTML = `<div class="pv-head">${packArt(k)}<div class="pv-info">`
    + `<h2 id="pv-title">${pk.name}</h2>`
    + `<p class="sub small">${pk.size} cards, each rolled on its own (repeats can happen). Drop rate per card:</p>`
    + `<div class="pv-tabs" role="tablist" aria-label="Weapons in this pack">`
    + pk.cards.map(id => `<button type="button" role="tab" class="pv-tab" data-card="${id}" aria-selected="${id === viewCard}" style="--c: var(--${id}); --rc: var(--r-${CARDS[id].rarity})">`
      + `<span class="pv-tab-name">${CARDS[id].name}</span><span class="pv-tab-rar">${RARITY_NAME[CARDS[id].rarity]}</span><b>${(odds[id] * 100).toFixed(1)}%</b></button>`).join('')
    + `</div>`
    + `<div class="pv-buy"><button class="start" type="button" id="btn-buy"${afford ? '' : ' disabled'}>Buy <span class="coin" aria-hidden="true"></span>${pk.price}</button>`
    + `<span class="sub small">${afford ? `You have ${save.gold} gold` : `You have ${save.gold}: ${pk.price - save.gold} more to go`}</span></div>`
    + `</div></div>`
    + `<div class="pv-detail" role="tabpanel">${weaponDetail(viewCard)}</div>`;
}
function weaponDetail(id) {
  const k = CARDS[id], t = COMBOS[id] || {}, passive = Object.keys(t).map(Number).sort((a, b) => a - b).find(n => n !== 7);
  return `<div class="pv-detail-head"><p class="type-name" style="color: var(--${id})">${k.name}</p>`
    + `<p class="type-stats">${k.dmg} dmg · range ${k.range}</p>`
    + `<button type="button" class="pv-test" data-card="${id}">Test it</button></div>`
    + `<p class="type-desc">${k.desc}</p>`
    + (passive ? `<p class="type-combo"><b>Passive ×${passive}</b> <i>${t[passive].name}</i> ${t[passive].does}</p>` : '')
    + (t[7] ? `<p class="type-combo"><b>Ult ×7</b> <i>${t[7].name}</i> ${t[7].does}</p>` : '')
    + (id === 'mine' ? `<p class="type-combo"><b>Chain</b> A blast sets off any mine inside it.</p>` : '');
}
$('pv').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.id === 'btn-buy') buyViewed();
  else if (b.classList.contains('pv-tab')) { viewCard = b.dataset.card; renderPackView(); $('pv').querySelector(`.pv-tab[data-card="${viewCard}"]`).focus(); }
  else if (b.classList.contains('pv-test')) startPractice(viewing, b.dataset.card);
});

async function buyViewed() {
  if (buying) return;
  const k = viewing, res = buyPack(k);            // paid, rolled and saved before anything is shown
  if (!res) return;
  buying = true;
  SFX.coin();
  renderGold();
  await ripPack($('pv').querySelector('.pack-art'));
  buying = false;
  if (current !== 'scr-packview') return;
  const extra = res.where.filter(w => w.to === 'upgrade').length;
  startReveal(res.ids, { eyebrow: PACKS[k].name, title: 'New cards',
    note: `They're in your collection: add them to your deck in Loadout.${extra ? ` ${extra} went to upgrade copies (you already had 5).` : ''}`,
    after: () => { renderPackView(); showScreen('scr-packview'); } });
}

/* ---------- test mode: a pack's weapons against still targets ---------- */
// No swarm and no deck: you fire each attack yourself (1 Single, 2 Passive, 3 Ult). Three test dummies stand in
// range (a main one and two behind, so bounces and blasts show). They can't die, move or hurt you.
function startPractice(k, card, extra) {
  resetRun();
  game.practice = { pack: k, card, dummies: [], dmg: 0, ...extra };
  game.started = true;
  const p = game.player;
  p.x = W * 0.28; p.y = (playH || H) * 0.5;
  placeDummies();
  game.inMenu = false;
  menuEl.hidden = true;
  document.body.classList.add('in-practice');
  renderPractice();
  $('practice').hidden = false;
  last = performance.now();
  document.activeElement?.blur();
}
// Test loadout (user): works like the store's test, one tab per weapon in your deck, so you can fire each one's
// Single, Passive (×3) and Ult (×7) yourself. The last tab, Whole deck, lets your deck fire on its own exactly as in
// a run (sequences, shuffles and combos, your starting stats) and counts damage per second.
function startLoadoutTest() {
  if (deckProblems().length) return;
  startPractice(null, prCards(true)[0], { loadout: true, t: 0 });
}
const DECK_TAB = 'deck';                              // the Whole deck tab in Test loadout
// The weapons you can pick in test mode: the pack's, or the ones in your deck.
function prCards(loadout = game.practice?.loadout) {
  return loadout ? CARD_IDS.filter(id => save.equipped[id] > 0) : PACKS[game.practice.pack].cards;
}
const prAuto = () => game.practice?.card === DECK_TAB;
function placeDummies() {
  const pr = game.practice, p = game.player;
  // the loadout test puts them inside every card's range, so no card in the deck ever waits
  const reach = pr.card === DECK_TAB ? Math.min(...prCards().map(rangeOf)) : rangeOf(pr.card);
  const d = Math.min(reach * 0.75, W * 0.45);
  const mk = (x, y, r) => ({ dummy: true, type: 'dummy', shape: 'dummy', x, y, r, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, speed: 0, dmg: 0, hit: 0, born: 1 });
  pr.dummies = [mk(p.x + d, p.y, 18), mk(p.x + d + 60, p.y - 70, 13), mk(p.x + d + 60, p.y + 70, 13)];
  for (const e of pr.dummies) clampTo(e, e.r);
  game.enemies = pr.dummies.slice();
  game.mines = []; game.projectiles = []; game.timers = []; game.sweeps = [];
}
function practiceAttacks(card) {
  const t = COMBOS[card] || {}, passive = Object.keys(t).map(Number).sort((a, b) => a - b).find(n => n !== 7);
  return [{ n: 1, label: 'Single', name: '' }, passive && { n: passive, label: `Passive ×${passive}`, name: t[passive].name }, t[7] && { n: 7, label: 'Ult ×7', name: t[7].name }].filter(Boolean);
}
// 1–3 choose the attack, Space fires it (user), Q / E change weapon. Clicking an attack chooses and fires it.
function renderPrDmg() {
  const pr = game.practice;
  $('pr-dmg').textContent = Math.round(pr.dmg);
  $('pr-dps').hidden = !prAuto();
  if (prAuto()) $('pr-dps-n').textContent = pr.t > 1 ? (pr.dmg / pr.t).toFixed(1) : '–';
}
function renderPractice() {
  const pr = game.practice, auto = prAuto();
  document.body.classList.toggle('is-loadout-test', auto);   // shows your deck along the bottom
  $('pr-fire').hidden = auto;
  $('pr-keys').hidden = auto; $('pr-keys-lo').hidden = !auto;
  $('btn-pr-back').textContent = pr.loadout ? 'Back to loadout' : 'Back to pack';
  if (pr.loadout) {
    const n = equippedCards().length;
    $('pr-eyebrow').textContent = `Test · Your loadout · ${n} card${n === 1 ? '' : 's'}`;
  } else $('pr-eyebrow').textContent = `Test · ${PACKS[pr.pack].name}`;
  $('pr-tabs').innerHTML = prCards().map(id => `<button type="button" data-card="${id}" aria-pressed="${id === pr.card}" style="--c: var(--${id})">${CARDS[id].name}</button>`).join('')
    + (pr.loadout ? `<button type="button" data-card="${DECK_TAB}" aria-pressed="${auto}" style="--c: var(--text)">Whole deck</button>` : '');
  if (auto) { $('pr-fire').innerHTML = ''; renderPrDmg(); return; }
  const atk = practiceAttacks(pr.card);
  pr.sel = Math.min(pr.sel || 0, atk.length - 1);
  $('pr-fire').innerHTML = atk.map((a, i) =>
    `<button type="button" data-i="${i}" aria-pressed="${i === pr.sel}" style="--c: var(--${pr.card})"><span class="up-key" aria-hidden="true">${i + 1}</span><b>${a.label}</b>${a.name ? `<small>${a.name}</small>` : ''}</button>`).join('');
  renderPrDmg();
}
function testFire(n) {
  const pr = game.practice;
  if (!pr || prAuto()) return;
  const card = pr.card;
  if (n === 1) shoot(card, inRange(card) || pr.dummies[0]);
  else if (COMBOS[card]?.[n]) runCombo({ card, n, ...COMBOS[card][n] });
}
function practiceSelect(i) { const pr = game.practice; if (!prAuto() && i < practiceAttacks(pr.card).length) { pr.sel = i; renderPractice(); } }
function practiceFire() { const pr = game.practice; if (prAuto()) return; const a = practiceAttacks(pr.card)[pr.sel || 0]; if (a) testFire(a.n); }
function practiceWeapon(d) {
  const pr = game.practice, ids = prCards().concat(pr.loadout ? [DECK_TAB] : []), i = (ids.indexOf(pr.card) + d + ids.length) % ids.length;
  practiceCard(ids[i]);
}
// Switch weapon (or to Whole deck): the damage count starts again.
function practiceCard(id) {
  const pr = game.practice;
  pr.card = id; pr.dmg = 0; pr.t = 0;
  placeDummies(); renderPractice();
}
function exitPractice() {
  if (!game.practice) return;
  const loadout = game.practice.loadout;
  resetRun();
  document.body.classList.remove('in-practice', 'is-loadout-test');
  $('practice').hidden = true;
  game.inMenu = true;
  menuEl.hidden = false;
  if (loadout) { renderLoadout(); showScreen('scr-loadout'); $('btn-loadout-test').focus(); return; }
  renderPackView();
  showScreen('scr-packview');
}
// Keys in test mode: 1–3 choose, Space fires, Q / E change weapon, Esc goes back; on Whole deck, R restarts the
// count. Returns true if it used the key (movement keys still move you).
function onPracticeKey(e) {
  if (e.code === 'Escape') { exitPractice(); e.preventDefault(); return true; }
  if (prAuto() && e.code === 'KeyR') {
    if (!e.repeat) { game.practice.dmg = 0; game.practice.t = 0; renderPrDmg(); }
    e.preventDefault();
    return true;
  }
  const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
  if (m) { if (!e.repeat) practiceSelect(Number(m[1]) - 1); }
  else if (e.code === 'Space') { if (!e.repeat) practiceFire(); }
  else if (e.code === 'KeyQ' || e.code === 'KeyE') { if (!e.repeat) practiceWeapon(e.code === 'KeyE' ? 1 : -1); }
  else return false;
  e.preventDefault();
  return true;
}
$('practice').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !game.practice) return;
  if (b.id === 'btn-pr-back') exitPractice();
  else if (b.dataset.card) practiceCard(b.dataset.card);
  else if (b.dataset.i) { practiceSelect(Number(b.dataset.i)); practiceFire(); }
  b.blur();
});

// The cards are already decided; this only shows them. One at a time, each card comes up
// out of the pack face down, then flips. Skip shows the rest at once.
let revealRun = 0;                                   // bumped to stop a reveal in progress
let revealRate = 1;                                  // Space speeds up the rest of a reveal (user)
let revealAfter = null;                              // where Continue goes
const wait = ms => new Promise(r => setTimeout(r, ms));
const done = anim => anim.finished.catch(() => {});  // a cancelled animation just ends the wait
// Plays an animation and waits for it, but never longer than it should take: a throttled or hidden page can slow
// animations right down, and the reveal must still keep its pace (it then jumps the animation to its end).
function play(el, frames, opts) {
  const a = el.animate(frames, opts), total = (opts.duration || 0) + (opts.delay || 0) + 20;
  return Promise.race([done(a), wait(total)]).then(() => { try { if (a.playState === 'running') a.finish(); } catch (err) { /* already gone */ } });
}

function startReveal(ids, { eyebrow, title, note, after }) {
  $('r-eyebrow').textContent = eyebrow;
  $('r-title').textContent = title;
  $('reveal-note').textContent = note || '';
  $('reveal-note').hidden = true;
  revealAfter = after;
  revealRate = 1;
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
  const ms = t => t / revealRate;                    // quick already (user); Space makes the rest 4× quicker
  await wait(ms(120));
  for (const li of revealEl.children) {
    if (run !== revealRun) return;
    li.classList.remove('is-waiting');
    await play(li, [{ transform: 'translateY(40px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: ms(130), easing: 'cubic-bezier(.2, .9, .3, 1.2)' });
    if (run !== revealRun) return;
    await wait(ms(20));
    if (run !== revealRun) return;
    await play(li, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms(60), easing: 'ease-in' });
    if (run !== revealRun) return;
    li.classList.remove('is-down');
    SFX.flip(CARDS[li.dataset.card].rarity);
    const glow = getComputedStyle(li).getPropertyValue('--rc').trim();
    await play(li, [
      { transform: 'scaleX(0)', boxShadow: `0 0 0 0 ${glow}` },
      { transform: 'scaleX(1) translateY(-6px)', boxShadow: `0 0 18px 2px ${glow}`, offset: 0.6 },
      { transform: 'none', boxShadow: `0 0 0 0 ${glow}` },
    ], { duration: ms(160), easing: 'ease-out' });
    await wait(ms(25));
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

function speedReveal() {
  if (revealRate > 1) { skipReveal(); return; }      // a second press shows the rest at once
  revealRate = 4;
}

function finishReveal() {
  $('btn-reveal-all').hidden = true;
  $('reveal-tip').hidden = true;
  $('reveal-note').hidden = !$('reveal-note').textContent;
  $('btn-reveal-done').hidden = false;
  $('btn-reveal-done').focus();
}

$('btn-reveal-all').addEventListener('click', skipReveal);
$('btn-reveal-done').addEventListener('click', () => revealAfter?.());

/* ---------- loadout: one row per card type in the equipped deck ---------- */
// Loadout: a deck builder. Every card you own, with − / + for how many copies are in the deck.
function renderLoadout() {
  const cards = equippedCards(), build = true;
  $('loadout-sub').textContent = `Deck · ${cards.length} card${cards.length === 1 ? '' : 's'} · sequences of ${SEQUENCE_SIZE}`;
  const hint = $('loadout-hint');
  hint.hidden = false;
  hint.textContent = `${cards.length ? 'Up to' : 'Add cards to build your deck: up to'} ${COPY_LIMIT} of each card you own, ${DECK_LIMIT} in all. Get more cards in the Store.`;
  // Compact tiles (user: the screens were too long): the card, how many you own, one line of stats and − / +.
  // Each weapon's full details and combos are in the store's pack preview; its description is the tile's tooltip.
  $('types').innerHTML = CARD_IDS.filter(id => build ? save.owned[id] : save.equipped[id]).map(c => {
    const k = CARDS[c], n = save.equipped[c] || 0, max = Math.min(COPY_LIMIT, save.owned[c] || 0);
    const t = COMBOS[c] || {}, sizes = Object.keys(t).map(Number).sort((a, b) => a - b);
    return `<div class="type${!n ? ' is-out' : ''}" title="${k.desc}"><ol class="preview">${mcard(c, { rarity: true })}</ol><div class="type-body">`
      + `<p class="type-name" style="color: var(--${c})">${k.name}</p>`
      + `<p class="type-stats">${k.dmg} dmg · range ${k.range}</p>`
      + (sizes.length ? `<p class="type-stats is-combos">combos ${sizes.map(x => `×${x}`).join(' ')}</p>` : '')
      + `<div class="stepper" role="group" aria-label="${k.name} copies in the deck">`
      + `<button type="button" data-id="${c}" data-d="-1" aria-label="Remove one ${k.name}"${n <= 0 ? ' disabled' : ''}>−</button>`
      + `<b aria-live="polite">${n}</b>`
      + `<button type="button" data-id="${c}" data-d="1" aria-label="Add one ${k.name}"${n >= max || cards.length >= DECK_LIMIT ? ' disabled' : ''}>+</button>`
      + `<span class="owned">of ${save.owned[c] || 0} owned</span>`
      + `</div></div></div>`;
  }).join('');
  fitNames($('types'));
  $('btn-play').disabled = $('btn-loadout-test').disabled = deckProblems().length > 0;
}
$('types').addEventListener('click', e => {
  const b = e.target.closest('.stepper button');
  if (!b || b.disabled) return;
  const id = b.dataset.id, n = (save.equipped[id] || 0) + Number(b.dataset.d);
  if (n < 0 || n > Math.min(COPY_LIMIT, save.owned[id] || 0) || (Number(b.dataset.d) > 0 && equippedCards().length >= DECK_LIMIT)) return;
  if (n) save.equipped[id] = n; else delete save.equipped[id];
  writeSave();
  renderLoadout();
  $('types').querySelector(`.stepper button[data-id="${id}"][data-d="${b.dataset.d}"]:not(:disabled)`)?.focus()
    || $('types').querySelector(`.stepper button[data-id="${id}"]:not(:disabled)`)?.focus();
});

$('btn-title').addEventListener('click', afterTitle);

// Reset data: wipes this computer's save (cards, deck, gold, starter pack) after an in-page "Really reset?" confirm.
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
$('btn-store').addEventListener('click', () => { renderStore(); showScreen('scr-store'); });
$('btn-store-back').addEventListener('click', goMain);
$('btn-pv-back').addEventListener('click', () => { renderStore(); showScreen('scr-store'); });
$('btn-loadout-back').addEventListener('click', goMain);
$('btn-loadout-test').addEventListener('click', startLoadoutTest);
$('btn-main-back').addEventListener('click', () => showScreen('scr-title'));
$('btn-play').addEventListener('click', startPreview);
$('scr-preview').addEventListener('click', enterArena);   // click to skip the wait

function onMenuKey(e) {
  if (current === 'scr-preview' && (e.code === 'Enter' || e.code === 'Space')) { enterArena(); e.preventDefault(); }
  if (current === 'scr-pack' && e.code === 'Space' && !e.repeat) { openStarterPack(); e.preventDefault(); }
  if (current === 'scr-reveal' && e.code === 'Space' && !e.repeat && !$('btn-reveal-all').hidden) { speedReveal(); e.preventDefault(); }
  if (e.code === 'Escape') {
    if (current === 'scr-loadout' || current === 'scr-store') goMain();
    else if (current === 'scr-packview' && !buying) { renderStore(); showScreen('scr-store'); }
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
    beams: [], sweeps: [], swooshes: [], practice: null, goldBonus: 0,
  });
  resetStats();
  resetBoss();
  resetMakora();
  Object.assign(game.player, { x: W / 2, y: H / 2, flash: 0, hp: PLAYER.hp, safe: 0, kx: 0, ky: 0 });
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

// Pause → Exit to title: the run ends, and pays its gold (user: quitting earns gold too).
function exitToTitle() {
  const g = (!game.inMenu && !game.over && !game.practice && deck ? payGold(game.kills) : 0) + (game.over ? 0 : game.goldBonus || 0);
  resetRun();
  $('title-note').hidden = !g;
  $('title-note').innerHTML = `<span class="coin" aria-hidden="true"></span>+${g} gold from that run`;
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
  const turns = game.makora ? game.makora.turns : 0;
  $('d-stats').textContent = `Level ${game.level} · Sequence ${deck.seqNo} · ${game.kills} enem${game.kills === 1 ? 'y' : 'ies'} defeated`
    + (game.makora ? ` · MAKORA's wheel turned ${turns} time${turns === 1 ? '' : 's'}` : '');
  const g = payGold(game.kills);                   // 1 gold per 50 defeated (user)
  const bonus = game.goldBonus || 0;
  $('d-gold').innerHTML = `<span class="coin" aria-hidden="true"></span><b>+${g + bonus} gold</b> · ${g} for kills (1 per ${GOLD_PER})${bonus ? ` + ${bonus} bonus` : ''} · you have ${save.gold}`;
  if (g) SFX.coin();
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
  goMain();
});
