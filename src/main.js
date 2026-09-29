/* main.js — Boot and the frame loop. Loaded last. */
'use strict';

/* ---------- boot ---------- */
resize();
if (save.beginner) newDeck();
renderTray(true);
renderLog();
renderChecks();
renderHp(false);
renderXp(false);
showScreen('scr-title');

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // never negative: `last` can be reset just after this frame began
  last = now;
  if (!game.paused && !game.inMenu && !game.over && !game.choosing && deck) update(dt);
  if (nextCard) nextCard.style.setProperty('--p', game.enemies.length ? 1 - Math.max(0, game.cooldown) / game.cdTotal : 0);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For poking at the game from the browser console. resetSave() wipes this computer's progress
// (the beginner pack can then be opened again), so it is a testing tool only.
window.__swarm = {
  get deck() { return deck; }, get seed() { return seed; }, get save() { return save; },
  game, record, sameMix, rollPack, PACKS, gainXp, xpNeeded, stats, picks, upOdds, pickChoice,
  resetSave() { if (!game.inMenu) exitToTitle(); resetData(); },
};
