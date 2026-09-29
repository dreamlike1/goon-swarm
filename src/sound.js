/* sound.js — Sound effects, made on the fly with the Web Audio API (no audio files), plus volume and mute. */
'use strict';

/* Browsers only allow sound after the player interacts, so the audio engine starts on the
   first click, tap or key press. The volume and mute setting is saved on this computer
   (separate from the game save, so Reset data keeps it). */
const AUDIO_KEY = 'rogue.audio';
const audio = { ctx: null, master: null, noise: null, vol: 0.6, muted: false, last: {} };

try {
  const a = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
  if (a && typeof a.vol === 'number') { audio.vol = Math.min(1, Math.max(0, a.vol)); audio.muted = !!a.muted; }
} catch (err) { /* defaults */ }

function saveAudio() {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ vol: audio.vol, muted: audio.muted })); } catch (err) { /* not saved */ }
}

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

// Squared so the slider feels even to the ear.
function applyVolume() {
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : audio.vol * audio.vol * 0.6;
}
const audible = () => audio.ctx && audio.ctx.state === 'running' && !audio.muted && audio.vol > 0;

function tone({ type = 'square', f = 440, f2 = null, dur = 0.08, vol = 0.2, delay = 0 }) {
  if (!audible()) return;
  const c = audio.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.2, freq = 1200, f2 = null, filter = 'lowpass', q = 1, delay = 0 }) {
  if (!audible()) return;
  const c = audio.ctx, t = c.currentTime + delay;
  const src = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
  src.buffer = audio.noise;
  bq.type = filter; bq.Q.value = q;
  bq.frequency.setValueAtTime(freq, t);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
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

const SFX = {
  fire(card) {
    if (!often('fire', 25)) return;
    switch (card) {
      case 'bullet':   tone({ f: 880, f2: 440, dur: 0.06, vol: 0.12 }); break;
      case 'dart':     tone({ f: 1500, f2: 900, dur: 0.04, vol: 0.09 }); break;
      case 'arcane':   tone({ type: 'sine', f: 520, f2: 800, dur: 0.15, vol: 0.18 }); tone({ type: 'triangle', f: 1040, f2: 1600, dur: 0.1, vol: 0.05 }); break;
      case 'cannon':   tone({ type: 'sine', f: 150, f2: 45, dur: 0.32, vol: 0.5 }); noise({ dur: 0.18, vol: 0.25, freq: 600 }); break;
      case 'shuriken': tone({ type: 'triangle', f: 1800, f2: 2700, dur: 0.08, vol: 0.08 }); noise({ dur: 0.1, vol: 0.07, freq: 4000, filter: 'highpass' }); break;
      case 'spaceimpact': noise({ dur: 0.35, vol: 0.14, freq: 500, f2: 2600, filter: 'bandpass', q: 1.2 }); tone({ type: 'square', f: 220, f2: 660, dur: 0.3, vol: 0.05 }); break;
      case 'mine': tone({ type: 'triangle', f: 320, f2: 180, dur: 0.08, vol: 0.12 }); tone({ type: 'square', f: 1400, dur: 0.02, vol: 0.05, delay: 0.09 }); break;
      case 'firebolt': noise({ dur: 0.22, vol: 0.25, freq: 900, f2: 3200, filter: 'bandpass', q: 0.8 }); tone({ type: 'sawtooth', f: 300, f2: 120, dur: 0.2, vol: 0.08 }); break;
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
  combo(n) { [440, 554, 659, 880].slice(0, n >= 7 ? 4 : 3).forEach((f, i) => tone({ type: 'square', f, dur: 0.08, vol: 0.06, delay: i * 0.035 })); },
  pulse() { if (often('pulse', 60)) { tone({ type: 'sine', f: 260, f2: 520, dur: 0.18, vol: 0.16 }); noise({ dur: 0.15, vol: 0.08, freq: 1200, filter: 'bandpass' }); } },
  potion() { [523, 784].forEach((f, i) => tone({ type: 'sine', f, f2: f * 1.5, dur: 0.14, vol: 0.14, delay: i * 0.06 })); },
  wheelTick() { if (often('tick', 25)) tone({ type: 'square', f: 1800, dur: 0.015, vol: 0.04 }); },
  boom() { if (!often('boom', 60)) return; noise({ dur: 0.5, vol: 0.45, freq: 900, f2: 120 }); tone({ type: 'sine', f: 110, f2: 35, dur: 0.45, vol: 0.45 }); },
  burst() { noise({ dur: 0.5, vol: 0.28, freq: 400, f2: 3000, filter: 'bandpass', q: 0.8 }); [330, 440, 660].forEach((f, i) => tone({ type: 'square', f, f2: f * 2, dur: 0.18, vol: 0.06, delay: i * 0.04 })); },
  rapid() { [0, 0.05, 0.1].forEach(d => tone({ f: 1320, f2: 990, dur: 0.035, vol: 0.07, delay: d })); },
  click() { if (often('click', 40)) tone({ type: 'triangle', f: 540, f2: 680, dur: 0.05, vol: 0.08 }); },
  start() { [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.14, vol: 0.12, delay: i * 0.07 })); },
};

/* ---------- volume and mute controls ---------- */
const muteBtn = document.getElementById('mute');
const volEl = document.getElementById('vol');

function renderAudio() {
  const off = audio.muted || audio.vol === 0;
  muteBtn.classList.toggle('is-muted', off);
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
  muteBtn.title = audio.muted ? 'Unmute (M)' : 'Mute (M)';
  volEl.value = Math.round(audio.vol * 100);
  volEl.style.setProperty('--v', `${Math.round(audio.vol * 100)}%`);
}

function toggleMute() {
  audio.muted = !audio.muted;
  if (!audio.muted && audio.vol === 0) audio.vol = 0.6;  // unmuting at zero volume would still be silent
  applyVolume(); renderAudio(); saveAudio();
  if (!audio.muted) SFX.click();
}

muteBtn.addEventListener('click', toggleMute);
volEl.addEventListener('input', () => {
  audio.vol = volEl.value / 100;
  if (audio.vol > 0) audio.muted = false;
  applyVolume(); renderAudio();
});
volEl.addEventListener('change', () => { saveAudio(); SFX.click(); });
renderAudio();

// A soft click for every menu button (not the mute button, which plays its own).
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.menu button, .pause button:not(.upcard), .hud button');
  if (b && !b.disabled) SFX.click();
});
