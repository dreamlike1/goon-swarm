/* sound.js — Sound effects, made on the fly with the Web Audio API, the lobby and level music (assets/), and volume and mute. */
'use strict';

/* Browsers only allow sound after the player interacts, so the audio engine starts on the
   first click, tap or key press. The volume and mute setting is saved on this computer
   (separate from the game save, so Reset data keeps it). */
const AUDIO_KEY = 'rogue.audio';
// Three volumes, set in the gear menu. Each is 0–1 and multiplies the others; `VOL_FULL` is how loud each one is at 100%.
// Starting levels (user, v0.15): Master 10%, Menu music 3%, Sound effects 50%, not muted, so the effects sit well above
// the music. Saved on this computer, separate from the game save (Reset data keeps them). `AUDIO_VERSION` goes up when
// the defaults change, so everyone starts again from the new ones (and unmuted).
const AUDIO_VERSION = 2;
const VOL_DEFAULT = { master: 0.1, music: 0.03, level: 0.03, sfx: 0.5 };   // `level`: the battle music (v0.16), like the menu music
const VOL_FULL = { master: 2.5, music: 1.25, level: 1.25, sfx: 0.9 };
const audio = { ctx: null, master: null, noise: null, vols: { ...VOL_DEFAULT }, muted: false, last: {} };

try {
  const a = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
  if (a && a.v === AUDIO_VERSION && a.vols) {           // anything older (or saved before these defaults) is ignored
    for (const k in VOL_DEFAULT) if (typeof a.vols[k] === 'number') audio.vols[k] = Math.min(1, Math.max(0, a.vols[k]));
    audio.muted = !!a.muted;
  }
} catch (err) { /* defaults */ }

function saveAudio() {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ v: AUDIO_VERSION, vols: audio.vols, muted: audio.muted })); } catch (err) { /* not saved */ }
}
const masterGain = () => audio.muted ? 0 : audio.vols.master * VOL_FULL.master;
const sfxGain = () => masterGain() * audio.vols.sfx * VOL_FULL.sfx;
// `k`: 'music' (the menus) or 'level' (battles). An <audio> element tops out at 1.
const musicGain = (k = 'music') => Math.min(1, masterGain() * audio.vols[k] * VOL_FULL[k]);

function audioInit() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio.ctx = new AC();
  audio.master = audio.ctx.createGain();
  audio.master.connect(audio.ctx.destination);
  const len = audio.ctx.sampleRate;                     // one second of white noise, reused
  audio.noise = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const d = audio.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  applyVolume();
}
addEventListener('pointerdown', audioInit, true);
addEventListener('keydown', audioInit, true);

function applyVolume() {
  if (audio.master) audio.master.gain.value = sfxGain();
}
const audible = () => audio.ctx && audio.ctx.state === 'running' && sfxGain() > 0;

/* ---------- music: lobby (menus), level (battle), boss (SKURTOSAURUS) ----------
   Opus in .m4a; browsers that can't play that (older Safari) get the AAC copies.
   - Menus: the lobby track. Start → the deck preview: it crossfades into the level track, with a rising whoosh.
   - The boss's intro: the level track fades out under the footsteps; its music hits when it arrives. Phase 2 has its
     own song (user), crossfaded in straight at its chorus. When it's down, its music fades out and the level track
     fades back in where it left off. Defeat fades everything out; back in the menus the lobby track fades back in.
   - Pausing pauses the music where it is (a quick fade, so there's no click); resuming fades it back in.
   - Clean and smooth (user): every change is an equal-power crossfade (the two tracks' loudness adds up to a steady
     level), and nothing ever cuts in or out at full volume.
   - Seamless loops (user): each song fades out over its last few seconds, so instead of looping the file a second
     copy of it starts from the top `LOOP_LEAD` s before the end and they crossfade over `LOOP_XFADE` s.
   - Each run's level music and each boss fight's music start from the top (phase 2's from its chorus), and so does the lobby's after a run
     (after a weapon test it carries on). Test mode has no music.
   - Autoplay (user: must play on open, no "click to play"): it's started the moment the page loads. Browsers only allow
     that when the site may autoplay; `Play Packs Silica.command` opens the game in Chrome with autoplay allowed. Anywhere
     else it quietly starts from inside your first click, tap or key press. */
