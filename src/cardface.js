/* cardface.js — A weapon card's face (v0.58, the user's new card design): the R or M badge and the name across the
   top, the art in the middle (its colour blending into the card above and below), and at the bottom a big number
   (damage) beside a short description and the card's passive (×3) and ult (×7). The border is a metal in the card's
   rarity, shinier the rarer it is (style.css .cf). Used by the collection, the pack view and the pack reveal.
   The art: the weapon as a flat solid glyph, in ink, on its own colour (below). In the collection a red counter on the
   card's top right says how many copies are free to add. */
'use strict';

// Short lines for the card (the full description is still in CARDS[id].desc, shown in the pack view and tooltips).
const CARD_SHORT = {
  bullet: 'A white basic shot.',
  laser: 'A long zap that hits instantly.',
  cannon: 'A big, slow white cannonball. Hits hard.',
  shuriken: 'A spinning bolt that bounces to 2 more.',
  spaceimpact: 'A rocket that speeds up and pierces 1.',
  mine: 'Drops a mine that blasts everything nearby.',
  sniper: 'A super long, super fast shot.',
  missiles: '4 homing missiles that curve in.',
  gatling: 'A fast burst of 10 rounds.',
  cryo: 'Homing ice that leaves a slowing frost.',
  pressurewasher: 'A water jet that blasts enemies back.',
  soapgun: 'A bubble that pops into 2 more.',
  superwasher: 'Two jets spin round you, shoving enemies away.',
  knife: 'A basic stab at the nearest enemy.',
  punch: 'Two quick punches.',
  brickshot: 'A bouncing brick. A kill on its 2nd bounce shields you.',
  shotgun: '6 small pellets in a cone.',
  slap: 'Shoves enemies far away. Low damage.',
  grapeshot: 'A shell that bursts into 5 random shots.',
  flashbang: 'Blinds enemies where it lands: they stop, dazed.',
  rambo: 'Two short slices.',
  sonickick: 'Marks a foe; an astral kick hits it, sonic boom.',
  ironwill: 'A hex shield: blocks 3 hits, bursts when it breaks.',
  tempest: 'Slams the ground. Lightning strikes the cracks.',
  dragonkick: 'A fire dragon: half its HP, and it flies.',
  hammer: 'Strikes down: hits everything in a circle.',
  blowpipe: 'A dart that puts the enemy to sleep.',
  fistopheles: 'A flurry of 5 red astral punches.',
  enpassant: 'A random chess piece attacks its squares.',
  karishnikov: 'A burst into a cone. Only the muzzle shows.',
  twinflame: '2 light fire bolts, one pink, one red.',
  arcana: 'A diamond that marks: the next hit does more.',
  explomagus: 'A slow spark that explodes where it hits.',
  gravamagus: 'A laser swirl on the ground. Goes off in 1 s.',
  darkmagus: 'Dark energy that drains what it hits.',
  druidity: 'Whips a thorny vine across close enemies.',
  geartoss: 'A gear. Then a zap, and the enemy is confused.',
  tball: 'An orbiting ball with 5 random attacks.',
  tballm: 'An orbiting ball with 5 random moves.',
};
// The big number and the word under it, where plain damage would mislead.
// (v0.67 balance pass: the numbers follow cards.js, magus.js and chess.js)
const CARD_NUM = { gatling: ['5', '×10'], dragonkick: ['½', 'HP'],
  punch: ['4', '×2'], rambo: ['3', '×2'], shotgun: ['2', '×6'], grapeshot: ['4', '+5'], flashbang: ['–', 'dazes'],
  fistopheles: ['6', '×5'], karishnikov: ['5', '×5'], blowpipe: ['26', 'zzz'], enpassant: ['26+', 'dmg'],
  twinflame: ['5', '×2'], explomagus: ['4', 'blast'], gravamagus: ['4', 'in 1 s'], darkmagus: ['7', '+drain'], geartoss: ['8', '+zap'], ironwill: ['3', 'blocks'] };

