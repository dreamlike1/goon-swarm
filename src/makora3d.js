/* makora3d.js — MAKORA in 3D (v0.69, user: "if you can, make makora 3D … attacks and effects must be really nice
   and beautiful 3d"). */
'use strict';

/* How it fits a flat game: three.js (loaded from a CDN the first time a run starts; the flat drawing in makora.js
   stands in until then, or if it can't load or WebGL is off) draws into its own canvas with a straight-on
   orthographic camera framed exactly on the view, so a point of the arena is the same point in 3D (x, -y). MAKORA
   stands on its feet there, tilted back a little (`tilt`) so we look down on it as on everything else, and turns to
   face where it's aiming. Two passes, each drawn onto the arena where MAKORA is drawn:
   - solid: MAKORA itself (toon-shaded, outlined like the rest of the game's art), its rock, the rock's shards, and
     the void inside the rifts;
   - glow: everything made of light, added on top ('lighter'): its slashes sweeping round it, the stab's streak, the
     sword's trail, the lasers, the pillars of light, the rifts' edges, shockwaves, its aura and sparks.
   The canvas is a little coarser than the screen (`px` arena px to one of its pixels) and blown up with hard edges,
   for the same chunky look as the arena. Its rig is groups of simple shapes (no model file): hips, spine, chest,
   head, arms and legs, posed every frame from what it's doing (makora.js m.state, m.act), easing between poses. Its
   warnings stay flat red shapes on the ground (makora.js), as every other boss's. Numbers are placeholders. */
const M3D = {
  libs: ['https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js', 'https://unpkg.com/three@0.149.0/build/three.min.js'],
  px: 1.5,            // arena px to one 3D pixel
  tilt: 0.42,         // how far we look down on it (radians)
  ol: 1.05,           // its outline, in its units (30 = its radius)
  status: 'idle', err: '',
};
let M3 = null;                                         // the renderer, scene, rig and effects, once it's in

