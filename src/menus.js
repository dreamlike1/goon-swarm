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
  menuEl.classList.toggle('is-home', id === 'scr-main');
  document.body.classList.toggle('on-home', id === 'scr-main');
  if (id !== 'scr-main') stopMenuDemo();             // (the main menu's little fight, below)
  const home = id === 'scr-title' || id === 'scr-main';   // the changelog button (v0.56) shows here
  $('news-btn').hidden = !home;
  $('board').hidden = id !== 'scr-title';                 // and the leaderboard on the title only (v0.57, user: not the main menu)
  if (home && typeof refreshBoard === 'function') refreshBoard();
  // Focus the first button, unless the screen opts out (the pack picker: focusing a pack would look like choosing it).
  const first = $(id).hasAttribute('data-nofocus') ? null : $(id).querySelector('button:not(:disabled):not([hidden])');
  if (first) first.focus(); else $(id).focus({ preventScroll: true });
  fitNames($(id));
  if (id === 'scr-main') { startMenuDemo(); annOpen(); }   // (after the leaderboard is shown: the box stops above it)
}

// Title → the starter pack if this computer hasn't opened it yet (or didn't finish its reveal), otherwise the main menu.
function afterTitle() {
  if (typeof maintOn === 'function' && maintOn()) return;   // v0.71: locked for maintenance (maintenance.js)
  $('title-note').hidden = true;
  if (typeof needName === 'function' && needName()) { showNameScreen(); return; }   // v0.56: a name first (online.js)
  if (!save.starterDone || !save.starterSeen) { renderStarter(); showScreen('scr-pack'); }
  else goMain();
}
function goMain() { renderLoadout(); renderGold(); showScreen('scr-main'); }
function renderGold() { for (const el of document.querySelectorAll('.gold-n')) el.textContent = save.gold; }

/* ---------- your name (v0.56, user: one per PC; online.js) ---------- */
function showNameScreen() {
  $('name-status').textContent = ONLINE.db ? '' : 'Connecting…';
  $('btn-name-offline').hidden = !ONLINE.offline;
  try { if (!$('name-in').value) $('name-in').value = localStorage.getItem('rogue.coopName') || ''; } catch (err) { /* no storage */ }
  showScreen('scr-name');
  $('name-in').focus();
}
$('name-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('name-in').value.trim().replace(/\s+/g, ' '), st = $('name-status'), go = $('btn-name-go');
  if (!/^[A-Za-z0-9 _.-]{2,14}$/.test(name)) { st.textContent = '2 to 14 letters or numbers (spaces, _ . - are fine too).'; return; }
  go.disabled = true; st.textContent = 'Checking…';
  const r = await onlineRegister(name);
  go.disabled = false;
  if (r.ok) { st.textContent = ''; afterTitle(); return; }
  if (r.error === 'name') st.textContent = 'That name is taken. Try another.';
  else if (r.error === 'device') { st.innerHTML = `This PC already plays as <b>${esc(r.name)}</b>. Type that name to log back in.`; $('name-in').value = r.name; }
  else if (r.error === 'bad') st.textContent = '2 to 14 letters or numbers (spaces, _ . - are fine too).';
  else { st.textContent = 'Can’t reach the leaderboard right now.'; ONLINE.offline = true; $('btn-name-offline').hidden = false; renderBoard(); }
});
$('btn-name-back').addEventListener('click', () => showScreen('scr-title'));
$('btn-name-offline').addEventListener('click', () => afterTitle());

