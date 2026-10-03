/* boss3d.js — SKURTOSAURUS's and OBI ONE's effects in 3D (v0.70, user: "make the other 2 bosses in 3D together with
   their effects"; v0.71, user: "revert back the dinosaur and obi; just the effects should be 3D"). */
'use strict';

/* The bosses themselves are drawn flat again (draw.js drawBoss, obi.js drawObiFlat), and this lays their light on top,
   made the way MAKORA's is (makora3d.js), sharing its three.js, renderer and camera: a scene of glowing shapes each,
   added onto the arena. Where each one goes comes from the flat drawing: it pins those spots as it draws (fxPin: the
   eye, the mouth, the hands, the blade's ends). Their warnings (the lanes, dashed lines, red cones), auras and the
   force's ripples stay flat. Until three.js is in (or without WebGL, or in the hitbox editor) the flat effects are drawn
   instead. Numbers are placeholders. */
let B3S = null, B3O = null;                             // their scenes, built the first time each is drawn
const b3Ok = () => m3dOk() && !boneHL;                  // (the hitbox editor paints the flat drawing's parts)

// A spot on the flat drawing, in the arena (the bosses' drawings call this as they draw: `e.pins[name]`). `boneInv`
// (combat.js) undoes the view, as for the hitbox parts.
function fxPin(e, name, x, y) {
  if (!boneInv || !e.pins) return;
  const p = boneInv.multiply(ctx.getTransform()).transformPoint(new DOMPoint(x, y));
  e.pins[name] = { x: p.x, y: p.y };
}

