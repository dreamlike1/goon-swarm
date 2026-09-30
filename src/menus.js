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
  { tag: 'Store', text: 'New: the Silica pack in the store — three new Rare weapons to add to your roster.' },
  { tag: 'Weapons', text: 'Say hello to the Gatling Gun, Cryo Magus and Druid. Unlock the pack and try them out.' },
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

/* ---------- card packs: the look, and ripping one open ---------- */
// Every pack (the starter and the store's) is drawn the same way: a foil pack with a crimped top strip that tears off.
const PACK_EMBLEM = {
  starter: '<path d="M12 3c2.5 2 3.5 5 3.5 8v8h-7v-8c0-3 1-6 3.5-8z"/><path d="M8.5 15h7"/>',
  artillery: '<path d="M3.5 13.5l13-6 2.2 4.4-13 6z"/><circle cx="8.5" cy="17.5" r="3"/><path d="M8.5 17.5h.01M19.5 8l1.5-.8M19.8 10.6l1.7.2"/>',
  silica: '<path d="M12 2.5l7.5 4.3v8.6L12 19.8l-7.5-4.4V6.8z"/><path d="M12 2.5v17.3M4.5 6.8l15 8.6M19.5 6.8l-15 8.6"/>',   // a crystal
  magus: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  powerwash: '<path d="M4 13h8l4-4"/><path d="M12 13l4 4"/><circle cx="17" cy="6.5" r="1"/><circle cx="19.5" cy="9" r=".8"/><circle cx="20.5" cy="5" r=".7"/>',
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
  const k = viewing, pk = PACKS[k], odds = pk.fixed ? {} : cardOdds(pk), afford = save.gold >= pk.price;
  $('pv').innerHTML = `<div class="pv-head">${packArt(k)}<div class="pv-info">`
    + `<h2 id="pv-title">${pk.name}</h2>`
    + (pk.fixed ? `<p class="sub small">${pk.size} cards, nothing rolled: you get ${Object.values(pk.fixed)[0]} of each weapon.</p>`
      : `<p class="sub small">${pk.size} cards, each rolled on its own (repeats can happen). Drop rate per card:</p>`)
    + `<div class="pv-tabs" role="tablist" aria-label="Weapons in this pack">`
    + pk.cards.map(id => `<button type="button" role="tab" class="pv-tab" data-card="${id}" aria-selected="${id === viewCard}" style="--c: var(--${id}); --rc: var(--r-${CARDS[id].rarity})">`
      + `<span class="pv-tab-name">${CARDS[id].name}</span><span class="pv-tab-rar">${RARITY_NAME[CARDS[id].rarity]}</span><b>${pk.fixed ? `×${pk.fixed[id]}` : `${(odds[id] * 100).toFixed(1)}%`}</b></button>`).join('')
    + `</div>`
    + `<div class="pv-buy"><button class="start" type="button" id="btn-buy"${afford ? '' : ' disabled'}>Buy <span class="coin" aria-hidden="true"></span>${pk.price}</button>`
    + `<button type="button" class="pv-testpack" id="btn-testpack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${CARD_ICON.sniper}</svg>Test pack</button>`
    + `<span class="sub small">${afford ? `You have ${save.gold} gold` : `You have ${save.gold}: ${pk.price - save.gold} more to go`}</span></div>`
    + `</div></div>`
    + `<div class="pv-detail" role="tabpanel">${weaponDetail(viewCard)}</div>`;
}
function weaponDetail(id) {
  const k = CARDS[id], t = COMBOS[id] || {}, passive = Object.keys(t).map(Number).sort((a, b) => a - b).find(n => n !== 7);
  return `<div class="pv-detail-head"><p class="type-name" style="color: var(--${id})">${k.name}</p>`
    + `<p class="type-stats">${k.dmgNote || `${k.dmg} dmg`} · ${k.range ? `range ${k.range}` : 'drops on its own'}</p>`
    + `<button type="button" class="pv-test" data-card="${id}" style="--c: var(--${id})">Test ${k.name}</button></div>`
    + `<p class="type-desc">${k.desc}</p>`
    + (passive ? `<p class="type-combo"><b>Passive ×${passive}</b> <i>${t[passive].name}</i> ${t[passive].does}</p>` : '')
    + (t[7] ? `<p class="type-combo"><b>Ult ×7</b> <i>${t[7].name}</i> ${t[7].does}</p>` : '')
    + (id === 'mine' ? `<p class="type-combo"><b>Chain</b> A blast sets off any mine inside it.</p>` : '');
}
$('pv').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.id === 'btn-buy') buyViewed();
  else if (b.id === 'btn-testpack') startPractice(viewing, viewCard);   // v0.33 (user): a clear way into the pack's test
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
  const extra = res.where.filter(w => w.to === 'max').length;
  startReveal(res.ids, { eyebrow: PACKS[k].name, title: 'New cards',
    note: `They're in your collection: add them to your deck in Loadout.${extra ? ` ${extra} didn't fit: you already have ${OWN_LIMIT} of ${extra === 1 ? 'that card' : 'those cards'}.` : ''}`,
    after: () => { renderPackView(); showScreen('scr-packview'); } });
}