/* ---------- what's new (title screen and main menu) ---------- */
// Newest first, under version headings. Keep it short: one line per change a player would notice.
const NEWS = [
  { ver: 'v0.54' },
  { tag: 'Menu', text: 'New main menu: the buttons on the left, and on the right a little fight playing itself with the weapons in your loadout.' },
  { tag: 'Menu', text: 'Settings, on the title screen and the main menu: enter a code, and Reset data.' },
  { tag: 'Packs', text: 'Triple S is holographic now: pearly foil in every pastel, on its cards and wherever its name shows.' },
  { tag: 'Packs', text: 'Opening a pack has a rising sound as it tears. Face-down cards are a swirl of colour that climbs from black to Common to their own rarity, then a bright swipe opens each one and sparkles burst out (more the rarer it is), the rarest come last, and the best rarity the pack can give gets its own sound and a bigger burst.' },
  { tag: 'Store', text: 'Test pack and Test loadout are a little battle now: a small arena with real enemies walking in, and your weapon fires on its own like in a run. 1, 2 and 3 switch between its Single, Passive and Ult; Space fires right away. Whole deck plays your deck against them and counts damage per second.' },
  { tag: 'Effects', text: 'New muzzle flashes (a layered flame with side flares and sparks) and hit flashes (a shock ring, streaks thrown the way the shot went, a white-hot core; crits get a gold ring).' },
  { tag: 'Levels', text: 'No level cap: you keep levelling up past level 30.' },
  { tag: 'Boss', text: 'MAKORA adapted to every weapon in your deck: any of its moves is now instant death. Only a dash, DEFLECT or the shield after a level-up saves you.' },
  { tag: 'Swarm', text: 'Each stage builds up now: easy enemies first, then the stage’s tougher ones, then both together. The huge swarm is shorter and much fiercer. And the swarm quietly learns how strong you are, a little while after you get stronger.' },
  { tag: 'Swarm', text: 'Triangles are slower, so they don’t catch up with you so fast.' },
  { tag: 'Menu', text: 'The end-of-run screen is darker, and Space no longer presses Retry.' },
  { tag: 'Upgrade', text: 'The random weapon card now gives another copy of a weapon from your loadout, not any card you own.' },
  { tag: 'HUD', text: 'Your stats are hidden in a run: hold Tab to see them. Press N to hide or show your cards (they slide away and the bars glide down). The relic icons now sit beside the HP and XP bars instead of on them.' },
  { tag: 'Online', text: 'A leaderboard, top right of the menu. A run counts when you defeat MAKORA the first time; it’s ranked by your highest wheel count, then how many runs.' },
  { tag: 'Online', text: 'Pick a name the first time you play. One name per PC: it logs in by itself after that, and your save is kept online too. Reset data deletes the name.' },
  { tag: 'Event', text: 'New event pack: T-BALLS, in red. 10 Ranged and 10 Melee T-Balls that orbit you, up to 2 of each. Each turn a ball does one of 4 things at random, and the effect comes from the ball.' },
  { tag: 'Event', text: 'Ranged balls lunge, beam, stick and explode, fire, or bounce off an enemy 4 times. Melee balls shield you from a hit (one ball holds it up, for 2.5 s), push, zap with blue energy, whip, or all pulse red energy. T-Balls need no other cards; with other cards in your deck they get ×3 GO WILD! and ×7 QUAD SHOT!' },
  { tag: 'Music', text: 'A run with only T-Balls in your decks plays MRT instead of the usual battle music.' },
  { tag: 'Menu', text: 'The changelog is a button in the bottom left now.' },
  { tag: 'Starter', text: 'The starter pack has 10 Bullets and 10 Cannons now (5 of each before), with 10 Knife Stabs and 10 Punches: 40 cards.' },
  { tag: 'Menu', text: 'Start shows your loadout first: both decks, and the combos their copies reach. Then Fight.' },
  { tag: 'Store', text: 'Buying a pack zooms it into the middle, ready to rip open. Pack openings have Skip (this page) and Skip all (every card at once).' },
  { tag: 'Boss', text: 'New boss: AWAS THE SNEK, after OBI ONE. The arena turns into an old phone screen, green with everything in black, and a snake moves round it one square at a time.' },
  { tag: 'Boss', text: 'AWAS goes for the apple and grows when it eats one. You can’t hurt the snake: shoot the apple, and AWAS loses what the apple loses. Don’t touch it. In phase 2 there are two apples.' },
  { tag: 'Run', text: 'A run has 4 stages now: SKURTOSAURUS, OBI ONE, AWAS THE SNEK, then MAKORA.' },
  { tag: 'Relic', text: 'New relic from AWAS: VAMPIRIC BALLSACK. Kills fill it; when it’s full, press E to get back 15% of your health. Then it needs a few seconds before it fills again.' },
  { tag: 'Keys', text: 'DEFLECT is on Q now (it was P). VAMPIRIC BALLSACK is E.' },
  { tag: 'Boss', text: 'Bosses have death animations: SKURTOSAURUS topples over, OBI ONE fades into the force, AWAS blinks out like an old game over.' },
  { tag: 'Arena', text: 'Get close to the edge of the arena and it lights up, so you can see where it is.' },
  { tag: 'Melee', text: 'Attack range upgrades no longer stretch melee reach.' },
  { tag: 'SINS', text: 'Iron Will lasts 1 s now (it was 4 s), and it blocks 2 hits whole before it breaks, however hard they hit.' },
  { tag: 'Boss', text: 'AWAS is longer and faster, and speeds up as it closes in on an apple. In phase 2 it’s faster again, and now and then it hisses and cuts across your path.' },
  { tag: 'Boss', text: 'AWAS’s body blocks your shots: aim round it to hit the apple.' },
  { tag: 'Gold', text: 'MAKORA’s wheel pays more: 10 gold for the first spin, then double each spin (20, 40, 80…). The end-of-run screen shows how many spins you got.' },
  { tag: 'HUD', text: 'Thicker, easier to read HP and XP bars.' },
  { tag: 'Store', text: 'Every pack is coloured by the best rarity it can give (grey for Common, green for Uncommon, orange for Legendary, iridescent platinum for Triple S), and the store sorts them that way.' },
  { tag: 'Melee', text: 'BLACK FLASH! looks like the manga: an impact frame (white, black, white, frozen and zoomed in on the hit), a burst of red-edged black lightning that’s different every hit, and red and black streaks of light rising off you. For 2 s after: super fast, more damage, faster regen and a flurry of punches, each its own lightning.' },
  { tag: 'Effects', text: 'Dragon Kick’s effect is bigger: its arc swings out to the kick’s full reach, twice as thick and glowing, with a big gold flash, rings and a spray of sparks where it lands, and a brighter streak behind a kicked enemy.' },
  { tag: 'Effects', text: 'Tempest Slam’s effect is bigger, filling its real hit range: the ground flashes red, a shockwave rolls out to the edge and the cracks shoot out with it.' },
  { tag: 'Effects', text: 'Pressure Washer and Super Washer look like real water: rippling jets with light streaming down them, churning foam, flying drops, splashes where they hit, and glassy puddles that ripple.' },
  { tag: 'Effects', text: 'Cleaner, brighter weapon effects: shots glow with tapered trails and a white-hot heart, hits flash with a spiky star (bigger hits ring out), sparks streak and cool, and rings burst out and thin away.' },
  { tag: 'HUD', text: 'Your gold is shown top right during a run. The sequence counter and attack log are gone.' },
  { tag: 'Boss', text: 'AWAS’s phone screen is a softer, dimmer green.' },
  { tag: 'Boss', text: 'From 20 apples AWAS goes into a frenzy and moves faster. Both snakes glide smoothly now instead of jumping square to square.' },
  { tag: 'Boss', text: 'Grown huge, AWAS gets a new, bigger health bar, and you can only hurt it once it starts to move.' },
  { tag: 'Boss', text: 'Watch the apple tracker. If AWAS eats 25, the phone screen switches off and it grows into a huge snake that hunts you round the arena. It PLUNGEs at you with its jaws open, and SPITs cones of apples you have to dodge. You can hurt it now: kill it.' },
  { tag: 'Boss', text: 'XP orbs left on the floor fly to you before AWAS’s screen shrinks.' },
  { tag: 'Enemies', text: 'Enemies show their HP again, and get a little tougher as you level up and raise your damage.' },
  { tag: 'Swarm', text: 'The swarm follows how well you keep up. Clear it fast (like with the Gatling) and it grows, up to twice as big. Let it pile up and it shrinks, down to about half.' },
  { tag: 'Store', text: 'A cleaner store: just the packs and their prices. Hover a pack and it tilts toward your mouse.' },
  { tag: 'Store', text: 'The Starter pack is in the store now, for 20 gold.' },
  { tag: 'Packs', text: 'Opening a pack shows 5 big cards at a time. The rarer the card, the bigger its reveal: a glow, a shine, light rays and a foil shimmer.' },
  { tag: 'Gold', text: 'You start with 1000 gold, and every save gets topped up to at least 1000 once.' },
  { tag: 'SINS', text: 'Dragon Kick always takes half the enemy’s HP and sends it flying in a straight line, hitting everything in its way. Bosses take its normal damage.' },
  { ver: 'v0.53 · THE COMBAT UPDATE!' },
  { tag: 'Melee', text: 'Melee is here. You now have two decks, ranged and melee, and both play at the same time, card after card, with their own sequences, shuffles and combos.' },
  { tag: 'Melee', text: 'Your melee deck never waits: when a card’s turn comes and nothing is within reach, it’s used up and nothing happens. After a miss, the next card strikes the moment an enemy steps into reach.' },
  { tag: 'Melee', text: 'Knife Stab: stabs. ×3 STAB FLURRY!, fast stabs in random directions inside a cone. ×7 KNIFE THROW!, it flies through everything in its path.' },
  { tag: 'Melee', text: 'Punch: a heavy punch. ×3 FLURRY!, a flurry of punches. ×7 BLACK FLASH!, one huge punch that lands in black lightning, then 7 s in a blue aura with super fast movement, attack speed and damage.' },
  { tag: 'Deck', text: 'The starter pack has 10 Knife Stabs and 10 Punches now. If you already had a save, they’re in your collection and your melee deck.' },
  { tag: 'Deck', text: 'Loadout has a tab for each deck, each with an on/off switch: turn one off (it keeps its cards) to go melee only or ranged only. Each deck holds up to 31 cards.' },
  { tag: 'Gold', text: 'Everyone’s gold was reset to 350, and new players start with 350 (it was 100).' },
  { tag: 'Store', text: 'New: the SINS pack, 500 gold, all Triple S, 2 of each weapon. No combos, but each card is strong on its own.' },
  { tag: 'SINS', text: 'Sonic Kick (ranged): a sonic shot marks what it hits, then an astral flying kick slams into the mark.' },
  { tag: 'SINS', text: 'Iron Will (melee): a teal and gold shield that soaks up the next 40 damage. Tempest Slam (melee): slams the ground and leaves it cracked, slowing enemies. Dragon Kick (melee): one very heavy kick.' },
  { tag: 'Deck', text: 'Loadout can show one pack’s cards at a time: All, Starter, Artillery, Magus, Silica, Powerwash or Sins.' },
  { tag: 'HUD', text: 'In a run, both decks show along the bottom as slim colour-coded rows, melee on top, each with its own counter.' },
  { ver: 'v0.52' },
  { tag: 'Run', text: 'The run follows a clock now: 30 s of swarm, then a huge swarm, then a boss, three times over. A big bar across the top shows how far you are, with a marker for each boss.' },
  { tag: 'Run', text: 'When a boss is about to come, every XP orb, potion and diamond still on the floor flies to you first.' },
  { tag: 'Run', text: 'Bigger decks face bigger swarms: from 11 cards up, a few more enemies come, up to about 1.3× as many with a full 31-card deck (less in big-red waves).' },
  { tag: 'Fix', text: 'In the loadout, clicking a card no longer makes the card list jump when it’s scrolled down.' },
  { tag: 'Relic', text: 'You can see when your relics are ready: your circle glows, fading in and out, orange for BULL and blue for DEFLECT (taking turns when both are ready).' },
  { tag: 'Upgrade', text: 'New level-up stat, Weapon luck: more ×3 and ×7 combos, by lining up copies already in your deck. Each pick adds less than the last, and it tops out at about 33% for ×3 and 8% for ×7.' },
  { tag: 'Fix', text: 'Lasers, Pressure Washer sprays and Gatling barrel flashes stay on you when you move fast, instead of being left behind.' },
  { tag: 'Boss', text: 'Bosses match your damage: if your last 30 s before a boss would kill it too fast, it comes with more health (up to 2.5×), and says so.' },
  { tag: 'Boss', text: 'MAKORA’s kicked rocks are no longer targets: your weapons stay on MAKORA. Dodge the rocks, or DEFLECT them back at it.' },
  { tag: 'Run', text: 'Levelling up no longer calls the bosses. Level as much as you like; the harder swarms only come once you’ve levelled up.' },
  { tag: 'Enemies', text: 'Every 10 s a new wave, each a swarm type (with an extra enemy mixed in): reds, triangles, big reds and their mixes first; crabs, lungers and exploders after SKURTOSAURUS; shooters after OBI ONE.' },
  { tag: 'Enemies', text: 'New: the lunger, a slow amber square. It stops, lights up, then dashes straight at you.' },
  { tag: 'Boss', text: 'The bosses are bigger. In phase 2, OBI ONE also pulls you in after 2–3 saber throws in a row if you’re still out of his reach.' },
  { tag: 'Relic', text: 'DEFLECT’s shield lasts 2 s and stops one hit, then it’s gone. Ranged attacks it stops fly straight back: shooter orbs, OBI ONE’s saber, bolts and rocks, SKURTOSAURUS’s rocks and MAKORA’s kicked rocks.' },
  { tag: 'Deck', text: 'A deck can hold up to 14 copies of one card (7 before). More than 7 of a card needs at least 7 other cards in the deck with it.' },
  { tag: 'Run', text: 'When you fall, the end-of-run screen shows your time, level, kills, damage, bosses beaten and top weapons, then Retry or Back.' },
  { ver: 'v0.51.1' },
  { tag: 'View', text: 'Normal play is back at full size (the zoom-out left too much empty space). Boss fights zoom in a little closer, in a smaller square arena.' },
  { tag: 'Relic', text: 'DEFLECT sends a shooter’s orb back: it turns blue, flies faster at the nearest enemy and hurts it instead of you.' },
  { ver: 'v0.51' },
  { tag: 'View', text: 'The camera is zoomed out while you fight the swarm, so you see more of the arena.' },
  { tag: 'Boss', text: 'Boss fights zoom back in to a square arena with a glowing wall in the boss’s colour. It’s bigger than the screen, and the view follows you round it.' },
  { tag: 'Boss', text: 'OBI ONE’s thrown saber no longer chases you. Where it turns, a second lane shows it coming at you, then it flies straight down it.' },
  { tag: 'Boss', text: 'OBI ONE’s force: stay in his melee range for 2 s and he pushes you away; stay beyond his throw range for 2 s and he pulls you in.' },
  { tag: 'Enemies', text: 'After OBI ONE, red squares come half as often and a quarter of the swarm are green squares that shoot slow red orbs at you (they don’t home).' },
  { tag: 'Enemies', text: 'Purple triangles don’t split any more. They explode: close to you they stop and flash, then blow up, hurting you and any enemies nearby.' },
  { tag: 'Enemies', text: 'Only bosses show a health bar now.' },
  { ver: 'v0.50' },
  { tag: 'Boss', text: 'Boss fights zoom out: the arena grows to about twice the room, so you can get far away. It shrinks back once the boss is down.' },
  { tag: 'Boss', text: 'OBI ONE phase 2 has more HP (600, was 450), attacks faster and dashes further at you.' },
  { tag: 'Boss', text: 'Out of his reach he always throws his saber. Stay out of reach for 3–5 s and he pulls you in with the force.' },
  { tag: 'Boss', text: 'Stay close to him for 3–5 s and the force shoves you off while debris rains down all over the arena. Dodge through the gaps.' },
  { tag: 'Boss', text: 'OBI ONE has a phase 3 (750 HP): rocks fall and stay round the arena, glowing with the force, and he hurls them at you. You can walk through them.' },
  { tag: 'Boss', text: 'SKURTOSAURUS’s phase 2 has more HP (400, was 300).' },
  { tag: 'Cards', text: 'Pressure Washer does 1 damage now, but blasts enemies much further back.' },
  { tag: 'Music', text: 'OBI ONE has his own music now, through all three phases.' },
  { ver: 'v0.48' },
  { tag: 'Boss', text: 'OBI ONE arrives at level 20. "DO YOU FEEL THAT???" Dodge his spinning lightsaber, then he catches it and the fight is on.' },
  { tag: 'Boss', text: 'He slices up close, dashes in and slices from further off, and throws his saber when you’re far away. Every long-range attack shows its line first.' },
  { tag: 'Boss', text: 'When he blocks, your shots bounce off his saber and fly back at you: dodge them.' },
  { tag: 'Boss', text: 'Phase 2: he can throw again the moment he catches it. Dash away from a throw while you’re far off and he drags you in with the force: smash Space to break free.' },
  { tag: 'Relic', text: 'Beat him for DEFLECT: press P for a 5 s shield that stops the first hit. Raise it just before a hit for a perfect deflect and half the cooldown comes back.' },
  { tag: 'Boss', text: 'MAKORA moves to level 30, which is now the last level. Levels after 14 need a steady amount more XP, and enemy damage grows more slowly after 15.' },
  { tag: 'Boss', text: 'SKURTOSAURUS’s phase 2 has more HP than phase 1 now (300, was 200).' },
  { ver: 'v0.47' },
  { tag: 'Store', text: 'Packs always add to your collection now: you can own up to 999 of each card. Extra copies you already had are back.' },
  { tag: 'Deck', text: 'A deck can hold up to 7 of one card (it was 5), so a whole sequence of it can fire its ×7 ult.' },
  { tag: 'Bosses', text: 'SKURTOSAURUS and MAKORA can be hit anywhere on their body, head included, not only in the middle.' },
  { tag: 'Bosses', text: 'MAKORA grows a little bigger every time its wheel turns, and so does where you can hit it.' },
  { tag: 'Enemies', text: 'Crabs are half the size, with no eyes.' },
  { tag: 'Look', text: 'Enemies slowed by the Cryo Magus turn icy blue and move in slow motion, with frost glinting off them, instead of a circle.' },
  { tag: 'Co-op', text: 'Pick an emoji and you’re just the emoji, with no circle behind it.' },
  { ver: 'v0.46' },
  { tag: 'Co-op', text: 'Smoother online play: friends move smoothly even on a laggy connection, and the game catches up instead of falling behind.' },
  { tag: 'Co-op', text: 'Everyone’s HP bar shows under them and in the player list.' },
  { tag: 'Co-op', text: 'Reviving: hold E next to a friend who’s down. When the ring fills they’re back at full health, and you both get a shield.' },
  { tag: 'Co-op', text: 'The room shows everyone’s deck, with Edit loadout to change yours. Friends press Ready, and Start counts down from 3.' },
  { tag: 'Co-op', text: 'Pick your colour, or an emoji. After a run, the host can take everyone back to the room.' },
  { tag: 'Balance', text: 'Levels need a little more XP each time, and a lot more after level 10. Co-op needs a bit more per player.' },
  { tag: 'Enemies', text: 'The mini dinos are crabs now: same dash, new look.' },
  { tag: 'Fix', text: 'SKURTOSAURUS and MAKORA show up at the right size again, and flash when hit.' },
  { ver: 'v0.45' },
  { tag: 'Co-op', text: 'New: online CO-OP for up to 4 players, from the main menu. Type your name, then Host (you get a room key to send your friends) or Join with their key.' },
  { tag: 'Co-op', text: 'Everyone plays their own deck in a bigger arena, with many more enemies. Pings show next to every name.' },
  { tag: 'Co-op', text: 'Level ups give everyone their own 3 picks on a 10 second timer, and the fight keeps going.' },
  { tag: 'Co-op', text: 'Friend down? Stand next to them and bring them back at full health.' },
  { ver: 'v0.44' },
  { tag: 'Fix', text: "MAKORA and the rest of the animations now work in every browser, including Brave, Firefox and Safari with their privacy protections on." },
  { ver: 'v0.43' },
  { tag: 'Store', text: 'The Silica pack is Legendary now, and costs 100 gold.' },
  { tag: 'Gold', text: 'More gold: 1 for every 15 enemies (was 50), +10 for beating SKURTOSAURUS (was +1), and +15 every time MAKORA goes down.' },
  { ver: 'v0.42' },
  { tag: 'Store', text: 'New: the Silica pack in the store — new Rare weapons to add to your roster.' },
  { tag: 'Weapons', text: 'Say hello to the Gatling Gun and Cryo Magus. Unlock the pack and try them out.' },
  { tag: 'Balance', text: 'A few tuning passes across weapons and effects.' },
  { tag: 'Stats', text: 'Crits are easier to spot: the number pops in on an orange starburst with a CRIT tag.' },
  { ver: 'v0.41' },
  { tag: 'Stats', text: 'New stats: Crit rate (start at 10%) and Crit damage (start at +30%). Crits show as big gold numbers with a "!".' },
  { tag: 'Stats', text: 'Crit rate is rarer in level ups than the other stats.' },
  { ver: 'v0.40' },
  { tag: 'Weapons', text: "Mine has no range now: it drops on its own when its turn comes, even with no enemy near." },
  { tag: 'Weapons', text: 'Mines go off from further away: an enemy only has to come close, not touch the disc. The disc is bigger too.' },
  { ver: 'v0.39' },
  { tag: 'Boss', text: "MAKORA's punch shockwave fades out as it reaches the end of its cone, instead of hanging there." },
  { tag: 'Boss', text: 'From its 2nd wheel turn, MAKORA kicks 3 rocks in a row when you keep your distance.' },
  { tag: 'Boss', text: 'From its 2nd wheel turn, up close it makes huge slashes, nearly a half circle with twice the reach. Watch the red cone and get out, or dash through it.' },
  { ver: 'v0.38' },
  { tag: 'Boss', text: 'A new MAKORA, drawn after the reference: grey and muscular, horns curling round its gold wheel, feathery tufts, a torn dark cloth, black rings and a short blade.' },
  { tag: 'Boss', text: 'Its punch sends a shockwave rolling out across a cone. Get out of the red cone, or let the wave pass.' },
  { tag: 'Boss', text: 'Its slices come 1 or 3 at a time, at random.' },
  { tag: 'Boss', text: 'New kick: it stamps, a huge rock bursts up and it kicks it at you down a red lane. Shoot the rock apart and it explodes, hurting MAKORA if it is close.' },
  { tag: 'Boss', text: 'MAKORA gets faster every time it adapts: it walks faster and its warnings get shorter.' },
  { ver: 'v0.37' },
  { tag: 'Boss', text: 'MAKORA is a white winged silhouette now, with a little retro pixelation, like its wheel.' },
  { tag: 'Boss', text: 'MAKORA starts slow and tanky: 150 HP, and ×2 HP and damage each time its wheel turns.' },
  { tag: 'Boss', text: 'New punch: a red circle marks where its shockwave will land. Its slices keep their red cones.' },
  { tag: 'Boss', text: 'Dash a lot with BULL and MAKORA learns it: from its next return, it dashes at you too.' },
  { ver: 'v0.36' },
  { tag: 'Boss', text: 'A new MAKORA, in the same flat style as the dinosaur: pale lavender, spiky swept-back hair, the gold wheel floating over its head, a black cape and a long blade arm.' },
  { tag: 'Boss', text: 'Its wheel scene is flat gold to match.' },
  { ver: 'v0.33' },
  { tag: 'Fix', text: "Alt-tabbing during MAKORA's scenes no longer freezes them or sends you back to the menu. They wait and carry on when you come back." },
  { tag: 'Boss', text: "MAKORA's wheel really turns now: one heavy nudge to the next notch, then a clunk." },
  { tag: 'Balance', text: 'A little less XP: levels take about a quarter longer.' },
  { tag: 'Store', text: 'A big Test pack button next to Buy, a new look for the test screen, and the targets sit in the middle.' },
  { ver: 'v0.32' },
  { tag: 'Fix', text: 'The game no longer freezes when MAKORA goes down with shots still in the air (it happened most after the second wheel turn).' },
  { tag: 'Boss', text: "MAKORA's wheel is chunky gold pixel art now. It turns with a heavy clunk and a shake, and says what it adapted to." },
  { tag: 'Look', text: 'A stronger CRT filter: deeper scanlines, darker corners and more colour in the stripes.' },
  { ver: 'v0.31' },
  { tag: 'Loadout', text: 'A new deck builder: your deck on the left, your cards on the right. Click or drag a card across to add it; click a deck row, or drag it out, to take one off.' },
  { tag: 'Loadout', text: 'Auto builds a deck from your best cards in one click. Clear empties it.' },
  { ver: 'v0.30' },
  { tag: 'Title', text: 'GOON SWARM is now PACKS SILICA, with a new hot-pink chrome logo. The menus follow its colours.' },
  { tag: 'Look', text: 'Clearer fonts everywhere, and the CRT filter is less pixelated.' },
  { tag: 'Look', text: 'Bigger damage numbers.' },
  { tag: 'Weapons', text: 'New in Artillery: Sniper, a super long shot for 50 damage. ×3 fires 3 shots that pierce; ×7 is a RAILGUN that pierces everything and explodes where it ends.' },
  { tag: 'Weapons', text: 'New in Magus: Arcane Missiles, 2 homing missiles. ×2 fires 4 at once; ×7 fires 7 super-fast missiles that split in two when they hit.' },
  { tag: 'Packs', text: 'Laser moves to the Artillery pack, and Cannon to the starter pack.' },
  { tag: 'Boss', text: 'Easier to hit SKURTOSAURUS: your weapons fire as soon as its edge is in range, not its middle.' },
  { tag: 'Gold', text: 'New players start with 100 gold.' },
  { ver: 'v0.29' },
  { tag: 'Boss', text: 'Skip MAKORA\'s summoning with the Skip button, Space or Enter.' },
  { tag: 'Boss', text: '"I SUMMON" now shows right as the voice says it.' },
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
/* ---------- what's new: the changelog window (v0.56, user: a button in the bottom left opens it) ---------- */
$('news-btn-ver').textContent = NEWS.find(n => n.ver)?.ver || '';
$('news-btn').addEventListener('click', () => { $('news-dialog').showModal(); $('news-dialog').querySelector('.news-list').scrollTop = 0; });
$('news-close').addEventListener('click', () => $('news-dialog').close());
$('news-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });   // a click outside it
$('news-dialog').addEventListener('close', () => $('news-btn').focus());

/* ---------- card packs: the look, and ripping one open ---------- */
// Every pack (the starter and the store's) is drawn the same way: a foil pack with a crimped top strip that tears off.
const PACK_EMBLEM = {
  starter: '<path d="M12 3c2.5 2 3.5 5 3.5 8v8h-7v-8c0-3 1-6 3.5-8z"/><path d="M8.5 15h7"/>',
  bigger: '<path d="M3.5 13.5l13-6 2.2 4.4-13 6z"/><circle cx="8.5" cy="17.5" r="3"/><path d="M8.5 17.5h.01M19.5 8l1.5-.8M19.8 10.6l1.7.2"/>',
  silica: '<path d="M12 2.5l7.5 4.3v8.6L12 19.8l-7.5-4.4V6.8z"/><path d="M12 2.5v17.3M4.5 6.8l15 8.6M19.5 6.8l-15 8.6"/>',   // a crystal
  magus: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  sins: '<path d="M12 3c3 3 5 6 5 9.5A5 5 0 017 12.5C7 9 9 6 12 3z"/><path d="M12 10c1.2 1.3 2 2.5 2 3.6a2 2 0 01-4 0c0-1.1.8-2.3 2-3.6z"/>',   // a flame
  powerwash: '<path d="M4 13h8l4-4"/><path d="M12 13l4 4"/><circle cx="17" cy="6.5" r="1"/><circle cx="19.5" cy="9" r=".8"/><circle cx="20.5" cy="5" r=".7"/>',
  tballs: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 10.6c5.2 2.4 11.2 2.4 16.4 0M3.8 13.8c5.2 2.4 11.2 2.4 16.4 0"/><circle cx="16.5" cy="12.9" r="1.3"/><circle cx="9" cy="7.2" r=".9"/><circle cx="13" cy="6.6" r=".9"/>',   // a T-Ball
};
// The best rarity a pack can give (v0.55, user: a pack is coloured by it; style.css .pack-art.top-*).
function packTop(key) {
  const pk = PACKS[key], have = (pk?.rarities || ['common']).filter(r => cardsOfRarity(r, pk).length);
  return have.reduce((best, r) => (RARITIES.indexOf(r) > RARITIES.indexOf(best) ? r : best), 'common');
}
const PACK_LOGO = { bigger: 'Bigger<br>Weapons',   // (v0.59, user: the pack itself on two lines: BIGGER / WEAPONS; it said GUNS for a while)
  magus: '<span class="pack-logo-sm">Ulti</span><br>Magus' };   // (v0.60: a small gold ULTI over a big MAGUS, like a magic-show bill)
const PACK_COVER = new Set(['starter', 'bigger', 'magus', 'silica', 'tballs']);   // packs with their own cover art (style.css .has-cover)
function packArt(key, { big = false } = {}) {
  const name = PACK_LOGO[key] || PACKS[key].short, top = packTop(key), shade = '<span class="pack-shade"></span><span class="pack-holo"></span>';
  return `<span class="pack-art pack-${key} top-${top}${PACK_COVER.has(key) ? ' has-cover' : ''}${big ? ' is-big' : ''}" aria-hidden="true">`
    + `<span class="pack-top">${shade}</span>`
    + `<span class="pack-body">${shade}<svg class="pack-emblem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PACK_EMBLEM[key]}</svg>`
    + `<span class="pack-logo">${name}</span><span class="pack-word">Pack</span></span>`   // (v0.59, user: no "10 cards" on the packs any more; v0.60, user: every one ends in PACK, all lined up)
    + (PACKS[key].isNew ? '<span class="pack-new" aria-hidden="true"><b>New</b></span>' : '')   // (v0.72: the diagonal NEW ribbon, set in the store editor)
    + `</span>`;
}

// BACK on the pack's page (v0.60, user: "color the button too"): in the colour of the pack it's on.
// The cover packs in their art's own colour (their --pc is their best rarity's, gold on three of them); the rest in theirs.
const PACK_TINT = { bigger: 'var(--camo-khaki)', magus: 'var(--pack-magus)', silica: '#d0773a', tballs: 'var(--tball)' };
function packBackColour() {
  const art = document.querySelector('#pv .pack-art');
  if (art) $('btn-pv-back').style.setProperty('--pc', PACK_TINT[viewing] || getComputedStyle(art).getPropertyValue('--pc').trim());
}
// Shake, tear the top strip off, a flash of light from inside, then the pack drops away. Resolves when it's done
// (or after a moment anyway: animations pause in a hidden tab).
// v0.62 (user: "make opening animation packs and the reveal … fast, pressing space"): about half as long as it was
// (0.9 s → 0.5 s), and Space while it plays finishes it at once (ripFast).
// v0.65 (user: "a better more animation pack opening where it will rip in a 3d effect and a glow lines to where it was
// ripped"): it shakes harder and harder while a white-hot tear races across the seal, left to right (a jagged glowing
// line, a bright spark at its front spitting sparks); the strip peels off in 3D, curling up off its left end and
// spinning away, while rays of light pour up out of the torn top; the torn edge keeps glowing as the pack drops away.
// About 0.9 s; Space still finishes it at once (ripFast).
// v0.66 (user: "i dont like the lines thingy but i do like the ripping part tho it looks broken"): no glowing line,
// spark or rays any more, and a real tear instead of a straight cut: a ragged edge, new every time, shared by the strip
// and the pack, the white foil showing along both torn edges. The strip rips up from its left end (still held at its
// right) and flies off, little flakes of foil fall from the tear, light spills out, and the pack drops away.
const RIP = { shake: 200, tear: 300, drop: 180, teeth: 30, flakes: 10 };   // (v0.70, user: "a bit faster": 280 / 400 / 240 before)
let ripping = null;
function ripPack(art) {
  SFX.rip();
  if (!animOk || !art) return wait(60);
  art.classList.add('is-ripping');
  const added = [], add = (parent, cls, html = '') => {
    const el = document.createElement('span'); el.className = cls; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html;
    parent.appendChild(el); added.push(el); return el;
  };
  const T = RIP, tearAt = T.shake * 0.5, dropAt = tearAt + T.tear * 0.72;
  const top = art.querySelector('.pack-top'), body = art.querySelector('.pack-body');
  const shake = [];                                   // shaking harder and harder, swelling a little
  for (let k = 0; k <= 12; k++) { const g = k / 12; shake.push({ transform: `translate(${(k % 2 ? 1 : -1) * g * 4}px, ${-g * 3}px) rotate(${(k % 2 ? 1 : -1) * g * 2.2}deg) scale(${1 + g * 0.06})` }); }
  shake.push({ transform: 'translateY(-3px) scale(1.06)' });
  art.animate(shake, { duration: tearAt + T.tear * 0.3, easing: 'ease-in', fill: 'forwards' });
  // the torn edge: `teeth` points across, each a random depth (now and then a deeper rip), the same line on both pieces
  // (the strip's bottom is 78–100% of its height, the pack's top 0–4.5% of its: the same few px of the whole pack)
  const n = T.teeth, depth = Array.from({ length: n + 1 }, () => (Math.random() < 0.18 ? 0.7 + Math.random() * 0.3 : Math.random() * 0.55));
  const X = i => +(i / n * 100).toFixed(2), topY = d => +(78 + d * 22).toFixed(2), bodyY = d => +(d * 4.5).toFixed(2);
  const topEdge = depth.map((d, i) => [X(i), topY(d)]), bodyEdge = depth.map((d, i) => [X(i), bodyY(d)]);
  top.style.clipPath = `polygon(0 0, 100% 0, ${topEdge.slice().reverse().map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
  body.style.clipPath = `polygon(${bodyEdge.map(([x, y]) => `${x}% ${y}%`).join(', ')}, 100% 100%, 0 100%)`;
  const band = (edge, off) => edge.map(([x, y]) => `${x},${y}`).concat(edge.slice().reverse().map(([x, y]) => `${x},${+(y + off).toFixed(2)}`)).join(' ');
  const fibre = (parent, edge, off) => add(parent, 'rip-fibre', `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${band(edge, off)}"/></svg>`);
  const fibres = [fibre(top, topEdge, -10), fibre(body, bodyEdge, 1.7)];   // the white foil along each torn edge, once it tears
  for (const f of fibres) f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90, delay: tearAt, fill: 'both' });
  top.animate([                                       // the strip: rips up from its left end, still held at its right, then flies off
    { transform: 'none', opacity: 1 },
    { transform: 'perspective(500px) translateY(-2px) rotate(-8deg) rotateX(14deg)', opacity: 1, offset: 0.4 },
    { transform: 'perspective(500px) translate(14px, -22px) rotate(-15deg) rotateX(30deg)', opacity: 1, offset: 0.62 },
    { transform: 'perspective(500px) translate(90px, -150px) rotate(30deg) rotateX(60deg)', opacity: 0 },
  ], { duration: T.tear, delay: tearAt, easing: 'cubic-bezier(.45, 0, .75, .7)', fill: 'both' });
  top.style.transformOrigin = '100% 100%';
  for (let k = 0; k < T.flakes; k++) {                // flakes of foil falling from the tear, left to right as it goes
    const u = (k + Math.random() * 0.8) / T.flakes, fl = add(art, 'rip-flake'), dx = (Math.random() - 0.5) * 50, dy = 40 + Math.random() * 70, spin = (Math.random() - 0.5) * 720;
    fl.style.left = `${u * 100}%`; if (k % 3 === 0) fl.classList.add('is-white');
    fl.animate([{ transform: 'translate(0, 0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx * 0.4}px, -${8 + Math.random() * 14}px) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg)`, opacity: 0 }],
      { duration: 520 + Math.random() * 260, delay: tearAt + T.tear * 0.5 * u, easing: 'cubic-bezier(.3, .2, .6, 1)', fill: 'forwards' });   // (hidden until the tear gets there)
  }
  const drop = body.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px) scale(.92)', opacity: 0 }],
    { duration: T.drop, delay: dropAt, easing: 'ease-in', fill: 'forwards' });
  ripping = art;
  return Promise.race([done(drop), wait(dropAt + T.drop + 500)]).finally(() => { ripping = null; added.forEach(el => el.remove()); });
}
function ripFast() {
  if (!ripping) return;
  for (const a of ripping.getAnimations({ subtree: true })) { try { a.finish(); } catch (err) { /* gone */ } }
}

// Drop rate of each card in a pack: its rarity's chance, shared evenly by that rarity's cards.
function cardOdds(pack) {
  return Object.fromEntries(packOdds(pack).flatMap(o => {
    const pool = cardsOfRarity(o.rarity, pack);
    return pool.map(id => [id, o.chance / pool.length]);
  }));
}