/* ---------- what both are made of ---------- */
// Slashes on the ground, streaks, shockwaves, soft flares, a trail, a curved shield.
function b3Kit() {
  const T = M3.T, scene = new T.Scene(), quad = new T.PlaneGeometry(1, 1);
  const K = { T, scene, at: performance.now(), time: 0, prev: '', rings: [], trail: [] };
  const glow = (frag, u = {}) => new T.ShaderMaterial({ vertexShader: M3_VERT, fragmentShader: frag, uniforms: { uCol: { value: new T.Color() }, uAlpha: { value: 1 }, uTime: { value: 0 }, ...u },
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending });
  const mesh = (geo, m) => { const x = new T.Mesh(geo, m); x.visible = false; x.frustumCulled = false; scene.add(x); return x; };
  K.fx = {
    arcs: [0, 1].map(() => mesh(quad, glow(M3_ARC, { uA0: { value: 0 }, uA1: { value: 1 }, uIn: { value: 0.6 }, uHot: { value: 1 } }))),
    beams: Array.from({ length: 4 }, () => mesh(quad.clone().translate(0.5, 0, 0), glow(M3_BEAM, { uIn: { value: 0.05 } }))),
    ringMs: Array.from({ length: 6 }, () => mesh(quad, glow(M3_RING, { uW: { value: 0.06 } }))),
    shields: [mesh(quad, glow(B3_SHIELD, { uA: { value: 1.35 }, uIn: { value: 0.8 } }))],
    flares: Array.from({ length: 6 }, () => mesh(quad, new T.MeshBasicMaterial({ map: b3Soft(), color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }))),
  };
  const TN = 14, tg = new T.BufferGeometry(), idx = [];
  tg.setAttribute('position', new T.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
  tg.setAttribute('aA', new T.BufferAttribute(new Float32Array(TN * 2), 1));
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  tg.setIndex(idx);
  K.trailN = TN;
  K.trailM = mesh(tg, new T.ShaderMaterial({ vertexShader: M3_TRAIL_V, fragmentShader: M3_TRAIL_F, uniforms: { uCol: { value: new T.Color() } }, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  return K;
}
// A curved shield: a band round the quad's middle, from -uA to uA (radians, 0 = +x), even all along, its edge brightest.
const B3_SHIELD = `uniform vec3 uCol; uniform float uA, uIn, uAlpha, uTime; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; p.y = -p.y;
  float r = length(p), a = atan(p.y, p.x);
  if (r > 1.0 || abs(a) > uA) discard;
  float mid = (1.0 + uIn) * 0.5, hw = (1.0 - uIn) * 0.5, d = abs(r - mid) / hw;
  float ends = smoothstep(uA, uA - 0.25, abs(a)), shim = 0.75 + 0.25 * sin(uTime * 22.0 + a * 9.0);
  float I = (exp(-d * d * 3.0) * 0.9 + smoothstep(1.0, 0.0, d) * 0.25) * ends * shim * uAlpha;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), exp(-d * d * 12.0) * 0.6) * I, 1.0);
}`;
let b3SoftTex = null;
function b3Soft() {
  if (b3SoftTex) return b3SoftTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (b3SoftTex = new M3.T.CanvasTexture(c));
}

// This frame's effects: hide them all, then `take` one of a kind each time it's used.
function b3FxStart(K) {
  K.used = {};
  for (const key in K.fx) for (const o of K.fx[key]) o.visible = false;
}
function b3Take(K, key) {
  const n = K.used[key] || 0, o = K.fx[key][n];
  K.used[key] = n + 1;
  if (o) { o.visible = true; o.material.uniforms?.uTime && (o.material.uniforms.uTime.value = K.time); }
  return o;
}
const b3U = (o, u) => { for (const key in u) { const v = o.material.uniforms[key]; if (v.value?.isColor) v.value.set(u[key]); else v.value = u[key]; } };
function b3Arc(K, x, y, a, R, a0, a1, inner, alpha, col, flip = false) {
  const o = b3Take(K, 'arcs'); if (!o) return;
  m3At(o, x, y, 10); o.scale.set(R * 2, R * 2 * (flip ? -1 : 1), 1); o.rotation.z = -a;
  b3U(o, { uA0: a0, uA1: a1, uIn: inner, uAlpha: alpha, uCol: col, uHot: 1 });
}
function b3Beam(K, x, y, a, len, wid, alpha, col, fadeIn = 0.05) {
  const o = b3Take(K, 'beams'); if (!o) return;
  m3At(o, x, y, 20); o.scale.set(len, wid, 1); o.rotation.z = -a;
  b3U(o, { uAlpha: alpha, uCol: col, uIn: fadeIn });
}
function b3Flare(K, x, y, size, alpha, col) {
  const o = b3Take(K, 'flares'); if (!o) return;
  m3At(o, x, y, 30); o.scale.set(size, size, 1); o.material.color.set(col); o.material.opacity = Math.min(1, Math.max(0, alpha));
}
function b3Ring(K, x, y, R, alpha, col, wid = 0.07) {
  const o = b3Take(K, 'ringMs'); if (!o) return;
  m3At(o, x, y, 5); o.scale.set(R * 2, R * 2, 1); b3U(o, { uAlpha: alpha, uCol: col, uW: wid });
}
// Shockwaves that play out on their own (pushed when something lands, roars, breaks free …).
function b3Rings(K, dt) {
  for (const r of K.rings) { r.t += dt; const q = r.t / r.life; if (q < 1) b3Ring(K, r.x, r.y, r.R * m3Ease(q * 1.3), (1 - q) * (r.a ?? 1), r.col, r.w ?? 0.08); }
  K.rings = K.rings.filter(r => r.t < r.life);
}
// The blade's trail: a ribbon through where the blade has been while `on`.
function b3Trail(K, base, tip, on, col, dt) {
  if (on) K.trail.unshift([base.x, base.y, tip.x, tip.y, 1]);
  for (const s of K.trail) s[4] -= dt * 5;
  K.trail = K.trail.filter(s => s[4] > 0).slice(0, K.trailN);
  const m = K.trailM, tp = m.geometry.attributes.position, ta = m.geometry.attributes.aA;
  m.visible = K.trail.length > 1;
  for (let i = 0; i < K.trailN; i++) {
    const s = K.trail[Math.min(i, K.trail.length - 1)] || [0, 0, 0, 0, 0], a = K.trail.length > i ? s[4] * (1 - i / K.trailN) : 0;
    tp.setXYZ(i * 2, s[0], s[1], 40); tp.setXYZ(i * 2 + 1, s[2], s[3], 40);
    ta.setX(i * 2, a * 0.25); ta.setX(i * 2 + 1, a);
  }
  tp.needsUpdate = ta.needsUpdate = true;
  m.material.uniforms.uCol.value.set(col);
}
// The frame (the view, as MAKORA's: makora3d.js m3dFrame), then the light added onto the arena.
function b3Render(K) {
  const vw = VW / viewZoom, vh = VH / viewZoom, x0 = cam.x, y0 = cam.y;
  const w = Math.max(16, Math.min(2048, Math.ceil(vw / M3D.px))), h = Math.max(16, Math.min(2048, Math.ceil(vh / M3D.px)));
  if (M3.canvas.width !== w || M3.canvas.height !== h) M3.gl.setSize(w, h, false);
  Object.assign(M3.cam, { left: x0, right: x0 + vw, top: -y0, bottom: -(y0 + vh) });
  M3.cam.updateProjectionMatrix();
  M3.cam.layers.set(0); M3.gl.setClearColor(0x000000, 1); M3.gl.render(K.scene, M3.cam);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(M3.canvas, x0, y0, vw, vh);
  ctx.restore();
}
function b3Clock(K) {
  const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - K.at) / 1000));
  K.at = now; K.time += dt;
  return dt;
}
// Draws one: the error path turns 3D off for good (the flat effects are drawn from then on).
function b3Draw(fn) {
  try { fn(); } catch (err) { M3D.status = 'failed'; M3D.err = err?.message || String(err); console.warn('Boss 3D is off:', err); }
}

/* ---------- SKURTOSAURUS ---------- */
function b3Skurt(b) { b3Draw(() => b3SkurtFrame(b)); }
function b3SkurtFrame(b) {
  const K = B3S || (B3S = b3Kit()), dt = b3Clock(K), still = reducedMotion, P = b.pins || {};
  const k = (b.size || b.r) * (0.5 + 0.5 * b.born) / 30, st = b.state, red = COL.bad, ph2 = b.phase === 2;
  const fury = ph2 || st === 'windup' || st === 'charge' || st === 'jump' || st === 'enrage';
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(K.time * 6);
  b3FxStart(K);
  if (fury && P.eye) b3Flare(K, P.eye.x, P.eye.y, 16 * k, 0.55 + 0.25 * pulse, red);   // its eye burning
  if (st === 'charge') b3Beam(K, b.x, b.y - 6 * k, b.dir + Math.PI, 150 * k / 2.2, 48 * k / 2.2, 0.45, ph2 ? red : '#ffcf8a', 0.1);   // a streak behind it
  if (st === 'enrage' && P.mouth) {                          // the roar: rings bursting out of its mouth, a red glow
    const m = P.mouth;
    b3Flare(K, m.x, m.y, 110 * k / 2.2 * (1 + 0.1 * pulse), 0.55, red);
    if ((K.roarT = (K.roarT || 0) - dt) <= 0) { K.roarT = 0.22; K.rings.push({ x: m.x, y: m.y, R: 160 * k / 2.2, t: 0, life: 0.55, col: red, w: 0.09 }); }
  }
  if (K.prev === 'jump' && st !== 'jump') {                  // it lands: a shockwave and a dusty glow
    K.rings.push({ x: b.x, y: b.y + b.r * 0.85, R: b.r * 2.3, t: 0, life: 0.5, col: ph2 ? red : '#ffd9a0', w: 0.1 });
    K.rings.push({ x: b.x, y: b.y + b.r * 0.85, R: b.r * 1.4, t: 0, life: 0.35, col: '#ffffff', a: 0.6, w: 0.05 });
  }
  if (K.prev === 'walk' && b.recoil > BOSS.throwRecover * 0.9) K.flung = 0.15;   // the throw: a flash off its arms
  if ((K.flung = Math.max(0, (K.flung || 0) - dt)) > 0 && P.hand) b3Flare(K, P.hand.x, P.hand.y, 70 * k / 2.2, K.flung / 0.15, '#ffe6b0');
  K.prev = st;
  b3Rings(K, dt);
  K.trailM.visible = false;
  b3Render(K);
}

/* ---------- OBI ONE ---------- */
function b3Obi(o) { b3Draw(() => b3ObiFrame(o)); }
function b3ObiFrame(o) {
  const K = B3O || (B3O = b3Kit()), dt = b3Clock(K), still = reducedMotion, P = o.pins || {};
  const k = obiUnit(o), st = o.state, ph2 = o.phase >= 2, sc = ph2 ? COL.saberBad : COL.saber;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(K.time * 5), flick = st === 'block' && !still ? 0.85 + 0.3 * Math.sin(K.time * 30) : 1;
  b3FxStart(K);
  const lit = P.sabB && P.sabT, y0 = o.y - 6 * k;
  b3Trail(K, P.sabB, P.sabT, lit && (st === 'slice' && o.sl?.struck || st === 'dash' || st === 'block'), sc, dt);   // the blade's trail
  if (st === 'slice' && o.sl?.struck) {                      // the cut sweeping round him, hottest at its edge
    const s = o.sl, S = s.spec || OBI.slice, q = Math.min(1, (s.t - s.tele) / S.anim), fade = 1 - m3Clamp((q - 0.6) / 0.5);
    const lead = -S.arc / 2 + S.arc * m3Ease(q * 1.3);
    b3Arc(K, o.x, y0, s.a, S.range * 0.9, -S.arc / 2, lead, 0.62, fade, sc, (s.dir || 1) < 0);
    b3Arc(K, o.x, y0, s.a, S.range * 0.66, -S.arc / 2, lead, 0.75, fade * 0.55, '#ffffff', (s.dir || 1) < 0);
  }
  if (st === 'block') {                                      // the guard: a curved shimmer in front of him
    const o2 = b3Take(K, 'shields'), a = o.aim ?? 0;
    if (o2) { m3At(o2, o.x + Math.cos(a) * 4 * k, o.y - 8 * k + Math.sin(a) * 4 * k, 25); o2.scale.set(68 * k, 68 * k, 1); o2.rotation.z = -a; b3U(o2, { uCol: sc, uAlpha: 0.75 * flick }); }
    if (lit) b3Flare(K, P.sabT.x, P.sabT.y, 26 * k, 0.5 * flick, sc);
  }
  if (st === 'dash') b3Beam(K, o.x, o.y - 8 * k, o.dir + Math.PI, 120 * k / 1.7, 30 * k / 1.7, 0.4, sc, 0.1);   // a streak behind him
  if (st === 'pull' && P.hand2) {                            // the force, gathered in his raised hand
    b3Flare(K, P.hand2.x, P.hand2.y, (40 + 10 * pulse) * k / 1.7, 0.75, COL.saber);
    b3Flare(K, P.hand2.x, P.hand2.y, 90 * k / 1.7, 0.25 + 0.15 * pulse, COL.saber);
  }
  if (st === 'focus' && P.chest) {                           // gathering the force: a glow round him, rings pulsing out
    b3Flare(K, P.chest.x, P.chest.y, 130 * k / 1.7 * (1 + 0.1 * pulse), 0.4, COL.saber);
    if ((K.focusT = (K.focusT || 0) - dt) <= 0) { K.focusT = 0.3; K.rings.push({ x: o.x, y: o.y, R: 110 * k / 1.7, t: 0, life: 0.6, col: COL.saber, w: 0.07 }); }
  }
  if (K.prev === 'pull' && st === 'stun') K.rings.push({ x: o.x, y: o.y - 8 * k, R: 90 * k / 1.7, t: 0, life: 0.45, col: COL.saber, w: 0.1 });   // you broke free
  if (lit) b3Flare(K, P.sabB.x, P.sabB.y, 16 * k, 0.45 * flick, sc);   // the emitter's glow
  K.prev = st;
  b3Rings(K, dt);
  b3Render(K);
}