const TRACKS = {
  lobby: { opus: 'assets/lobby_music.m4a', aac: 'assets/lobby_music_aac.m4a', vol: 'music', fadeIn: 1.4, fadeOut: 1.4 },
  level: { opus: 'assets/level_music.m4a', aac: 'assets/level_music_aac.m4a', vol: 'level', fadeIn: 2.0, fadeOut: 1.6 },
  boss:  { opus: 'assets/KURT_BOSS_MUSIC.m4a', aac: 'assets/KURT_BOSS_MUSIC_aac.m4a', vol: 'level', fadeIn: 0.6, fadeOut: 1.0 },
  // Phase 2 (user, v0.21: its own song, KURT_PHASE_2.m4a, starting right at the chorus, the loudest part). The build
  // into the chorus starts at 141.5 s (measured with ffmpeg: the level jumps from about −20 to −15 dB there and stays
  // the loudest stretch to the end), so KURT_PHASE_2_chorus.m4a is the song cut from there (45.8 s). A cut file
  // rather than a seek, because the simple local server can't seek into a file that hasn't finished loading. It
  // loops back to the chorus too, never the quiet intro.
  // MAKORA's fight (user): MAKORA.m4a, 2:00. It comes in on "MAKORA!" at the end of the summoning.
  makora: { opus: 'assets/MAKORA.m4a', aac: 'assets/MAKORA_aac.m4a', vol: 'level', fadeIn: 0.7, fadeOut: 1.8 },
  phase2: { opus: 'assets/KURT_PHASE_2_chorus.m4a', aac: 'assets/KURT_PHASE_2_chorus_aac.m4a', vol: 'level', fadeIn: 0.45, fadeOut: 1.8 },
};
const MUSIC_FADE = { over: 2.5, pause: 0.12, resume: 0.35 };   // seconds: on defeat; into and out of a pause
const LOOP_LEAD = 4.5, LOOP_XFADE = 3;                          // the loop crossfade (media seconds before the end; its length)
const music = { blocked: false, was: null };
for (const k in TRACKS) Object.assign(TRACKS[k], { els: [], cur: 0, level: 0, restart: true, held: false, xf: null });
const shaped = x => Math.sin(Math.min(1, Math.max(0, x)) * Math.PI / 2);   // equal-power curve for every fade
// One copy of a song. Starting a song from the top always uses a copy that hasn't played yet, rather than seeking
// back to 0:00: a simple static server (like the one the launcher runs) doesn't let the browser seek, so a seek can
// silently fail and leave a song mid-way. A fresh copy comes straight from the browser's cache.
function newTrackEl(k) {
  const T = TRACKS[k], el = new Audio();
  el.src = el.canPlayType('audio/mp4; codecs="opus"') ? T.opus : T.aac;
  el.preload = 'auto'; el.volume = 0; el.mix = 1;
  el.addEventListener('ended', () => {                           // a safety net: if a copy ever reaches the end, go round
    if (T.els[T.cur] === el && !T.xf && T.level > 0) { const f = freshEl(k, T.cur); f.volume = el.volume; f.play().catch(() => {}); }
  });
  return el;
}
function trackEls(k) {
  const T = TRACKS[k];
  if (!T.els.length) T.els = [newTrackEl(k), newTrackEl(k)];   // two copies of each song, for the loop crossfade
  return T.els;
}
// Copy `i` of a song, ready to play from 0:00 (swapped for a new one if it has played at all).
function freshEl(k, i) {
  const T = TRACKS[k];
  let el = trackEls(k)[i];
  if (el.currentTime > 0.05 || el.ended) {
    el.pause(); el.removeAttribute('src'); el.load();            // let go of the old one
    el = T.els[i] = newTrackEl(k);
  }
  el.mix = 1;
  return el;
}
const activeEl = k => trackEls(k)[TRACKS[k].cur];
// Which tracks should be playing, and how loud (0–1 of their slider). `hold`: paused, keep the place.
function musicWanted() {
  const none = { lobby: 0, level: 0, boss: 0, phase2: 0, makora: 0 };
  if (document.hidden) return { ...none, hold: true };
  if (!document.getElementById('menu').hidden) return current === 'scr-preview' ? { ...none, level: 1 } : { ...none, lobby: 1 };
  if (game.practice || game.over) return none;
  if (game.paused || game.cineHold) return { ...none, hold: true };
  if (game.intro) return none;                                 // the footsteps: the level track fades away under them
  // MAKORA's black screens: the summoning is its voice alone until "MAKORA!", when its music comes in; the wheel
  // turning dips its music
  if (game.cine) return game.cine.kind === 'summon' ? (game.cine.music ? { ...none, makora: 1 } : none) : { ...none, makora: 0.3 };
  if (game.makora) return { ...none, makora: 1 };
  if (game.boss) return game.boss.phase === 2 ? { ...none, phase2: 1 } : { ...none, boss: 1 };
  if (game.obi) return game.obi.phase === 2 ? { ...none, phase2: 1 } : { ...none, boss: 1 };   // OBI ONE: SKURTOSAURUS's music (user)
  return { ...none, level: 1 };
}
const inRun = () => document.getElementById('menu').hidden && !game.practice && !game.over;
function startMusic() {
  const want = musicWanted();
  if (want.hold) return;
  for (const k in TRACKS) {
    const T = TRACKS[k];
    if (!want[k] || !activeEl(k).paused) continue;
    if (T.restart) { T.xf = null; T.cur = 0; freshEl(k, 0); freshEl(k, 1); T.restart = false; }
    const el = activeEl(k);
    music.blocked = true;                                      // until play() says otherwise: don't ask every frame
    el.play().then(() => { music.blocked = false; }).catch(() => { /* not allowed yet: the first press starts it */ });
  }
}
// Called every frame (main.js): fades, crossfades, loops and the phase-2 speed-up.
function syncMusic(dt) {
  const want = musicWanted();
  const to = want.lobby ? 'lobby' : want.level ? 'level' : want.boss ? 'boss' : want.phase2 ? 'phase2' : want.makora ? 'makora' : null;
  syncFurube(!!want.hold);
  if (music.was === 'lobby' && to === 'level') SFX.whoosh();   // the menus → the fight
  if (to) music.was = to;
  for (const k in TRACKS) {
    const T = TRACKS[k], els = trackEls(k), el = els[T.cur], other = els[1 - T.cur];
    if (want.hold) {                                           // paused (or the tab is hidden): a quick fade, then stop in place
      if (T.xf) { other.mix = 1; el.pause(); el.mix = 1; T.cur = 1 - T.cur; T.xf = null; }   // finish a loop crossfade first
      const a = els[T.cur];
      if (!a.paused) {
        T.level = Math.max(0, T.level - dt / MUSIC_FADE.pause);
        if (T.level === 0) { a.pause(); T.held = true; }
      }
    } else {
      const target = want[k];
      const out = game.over && k !== 'lobby' ? MUSIC_FADE.over : T.fadeOut;
      const inTime = T.held ? MUSIC_FADE.resume : T.fadeIn;
      T.level = T.level < target ? Math.min(target, T.level + dt / inTime) : Math.max(target, T.level - dt / out);
      if (T.level >= target) T.held = false;
      if (target && el.paused && !music.blocked) startMusic();
      if (!target && T.level === 0) {
        for (const e of els) if (!e.paused) e.pause();
        T.xf = null; T.held = false;
        // from the top next time: every boss fight; the level track once the run is over; the lobby's after a run
        if (k === 'boss' || k === 'phase2' || k === 'makora' || (k === 'level' && !inRun()) || (k === 'lobby' && current === 'scr-preview')) T.restart = true;
      }
    }
    // the seamless loop: near the end, the other copy starts from the top and they crossfade
    const a = T.els[T.cur];
    if (!a.paused && !T.xf && a.duration && a.currentTime >= a.duration - LOOP_LEAD) {
      const n = freshEl(k, 1 - T.cur);
      n.mix = 0;
      n.play().catch(() => {});
      T.xf = { t: 0, dur: Math.min(LOOP_XFADE, a.duration - a.currentTime) };
    }
    const b = T.els[1 - T.cur];
    if (T.xf && !a.paused) {
      T.xf.t += dt;
      const q = Math.min(1, T.xf.t / T.xf.dur);
      a.mix = shaped(1 - q); b.mix = shaped(q);
      if (q >= 1) { a.pause(); a.mix = 1; T.cur = 1 - T.cur; T.xf = null; }
    }
    const g = shaped(T.level) * musicGain(T.vol);
    for (const e of T.els) e.volume = Math.min(1, g * e.mix);
  }
}
// The first press anywhere: start the music (and the sound effects) from inside it, which every browser accepts.
const kickMusic = () => { music.blocked = false; startMusic(); };
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, kickMusic, true);
// A hidden tab stops the frame loop, so its music is paused here instead (nobody hears the cut), and fades back in.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  syncFurube(true);
  for (const k in TRACKS) {
    const T = TRACKS[k];
    for (const e of T.els) if (!e.paused) { e.pause(); T.held = true; }
    if (T.xf) { T.els[T.cur].mix = 1; T.cur = 1 - T.cur; T.els[T.cur].mix = 1; T.xf = null; }
    T.level = 0;
  }
});