/* ---------- the starter pack (every new player, and after a reset) ---------- */
// v0.56 (user): the same screen opens a pack you've just bought (`packOpen`: its cards, already saved, and its reveal);
// null is the starter pack. Skip all goes straight to every card at once.
const STARTER_TEXT = { eyebrow: $('k-eyebrow').textContent, title: $('k-title').textContent, sub: $('k-sub').textContent };
let packOpen = null;
// v0.62 (user: "GET 2 starter packs at the beginning"): both are rolled and saved at the first rip (save.js openStarter),
// then opened one after the other: this screen, its reveal, this screen again for the next. Skip all shows the rest.
let starterStep = 0;                                     // which starter pack is next (0: the first)
const starterCount = () => (save.starterDone ? Math.max(1, Math.ceil((save.starterIds || []).length / PACK_SIZE)) : STARTER_PACKS);
function renderStarter() {
  packOpen = null;
  $('scr-pack').classList.remove('is-zoom');
  const n = starterCount(), more = starterStep > 0;
  $('k-eyebrow').textContent = n > 1 ? `${STARTER_TEXT.eyebrow} · pack ${starterStep + 1} of ${n}` : STARTER_TEXT.eyebrow;
  $('k-title').textContent = more ? 'Your second Standard pack' : n > 1 ? 'Your Standard packs' : STARTER_TEXT.title;
  $('k-sub').textContent = more ? 'One more: another 10 cards, with the same better odds.' : STARTER_TEXT.sub;
  $('btn-pack-skipall').textContent = more ? 'Skip' : 'Skip all';
  $('btn-starter').innerHTML = packArt('starter', { big: true });
}
function starterReveal(all) {
  const ids = openStarter(), n = starterCount(), from = starterStep * PACK_SIZE;   // (saved before anything is shown)
  const last = all || starterStep >= n - 1;
  return { ids: all ? ids.slice(from) : ids.slice(from, from + PACK_SIZE),
    eyebrow: n > 1 && !(all && !starterStep) ? `${STARTER.name} · ${starterStep + 1} of ${n}` : STARTER.name,
    title: last ? 'Your first cards' : 'Your first pack',
    note: last ? 'These are your first decks: ranged and melee. Get more cards in Packs.' : 'One more pack to go.',
    after: last ? () => { starterStep = 0; save.starterSeen = true; writeSave(); goMain(); }
      : () => { starterStep++; renderStarter(); showScreen('scr-pack'); } };
}
let opening = false;
async function openStarterPack(all = false) {
  if (opening || current !== 'scr-pack') return;
  opening = true;
  const o = packOpen || starterReveal(all);
  if (!all) SFX.rise();                              // (v0.57, user: their rise sound the moment you click; sound.js)
  if (!all) await ripPack($('btn-starter').querySelector('.pack-art'));
  opening = false;
  if (current !== 'scr-pack') return;
  packOpen = null;
  startReveal(o.ids, { ...o, all });
}
$('btn-starter').addEventListener('click', () => openStarterPack());
$('btn-pack-skipall').addEventListener('click', () => openStarterPack(true));

// Buying (v0.56, user: "zoom the pack into the centre, a seamless transition to the pack opening"): the pack you
// bought flies from the pack screen to the middle, growing to the opening's size, and waits there to be ripped open.
// (The screen's own fade-in is off for this, `is-zoom`, so the pack never fades; the words round it fade in.)
function showBoughtPack(k, from) {
  const pk = PACKS[k], sc = $('scr-pack');
  $('k-eyebrow').textContent = 'Packs'; $('k-title').textContent = pk.name; $('k-sub').textContent = `${pk.size} cards. Yours.`;
  $('btn-starter').innerHTML = packArt(k, { big: true });
  sc.classList.add('is-zoom');
  showScreen('scr-pack');
  const art = $('btn-starter').querySelector('.pack-art');
  if (!animOk || !from || !art) return;
  const r1 = art.getBoundingClientRect(), dx = from.left + from.width / 2 - (r1.left + r1.width / 2), dy = from.top + from.height / 2 - (r1.top + r1.height / 2);
  art.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${from.width / r1.width})` },
    { transform: 'translate(0, -14px) scale(1.08) rotate(-2deg)', offset: 0.72 },
    { transform: 'none' },
  ], { duration: 420, easing: 'cubic-bezier(.3, .85, .3, 1)' });   // (v0.62: quicker, 620 ms before)
  [...sc.children].filter(el => el !== $('btn-starter')).forEach((el, i) =>
    el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 180 + i * 35, easing: 'ease-out', fill: 'backwards' }));
}

/* ---------- store ---------- */
// A pack's price (v0.72): the discounted one, with the old price struck through and "−20%" beside it when it's on sale.
function priceHtml(pk) {
  const sale = pk.discount ? `<s class="pack-was">${pk.base}</s><b class="pack-off">−${pk.discount}%</b>` : '';
  return `<span class="pack-price${pk.discount ? ' is-sale' : ''}"><span class="coin" aria-hidden="true"></span>${pk.price}${sale}</span>`;
}
function renderStore() {
  renderGold();
  // v0.55 (user: minimal text, the pack first): only the pack and its price (the pack shows its name and size).
  // v0.60 (user): in the order storeconfig.js gives (the store editor sets it); before, sorted by best rarity.
  const packs = STORE_PACKS;
  $('store-packs').innerHTML = packs.map((k, i) => {
    const pk = PACKS[k], short = save.gold < pk.price;
    return `<button class="store-pack pack-${k}${short ? ' is-short' : ''}" type="button" data-pack="${k}" style="--i: ${i}" aria-label="${pk.name}, ${pk.price} gold${pk.discount ? ` (${pk.discount}% off)` : ''}: see what's inside">`
      + `<span class="pack-tilt">${packArt(k)}</span>`
      + priceHtml(pk)
      + `</button>`;
  }).join('');
}
$('store-packs').addEventListener('click', e => { const b = e.target.closest('.store-pack'); if (b) openPackView(b.dataset.pack); });

/* A pack under the pointer turns in 3D toward it, like Balatro's cards (style.css: --rx, --ry tilt it, --sx shifts its shadow, --mx, --my
   place the shine). `host` is what gets .is-tilt; `art` is the pack itself. */
const TILT = { max: 16 };
// (v0.59, user: "the packs and the cards fake 3D again": `artSel` is what turns, a pack or a card face)
function packTilt(root, find, artSel = '.pack-art') {
  if (!animOk) return;
  let on = null;
  const off = () => {
    if (!on) return;
    on.host.classList.remove('is-tilt');
    for (const v of ['--rx', '--ry', '--sx', '--mx', '--my', '--fx', '--fy', '--px', '--py', '--posx', '--posy', '--pos', '--hyp']) on.art.style.removeProperty(v);
    on = null;
  };
  root.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const host = find(e.target), art = host?.matches(artSel) ? host : (host?.querySelector(artSel) || host?.closest(artSel));
    if (!art) { off(); return; }
    if (on?.art !== art) { off(); on = { host, art }; host.classList.add('is-tilt'); }
    const r = art.getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    art.style.setProperty('--ry', `${((x - 0.5) * 2 * TILT.max).toFixed(2)}deg`);
    art.style.setProperty('--rx', `${((0.5 - y) * 2 * TILT.max).toFixed(2)}deg`);
    art.style.setProperty('--sx', `${((0.5 - x) * 2 * TILT.max * 0.8).toFixed(1)}px`);   // its shadow, falling away from the tilt
    art.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    art.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    art.style.setProperty('--fx', x.toFixed(3));   // (a cover pack's film, style.css .has-cover)
    art.style.setProperty('--fy', y.toFixed(3));
    art.style.setProperty('--px', ((x - 0.5) * 2).toFixed(3));   // (v0.60: the pack's name floating over its art, −1 to 1: style.css)
    art.style.setProperty('--py', ((y - 0.5) * 2).toFixed(3));
    // (the Effects lab's card effects, style.css .cf-fx and the packs' rainbow foil: poke-holo's pointer numbers)
    const posx = `${(37 + x * 26).toFixed(1)}%`, posy = `${(33 + y * 34).toFixed(1)}%`;
    art.style.setProperty('--posx', posx); art.style.setProperty('--posy', posy); art.style.setProperty('--pos', `${posx} ${posy}`);
    art.style.setProperty('--hyp', Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2).toFixed(3));
  });
  root.addEventListener('pointerleave', off);
  root.addEventListener('click', off);                 // (it may be leaving the screen: don't stay turned)
}
packTilt($('store-packs'), t => t.closest('.store-pack'), '.pack-tilt');

// Pack preview (compact, one screen): the pack, its price and Buy; one tab per weapon with its drop rate; and the
// chosen weapon's details: stats, passive (its smaller combo), ult (×7) and Test it.
let viewing = null, buying = false, viewCard = null;
function openPackView(k) { viewing = k; viewCard = ownCards(k)[0] || PACKS[k].cards[0]; renderPackView(); showScreen('scr-packview'); }
// v0.60 (user): the weapons a pack has from other packs are one "Random <rarity> weapon" row per rarity (`rand-<rarity>`).
const RAND = 'rand-';
const isRand = id => typeof id === 'string' && id.startsWith(RAND);
const randRarity = id => id.slice(RAND.length);
const RAND_GLYPH = '<svg class="pv-row-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 2.5h16a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 20V4A1.5 1.5 0 0 1 4 2.5zM12 6c-2.3 0-4 1.5-4 3.6h2.4c0-.8.7-1.4 1.6-1.4s1.6.6 1.6 1.3c0 .7-.4 1-1.3 1.6-1.1.7-1.6 1.4-1.6 2.7v.6h2.3v-.4c0-.7.3-1 1.2-1.6 1.1-.7 1.8-1.5 1.8-2.9C16 7.4 14.3 6 12 6zm-1.3 10v2.4h2.5V16z"/></svg>';
// The card for a Random row: face down, a big ? on it, in its rarity's frame.
function randFace(r) {
  // (v0.64: the user's holo "?" picture, assets/img/cards/random.webp)
  return `<div class="cf cf-${r} is-rand has-pic" style="--c: var(--r-${r}); --rc: var(--r-${r})"><div class="cf-frame"><div class="cf-body">${cardPic('random')}${CF_HOLO}`
    + `<div class="cf-top"><span class="cf-name">Random weapon</span></div><div class="cf-art"></div>`
    + `<div class="cf-low"><span class="cf-num"><b>?</b><i>${RARITY_NAME[r]}</i></span><div class="cf-text"><p class="cf-desc">${SHARED.includes(r) ? `Any ${RARITY_NAME[r]} weapon, from every pack.` : `A ${RARITY_NAME[r]} weapon from another pack.`}</p></div></div>`
    + `</div></div><span class="cf-rar">${RARITY_NAME[r]}</span><span class="cf-kind is-x" title="Ranged or melee">?</span><span class="cf-sheen" aria-hidden="true"></span></div>`;
}
// v0.61 (user): the Random Common and Random Uncommon rows are every pack's shared ones. (v0.69, user: neither the row
// nor its details take you into the Archives any more; the row just shows its cards, like any other row.)
function randDetail(r, k = viewing) {
  const n = cardsOfRarity(r, PACKS[k]).filter(id => !ownCards(k).includes(id)).length, shared = sharedIn(PACKS[k]) && SHARED.includes(r);
  return `<div class="pv-detail-head"><p class="type-name" style="color: var(--r-${r})">Random ${RARITY_NAME[r]} weapon</p><p class="type-stats">${shared ? `Any of ${n}, from every pack` : 'From another pack'}</p></div>`
    + `<p class="type-desc">${shared ? `Every pack can give you any of the game's ${n} ${RARITY_NAME[r]} weapons.` : `This pack can also give you a ${RARITY_NAME[r]} weapon from one of the other packs.`} Which one is a surprise: you'll see it when you open the pack.</p>`;   // (v0.69, user: no button into the Archives here)
}
// v0.61 (user: "if it's random just put a random crossfade, any card there"): a Random row's card is every weapon it
// could be, stacked, one at a time fading into another picked at random (style.css .rand-deck). `RAND_FADE` ms each.
const RAND_FADE = 1500;
let randTimer = 0;
function randDeck(r, k = viewing) {
  const pool = cardsOfRarity(r, PACKS[k]).filter(id => !ownCards(k).includes(id));
  if (!pool.length) return randFace(r);
  const first = Math.floor(Math.random() * pool.length);
  queueMicrotask(randDeckRun);
  // (v0.69, user: the tag sat over the card's bottom and tilted with it: now it's a label above the stack, out of the way)
  return `<span class="rand-tag" style="--rc: var(--r-${r})">${RAND_GLYPH.replace('pv-row-glyph', 'rand-tag-glyph')}Random ${RARITY_NAME[r]}</span>`
    + `<div class="rand-deck" style="--rc: var(--r-${r})">${pool.map((id, i) => `<div class="rand-slot${i === first ? ' is-on' : ''}">${cardFace(id)}</div>`).join('')}</div>`;
}
function randDeckRun() {
  clearInterval(randTimer);
  const deck = document.querySelector('#pv .rand-deck');
  if (!deck || reducedMotion) return;
  randTimer = setInterval(() => {
    if (!deck.isConnected) { clearInterval(randTimer); return; }
    const slots = [...deck.querySelectorAll('.rand-slot')], on = slots.findIndex(s => s.classList.contains('is-on'));
    if (slots.length < 2) return;
    let n = Math.floor(Math.random() * (slots.length - 1)); if (n >= on) n++;   // (a different one each time)
    slots[on]?.classList.remove('is-on'); slots[n].classList.add('is-on');
  }, RAND_FADE);
}
// v0.59 (user: "make the pack BIGGER, and a list view of the weapons, colour coded, sorted by rarity"): the pack big on
// the left with Buy under it; on the right a list grouped by rarity, rarest first, each group headed in its rarity's
// colour with its share of the pack, each weapon a row: its art, name, R / M, rarity, and its drop rate with a bar. The
// chosen weapon's card and details in a third column on the right; all three the same height.
const pctText = x => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
function renderPackView() {
  queueMicrotask(packBackColour);
  const k = viewing, pk = PACKS[k], odds = pk.fixed ? {} : cardOdds(pk), afford = save.gold >= pk.price;
  const rarOf = id => (isRand(id) ? randRarity(id) : CARDS[id].rarity);
  // v0.61 (user: "do not include unique commons and uncommons, just show rare and above, but show common as random
  // common and random uncommon"): the pack's own weapons, and one Random row per shared rarity (its odds: all of them together)
  const own = ownCards(k), pool = r => cardsOfRarity(r, pk).filter(id => !own.includes(id));
  for (const r of randRarities(k)) odds[RAND + r] = pool(r).reduce((t, id) => t + (odds[id] || 0), 0);
  const ids = [...own, ...randRarities(k).map(r => RAND + r)]
    .sort((a, b) => RARITY_RANK[rarOf(b)] - RARITY_RANK[rarOf(a)]);   // rarest first (a stable sort: pack order within, the Random row last)
  if (!ids.includes(viewCard)) viewCard = ids.find(id => !isRand(id)) || ids[0];
  const top = Math.max(...ids.map(id => odds[id] || 0), 1e-9);
  const randRow = id => { const r = randRarity(id);
    return `<button type="button" role="tab" class="pv-tab pv-row is-rand" data-card="${id}" aria-selected="${id === viewCard}" style="--c: var(--r-${r}); --rc: var(--r-${r})">`
      + `<span class="pv-row-art has-pic">${cardPic('random', 'pv-row-pic')}</span><span class="pv-tab-name">Random ${RARITY_NAME[r]} weapon</span><span class="pv-row-kind is-x" title="Ranged or melee">?</span>`
      + `<span class="pv-tab-rar">${RARITY_NAME[r]}</span><span class="pv-row-bar" aria-hidden="true"><i style="width: ${Math.max(3, odds[id] / top * 100).toFixed(1)}%"></i></span><b>${pctText(odds[id])}</b></button>`; };
  const row = id => { if (isRand(id)) return randRow(id); const c = CARDS[id], m = c.melee;
    return `<button type="button" role="tab" class="pv-tab pv-row" data-card="${id}" aria-selected="${id === viewCard}" style="--c: var(--${id}); --rc: var(--r-${c.rarity})">`
      + (CARD_PICS.has(id) ? `<span class="pv-row-art has-pic">${cardPic(id, 'pv-row-pic')}</span>` : `<span class="pv-row-art">${cardGlyph(id, 'pv-row-glyph')}</span>`)   // (v0.64: its picture, if it has one)
      + `<span class="pv-tab-name">${c.name}</span>`
      + `<span class="pv-row-kind is-${c.badge ? 'x' : m ? 'm' : 'r'}" title="${m ? 'Melee' : 'Ranged'}">${c.badge || (m ? 'M' : 'R')}</span>`
      + `<span class="pv-tab-rar">${RARITY_NAME[c.rarity]}</span>`
      + (pk.fixed ? `<b>×${pk.fixed[id]}</b>` : `<span class="pv-row-bar" aria-hidden="true"><i style="width: ${Math.max(3, odds[id] / top * 100).toFixed(1)}%"></i></span><b>${pctText(odds[id])}</b>`)
      + `</button>`; };
  const groups = [...new Set(ids.map(rarOf))].map(r => {
    const mine = ids.filter(id => rarOf(id) === r), share = mine.reduce((t, id) => t + (odds[id] || 0), 0);
    const n = mine.reduce((t, id) => t + (isRand(id) ? pool(r).length : 1), 0);
    return `<div class="pv-group" role="presentation" style="--rc: var(--r-${r})"><span>${RARITY_NAME[r]}</span><i>${n} weapon${n === 1 ? '' : 's'}</i>${pk.fixed ? '' : `<b>${pctText(share)}</b>`}</div>`
      + mine.map(row).join('');
  }).join('');
  // v0.59 (user): no "Store" over it; your gold big at the top right; the list (and the details) fit the height of the
  // pack and its buttons, scrolling inside if they must; the details without a frame
  $('pv').innerHTML = `<div class="pv-head"><div class="pv-side"><span class="pack-tilt">${packArt(k)}</span>`
    + `<div class="pv-buy"><button class="start" type="button" id="btn-buy"${afford ? '' : ' disabled'}>Buy <span class="coin" aria-hidden="true"></span>${pk.price}${pk.discount ? `<s class="pack-was">${pk.base}</s>` : ''}</button>`
    + `<button type="button" class="pv-testpack" id="btn-testpack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${CARD_ICON.sniper}</svg>Test pack</button>`
    + (afford ? '' : `<span class="sub small">${pk.price - save.gold} more gold to go</span>`) + `</div></div>`
    // (v0.59, user's mockup: the title with your gold beside it, nothing under it; the list straight after)
    + `<div class="pv-titles" title="${pk.fixed ? 'Nothing rolled: you always get these.' : `${pk.size} cards, each rolled on its own (repeats can happen). The rates are per card.`}"><h2 id="pv-title">${pk.name}</h2>`
    + `<p class="pv-gold${afford ? '' : ' is-short'}" aria-label="Your gold: ${save.gold}"><span class="coin" aria-hidden="true"></span><b>${save.gold}</b><small>gold</small></p></div>`
    + `<div class="pv-tabs pv-list" role="tablist" aria-label="Weapons in this pack">${groups}</div>`
    // (v0.59, user: the chosen weapon on the right)
    + `<div class="pv-detail" role="tabpanel"><div class="pv-face">${isRand(viewCard) ? randDeck(randRarity(viewCard)) : cardFace(viewCard)}</div>`
    + `<div class="pv-detail-text">${isRand(viewCard) ? randDetail(randRarity(viewCard)) : weaponDetail(viewCard)}</div></div></div>`;
}
// v0.66 (user: "hovering on the contents will change the card preview"): pointing at a row shows its card and details
// on the right straight away (only that panel changes, so the list stays put under the pointer). Clicking still picks it.
function showViewCard(id) {
  if (id === viewCard || !$('pv').querySelector('.pv-detail')) return;
  viewCard = id;
  for (const b of $('pv').querySelectorAll('.pv-tab')) b.setAttribute('aria-selected', String(b.dataset.card === id));
  $('pv').querySelector('.pv-detail').innerHTML = `<div class="pv-face">${isRand(id) ? randDeck(randRarity(id)) : cardFace(id)}</div>`
    + `<div class="pv-detail-text">${isRand(id) ? randDetail(randRarity(id)) : weaponDetail(id)}</div>`;
  if (!reducedMotion) $('pv').querySelector('.pv-face').animate([{ opacity: 0.4, transform: 'translateY(6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' });
}
$('pv').addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || buying) return;
  const b = e.target.closest('.pv-tab');
  if (b) showViewCard(b.dataset.card);
});
function weaponDetail(id) {
  const k = CARDS[id], t = COMBOS[id] || {}, passive = Object.keys(t).map(Number).sort((a, b) => a - b).find(n => n !== 7);
  return `<div class="pv-detail-head"><p class="type-name" style="color: var(--${id})">${k.name}</p>`
    + `<p class="type-stats">${k.melee ? 'Melee' : 'Ranged'} · ${k.dmgNote || `${k.dmg} dmg`} · ${k.range ? `${k.melee ? 'reach' : 'range'} ${k.range}` : k.self ? 'on you' : 'drops on its own'}</p></div>`
    + `<p class="type-desc">${k.desc}</p>`
    + (passive ? `<p class="type-combo"><b>Passive ×${passive}</b> <i>${t[passive].name}</i> ${t[passive].does}</p>` : '')
    + (t[7] ? `<p class="type-combo"><b>Ult ×7</b> <i>${t[7].name}</i> ${t[7].does}</p>` : '')
    + (id === 'mine' ? `<p class="type-combo"><b>Chain</b> A blast sets off any mine inside it.</p>` : '')
    + (k.tball ? `<p class="type-combo"><b>Event</b> Needs no other cards. Up to 2 balls of each kind orbit you, one per copy. Its combos only work with other cards in your deck.</p>` : '')
    + (!COMBOS[id] ? `<p class="type-combo"><b>No combos</b> ${k.rarity === 'sss' ? 'Triple S: strong' : 'Strong'} enough on its own.</p>` : '')
    + `<button type="button" class="pv-test" data-card="${id}" style="--c: var(--${id})">Test ${k.name}</button>`;   // (v0.60, user: under the description)
}
packTilt($('pv'), t => t.closest('.pv-head .pack-art'), '.pack-tilt');
packTilt($('pv'), t => t.closest('.pv-face'), '.rand-deck, .cf');       // the chosen weapon's card (v0.59), or a Random row's stack (v0.61)
packTilt($('coll'), t => t.closest('.ccard'), '.cf');                    // … and the collection's
$('pv').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.id === 'btn-buy') buyViewed();
  else if (b.id === 'btn-testpack') startPractice(viewing, isRand(viewCard) ? null : viewCard);   // v0.33 (user): a clear way into the pack's test
  else if (b.classList.contains('pv-tab')) { showViewCard(b.dataset.card); b.focus(); }   // (v0.66, user: picking one mustn't restart the other cards' animations)
  else if (b.classList.contains('pv-test')) startPractice(viewing, b.dataset.card);
});

