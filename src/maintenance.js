/* maintenance.js — the maintenance lock (v0.71, user: "make the play button disabled with a note saying maintenance;
   on localhost a switch to toggle it"). On every host except localhost the title screen's Start button is disabled, with
   a "Maintenance" note under it, while the lock is on. The lock is a flag in the database (docs/supabase-update-7.sql:
   get_maintenance, set by the Admin menu's "Live site" switch on localhost), asked for when the page loads and every
   minute after. It starts locked and only opens on an explicit "off", so with the database unreachable, or update 7 not
   run yet, the live site stays locked. localhost is never locked (add ?maint to the address to see how the lock looks). */
'use strict';

const MAINT = {
  local: /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:',
  on: true, pending: true, every: 60000,
};
if (MAINT.local) { MAINT.on = /[?&]maint\b/.test(location.search); MAINT.pending = false; }
const maintOn = () => MAINT.on;

function maintApply() {
  const btn = document.getElementById('btn-title'), note = document.getElementById('maint-note');
  if (btn) btn.disabled = MAINT.on || MAINT.pending;
  if (note) note.hidden = !MAINT.on || MAINT.pending;
}
async function maintCheck() {
  if (MAINT.local) return;
  try {
    const r = await fetch(`${SUPA.url}/rest/v1/rpc/get_maintenance`, {
      method: 'POST', headers: { apikey: SUPA.key, 'Content-Type': 'application/json' }, body: '{}' });
    if (r.ok) MAINT.on = (await r.json()) !== false;
  } catch (err) { /* offline: it stays as it was (locked, at first) */ }
  MAINT.pending = false;
  maintApply();
}
maintApply();
if (!MAINT.local) {
  maintCheck();
  setInterval(maintCheck, MAINT.every);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) maintCheck(); });
}