/* ---------- test mode: a pack's weapons against still targets ---------- */
// No swarm and no deck: you fire each attack yourself (1 Single, 2 Passive, 3 Ult). Three test dummies stand in
// range (a main one and two behind, so bounces and blasts show). They can't die, move or hurt you.
function startPractice(k, card, extra) {
  resetRun();
  game.practice = { pack: k, card, dummies: [], dmg: 0, ...extra };
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
  return loadout ? CARD_IDS.filter(id => save.equipped[id] > 0) : PACKS[game.practice.pack].cards;
}
const prAuto = () => game.practice?.card === DECK_TAB;
// The three targets sit in the middle of the open space under the panel (v0.33, user: centre them), and you stand to
// their left, inside the weapon's range. The loadout test's Whole deck puts them inside every card's range, so no card
// in the deck ever waits.
function placeDummies() {
  const pr = game.practice, p = game.player;
  const reach = pr.card === DECK_TAB ? Math.min(...prCards().map(rangeOf)) : rangeOf(pr.card);
  const top = Math.min(H * 0.5, ($('practice').getBoundingClientRect().bottom || 0) + 20), cy = (top + H) / 2, cx = W / 2 + 30;
  const d = Math.max(90, Math.min(reach * 0.75, cx - 30 - 60));   // how far left of the main target you stand
  p.x = cx - 30 - d; p.y = cy; p.kx = p.ky = 0;
  const mk = (x, y, r) => ({ dummy: true, type: 'dummy', shape: 'dummy', x, y, r, hp: 1e9, maxHp: 1e9, vx: 0, vy: 0, kx: 0, ky: 0, speed: 0, dmg: 0, hit: 0, born: 1 });
  pr.dummies = [mk(cx - 30, cy, 18), mk(cx + 30, cy - 70, 13), mk(cx + 30, cy + 70, 13)];
  for (const e of pr.dummies) clampTo(e, e.r);
  game.enemies = pr.dummies.slice();
  game.mines = []; game.projectiles = []; game.timers = []; game.sweeps = [];
  game.sprays = []; game.trails = []; game.soakT = 0;
  resetSilica();
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
const done = anim => (anim.finished || Promise.resolve()).catch(() => {});   // a cancelled animation just ends the wait (no `finished`: an older browser)
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

/* ---------- loadout: the deck builder (v0.31, user: like Legends of Runeterra's) ---------- */
// Left: your deck, one row per card (damage, name, copies). Right: every card you own, with how many are still free.
// Click a card, or drag it onto the deck, to add one; click a deck row, or drag it off the deck, to take one out.
// Auto builds a deck from your best cards; Clear empties it.
const CARD_ICON = {                                  // a small picture of each weapon's shot, for the collection
  bullet: '<path d="M8 16l8-8M13 6l5 5-6 3-2-2z"/><path d="M6 18l2-2"/>',
  laser: '<path d="M3 12h4l2-4 3 8 2-4h7"/>',
  arcane: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="2 3"/>',
  cannon: '<circle cx="12" cy="13" r="6"/><path d="M15 6l3-3M17 8l3-1"/>',
  shuriken: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/><circle cx="12" cy="12" r="1.5"/>',
  spaceimpact: '<path d="M5 19l3-6 8-8 3 3-8 8z"/><path d="M8 13l3 3M5 19l-1 1"/>',
  mine: '<circle cx="12" cy="14" r="6"/><path d="M12 8V4M9 5h6M6 14H3M21 14h-3"/>',
  firebolt: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z"/>',
  sniper: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="1"/>',
  missiles: '<path d="M4 18c4-1 7-4 9-9M13 9l1-4 3 3z"/><path d="M8 20c4-1 8-3 11-8M19 12l1-4 2 3z"/>',
  gatling: '<rect x="3" y="8" width="11" height="8" rx="2"/><path d="M14 9.5h7M14 12h7M14 14.5h7M7 16v4"/>',
  cryo: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  shifter: '<circle cx="12" cy="15" r="4"/><circle cx="6" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="10" r="2"/>',
};
const RARITY_RANK = Object.fromEntries(RARITIES.map((r, i) => [r, i]));
const freeCopies = id => (save.owned[id] || 0) - (save.equipped[id] || 0);                // owned and not in the deck
const canEquip = id => (save.equipped[id] || 0) < Math.min(COPY_LIMIT, save.owned[id] || 0);   // a deck takes up to 7 of each
function renderLoadout() {
  const cards = equippedCards(), full = cards.length >= DECK_LIMIT;
  $('deck-n').textContent = cards.length;
  $('deck-max').textContent = DECK_LIMIT;
  $('deck-panel').classList.toggle('is-full', full);
  const inDeck = CARD_IDS.filter(id => save.equipped[id] > 0);
  $('deck-empty').hidden = inDeck.length > 0;
  $('deck-list').innerHTML = inDeck.map(id => {
    const k = CARDS[id];
    return `<li><button type="button" class="drow" data-id="${id}" style="--c: var(--${id}); --rc: var(--r-${k.rarity})" aria-label="${k.name}, ${save.equipped[id]} in the deck. Take one out">`
      + `<span class="drow-dmg">${k.dmg}</span><span class="drow-name">${k.name}</span><span class="drow-n">${save.equipped[id]}</span></button></li>`;
  }).join('');
  $('coll').innerHTML = CARD_IDS.filter(id => save.owned[id]).map(id => {
    const k = CARDS[id], free = freeCopies(id), t = COMBOS[id] || {}, sizes = Object.keys(t).map(Number).sort((a, b) => a - b);
    const can = canEquip(id) && !full;
    return `<button type="button" role="listitem" class="ccard${canEquip(id) ? '' : ' is-used'}" data-id="${id}" style="--c: var(--${id}); --rc: var(--r-${k.rarity})"`
      + ` title="${k.desc}" aria-label="${k.name}, ${free} free of ${save.owned[id]} owned.${can ? ' Add one to the deck' : ''}"${can ? '' : ' aria-disabled="true"'}>`
      + `<span class="ccard-dmg" title="Damage">${k.dmg}</span><span class="ccard-free" title="Free copies">×${Math.max(0, free)}</span>`
      + `<svg class="ccard-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CARD_ICON[id] || ''}</svg>`
      + `<span class="ccard-name">${k.name}</span><span class="ccard-rar">${RARITY_NAME[k.rarity]}</span>`
      + `<span class="ccard-stats">${k.range ? `range ${k.range}` : 'no range'}${sizes.length ? ` · combos ${sizes.map(x => `×${x}`).join(' ')}` : ''}</span></button>`;
  }).join('');
  $('btn-clear').disabled = !cards.length;
  $('btn-auto').disabled = !CARD_IDS.some(id => save.owned[id]);
  $('btn-play').disabled = $('btn-loadout-test').disabled = deckProblems().length > 0;
}
// Add (d = 1) or take out (d = -1) one copy. Returns false if it can't.
function changeDeck(id, d) {
  const n = (save.equipped[id] || 0) + d;
  if (n < 0 || n > Math.min(COPY_LIMIT, save.owned[id] || 0) || (d > 0 && equippedCards().length >= DECK_LIMIT)) return false;
  if (n) save.equipped[id] = n; else delete save.equipped[id];
  writeSave();
  renderLoadout();
  const row = $('deck-list').querySelector(`.drow[data-id="${id}"]`);   // a quick flash on the row that changed
  if (row && animOk) row.animate([{ filter: 'brightness(1.8)', transform: 'scale(1.03)' }, { filter: 'none', transform: 'none' }], { duration: 260, easing: 'ease-out' });
  (d > 0 ? SFX.click : SFX.back)();
  return true;
}
// Why a card can't go in, said under the heading for a moment.
let hintTimer = 0;
function builderHint(text) {
  const h = $('loadout-hint');
  h.textContent = text; h.classList.add('is-warn');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { h.classList.remove('is-warn'); h.textContent = 'Click or drag a card to add it. Click a deck row, or drag it out, to take one off.'; }, 1800);
}
function addCard(id) {
  if (changeDeck(id, 1)) return;
  const own = save.owned[id] || 0, name = CARDS[id].name;
  builderHint(equippedCards().length >= DECK_LIMIT ? `The deck is full: ${DECK_LIMIT} cards at most.`
    : (save.equipped[id] || 0) >= COPY_LIMIT ? `${COPY_LIMIT} ${name} is the most a deck can hold.`
    : `All ${own} of your ${name} cards are in the deck. Get more in the Store.`);
}
// Auto: your best cards first (rarest, then hardest-hitting), up to 7 of each, until the deck is full.
function autoDeck() {
  const ids = CARD_IDS.filter(id => save.owned[id]).sort((a, b) => RARITY_RANK[CARDS[b].rarity] - RARITY_RANK[CARDS[a].rarity] || CARDS[b].dmg - CARDS[a].dmg);
  save.equipped = {};
  let left = DECK_LIMIT;
  for (const id of ids) {
    const n = Math.min(COPY_LIMIT, save.owned[id], left);
    if (n > 0) { save.equipped[id] = n; left -= n; }
  }
  writeSave(); renderLoadout(); SFX.confirm();
}

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
    drag.ghost.style.cssText = `--c: var(--${drag.id})`;
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
  if (c) addCard(c.dataset.id);
  else if (r) changeDeck(r.dataset.id, -1);
  else return;
  // keep the keyboard where it was after the re-render
  const again = $('builder').querySelector(`.${c ? 'ccard' : 'drow'}[data-id="${(c || r).dataset.id}"]`) || (r && $('deck-list').querySelector('.drow')) || $('coll').querySelector('.ccard');
  again?.focus({ preventScroll: true });
});
$('btn-auto').addEventListener('click', autoDeck);
$('btn-clear').addEventListener('click', () => { save.equipped = {}; writeSave(); renderLoadout(); SFX.back(); $('btn-auto').focus(); });

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
$('btn-loadout-back').addEventListener('click', () => (NET.on && !NET.run ? backFromLoadout() : goMain()));   // from a co-op room: back to it
$('btn-loadout-test').addEventListener('click', startLoadoutTest);
$('btn-main-back').addEventListener('click', () => showScreen('scr-title'));
$('btn-play').addEventListener('click', startPreview);
$('scr-preview').addEventListener('click', enterArena);   // click to skip the wait