// `k`: the pack (the one on show); `fromEl`: where its pack flies in from (Buy again: its button, v0.70); `auto`: rip it
// open by itself once it's landed (v0.70, user: Buy again opens the pack straight away)
const AUTO_RIP = 460;                             // ms: the pack's flight in (showBoughtPack, 420) and a breath
function buyViewed(k = viewing, fromEl = null, auto = false) {
  if (buying) return;
  const res = buyPack(k);                         // paid, rolled and saved before anything is shown
  if (!res) return;
  buying = true;
  SFX.coin();
  renderGold();
  const extra = res.where.filter(w => w.to === 'max').length;
  packOpen = { ids: res.ids, eyebrow: PACKS[k].name, title: 'New cards', top: packTop(k),
    note: `They're in your collection: add them to your deck in Loadout.${extra ? ` ${extra} didn't fit: you already have ${OWN_LIMIT} of ${extra === 1 ? 'that card' : 'those cards'}.` : ''}`,
    again: k, after: () => { viewing = k; renderPackView(); showScreen('scr-packview'); } };
  showBoughtPack(k, (fromEl || $('pv').querySelector('.pv-head .pack-art'))?.getBoundingClientRect());
  buying = false;
  if (auto) setTimeout(() => { if (current === 'scr-pack' && packOpen && !opening) openStarterPack(); }, animOk ? AUTO_RIP : 0);
}

/* ---------- test mode: a pack's weapons in a small test arena ---------- */
// v0.57 (user: "test packs to simulate an actual battle, but in a small testing arena; 1 to 3 to switch the passives
// and ults"): Test pack (and the effects lab, fxlab.js) is a little fight now. A box in the middle of the screen, a
// few real enemies coming at you (`PR_BATTLE`: they can't hurt you and drop nothing), more walking in as they fall,
// and your weapon firing on its own like in a run: 1 Single, 2 Passive, 3 Ult choose what it fires; Space fires it
// at once. Test loadout too (user: "even on test loadouts"): each weapon's tab the same, and Whole deck lets your deck
// fire on its own as in a run against the same arena, counting damage per second.
const PR_BATTLE = {
  box: { w: 760, h: 560, pad: 28 },        // the arena (px, at most; it fits between the controls and the panel)
  count: 7, spawn: 0.4,                   // enemies on the field, and the gap between new ones (s)
  away: 150,                              // a new one comes in at least this far from you
  hp: 4, hpMin: 12,                       // their health: this many of the weapon's hits (at least hpMin)
  every: { 1: null, 3: 1.4, 7: 3 },       // s between automatic attacks (Single: the normal attack interval)
  units: ['red'],                         // (user: only square enemies)
};
// Test pack's weapons (v0.60, user): only the pack's own (not the ones from other packs), rarest first like its page.
const testCards = k => ownCards(k).sort((a, b) => RARITY_RANK[CARDS[b].rarity] - RARITY_RANK[CARDS[a].rarity]);
function startPractice(k, card, extra) {
  if (k && !extra?.loadout && !extra?.lab && !testCards(k).includes(card)) card = testCards(k)[0];
  resetRun();
  game.practice = { pack: k, card, dummies: [], dmg: 0, battle: true, fireT: 0.4, spawnT: 0, ...extra };   // (v0.57: Test loadout too, user)
  game.started = true;
  game.inMenu = false;
  menuEl.hidden = true;
  document.body.classList.add('in-practice');
  renderPractice();
  $('practice').hidden = false;
  resetZoom();                                      // the test mode is at full size (arena.js)
  placeDummies();                                    // after the panel is up, so they sit in the open space under it
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
  return loadout ? CARD_IDS.filter(id => (save.equipped[id] > 0 && deckOn(kindOf(id))) || runWild().includes(id)) : testCards(game.practice.pack);   // (the Wild deck's too)
}
const prAuto = () => game.practice?.card === DECK_TAB;
// The three targets sit in the middle of the open space under the panel (v0.33, user: centre them), and you stand to
// their left, inside the weapon's range. The loadout test's Whole deck puts them inside every card's range, so no card
// in the deck ever waits.
function placeDummies() {
  const pr = game.practice, p = game.player;
  if (pr.archive) return;                            // (the Weapon Archive places its own: archive.js)
  if (pr.battle) { setupBattle(); return; }
  const reach = pr.card === DECK_TAB ? Math.min(...prCards().map(rangeOf)) : rangeOf(pr.card);
  const top = Math.min(H * 0.5, ($('practice').getBoundingClientRect().bottom || 0) + 20), cy = (top + H) / 2, cx = W / 2 + 30;
  const close = pr.card === DECK_TAB ? prCards().some(isMelee) : isMelee(pr.card);   // (melee has to be close: v0.53)
  const d = Math.max(close ? 28 : 90, Math.min(reach * 0.75, cx - 30 - 60));   // how far left of the main target you stand
  p.x = cx - 30 - d; p.y = cy; p.kx = p.ky = 0;
  const mk = (x, y, r) => ({ dummy: true, type: 'dummy', shape: 'dummy', x, y, r, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, speed: 0, dmg: 0, hit: 0, born: 1 });
  pr.dummies = [mk(cx - 30, cy, 18), mk(cx + 30, cy - 70, 13), mk(cx + 30, cy + 70, 13)];
  for (const e of pr.dummies) clampTo(e, e.r);
  game.enemies = pr.dummies.slice();
  game.mines = []; game.projectiles = []; game.timers = []; game.sweeps = [];
  game.sprays = []; game.trails = []; game.soakT = 0;
  resetSilica();
}
// The test arena: the box, you in the middle, an empty field (practiceBattleStep brings the enemies in).
function setupBattle() {
  const pr = game.practice, p = game.player, B = PR_BATTLE.box;
  const decks = prAuto() ? $('decks').getBoundingClientRect().top : 0;   // (Whole deck shows your deck along the bottom: above it)
  const panel = $('practice').getBoundingClientRect(), keys = $('pr-controls').getBoundingClientRect();
  const side = panel.width && panel.left > W / 2;           // (v0.57: the panel on the right; narrow screens keep it on top)
  const left = side ? (keys.width ? keys.right : 0) + B.pad : B.pad, right = side ? panel.left - B.pad : W - B.pad;
  const top = side ? 24 : (panel.bottom || 0) + 16, bottom = decks > 0 ? Math.min(H - 24, decks - 40) : H - 24;
  const w = Math.max(240, Math.min(B.w, right - left)), h = Math.max(160, Math.min(B.h, bottom - top));
  pr.box = { x: left + (right - left - w) / 2, y: top + Math.max(0, (bottom - top - h) / 2), w, h };
  p.x = pr.box.x + w / 2; p.y = pr.box.y + h / 2; p.kx = p.ky = 0;
  pr.dummies = [];
  game.enemies = []; game.eshots = [];
  game.mines = []; game.projectiles = []; game.timers = []; game.sweeps = [];
  game.sprays = []; game.trails = []; game.soakT = 0;
  pr.fireT = 0.5; pr.spawnT = 0;
  resetSilica();
}
// One frame of it (combat.js attackStep): keep everyone in the box, top the field up, and fire the chosen attack.
function practiceBattleStep(dt) {
  const pr = game.practice, b = pr.box, P = PR_BATTLE, p = game.player;
  if (!b) return;
  const keep = (o, r) => { o.x = Math.max(b.x + r, Math.min(b.x + b.w - r, o.x)); o.y = Math.max(b.y + r, Math.min(b.y + b.h - r, o.y)); };
  keep(p, PLAYER.r);
  for (const e of game.enemies) keep(e, e.r);
  const live = game.enemies.filter(e => !e.dead).length;
  if (live < (pr.demo ? MENU_DEMO.count : P.count) && (pr.spawnT -= dt) <= 0) { pr.spawnT = pr.demo ? MENU_DEMO.spawn : P.spawn; spawnPractice(); }
  if (pr.dmgDirty) { pr.dmgDirty = false; if (!pr.demo) renderPrDmg(); }
  if (pr.demo) menuDemoStep(dt);
  if (prAuto() || (pr.fireT -= dt) > 0) return;               // (Whole deck: your deck fires itself, combat.js attackStep)
  if (pr.demo) pr.sel = demoAttack(pr.card);
  const a = practiceAttacks(pr.card)[pr.sel || 0];
  if (!a) return;
  if (!(CARDS[pr.card].auto || inRange(pr.card) || (isMelee(pr.card) && nearestEnemy(p, null, rangeOf(pr.card) + 40)))) { pr.fireT = 0.05; return; }
  testFire(a.n);
  pr.fireT = P.every[a.n] ?? attackInterval();
}
// The main menu's demo (v0.57, user: "a simulation here vs squares, showing the packs the player has, if none a
// default Bullet; the attacks alternate randomly from normal, ×3, ×7"): the test arena again, in the box on the right
// of the main menu, with nobody at the keys. It plays your loadout one weapon at a time, `every` s each, and each
// attack is picked at random (`odds`: Single, Passive, Ult); you drift round the middle. Silent (main.js mutes the
// sound while it runs), nothing is saved, and it stops the moment you leave the main menu.
const MENU_DEMO = { every: [2.5, 3.5], odds: [0.5, 0.3, 0.2], min: { w: 320, h: 240 },
  pace: 1.5, count: 10, spawn: 0.22,      // (user: "faster"): the fight runs 1.5× quick, with more squares coming in faster
  hp: 1.6, hpMin: 6,                      // (user: "lower the health"): a square takes about 1–2 of the weapon's hits (the test arena: 4)
  // (user: "perfect, the player never getting hit", then "smarter"): you keep the nearest square at your weapon's best
  // distance (`band`, of its range: closer in to reach it, back off when it's too close), steer clear of the rest and of
  // the walls, and drift home to the middle; nothing ever touches you (`gap`: a square this close is held off)
  speed: 240, turn: 7, band: { ranged: [0.45, 0.75], melee: [0.45, 0.8] }, crowd: { ranged: 95, melee: 46 }, wall: 140, home: 0.35, gap: 10 };
// One frame of it (main.js), in two half steps at its pace.
function menuDemoFrame(dt) {
  const step = dt * MENU_DEMO.pace / 2;
  for (let k = 0; k < 2 && game.practice?.demo; k++) update(step);
}
function menuDemoCards() {
  const ids = CARD_IDS.filter(id => ((save.equipped[id] > 0 && deckOn(kindOf(id))) || runWild().includes(id)) && CARDS[id].dmg > 0);
  return ids.length ? ids : ['bullet'];
}
function startMenuDemo() {
  if (game.practice || NET.on || !save.starterDone) return;
  const r = $('menu-sim').getBoundingClientRect();
  if (r.width < MENU_DEMO.min.w || r.height < MENU_DEMO.min.h) return;   // (narrow screens: no room, the menu is centred)
  resetRun();
  const cards = menuDemoCards();
  const k = Math.floor(Math.random() * cards.length);
  game.practice = { demo: true, battle: true, pack: null, cards, card: cards[k], dummies: [], dmg: 0, fireT: 0.4, spawnT: 0, sel: 0, swapT: demoSwapT(), t: 0 };
  game.started = true;
  resetZoom();                                       // (full size, like the test arena: the box is in screen pixels)
  placeMenuDemo();
}
// The box sits where the menu's empty panel is (and above the leaderboard, which shares that side).
function placeMenuDemo() {
  const pr = game.practice;
  if (!pr?.demo) return;
  const r = $('menu-sim').getBoundingClientRect(), board = $('board').getBoundingClientRect();
  if (r.width < MENU_DEMO.min.w || r.height < MENU_DEMO.min.h) { stopMenuDemo(); return; }   // (the window got too narrow)
  const under = board.height && board.left < r.right && board.top > r.top;
  const bottom = Math.min(r.bottom, innerHeight - 40, under ? board.top - 24 : Infinity);
  pr.box = { x: r.left, y: r.top, w: r.width, h: Math.max(MENU_DEMO.min.h, bottom - r.top) };
  pr.cx = pr.box.x + pr.box.w / 2; pr.cy = pr.box.y + pr.box.h / 2;
}
function stopMenuDemo() {
  if (!game.practice?.demo) return;
  game.practice = null;
  for (const k of WORLD_LISTS) if (Array.isArray(game[k])) game[k] = [];
  Object.assign(game, { timers: [], melees: [], sweeps: [], zones: [], kicks: [], sinfx: [], muzzle: null, shake: 0, tballs: [] });
  resetSilica();
  resetZoom();
}
function menuDemoStep(dt) {
  const pr = game.practice, p = game.player, D = MENU_DEMO;
  pr.t += dt;
  if ((pr.placeT = (pr.placeT ?? 0.35) - dt) <= 0) { pr.placeT = 1; placeMenuDemo(); }   // (the leaderboard loads later and can grow; the menu slides in)
  demoDodge(dt);
  if ((pr.swapT -= dt) > 0 || pr.cards.length < 2) return;
  pr.swapT = demoSwapT();                            // a random other weapon from your loadout (user: "faster, random")
  const others = pr.cards.filter(id => id !== pr.card);
  pr.card = others[Math.floor(Math.random() * others.length)];
  pr.fireT = Math.min(pr.fireT, 0.2);
}
const demoSwapT = () => MENU_DEMO.every[0] + Math.random() * (MENU_DEMO.every[1] - MENU_DEMO.every[0]);
// You, kiting: pushed away from every square inside `fear` (a melee weapon lets them closer, to reach them) and from
// the walls, pulled gently home to the middle, with a little wander so you're never still. Then any square closer than
// touching plus `gap` is put back out to that distance, so you're never hit.
function demoDodge(dt) {
  const pr = game.practice, p = game.player, D = MENU_DEMO, b = pr.box, melee = isMelee(pr.card);
  const reach = Math.min(rangeOf(pr.card), 320), [lo, hi] = Number.isFinite(reach) ? D.band[melee ? 'melee' : 'ranged'] : [0, 0];
  const crowd = D.crowd[melee ? 'melee' : 'ranged'];
  let fx = (pr.cx - p.x) / b.w * D.home * 4, fy = (pr.cy - p.y) / b.h * D.home * 4;
  fx += Math.cos(pr.t * 0.9) * 0.2; fy += Math.sin(pr.t * 0.67) * 0.2;   // wander
  let near = null, nd = Infinity;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd) { nd = d; near = e; }
  }
  let ex = 0, ey = 0;
  if (near && hi > 0) {                              // the nearest one: at the weapon's best distance
    const dx = near.x - p.x, dy = near.y - p.y, d = nd || 1, want = (lo + hi) / 2 * reach;
    const k = d > hi * reach ? Math.min(1.4, (d - hi * reach) / 60 + 0.5) : d < lo * reach ? -Math.min(1.8, (lo * reach - d) / 30 + 0.6) : (d - want) / (want || 1) * 0.4;
    ex += dx / d * k; ey += dy / d * k;
  }
  for (const e of game.enemies) {                    // the rest (and the nearest, close up): steer clear
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, r = crowd + e.r;
    if (d < r) { const k = (r - d) / r * 2.4; ex += dx / d * k; ey += dy / d * k; }
  }
  const em = Math.hypot(ex, ey);
  if (em > 1.8) { ex *= 1.8 / em; ey *= 1.8 / em; }   // (a crowd mustn't shove you into a wall)
  fx += ex; fy += ey;
  const wl = p.x - b.x, wr = b.x + b.w - p.x, wt = p.y - b.y, wb = b.y + b.h - p.y, push = q => (q * q) * 4;   // the walls: harder the closer
  if (wl < D.wall) fx += push((D.wall - wl) / D.wall); if (wr < D.wall) fx -= push((D.wall - wr) / D.wall);
  if (wt < D.wall) fy += push((D.wall - wt) / D.wall); if (wb < D.wall) fy -= push((D.wall - wb) / D.wall);
  const f = Math.hypot(fx, fy), want = f > 0.05 ? D.speed * Math.min(1, f) : 0;
  const tx = f > 0 ? fx / f * want : 0, ty = f > 0 ? fy / f * want : 0, k = Math.min(1, dt * D.turn);
  pr.vx = (pr.vx || 0) + (tx - (pr.vx || 0)) * k; pr.vy = (pr.vy || 0) + (ty - (pr.vy || 0)) * k;
  p.x += pr.vx * dt; p.y += pr.vy * dt;
  const es = game.enemies.filter(e => !e.dead);
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {   // the squares keep a little apart (no piles)
    const a = es[i], c = es[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (a.r + c.r) * 1.3;
    if (d < min) { const q = (min - d) / 2 / d; a.x -= dx * q; a.y -= dy * q; c.x += dx * q; c.y += dy * q; }
  }
  for (const e of es) {                            // never touched
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1, min = PLAYER.r + e.r * 1.42 + D.gap;
    if (d < min) { e.x = p.x + dx / d * min; e.y = p.y + dy / d * min; }
  }
}
function demoAttack(card) {
  const n = practiceAttacks(card).length, odds = MENU_DEMO.odds.slice(0, n), sum = odds.reduce((a, b) => a + b, 0);
  let x = Math.random() * sum;
  for (let i = 0; i < n; i++) if ((x -= odds[i]) < 0) return i;
  return 0;
}
addEventListener('resize', () => requestAnimationFrame(() => {
  if (current === 'scr-main' && game.inMenu && !menuEl.hidden) { if (game.practice?.demo) placeMenuDemo(); else startMenuDemo(); }
}));

// The main menu's news (v0.71, user: "on the demo lets make this a carousel if there's a new event or announcement",
// with the user's sketch: two packs, tilted, overlapping, an UPCOMING banner across them, "a nice abstract bg", and
// "floating too like our packs and hoverable since they are 3 separate parts"). The demo's box takes turns: each piece
// of news, then the fight, `every` s each (held while the pointer or focus is on it), with arrows and dots under it.
// With no news it's only the fight, as before. Each news item is a slide; `packs` are [key, name] (style.css .pack-<key>).
// v0.73 (user: "add a new content there saying NEW PACK! OUT NOW!, the background related to the pack"): a slide for every pack the store marks
// NEW (the store editor's NEW tick; storeconfig.js), first in the box: the pack big in the middle on a background from its own cover and colours.
const ANN_THEME = { tballs: ['#ff3346', '#c81f3a', '#ff8a5c'], starter: ['#9fb8ff', '#d6dcff', '#ff8ac8'], bigger: ['#ff9a3d', '#a8a866', '#ff5a3d'],
  magus: ['#b28cff', '#ff5fc8', '#4a6bff'], silica: ['#ff8a4a', '#d0773a', '#ffcf8a'] };