function tone({ type = 'square', f = 440, f2 = null, dur = 0.08, vol = 0.2, delay = 0, attack = 0.004 }) {
  if (!audible()) return;
  const c = audio.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.2, freq = 1200, f2 = null, filter = 'lowpass', q = 1, delay = 0, attack = 0.005 }) {
  if (!audible()) return;
  const c = audio.ctx, t = c.currentTime + delay;
  const src = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
  src.buffer = audio.noise;
  bq.type = filter; bq.Q.value = q;
  bq.frequency.setValueAtTime(freq, t);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(audio.master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

// Stops a burst of identical sounds in one moment from stacking into noise.
function often(key, ms) {
  const now = performance.now();
  if (now - (audio.last[key] || 0) < ms) return false;
  audio.last[key] = now;
  return true;
}

const COMBO_VOICE = { bullet: [440, 'square'], laser: [660, 'sawtooth'], arcane: [392, 'sine'], cannon: [196, 'triangle'],
  shuriken: [523, 'triangle'], spaceimpact: [330, 'square'], mine: [262, 'triangle'], firebolt: [349, 'sawtooth'],
  sniper: [587, 'square'], missiles: [466, 'sine'], gatling: [523, 'square'], cryo: [784, 'sine'], shifter: [220, 'sawtooth'] };

const SFX = {
  // Every weapon has its own sound (user).
  fire(card) {
    if (!often('fire', 25)) return;
    switch (card) {
      case 'bullet':   tone({ f: 880, f2: 440, dur: 0.06, vol: 0.12 }); break;                                        // pew
      case 'laser':    tone({ type: 'sawtooth', f: 2600, f2: 500, dur: 0.1, vol: 0.07 }); tone({ type: 'sine', f: 1400, f2: 1300, dur: 0.12, vol: 0.06 }); break;   // zap
      case 'arcane':   tone({ type: 'sine', f: 300, f2: 620, dur: 0.18, vol: 0.2 }); tone({ type: 'sine', f: 606, f2: 1250, dur: 0.18, vol: 0.05 }); break;          // whoomp, with a shimmer
      case 'cannon':   tone({ type: 'sine', f: 150, f2: 45, dur: 0.32, vol: 0.5 }); noise({ dur: 0.18, vol: 0.25, freq: 600 }); break;                              // boom
      case 'shuriken': [1568, 2093, 2637].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.05, vol: 0.06, delay: i * 0.025 })); break;                          // a quick sparkle
      case 'spaceimpact': noise({ dur: 0.35, vol: 0.14, freq: 500, f2: 2600, filter: 'bandpass', q: 1.2 }); tone({ type: 'square', f: 220, f2: 660, dur: 0.3, vol: 0.05 }); break;   // rocket
      case 'mine':     tone({ type: 'triangle', f: 320, f2: 180, dur: 0.08, vol: 0.12 }); tone({ type: 'square', f: 1400, dur: 0.02, vol: 0.05, delay: 0.09 }); break;   // clunk, beep
      case 'gatling':  noise({ dur: 0.03, vol: 0.16, freq: 2200, filter: 'bandpass', q: 1 }); tone({ type: 'square', f: 180, f2: 90, dur: 0.03, vol: 0.06 }); break;   // brrt
      case 'cryo':     [1760, 2349, 3136].forEach((f, i) => tone({ type: 'sine', f, dur: 0.12, vol: 0.05, delay: i * 0.03 })); noise({ dur: 0.2, vol: 0.08, freq: 5000, filter: 'highpass' }); break;   // an icy chime
      case 'firebolt': noise({ dur: 0.22, vol: 0.25, freq: 900, f2: 3200, filter: 'bandpass', q: 0.8 }); tone({ type: 'sawtooth', f: 300, f2: 120, dur: 0.2, vol: 0.08 }); break;   // fiery whoosh
      case 'sniper':   noise({ dur: 0.09, vol: 0.4, freq: 2400, filter: 'highpass' }); tone({ type: 'square', f: 1800, f2: 200, dur: 0.12, vol: 0.09 }); tone({ type: 'sine', f: 120, f2: 60, dur: 0.2, vol: 0.25 }); break;   // a sharp crack
      case 'missiles': [0, 0.05].forEach(d => tone({ type: 'sine', f: 520, f2: 1500, dur: 0.14, vol: 0.09, delay: d })); noise({ dur: 0.16, vol: 0.07, freq: 1800, filter: 'bandpass', q: 2 }); break;   // two quick whooshes
      default:         tone({ f: 700, dur: 0.05, vol: 0.1 });
    }
  },
  hit(heavy) {
    if (!often('hit', 30)) return;
    if (heavy) noise({ dur: 0.16, vol: 0.3, freq: 420 });
    else tone({ type: 'triangle', f: 320, f2: 180, dur: 0.05, vol: 0.12 });
  },
  kill(big) {
    if (!often('kill', 40)) return;
    tone({ f: big ? 300 : 540, f2: big ? 80 : 140, dur: big ? 0.26 : 0.14, vol: 0.14 });
    noise({ dur: 0.12, vol: 0.1, freq: 2000 });
  },
  hurt() { tone({ type: 'sawtooth', f: 150, f2: 70, dur: 0.22, vol: 0.22 }); },
  defeat() { [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.3, vol: 0.2, delay: i * 0.16 })); },
  open() { noise({ dur: 0.4, vol: 0.2, freq: 700, f2: 3500, filter: 'bandpass', q: 0.7 }); },
  flip(rarity) {
    tone({ type: 'triangle', f: 660, f2: 990, dur: 0.07, vol: 0.12 });
    if (rarity !== 'common') {                           // a little chime for anything better than Common
      tone({ type: 'sine', f: 1320, dur: 0.18, vol: 0.12, delay: 0.07 });
      tone({ type: 'sine', f: 1760, dur: 0.24, vol: 0.1, delay: 0.14 });
    }
  },
  pickup() {                                            // rises in pitch when orbs are grabbed in quick succession
    const now = performance.now();
    audio.chain = now - (audio.last.pickup || 0) < 450 ? Math.min(10, (audio.chain || 0) + 1) : 0;
    if (!often('pickup', 35)) return;
    const f = 880 * 2 ** (audio.chain / 12);
    tone({ type: 'sine', f, f2: f * 1.5, dur: 0.07, vol: 0.12 });
  },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.18, vol: 0.14, delay: i * 0.06 })); tone({ type: 'sine', f: 2093, dur: 0.35, vol: 0.06, delay: 0.24 }); },
  shuffle() { for (let i = 0; i < 7; i++) noise({ dur: 0.03, vol: 0.1, freq: 2600 + i * 180, filter: 'bandpass', q: 1.4, delay: i * 0.035 }); },
  deal() { if (often('deal', 30)) tone({ type: 'triangle', f: 760, f2: 1100, dur: 0.05, vol: 0.08 }); },
  dodge() { noise({ dur: 0.12, vol: 0.12, freq: 1800, f2: 600, filter: 'bandpass', q: 1 }); },
  upgrade(rank) { [659, 784, 988, 1175, 1568].slice(0, 2 + rank).forEach((f, i) => tone({ type: 'triangle', f, dur: 0.16, vol: 0.13, delay: i * 0.05 })); },
  // A combo's rising arpeggio, in each weapon's own key and voice.
  combo(n, card) {
    const [root, type] = COMBO_VOICE[card] || [440, 'square'];
    [1, 1.26, 1.5, 2].slice(0, n >= 7 ? 4 : 3).forEach((m, i) => tone({ type, f: root * m, dur: 0.08, vol: 0.06, delay: i * 0.035 }));
  },
  sweep() { tone({ type: 'sawtooth', f: 300, f2: 2400, dur: 0.5, vol: 0.08 }); noise({ dur: 0.5, vol: 0.12, freq: 800, f2: 5000, filter: 'bandpass', q: 2 }); },
  rip() { noise({ dur: 0.3, vol: 0.28, freq: 1800, f2: 5200, filter: 'highpass', q: 0.7 }); noise({ dur: 0.12, vol: 0.18, freq: 600, delay: 0.02 }); },
  coin() { [1319, 1760].forEach((f, i) => tone({ type: 'square', f, dur: 0.09, vol: 0.06, delay: i * 0.07 })); },
  pulse() { if (often('pulse', 60)) { tone({ type: 'sine', f: 260, f2: 520, dur: 0.18, vol: 0.16 }); noise({ dur: 0.15, vol: 0.08, freq: 1200, filter: 'bandpass' }); } },
  diamond() { [988, 1319, 1760, 2349].forEach((f, i) => tone({ type: 'sine', f, dur: 0.12, vol: 0.1, delay: i * 0.05 })); },
  roar() { noise({ dur: 0.7, vol: 0.35, freq: 300, f2: 90 }); tone({ type: 'sawtooth', f: 110, f2: 55, dur: 0.6, vol: 0.18 }); },
  stomp(n = 1) { tone({ type: 'sine', f: 70, f2: 28, dur: 0.45, vol: 0.35 + n * 0.08 }); noise({ dur: 0.3, vol: 0.18 + n * 0.04, freq: 260, f2: 70 }); },
  enrage() {                                           // phase 2: a long, deep roar with a rumble under it
    noise({ dur: 1.4, vol: 0.4, freq: 420, f2: 70, attack: 0.08 });
    tone({ type: 'sawtooth', f: 140, f2: 45, dur: 1.3, vol: 0.2, attack: 0.06 });
    tone({ type: 'square', f: 70, f2: 35, dur: 1.2, vol: 0.08, attack: 0.1 });
    tone({ type: 'sine', f: 42, f2: 30, dur: 1.5, vol: 0.3 });
  },
  // MAKORA: a low boom under each summoning line …
  cineBoom(n) {
    tone({ type: 'sine', f: 70 - n * 6, f2: 32, dur: 1.4, vol: 0.32 + n * 0.05, attack: 0.02 });
    noise({ dur: 0.9, vol: 0.12, freq: 260, f2: 60, attack: 0.03 });
  },
  // … a roar as its name lands …
  makoraRoar() {
    noise({ dur: 1.6, vol: 0.4, freq: 520, f2: 80, attack: 0.05 });
    tone({ type: 'sawtooth', f: 160, f2: 50, dur: 1.4, vol: 0.2, attack: 0.04 });
    tone({ type: 'sine', f: 48, f2: 28, dur: 1.8, vol: 0.4 });
    tone({ type: 'triangle', f: 330, f2: 220, dur: 1.1, vol: 0.05, delay: 0.1, attack: 0.2 });
  },
  // … its wheel turning (user: a heavy wooden turn): a creaking ratchet, then a deep wooden clunk as it locks …
  // MAKORA's wheel (v0.33, it spins): a heavy shove, a wooden tick each time a spoke passes (quieter as it slows),
  // and the deep clunk as it lands on the notch
  // MAKORA's punch: a deep thump and the crack of the shockwave (v0.37)
  punch() {
    tone({ type: 'sine', f: 110, f2: 38, dur: 0.35, vol: 0.55 });
    noise({ dur: 0.3, vol: 0.4, freq: 700, f2: 180, filter: 'lowpass' });
    noise({ dur: 0.12, vol: 0.25, freq: 2400, filter: 'bandpass', q: 1.5, delay: 0.02 });
  },
  wheelSpin() {
    noise({ dur: 0.35, vol: 0.3, freq: 300, f2: 1400, filter: 'bandpass', q: 1.2 });
    tone({ type: 'square', f: 58, f2: 70, dur: 0.5, vol: 0.06, attack: 0.05 });
  },
  makoraTick(v = 1) {                                  // (was wheelTick, which the old weapon wheel's tick below overrode)
    noise({ dur: 0.04, vol: 0.08 + 0.14 * v, freq: 900 + 300 * v, filter: 'bandpass', q: 5 });
    tone({ type: 'triangle', f: 240 + 120 * v, dur: 0.03, vol: 0.05 });
  },
  wheelLand() {
    tone({ type: 'sine', f: 98, f2: 42, dur: 0.5, vol: 0.6 });
    noise({ dur: 0.28, vol: 0.45, freq: 420, filter: 'bandpass', q: 1.8 });
    tone({ type: 'triangle', f: 190, f2: 120, dur: 0.12, vol: 0.18 });
    noise({ dur: 0.6, vol: 0.12, freq: 180, f2: 60, delay: 0.04 });
  },
  // … the kick (v0.38): it stamps and the ground cracks up, then a heavy swing and the rock launching …
  kickStomp() {
    tone({ type: 'sine', f: 80, f2: 30, dur: 0.4, vol: 0.45 });
    noise({ dur: 0.45, vol: 0.3, freq: 600, f2: 90, filter: 'lowpass' });
  },
  kick() {
    noise({ dur: 0.22, vol: 0.3, freq: 350, f2: 2600, filter: 'bandpass', q: 1.1 });
    tone({ type: 'sine', f: 130, f2: 40, dur: 0.3, vol: 0.5, delay: 0.05 });
    noise({ dur: 0.2, vol: 0.3, freq: 1400, f2: 250, delay: 0.05 });
  },
  // … the rock bursting when you shoot it apart …
  rockBlast() {
    tone({ type: 'sine', f: 95, f2: 30, dur: 0.6, vol: 0.6 });
    noise({ dur: 0.6, vol: 0.5, freq: 1500, f2: 120 });
    noise({ dur: 0.35, vol: 0.2, freq: 3000, f2: 800, filter: 'bandpass', q: 1.2, delay: 0.03 });
  },
  // The Silica pack (v0.42): frost settling, ice shattering, the lion's bite
  freeze(big) { noise({ dur: big ? 0.8 : 0.35, vol: big ? 0.22 : 0.12, freq: 3000, f2: 7000, filter: 'highpass' }); tone({ type: 'sine', f: 1568, f2: 2093, dur: 0.25, vol: 0.05 }); },
  shatter() { noise({ dur: 0.4, vol: 0.35, freq: 4000, f2: 1200, filter: 'bandpass', q: 0.9 }); [2637, 3136, 3951].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.06, vol: 0.06, delay: i * 0.04 })); },
  bite() { noise({ dur: 0.1, vol: 0.3, freq: 900, f2: 300 }); tone({ type: 'sawtooth', f: 160, f2: 80, dur: 0.12, vol: 0.12 }); },
  // … its three slices …
  slice(kind) {
    const f = { sweep: [2600, 700], cleave: [1800, 400], cross: [3200, 900] }[kind] || [2400, 600];
    noise({ dur: 0.18, vol: 0.3, freq: f[0], f2: f[1], filter: 'bandpass', q: 1.6, attack: 0.01 });
    tone({ type: 'triangle', f: f[0] / 2, f2: f[1] / 2, dur: 0.12, vol: 0.06 });
    if (kind === 'cross') noise({ dur: 0.14, vol: 0.25, freq: f[0], f2: f[1], filter: 'bandpass', q: 1.6, delay: 0.09 });
  },
  // … and a dull ring when a weapon it has adapted to bounces off
  adapted() { tone({ type: 'triangle', f: 520, f2: 480, dur: 0.16, vol: 0.08 }); tone({ type: 'sine', f: 1040, dur: 0.1, vol: 0.03 }); },
  growl() { tone({ type: 'sawtooth', f: 80, f2: 65, dur: 0.5, vol: 0.12 }); },
  // OBI ONE (v0.48): the force humming in the air (louder each time) …
  forceHum(n = 1) {
    tone({ type: 'sine', f: 55 + n * 8, f2: 90 + n * 12, dur: 1.1, vol: 0.2 + n * 0.05, attack: 0.25 });
    tone({ type: 'triangle', f: 110 + n * 16, f2: 175 + n * 20, dur: 0.9, vol: 0.05, attack: 0.3 });
    noise({ dur: 0.9, vol: 0.06 + n * 0.02, freq: 300, f2: 900, filter: 'bandpass', q: 3, attack: 0.3 });
  },
  // … a force push (phase 2, breaking free): a deep whoomp with air rushing out …
  forcePush() {
    tone({ type: 'sine', f: 140, f2: 40, dur: 0.6, vol: 0.45 });
    noise({ dur: 0.6, vol: 0.3, freq: 2400, f2: 300, filter: 'bandpass', q: 0.8 });
  },
  // … his lightsaber: igniting, going out, the hum when he gets ready, a swing, the spinning throw, the catch …
  saberOn() {
    tone({ type: 'sawtooth', f: 70, f2: 140, dur: 0.35, vol: 0.12, attack: 0.02 });
    noise({ dur: 0.3, vol: 0.12, freq: 900, f2: 3000, filter: 'bandpass', q: 2 });
    tone({ type: 'sine', f: 180, f2: 150, dur: 0.6, vol: 0.08, delay: 0.25, attack: 0.05 });
  },
  saberOff() { tone({ type: 'sawtooth', f: 150, f2: 50, dur: 0.4, vol: 0.12 }); noise({ dur: 0.3, vol: 0.1, freq: 2500, f2: 500, filter: 'bandpass', q: 2 }); },
  saberHum() { if (often('shum', 250)) { tone({ type: 'sawtooth', f: 92, f2: 104, dur: 0.45, vol: 0.07, attack: 0.05 }); tone({ type: 'sine', f: 184, f2: 208, dur: 0.45, vol: 0.05, attack: 0.05 }); } },
  saberSwing() {
    tone({ type: 'sawtooth', f: 110, f2: 240, dur: 0.22, vol: 0.12, attack: 0.02 });
    noise({ dur: 0.2, vol: 0.2, freq: 700, f2: 2600, filter: 'bandpass', q: 1.8, attack: 0.02 });
  },
  saberThrow() { for (let i = 0; i < 4; i++) { tone({ type: 'sawtooth', f: 120, f2: 210, dur: 0.12, vol: 0.07, delay: i * 0.1 }); noise({ dur: 0.1, vol: 0.08, freq: 1400, filter: 'bandpass', q: 2, delay: i * 0.1 }); } },
  saberCatch() { tone({ type: 'sine', f: 240, f2: 170, dur: 0.18, vol: 0.12 }); noise({ dur: 0.08, vol: 0.12, freq: 2000, filter: 'bandpass', q: 2 }); },
  // … and a shot knocked back off it (also DEFLECT turning a hit aside): a sharp electric crack
  saberClash() { if (!often('clash', 70)) return; noise({ dur: 0.1, vol: 0.28, freq: 4200, f2: 1600, filter: 'bandpass', q: 1.4 }); tone({ type: 'square', f: 1400, f2: 700, dur: 0.07, vol: 0.06 }); },
  // Fighting the pull: a short rising blip each press. DEFLECT going up: a bright shimmer.
  pullPress() { tone({ type: 'triangle', f: 520, f2: 780, dur: 0.07, vol: 0.1 }); },
  deflectOn() { [880, 1320].forEach((f, i) => tone({ type: 'sine', f, f2: f * 1.2, dur: 0.16, vol: 0.1, delay: i * 0.05 })); noise({ dur: 0.25, vol: 0.08, freq: 3500, filter: 'highpass' }); },
  rocks() { if (often('rocks', 200)) noise({ dur: 0.25, vol: 0.15, freq: 500, f2: 200 }); },
  // BULL (user: a swoosh, and an impact sound): a fast rising rush of air with a low push under it …
  bullDash() {
    noise({ dur: 0.32, vol: 0.32, freq: 450, f2: 3800, filter: 'bandpass', q: 1.1, attack: 0.03 });
    noise({ dur: 0.22, vol: 0.08, freq: 3500, filter: 'highpass', attack: 0.05 });
    tone({ type: 'sine', f: 170, f2: 70, dur: 0.2, vol: 0.14, attack: 0.01 });
  },
  // … and a heavy thud with a crack on top when it smashes into the first enemy
  bullImpact() {
    tone({ type: 'sine', f: 150, f2: 42, dur: 0.24, vol: 0.55 });
    noise({ dur: 0.18, vol: 0.45, freq: 1800, f2: 300 });
    tone({ type: 'triangle', f: 900, f2: 200, dur: 0.06, vol: 0.12 });
    noise({ dur: 0.05, vol: 0.12, freq: 4500, filter: 'highpass' });
  },
  dash() { noise({ dur: 0.25, vol: 0.2, freq: 400, f2: 2400, filter: 'bandpass', q: 0.8 }); tone({ type: 'square', f: 180, f2: 90, dur: 0.2, vol: 0.08 }); },
  potion() { [523, 784].forEach((f, i) => tone({ type: 'sine', f, f2: f * 1.5, dur: 0.14, vol: 0.14, delay: i * 0.06 })); },
  wheelTick() { if (often('tick', 25)) tone({ type: 'square', f: 1800, dur: 0.015, vol: 0.04 }); },
  boom() { if (!often('boom', 60)) return; noise({ dur: 0.5, vol: 0.45, freq: 900, f2: 120 }); tone({ type: 'sine', f: 110, f2: 35, dur: 0.45, vol: 0.45 }); },
  burst() { noise({ dur: 0.5, vol: 0.28, freq: 400, f2: 3000, filter: 'bandpass', q: 0.8 }); [330, 440, 660].forEach((f, i) => tone({ type: 'square', f, f2: f * 2, dur: 0.18, vol: 0.06, delay: i * 0.04 })); },
  rapid() { [0, 0.05, 0.1].forEach(d => tone({ f: 1320, f2: 990, dur: 0.035, vol: 0.07, delay: d })); },
  // Menu buttons (user: satisfying): a soft woody pop with a tiny bright tick on top. Start-type buttons chime up
  // two notes, Back buttons dip down.
  click() {
    if (!often('click', 40)) return;
    tone({ type: 'sine', f: 1150, f2: 520, dur: 0.05, vol: 0.2 });
    tone({ type: 'triangle', f: 2400, f2: 1900, dur: 0.018, vol: 0.05 });
    noise({ dur: 0.015, vol: 0.05, freq: 5000, filter: 'highpass' });
  },
  confirm() {
    if (!often('click', 40)) return;
    tone({ type: 'sine', f: 1150, f2: 520, dur: 0.05, vol: 0.16 });
    tone({ type: 'triangle', f: 784, dur: 0.1, vol: 0.12, delay: 0.02 });
    tone({ type: 'triangle', f: 1175, dur: 0.18, vol: 0.12, delay: 0.09 });
    tone({ type: 'sine', f: 2350, dur: 0.16, vol: 0.03, delay: 0.09 });
  },
  // Menus → the fight: a rising filtered whoosh with a low swell under it, over the music's crossfade.
  whoosh() {
    noise({ dur: 1.5, vol: 0.14, freq: 250, f2: 3600, filter: 'bandpass', q: 1.4, attack: 1.1 });
    tone({ type: 'sine', f: 55, f2: 110, dur: 1.5, vol: 0.18, attack: 1.0 });
    tone({ type: 'triangle', f: 220, f2: 440, dur: 1.3, vol: 0.04, delay: 0.2, attack: 0.9 });
  },
  back() {
    if (!often('click', 40)) return;
    tone({ type: 'sine', f: 900, f2: 380, dur: 0.07, vol: 0.18 });
    tone({ type: 'triangle', f: 660, f2: 520, dur: 0.08, vol: 0.06, delay: 0.03 });
  },
  start() { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, delay: i * 0.07 })); },
};