// Each weapon's line icon (24 × 24), for the menus' buttons (Test pack, the test arena's weapon tabs).
const CARD_ICON = {                                  // a small picture of each weapon's shot, 24 × 24 line art
  bullet: '<path d="M8 16l8-8M13 6l5 5-6 3-2-2z"/><path d="M6 18l2-2"/>',
  laser: '<path d="M3 12h4l2-4 3 8 2-4h7"/>',
  cannon: '<circle cx="12" cy="13" r="6"/><path d="M15 6l3-3M17 8l3-1"/>',
  shuriken: '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/><circle cx="12" cy="12" r="1.5"/>',
  spaceimpact: '<path d="M5 19l3-6 8-8 3 3-8 8z"/><path d="M8 13l3 3M5 19l-1 1"/>',
  mine: '<circle cx="12" cy="14" r="6"/><path d="M12 8V4M9 5h6M6 14H3M21 14h-3"/>',
  sniper: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="1"/>',
  missiles: '<path d="M4 18c4-1 7-4 9-9M13 9l1-4 3 3z"/><path d="M8 20c4-1 8-3 11-8M19 12l1-4 2 3z"/>',
  gatling: '<rect x="3" y="8" width="11" height="8" rx="2"/><path d="M14 9.5h7M14 12h7M14 14.5h7M7 16v4"/>',
  cryo: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  geartoss: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="6"/>',
  knife: '<path d="M4 20l5-5"/><path d="M9 15l2 2 9-12-12 9z"/><path d="M6.5 15.5l2 2"/>',
  punch: '<path d="M7 11V8a2 2 0 014 0v1a2 2 0 014 0v1a2 2 0 014 0v4a6 6 0 01-6 6h-2a5 5 0 01-5-5v-2a2 2 0 012-2h1"/><path d="M10 14h3"/>',
  tball: '<circle cx="10" cy="13" r="5.5"/><path d="M4.6 12.2c3.6 1.5 7.2 1.5 10.8 0"/><path d="M16 7l4-4M17.5 10.5H21M13.5 5.5V2"/>',   // a ball, firing
  tballm: '<circle cx="12" cy="10" r="5"/><path d="M7 9.3c3.3 1.4 6.7 1.4 10 0"/><path d="M4 15.5a9.5 9.5 0 0016 0"/>',   // a ball, its shield
  pressurewasher: '<path d="M3 15h7l2-3h2"/><path d="M5 15v4h4"/><path d="M14 12l7-4M14 12l7 0M14 12l7 4"/>',
  soapgun: '<circle cx="9" cy="14" r="5"/><circle cx="17" cy="8" r="3"/><circle cx="18" cy="16" r="2"/><path d="M7 12a2 2 0 012-2"/>',
  sonickick: '<path d="M4 16c3-6 8-9 15-10"/><path d="M6 19c3-4 7-6 12-6.5"/><circle cx="19" cy="6" r="2"/>',
  ironwill: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  tempest: '<path d="M12 4v6M5 7l4 4M19 7l-4 4M3 14h5M16 14h5"/><path d="M5 19h14"/><circle cx="12" cy="14" r="2"/>',
  dragonkick: '<circle cx="8" cy="5" r="2"/><path d="M8 8l2 5 9-2"/><path d="M10 13l-4 3 2 5"/><path d="M8 9l-4 1"/>',
  brickshot: '<rect x="4" y="8" width="16" height="8" rx="1"/><path d="M4 12h16M10 8v4M15 12v4"/>',
  shotgun: '<path d="M3 13h11l2-2h5M3 13v3h4l1-3"/><path d="M18 7l3-2M19 10h3M18 14l3 2"/>',
  slap: '<path d="M7 20l-2-6V8a1.5 1.5 0 013 0v4V5a1.5 1.5 0 013 0v6V4.5a1.5 1.5 0 013 0V11V6a1.5 1.5 0 013 0v8c0 3-2 6-5 6z"/>',
  grapeshot: '<circle cx="12" cy="12" r="3"/><circle cx="6" cy="7" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="19" cy="16" r="1.5"/><circle cx="7" cy="18" r="1.5"/><circle cx="4" cy="12.5" r="1"/>',
  flashbang: '<rect x="7" y="9" width="10" height="11" rx="3"/><path d="M10 9V6h4v3M14 6l3-2"/><path d="M12 13v3"/>',
  rambo: '<path d="M4 20L16 8l3-4 1 1-4 3L8 20z"/><path d="M6 14l4 4"/>',
  hammer: '<rect x="3" y="4" width="11" height="6" rx="1" transform="rotate(-45 8.5 7)"/><path d="M11 11l9 9"/>',
  blowpipe: '<path d="M3 18l12-8"/><path d="M17 8.5l4-2.5-1.5 4.5z"/><path d="M13 3h3.5L13 6.5h3.5"/>',
  fistopheles: '<path d="M7 14v-3a2 2 0 014 0v1a2 2 0 014 0v1a2 2 0 014 0v2a5 5 0 01-5 5h-3a5 5 0 01-5-5"/><path d="M6 8L4.5 3 8 6M18 8l1.5-5L16 6"/>',
  karishnikov: '<path d="M2 11h9l2-1.5h7v2.5h-7l-1 1H7l-2 3H3z"/><path d="M11 13l1.5 4h2l-1-4"/><path d="M20 11h2"/>',
  enpassant: '<path d="M6 21h12M8 18h8c0-3-1-5 0-7 1.5-2 1-5-1.5-6.5L14 3l-1 1.6C9.5 5 7.5 7.5 6.5 10.5L8 11.5l3-1.5-2.5 3.5c-1 1.5-1 3-.5 4.5z"/>',
  twinflame: '<path d="M7 21a3.5 3.5 0 01-3.5-3.5c0-2.5 2-3.5 2.5-6.5 1.8 1.4 3 3.2 3 5.4"/><path d="M15 21a4.5 4.5 0 01-4.5-4.5c0-3 2.5-4.5 3-8.5 3 2 6 5 6 8.5A4.5 4.5 0 0115 21z"/>',
  arcana: '<path d="M12 2.5l6.5 9.5-6.5 9.5-6.5-9.5z"/><path d="M12 2.5V12l6.5 0"/>',
  explomagus: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19"/>',
  gravamagus: '<path d="M12 12a2.5 2.5 0 112.5 2.5A5 5 0 019.5 9.5 7.5 7.5 0 0117 4"/><path d="M12 12a2.5 2.5 0 11-2.5-2.5 5 5 0 015 5A7.5 7.5 0 017 20"/>',
  darkmagus: '<circle cx="12" cy="12" r="4.5"/><path d="M12 7.5c2.5-3 6.5-2.5 8 .5M16.5 12c3 2.5 2.5 6.5-.5 8M12 16.5c-2.5 3-6.5 2.5-8-.5M7.5 12c-3-2.5-2.5-6.5.5-8"/>',
  druidity: '<path d="M4.5 19.5C4.5 10.5 10.5 4.5 20 4c-.5 9.5-6 15.5-15.5 15.5z"/><path d="M4.5 19.5l9.5-9.5"/>',
  superwasher: '<path d="M12 4a8 8 0 018 8"/><path d="M12 20a8 8 0 01-8-8"/><path d="M20 12l-2-2M20 12l2-2M4 12l-2 2M4 12l2 2"/><circle cx="12" cy="12" r="2"/>',
};
/* ---------- the art (v0.58, user: "rework the design of the cards like" a set of solid icons): each weapon as a flat
   glyph, 24 × 24, one colour. Solid shapes with details cut out of them (each part is its own path, even-odd, so a
   hole inside a shape shows through) and small gaps between parts. On the cards it's in ink on the weapon's colour;
   the deck rows use it too. ---------- */