const ANN_COVER = { starter: 'standard_pack', bigger: 'bigger_guns_pack', magus: 'magus_pack', silica: 'silica_pack', tballs: 'tballs_pack' };
const ANN = { every: 7, items: [
  ...STORE_PACKS.filter(k => PACKS[k]?.isNew).map(k => ({ id: `new-${k}`, kicker: 'New pack!', word: 'Out now!', solo: k, packs: [[k, PACKS[k].short]] })),
  { id: 'upcoming', kicker: '2 new packs', word: 'Upcoming', packs: [['lantern', 'Lantern'], ['engineer', 'Engineer']] },
] };
let annAt = 0, annT = 0, annHold = false;
const annSlides = () => [...ANN.items.map(a => a.id), ...(game.practice?.demo ? ['demo'] : [])];
// A pack that isn't in the store yet: the same pack as packArt draws, its own cover, name and PACK.
function annPack(key, name, top = 'legendary') {
  const shade = '<span class="pack-shade"></span><span class="pack-holo"></span>';
  return `<span class="pack-art pack-${key} top-${top} has-cover ann-tilt" aria-hidden="true"><span class="pack-top">${shade}</span>`
    + `<span class="pack-body">${shade}<span class="pack-logo">${name}</span><span class="pack-word">Pack</span></span></span>`;
}
function renderAnn() {
  const items = ANN.items;
  $('ann').hidden = !items.length;
  if (!items.length) return;
  // three separate parts, each floating and turning toward the pointer on its own: the back pack, the front pack, the banner
  $('ann-slides').innerHTML = items.map(a => {
    const th = a.solo ? ANN_THEME[a.solo] || ['#ffd25a', '#ff7a2a', '#6a8bff'] : null;
    const bgStyle = th ? ` style="--c1:${th[0]};--c2:${th[1]};--c3:${th[2]};--cover:${ANN_COVER[a.solo] ? `url(assets/img/${ANN_COVER[a.solo]}.webp)` : 'none'}"` : '';
    return `<article class="ann-slide ann-${a.id}${a.solo ? ' is-newpack' : ''}"${bgStyle} aria-roledescription="slide" aria-label="${a.kicker} ${a.word}: ${a.packs.map(p => p[1] + ' Pack').join(', ')}">`
    + '<div class="ann-bg" aria-hidden="true"><i class="ann-rays"></i><i class="ann-blob ann-b1"></i><i class="ann-blob ann-b2"></i><i class="ann-blob ann-b3"></i><i class="ann-grid"></i></div>'
    + '<div class="ann-stage">'
    + (a.solo ? `<div class="ann-part ann-solo"><div class="ann-float">${annPack(a.solo, PACK_LOGO[a.solo] || PACKS[a.solo].short, packTop(a.solo))}</div></div>`
      : a.packs.map((p, i) => `<div class="ann-part ann-p${i + 1}"><div class="ann-float">${annPack(p[0], p[1])}</div></div>`).reverse().join(''))
    + `<div class="ann-part ann-tag"><div class="ann-float"><div class="ann-banner ann-tilt"><span class="ann-kicker">${a.kicker}</span><span class="ann-word">${a.word}</span></div></div></div>`
    + '</div></article>'; }).join('');
}
function annOpen() {
  if (!ANN.items.length) return;
  const ids = annSlides();
  $('ann-dots').innerHTML = ids.map((id, i) => `<button class="ann-dot" type="button" data-i="${i}" aria-label="${id === 'demo' ? 'Demo fight' : ANN.items[i].word}"><i></i></button>`).join('');
  $('ann').querySelector('.ann-nav').hidden = ids.length < 2;
  showAnn(0);
}
function showAnn(i) {
  const ids = annSlides();
  annAt = (i + ids.length) % ids.length; annT = 0;
  const id = ids[annAt];
  $('ann').classList.toggle('is-demo', id === 'demo');
  for (const el of $('ann-slides').children) el.classList.toggle('is-on', el.classList.contains(`ann-${id}`));
  for (const d of $('ann-dots').children) { const on = +d.dataset.i === annAt; d.classList.toggle('is-on', on); d.ariaCurrent = on ? 'true' : null; d.style.setProperty('--ann-t', `${ANN.every}s`); }
}
setInterval(() => {                                  // (counted here, not per frame: the menu doesn't need the game loop)
  if (current !== 'scr-main' || $('ann').hidden || annHold || document.hidden || annSlides().length < 2) return;
  if ((annT += 0.25) >= ANN.every) showAnn(annAt + 1);
}, 250);
{
  const ann = $('ann'), hold = on => { annHold = on; ann.classList.toggle('is-hold', on); };
  ann.addEventListener('pointerenter', () => hold(true));
  ann.addEventListener('pointerleave', () => hold(ann.contains(document.activeElement)));
  ann.addEventListener('focusin', () => hold(true));
  ann.addEventListener('focusout', e => hold(ann.contains(e.relatedTarget) || ann.matches(':hover')));
  $('ann-prev').addEventListener('click', () => showAnn(annAt - 1));
  $('ann-next').addEventListener('click', () => showAnn(annAt + 1));
  $('ann-dots').addEventListener('click', e => { const d = e.target.closest('.ann-dot'); if (d) showAnn(+d.dataset.i); });
  renderAnn();
  packTilt($('ann-slides'), t => t.closest('.ann-part'), '.ann-tilt');
}

// A new enemy walks in from the box's edge, away from you.
function spawnPractice() {
  const pr = game.practice, b = pr.box, P = PR_BATTLE, p = game.player;
  let x = 0, y = 0;
  for (let i = 0; i < 10; i++) {
    const side = Math.floor(Math.random() * 4), t = Math.random();
    x = side === 0 ? b.x + 14 : side === 1 ? b.x + b.w - 14 : b.x + 14 + t * (b.w - 28);
    y = side === 2 ? b.y + 14 : side === 3 ? b.y + b.h - 14 : b.y + 14 + t * (b.h - 28);
    if (Math.hypot(x - p.x, y - p.y) > P.away) break;
  }
  const u = UNITS[P.units[Math.floor(Math.random() * P.units.length)]];
  const e = makeEnemy(u.type, x, y, !!u.split);
  if (u.boom) e.boom = true;
  if (u.n) e.n = u.n;
  const ids = pr.card === DECK_TAB ? prCards() : [pr.card];   // (Whole deck: the deck's average hit)
  const hit = damageOf(ids.reduce((s, id) => s + (CARDS[id]?.dmg || 8), 0) / Math.max(1, ids.length));
  const hits = pr.demo ? MENU_DEMO.hp : P.hp, least = pr.demo ? MENU_DEMO.hpMin : P.hpMin;   // (the menu's demo: softer, user)
  e.hp = e.maxHp = Math.max(least, Math.round(hit * hits * (u.type === 'big' ? 1.8 : 1)));
  game.enemies.push(e);
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
  if (pr.archive) return;                            // (the Weapon Archive has its own panels: archive.js)
  document.body.classList.toggle('is-loadout-test', auto);   // shows your deck along the bottom
  $('pr-fire').hidden = auto;
  // the controls, down the left (v0.57, user: bigger, on the left side)
  const keyRow = (keys, what, sub = '') => `<li><span class="prc-keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span><span class="prc-what">${what}${sub ? `<small>${sub}</small>` : ''}</span></li>`;
  $('pr-keys').innerHTML = '<p class="prc-head">Controls</p><ul>' + (auto
    ? [keyRow(['WASD'], 'Move', 'your deck fires on its own'), keyRow(['R'], 'Restart the count'), keyRow(['Q', 'E'], 'Switch weapon'), keyRow(['Esc'], 'Back')]
    : [keyRow(['1', '2', '3'], 'Single · Passive · Ult', 'it fires on its own'), keyRow(['Space'], 'Fire now'), keyRow(['WASD'], 'Move'), keyRow(['Q', 'E'], 'Switch weapon'),
       ...(prPacks() ? [keyRow(['←', '→'], 'Switch pack')] : []), keyRow(['Esc'], 'Back')]).join('') + '</ul>';
  renderPrPack();
  $('btn-pr-back').textContent = pr.loadout ? 'Back to loadout' : 'Back to pack';
  if (pr.loadout) {
    const n = runCards().length;
    $('pr-title').textContent = 'Test loadout';
    $('pr-eyebrow').textContent = `Your deck · ${n} card${n === 1 ? '' : 's'}`;
  } else { $('pr-title').textContent = 'Test pack'; $('pr-eyebrow').textContent = PACKS[pr.pack].name; }
  $('pr-tabs').innerHTML = prCards().map(id => `<button type="button" data-card="${id}" aria-pressed="${id === pr.card}" style="--c: var(--${id})">`
    + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CARD_ICON[id] || ''}</svg>${CARDS[id].name}</button>`).join('')
    + (pr.loadout ? `<button type="button" data-card="${DECK_TAB}" aria-pressed="${auto}" style="--c: var(--text)">Whole deck</button>` : '');
  if (auto) { $('pr-fire').innerHTML = ''; renderPrDmg(); return; }
  const atk = practiceAttacks(pr.card);
  pr.sel = Math.min(pr.sel || 0, atk.length - 1);
  $('pr-fire').innerHTML = atk.map((a, i) =>
    `<button type="button" data-i="${i}" aria-pressed="${i === pr.sel}" style="--c: var(--${pr.card})"><span class="up-key" aria-hidden="true">${i + 1}</span><b>${a.label}</b>${a.name ? `<small>${a.name}</small>` : ''}</button>`).join('');
  renderPrDmg();
}
// Test pack's pack (v0.60, user: "show on the left side the pack design so you know which pack, then arrow keys left
// and right to switch packs; animate the pack to spin into the new pack"): the pack over the controls, ‹ › either side
// of its name. Switching spins it a turn and a quarter, swaps it while it's edge on, and it spins on round into the
// new one; the arena starts again with the new pack's rarest weapon.
const prPacks = () => { const pr = game.practice; return pr && pr.pack && !pr.loadout && !pr.lab && !pr.demo ? STORE_PACKS.filter(k => testCards(k).length) : null; };
function renderPrPack() {
  const el = $('pr-pack'), ks = prPacks();
  el.hidden = !ks;
  if (!ks || el.dataset.k === game.practice.pack) return;
  el.dataset.k = game.practice.pack;
  el.innerHTML = `<div class="pr-pack-art">${packArt(game.practice.pack)}</div>`
    + `<div class="pr-pack-nav"><button type="button" data-pack-step="-1" aria-label="Previous pack">‹</button><span>${PACKS[game.practice.pack].name}</span><button type="button" data-pack-step="1" aria-label="Next pack">›</button></div>`;
}
function practicePack(d) {
  const ks = prPacks(), pr = game.practice;
  if (!ks) return;
  const k = ks[(ks.indexOf(pr.pack) + d + ks.length) % ks.length], art = $('pr-pack').querySelector('.pr-pack-art');
  const go = () => { pr.pack = viewing = k; viewCard = testCards(k)[0]; practiceCard(viewCard); };
  if (!art || reducedMotion) { go(); return; }
  art.getAnimations().forEach(a => a.cancel());
  const s = d < 0 ? -1 : 1;
  art.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${s * 450}deg) scale(.9)` }], { duration: 260, easing: 'cubic-bezier(.5, 0, .9, .5)' }).finished.then(() => {
    go();
    $('pr-pack').querySelector('.pr-pack-art')?.animate([{ transform: `rotateY(${s * 90}deg) scale(.9)` }, { transform: `rotateY(${s * 360}deg) scale(1)` }],
      { duration: 420, easing: 'cubic-bezier(.15, .6, .3, 1)' });
  }, () => {});
}
$('pr-pack').addEventListener('click', e => { const b = e.target.closest('[data-pack-step]'); if (b) { practicePack(+b.dataset.packStep); b.blur(); } });
function testFire(n) {
  const pr = game.practice;
  if (!pr || prAuto()) return;
  const card = pr.card;
  if (n === 1) { const tg = inRange(card) || pr.dummies[0] || nearestEnemy(); if (tg || CARDS[card].auto) shoot(card, tg); }
  else if (COMBOS[card]?.[n]) runCombo({ card, n, ...COMBOS[card][n] });
}
function practiceSelect(i) { const pr = game.practice; if (!prAuto() && i < practiceAttacks(pr.card).length) { pr.sel = i; if (pr.battle) pr.fireT = Math.min(pr.fireT, 0.15); renderPractice(); } }
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
  if (game.practice.archive) return onArchiveKey(e);   // (the Weapon Archive: archive.js)
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
  else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && prPacks()) { if (!e.repeat) practicePack(e.code === 'ArrowRight' ? 1 : -1); }   // (v0.60: the arrows switch pack; WASD still moves)
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
let revealRate = 1;                                  // Space speeds up the rest of a reveal (user): REVEAL.fast, for every page after too
let revealAfter = null;                              // where Continue goes
let revealAgain = null;                              // a store pack's key: Buy again (v0.70, user), while you can afford another
const wait = ms => new Promise(r => setTimeout(r, ms));
const done = anim => (anim.finished || Promise.resolve()).catch(() => {});   // a cancelled animation just ends the wait (no `finished`: an older browser)
// Plays an animation and waits for it, but never longer than it should take: a throttled or hidden page can slow
// animations right down, and the reveal must still keep its pace (it then jumps the animation to its end).
function play(el, frames, opts) {
  const a = el.animate(frames, opts), total = (opts.duration || 0) + (opts.delay || 0) + 20;
  return Promise.race([done(a), wait(total)]).then(() => { try { if (a.playState === 'running') a.finish(); } catch (err) { /* already gone */ } });
}

// v0.55 (user): 5 cards at a time, big, and the better the card the bigger its moment. Common just flips; Uncommon
// glows as it lands; Rare has a shine sweep across it; Epic shakes and charges up first; Legendary and Triple S charge
// longer, flash, and keep a foil shimmer on them (Triple S in every colour). (No rays behind them: user, v0.57.)
// v0.62 (user: "make … the reveal … fast, pressing space"): everything plays `speed`× quicker than it did, and Space
// makes the rest of the reveal `fast`× quicker again (what's playing too); a second Space shows the page at once, and
// Space on a finished page goes on (Next, then Continue), so tapping it runs through the whole pack.
const REVEAL = { page: 5, speed: 2.8, fast: 14 };   // (v0.70, user: "a bit faster, and Space much faster": speed 2, fast 5 before)
const revealMs = t => t / (REVEAL.speed * revealRate);
// Waits `t` ms of reveal time, following the speed as it changes (a Space mid-wait cuts it short too).
async function revealWait(t) {
  for (let gone = 0; gone < t;) { const at = performance.now(); await wait(16); gone += (performance.now() - at) * REVEAL.speed * revealRate; }
}
const RARITY_TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, sss: 5, event: 5 };
let revealIds = [], revealPage = 0, revealNote = '';
// The best pull (v0.57, user: "if they get the highest rarity", then "as long as the card opened has that rarity"):
// every card of the best rarity its pack can give, when that beats Common, charges up, bursts twice and plays the
// win sound. The rarest cards turn over last (user: "for more anticipation").
let revealTop = 'common';
const isWin = id => RARITY_TIER[revealTop] > 0 && RARITY_TIER[CARDS[id].rarity] >= RARITY_TIER[revealTop];
function revealSound(ids) {
  const win = ids.some(isWin);
  SFX.pull(ids.some(id => CARDS[id].rarity !== 'common') ? 'uncommon' : 'common', win);
}
function startReveal(ids, { eyebrow, title, note, after, again = null, all = false, top = 'common' }) {
  revealTop = top;
  // rarest last (v0.57, user): the commons first, the best of the pack at the very end (the order is only how they're shown)
  ids = ids.map((id, i) => ({ id, i })).sort((a, b) => (RARITY_TIER[CARDS[a.id].rarity] ?? 0) - (RARITY_TIER[CARDS[b.id].rarity] ?? 0) || a.i - b.i).map(o => o.id);
  $('r-eyebrow').textContent = eyebrow;
  $('r-title').textContent = title;
  revealNote = note || '';
  revealAfter = after;
  revealAgain = again;
  revealIds = ids; revealPage = 0;
  revealRate = 1;
  $('save-warn').hidden = saveWorks;
  showScreen('scr-reveal');
  if (all) skipAllReveal(); else showRevealPage();
}
const revealPages = () => Math.max(1, Math.ceil(revealIds.length / REVEAL.page));
function revealSlot(c) {
  const k = CARDS[c], r = k.rarity;
  return `<li class="rv-slot rv-${r === 'event' ? 'legendary rv-event' : r}" data-card="${c}" style="--c: var(--${c}); --rc: var(--r-${r})">`
    + `<div class="mcard rv-card is-down is-waiting" style="--c: var(--${c}); --rc: var(--r-${r})">`
    + cardFace(c)
    + `<span class="rv-shine" aria-hidden="true"></span><span class="card-back" aria-hidden="true"></span></div></li>`;
}
// v0.65 (user: "make them hoverable too"): an open card tilts to the pointer and its shine follows it
packTilt(revealEl, t => t.closest('.rv-slot.is-open'), '.rv-card');
function showRevealPage() {
  const n = revealIds.length, from = revealPage * REVEAL.page, page = revealIds.slice(from, from + REVEAL.page);
  revealEl.innerHTML = page.map(revealSlot).join('');
  $('reveal-count').textContent = revealPages() > 1 ? `${from + 1}–${from + page.length} of ${n}` : '';
  $('reveal-note').textContent = revealNote;
  $('reveal-note').hidden = true;
  $('btn-reveal-all').hidden = false;
  $('btn-reveal-skipall').hidden = revealPage >= revealPages() - 1;   // (v0.56: Skip all, while more pages are to come)
  $('btn-reveal-next').hidden = true;
  $('btn-reveal-done').hidden = true;
  $('btn-reveal-again').hidden = true;
  $('reveal-tip').hidden = false;
  if (!animOk) { skipReveal(); return; }
  playReveal(++revealRun);
}