/* ---------- volume and mute controls ---------- */
/* ---------- the gear menu (user: a gear instead of the mute button and slider) ---------- */
const gearBtn = document.getElementById('gear');
const soundPanel = document.getElementById('sound-panel');
const muteBtn = document.getElementById('mute');
const VOL_IDS = ['master', 'music', 'level', 'sfx'];

function renderAudio() {
  for (const k of VOL_IDS) {
    const el = document.getElementById(`vol-${k}`), pct = Math.round(audio.vols[k] * 100);
    el.value = pct;
    el.style.setProperty('--v', `${pct}%`);
    document.getElementById(`vol-${k}-n`).textContent = `${pct}%`;
  }
  gearBtn.classList.toggle('is-muted', audio.muted);
  gearBtn.title = audio.muted ? 'Sound settings (muted, M to unmute)' : 'Sound settings';
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.querySelector('span').textContent = audio.muted ? 'Unmute' : 'Mute all';
  soundPanel.classList.toggle('is-muted', audio.muted);
}

function toggleMute() {
  audio.muted = !audio.muted;
  if (!audio.muted && audio.vols.master === 0) audio.vols.master = VOL_DEFAULT.master;   // unmuting at zero would still be silent
  applyVolume(); renderAudio(); saveAudio();
  if (!audio.muted) SFX.click();
}

