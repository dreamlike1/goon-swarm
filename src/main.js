/* main.js — Boot and the frame loop. Loaded last. */
'use strict';

/* ---------- boot ---------- */
resize();
if (save.starterDone) newDeck();
renderTray(true);
renderLog();
renderChecks();
renderHp(false);
renderXp(false);
showScreen('scr-title');
audioInit();                // the sound effects and the music right away, if the browser allows sound before a click (user);
startMusic();               // otherwise both start on the first press

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // never negative: `last` can be reset just after this frame began
  last = now;
  // The fight pauses while a level-up choice is open. Held keys are still tracked (arena.js), so you move off the moment you pick.
  // A bug in one frame must never stop the game for good (v0.32): the error is logged and the next frame still comes.
  try {
    // co-op (coop.js): a guest only draws what the host sends; the host runs the fight for everyone, even with its
    // pause menu open, and sends each friend a picture of it
    if (NET.guest && NET.run) { if (!game.inMenu && !game.over) guestFrame(dt); }
    else if ((!game.paused || NET.run) && !game.cineHold && !game.inMenu && !game.over && !game.choosing && (deck || mdeck || game.practice)) {
      update(dt);
      if (NET.run) { usePlayer(NET.me); pickTimeouts(); tickPick(); reviveHud(); }
    }
    if (NET.host && NET.run) flushSnaps();
    const R = DECK_VIEWS.ranged.next, Me = DECK_VIEWS.melee.next;   // each deck's next card fills as its timer runs
    if (R) R.style.setProperty('--p', game.enemies.length ? 1 - Math.max(0, game.cooldown) / game.cdTotal : 0);
    if (Me) Me.style.setProperty('--p', 1 - Math.max(0, game.mcool) / (game.mcdTotal || 1));   // (the melee deck never waits)
    draw();
    syncMusic(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For poking at the game from the browser console. resetSave() wipes this computer's progress
// (the starter pack can then be opened again), so it is a testing tool only.
window.__swarm = {
  get deck() { return deck; }, get mdeck() { return mdeck; }, get seed() { return seed; }, get save() { return save; },
  game, record, sameMix, rollPack, PACKS, gainXp, xpNeeded, stats, picks, upOdds, pickChoice,
  resetSave() { if (!game.inMenu) exitToTitle(); resetData(); },
};