async function playReveal(run) {
  const ms = revealMs;                               // (Space makes the rest quicker: speedReveal)
  const slots = [...revealEl.children];
  slots.forEach((li, k) => {                         // the five come up out of the pack, face down
    const card = li.querySelector('.rv-card');
    card.classList.remove('is-waiting');
    card.animate([{ transform: 'translateY(60px) scale(.7) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: ms(260), delay: ms(k * 70), easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' });
  });
  await revealWait(260 + slots.length * 70 + 120);
  for (const li of slots) {
    if (run !== revealRun) return;
    const last = li === slots[slots.length - 1];
    if (last && slots.length > 1) await revealWait(220);   // a beat before the last (and best) one
    if (run !== revealRun) return;
    await flipCard(li, ms, last);
    if (run !== revealRun) return;
    await revealWait(90);
  }
  if (run === revealRun) finishReveal();
}
// Face down, every card is black; just before it turns over it lights up in Common's colour, then turns to its own
// rarity's (v0.57, user: "from a black, colored to the common color, then transition to the rarity color"). style.css --bk.
const rarityColour = r => getComputedStyle(document.documentElement).getPropertyValue(`--r-${r}`).trim();
function backShift(card, r, dur) {
  const black = getComputedStyle(card).getPropertyValue('--bk').trim(), common = rarityColour('common');
  const frames = r === 'common' ? [{ '--bk': black }, { '--bk': common }]
    : r === 'sss' ? [{ '--bk': black, '--holo-on': 0 }, { '--bk': common, '--holo-on': 0, offset: 0.3 }, { '--bk': rarityColour(r), '--holo-on': 0, offset: 0.65 }, { '--bk': rarityColour(r), '--holo-on': 1 }]   // (then it melts into foil: style.css)
    : [{ '--bk': black }, { '--bk': common, offset: 0.35 }, { '--bk': rarityColour(r) }];   // (no stop on Common: one smooth run)
  return card.animate(frames, { duration: dur, easing: 'ease-in', fill: 'forwards' });
}
async function flipCard(li, ms, last = false) {
  const card = li.querySelector('.rv-card'), id = li.dataset.card, r = CARDS[id].rarity, tier = RARITY_TIER[r] ?? 0;
  const win = isWin(id);
  if (tier >= 3 || win) {                            // Epic and up, and the pack's best pull: it shakes and charges first
    li.classList.add('is-charging');
    const shake = [], dur = ms(tier >= 4 ? 760 : tier >= 3 ? 460 : 340);
    for (let k = 0; k <= 10; k++) shake.push({ transform: `translate(${k % 2 ? 3 : -3}px, ${-k * (tier >= 4 ? 1.6 : 1)}px) rotate(${k % 2 ? 1.5 : -1.5}deg)` });
    backShift(card, r, dur);                         // (its colour climbs while it charges)
    await play(card, shake, { duration: dur, easing: 'linear' });
  } else {
    const base = r === 'common' ? 180 : 260 + tier * 80;
    backShift(card, r, ms(base));
    await revealWait(base);
  }
  // v0.57 (user: "instead of flip ... animate as the card swipes"): it doesn't turn over. A bright edge sweeps across
  // it, wiping its swirl away to show the card under it, and sparkles burst out where the edge passes.
  const back = card.querySelector('.card-back'), wipe = ms(300 + tier * 45), ease = 'cubic-bezier(.55, 0, .35, 1)';
  li.classList.remove('is-charging');
  li.classList.add('is-open');
  revealSound([id]);
  cardBurst(li, tier, win, wipe);
  const edge = document.createElement('span');
  edge.className = 'rv-swipe'; edge.setAttribute('aria-hidden', 'true');
  card.appendChild(edge);
  done(edge.animate([{ transform: 'translateX(-130%) skewX(-12deg)' }, { transform: 'translateX(330%) skewX(-12deg)' }], { duration: wipe, easing: ease })).then(() => edge.remove());
  await play(back, [{ clipPath: 'polygon(0% 0, 120% 0, 120% 100%, -20% 100%)' }, { clipPath: 'polygon(120% 0, 120% 0, 120% 100%, 100% 100%)' }], { duration: wipe, easing: ease });
  card.classList.remove('is-down');
  const lift = 6 + tier * 4, grow = 1.02 + tier * 0.03;
  await play(card, [
    { transform: 'none', filter: `brightness(${1 + tier * 0.35})` },
    { transform: `scale(${grow}) translateY(-${lift}px)`, filter: `brightness(${1 + tier * 0.2})`, offset: 0.45 },
    { transform: 'none', filter: 'brightness(1)' },
  ], { duration: ms(240 + tier * 60), easing: 'ease-out' });
}

// v0.57 (user: "a nice effect, glow or shine to card openings"): every card that opens bursts with light in its
// rarity's colour: a flash and a ring going out (bigger the rarer it is), and one sweep of shine across its face. The
// pack's best pull gets a second ring. And sparkles (user: four-point stars, "low rarity few, high lots"): thrown out
// past the card's edges from where the swipe passes, `wipe` ms, so they go off along with it.
const SPARKLES = [3, 6, 10, 15, 22, 30];             // by tier: Common … Triple S / Event (the best pull: half as many again)
const SPARKLE_SSS = ['#f4f6fa', '#ffc9e4', '#c9e8ff', '#e0d4ff', '#d4ffe8', '#fff3c4'];                                 // Triple S: platinum iridescent (user)
const SPARKLE_EVENT = ['var(--rc)', '#f4f6fa', 'var(--rc)', '#ffc9e4', 'var(--rc)', '#c9e8ff', '#e0d4ff', '#d4ffe8'];   // Event: red and iridescent (user)
const SPARKLE_SVG = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1Q13.2 10.8 23 12Q13.2 13.2 12 23Q10.8 13.2 1 12Q10.8 10.8 12 1Z"/>'
  + '<circle cx="12" cy="12" r="1.8" fill="#fff"/></svg>';
function cardBurst(li, tier, win, wipe = 300) {
  if (!animOk) return;
  const fx = (cls, style = '') => { const el = document.createElement('span'); el.className = `rv-fx ${cls}`; el.setAttribute('aria-hidden', 'true'); if (style) el.style.cssText = style; li.appendChild(el); return el; };
  const gone = (el, a) => done(a).then(() => el.remove());
  const big = 1 + tier * 0.18 + (win ? 0.3 : 0);
  const fl = fx('rv-flash');
  gone(fl, fl.animate([{ transform: 'scale(.3)', opacity: 0.95 }, { transform: `scale(${1.3 * big})`, opacity: 0 }], { duration: 420 + tier * 60, easing: 'cubic-bezier(.2, .7, .3, 1)' }));
  for (let k = 0; k < (win ? 2 : 1); k++) {
    const rg = fx('rv-ring');
    gone(rg, rg.animate([{ transform: 'scale(.55)', opacity: 1 }, { transform: `scale(${1.7 * big + k * 0.5})`, opacity: 0 }], { duration: 520 + tier * 60 + k * 160, delay: k * 110, easing: 'ease-out', fill: 'backwards' }));
  }
  const card = li.querySelector('.rv-card'), w = card.offsetWidth, h = card.offsetHeight;
  const n = Math.round(SPARKLES[Math.min(tier, 5)] * (win ? 1.5 : 1)), set = li.classList.contains('rv-sss') ? SPARKLE_SSS : li.classList.contains('rv-event') ? SPARKLE_EVENT : null;
  for (let k = 0; k < n; k++) {
    const fx0 = Math.random() - 0.5, fy0 = Math.random() - 0.5, x0 = fx0 * w * 0.9, y0 = fy0 * h * 0.9;
    const a = Math.atan2(y0, x0) + (Math.random() - 0.5) * 0.8, d = 0.55 * Math.hypot(w, h) + 20 + Math.random() * (40 + tier * 14);
    const size = 13 + Math.random() * (9 + tier * 3.5), spin = (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 90);
    const c = set ? set[k % set.length] : k % 3 ? 'var(--rc)' : '#fff';
    const st = fx('rv-star', `--sc: ${c}; width: ${size.toFixed(0)}px; height: ${size.toFixed(0)}px; margin: ${(-size / 2).toFixed(1)}px 0 0 ${(-size / 2).toFixed(1)}px`);
    st.innerHTML = SPARKLE_SVG;
    const ex = Math.cos(a) * d, ey = Math.sin(a) * d;
    gone(st, st.animate([
      { transform: `translate(${x0.toFixed(0)}px, ${y0.toFixed(0)}px) scale(0) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${(x0 + (ex - x0) * 0.35).toFixed(0)}px, ${(y0 + (ey - y0) * 0.35).toFixed(0)}px) scale(1.15) rotate(${(spin * 0.4).toFixed(0)}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${ex.toFixed(0)}px, ${ey.toFixed(0)}px) scale(.35) rotate(${spin.toFixed(0)}deg)`, opacity: 0 },
    ], { duration: 650 + Math.random() * 450 + tier * 60, delay: (fx0 + 0.5) * wipe * 0.85, easing: 'cubic-bezier(.2, .7, .35, 1)', fill: 'backwards' }));
  }
  const sh = li.querySelector('.rv-shine');
  if (sh) sh.animate([{ opacity: 1, backgroundPosition: '130% 0' }, { opacity: 1, backgroundPosition: '-60% 0' }], { duration: 620, delay: 60, easing: 'ease-out' });
}

function skipReveal() {
  revealRun++;
  const down = [...revealEl.querySelectorAll('.rv-card.is-down')];   // one flip sound for the rest, with the chime if any beats Common
  if (down.length) revealSound(down.map(c => c.closest('.rv-slot').dataset.card));   // one sound for the rest
  for (const li of revealEl.children) {
    const card = li.querySelector('.rv-card');
    card.getAnimations().forEach(a => a.cancel());
    card.classList.remove('is-waiting', 'is-down');
    li.classList.remove('is-charging'); li.classList.add('is-open');
  }
  finishReveal();
}

// Skip all (v0.56, user): every card in the pack at once, face up, one of each with how many you got, rarest first.
function skipAllReveal() {
  revealRun++;
  revealPage = revealPages() - 1;
  const groups = [];
  for (const id of revealIds) { const g = groups.find(x => x.id === id); if (g) g.n++; else groups.push({ id, n: 1 }); }
  groups.sort((a, b) => RARITY_TIER[CARDS[b.id].rarity] - RARITY_TIER[CARDS[a.id].rarity] || CARD_IDS.indexOf(a.id) - CARD_IDS.indexOf(b.id));
  revealEl.innerHTML = groups.map(g => revealSlot(g.id).replace(/<\/li>$/, `<b class="rv-n">×${g.n}</b></li>`)).join('');
  [...revealEl.children].forEach((li, i) => {
    li.classList.add('is-open'); li.querySelector('.rv-card').classList.remove('is-waiting', 'is-down');
    if (animOk) li.animate([{ opacity: 0, transform: 'translateY(30px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 30, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' });
  });
  $('reveal-count').textContent = `All ${revealIds.length} cards`;
  $('reveal-note').textContent = revealNote;
  revealSound(revealIds);
  finishReveal();
}

function speedReveal() {
  if (revealRate > 1) { skipReveal(); return; }      // a second press shows the rest at once
  revealRate = REVEAL.fast;
  for (const a of revealEl.getAnimations({ subtree: true })) { try { a.updatePlaybackRate(REVEAL.fast); } catch (err) { /* gone */ } }   // (what's playing now too)
}

// This page is done: the next five, or (the last page) the note and Continue.
function finishReveal() {
  const last = revealPage >= revealPages() - 1;
  $('btn-reveal-all').hidden = true;
  $('btn-reveal-skipall').hidden = last;
  $('reveal-tip').hidden = true;
  $('reveal-note').hidden = !last || !revealNote;
  $('btn-reveal-next').hidden = last;
  $('btn-reveal-done').hidden = !last;
  // v0.70 (user: "a buy again if there is still money after"): the same pack once more, straight to its opening
  const pk = last && revealAgain && PACKS[revealAgain], again = $('btn-reveal-again');
  again.hidden = !pk || save.gold < pk.price;
  if (!again.hidden) {
    again.innerHTML = `Buy again <span class="coin" aria-hidden="true"></span>${pk.price}`;
    again.setAttribute('aria-label', `Buy another ${pk.name} for ${pk.price} gold (you have ${save.gold})`);
  }
  (last ? $('btn-reveal-done') : $('btn-reveal-next')).focus();
}
function nextRevealPage() {
  if (revealPage >= revealPages() - 1) return;
  revealPage++;
  showRevealPage();
}

$('btn-reveal-all').addEventListener('click', skipReveal);
$('btn-reveal-skipall').addEventListener('click', skipAllReveal);
$('btn-reveal-next').addEventListener('click', nextRevealPage);
$('btn-reveal-done').addEventListener('click', () => revealAfter?.());
$('btn-reveal-again').addEventListener('click', () => { if (revealAgain) buyViewed(revealAgain, $('btn-reveal-again'), true); });

/* ---------- loadout: the deck builder (v0.31, user: like Legends of Runeterra's) ---------- */
// Left: your deck, one row per card (damage, name, copies). Right: every card you own, with how many are still free.
// Click a card, or drag it onto the deck, to add one; click a deck row, or drag it off the deck, to take one out.
// Auto builds a deck from your best cards; Clear empties it.
// CARD_ICON (each weapon's small line picture) lives in cardface.js, with the rest of a card's art.
const RARITY_RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
const freeCopies = id => (save.owned[id] || 0) - usedCopies(id);                         // owned and in no deck (tiers.js)
// A deck takes up to 14 of each, from the copies no other deck has.
const canEquip = (id, tab = loTab) => kindOf(id) === tab && freeCopies(id) > 0 && (save.equipped[id] || 0) < copyCap(tab);   // (×2 with Wild on it)
// v0.53 (user): two decks, ranged and melee. The tab says which one you're building: the list on the left is that
// deck, the cards on the right are that kind, and Auto / Clear only touch it. Either deck can be left empty.
// v0.63 (user): under the tabs, the Wild choice (save.js): Off, or the deck it doubles to 62 cards (two decks in a run).
let loTab = 'ranged';
const KIND_NAME = { ranged: 'Ranged', melee: 'Melee' };
const tabWord = tab => tab;
// The collection's pack filter (user): All, or one pack's cards (the starter pack's too). Only packs with cards of
// this tab's kind that you own get a button.
// v0.70 (user: "sort cards by rarity in the loadout by default; rework the filters to filter by pack or rarity"): two
// rows, Pack and Rarity, that work together, and a Sort: Rarity (rarest first, the default), Damage or Name.
let loPack = 'all', loRarity = 'all', loSort = 'rarity';
// (v0.61: the shared Commons and Uncommons, which every pack gives, have a filter of their own: "Every pack" since v0.70)
const PACK_FILTERS = () => [...STORE_PACKS.map(k => ({ k, name: PACKS[k].short, cards: PACKS[k].cards })),
  { k: 'shared', name: 'Every pack', tip: 'The Commons and Uncommons any pack can give', cards: SHARED.flatMap(r => cardsOfRarity(r, STARTER)) }];
const LO_SORTS = {
  rarity: { name: 'Rarity', by: (a, b) => RARITY_RANK[CARDS[b].rarity] - RARITY_RANK[CARDS[a].rarity] || CARDS[a].name.localeCompare(CARDS[b].name) },
  dmg: { name: 'Damage', by: (a, b) => playDmg(b) - playDmg(a) || RARITY_RANK[CARDS[b].rarity] - RARITY_RANK[CARDS[a].rarity] },
  name: { name: 'Name', by: (a, b) => CARDS[a].name.localeCompare(CARDS[b].name) },
};
// One row of chips: its label, then All and the choices (`dot`: the colour of each one's dot).
const chipRow = (group, label, now, list) => `<div class="cf-row" role="group" aria-label="${label}"><span class="cf-label">${label}</span>`
  + list.map(f => `<button type="button" class="cf-chip" data-${group}="${f.k}" aria-pressed="${f.k === now}"${f.tip ? ` title="${f.tip}"` : ''}${f.dot ? ` style="--dot: ${f.dot}"` : ''}>`
    + `${f.dot ? '<i class="cf-dot" aria-hidden="true"></i>' : ''}${f.name}${f.n != null ? ` <b>${f.n}</b>` : ''}</button>`).join('') + `</div>`;
function renderLoadout() {
  const tab = loTab, kind = tab, map = save.equipped, cards = equippedCards(tab), cap = deckCap(tab), full = cards.length >= cap;
  for (const k of ['ranged', 'melee']) { $(`deck-n-${k}`).textContent = equippedCards(k).length; $(`deck-max-${k}`).textContent = deckCap(k); }
  for (const b of document.querySelectorAll('.deck-tab')) {
    const k = b.dataset.kind;
    b.setAttribute('aria-selected', String(k === tab));
    b.classList.toggle('is-bad', deckOn(k) && deckProblemsOf(k).length > 0);
    b.classList.toggle('is-off', !deckOn(k));
    b.classList.toggle('is-wild', doubled(k));
  }
  for (const b of document.querySelectorAll('.deck-use')) {   // the on / off switches
    const on = deckOn(b.dataset.kind);
    b.setAttribute('aria-checked', String(on));
    b.querySelector('.deck-use-text').textContent = on ? 'On' : 'Off';
    b.setAttribute('aria-label', `${KIND_NAME[b.dataset.kind]} deck ${on ? 'on: it plays in runs' : 'off: it sits out of runs'}`);
  }
  renderWild();
  $('deck-panel').classList.toggle('is-off', !deckOn(tab));
  $('deck-panel').classList.toggle('is-full', full);
  $('deck-panel').dataset.kind = tab;
  const inDeck = CARD_IDS.filter(id => kindOf(id) === kind && map[id] > 0);
  // Both lists are rebuilt below, which throws away where they were scrolled to (user: click a card with the
  // collection scrolled down and it jumped up), so that's put back afterwards.
  const keep = [$('deck-list'), $('coll'), $('menu')].map(el => [el, el.scrollTop]);
  $('deck-empty').hidden = inDeck.length > 0;
  $('deck-empty').textContent = tab === 'melee' ? 'No melee deck: you fight with ranged weapons only. Drag melee cards here, or open one and press Add.'
    : 'No ranged deck: you fight with melee weapons only. Drag ranged cards here, or open one and press Add.';
  $('deck-list').innerHTML = inDeck.map(id => {
    const k = CARDS[id], t = cardTier(id);
    return `<li><button type="button" class="drow" data-id="${id}" style="--c: var(--${id}); --rc: var(--r-${k.rarity})" aria-label="${k.name}${t > 1 ? `, Tier ${TIER_ROMAN[t]}` : ''}, ${map[id]} in the ${tabWord(tab)} deck. Take one out">`
      + `<span class="drow-dmg">${k.dmg}</span><span class="drow-name">${k.name}${t > 1 ? ` <span class="drow-tier">${TIER_ROMAN[t]}</span>` : ''}</span><span class="drow-n">${map[id]}</span></button></li>`;
  }).join('');
  const owned = CARD_IDS.filter(id => save.owned[id] && kindOf(id) === kind);
  // (v0.70) the pack counts are of all your cards of this kind; the rarity counts, of the pack you picked
  const packs = PACK_FILTERS().map(f => ({ ...f, n: owned.filter(id => f.cards.includes(id)).length, dot: f.k === 'shared' ? 'var(--muted)' : `var(--pack-${f.k}, var(--neon))` })).filter(f => f.n);
  if (loPack !== 'all' && !packs.some(f => f.k === loPack)) loPack = 'all';
  const pick = packs.find(f => f.k === loPack), inPack = pick ? owned.filter(id => pick.cards.includes(id)) : owned;
  const rars = RARITIES.map(r => ({ k: r, name: RARITY_NAME[r], n: inPack.filter(id => CARDS[id].rarity === r).length, dot: `var(--r-${r})` })).filter(f => f.n).reverse();
  if (loRarity !== 'all' && !rars.some(f => f.k === loRarity)) loRarity = 'all';
  $('coll-filters').hidden = !owned.length;
  $('coll-filters').innerHTML = (packs.length > 1 ? chipRow('pack', 'Pack', loPack, [{ k: 'all', name: 'All', n: owned.length }, ...packs]) : '')
    + chipRow('rarity', 'Rarity', loRarity, [{ k: 'all', name: 'All', n: inPack.length }, ...rars])
    + chipRow('sort', 'Sort', loSort, Object.entries(LO_SORTS).map(([k, o]) => ({ k, name: o.name })));
  const mine = inPack.filter(id => loRarity === 'all' || CARDS[id].rarity === loRarity).sort(LO_SORTS[loSort].by);
  // v0.62 (user): a card opens it (openCardView: see it, upgrade it, add it); dragging it onto the deck still adds one
  $('coll').innerHTML = mine.length ? mine.map(id => {
    const k = CARDS[id], free = freeCopies(id), t = cardTier(id);
    return `<button type="button" role="listitem" class="ccard${canEquip(id) ? '' : ' is-used'}${spareCopies(id) && t < TIER_MAX && spareCopies(id) + tierXp(id) >= tierNeed(id, t) ? ' can-up' : ''}" data-id="${id}" style="--c: var(--${id}); --rc: var(--r-${k.rarity})"`
      + ` title="${k.desc}" aria-label="${k.name}, Tier ${TIER_ROMAN[t]}, ${Math.max(0, free)} free of ${save.owned[id]} owned. Open it">`
      + `${cardFace(id, { count: Math.max(0, free), countTip: `${Math.max(0, free)} free of ${save.owned[id]} owned`, tier: t })}</button>`;
  }).join('') : `<p class="coll-none">${owned.length ? `None of your ${kind} cards match these filters.` : `You don't own any ${kind} weapons yet.`}</p>`;
  for (const [el, top] of keep) el.scrollTop = top;
  $('btn-clear').disabled = !cards.length;
  $('btn-auto').disabled = !owned.length;
  const problems = deckProblems();
  $('btn-play').disabled = $('btn-loadout-test').disabled = problems.length > 0;
  // under the list: this deck's balance note (8+ of one card needs 7 others), or what's wrong with another deck
  const others = ['ranged', 'melee'].filter(k => k !== tab && deckOn(k));
  const warn = (!deckOn(tab) && `The ${tabWord(tab)} deck is off: it sits out of runs. Switch it on to play it.`)
    || deckProblemsOf(tab).find(p => p.includes('other'))
    || others.map(k => deckProblemsOf(k)[0] && `${KIND_NAME[k]} deck: ${deckProblemsOf(k)[0]}`).find(Boolean)
    || (!runCards().length && (equippedCards().length ? 'Both decks are off: switch one on.' : 'Both decks are empty: add cards to at least one.'));
  $('deck-warn').hidden = !warn;
  $('deck-warn').textContent = warn || '';
  if (!$('cview').hidden) renderCardView();
}
function setLoadoutTab(kind) {
  if (kind === loTab) return;
  loTab = kind; loPack = 'all'; loRarity = 'all';
  $('coll').scrollTop = 0; $('deck-list').scrollTop = 0;
  renderLoadout();
  SFX.click();
}
document.querySelector('.deck-tabs').addEventListener('click', e => { const b = e.target.closest('.deck-tab'); if (b) setLoadoutTab(b.dataset.kind); });
// The Wild choice (v0.63): Off, Ranged or Melee. Leaving one needs it back down to 31 cards (it can't hold more on its own).
// v0.70 (user: "unlock wild if each or the first ranged or melee is filled"): open once either deck is full (31; both
// before), and you can double a deck that's full (or the one it's on already).
const wildPick = k => deckFull(k) || wildKindNow() === k;
function renderWild() {
  const k = wildKindNow(), open = wildOpen() || !!k, nr = equippedCards('ranged').length, nm = equippedCards('melee').length;
  for (const b of $('wild-kind').querySelectorAll('[data-wkind]')) {
    b.setAttribute('aria-checked', String((b.dataset.wkind || null) === k));
    b.disabled = !!b.dataset.wkind && !wildPick(b.dataset.wkind);
  }
  $('wild-row').classList.toggle('is-locked', !open);
  $('wild-row').classList.toggle('is-on', wildOn());
  const n = k ? equippedCards(k).length : 0, [a, b] = k ? wildHalves() : [[], []];
  $('wild-note').innerHTML = !open ? `Fill a deck to ${DECK_LIMIT} to unlock Wild: it doubles that deck to ${DECK_LIMIT * 2} cards, played as two decks. <b>Ranged ${nr}/${DECK_LIMIT} · Melee ${nm}/${DECK_LIMIT}</b>`
    : !k ? `Pick a full deck to double: it holds up to ${DECK_LIMIT * 2} cards, and in a run they play as two decks.`
    : !deckOn(k) ? `Wild is on your ${k} deck, but that deck is off.`
    : wildOn() ? `<b>On:</b> your ${n} ${k} cards play as two ${k} decks, of ${a.length} and ${b.length}.`
    : `<b>Off for now:</b> add more than ${DECK_LIMIT} ${k} cards (up to ${DECK_LIMIT * 2}) and they play as two decks.`;
}
$('wild-kind').addEventListener('click', e => {
  const b = e.target.closest('[data-wkind]');
  const want = b?.dataset.wkind || null, now = wildKindNow();
  if (!b || b.disabled || want === now) return;
  if (now && equippedCards(now).length > DECK_LIMIT) {
    builderHint(`Your ${now} deck has ${equippedCards(now).length} cards: take it down to ${DECK_LIMIT} first, then Wild can move.`);
    SFX.back();
    return;
  }
  if (want && !wildPick(want)) { builderHint(`Fill your ${want} deck to ${DECK_LIMIT} first.`); return; }
  save.wildKind = want;
  writeSave();
  if (want) loTab = want;
  renderLoadout();
  (want ? SFX.confirm : SFX.back)();
});
// A deck's switch: on or off in one click (it also shows that deck).
document.querySelector('.deck-switches').addEventListener('click', e => {
  const b = e.target.closest('.deck-use');
  if (!b) return;
  const k = b.dataset.kind;
  if (deckOn(k)) save.off[k] = true; else delete save.off[k];
  writeSave();
  loTab = k;
  renderLoadout();
  (deckOn(k) ? SFX.click : SFX.back)();
});
$('coll-filters').addEventListener('click', e => {
  const b = e.target.closest('.cf-chip');
  if (!b || b.getAttribute('aria-pressed') === 'true') return;
  if (b.dataset.pack) loPack = b.dataset.pack;
  else if (b.dataset.rarity) loRarity = b.dataset.rarity;
  else if (b.dataset.sort) loSort = b.dataset.sort;
  $('coll').scrollTop = 0;
  renderLoadout();
  SFX.click();
});
// Add (d = 1) or take out (d = -1) one copy, in the deck on `tab`. Returns false if it can't.
function changeDeck(id, d, tab = loTab) {
  const map = save.equipped, n = (map[id] || 0) + d;
  if (n < 0 || kindOf(id) !== tab) return false;
  if (d > 0 && (!canEquip(id, tab) || equippedCards(tab).length >= deckCap(tab))) return false;
  if (n) map[id] = n; else delete map[id];
  writeSave();
  renderLoadout();
  const row = $('deck-list').querySelector(`.drow[data-id="${id}"]`);   // a quick flash on the row that changed
  if (row && animOk && tab === loTab) row.animate([{ filter: 'brightness(1.8)', transform: 'scale(1.03)' }, { filter: 'none', transform: 'none' }], { duration: 260, easing: 'ease-out' });
  (d > 0 ? SFX.click : SFX.back)();
  return true;
}
// Why a card can't go in, said under the heading for a moment.
let hintTimer = 0;
const HINT = 'Click a card to see it and upgrade it. Drag it onto your deck to add it. Click a deck row, or drag it out, to take one off.';
function builderHint(text) {
  const h = $('loadout-hint');
  h.textContent = text; h.classList.add('is-warn');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { h.classList.remove('is-warn'); h.textContent = HINT; }, 2600);
}
// Why `id` can't go in the deck on `tab`, in words (null if it can).
function whyNot(id, tab = loTab) {
  const own = save.owned[id] || 0, name = CARDS[id].name;
  if (kindOf(id) !== tab) return `${name} is a ${kindOf(id)} card: the ${tab} deck holds ${tab} cards.`;
  if (equippedCards(tab).length >= deckCap(tab)) return `The ${tab} deck is full: ${deckCap(tab)} cards at most${doubled(tab) ? '' : wildOpen() ? ' (Wild doubles it)' : ''}.`;
  if ((save.equipped[id] || 0) >= copyCap(tab)) return `${copyCap(tab)} ${name} is the most a deck can hold (and it needs ${BALANCE.others * (doubled(tab) ? 2 : 1)} other cards with it).`;
  if (freeCopies(id) <= 0) return `All ${own} of your ${name} cards are in your decks. Get more in Packs.`;
  return null;
}
function addCard(id) {
  if (changeDeck(id, 1)) return true;
  builderHint(whyNot(id) || `${CARDS[id].name} can't go in.`);
  return false;
}
// Auto (this tab's deck only): your best cards first (rarest, then the most damage a play), up to 7 of each, until the
// deck is full; then, if there's room, the best ones topped up toward 14 (v0.52), as far as the balance rule allows. It
// uses the copies the other decks leave free.
// v0.70 (user: "auto is auto fill … if there is a card present there, just add and don't remove placed cards"): it
// only fills the room that's left. The cards you put in stay (an empty deck fills just as before).
// A card's damage in one play: its hits, its burst or its "× N" (Twin Flame's 2, the Gatling's 10 rounds) times its damage.
const playDmg = id => { const k = CARDS[id], x = +(/×\s*(\d+)/.exec(k.dmgNote || '')?.[1] || 0); return (k.dmg || 0) * (k.hits || k.burst || x || 1); };
function autoDeck() {
  const tab = loTab, map = save.equipped, kind = tab, m = doubled(tab) ? 2 : 1, cap = deckCap(tab);
  const ids = CARD_IDS.filter(id => freeCopies(id) > 0 && kindOf(id) === kind).sort((a, b) => RARITY_RANK[CARDS[b].rarity] - RARITY_RANK[CARDS[a].rarity] || playDmg(b) - playDmg(a));
  let left = cap - equippedCards(tab).length;        // (62 with Wild on it, and every limit ×2)
  if (left <= 0 || !ids.length) { builderHint(left <= 0 ? `The ${tab} deck is already full.` : `No free ${tab} cards to add. Get more in Packs.`); SFX.back(); return; }
  for (const id of ids) {
    const have = map[id] || 0, n = Math.min(BALANCE.over * m - have, freeCopies(id), left);
    if (n > 0) { map[id] = have + n; left -= n; }
  }
  for (const id of ids) {
    if (!left) break;
    const n = map[id] || 0, total = cap - left, room = Math.min(copyCap(tab) - n, freeCopies(id));
    if (room <= 0 || total - n < BALANCE.others * m) continue;
    const add = Math.min(room, left);
    map[id] = n + add; left -= add;
  }
  writeSave(); renderLoadout(); SFX.confirm();
}

/* ---------- a card, big: see it and upgrade it (v0.62, user) ---------- */
// "clicking on a card also view the card. below the card a 'upgrade' button": the card at its tier, its upgrade bar
// (tiers.js: each spare copy fills a notch) and the Upgrade button under it; beside it what it does, what each tier
// gives, and Add / Take one out for the deck it goes in (this tab's, or its own kind's).
let cvId = null;
const cvTab = id => kindOf(id);
function openCardView(id) {
  if (!CARDS[id]) return;
  cvId = id;
  renderCardView();
  $('cview').hidden = false;
  ($('cv-upgrade').disabled ? $('cv-close') : $('cv-upgrade')).focus({ preventScroll: true });
  if (animOk) $('cview').querySelector('.cview-box').animate([{ transform: 'translateY(10px) scale(.97)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
  SFX.click();
}
function closeCardView() {
  if ($('cview').hidden) return;
  const id = cvId;
  $('cview').hidden = true;
  cvId = null;
  $('coll').querySelector(`.ccard[data-id="${id}"]`)?.focus({ preventScroll: true });
  SFX.back();
}
function cvStatRows(id) {
  const k = CARDS[id], t = cardTier(id), b = tierBonus(id, t), sp = upSpec(id, t), rows = [];
  const pct = x => `+${Math.round((x - 1) * 100)}%`;
  rows.push(['Damage', `${k.dmgNote || k.dmg}${b.dmg > 1 ? ` <em>${pct(b.dmg)}</em>` : ''}`]);
  if (k.range) rows.push([k.melee ? 'Reach' : 'Range', `${k.range} px`]);
  if (b.pace < 1) rows.push(['Attack speed', `<em>+${Math.round((1 / b.pace - 1) * 100)}%</em>`]);
  if (b.dur > 1) rows.push([DUR_NAME[id] ? DUR_NAME[id][0].toUpperCase() + DUR_NAME[id].slice(1) : 'Effect time', `<em>${pct(b.dur)}</em>`]);
  for (const [f, n] of Object.entries(b.add)) {
    const nm = (ADD_NAME[f] || [f, f])[1];
    rows.push([nm[0].toUpperCase() + nm.slice(1), f === 'blocks' ? `${SINS.guard.hits + n} <em>+${n}</em>` : `${sp[f]} <em>+${n}</em>`]);
  }
  return rows;
}
function renderCardView(up = 0) {
  const id = cvId, k = CARDS[id];
  if (!k) return;
  const t = cardTier(id), max = t >= TIER_MAX, need = max ? 1 : tierNeed(id, t), xp = max ? need : tierXp(id), spare = spareCopies(id);
  const box = $('cview');
  box.style.setProperty('--c', `var(--${id})`);
  box.style.setProperty('--rc', `var(--r-${k.rarity})`);
  $('cv-card').innerHTML = cardFace(id, { tier: t });
  $('cv-bar-fill').style.transform = `scaleX(${xp / need})`;
  $('cv-bar').style.setProperty('--notches', need);
  $('cv-bar').classList.toggle('is-max', max);
  $('cv-bar').setAttribute('aria-valuemax', need);
  $('cv-bar').setAttribute('aria-valuenow', xp);
  $('cv-bar-text').textContent = max ? `Tier V · the highest` : `Tier ${TIER_ROMAN[t]} → ${TIER_ROMAN[t + 1]} · ${xp}/${need} copies`;
  $('cv-bar').setAttribute('aria-valuetext', $('cv-bar-text').textContent);
  $('cv-upgrade').disabled = max || !spare;
  $('cv-upgrade').textContent = max ? 'Max tier' : 'Upgrade';
  const all = Math.min(spare, copiesToMax(id));
  $('cv-feedall').hidden = max || all < 2;
  $('cv-feedall').textContent = `Use all spare copies (${all})`;
  $('cv-why').textContent = max ? `${k.name} is at its highest tier.`
    : !spare ? ((save.owned[id] || 0) <= 1 ? 'You need another copy to feed it: you only have this one.' : 'All your other copies are in your decks. Take one out to feed it.')
    : `Each copy you feed it fills one notch: ${spare} spare ${spare === 1 ? 'copy' : 'copies'}.`;
  $('cv-eyebrow').innerHTML = `<span style="color: var(--r-${k.rarity})">${RARITY_NAME[k.rarity]}</span> · ${k.melee ? 'Melee' : 'Ranged'} · Tier ${TIER_ROMAN[t]}`;
  $('cv-name').textContent = k.name;
  $('cv-desc').textContent = k.desc;
  $('cv-stats').innerHTML = cvStatRows(id).map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  $('cv-plan').innerHTML = `<li class="${t === 1 ? 'is-now' : 'is-done'}"><b>I</b><span>As it comes</span></li>`
    + tierPlan(id).map((st, i) => {
      const n = i + 2, cls = t >= n ? (t === n ? 'is-now' : 'is-done') : t + 1 === n ? 'is-next' : '';
      return `<li class="${cls}"><b>${TIER_ROMAN[n]}</b><span>${tierStepText(id, st)}</span><small>${tierNeed(id, n - 1)} copies</small></li>`;
    }).join('');
  const inDecks = usedCopies(id), tab = cvTab(id);
  $('cv-own').textContent = `You own ${save.owned[id] || 0}: ${inDecks} in your decks, ${Math.max(0, freeCopies(id))} free.`;
  $('cv-add').textContent = `Add to ${KIND_NAME[tab]} deck`;
  $('cv-add').disabled = !!whyNot(id, tab);
  $('cv-add').title = whyNot(id, tab) || '';
  $('cv-take').disabled = !(save.equipped[id] > 0);
  $('cv-take').textContent = `Take one out (${save.equipped[id] || 0} in it)`;
  if (up && animOk) {                                      // a new tier: the card flares
    $('cv-card').animate([{ transform: 'scale(1.06)', filter: 'brightness(1.8) saturate(1.3)' }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    $('cv-bar').animate([{ boxShadow: '0 0 0 2px var(--rc), 0 0 22px var(--rc)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 700 });
  }
}
function cvFeed(n) {
  const id = cvId, r = feedCard(id, n);
  if (!r.ate) return;
  renderLoadout();
  renderCardView(r.ups);
  if (r.ups) {                                           // (said in the box: a toast is hidden behind the menus)
    const t = cardTier(id);
    $('cv-why').innerHTML = `<b class="cv-up">Tier ${TIER_ROMAN[t]}!</b> ${tierPlan(id).slice(t - 1 - r.ups, t - 1).map(st => tierStepText(id, st)).join(', ')}.`;
    SFX.confirm();
  }
  else { SFX.click(); if (animOk) $('cv-bar-fill').animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 300 }); }
  if ($('cv-upgrade').disabled) $('cv-close').focus({ preventScroll: true });
}
$('cv-upgrade').addEventListener('click', () => cvFeed(1));
$('cv-feedall').addEventListener('click', () => cvFeed(copiesToMax(cvId)));
$('cv-add').addEventListener('click', () => { const tab = cvTab(cvId); if (!changeDeck(cvId, 1, tab)) builderHint(whyNot(cvId, tab) || ''); });
$('cv-take').addEventListener('click', () => changeDeck(cvId, -1, cvTab(cvId)));
$('cv-close').addEventListener('click', closeCardView);
$('cview').addEventListener('click', e => { if (e.target === $('cview')) closeCardView(); });   // (a click outside the box)

// Dragging, with the pointer (mouse or touch): a card follows you, the deck lights up, and it lands where you let go.
// A press that barely moves is a click instead.
let drag = null, dragClick = false;
function dragStart(e) {
  const src = e.target.closest('.ccard, .drow');
  if (!src || e.button > 0) return;
  drag = { id: src.dataset.id, from: src.classList.contains('drow') ? 'deck' : 'coll', x: e.clientX, y: e.clientY, pid: e.pointerId, ghost: null };
}
function dragMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    const k = CARDS[drag.id];
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'drag-ghost';
    drag.ghost.style.cssText = `--c: var(--${drag.id}); --rc: var(--r-${k.rarity})`;
    drag.ghost.innerHTML = `<span class="drow-dmg">${k.dmg}</span><span class="drow-name">${k.name}</span>`;
    document.body.appendChild(drag.ghost);
    $('builder').classList.add(drag.from === 'coll' ? 'is-adding' : 'is-removing');
  }
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  $('deck-panel').classList.toggle('is-over', drag.from === 'coll' && overDeck(e));
  e.preventDefault();
}
const overDeck = e => { const r = $('deck-panel').getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
function dragEnd(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag; drag = null;
  if (!d.ghost) return;                              // it was a click
  d.ghost.remove();
  $('builder').classList.remove('is-adding', 'is-removing');
  $('deck-panel').classList.remove('is-over');
  dragClick = true; setTimeout(() => { dragClick = false; }, 0);   // the click that follows a drag doesn't count
  if (e.type === 'pointercancel') return;
  if (d.from === 'coll' && overDeck(e)) addCard(d.id);
  else if (d.from === 'deck' && !overDeck(e)) changeDeck(d.id, -1);
}
$('builder').addEventListener('pointerdown', dragStart);
addEventListener('pointermove', dragMove, { passive: false });
addEventListener('pointerup', dragEnd);
addEventListener('pointercancel', dragEnd);
$('builder').addEventListener('dragstart', e => e.preventDefault());
$('builder').addEventListener('click', e => {
  if (dragClick) return;
  const c = e.target.closest('.ccard'), r = e.target.closest('.drow');
  if (c) { openCardView(c.dataset.id); return; }   // (v0.62: a card opens; dragging it adds it)
  else if (r) changeDeck(r.dataset.id, -1);
  else return;
  // keep the keyboard where it was after the re-render
  const again = $('builder').querySelector(`.${c ? 'ccard' : 'drow'}[data-id="${(c || r).dataset.id}"]`) || (r && $('deck-list').querySelector('.drow')) || $('coll').querySelector('.ccard');
  again?.focus({ preventScroll: true });
});
$('btn-auto').addEventListener('click', autoDeck);
$('btn-clear').addEventListener('click', () => { const map = save.equipped; for (const id of CARD_IDS) if (kindOf(id) === loTab) delete map[id]; writeSave(); renderLoadout(); SFX.back(); $('btn-auto').focus(); });   // (this tab's deck)

$('btn-title').addEventListener('click', afterTitle);
// v0.57 (user: on a load, the Start button showed alone on a dark screen before the logo): the title stays hidden
// until its logo images and the fonts are ready (2.5 s at most), then everything comes in together, its animations
// starting from the top (style.css #scr-title.is-loading).
{
  const t = $('scr-title'), imgs = [...t.querySelectorAll('.title-logo img')];
  const loaded = i => (i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }));
  const ready = Promise.all([...imgs.map(loaded), document.fonts?.ready]);
  Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => t.classList.remove('is-loading'));
}

/* ---------- settings (v0.57, user: enter a code, and Reset data; on the main menu only, not the title screen) ---------- */
// CODES: what each code gives, once per computer (save.codes remembers which were used). None yet: add them here as
// { 'CODE': { gold: 100, note: 'Thanks for playing!' } }.
const CODES = {};
function showSettings() {
  showResetConfirm(false);
  $('code-in').value = '';
  $('code-msg').textContent = '';
  showScreen('scr-settings');
}
function redeemCode(raw) {
  const code = raw.trim().toUpperCase().replace(/\s+/g, ''), c = CODES[code];
  if (!code) return 'Type a code first.';
  if (!c) return 'That code doesn’t work.';
  save.codes = save.codes || [];
  if (save.codes.includes(code)) return 'You’ve already used that code.';
  save.codes.push(code);
  if (c.gold) save.gold += c.gold;
  writeSave();
  renderGold();
  return c.note || (c.gold ? `+${c.gold} gold!` : 'Code redeemed!');
}
const settingsBack = () => goMain();
$('btn-main-settings').addEventListener('click', showSettings);
$('btn-settings-back').addEventListener('click', settingsBack);
$('code-form').addEventListener('submit', e => {
  e.preventDefault();
  $('code-msg').textContent = redeemCode($('code-in').value);
  $('code-in').select();
});

// Reset data: wipes this computer's save (cards, deck, gold, starter pack) after an in-page "Really reset?" confirm.
function showResetConfirm(on) {
  $('btn-reset').hidden = on;
  $('reset-confirm').hidden = !on;
  if (on) $('btn-reset-no').focus();
}
function resetData() {
  if (typeof onlineForget === 'function') onlineForget();   // v0.56 (user): your name goes too (v0.70: and everything online with it, online.js)
  try { localStorage.removeItem('rogue.coopName'); } catch (err) { /* no storage */ }   // (co-op's copy of the name)
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
$('btn-loadout-back').addEventListener('click', () => (NET.on && !NET.run ? backFromLoadout() : goMain()));   // from a co-op room: back to it
$('btn-loadout-test').addEventListener('click', startLoadoutTest);
$('btn-main-back').addEventListener('click', () => showScreen('scr-title'));
$('btn-play').addEventListener('click', showOverview);   // v0.56 (user): your loadout first

/* ---------- Start: your loadout, before the run (v0.56, user) ---------- */
// Both decks, each card with its copies and the combos those copies reach (its passive at ×3 or so, its ult at ×7).
// Fight goes on to the deck preview and the arena; Edit loadout to the deck builder.
function showOverview() {
  renderOverview();
  showScreen('scr-overview');
  fitOverview();
  if (!$('btn-ov-go').disabled) $('btn-ov-go').focus();
}
// v0.70 (user: "auto scale this, it's pretty long when lots of cards are in"): the rows shrink step by step until the
// whole screen fits without scrolling (style.css .ov[data-fit]): 1 slimmer, 2 the combos beside the name, 3 two
// columns a deck, 4 two columns and smaller still. Past that it scrolls as before.
const OV_FITS = 4;
function fitOverview() {
  if (current !== 'scr-overview') return;
  const ov = $('ov'), box = menuEl;
  for (let f = 0; f <= OV_FITS; f++) {
    ov.dataset.fit = f;
    if (box.scrollHeight <= box.clientHeight + 1) return;
  }
}
addEventListener('resize', () => requestAnimationFrame(fitOverview));
function renderOverview() {
  const probs = deckProblems();
  // (v0.63: a deck Wild doubles says so, and as how many decks it plays)
  const tabs = ['ranged', 'melee'];
  $('ov').classList.remove('is-three');
  $('ov').innerHTML = tabs.map((tab, i) => {
    const kind = tab, map = save.equipped, ids = CARD_IDS.filter(id => kindOf(id) === kind && map[id]);
    const on = deckOn(tab), total = ids.reduce((n, id) => n + map[id], 0), two = on && wildOn() && wildKindNow() === tab;
    const rows = ids.map((id, j) => {
      const n = map[id], t = COMBOS[id] || {}, passive = Object.keys(t).map(Number).filter(x => x !== 7).sort((a, b) => a - b)[0];
      const tags = (passive && n >= passive ? `<i>×${passive} ${t[passive].name}</i>` : '') + (t[7] && n >= 7 ? `<i class="is-ult">×7 ${t[7].name}</i>` : '');
      return `<li style="--c: var(--${id}); --rc: var(--r-${CARDS[id].rarity}); --j: ${j}">`
        // (v0.66, user: "remove icons make a preview of the card art on those list rectangles instead": its picture
        // fills the row's right side and fades into it, its glyph if it has none)
        + `<span class="ov-art" aria-hidden="true">${CARD_PICS.has(id) ? cardPic(id, 'ov-pic') : cardGlyph(id, 'ov-glyph')}</span>`
        + `<span class="ov-name">${CARDS[id].name}${cardTier(id) > 1 ? ` <span class="drow-tier">${TIER_ROMAN[cardTier(id)]}</span>` : ''}</span><span class="ov-tags">${tags}</span><b>×${n}</b></li>`;
    }).join('');
    return `<section class="ov-deck${on ? '' : ' is-off'}${two ? ' is-wild' : ''}" style="--i: ${i}"><h3>${kind === 'ranged' ? 'Ranged' : 'Melee'}${two ? ' <small>Wild · 2 decks</small>' : ''} <span>${!on ? 'Off' : `${total} card${total === 1 ? '' : 's'}`}</span></h3>`
      + (ids.length ? `<ol>${rows}</ol>` : '<p class="sub small">Empty</p>') + '</section>';
  }).join('');
  $('ov-warn').hidden = !probs.length;
  $('ov-warn').textContent = probs.join(' ');
  $('btn-ov-go').disabled = !!probs.length;
}
$('btn-ov-go').addEventListener('click', startPreview);
$('btn-ov-back').addEventListener('click', goMain);
$('btn-ov-edit').addEventListener('click', () => { renderLoadout(); showScreen('scr-loadout'); });
$('scr-preview').addEventListener('click', enterArena);   // click to skip the wait

// The pack's page, on to the pack before or after it in the store: the pack spins a turn and a quarter, the page swaps
// to the new pack while it's edge on, and the new one spins on round to face you.
let pvSpinning = false;
function packViewStep(d) {
  if (pvSpinning) return;
  const ks = STORE_PACKS, k = ks[(ks.indexOf(viewing) + d + ks.length) % ks.length], s = d < 0 ? -1 : 1;
  const go = () => { viewing = k; viewCard = ownCards(k)[0] || PACKS[k].cards[0]; renderPackView(); };
  const art = $('pv').querySelector('.pv-head .pack-art');
  if (!art || reducedMotion) { go(); return; }
  pvSpinning = true;
  art.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${s * 450}deg) scale(.9)` }], { duration: 260, easing: 'cubic-bezier(.5, 0, .9, .5)' }).finished.then(() => {
    go();
    $('pv').querySelector('.pv-head .pack-art')?.animate([{ transform: `rotateY(${s * 90}deg) scale(.9)` }, { transform: `rotateY(${s * 360}deg) scale(1)` }],
      { duration: 420, easing: 'cubic-bezier(.15, .6, .3, 1)' });
  }, go).finally(() => { pvSpinning = false; });
}
function onMenuKey(e) {
  if (current === 'scr-preview' && (e.code === 'Enter' || e.code === 'Space')) { enterArena(); e.preventDefault(); }
  if (current === 'scr-pack' && e.code === 'Space') { if (opening) ripFast(); else if (!e.repeat) openStarterPack(); e.preventDefault(); }   // (Space mid-rip: done)
  if (current === 'scr-reveal' && e.code === 'Space') {
    if (!$('btn-reveal-all').hidden) { if (!e.repeat || revealRate > 1) speedReveal(); }      // faster, then the rest at once (held: straight on)
    else if (!$('btn-reveal-next').hidden) { if (!e.repeat) nextRevealPage(); }              // a finished page: the next one
    else if (!$('btn-reveal-done').hidden && !e.repeat) revealAfter?.();                     // … or Continue
    e.preventDefault();
    return;
  }
  if ($('news-dialog').open) return;                        // (the changelog closes itself)
  // v0.60 (user): on a pack's page ← → switch pack (it spins into the next one, like Test pack's), and ↑ ↓ go through
  // its weapons
  const side = { ArrowLeft: -1, ArrowRight: 1 }[e.code], step = { ArrowUp: -1, ArrowDown: 1 }[e.code];
  if (current === 'scr-packview' && side && !buying) { if (!e.repeat) packViewStep(side); e.preventDefault(); return; }
  if (current === 'scr-packview' && step && !buying) {
    const ids = [...$('pv').querySelectorAll('.pv-row')].map(b => b.dataset.card), i = ids.indexOf(viewCard);
    showViewCard(ids[Math.max(0, Math.min(ids.length - 1, i + step))]);
    $('pv').querySelector(`.pv-tab[data-card="${viewCard}"]`)?.focus({ preventScroll: true });
    $('pv').querySelector(`.pv-tab[data-card="${viewCard}"]`)?.scrollIntoView({ block: 'nearest' });
    e.preventDefault();
    return;
  }
  if (e.code === 'Escape') {
    if (current === 'scr-loadout' && !$('cview').hidden) { closeCardView(); return; }   // (the card view first)
    if (current === 'scr-name') showScreen('scr-title');
    else if (current === 'scr-settings') settingsBack();
    else if (current === 'scr-overview') goMain();
    else if (current === 'scr-loadout' && NET.on && !NET.run) backFromLoadout();
    else if (current === 'scr-loadout' || current === 'scr-store') goMain();
    else if (current === 'scr-packview' && !buying) { renderStore(); showScreen('scr-store'); }
    else if (current === 'scr-main') showScreen('scr-title');
    else if (current === 'scr-coop') { if (NET.on && !NET.run) coopLeave(); goMain(); }
  }
}

// Start: a fresh run from the equipped deck. Show its first sequence in firing order,
// then fly the cards into the deck spot.
function startPreview() {
  if (deckProblems().length) return;
  resetRun();
  showScreen('scr-preview');
  // v0.53: both decks' first sequences, melee on top as in the run, each row flying to its own tray
  previewEl.innerHTML = previewRows().map(r => r.seq.map(previewCard).join('')).join('<li class="preview-break" aria-hidden="true"></li>');
  $('p-title').textContent = deck && mdeck ? 'Your decks' : mdeck ? 'Your melee deck' : 'Your deck';   // (the Wild deck, when it plays, on top: v0.62)
  fitNames(previewEl);
  if (animOk) {
    [...previewEl.querySelectorAll('.mcard')].forEach((li, i) => li.animate(
      [{ transform: 'translateY(-16px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 260, delay: 120 + i * 60, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' }));
    $('go-bar').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: PREVIEW_MS, fill: 'forwards' });
  }
  goTimer = setTimeout(enterArena, PREVIEW_MS);
}

const previewRows = () => [wdeck && { seq: wdeck.sequence, tray: $('wtray') }, mdeck && { seq: mdeck.sequence, tray: $('mtray') }, deck && { seq: deck.sequence, tray: trayEl }].filter(Boolean);
// A preview card (v0.53, user: icons, not words, so it can turn into its bar in the run): the weapon's icon in its
// colour, and a fill of that colour waiting to cover it (enterArena). v0.66 (user: "on start stage just use the cards
// instead of icons"): the card itself, its face shrunk down (cardface.js), its place in the order on a badge over it.
function previewCard(c, i) {
  if (c === null) return mcard(null, { idx: i });
  return `<li class="mcard pv-card" data-card="${c}" style="--c: var(--${c}); --rc: var(--r-${CARDS[c].rarity})" aria-label="${i + 1}: ${CARDS[c].name}">`
    + cardFace(c, { tier: cardTier(c) }) + `<span class="card-idx">${i + 1}</span>`
    + `<span class="pv-fill" aria-hidden="true"></span></li>`;
}
const PV_FILL = 200, PV_FILL_STEP = 22, PV_FLY = 560, PV_FLY_STEP = 25;   // ms: the colour covering each card, then the flight
function enterArena() {
  if (!game.inMenu || entering || current !== 'scr-preview') return;
  entering = true;
  clearTimeout(goTimer);
  renderTray(false);
  if (!animOk) return arrive();

  // Seamless (user): each card fills up with its colour, one after another, then flies down and shrinks into its bar
  // in the deck rows while the scrim clears, so it lands looking like the bar it becomes.
  const cards = [...previewEl.querySelectorAll('.mcard')];
  const targets = previewRows().flatMap(r => [...r.tray.children]).map(li => li.getBoundingClientRect());
  const filled = PV_FILL + (cards.length - 1) * PV_FILL_STEP;
  cards.forEach((el, i) => {
    el.getAnimations().forEach(a => a.finish());
    const fill = el.querySelector('.pv-fill');
    if (fill) fill.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: PV_FILL, delay: i * PV_FILL_STEP, easing: 'ease-out', fill: 'forwards' });
    const a = el.getBoundingClientRect(), b = targets[i];
    el.animate([
      { transform: 'none', borderRadius: getComputedStyle(el).borderRadius },
      { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`, borderRadius: '3px' },
    ], { duration: PV_FLY, delay: filled + i * PV_FLY_STEP, easing: 'cubic-bezier(.6, 0, .2, 1)', fill: 'forwards' });
  });
  for (const el of $('scr-preview').querySelectorAll('.fade')) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  menuEl.animate([{ backgroundColor: getComputedStyle(menuEl).backgroundColor }, { backgroundColor: 'rgba(0, 0, 0, 0)' }],
    { duration: 700, delay: filled, easing: 'ease-in', fill: 'forwards' });
  setTimeout(arrive, filled + PV_FLY + (cards.length - 1) * PV_FLY_STEP + 20);
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
    enemies: [], started: false, spawnTimer: 0, cooldown: ATTACK_INTERVAL, mcool: ATTACK_INTERVAL, mcdTotal: ATTACK_INTERVAL, mprimed: true,
    wcool: ATTACK_INTERVAL * WILD_OFFSET, wcdTotal: ATTACK_INTERVAL, wprimed: true, bflash: 0, bshield: null, melees: [], zones: [], kicks: [], sinfx: [], sguard: null,
    projectiles: [], particles: [], rings: [], floaters: [], orbs: [], muzzle: null, shake: 0, kills: 0, over: false,
    level: 1, xp: 0, cdTotal: ATTACK_INTERVAL, aug: new Map(), echoes: [], upQueue: [], mines: [], potions: [], diamonds: [], won: [], timers: [], shield: 0, shieldHit: 0,
    beams: [], sweeps: [], swooshes: [], practice: null, goldBonus: 0,
    sprays: [], trails: [], soakT: 0, soakCard: null, soakSweep: 0, soakDrop: 0, debris: [], boulders: [], eshots: [], mrocks: [], wheelSpins: 0, wheelGold: 0,
    maxHit: 0, cleared: null, runMark: null,   // (v0.69: the highest hit, MAKORA's run-cleared screen, where this run of the loop began)
    tballs: [], tshield: null, twild: 0, tfx: [], tbSync: 0,   // the T-Balls (tballs.js)
  });
  resetStats();
  resetFlow();                            // the run's clock and its bar (flow.js)
  resetBoss();
  resetMakora();
  runClearPanel(false);
  setTimeout(m3dLoad, 1500);              // MAKORA in 3D (makora3d.js): three.js comes in early, quietly, once
  resetZoom();                            // (a boss fight's bigger arena: arena.js)
  resetSilica();
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
  if (NET.run) { coopLeave(); return; }            // co-op: leave the room first (it comes back here)
  const mid = !game.inMenu && !game.over && !game.practice && (deck || mdeck);
  if (mid && typeof onlineRun === 'function') onlineRun();   // a run you quit counts on the leaderboard too (v0.56)
  const g = (mid ? payGold(game.kills) : 0) + (game.over ? 0 : game.goldBonus || 0);
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