function openSoundPanel(on) {
  soundPanel.hidden = !on;
  gearBtn.setAttribute('aria-expanded', String(on));
  if (on) {
    // opening it mid-run pauses the fight
    if (!game.inMenu && !game.over && !game.choosing && !game.paused && !game.practice && deck) setPaused(true);
    document.getElementById('vol-master').focus();
  }
}
gearBtn.addEventListener('click', () => { openSoundPanel(soundPanel.hidden); SFX.click(); });
muteBtn.addEventListener('click', toggleMute);
for (const k of VOL_IDS) {
  const el = document.getElementById(`vol-${k}`);
  el.addEventListener('input', () => {
    audio.vols[k] = el.value / 100;
    if (k === 'master' && audio.vols.master > 0) audio.muted = false;
    applyVolume(); renderAudio();
  });
  el.addEventListener('change', () => { saveAudio(); SFX.click(); });   // a click at the new level, as a preview
}
// Esc or a click outside closes it (before Esc can pause the game or go back a screen).
addEventListener('keydown', e => {
  if (e.code === 'Escape' && !soundPanel.hidden) { openSoundPanel(false); gearBtn.focus(); e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
document.addEventListener('pointerdown', e => { if (!soundPanel.hidden && !e.target.closest('#audio')) openSoundPanel(false); });
renderAudio();

// A click sound for every menu button: Start-type buttons chime, Back buttons dip, the rest pop.
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.menu button, .pause button:not(.upcard), .hud button, .practice button');
  if (!b || b.disabled || b.closest('.builder')) return;   // the deck builder plays its own sounds
  if (b.classList.contains('start')) SFX.confirm();
  else if (b.classList.contains('back')) SFX.back();
  else SFX.click();
});