// Loads three.js (once), from the first CDN that answers, then builds MAKORA.
function m3dLoad() {
  if (M3D.status !== 'idle') return;
  M3D.status = 'loading';
  const load = src => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = () => fail(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
  (async () => {
    for (const src of M3D.libs) {
      if (window.THREE?.WebGLRenderer) break;
      try { await load(src); } catch (err) { M3D.err = err.message; }
    }
    try {
      if (!window.THREE?.WebGLRenderer) throw new Error(M3D.err || 'three.js did not load');
      m3dInit();
      M3D.status = 'ready';
    } catch (err) { M3D.status = 'failed'; M3D.err = err?.message || String(err); console.warn('MAKORA 3D is off:', M3D.err); }
  })();
}
const m3dOk = () => M3D.status === 'ready';

/* ---------- shaders: the light effects (all added on top of a black canvas) ---------- */
const M3_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// A slash sweeping round it on the ground: an arc band from uA0 to uA1 (radians, 0 = where it aims, the arena's y
// down), from uIn to 1 of the quad's radius, thickest and hottest at its leading edge.
const M3_ARC = `uniform vec3 uCol; uniform float uA0, uA1, uIn, uAlpha, uHot; varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; p.y = -p.y;
  float r = length(p), a = atan(p.y, p.x), u = (a - uA0) / max(uA1 - uA0, 0.001);
  if (u < 0.0 || u > 1.0 || r > 1.0) discard;
  float mid = (1.0 + uIn) * 0.5, hw = (1.0 - uIn) * 0.5 * (0.3 + 0.7 * u);
  float d = abs(r - mid) / max(hw, 0.001);
  float band = smoothstep(1.0, 0.0, d), core = smoothstep(0.5, 0.0, d) * smoothstep(0.55, 1.0, u);
  float I = band * pow(u, 1.5) * uAlpha;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), clamp(core * uHot + smoothstep(0.92, 1.0, u) * 0.6, 0.0, 1.0)) * I * 1.5, 1.0);
}`;
// A beam along +x of its quad: a white-hot core in a coloured glow, flickering, fading in at its start and out at its end.
const M3_BEAM = `uniform vec3 uCol; uniform float uAlpha, uTime, uIn; varying vec2 vUv;
void main() {
  float c = vUv.y * 2.0 - 1.0, core = exp(-c * c * 70.0), glow = exp(-c * c * 5.0);
  float flick = 0.82 + 0.18 * sin(uTime * 70.0 + vUv.x * 50.0);
  float I = (core * 1.5 + glow * 0.7) * flick * smoothstep(0.0, uIn, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x)) * uAlpha;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), core) * I, 1.0);
}`;
// A pillar of light from the ground up: the same core and glow, brighter at its foot, fading out up top.
const M3_PILLAR = `uniform vec3 uCol; uniform float uAlpha, uTime; varying vec2 vUv;
void main() {
  float c = vUv.x * 2.0 - 1.0, core = exp(-c * c * 30.0), glow = exp(-c * c * 3.5);
  float rip = 0.85 + 0.15 * sin(uTime * 40.0 - vUv.y * 30.0);
  float I = (core * 1.4 + glow * 0.6) * rip * (1.0 - smoothstep(0.5, 1.0, vUv.y)) * uAlpha + exp(-vUv.y * 25.0) * glow * uAlpha;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), core) * I, 1.0);
}`;
// A shockwave: a bright ring at the quad's edge, `uW` thick, a faint glow inside.
const M3_RING = `uniform vec3 uCol; uniform float uAlpha, uW; varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  if (r > 1.0) discard;
  float d = (r - 0.9) / uW, I = (exp(-d * d) + smoothstep(0.2, 0.9, r) * 0.12) * uAlpha;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), exp(-d * d * 4.0) * 0.5) * I, 1.0);
}`;
// A rift: a tall jagged tear. Its void (the solid pass: dark, swirling) and its edge (the glow pass), `uOpen` 0–1.
const M3_RIFT = `uniform vec3 uCol, uVoid; uniform float uOpen, uTime, uEdge, uSX; varying vec2 vUv;
float tearW(float y) {
  float base = pow(max(0.0, 1.0 - y * y), 0.6), jag = 0.2 * sin(y * 19.0 + uTime * 2.3) + 0.12 * sin(y * 43.0 - uTime * 3.7);
  return max(0.0, base * (0.8 + jag * base)) * uOpen * 0.85;
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float w = tearW(p.y), x = abs(p.x) * uSX;
  if (uEdge < 0.5) {
    float inside = smoothstep(w, w - 0.08, x);
    if (inside <= 0.0 || w <= 0.0) discard;
    float swirl = 0.5 + 0.5 * sin(p.y * 13.0 + uTime * 5.0 + x * 25.0);
    gl_FragColor = vec4(mix(uVoid, uCol * 0.45, swirl * 0.5 * (1.0 - x / max(w, 0.001))), inside);
  } else {
    if (w <= 0.0) discard;
    float e = exp(-pow((x - w) / 0.08, 2.0)), halo = exp(-pow(max(0.0, x - w) / 0.45, 2.0)) * 0.4;
    float I = (e * 1.4 + halo) * (0.8 + 0.2 * sin(uTime * 13.0 + p.y * 9.0));
    gl_FragColor = vec4(mix(uCol, vec3(1.0), e * 0.6) * I, 1.0);
  }
}`;
// Sparks and motes: soft round points, each its own colour and size.
const M3_PTS_V = 'attribute float aSize; attribute vec4 aCol; varying vec4 vCol; void main() { vCol = aCol; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const M3_PTS_F = 'varying vec4 vCol; void main() { vec2 c = gl_PointCoord * 2.0 - 1.0; float d = dot(c, c); if (d > 1.0) discard; float I = exp(-d * 3.0) * vCol.a; gl_FragColor = vec4(mix(vCol.rgb, vec3(1.0), exp(-d * 12.0) * 0.7) * I, 1.0); }';
// The sword's trail: a ribbon through where its blade has been, brightest toward the tip and the newest.
const M3_TRAIL_V = 'attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const M3_TRAIL_F = 'uniform vec3 uCol; varying float vA; void main() { gl_FragColor = vec4(mix(uCol, vec3(1.0), vA * 0.5) * vA, 1.0); }';

/* ---------- building it ---------- */
function m3dInit() {
  const T = THREE, canvas = document.createElement('canvas');
  const gl = new T.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  gl.setPixelRatio(1);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); M3D.status = 'failed'; M3D.err = 'WebGL context lost'; });
  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
  scene.add(new T.HemisphereLight(0xdfe4f5, 0x2a2430, 0.42));
  const key = new T.DirectionalLight(0xffffff, 0.78); key.position.set(-0.55, 0.85, 0.9); scene.add(key);
  const rim = new T.DirectionalLight(0xffcf6b, 0.75); rim.position.set(0.8, 0.5, -1.0); scene.add(rim);
  const col = c => new T.Color(c);
  const ramp = new T.DataTexture(new Uint8Array([48, 48, 48, 255, 118, 118, 118, 255, 205, 205, 205, 255]), 3, 1, T.RGBAFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  const toon = (c, o = {}) => new T.MeshToonMaterial({ color: col(c), gradientMap: ramp, ...o });
  const mat = {
    skin: toon(COL.makora), dark: toon(COL.makoraDark), band: toon(COL.makoraBand), cloth: toon(COL.makoraCloth, { side: T.DoubleSide }),
    clothIn: toon(COL.makoraClothDark, { side: T.BackSide }), mouth: toon(COL.makoraMouth),
    gold: toon(COL.wheel, { emissive: col(COL.wheelDark), emissiveIntensity: 0.35 }), blade: toon('#eef2f8', { emissive: col('#9fb4d8'), emissiveIntensity: 0.25 }),
    rock: toon(COL.rock), rockDark: toon(COL.rockDark),   // (faceted: the rock's geometry has a normal per face)
  };
  const ol = new T.MeshBasicMaterial({ color: col(COL.makoraLine), side: T.BackSide });
  ol.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${M3D.ol.toFixed(2)};`); };
  const rockOl = new T.MeshBasicMaterial({ color: col(COL.crack), side: T.BackSide });
  rockOl.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.07;'); };
  M3 = { T, gl, canvas, scene, cam, mat, ol, rockOl, col, ramp, time: 0, at: performance.now(), cur: {}, fx: { shards: [], rings: [] }, rocks: new Map(), trail: [] };   // (ramp: boss3d.js's toon materials too)
  M3.rig = m3dRig();
  scene.add(M3.rig.root);
  m3dEffects();
  // a first frame now, so its shaders are compiled before it's needed
  gl.setSize(64, 64, false);
  gl.render(scene, cam);
}

// MAKORA: grey and muscular, a small eyeless head with feathered wings fanning out of it, the gold eight-spoked
// wheel floating above, a dark cloth wrapped at the waist, black rings on its limbs, and a long blade on its right
// arm. Units: 30 = its radius in the arena; feet at 0, head at ~100, its wheel at ~128. It faces +z.
function m3dRig() {
  const T = M3.T, M = M3.mat, G = () => new T.Group();
  const sphere = (rx, ry = rx, rz = rx, w = 16, h = 12) => new T.SphereGeometry(1, w, h).scale(rx, ry, rz);
  const add = (parent, geo, m, x = 0, y = 0, z = 0, outline = true) => {
    const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); parent.add(mesh);
    if (outline) mesh.add(new T.Mesh(geo, M3.ol));
    return mesh;
  };
  // a limb segment hanging from its joint: a capsule `len` long, radius r
  const seg = (parent, r, len, m = M.skin) => add(parent, new T.CapsuleGeometry(r, len, 4, 12).translate(0, -len / 2 - r * 0.2, 0), m);
  const ring = (parent, r, tube, y) => { const g = new T.TorusGeometry(r, tube, 8, 20).rotateX(Math.PI / 2); return add(parent, g, M.band, 0, y, 0); };
  const J = {};
  J.root = G(); J.tilt = G(); J.root.add(J.tilt); J.tilt.rotation.x = M3D.tilt;
  J.body = G(); J.tilt.add(J.body);
  J.hips = G(); J.hips.position.y = 48; J.body.add(J.hips);
  // the legs: a wide, bent-kneed stance, black rings at the ankles, bare feet
  for (const s of [1, -1]) {
    const th = G(); th.position.set(s * 9, -2, 0); th.rotation.order = 'YXZ'; J.hips.add(th);
    seg(th, 7.2, 15);
    const kn = G(); kn.position.y = -21; th.add(kn);
    add(kn, sphere(6.4, 6.4, 6.4, 10, 8), M.skin, 0, 0, 0.6, false);   // the knee
    seg(kn, 6, 14);
    const ft = G(); ft.position.y = -20; kn.add(ft);
    ring(ft, 6.2, 1.7, 3.5);
    add(ft, sphere(5.6, 3.2, 9, 12, 8), M.skin, 0, -2, 4);
    J[s > 0 ? 'thR' : 'thL'] = th; J[s > 0 ? 'knR' : 'knL'] = kn; J[s > 0 ? 'ftR' : 'ftL'] = ft;
  }
  // the cloth: a ragged wrap flaring from the waist, a dark belt
  const skirt = new T.CylinderGeometry(14, 21, 25, 22, 3, true).translate(0, -10, 0);
  const pos = skirt.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -20) pos.setY(i, pos.getY(i) + Math.sin(i * 2.7) * 3 + Math.sin(i * 1.3) * 2);
  skirt.computeVertexNormals();
  add(J.hips, skirt, M.cloth, 0, 0, 0, false); add(J.hips, skirt, M.clothIn, 0, 0, 0, false);
  ring(J.hips, 13.6, 2.6, 2);
  add(J.hips, sphere(4.2, 3.2, 2.6), M.band, -4, 1, 13, false);   // the knot
  // the body
  J.spine = G(); J.spine.position.y = 4; J.hips.add(J.spine);
  add(J.spine, sphere(12.5, 13, 9.5), M.skin, 0, 8, 0.5);         // the waist
  for (const [y, w] of [[13, 3.6], [8.6, 3.5], [4.4, 3.2]]) for (const s of [1, -1]) add(J.spine, sphere(w, 2.1, 1.4, 8, 6), M.dark, s * 3.6, y, 9, false);   // the six-pack
  J.chest = G(); J.chest.position.y = 17; J.spine.add(J.chest);
  add(J.chest, sphere(19.5, 13.5, 11.5, 20, 14), M.skin, 0, 7, 0);
  for (const s of [1, -1]) add(J.chest, sphere(10, 6.4, 4.4).rotateZ(s * -0.18), M.skin, s * 8.4, 4.5, 7.4);   // pecs
  J.neck = G(); J.neck.position.y = 18; J.chest.add(J.neck);
  add(J.neck, new T.CylinderGeometry(4.4, 5.2, 9, 12), M.skin, 0, 2, 0);
  J.head = G(); J.head.position.y = 8; J.neck.add(J.head);
  add(J.head, sphere(6.8, 8.8, 7.4), M.skin, 0, 4.5, 0);
  add(J.head, sphere(2.8, 2.4, 1.8, 10, 8), M.mouth, 0, 0.6, 6.4, false);   // eyeless; its mouth open
  // the wings fanning out of its head: four long feathers a side, ragged at the edge
  const feather = (() => {
    const s = new T.Shape(); s.moveTo(0, -1.6);
    const n = 6;
    for (let i = 1; i <= n; i++) { const u = i / n, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * 0.4) * 4.2; s.lineTo(u * 30 + 2, -w * 1.1); s.lineTo(u * 30, -w * 0.55); }
    s.lineTo(32, 0);
    for (let i = n; i >= 1; i--) { const u = i / n, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * 0.4) * 4.2; s.lineTo(u * 30, w * 0.5); s.lineTo(u * 30 + 2, w * 0.95); }
    s.lineTo(0, 1.6);
    return new T.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 1 }).translate(0, 0, -0.45);
  })();
  // (each along +x, tilted up by its Z turn, then turned out to its side and a little back)
  for (const s of [1, -1]) for (const [a, l, b] of [[0.75, 1, 0.25], [0.42, 0.92, 0.35], [0.1, 0.82, 0.45], [-0.22, 0.7, 0.5]]) {
    const f = G(); f.position.set(s * 5.2, 7, -1.5); f.rotation.set(0, s > 0 ? b : Math.PI - b, a); f.scale.setScalar(l * 1.2);
    J.head.add(f);
    add(f, feather, a > 0.3 ? M.skin : M.dark);
  }
  // the arms: a deltoid, the upper arm, the forearm with its black ring, the fist; the blade on the right one
  for (const s of [1, -1]) {
    const sh = G(); sh.position.set(s * 21, 10, 0); sh.rotation.order = 'YXZ'; J.chest.add(sh);
    add(sh, sphere(7.8, 7, 7.4), M.skin, s * 1.5, 1, 0);
    seg(sh, 5.9, 13);
    const el = G(); el.position.y = -20; sh.add(el);
    seg(el, 5.1, 12);
    ring(el, 5.6, 1.6, -10);
    const hand = G(); hand.position.y = -18.5; el.add(hand);
    add(hand, sphere(5.6, 5.8, 5.6, 12, 10), M.skin);
    J[s > 0 ? 'shR' : 'shL'] = sh; J[s > 0 ? 'elR' : 'elL'] = el; J[s > 0 ? 'handR' : 'handL'] = hand;
  }
  // the blade: long, curving a little, with a guard, carrying on from the right forearm past the fist
  const blade = new T.Shape();
  blade.moveTo(-3.4, 0); blade.quadraticCurveTo(-4.4, 30, -1.2, 62); blade.lineTo(0.6, 66); blade.quadraticCurveTo(3.8, 34, 3.4, 0); blade.lineTo(-3.4, 0);
  const bladeGeo = new T.ExtrudeGeometry(blade, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 }).translate(0, 0, -0.6).rotateX(Math.PI);
  J.blade = G(); J.blade.position.y = -3; J.handR.add(J.blade);
  add(J.blade, bladeGeo, M.blade);
  add(J.blade, new T.BoxGeometry(11, 2.6, 5), M.band, 0, -1, 0);
  J.bladeBase = G(); J.bladeBase.position.y = -14; J.blade.add(J.bladeBase);
  J.bladeTip = G(); J.bladeTip.position.y = -64; J.blade.add(J.bladeTip);
  // the wheel: gold, eight spokes ending in knobs, a hub; it floats over its head, facing us
  J.halo = G(); J.body.add(J.halo);
  J.wheel = G(); J.halo.add(J.wheel);
  add(J.wheel, new T.TorusGeometry(10, 1.7, 8, 28), M.gold);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, sp = new T.CylinderGeometry(1.15, 1.15, 13, 6).rotateZ(Math.PI / 2 - a).translate(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 0);
    add(J.wheel, sp, M.gold, 0, 0, 0, false);
    add(J.wheel, sphere(2.5, 2.5, 2.5, 10, 8), M.gold, Math.cos(a) * 16, Math.sin(a) * 16, 0);
  }
  add(J.wheel, sphere(3.3, 3.3, 2.2, 12, 8), M.gold);
  // its toon materials, for the hit flash and the glow
  J.toons = [M.skin, M.dark, M.cloth, M.clothIn, M.mouth];
  return J;
}

// The effects' meshes, made once and reused (hidden when not in use).
function m3dEffects() {
  const T = M3.T, quad = new T.PlaneGeometry(1, 1), F = M3.fx;
  const glow = (frag, u = {}) => new T.ShaderMaterial({ vertexShader: M3_VERT, fragmentShader: frag, uniforms: { uCol: { value: new T.Color() }, uAlpha: { value: 1 }, uTime: { value: 0 }, ...u },
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending });
  const mesh = (geo, m, layer = 1) => { const x = new T.Mesh(geo, m); x.layers.set(layer); x.visible = false; x.frustumCulled = false; M3.scene.add(x); return x; };
  F.arcs = [0, 1].map(() => mesh(quad, glow(M3_ARC, { uA0: { value: 0 }, uA1: { value: 1 }, uIn: { value: 0.6 }, uHot: { value: 1 } })));
  F.beams = Array.from({ length: 10 }, () => mesh(quad.clone().translate(0.5, 0, 0), glow(M3_BEAM, { uIn: { value: 0.05 } })));
  F.pillars = Array.from({ length: 10 }, () => mesh(quad.clone().translate(0, 0.5, 0), glow(M3_PILLAR)));
  F.ringMs = Array.from({ length: 6 }, () => mesh(quad, glow(M3_RING, { uW: { value: 0.06 } })));
  const riftU = () => ({ uCol: { value: M3.col(COL.rift) }, uVoid: { value: M3.col(COL.riftDark) }, uOpen: { value: 0 }, uTime: { value: 0 }, uEdge: { value: 0 }, uSX: { value: 1 } });
  F.rifts = Array.from({ length: 5 }, () => {
    const v = mesh(quad, new T.ShaderMaterial({ vertexShader: M3_VERT, fragmentShader: M3_RIFT, uniforms: riftU(), transparent: true, depthTest: false, depthWrite: false }), 0);
    v.renderOrder = -1;
    const e = mesh(quad, glow(M3_RIFT, { ...riftU(), uEdge: { value: 1 }, uSX: { value: 2.2 } }));
    return { v, e };
  });
  // soft round glows: its aura, flares
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  })();
  F.flares = Array.from({ length: 6 }, () => mesh(quad, new T.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending })));
  // sparks and motes
  const N = 96, g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aSize', new T.BufferAttribute(new Float32Array(N), 1));
  g.setAttribute('aCol', new T.BufferAttribute(new Float32Array(N * 4), 4));
  F.pts = new T.Points(g, new T.ShaderMaterial({ vertexShader: M3_PTS_V, fragmentShader: M3_PTS_F, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }));
  F.pts.layers.set(1); F.pts.frustumCulled = false; M3.scene.add(F.pts);
  F.motes = [];
  // the sword's trail
  const TN = 14, tg = new T.BufferGeometry(), idx = [];
  tg.setAttribute('position', new T.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
  tg.setAttribute('aA', new T.BufferAttribute(new Float32Array(TN * 2), 1));
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  tg.setIndex(idx);
  F.trailN = TN;
  F.trailM = mesh(tg, new T.ShaderMaterial({ vertexShader: M3_TRAIL_V, fragmentShader: M3_TRAIL_F, uniforms: { uCol: { value: M3.col(COL.wheelHi) } }, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  // the rock, and its shards
  const rockGeo = seed => {
    const geo = new T.IcosahedronGeometry(1, 1), p = geo.attributes.position;
    // each corner pushed in or out by a hash of where it is, so the faces that share it still meet
    const bump = (x, y, z) => 0.82 + 0.3 * (((Math.sin(Math.round(x * 50) * 12.9898 + Math.round(y * 50) * 78.233 + Math.round(z * 50) * 37.719 + seed * 4.1) * 43758.5453) % 1 + 1) % 1);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = bump(x, y, z); p.setXYZ(i, x * k * 1.08, y * k * 0.95, z * k); }
    geo.computeVertexNormals();
    return geo;
  };
  F.rockMs = [1, 2, 3].map(s => { const geo = rockGeo(s), r = new T.Mesh(geo, M3.mat.rock); r.add(new T.Mesh(geo, M3.rockOl)); r.visible = false; M3.scene.add(r); return r; });
  F.shardMs = Array.from({ length: 18 }, (_, i) => { const geo = new T.IcosahedronGeometry(1, 0), r = new T.Mesh(geo, i % 2 ? M3.mat.rock : M3.mat.rockDark); r.visible = false; M3.scene.add(r); return r; });
}

/* ---------- posing it ---------- */
const m3Lerp = (a, b, x) => a + (b - a) * x;
const m3Clamp = x => Math.max(0, Math.min(1, x));
const m3Ease = x => { x = m3Clamp(x); return x * x * (3 - 2 * x); };
// v0.70 (user: "make makora more smooth animation"): every joint follows its pose on a spring, not a plain ease: it
// speeds up into a move and settles at the end, with a touch of follow-through (`damp` under 1), so a new pose never
// starts with a jerk. `w`: how quick (rad/s); the velocity is kept beside the value (`~key`). boss3d.js uses it too.
const M3S = { damp: 0.82, quick: 1.35 };
function m3Spring(C, key, v, w, dt) {
  if (C[key] == null || !isFinite(C[key])) { C[key] = v; C['~' + key] = 0; return v; }
  let x = C[key], u = C['~' + key] || 0;
  const n = Math.min(10, Math.max(1, Math.ceil(dt * w / 0.3))), h = dt / n;
  for (let i = 0; i < n; i++) { u += (w * w * (v - x) - 2 * M3S.damp * w * u) * h; x += u * h; }
  C[key] = x; C['~' + key] = u;
  return x;
}
// Its pose for what it's doing: joint angles (radians) and heights (its units), and how fast it eases into them.
function m3Pose(m, k) {
  const A = m.act, st = m.state, t = M3.time, still = reducedMotion;
  const P = {
    hipY: 48, lean: 0, twist: 0, chestX: 0, chestZ: 0, headX: 0, rise: 0,
    shR: [0.15, 0, 0.42], elR: -0.9, shL: [0.15, 0, -0.42], elL: -0.5,
    thR: [-0.32, 0.32], knR: 0.62, thL: [-0.32, -0.32], knL: 0.62, rate: 10, spin: 0,
  };
  const breathe = still ? 0 : Math.sin(t * 2.4);
  P.chestX = breathe * 0.02; P.hipY += breathe * 0.4;
  const crouch = c => { P.hipY -= c; P.knR += c * 0.045; P.knL += c * 0.045; P.thR[0] -= c * 0.022; P.thL[0] -= c * 0.022; };
  const overhead = () => { P.shR = [-2.85, 0, 0.25]; P.elR = -0.35; P.shL = [-2.85, 0, -0.25]; P.elL = -0.35; };
  const run = (w, n = 1) => {
    const s = Math.sin(m.step || 0) * n;
    P.thR[0] = -0.35 + 0.55 * s; P.thL[0] = -0.35 - 0.55 * s;
    P.knR = 0.55 + 0.55 * Math.max(0, s); P.knL = 0.55 + 0.55 * Math.max(0, -s);
    P.hipY += Math.abs(Math.cos(m.step || 0)) * 1.6 * w;
    P.shL[0] = 0.15 - 0.4 * s; P.shR[0] = 0.1 + 0.25 * s;
  };
  if (m.down) {                                        // it sinks to its knees, the wheel spinning faster and faster
    const q = 1 - m3Clamp(m.t / MAKORA.die);
    P.hipY = 48 - 22 * m3Ease(q * 2); P.thR = [-1.4, 0.3]; P.knR = 1.6; P.thL = [0.25, -0.3]; P.knL = 2.0;
    P.lean = 0.25 + 0.35 * q; P.headX = 0.4 + 0.3 * q; P.shR = [-0.3, 0, 0.35]; P.elR = -0.2; P.shL = [0.3, 0, -0.5]; P.elL = -0.1;
    P.spin = 4 + q * 20; P.rate = 6;
    return P;
  }
  if (st === 'walk') { run(1); P.rate = 12; }
  else if (st === 'dash' && A) {
    if (A.t < A.tele) { crouch(10); P.lean = 0.38; P.shR = [0.7, 0, 0.9]; P.elR = -0.4; P.shL = [-0.6, 0, -0.4]; P.rate = 16; }
    else { run(1, 1.3); P.lean = 0.6; P.shR = [0.9, 0, 0.7]; P.elR = -0.2; P.shL = [0.6, 0, -0.5]; P.rate = 24; }
  } else if (st === 'slash' && A) {
    const S = MAKORA.slash[A.size], big = { S: [0.6, -1.9, 0], M: [0.95, -2.4, 4], L: [1.35, -2.95, 9] }[A.size];
    P.elR = -0.05; P.shL = [-0.5, 0, -0.9]; P.elL = -0.6;
    if (!A.struck) {
      const w = m3Ease(A.t / Math.max(0.01, A.tele));
      P.shR = [-0.15, m3Lerp(0.2, big[0], w), m3Lerp(0.4, Math.PI / 2, w)]; P.twist = 0.45 * w; crouch(4 + big[2] * w); P.lean = -0.05; P.rate = 18;
    } else {
      const q = m3Ease((A.t - A.tele) / S.anim * 1.15);
      P.shR = [-0.15, m3Lerp(big[0], big[1], q), Math.PI / 2]; P.twist = m3Lerp(0.45, -0.55, q); crouch(5 + big[2]); P.lean = 0.2;
      P.thR[0] = -0.7; P.thL[0] = 0.2; P.rate = 60;
    }
  } else if (st === 'stab' && A) {
    const S = MAKORA.stab[A.size];
    if (!A.struck) {
      const w = m3Ease(A.t / Math.max(0.01, A.tele));
      P.shR = [m3Lerp(0.1, 0.3, w), 0, m3Lerp(0.4, 0.3, w)]; P.elR = m3Lerp(-0.9, -2.0, w); P.twist = 0.55 * w; crouch(7 * w); P.lean = -0.08 * w;
      P.shL = [-0.9 * w, 0, -0.4]; P.elL = -0.5; P.rate = 18;
    } else {
      const q = m3Ease((A.t - A.tele) / S.anim * 1.3);
      P.shR = [m3Lerp(0.3, -Math.PI / 2, q), 0.12, 0.05]; P.elR = m3Lerp(-2.0, 0, q); P.twist = m3Lerp(0.55, -0.45, q); P.lean = 0.42 * q;
      crouch(6); P.thR = [-1.0, 0.25]; P.knR = 0.9; P.thL = [0.6, -0.25]; P.knL = 0.4; P.shL = [0.6, 0, -0.6]; P.rate = 60;
    }
  } else if (st === 'slam' && A) {
    if (A.ph === 'slam') { const w = m3Ease(A.t / A.tele); overhead(); P.lean = -0.22 * w; P.rise = 10 * Math.sin(Math.PI * w * 0.9); P.rate = 14; }
    else if (A.ph === 'lift') {
      const q = A.t / (MAKORA.slam.lift * quick(m));
      if (q < 0.25) { crouch(14); P.lean = 0.45; P.shR = [-1.0, 0, 0.35]; P.shL = [-1.0, 0, -0.35]; P.elR = P.elL = -0.2; P.rate = 40; }
      else { overhead(); P.lean = -0.1; P.rate = 8; }
    } else if (A.ph === 'aim') { overhead(); P.lean = -0.28; P.twist = 0.35; P.thR[0] = -0.6; P.rate = 12; }
    else { P.shR = [-1.5, 0, 0.3]; P.shL = [-1.5, 0, -0.3]; P.elR = P.elL = 0; P.lean = 0.45; P.twist = -0.35; P.thR[0] = -0.85; P.thL[0] = 0.35; P.rate = 40; }
  } else if (st === 'fetch' && A) {
    if (A.ph === 'run') { run(1, 1.3); P.lean = 0.55; P.shR = [0.8, 0, 0.6]; P.shL = [0.8, 0, -0.6]; P.rate = 20; }
    else if (A.ph === 'grab') { crouch(13); P.lean = 0.45; P.shR = [-0.9, 0, 0.3]; P.shL = [-0.9, 0, -0.3]; P.rate = 18; }
    else if (A.ph === 'hold') { overhead(); P.lean = -0.25; P.rate = 14; }
    else { P.shR = [-1.9, 0, 0.3]; P.shL = [-1.9, 0, -0.3]; P.elR = P.elL = -0.1; P.lean = 0.3; P.rate = 40; }
  } else if (st === 'laser' && A) {                    // it floats, arms flung out, head back, glowing
    const w = m3Ease(A.t / Math.max(0.01, A.glowT || 0.7));
    P.rise = 22 * w + (still ? 0 : Math.sin(t * 3) * 2 * w);
    P.shR = [-0.3, 0, m3Lerp(0.4, 2.0, w)]; P.shL = [-0.3, 0, m3Lerp(-0.4, -2.0, w)]; P.elR = P.elL = -0.15;
    P.chestX = -0.18 * w; P.headX = -0.35 * w; P.thR = [-0.2, 0.15]; P.thL = [0.1, -0.15]; P.knR = 0.5; P.knL = 0.9; P.spin = 6 * w; P.rate = 8;
  } else if ((st === 'jump' || st === 'rift') && A) {
    const R = MAKORA.rift;
    if (A.ph === 'leap') { const u = A.t / R.leap; P.rise = (A.h || 0) / k; if (u < 0.2) crouch(12); overhead(); P.lean = 0.2; P.thR[0] = P.thL[0] = -0.9; P.knR = P.knL = 1.4; P.rate = 18; }
    else if (A.ph === 'tear') {                        // two cuts in the air, an X
      const u = A.t / R.tear, c = u < 0.5 ? m3Ease(u * 2) : m3Ease((u - 0.5) * 2);
      if (u < 0.5) { P.shR = [m3Lerp(-2.8, -0.5, c), m3Lerp(0.4, -0.6, c), m3Lerp(1.2, 0.3, c)]; P.twist = m3Lerp(0.4, -0.4, c); }
      else { P.shR = [m3Lerp(-2.6, -0.4, c), m3Lerp(-0.6, 0.5, c), m3Lerp(0.3, 1.3, c)]; P.twist = m3Lerp(-0.4, 0.4, c); }
      P.elR = -0.1; crouch(4); P.rate = 50;
    } else if (A.ph === 'channel' || A.ph === 'close') {   // kneeling, the blade planted, the wheel spinning
      P.hipY = 28; P.thR = [-1.45, 0.3]; P.knR = 1.55; P.thL = [0.25, -0.3]; P.knL = 1.95;
      P.lean = 0.28; P.headX = 0.45; P.shR = [-0.55, 0, 0.3]; P.elR = -0.25; P.shL = [0.1, 0, -0.5]; P.elL = -0.4; P.spin = 8; P.rate = 8;
      if (A.ph === 'close') { const q = m3Ease(A.t / R.close); P.hipY = m3Lerp(28, 48, q); P.lean = m3Lerp(0.28, 0, q); }
    } else if (A.ph === 'broken') { P.lean = -0.35; P.headX = -0.4; P.shR = [-0.4, 0, 1.2]; P.shL = [-0.4, 0, -1.2]; crouch(6); P.rate = 14; }
  } else if (st === 'roar' && A) { P.chestX = -0.35; P.headX = -0.55; P.shR = [0.3, 0, 1.15]; P.shL = [0.3, 0, -1.15]; P.elR = P.elL = -0.6; crouch(6); P.spin = 3; P.rate = 16; }
  else { crouch(1); P.rate = 8; }
  return P;
}
function m3Apply(m, P, dt, k) {
  const J = M3.rig, C = M3.cur, w = P.rate * M3S.quick;
  const ease = (key, v) => m3Spring(C, key, v, w, dt);
  J.hips.position.y = ease('hipY', P.hipY) + ease('rise', P.rise);
  J.hips.rotation.x = ease('lean', P.lean) * 0.6;
  J.spine.rotation.x = C.lean * 0.4 + ease('chestX', P.chestX);
  J.spine.rotation.y = ease('twist', P.twist) * 0.5; J.chest.rotation.y = C.twist * 0.5;
  J.head.rotation.x = ease('headX', P.headX);
  for (const s of ['R', 'L']) {
    const sh = P['sh' + s], th = P['th' + s];
    J['sh' + s].rotation.set(ease('sh' + s + 'x', sh[0]), ease('sh' + s + 'y', sh[1]) * (s === 'R' ? 1 : -1), ease('sh' + s + 'z', sh[2]));
    J['el' + s].rotation.x = ease('el' + s, P['el' + s]);
    J['th' + s].rotation.set(ease('th' + s + 'x', th[0]), 0, ease('th' + s + 'z', th[1]));
    J['kn' + s].rotation.x = ease('kn' + s, P['kn' + s]);
    J['ft' + s].rotation.x = -(J['th' + s].rotation.x + J['kn' + s].rotation.x + J.hips.rotation.x);   // feet flat on the ground
  }
  // turned to where it's aiming
  const want = Math.atan2(Math.cos(m.aim ?? Math.PI / 2), Math.sin(m.aim ?? Math.PI / 2));
  C.yaw = m3Spring(C, 'yaw', C.yaw == null ? want : C.yaw + angDiff(want, C.yaw), 16, dt);   // (the nearest way round)
  J.body.rotation.y = C.yaw;
  // the wheel over its head (facing us), a notch for every run it's beaten, spinning when it's powering up
  const hw = J.head.getWorldPosition(new M3.T.Vector3());
  J.halo.position.copy(J.body.worldToLocal(hw)).add(new M3.T.Vector3(0, 27 + (reducedMotion ? 0 : Math.sin(M3.time * 2) * 1.2), -3));
  J.halo.rotation.y = -C.yaw;
  C.spin = (C.spin || 0) + ease('spinV', P.spin) * dt;
  J.wheel.rotation.z = -((m.run || runNo()) - 1) * Math.PI / 4 - C.spin;
}

/* ---------- each frame ---------- */
const M3V = () => new M3.T.Vector3();
// Draws MAKORA and its effects onto the arena (makora.js drawMakora, with the arena's transform on ctx).
function m3dDraw(m) {
  try { m3dFrame(m); } catch (err) { M3D.status = 'failed'; M3D.err = err?.message || String(err); console.warn('MAKORA 3D is off:', err); drawMakoraFlat(m); }
}
function m3dFrame(m) {
  const T = M3.T, now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - M3.at) / 1000));
  M3.at = now; M3.time += dt;
  const k = makoraUnit(m), J = M3.rig, F = M3.fx, A = m.act;
  // its shadow on the ground (flat, under everything)
  const lift = (A?.kind === 'rift' && A.ph === 'leap' ? A.h || 0 : 0) + (M3.cur.rise || 0) * k;
  ctx.save(); ctx.globalAlpha = 0.32 * (1 - Math.min(0.6, lift / 300)); ctx.fillStyle = '#000'; ellipse(m.x, m.y + 34 * k, 34 * k, 8 * k); ctx.restore();
  // the frame: the view, in arena px
  const vw = VW / viewZoom, vh = VH / viewZoom, x0 = cam.x, y0 = cam.y;
  const w = Math.max(16, Math.min(2048, Math.ceil(vw / M3D.px))), h = Math.max(16, Math.min(2048, Math.ceil(vh / M3D.px)));
  if (M3.canvas.width !== w || M3.canvas.height !== h) M3.gl.setSize(w, h, false);
  Object.assign(M3.cam, { left: x0, right: x0 + vw, top: -y0, bottom: -(y0 + vh) });
  M3.cam.updateProjectionMatrix();
  // MAKORA: posed, placed on its feet, scaled
  J.root.position.set(m.x, -(m.y + 34 * k), 0);
  J.root.scale.setScalar(k);
  J.root.visible = true;
  m3Apply(m, m3Pose(m, k), dt, k);
  J.root.updateMatrixWorld(true);
  // the hit flash, and its glow (phase 3, the lasers, going down)
  const charge = A?.kind === 'laser' ? m3Clamp(A.t / Math.max(0.01, A.glowT || 0.7)) : 0;
  const heat = Math.max(m.glow || 0, charge, m.down ? 1 - m3Clamp(m.t / MAKORA.die) : 0);
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(M3.time * 7);
  for (const mt of J.toons) {
    if (m.hit > 0) mt.emissive.setRGB(0.7, 0.7, 0.7);
    else mt.emissive.copy(M3.col(m.phase >= 2 && !charge ? COL.bad : COL.wheel)).multiplyScalar(heat * (0.18 + 0.14 * pulse));
  }
  M3.mat.gold.emissiveIntensity = 0.35 + heat * 0.9;
  m3dFx(m, k, dt);
  // the solid pass, then the light on top
  const gl = M3.gl;
  M3.cam.layers.set(0); gl.setClearColor(0x000000, 0); gl.render(M3.scene, M3.cam);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (m.down) ctx.globalAlpha = 0.35 + 0.65 * m3Clamp(m.t / MAKORA.die * 1.4);
  ctx.drawImage(M3.canvas, x0, y0, vw, vh);
  ctx.restore();
  if (M3.glowOn) {
    M3.cam.layers.set(1); gl.setClearColor(0x000000, 1); gl.render(M3.scene, M3.cam);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(M3.canvas, x0, y0, vw, vh);
    ctx.restore();
  }
}
// Arena (x, y) → the scene, `z` toward us.
const m3At = (o, x, y, z = 0) => o.position.set(x, -y, z);

// Sets up this frame's effects from what MAKORA is doing (so a co-op guest's are the same as the host's).
function m3dFx(m, k, dt) {
  const T = M3.T, F = M3.fx, A = m.act, L = MAKORA.laser, t = M3.time;
  let used = { arcs: 0, beams: 0, pillars: 0, ringMs: 0, rifts: 0, flares: 0 };
  const take = key => { const o = F[key][used[key]]; used[key]++; if (o) { (o.v ? o.v : o).visible = true; if (o.e) o.e.visible = true; } return o; };
  for (const key of ['arcs', 'beams', 'pillars', 'ringMs', 'flares']) for (const o of F[key]) o.visible = false;
  for (const r of F.rifts) { r.v.visible = false; r.e.visible = false; }
  const U = (o, u) => { for (const key in u) { const v = o.material.uniforms[key]; if (v.value?.isColor) v.value.set(u[key]); else v.value = u[key]; } o.material.uniforms.uTime && (o.material.uniforms.uTime.value = t); };
  const arc = (x, y, a, R, a0, a1, inner, alpha, col, hot = 1) => {
    const o = take('arcs'); if (!o) return;
    m3At(o, x, y, 10); o.scale.set(R * 2, R * 2, 1); o.rotation.z = -a;
    U(o, { uA0: a0, uA1: a1, uIn: inner, uAlpha: alpha, uCol: col, uHot: hot });
  };
  const beam = (x, y, a, len, wid, alpha, col, fadeIn = 0.05) => {
    const o = take('beams'); if (!o) return;
    m3At(o, x, y, 20); o.scale.set(len, wid, 1); o.rotation.z = -a;
    U(o, { uAlpha: alpha, uCol: col, uIn: fadeIn });
  };
  const flare = (x, y, size, alpha, col) => {
    const o = take('flares'); if (!o) return;
    m3At(o, x, y, 30); o.scale.set(size, size, 1); o.material.color.set(col); o.material.opacity = Math.min(1, alpha);
  };
  const ringFx = (x, y, R, alpha, col, wid = 0.06) => {
    const o = take('ringMs'); if (!o) return;
    m3At(o, x, y, 5); o.scale.set(R * 2, R * 2, 1); U(o, { uAlpha: alpha, uCol: col, uW: wid });
  };
  const chest = () => { const v = M3.rig.chest.getWorldPosition(M3V()); return { x: v.x, y: -v.y }; };
  // the sword's trail, through the last few frames of its blade (while it cuts)
  const cutting = A && ((A.kind === 'slash' || A.kind === 'stab') && A.struck && A.t - A.tele < (MAKORA[A.kind][A.size]?.anim || 0.2) + 0.05
    || A.kind === 'rift' && A.ph === 'tear' || A.kind === 'dash' && A.t >= A.tele);
  const b0 = M3.rig.bladeBase.getWorldPosition(M3V()), b1 = M3.rig.bladeTip.getWorldPosition(M3V());
  if (cutting) M3.trail.unshift([b0.x, b0.y, b1.x, b1.y, 1]);
  for (const s of M3.trail) s[4] -= dt * 5;
  M3.trail = M3.trail.filter(s => s[4] > 0).slice(0, F.trailN);
  const tp = F.trailM.geometry.attributes.position, ta = F.trailM.geometry.attributes.aA;
  F.trailM.visible = M3.trail.length > 1;
  for (let i = 0; i < F.trailN; i++) {
    const s = M3.trail[Math.min(i, M3.trail.length - 1)] || [0, 0, 0, 0, 0], a = M3.trail.length > i ? s[4] * (1 - i / F.trailN) : 0;
    tp.setXYZ(i * 2, s[0], s[1], 40); tp.setXYZ(i * 2 + 1, s[2], s[3], 40);
    ta.setX(i * 2, a * 0.25); ta.setX(i * 2 + 1, a);
  }
  tp.needsUpdate = ta.needsUpdate = true;
  F.trailM.material.uniforms.uCol.value.set(m.phase >= 2 ? COL.bad : COL.wheelHi);

  const gold = COL.wheelHi, white = '#ffffff';
  if (A && !m.down) {
    if (A.kind === 'slash' && A.struck) {             // the cut sweeping round it on the ground, hottest at its edge
      const S = MAKORA.slash[A.size], q = (A.t - A.tele) / S.anim, fade = 1 - m3Clamp((q - 0.7) / 0.6);
      const lead = -S.arc / 2 + S.arc * m3Ease(q * 1.2);
      arc(m.x, m.y, A.a, S.range, -S.arc / 2, lead, A.size === 'L' ? 0.42 : 0.6, fade, A.size === 'L' ? COL.bad : gold);
      if (A.size !== 'S') arc(m.x, m.y, A.a, S.range * 0.7, -S.arc / 2, lead, 0.7, fade * 0.6, white);
    } else if (A.kind === 'stab' && A.struck) {       // a streak down its lane, and a flare at its point
      const S = MAKORA.stab[A.size], q = (A.t - A.tele) / S.anim, fade = 1 - m3Clamp((q - 0.6) / 0.8), len = S.len * m3Ease(q * 1.6);
      beam(A.x0, A.y0, A.a, Math.max(1, len), S.w * 0.9, fade * 1.2, A.size === 'L' ? COL.bad : gold, 0.3);
      beam(A.x0, A.y0, A.a, Math.max(1, len * 0.95), S.w * 0.35, fade, white, 0.2);
      flare(A.x0 + Math.cos(A.a) * len, A.y0 + Math.sin(A.a) * len, S.w * 2.2 * fade, fade, gold);
    } else if (A.kind === 'dash' && A.t >= A.tele) {  // a streak behind it
      beam(m.x, m.y - 30 * k, A.a + Math.PI, 160, 50 * k / 2.4, 0.5, gold, 0.1);
    } else if (A.kind === 'slam' && A.ph === 'lift' && A.t < 0.5) {   // the slam's shockwave
      const q = A.t / 0.5;
      ringFx(m.x, m.y + m.r * 0.4, MAKORA.slam.r * 1.15 * m3Ease(q * 1.4), 1 - q, gold, 0.08);
    } else if (A.kind === 'roar' && A.done) {
      const q = m3Clamp((A.t - A.tele) / 0.55);
      ringFx(m.x, m.y, MAKORA.roar.r * 1.5 * m3Ease(q), 1 - q, m.phase >= 2 ? COL.bad : gold, 0.1);
      ringFx(m.x, m.y, MAKORA.roar.r * m3Ease(q * 1.3), (1 - q) * 0.7, white, 0.05);
    } else if (A.kind === 'laser') {
      const c = chest(), ch = m3Clamp(A.t / Math.max(0.01, A.glowT));
      flare(c.x, c.y, (90 + 60 * ch) * k / 2.4 * (1 + 0.08 * Math.sin(t * 20)), 0.35 + 0.5 * ch, gold);
      if (A.pat === 'spokes') for (const v of A.vol || []) {
        const on = A.t - v.at - v.warn, F2 = L.spokes.fire;
        if (on < -0.05 || on > F2 + 0.2) continue;
        const a = on < 0 ? 0.3 : on < F2 ? 1 : 1 - (on - F2) / 0.2;
        for (let i = 0; i < L.spokes.n; i++) beam(m.x, m.y, v.a + i * TAU / L.spokes.n, L.len, L.w * (on < 0 ? 0.6 : 2.4), a, gold, 0.03);
        if (on >= 0 && on < 0.12) flare(m.x, m.y, 260, 1 - on / 0.12, white);
      } else for (const p of A.pills || []) {         // the pillars: a faint shaft while it locks on, then the strike
        const S = L.pillars, top = p.y - (cam.y - 40);
        if (!p.struck) { const o = take('pillars'); if (o) { m3At(o, p.x, p.y, 15); o.scale.set(S.r * 0.35, top, 1); U(o, { uAlpha: 0.12 + 0.2 * (p.t / S.warn), uCol: gold }); } flare(p.x, p.y, S.r * 2.2, 0.25 + 0.3 * (p.t / S.warn), gold); }
        else if (p.t < S.warn + S.glow + 0.25) {
          const q = m3Clamp((p.t - S.warn) / (S.glow + 0.25)), a = 1 - q;
          const o = take('pillars'); if (o) { m3At(o, p.x, p.y, 15); o.scale.set(S.r * 1.5 * (1 - q * 0.5), top, 1); U(o, { uAlpha: a * 1.3, uCol: gold }); }
          ringFx(p.x, p.y, S.r * (1 + q * 0.8), a, white, 0.07);
          flare(p.x, p.y, S.r * 3.5, a, gold);
        }
      }
    } else if ((A.kind === 'rift')) {
      const R = MAKORA.rift;
      if (A.ph === 'tear') {                          // two great cuts in the air, an X, tearing it open
        const c = chest(), u = A.t / R.tear;
        for (const [from, sgn] of [[0.15, 1], [0.5, -1]]) {
          const q = m3Clamp((u - from) / 0.3); if (q <= 0) continue;
          const a = sgn > 0 ? -Math.PI / 4 * 3 : -Math.PI / 4, len = 260 * m3Ease(q), fade = 1 - m3Clamp((u - from - 0.3) / 0.5);
          const sx = c.x - Math.cos(a) * 130, sy = c.y - Math.sin(a) * 130;
          beam(sx, sy, a, len, 30, fade, COL.rift, 0.2); beam(sx, sy, a, len, 10, fade, white, 0.2);
        }
      }
      const open = A.ph === 'channel' ? 1 : A.ph === 'close' ? 1 - A.t / R.close : A.ph === 'broken' ? 1 - A.t / (R.broken * 0.5) : 0;
      for (const r of A.rifts || []) {
        const o = take('rifts'); if (!o) break;
        const op = m3Clamp(Math.min(r.t * 2.5, 1) * open), H = 150, Wd = 66;
        for (const [mesh, sx] of [[o.v, 1], [o.e, 2.2]]) { m3At(mesh, r.x, r.y - H * 0.42, mesh === o.v ? 50 : 60); mesh.scale.set(Wd * sx, H, 1); U(mesh, { uOpen: op }); }
        if (op > 0.05 && Math.random() < dt * 30) m3Mote(r.x + (Math.random() - 0.5) * 20, r.y - H * 0.42 + (Math.random() - 0.5) * H * 0.7, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, COL.rift, 0.6, 7);
      }
      if (A.ph === 'channel') {                       // it heals: motes rising round it, a soft green glow
        const c = chest();
        flare(c.x, c.y, 180 * k / 2.4, 0.35 + 0.1 * Math.sin(t * 6), COL.hp);
        if (Math.random() < dt * 40) m3Mote(m.x + (Math.random() - 0.5) * 70 * k / 2.4, m.y + 20, (Math.random() - 0.5) * 20, -90 - Math.random() * 90, Math.random() < 0.6 ? COL.hp : gold, 0.9, 9);
      }
    }
  }
  // its aura: enraged (phase 3), and going down
  if (m.down || (m.phase >= 2 && !(A?.kind === 'laser'))) {
    const c = chest(), q = m.down ? 1 - m3Clamp(m.t / MAKORA.die) : 0;
    flare(c.x, c.y, (150 + 220 * q) * k / 2.4 * (1 + 0.06 * Math.sin(t * 9)), m.down ? 0.4 + 0.6 * q : 0.28, m.down ? gold : COL.bad);
    if (Math.random() < dt * (m.down ? 50 : 12)) m3Mote(c.x + (Math.random() - 0.5) * 80, c.y + (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 30, -60 - Math.random() * 80, m.down ? gold : COL.bad, 0.8, 8);
  }
  if (A?.kind === 'laser' && A.t < A.glowT && Math.random() < dt * 40) {   // charging: sparks pulled in to it
    const c = chest(), a = Math.random() * TAU, d = 110;
    m3Mote(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, -Math.cos(a) * d * 2.2, -Math.sin(a) * d * 2.2, gold, 0.45, 8);
  }
  m3Rocks(m, k, dt);
  m3Shards(dt);
  for (const r of F.rings) { r.t += dt; const q = r.t / r.life; if (q < 1) ringFx(r.x, r.y, r.R * m3Ease(q * 1.3), 1 - q, r.col, 0.08); }
  F.rings = F.rings.filter(r => r.t < r.life);
  m3Motes(dt);
  M3.glowOn = Object.values(used).some(n => n > 0) || F.trailM.visible || F.motes.length > 0;
}

// The rock: in its hands, flying, lying where it landed, or lobbed in an arc. When one's gone, it breaks into shards.
function m3Rocks(m, k, dt) {
  const F = M3.fx, seen = new Set();
  F.rockMs.forEach(r => r.visible = false);
  let i = 0;
  const holding = m.act?.kind === 'slam' && (m.act.ph === 'lift' || m.act.ph === 'aim');
  for (const rk of game.mrocks) {
    const mesh = F.rockMs[i++]; if (!mesh) break;
    seen.add(rk.id);
    mesh.visible = true; mesh.scale.setScalar(rk.r);
    if (rk.mode === 'held' || rk.mode === 'aimed') m3HeldRock(mesh, rk.r);
    else { m3At(mesh, rk.x, rk.y - (rk.h || 0) - rk.r * 0.3, 300); mesh.rotation.set(rk.spin * 0.7, rk.spin, rk.spin * 0.3); }
    if (rk.mode === 'fly') rk.h = (rk.h ?? 30) + (30 - (rk.h ?? 30)) * Math.min(1, dt * 8);
    M3.rocks.set(rk.id, { x: rk.x, y: rk.y, h: rk.h || 0, mode: rk.mode, r: rk.r });
  }
  if (holding && i < F.rockMs.length) {               // coming up out of the ground, then up over its head
    const mesh = F.rockMs[i], A = m.act, q = A.ph === 'lift' ? m3Clamp(A.t / (MAKORA.slam.lift * quick(m))) : 1;
    mesh.visible = true; mesh.scale.setScalar(MAKORA.slam.rock * m3Lerp(0.5, 1, m3Ease(q * 2)));
    if (q < 0.3) { const fx = m.x + Math.cos(A.a) * m.r * 0.9, fy = m.y + Math.sin(A.a) * m.r * 0.9; m3At(mesh, fx, fy - m3Ease(q / 0.3) * 40, 300); }
    else m3HeldRock(mesh, MAKORA.slam.rock);
  }
  for (const [id, r] of M3.rocks) if (!seen.has(id)) {   // it's gone: shards
    M3.rocks.delete(id);
    const y = r.mode === 'lob' ? r.y : r.y - r.h;
    for (let n = 0; n < 9; n++) { const a = Math.random() * TAU, s = 120 + Math.random() * 260; m3Shard(r.x, y, Math.cos(a) * s, Math.sin(a) * s * 0.5, 200 + Math.random() * 300, 4 + Math.random() * 6); }
    F.rings.push({ x: r.x, y, R: r.mode === 'lob' ? MAKORA.fetch.r * 1.2 : 90, t: 0, life: 0.45, col: COL.wheelHi });
  }
}
// Over its head, between its hands.
function m3HeldRock(mesh, r) {
  const J = M3.rig, a = J.handR.getWorldPosition(M3V()), b = J.handL.getWorldPosition(M3V());
  mesh.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + r * 0.7, 300);
  mesh.rotation.set(M3.time * 0.4, M3.time * 0.6, 0);
}
function m3Shard(x, y, vx, vy, vz, size) {
  const F = M3.fx;
  if (F.shards.length >= F.shardMs.length) F.shards.shift();
  F.shards.push({ x, y, z: 10, vx, vy, vz, size, t: 0, spin: Math.random() * 6 });
}
function m3Shards(dt) {
  const F = M3.fx;
  F.shardMs.forEach(s => s.visible = false);
  F.shards = F.shards.filter(s => (s.t += dt) < 1.1);
  F.shards.forEach((s, i) => {
    s.vz -= 1500 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z = Math.max(0, s.z + s.vz * dt);
    if (s.z === 0) { s.vx *= 0.8; s.vy *= 0.8; s.vz = Math.abs(s.vz) * 0.3; }
    const mesh = F.shardMs[i]; mesh.visible = true;
    m3At(mesh, s.x, s.y - s.z, 320); mesh.scale.setScalar(s.size * (1 - Math.max(0, s.t - 0.8) / 0.3)); mesh.rotation.set(s.t * s.spin, s.t * s.spin * 0.7, 0);
  });
}
// Motes and sparks: soft points that drift, all drawn in one go.
function m3Mote(x, y, vx, vy, col, life, size) {
  const F = M3.fx;
  if (F.motes.length >= 96) F.motes.shift();
  F.motes.push({ x, y, vx, vy, c: M3.col(col), life, t: 0, size });
}
function m3Motes(dt) {
  const F = M3.fx, g = F.pts.geometry, p = g.attributes.position, s = g.attributes.aSize, c = g.attributes.aCol;
  F.motes = F.motes.filter(o => (o.t += dt) < o.life);
  for (let i = 0; i < 96; i++) {
    const o = F.motes[i];
    if (!o) { s.setX(i, 0); c.setXYZW(i, 0, 0, 0, 0); continue; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    const a = Math.sin(Math.PI * o.t / o.life);
    p.setXYZ(i, o.x, -o.y, 70); s.setX(i, o.size / M3D.px * (0.6 + 0.4 * a)); c.setXYZW(i, o.c.r, o.c.g, o.c.b, a);
  }
  p.needsUpdate = s.needsUpdate = c.needsUpdate = true;
}