// The end-of-run screen's stats (v0.52, user): how long you lasted and how far you got along the run's bar, the
// bosses, and your best weapons by damage (co-op: the host counts everyone's hits; a guest sees the rest).
// v0.69: the same screen shows when you beat MAKORA (game.cleared): that run's stats, then the next run.
function renderRunStats() {
  const f = game.flow || { stage: 0, beaten: [] }, S = FLOW.stages[f.stage], run = f.run || 1, clr = game.cleared;
  const t = game.tally, num = n => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en');
  const mark = game.runMark || { t: 0, kills: 0, dealt: 0 };
  $('d-eyebrow').innerHTML = clr ? `<span class="run-badge">${runBadge(run)}</span> ${clr.final ? 'Every run cleared' : `Run ${run} cleared`}` : `<span class="run-badge">${runBadge(run)}</span> Run over`;
  $('d-title').textContent = clr ? (clr.final ? 'The wheel is complete' : 'MAKORA defeated') : 'Defeated';
  $('d-where').textContent = clr ? (clr.final ? `You beat MAKORA ${run} times. Its wheel has turned all the way round.`
    : `Its wheel turned. Run ${run + 1} is next: back to stage 1, and everything is tougher.`)
    : f.state === 'swarm' || f.state === 'sweep' ? `Run ${run} · fell in stage ${f.stage + 1} of ${FLOW.stages.length}, before ${S.name}`
    : `Run ${run} · fell fighting ${S.name}`;
  const dealt = t ? Object.values(t.dealt).reduce((a, b) => a + b, 0) : 0;
  const rows = run > 1 || clr
    ? [['This run', clockText((game.runT || 0) - mark.t)], ['Total time', clockText(game.runT || 0)], ['Level', game.level], ['Defeated', num(game.kills - mark.kills)]]
    : [['Time', clockText(game.runT || 0)], ['Level', game.level], ['Defeated', num(game.kills)]];
  if (t && !(NET.run && NET.guest)) rows.push(['Damage dealt', num(dealt - (run > 1 || clr ? mark.dealt : 0))], ['Damage taken', num(t.taken)]);
  if (game.maxHit) rows.push(['Highest hit', num(game.maxHit)]);
  if (game.wheelSpins) rows.push(['Wheel', `${game.wheelSpins} of ${MAKORA.last} · +${game.wheelGold || 0} gold`]);   // MAKORA's (v0.55, user; runs since v0.69)
  if (rootEl.classList.contains('devtools')) rows.push(['Sequences', (deck || mdeck)?.seqNo || 0]);   // (the test version only, like the HUD's)
  $('d-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('d-bosses').innerHTML = FLOW.stages.map((B, i) => {
    const done = f.beaten.includes(B.boss), at = i === f.stage && f.state === 'boss' && !done;
    return `<li class="${done ? 'is-done' : at ? 'is-at' : ''}" style="--c:var(--${RB_COL[i]})"><i aria-hidden="true"></i>${B.name}<span class="sr">${done ? ' beaten' : at ? ' fought' : ' not reached'}</span></li>`;
  }).join('');
  const top = t && !(NET.run && NET.guest) ? Object.entries(t.dealt).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  $('d-weapons-box').hidden = !top.length;
  $('d-weapons').innerHTML = top.map(([id, n]) => `<li style="--c:var(--${CARDS[id] ? id : 'saber'})"><span>${CARDS[id] ? CARDS[id].name : id === 'deflect' ? 'Deflect' : id}</span>`
    + `<b>${num(n)}</b><i style="--w:${n / top[0][1]}"></i></li>`).join('');
}
// The same screen after MAKORA (makora.js showRunCleared): Continue to the next run, or end the run here and take
// the gold. The last run (MAKORA.last) only ends. A co-op guest waits for the host.
function runClearPanel(show) {
  const clr = show && game.cleared, el = $('defeat');
  el.classList.toggle('is-clear', !!clr);
  $('btn-next-run').hidden = !clr || clr.final || (NET.run && NET.guest);
  $('btn-end-run').hidden = !clr || (NET.run && NET.guest);
  $('btn-end-run').textContent = clr?.final ? 'Finish' : 'End run here';
  $('btn-retry').hidden = !!clr || (NET.run && NET.guest);
  $('btn-defeat-menu').hidden = !!clr;
  $('btn-room').hidden = !!clr || !(NET.run && NET.host);
  $('d-wait').hidden = !(clr && NET.run && NET.guest);
  if (!clr) { if (game.over) return; el.hidden = true; return; }
  const bonus = game.goldBonus || 0;
  $('d-gold').innerHTML = `<span class="coin" aria-hidden="true"></span><b>+${bonus} gold</b> in bonuses so far · kills pay out when the run ends`;
  el.hidden = false;
  keys.clear();
  if (clr.final) SFX.diamond(); else SFX.upgrade(4);
  el.focus();
}
$('btn-next-run').addEventListener('click', () => { nextRun(); document.activeElement?.blur(); });
$('btn-end-run').addEventListener('click', () => {
  if (NET.run && NET.host) { coopLeave(); goMain(); return; }   // (co-op: the room ends here)
  runClearPanel(false);
  exitToTitle();
});