// (inside a function: the classic scripts share one global scope)
const CARD_GLYPH = (() => {
  const f = n => +n.toFixed(2);
  const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0z`;
  const rr = (x, y, w, h, r = 0) => (r ? `M${f(x + r)} ${y}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f(2 * r - w)}a${r} ${r} 0 0 1 ${-r} ${-r}v${f(2 * r - h)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    : `M${x} ${y}h${w}v${h}h${-w}z`);
  const poly = pts => `M${pts.map(p => p.join(' ')).join('L')}z`;
  const ell = (x, y, rx, ry) => `M${f(x - rx)} ${y}a${rx} ${ry} 0 1 0 ${f(2 * rx)} 0a${rx} ${ry} 0 1 0 ${f(-2 * rx)} 0z`;
  const star = (x, y, ro, ri, n, rot = -90) => poly(Array.from({ length: n * 2 }, (_, i) => {
    const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? ri : ro; return [f(x + Math.cos(a) * r), f(y + Math.sin(a) * r)];
  }));
  const spark = (x, y, s) => { const k = s * 0.22; return `M${x} ${f(y - s)}Q${f(x + k)} ${f(y - k)} ${f(x + s)} ${y}Q${f(x + k)} ${f(y + k)} ${x} ${f(y + s)}Q${f(x - k)} ${f(y + k)} ${f(x - s)} ${y}Q${f(x - k)} ${f(y - k)} ${x} ${f(y - s)}z`; };
  const drop = (x, y, s) => `M${x} ${f(y - s)}C${f(x + s * .9)} ${f(y - s * .1)} ${f(x + s * .8)} ${f(y + s * .9)} ${x} ${f(y + s * .9)}C${f(x - s * .8)} ${f(y + s * .9)} ${f(x - s * .9)} ${f(y - s * .1)} ${x} ${f(y - s)}z`;
  const P = (...d) => `<path fill-rule="evenodd" d="${d.join('')}"/>`;   // one part: its shape and the holes cut in it
  const G = (t, ...parts) => `<g transform="${t}">${parts.join('')}</g>`;
  return {
    bullet: () => G('rotate(40 12 12)', P('M9 9.2C9 4.6 10.4 2.4 12 1.2C13.6 2.4 15 4.6 15 9.2z', rr(10.3, 4.2, 1.1, 3.8, .55)),
      P(rr(9, 10.4, 6, 7.6, .5), rr(10.3, 11.6, 1.1, 5.2, .55)), P(rr(8, 19.2, 8, 2.6, .9))) + P(spark(4, 6, 2.2)),
    laser: () => P(rr(2, 6.5, 13, 7.5, 3.75), circ(6, 10.25, 1.7)) + P(rr(16, 7.6, 2, 5.3, .7)) + P(rr(19.2, 8.4, 1.8, 3.7, .6))
      + P(rr(22, 9.5, 2, 1.5, .75)) + P('M4.6 15h4.8l-1.6 6.6a1 1 0 0 1-1 .8H4.2a.8.8 0 0 1-.8-1z') + P(spark(20.5, 3.5, 2)),
    cannon: () => G('rotate(-32 12 12)', P(rr(2.4, 8.5, 14, 6.4, 3.2), rr(5, 10.3, 6, 1.2, .6)), P(rr(17.4, 7.6, 3, 8.2, .9)))
      + P(circ(7.4, 17.8, 4.2), circ(7.4, 17.8, 1.6)) + P(circ(20.2, 4.2, 2.6), circ(19.4, 3.4, .7)),
    shuriken: () => G('rotate(15 12 12)', P('M12 1L14.2 9.8L23 12L14.2 14.2L12 23L9.8 14.2L1 12L9.8 9.8z', circ(12, 12, 1.9))),
    spaceimpact: () => G('rotate(45 12 12)',
      P('M12 1C15.4 3.4 16 7.2 16 10.4V16H8V10.4C8 7.2 8.6 3.4 12 1z', circ(12, 9, 1.8)),
      P('M7 11.4V17.4L4.6 19.6V15.2z'), P('M17 11.4V17.4L19.4 19.6V15.2z'), P('M9.6 17.6H14.4L12 22.6z'))
      + P(spark(4, 5, 2)) + P(spark(20, 19, 1.6)),
    mine: () => P('M4.6 15.4A7.4 7.4 0 0 1 19.4 15.4z', rr(7.4, 10.2, 1.3, 3.4, .65)) + P(rr(10.4, 5.2, 3.2, 2.8, .7))
      + P(rr(2, 16.6, 20, 3.6, 1.8), circ(5.8, 18.4, .8), circ(18.2, 18.4, .8))
      + G('rotate(-35 6 4)', P(rr(5.3, 1.8, 1.4, 3.4, .7))) + G('rotate(35 18 4)', P(rr(17.3, 1.8, 1.4, 3.4, .7))),
    sniper: () => P(circ(12, 12, 8.4), circ(12, 12, 6.2)) + P(rr(11, .8, 2, 7, 1)) + P(rr(11, 16.2, 2, 7, 1))
      + P(rr(.8, 11, 7, 2, 1)) + P(rr(16.2, 11, 7, 2, 1)) + P(circ(12, 12, 1.7)),
    missiles: () => [[-5, -1], [1.6, 5.4]].map(([dx, dy]) => G(`translate(${dx} ${dy}) rotate(45 12 12)`,
      P('M12 5.4C14 6.8 14.4 9 14.4 10.8V15H9.6V10.8C9.6 9 10 6.8 12 5.4z', circ(12, 9.6, 1.1)), P('M10.4 15.8H13.6L12 19.2z'))).join('')
      + P(spark(4.6, 4.6, 2)) + P(spark(19.4, 19.4, 1.6)),
    gatling: () => P(rr(1.4, 6.4, 9.2, 10, 2.2), rr(3.4, 8.4, 4.4, 1.4, .7)) + P(rr(11.6, 7, 9.8, 2.2, 1.1)) + P(rr(11.6, 10.3, 11, 2.2, 1.1))
      + P(rr(11.6, 13.6, 9.8, 2.2, 1.1)) + P(rr(3, 17.4, 3.6, 5, 1.2)) + P(rr(4.8, 2.4, 1.8, 3.2, .9)) + P(rr(2.2, 1.6, 4.4, 1.8, .9)),
    cryo: () => [0, 60, 120].map(a => G(`rotate(${a} 12 12)`, P(rr(10.9, 1.4, 2.2, 21.2, 1.1)),
      P('M8.6 3.4L12 6.4L15.4 3.4L16.6 4.6L12 8.6L7.4 4.6z'), P('M8.6 20.6L12 17.6L15.4 20.6L16.6 19.4L12 15.4L7.4 19.4z'))).join('')
      + P(circ(12, 12, 3.4), circ(12, 12, 1.4)),
    pressurewasher: () => P(rr(1, 6.6, 11.4, 5.4, 2.2), rr(3, 8.6, 4.4, 1.3, .65)) + P(rr(13.2, 8.2, 5.6, 2.2, 1.1)) + P(rr(19.6, 6.8, 2.6, 5, .9))
      + P('M3.4 12.8H8.6L7.2 20.4a1 1 0 0 1-1 .8H3.2a.8.8 0 0 1-.8-1z') + P(drop(22, 2.6, 1.6)) + P(drop(21.6, 15.4, 1.6)) + P(drop(17.8, 17.6, 1.2)),
    soapgun: () => P(circ(9.4, 14, 7.2), circ(9.4, 14, 5.4), 'M5.6 13.2A4 4 0 0 1 9 9.8a.9.9 0 0 1 0 1.8a2.3 2.3 0 0 0-1.6 1.6a.9.9 0 0 1-1.8 0z')
      + P(circ(19, 5.6, 3.6), circ(19, 5.6, 2.2)) + P(circ(20, 16.2, 2.2)) + P(spark(4, 3.6, 1.8)),
    superwasher: () => P('M12 2.4A9.6 9.6 0 0 1 21.6 12H17.8A5.8 5.8 0 0 0 12 6.2z') + P('M12 21.6A9.6 9.6 0 0 1 2.4 12H6.2A5.8 5.8 0 0 0 12 17.8z')
      + P('M16.2 12H23.2L19.7 16.2z') + P('M7.8 12H.8L4.3 7.8z') + P(circ(12, 12, 2.4)) + P(drop(4.4, 2.8, 1.6)) + P(drop(19.6, 19.4, 1.6)),
    knife: () => G('rotate(45 12 12)', P('M12 .6L14.6 3.6V13.2H9.4V3.6z', rr(11.45, 3.8, 1.1, 8, .55)), P(rr(6.4, 14.2, 11.2, 2.4, 1.2)),
      P(rr(10.5, 17.4, 3, 3.8, .8)), P(circ(12, 22.6, 1.5))) + P(spark(4.6, 5, 2)),
    punch: () => P(rr(3.6, 4.6, 16.8, 13.4, 4.4), rr(7.6, 4.6, 1, 4.2, .5), rr(11.5, 4.6, 1, 4.2, .5), rr(15.4, 4.6, 1, 4.2, .5), rr(3.6, 11.8, 10.6, 1.3, .65))
      + P(rr(6.8, 19, 10.4, 3.8, 1.2)),
    sonickick: () => P('M2.4 17.2V10.2C2.4 8 4.4 7 6.2 8L9.2 10H13.4L19.2 12C21.2 12.7 22.2 14.1 22.2 16.1V17.2z', circ(10.6, 12.4, .8), circ(13.4, 13.1, .8))
      + P(rr(2.2, 18.4, 20.2, 2.8, 1.4)) + P(rr(.4, 4.2, 4.6, 1.5, .75)) + P(rr(1.6, 1.4, 4.4, 1.5, .75)) + P(spark(19.4, 6, 2)),
    ironwill: () => P('M12 1.2L20.8 4.4V11C20.8 16.6 17.2 20.2 12 22.8C6.8 20.2 3.2 16.6 3.2 11V4.4z', spark(12, 11.4, 5.4)),
    tempest: () => P(star(12, 9.4, 8, 3.8, 8), circ(12, 9.4, 1.8)) + P(rr(1, 18.6, 22, 4, 1.4), poly([[12, 18.6], [10.8, 21], [12.6, 22.6], [13.4, 20.4]]))
      + P(rr(1.4, 13.4, 2.4, 2.4, .5)) + P(rr(20.4, 12.6, 2.2, 2.2, .5)),
    dragonkick: () => P('M2.6 16.4C2.6 11.2 5.4 8.6 9 7.6L12.6 6.8C16.4 6.4 19 7.8 21.4 10.2C22.2 11 22 11.8 21 12L18.4 12.4L20.6 14C21.4 14.6 21 15.4 20.2 15.4L15.6 15.8C13 18.2 10.6 18.8 7.6 18.6C4.6 18.4 2.6 17.8 2.6 16.4z',
      'M13.4 10.2C14.8 9.2 16.4 9.2 17.6 10.2C16.4 11.2 14.8 11.2 13.4 10.2z', 'M18.6 12.6L14.2 13.4L14.6 14.2L19 13.6z')
      + P('M6.8 7.6L3 2.2L10 6.4z') + P('M11 6.2L10.2 1L14 5.8z') + P(spark(20.6, 3.6, 1.8)),
    tball: () => P(circ(11, 13.2, 8.6), rr(2.4, 12.2, 17.2, 2.2, 1.1), circ(7.4, 13.3, .85), circ(11, 13.3, .85), circ(14.6, 13.3, .85), circ(7.6, 9, 1.3))
      + G('rotate(-45 20 4)', P(rr(19.2, .6, 1.6, 4.6, .8))) + G('rotate(-10 22.4 9.6)', P(rr(21.2, 8.8, 2.6, 1.6, .8))) + G('rotate(-75 15 2)', P(rr(14.2, -.2, 1.6, 4, .8))),
    // the weapon rework (v0.58)
    brickshot: () => G('rotate(-14 12 12)', P(rr(2.6, 7.4, 18.8, 9.2, 1.4), rr(4.4, 11.4, 15.2, 1.2, .6), rr(9.4, 7.4, 1.2, 4.2, .4), rr(14.6, 12.4, 1.2, 4.2, .4)))
      + P(rr(.6, 18.2, 4.4, 1.4, .7)) + P(rr(2.6, 20.6, 3, 1.4, .7)) + P(spark(20, 3.6, 2)),
    shotgun: () => P(rr(1.2, 9.2, 13.4, 4.2, 1.6), rr(3, 10.6, 5, 1.2, .6)) + P('M2.4 13.2H8.2L6.8 19.4a1 1 0 0 1-1 .8H2.8a.8.8 0 0 1-.8-1z')
      + P(rr(15, 9.8, 2.2, 3, .6)) + P(circ(21, 6.2, 1.3)) + P(circ(22, 11.4, 1.3)) + P(circ(20.8, 16.6, 1.3)) + P(circ(18.6, 3.4, .9)) + P(circ(18.6, 19.4, .9)),
    slap: () => P('M7.2 21.6L4.4 15.6C3.8 14.2 4.4 12.8 5.6 12.6L6 12.5V5.6a1.6 1.6 0 0 1 3.2 0v5.6V3.8a1.6 1.6 0 0 1 3.2 0v7.4V4.6a1.6 1.6 0 0 1 3.2 0v6.8V6.8a1.6 1.6 0 0 1 3.2 0v8.8C18.8 19.4 16.4 21.6 13.4 21.6z')
      + G('rotate(-30 20.5 3.5)', P(rr(19.6, 1, 1.6, 4.2, .8))) + G('rotate(10 22.6 8)', P(rr(21.8, 6.2, 1.6, 4, .8))) + G('rotate(-70 15 1.6)', P(rr(14.2, -.4, 1.6, 4, .8))),
    grapeshot: () => P(circ(12, 12, 4.2), circ(10.6, 10.6, 1)) + P(circ(5, 6, 2.2)) + P(circ(19.2, 5.2, 2.2)) + P(circ(20, 17.6, 2.2)) + P(circ(5.2, 18.6, 2.2))
      + P(circ(2.6, 12.4, 1.3)) + P(circ(12.6, 2.4, 1.3)) + P(circ(21.6, 11.6, 1.3)) + P(circ(12, 21.6, 1.3)),
    flashbang: () => P(rr(6.4, 8.6, 11.2, 13, 3.4), rr(11.2, 12, 1.6, 6, .8)) + P(rr(9.2, 5, 5.6, 2.8, .8)) + P('M14.6 4.6L19 1.8L19.8 3L15.6 5.8z')
      + P(spark(4, 4.6, 2.2)) + P(spark(20.6, 9.4, 1.6)),
    rambo: () => G('rotate(45 12 12)', P('M12 .8C14.2 2.6 14.8 6 14.8 9.4V14.4H9.2V3.6C9.8 2.2 10.8 1.2 12 .8z', rr(11.4, 4.2, 1.1, 8.4, .55)),
      P(rr(7.4, 15.2, 9.2, 2, 1)), P(rr(10.6, 17.8, 2.8, 4.6, .9))) + P('M3.4 13.6A10 10 0 0 1 10.4 3.4l.4 1.6A8.4 8.4 0 0 0 5 13.2z'),
    // the Standard pack's new ones (v0.59)
    hammer: () => G('rotate(-40 12 12)', P(rr(3.4, 2.4, 17.2, 7.4, 1.8), rr(5.4, 4.4, 1.3, 3.4, .65), rr(17.2, 3.6, 1.2, 5, .6)), P(rr(10.5, 10.8, 3, 12.4, 1.3), rr(11.5, 18.6, 1, 3, .5)))
      + P(poly([[2, 19.6], [4.4, 18.8], [3.6, 21.6]])) + P(poly([[18.6, 21.4], [21.4, 20], [21, 23]])) + P(spark(3.6, 4, 1.8)),
    blowpipe: () => G('rotate(-33 12 12)', P(rr(-1, 13, 16, 3, 1.5), rr(1, 13.9, 3.4, 1.2, .6)), P(rr(14.6, 12.6, 2, 3.8, .7)))
      + G('rotate(-33 12 12)', P('M18.6 14.5L21.4 13.2V15.8z'), P(rr(19.4, 14, 4.2, 1, .5)), P('M23.6 14.5L25 13.4V15.6z'))
      + P('M15.2 1.8H20V3.2L17.4 5.8H20V7.2H15.2V5.8L17.8 3.2H15.2z') + P('M20.6 8.2H23.4V9.2L21.9 10.6H23.4V11.6H20.6V10.6L22.1 9.2H20.6z'),
    fistopheles: () => G('translate(1.2 4.2) scale(.9)', P(rr(3.6, 4.6, 16.8, 13.4, 4.4), rr(7.6, 4.6, 1, 4.2, .5), rr(11.5, 4.6, 1, 4.2, .5), rr(15.4, 4.6, 1, 4.2, .5), rr(3.6, 11.8, 10.6, 1.3, .65)),
      P(rr(6.8, 19, 10.4, 3.8, 1.2))) + P('M4.4 8.2C2.6 6 2.6 3 4.6.6C4.4 3 5.4 4.8 7.6 6.6z') + P('M19.6 8.2C21.4 6 21.4 3 19.4.6C19.6 3 18.6 4.8 16.4 6.6z')
      + P(spark(12, 1.8, 1.6)),
    karishnikov: () => P('M1 9.4H6.6L8.2 8.4H19.6V11.6H8.8L7.4 13.2H4.4L2.6 15.8H.6z', rr(3, 10.6, 3, 1, .5)) + P(rr(20.4, 9.4, 3.2, 1.4, .7)) + P(rr(17.6, 6.8, 1, 1.6, .4))
      + P('M10.6 11.8H13.6C13.8 14.6 14.8 17.2 16.4 19.4L14 20.6C12.2 18 11 15.2 10.6 11.8z') + P(rr(8.6, 11.6, 1.4, 2.6, .5))
      + P(spark(22.4, 4.6, 1.6)) + P(spark(21.6, 15.8, 1.2)),
    enpassant: () => P('M7.6 17H17C18 12 17.2 7.6 14.4 4.8L13.8 2L12 4.4C9.6 4.8 7.6 6.8 5.4 10.4L6 12.2L9 12L11.2 11.2C9.2 13.6 7.6 15.2 7.6 17z', circ(10.6, 7.4, .9))
      + P(rr(6.6, 17.8, 10.8, 2, .6)) + P(rr(4.8, 20.4, 14.4, 2.8, 1)) + P(spark(20.2, 4, 2)) + P(rr(19.4, 14, 3.2, 3.2, .3)) + P(rr(1.4, 13, 2.6, 2.6, .3)),
    // the Ulti Magus pack's new ones (v0.60)
    twinflame: () => P('M14.6 22.4C10.9 22.4 8.4 19.8 8.4 16.6C8.4 12.8 11.6 11 12.6 6.8C13.8 8.2 14.4 9.4 14.6 11C15.6 9.8 16 8.4 15.8 6.4C19.2 9 20.8 12.4 20.8 16.2C20.8 19.8 18.2 22.4 14.6 22.4z',
      'M14.6 20C13.2 20 12.2 19 12.2 17.8C12.2 16.2 13.6 15.4 14.2 13.6C15.6 14.8 17 16.2 17 17.8C17 19 16 20 14.6 20z')
      + P('M5.4 21C3.4 21 2 19.4 2 17.5C2 15 4 13.8 4.6 11C6.2 12.4 7.4 14.2 7.4 16.2C7.4 17.4 6.9 18.2 6.9 19.2C6.9 20.2 6.4 21 5.4 21z')
      + P(spark(5.6, 5, 2)) + P(spark(20.4, 3.2, 1.5)),
    arcana: () => P(poly([[12, 1], [19.6, 12], [12, 23], [4.4, 12]]), poly([[12, 5], [16.8, 12], [12, 12]]), poly([[7.6, 12.8], [11.2, 12.8], [11.2, 18.2]]))
      + P(spark(20.4, 4, 2)) + P(spark(3.6, 19.6, 1.6)),
    explomagus: () => P(star(12, 12.4, 10.4, 3.6, 8, -90), circ(12, 12.4, 1.9)) + P(spark(20.6, 3.4, 1.7)) + P(spark(3.2, 20.8, 1.3)),
    gravamagus: () => [0, 120, 240].map(a => G(`rotate(${a} 12 12)`, P('M12 1.6C17.8 1.6 22.4 6.2 22.4 12C21 8 17.2 5.2 12.8 5.4C10.2 5.6 8.2 7.2 7.4 9.4C7.2 5.2 9.4 1.6 12 1.6z'))).join('')
      + P(circ(12, 12, 3.4), circ(12, 12, 1.5)),
    darkmagus: () => P(circ(12, 12, 6.8), circ(12, 12, 4)) + P(circ(12, 12, 2.2))
      + [0, 90, 180, 270].map(a => G(`rotate(${a} 12 12)`, P('M17.6 3.6C20.8 4.4 22.8 7.2 22.6 10.6C21.4 8.2 19.6 7 17.2 6.8z'))).join(''),
    druidity: () => P('M3.4 20.6C3 11.4 8.8 4 20.8 3.2C21 14.6 13.8 20.8 3.4 20.6z', 'M5.6 18.6L16.6 7.6L17.4 8.4L6.4 19.4z')
      + P(spark(4.4, 4.6, 2)) + P(spark(20.4, 19.4, 1.6)),
    geartoss: () => P(poly(Array.from({ length: 32 }, (_, i) => {           // an 8-toothed gear with its hub cut out, and a zap
      const k = Math.floor(i / 4), j = i % 4, a = (k * 45 + [-12, -7, 7, 12][j] - 90) * Math.PI / 180, r = j === 0 || j === 3 ? 7.2 : 9.6;
      return [f(11 + Math.cos(a) * r), f(13 + Math.sin(a) * r)];
    })), circ(11, 13, 3)) + P(poly([[19.4, .8], [16.4, 6], [18.6, 6], [16.8, 10.6], [22, 4.4], [19.6, 4.4], [21.6, .8]])),
    tballm: () => P(circ(12, 9.6, 7), rr(5, 8.6, 14, 2, 1), circ(8.8, 9.6, .8), circ(12, 9.6, .8), circ(15.2, 9.6, .8), circ(9, 6, 1.1))
      + P('M2 15.6A11 11 0 0 0 22 15.6L19.8 14.8A8.6 8.6 0 0 1 4.2 14.8z'),
  };
})();
const cardGlyph = (id, cls = 'cf-svg') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${CARD_GLYPH[id] ? CARD_GLYPH[id]() : ''}</svg>`;
const cardArt = id => cardGlyph(id);
/* ---------- the pictures (v0.64, user: "theres a new folder in the assets … apply those card to respective cards"):
   the user's square art, in assets/img/cards/ (tools/cardart.py makes <id>.webp from their PNGs). A card with a
   picture shows it behind its name, fading into the card above the words; one without keeps its glyph. Which cards
   have one, and how each is framed (moved, zoomed: the card editor, Admin → Card editor), is in cardart.js. */
const CARD_PICS = new Set(CARD_ART.pics);
const cardPicSrc = id => `assets/img/cards/${id}.webp`;
// Its framing as CSS variables (style.css .cf-pic): x, y in % of the card's width, z its zoom.
// (`--fx`, `--fy`, `--fz`: the same as plain numbers, for where the seams of its mirrors are: style.css .cf-seam)
function cardFrameVars(id) {
  const f = CARD_ART.frame[id];
  return f ? `--ax: ${f.x}%; --ay: ${f.y}%; --az: ${f.z}; --fx: ${f.x}; --fy: ${f.y}; --fz: ${f.z}` : '';
}
// v0.64 (user: "if an image is cutoff … repeat the image on that like a mirror and a seamless … gradient black so it
// still looks seamless … for other cards"): where a framed picture doesn't reach an edge of its window, a mirrored copy
// of it fills the gap from that edge, fading into the card's dark (style.css .cf-mir). Only the sides it needs.
const CARD_MIRROR_EDGE = 0.3;                         // (% of the card's width: a gap smaller than this isn't one)
function cardMirrors(id) {
  const f = { x: 0, y: 5.7, z: 1, ...(CARD_ART.frame[id] || {}) }, cx = 50 + f.x, cy = 50 + f.y, h = 50 * f.z, E = CARD_MIRROR_EDGE;
  const L = cx - h > E, R = cx + h < 100 - E, T = cy - h > E, B = cy + h < 99.6 - E;   // (99.6: where the window's fade ends)
  return [T && 't', B && 'b', L && 'l', R && 'r', T && L && 'tl', T && R && 'tr', B && L && 'bl', B && R && 'br'].filter(Boolean);
}
// On a card: the picture in a window that fades it out (the fade stays put however it's framed), with its mirrors.
// `cls` for a plain one (the pack page's rows).
function cardPic(id, cls = 'cf-pic') {
  if (cls !== 'cf-pic') return `<img class="${cls}" src="${cardPicSrc(id)}" alt="" draggable="false">`;
  const src = cardPicSrc(id), mir = cardMirrors(id);
  return `<span class="cf-pic-win" data-pic="${id}" data-mir="${mir.join(' ')}" style="${cardFrameVars(id)}">`
    + mir.map(m => `<img class="cf-pic cf-mir m-${m}" src="${src}" alt="" draggable="false">`).join('')
    + `<img class="cf-pic" src="${src}" alt="" draggable="false">`
    + mir.filter(m => m.length === 1).map(m => `<span class="cf-seam s-${m}"></span>`).join('') + '</span>';   // (v0.65: each seam blurred)
}
// (loaded and decoded once at start, and kept, so a reveal never turns a card over before its picture is ready)
const CARD_PIC_IMGS = [...CARD_PICS, 'random'].map(id => { const im = new Image(); im.src = cardPicSrc(id); im.decode?.().catch(() => {}); return im; });
/* The holo (v0.64, user: "the rarer the cards the beautiful the overlay of the holo or shine"): a layer over the art,
   under the words (style.css .cf-holo), plainer the commoner the card: none on a Common, a gloss on an Uncommon, a
   rainbow sheen on a Rare, holo stripes on an Epic, gold foil and glitter on a Legendary, a full prism with glitter and
   stars on a Triple S, red chrome on an Event. It follows the pointer where the card tilts (packTilt's --mx, --my). */
const CF_HOLO = '<span class="cf-holo" aria-hidden="true"></span>';
// The Effects lab's card effects (v0.64, user: "why are the effects not like the one i mentioned from the card effects?"):
// Rare and up get its shine layers and glare over the whole card (style.css .cf-fx: Trainer gallery; Legendary Rainbow
// foil + Gold secret; Triple S and Event Galaxy + Gold secret).
const CF_FX = '<span class="cf-fx cf-fx-a" aria-hidden="true"></span><span class="cf-fx cf-fx-b" aria-hidden="true"></span><span class="cf-glare" aria-hidden="true"></span>';
const CF_FX_RARE = new Set(['rare', 'epic', 'legendary', 'sss', 'event']);
/* A premium look in the weapon's own theme (v0.64, user: "for triple S and event cards make the card design more premium
   and inline with the weapon's theme"): a class on the card, style.css .cf-t-chess / .cf-t-tball. Checked by weapon, not
   by rarity, so another Triple S or Event card gets the plain rarity look until it's given one here. */
const CARD_THEME = { enpassant: 'chess', tball: 'tball', tballm: 'tball' };

/* ---------- the face ---------- */
// `count`: the red counter on the bottom panel (the collection: copies free to add); `countTip` its tooltip.
// `tier` (v0.62, tiers.js): a card upgraded past Tier I wears its tier, II to V, on its top edge.
function cardFace(id, { count = null, countTip = '', tier = 1 } = {}) {
  const k = CARDS[id], t = COMBOS[id] || {}, ns = Object.keys(t).map(Number).sort((a, b) => a - b);
  const passive = ns.find(n => n !== 7), num = CARD_NUM[id] || [k.dmg, 'dmg'];
  const combo = n => `<p class="cf-combo"><b>${n}</b><span>${t[n].name}</span></p>`;
  const combos = (passive ? combo(passive) : '') + (t[7] ? combo(7) : '') || `<p class="cf-combo is-none"><b>–</b><span>No combos</span></p>`;
  const pic = CARD_PICS.has(id);
  return `<div class="cf cf-${k.rarity}${CARD_THEME[id] ? ' cf-t-' + CARD_THEME[id] : ''}${pic ? ' has-pic' : ''}" style="--c: var(--${id}); --rc: var(--r-${k.rarity})">`
    + `<div class="cf-frame"><div class="cf-body">${pic ? cardPic(id) : ''}${CF_HOLO}`
    + `<div class="cf-top"><span class="cf-name">${k.name}</span></div>`
    + `<div class="cf-art">${pic ? '' : cardArt(id)}</div>`
    + `<div class="cf-low"><span class="cf-num"><b>${num[0]}</b><i>${num[1]}</i></span>`
    + `<div class="cf-text"><p class="cf-desc">${CARD_SHORT[id] || k.desc}</p>${combos}</div></div>`
    + `</div></div>`
    + `<span class="cf-rar">${RARITY_NAME[k.rarity]}</span>`
    + (k.badge ? `<span class="cf-kind is-x" title="Ranged: plays in your ranged deck">${k.badge}</span>`   // (EN PASSANT's X, v0.59)
      : `<span class="cf-kind is-${k.melee ? 'm' : 'r'}" title="${k.melee ? 'Melee' : 'Ranged'}">${k.melee ? 'M' : 'R'}</span>`)
    + (tier > 1 ? `<span class="cf-tier${tier >= TIER_MAX ? ' is-max' : ''}" title="Tier ${TIER_ROMAN[tier]}">${TIER_ROMAN[tier]}</span>` : '')
    + `<span class="cf-sheen" aria-hidden="true"></span>`
    + (CF_FX_RARE.has(k.rarity) ? CF_FX : '')
    + (count == null ? '' : `<span class="cf-count${count > 0 ? '' : ' is-zero'}" title="${countTip}">${count}</span>`) + `</div>`;
}