function onMenuKey(e) {
  if (current === 'scr-preview' && (e.code === 'Enter' || e.code === 'Space')) { enterArena(); e.preventDefault(); }
  if (current === 'scr-pack' && e.code === 'Space' && !e.repeat) { openStarterPack(); e.preventDefault(); }
  if (current === 'scr-reveal' && e.code === 'Space' && !e.repeat && !$('btn-reveal-all').hidden) { speedReveal(); e.preventDefault(); }
  if (e.code === 'Escape') {
    if (current === 'scr-loadout' && NET.on && !NET.run) backFromLoadout();
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
    sprays: [], trails: [], soakT: 0, soakCard: null, soakSweep: 0, soakDrop: 0, debris: [], boulders: [], eshots: [],
  });
  resetStats();
  resetBoss();
  resetMakora();
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
  const g = payGold(game.kills);                   // 1 gold per 15 defeated (user, v0.43; 50 before)
  const bonus = game.goldBonus || 0;
  $('d-gold').innerHTML = `<span class="coin" aria-hidden="true"></span><b>+${g + bonus} gold</b> · ${g} for kills (1 per ${GOLD_PER})${bonus ? ` + ${bonus} bonus` : ''} · you have ${save.gold}`;
  if (g) SFX.coin();
  $('defeat').hidden = false;
  // co-op: only the host can start the next run (everyone comes along); the others wait for it
  $('btn-retry').hidden = NET.run && NET.guest;
  $('btn-retry').textContent = NET.run ? 'Play again together' : 'Try again';
  $('btn-room').hidden = !(NET.run && NET.host);   // co-op: or back to the room, to change decks (v0.46)
  $('d-wait').hidden = !(NET.run && NET.guest);
  if (NET.run) { closeRevive(); closePick(); }
  ($('btn-retry').hidden ? $('btn-defeat-menu') : $('btn-retry')).focus();
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