// HP ran out: stop the run, show how it went, and offer another go, or the main menu.
function defeat() {
  game.over = true;
  SFX.defeat();
  keys.clear();
  renderRunStats();
  if (typeof onlineRun === 'function') onlineRun();     // your best run, on the leaderboard (v0.56, online.js)
  const g = payGold(game.kills);                   // 1 gold per 15 defeated (user, v0.43; 50 before)
  const bonus = game.goldBonus || 0;
  $('d-gold').innerHTML = `<span class="coin" aria-hidden="true"></span><b>+${g + bonus} gold</b> · ${g} for kills (1 per ${GOLD_PER})${bonus ? ` + ${bonus} bonus` : ''} · you have ${save.gold}`;
  if (g) SFX.coin();
  $('defeat').hidden = false;
  // co-op: only the host can start the next run (everyone comes along); the others wait for it
  game.cleared = null; $('defeat').classList.remove('is-clear'); $('btn-next-run').hidden = $('btn-end-run').hidden = true; $('btn-defeat-menu').hidden = false;
  $('btn-retry').hidden = NET.run && NET.guest;
  $('btn-retry').textContent = NET.run ? 'Play again together' : 'Retry';
  $('btn-room').hidden = !(NET.run && NET.host);   // co-op: or back to the room, to change decks (v0.46)
  $('d-wait').hidden = !(NET.run && NET.guest);
  if (NET.run) { closeRevive(); closePick(); }
  $('defeat').focus();                             // v0.57 (user): not on Retry, so the Space you were dashing with doesn't start a new run (Tab reaches the buttons)
}
$('btn-retry').addEventListener('click', () => {
  if (NET.run && NET.host) { NET.run = false; coopStart(); return; }   // co-op: again, with the same friends
  resetRun();
  last = performance.now();
  document.activeElement?.blur();
});
$('btn-defeat-menu').addEventListener('click', () => {
  if (NET.run) { coopLeave(); goMain(); return; }
  resetRun();
  game.inMenu = true;
  menuEl.hidden = false;
  goMain();
});
