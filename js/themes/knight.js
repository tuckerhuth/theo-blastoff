// The knight & dragon theme: a besieged countryside scene where counting up
// arms a knight piece-by-piece while a dragon torments the sky, and counting
// down lands a sword strike each number until the final blow slays it.
//
// Geometry/motion translated from a Claude Design mockup (project
// eef274a5-697b-4bc4-a885-8a5b6ea5ce39, KnightDragonScene.dc.html) into this
// theme's contract — see js/themes/rocket.js for the shape every theme
// conforms to. The tower/rail/arrow geometry is copied verbatim from rocket
// so the two themes share the exact same "meter" contract the tests assert.

import { confettiBurst } from '../fx.js';

const SVG = 'http://www.w3.org/2000/svg';
const GROUND_Y = 560; // same convention as rocket — tile tray sits below this

// Three color worlds, applied across a mission's 3 launches (day → night).
// `sky` drives the page-level CSS gradient (documentElement --sky-*);
// `vars` are scene-internal custom properties on the mounted svg root;
// `numColors` is this theme's per-number rainbow (tiles + lit tower slots),
// hand-picked to echo each palette's own hues for visual cohesion.
const PALETTES = [
  { // 0: meadow — bright daytime pastels
    sky: { top: '#bfe6ff', mid: '#e0d8f5', bottom: '#ffeaf3' },
    vars: {
      '--kd-celest': '#fff2b0', '--kd-particle': '#ffffff',
      '--kd-hill-far': '#c6e8c8', '--kd-hill-mid': '#a2dba6', '--kd-hill-near': '#7ecb82', '--kd-tree': '#4fa35f',
      '--kd-house': '#f2e8da', '--kd-roof': '#d98f5c', '--kd-window-lit': '#ffe38a',
      '--kd-castle': '#c3aee6', '--kd-castle-2': '#ad95da', '--kd-flag': '#ff8ac0',
      '--kd-smoke': 'rgba(104,96,116,.6)', '--kd-fire-1': '#ff8a2c', '--kd-fire-2': '#ffd23f',
      '--kd-ground': '#4c9c5a', '--kd-ground-edge': 'rgba(255,255,255,.28)',
      '--kd-k-cloth': '#d98fc4', '--kd-k-cloth-2': '#c46fae', '--kd-k-cape': '#ff9ec7',
      '--kd-k-skin': '#f6cda8', '--kd-k-ink': '#3a2a3f', '--kd-k-cheek': '#ff9ec7',
      '--kd-k-metal': '#eaf0fb', '--kd-k-metal-2': '#aebbd6', '--kd-k-trim': '#f0c07a',
      '--kd-k-plume': '#d86fb0', '--kd-k-shield': '#6f8fe0', '--kd-k-shield-2': '#4f6fc4',
      '--kd-k-gem': '#ff6fae', '--kd-k-gem-2': '#8fd0ff',
      '--kd-d-body': '#7ed36f', '--kd-d-body-2': '#5cb457', '--kd-d-wing': '#a7e59a', '--kd-d-wing-2': '#6fc266',
      '--kd-d-belly': '#f4f1c9', '--kd-d-horn': '#f0e6a8', '--kd-d-eye': '#2e7d32',
      '--kd-slot-off': '#b3a894', '--kd-slot-off-stroke': 'rgba(0,0,0,.2)',
      '--kd-banner': '#ff6aa6',
    },
    numColors: { 1: '#ff6f9d', 2: '#ff9438', 3: '#ffcf5c', 4: '#6fcf6f', 5: '#4fd9b0', 6: '#5cc9f0', 7: '#6f8fe0', 8: '#b07fd0', 9: '#d86fb0', 10: '#ff9ec7' },
  },
  { // 1: ember — warm dramatic dusk
    sky: { top: '#2b1830', mid: '#7a3a3e', bottom: '#e88a4a' },
    vars: {
      '--kd-celest': '#ffd27a', '--kd-particle': '#ffb066',
      '--kd-hill-far': '#7a4238', '--kd-hill-mid': '#5a2e2c', '--kd-hill-near': '#3f1e20', '--kd-tree': '#24100f',
      '--kd-house': '#5a3a34', '--kd-roof': '#7a4a30', '--kd-window-lit': '#ffdd6a',
      '--kd-castle': '#4a2a2e', '--kd-castle-2': '#351b20', '--kd-flag': '#ffb04a',
      '--kd-smoke': 'rgba(74,58,58,.7)', '--kd-fire-1': '#ff6a2c', '--kd-fire-2': '#ffe14d',
      '--kd-ground': '#1e0d12', '--kd-ground-edge': 'rgba(255,180,120,.22)',
      '--kd-k-cloth': '#7a352c', '--kd-k-cloth-2': '#5a231a', '--kd-k-cape': '#c8452e',
      '--kd-k-skin': '#e0a878', '--kd-k-ink': '#2a1510', '--kd-k-cheek': '#ff8a6a',
      '--kd-k-metal': '#f0dcb4', '--kd-k-metal-2': '#bd924e', '--kd-k-trim': '#ffd76a',
      '--kd-k-plume': '#ff8a3c', '--kd-k-shield': '#c85a3a', '--kd-k-shield-2': '#9c3a24',
      '--kd-k-gem': '#ffd76a', '--kd-k-gem-2': '#ff8a4a',
      '--kd-d-body': '#e0472e', '--kd-d-body-2': '#a52a1c', '--kd-d-wing': '#ff7a4d', '--kd-d-wing-2': '#a5321c',
      '--kd-d-belly': '#ffd9a0', '--kd-d-horn': '#2a1512', '--kd-d-eye': '#ffe14d',
      '--kd-slot-off': '#4a3a34', '--kd-slot-off-stroke': 'rgba(0,0,0,.4)',
      '--kd-banner': '#ffd76a',
    },
    numColors: { 1: '#ff5a3c', 2: '#ff6a2c', 3: '#ff8a3c', 4: '#ffc94d', 5: '#ffd76a', 6: '#c85a3a', 7: '#9c3a24', 8: '#bd924e', 9: '#ffd9a0', 10: '#ffe14d' },
  },
  { // 2: twilight — deep night, closest to the rocket build's palette
    sky: { top: '#241a4a', mid: '#372460', bottom: '#4a2f78' },
    vars: {
      '--kd-celest': '#f4ecc9', '--kd-particle': '#ffffff',
      '--kd-hill-far': '#332968', '--kd-hill-mid': '#281e5c', '--kd-hill-near': '#1d1548', '--kd-tree': '#150f34',
      '--kd-house': '#3a3568', '--kd-roof': '#4a3f78', '--kd-window-lit': '#ffd76a',
      '--kd-castle': '#2b2668', '--kd-castle-2': '#201a50', '--kd-flag': '#ff6f9d',
      '--kd-smoke': 'rgba(160,150,190,.55)', '--kd-fire-1': '#ff8a2c', '--kd-fire-2': '#ffe14d',
      '--kd-ground': '#100b2e', '--kd-ground-edge': 'rgba(255,255,255,.12)',
      '--kd-k-cloth': '#3a4f8f', '--kd-k-cloth-2': '#2d3f74', '--kd-k-cape': '#6f4fb0',
      '--kd-k-skin': '#e8b892', '--kd-k-ink': '#201830', '--kd-k-cheek': '#ff9db0',
      '--kd-k-metal': '#dbe2f2', '--kd-k-metal-2': '#8f9ec4', '--kd-k-trim': '#ffd06a',
      '--kd-k-plume': '#ff6f7d', '--kd-k-shield': '#5c78d6', '--kd-k-shield-2': '#3f56b0',
      '--kd-k-gem': '#ff6f9d', '--kd-k-gem-2': '#57c1e8',
      '--kd-d-body': '#a24fd4', '--kd-d-body-2': '#7a34ab', '--kd-d-wing': '#c47ae8', '--kd-d-wing-2': '#7d3bb0',
      '--kd-d-belly': '#efe0ff', '--kd-d-horn': '#f0d48a', '--kd-d-eye': '#ffd23f',
      '--kd-slot-off': '#3a3560', '--kd-slot-off-stroke': 'rgba(0,0,0,.35)',
      '--kd-banner': '#ffd06a',
    },
    numColors: { 1: '#ff6f9d', 2: '#ffd06a', 3: '#ffe6a8', 4: '#57c98e', 5: '#57c1e8', 6: '#5c78d6', 7: '#3f56b0', 8: '#7a34ab', 9: '#c47ae8', 10: '#ff7ab0' },
  },
];

// Dragon anchor points — absolute scene coordinates. Kept well below the
// top of the viewBox: at very wide/short aspect ratios "xMidYMax slice"
// crops from the top (rocket's own moon partially clips there too), and
// unlike rocket's decorative moon the dragon is a main character.
const DRAGON_AMBIENT = { x: 650, y: 260, scale: 1 };
const DRAGON_BATTLE = { x: 740, y: 300, scale: 0.78 };
const DRAGON_DEAD = { x: 150, y: 650, scale: 0.85, rotate: 55 };

let svg, defs;
let dragonAnchor, dragonPatrol, dragonTint, fireBreath, deadEye, sparkEl;
let knightWrap, swordGroup;
let arrowEl, railL, railR;
const slots = {};
const armor = {}; // 1..10 -> <g>
let masked = false;
const saidNums = new Set();
let dmg = 0;
let variant = 2; // index into PALETTES; twilight until setVariant runs
let mountAbort = null;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Masked mode: numeral is readable only after it's been counted this phase.
function slotText(n) {
  const g = slots[n];
  g.querySelector('text').textContent = (!masked || saidNums.has(n)) ? n : '•';
}

function numColors() { return PALETTES[variant].numColors; }

function applyPalette(i) {
  variant = ((i % PALETTES.length) + PALETTES.length) % PALETTES.length;
  const p = PALETTES[variant];
  const root = document.documentElement;
  root.style.setProperty('--sky-top', p.sky.top);
  root.style.setProperty('--sky-mid', p.sky.mid);
  root.style.setProperty('--sky-bottom', p.sky.bottom);
  for (const [k, v] of Object.entries(p.vars)) svg.style.setProperty(k, v);
  // re-tint already-lit slots (a palette can change mid-mission)
  for (let n = 1; n <= 10; n++) if (slots[n]?.classList.contains('lit')) {
    slots[n].querySelector('rect').style.fill = numColors()[n];
  }
}

function buildCountryside() {
  // celestial glow + a scatter of twinkle stars
  el('circle', { cx: 150, cy: 90, r: 54, style: 'fill:var(--kd-celest)', opacity: 0.9 }, svg);
  for (let i = 0; i < 18; i++) {
    const s = el('circle', {
      cx: Math.round(60 + Math.random() * 880), cy: Math.round(20 + Math.random() * 240),
      r: (1 + Math.random() * 2).toFixed(1), style: 'fill:var(--kd-particle)', class: 'kd-twinkle',
      opacity: (0.4 + Math.random() * 0.5).toFixed(2),
    }, svg);
    s.style.animationDelay = `${(Math.random() * 2.6).toFixed(2)}s`;
  }

  // hills, layered far -> near
  el('path', { d: 'M0 300 Q200 240 420 280 Q640 320 850 270 Q950 248 1000 270 L1000 700 L0 700 Z', style: 'fill:var(--kd-hill-far)' }, svg);
  el('path', { d: 'M0 380 Q220 330 460 370 Q700 410 920 350 Q970 338 1000 352 L1000 700 L0 700 Z', style: 'fill:var(--kd-hill-mid)' }, svg);
  el('path', { d: 'M0 460 Q260 420 520 452 Q760 480 1000 440 L1000 700 L0 700 Z', style: 'fill:var(--kd-hill-near)' }, svg);

  // castle, over the knight's shoulder
  const castle = el('g', { transform: 'translate(540,165)' }, svg);
  el('rect', { x: 0, y: 60, width: 100, height: 40, style: 'fill:var(--kd-castle)' }, castle);
  el('rect', { x: 6, y: 24, width: 26, height: 76, style: 'fill:var(--kd-castle)' }, castle);
  el('rect', { x: 70, y: 14, width: 26, height: 86, style: 'fill:var(--kd-castle)' }, castle);
  el('rect', { x: 34, y: 0, width: 34, height: 100, style: 'fill:var(--kd-castle-2)' }, castle);
  el('path', { d: 'M6 24 l13 -16 l13 16 z', style: 'fill:var(--kd-castle-2)' }, castle);
  el('path', { d: 'M70 14 l13 -17 l13 17 z', style: 'fill:var(--kd-castle-2)' }, castle);
  el('path', { d: 'M34 0 l17 -22 l17 22 z', style: 'fill:var(--kd-castle)' }, castle);
  const battlements = el('g', { style: 'fill:var(--kd-castle)' }, castle);
  el('rect', { x: 0, y: 52, width: 14, height: 10 }, battlements);
  el('rect', { x: 44, y: 52, width: 14, height: 10 }, battlements);
  el('rect', { x: 86, y: 52, width: 14, height: 10 }, battlements);
  el('rect', { x: 42, y: 26, width: 8, height: 14, rx: 2, style: 'fill:var(--kd-window-lit)' }, castle);
  el('rect', { x: 58, y: 26, width: 8, height: 14, rx: 2, style: 'fill:var(--kd-window-lit)' }, castle);
  const flagPole = el('line', { x1: 51, y1: -22, x2: 51, y2: -4, style: 'stroke:var(--kd-castle-2);stroke-width:2.4' }, castle);
  flagPole.setAttribute('x1', 51);
  const flag = el('path', { d: 'M51 -20 l17 5 l-17 5 z', class: 'kd-flag', style: 'fill:var(--kd-flag);transform-origin:51px -15px' }, castle);

  // a burning cottage below the castle — the countryside is under siege
  const hut = el('g', { transform: 'translate(430,270)' }, svg);
  el('rect', { x: 0, y: 18, width: 30, height: 22, style: 'fill:var(--kd-house)' }, hut);
  el('path', { d: 'M-3 18 l18 -16 l18 16 z', style: 'fill:var(--kd-roof)' }, hut);
  const flame = el('g', { style: 'transform-origin:16px 10px', class: 'kd-flick' }, hut);
  el('path', { d: 'M16 -12 q14 16 10 28 q-2 9 -10 13 q-8 -4 -10 -13 q-3 -12 10 -28 z', style: 'fill:var(--kd-fire-1)' }, flame);
  el('path', { d: 'M16 0 q7 9 5 15 q-1 5 -5 7 q-4 -2 -5 -7 q-2 -6 5 -15 z', style: 'fill:var(--kd-fire-2)' }, flame);
  el('ellipse', { cx: 22, cy: -26, rx: 12, ry: 22, style: 'fill:var(--kd-smoke)' }, hut);

  // a few tree silhouettes for texture
  const treeAt = (x, y, s = 1) => {
    const t = el('g', { transform: `translate(${x},${y}) scale(${s})`, style: 'fill:var(--kd-tree)' }, svg);
    el('rect', { x: -3, y: 10, width: 6, height: 14 }, t);
    el('path', { d: 'M-14 12 L0 -24 L14 12 Z' }, t);
  };
  treeAt(120, 340); treeAt(150, 352, 0.8); treeAt(780, 320); treeAt(850, 336, 0.75); treeAt(920, 400, 0.9);

  // ground band + horizon edge — tile tray lives below this, on any theme
  el('rect', { x: -50, y: GROUND_Y, width: 1100, height: 155, style: 'fill:var(--kd-ground)' }, svg);
  el('rect', { x: -50, y: GROUND_Y, width: 1100, height: 5, style: 'fill:var(--kd-ground-edge)' }, svg);
}

function buildTower() {
  // Verbatim geometry/behavior from rocket.js — the tests assert this shape.
  railL = el('rect', { x: 400, y: 185, width: 10, height: 375, style: 'fill:var(--kd-castle-2)' }, svg);
  railR = el('rect', { x: 462, y: 185, width: 10, height: 375, style: 'fill:var(--kd-castle-2)' }, svg);
  for (let n = 1; n <= 10; n++) {
    const y = 482 - (n - 1) * 30;
    const g = el('g', { class: 'slot', id: `slot${n}` }, svg);
    el('rect', { x: 408, y, width: 56, height: 28, rx: 8 }, g);
    el('text', { x: 436, y: y + 21, 'font-size': 20, 'text-anchor': 'middle' }, g).textContent = n;
    slots[n] = g;
  }
  arrowEl = el('text', { x: 436, y: 172, 'font-size': 34, 'text-anchor': 'middle' }, svg);
}

// mode: 'ambient' | 'battle' | 'dead' — sets dragonAnchor's absolute
// position/scale (transitioned) and toggles the patrol wobble, which lives
// on a SEPARATE child element so its relative keyframe motion never fights
// the anchor's JS-driven absolute transform.
function setDragonMode(mode) {
  dragonPatrol.classList.toggle('kd-patrol', mode === 'ambient');
  if (mode !== 'ambient') dragonPatrol.style.transform = ''; // clear any residual wobble
  const p = mode === 'battle' ? DRAGON_BATTLE : mode === 'dead' ? DRAGON_DEAD : DRAGON_AMBIENT;
  dragonAnchor.style.opacity = mode === 'dead' ? 0 : 1;
  dragonAnchor.style.transform =
    `translate(${p.x}px,${p.y}px) rotate(${p.rotate || 0}deg) scale(${p.scale})`;
}

function buildDragon() {
  // Anchor: absolute mode position (ambient/battle/dead), CSS-transitioned.
  // Patrol: a small RELATIVE wobble layered on top, active only in ambient
  // mode, via a pure-CSS keyframe (no JS timers — never hangs in a
  // hidden/throttled tab). Float: the constant idle bob, always on.
  dragonAnchor = el('g', { id: 'kdDragonAnchor', style: 'transform-origin:0 0;transition:transform .9s ease, opacity 1s ease' }, svg);
  dragonPatrol = el('g', { class: 'kd-patrol' }, dragonAnchor);
  const float = el('g', { class: 'kd-float' }, dragonPatrol);
  dragonTint = el('g', { style: 'transition:filter .18s ease' }, float);

  // body
  el('ellipse', { cx: 0, cy: 0, rx: 62, ry: 42, style: 'fill:var(--kd-d-body)' }, dragonTint);
  el('path', { d: 'M-58 -6 Q-92 -30 -120 -10 Q-98 4 -84 6 Q-100 20 -96 40 Q-72 30 -58 8 Z', style: 'fill:var(--kd-d-body-2)' }, dragonTint); // tail
  el('path', { d: 'M-30 -30 Q40 -10 84 -30 Q56 -46 20 -50 Q-8 -50 -30 -30 Z', style: 'fill:var(--kd-d-belly)', opacity: 0.85 }, dragonTint); // belly
  // wings
  const wingBack = el('g', { style: 'transform-origin:-10px -20px', class: 'kd-flapB' }, dragonTint);
  el('path', { d: 'M-10 -20 Q-50 -86 -110 -70 Q-80 -34 -46 -24 Q-70 -6 -60 24 Q-24 6 -10 -20 Z', style: 'fill:var(--kd-d-wing-2)' }, wingBack);
  const wingFront = el('g', { style: 'transform-origin:14px -22px', class: 'kd-flapA' }, dragonTint);
  el('path', { d: 'M14 -22 Q60 -96 128 -68 Q90 -30 50 -20 Q80 6 64 36 Q22 10 14 -22 Z', style: 'fill:var(--kd-d-wing)' }, wingFront);
  // head + horns + eye
  const head = el('g', { transform: 'translate(58,-16)' }, dragonTint);
  el('ellipse', { cx: 0, cy: 0, rx: 34, ry: 27, style: 'fill:var(--kd-d-body)' }, head);
  el('path', { d: 'M-6 -22 l4 -18 l11 14 z', style: 'fill:var(--kd-d-horn)' }, head);
  el('path', { d: 'M12 -22 l4 -18 l11 14 z', style: 'fill:var(--kd-d-horn)' }, head);
  el('path', { d: 'M28 -4 q18 -6 24 6 q-14 5 -24 1 z', style: 'fill:var(--kd-d-body-2)' }, head); // jaw
  el('circle', { cx: 14, cy: -2, r: 9, style: 'fill:#ffffff' }, head);
  el('circle', { cx: 16, cy: -2, r: 4.6, style: 'fill:var(--kd-d-eye)' }, head);
  deadEye = el('g', { opacity: 0, style: 'transition:opacity .3s ease' }, head);
  el('path', { d: 'M8 -8 l12 12 M20 -8 l-12 12', style: 'stroke:#15121a;stroke-width:3.4;stroke-linecap:round' }, deadEye);

  // fire breath, aimed forward — decorative, fires while building
  fireBreath = el('g', { transform: 'translate(88,-14) rotate(6)', opacity: 0, style: 'transition:opacity .2s ease' }, dragonTint);
  const flick = el('g', { class: 'kd-flick', style: 'transform-origin:0 0' }, fireBreath);
  el('path', { d: 'M0 -8 L46 -26 L86 -14 L120 -30 L96 0 L120 30 L86 14 L46 26 L0 8 Z', style: 'fill:var(--kd-fire-1)' }, flick);
  el('path', { d: 'M4 -5 L40 -16 L66 -8 L46 0 L66 8 L40 16 L4 5 Z', style: 'fill:var(--kd-fire-2)' }, flick);
}

function buildSpark() {
  sparkEl = el('g', { opacity: 0, style: 'transition:opacity .16s ease, transform .16s ease' }, svg);
  el('path', {
    d: 'M0 -26 L10 -8 L30 -12 L16 4 L26 22 L0 12 L-26 22 L-16 4 L-30 -12 L-10 -8 Z',
    style: 'fill:#ffd23f',
  }, sparkEl);
  el('circle', { cx: 0, cy: 0, r: 11, style: 'fill:#ffffff' }, sparkEl);
  el('circle', { cx: 0, cy: 0, r: 5, style: 'fill:#ff6a3c' }, sparkEl);
}

function armorGroup(n, build) {
  const g = el('g', { id: `armor${n}`, style: 'opacity:0;transform:translateY(10px);transition:opacity .35s ease, transform .4s ease' }, knightWrap);
  build(g);
  armor[n] = g;
}

function buildKnight() {
  // Local box: ~180 wide, feet at local y=0 (translated to the ground).
  knightWrap = el('g', { transform: `translate(720,${GROUND_Y})` }, svg);
  el('ellipse', { cx: 0, cy: 4, rx: 58, ry: 11, style: 'fill:rgba(0,0,0,.2)' }, knightWrap);

  // cape (behind the body)
  el('path', { d: 'M-30 -160 Q-58 -90 -50 -8 Q-24 -2 -6 -8 Q-14 -84 -6 -160 Z', style: 'fill:var(--kd-k-cape)' }, knightWrap);

  // base squire — always visible
  el('rect', { x: -18, y: -80, width: 16, height: 66, rx: 7, style: 'fill:var(--kd-k-cloth-2)' }, knightWrap); // left leg
  el('rect', { x: 4, y: -80, width: 16, height: 66, rx: 7, style: 'fill:var(--kd-k-cloth-2)' }, knightWrap);   // right leg
  el('rect', { x: -30, y: -164, width: 60, height: 88, rx: 18, style: 'fill:var(--kd-k-cloth)' }, knightWrap); // torso
  const head = el('g', { transform: 'translate(0,-190)' }, knightWrap);
  el('circle', { cx: 0, cy: 0, r: 24, style: 'fill:var(--kd-k-cloth)' }, head);
  el('ellipse', { cx: 0, cy: 3, rx: 14, ry: 16, style: 'fill:var(--kd-k-skin)' }, head);
  el('circle', { cx: -5, cy: 0, r: 2, style: 'fill:var(--kd-k-ink)' }, head);
  el('circle', { cx: 5, cy: 0, r: 2, style: 'fill:var(--kd-k-ink)' }, head);
  el('path', { d: 'M-5 7 q5 4 10 0', style: 'stroke:var(--kd-k-ink);stroke-width:1.8;stroke-linecap:round;fill:none' }, head);
  el('circle', { cx: -9, cy: 4, r: 2.6, style: 'fill:var(--kd-k-cheek)', opacity: 0.6 }, head);
  el('circle', { cx: 9, cy: 4, r: 2.6, style: 'fill:var(--kd-k-cheek)', opacity: 0.6 }, head);

  // 1 sabatons (boots)
  armorGroup(1, (g) => {
    el('path', { d: 'M-24 -18 h20 v10 q0 4 -4 4 h-26 q-4 0 -1 -6 z', style: 'fill:var(--kd-k-metal)' }, g);
    el('path', { d: 'M4 -18 h20 v10 q3 6 -1 6 h-26 q-4 0 -4 -4 v-10 z', style: 'fill:var(--kd-k-metal)' }, g);
  });
  // 2 greaves (shin guards)
  armorGroup(2, (g) => {
    el('rect', { x: -20, y: -60, width: 15, height: 44, rx: 6, style: 'fill:var(--kd-k-metal-2)' }, g);
    el('rect', { x: 5, y: -60, width: 15, height: 44, rx: 6, style: 'fill:var(--kd-k-metal-2)' }, g);
  });
  // 3 cuirass (chestplate)
  armorGroup(3, (g) => {
    el('path', { d: 'M-27 -162 q27 -10 54 0 q7 30 1 66 q-28 12 -56 0 q-6 -36 1 -66 z', style: 'fill:var(--kd-k-metal)' }, g);
    el('circle', { cx: 0, cy: -128, r: 6, style: 'fill:var(--kd-k-gem)' }, g);
  });
  // 4 fauld (hip guard)
  armorGroup(4, (g) => {
    el('path', { d: 'M-24 -96 q24 8 48 0 l-3 12 q-21 7 -42 0 z', style: 'fill:var(--kd-k-metal-2)' }, g);
  });
  // 5 pauldrons (shoulder guards)
  armorGroup(5, (g) => {
    el('path', { d: 'M-42 -158 q16 -12 32 -1 q3 16 -4 24 q-17 6 -29 -4 q-4 -10 1 -19 z', style: 'fill:var(--kd-k-metal)' }, g);
    el('path', { d: 'M42 -158 q-16 -12 -32 -1 q-3 16 4 24 q17 6 29 -4 q4 -10 -1 -19 z', style: 'fill:var(--kd-k-metal)' }, g);
  });
  // 6 gauntlets (gloves)
  armorGroup(6, (g) => {
    el('rect', { x: -46, y: -128, width: 17, height: 32, rx: 7, style: 'fill:var(--kd-k-metal-2)' }, g);
    el('rect', { x: 29, y: -128, width: 17, height: 32, rx: 7, style: 'fill:var(--kd-k-metal-2)' }, g);
    el('circle', { cx: -38, cy: -92, r: 10, style: 'fill:var(--kd-k-metal)' }, g);
    el('circle', { cx: 38, cy: -92, r: 10, style: 'fill:var(--kd-k-metal)' }, g);
  });
  // 7 great helm
  armorGroup(7, (g) => {
    el('path', { d: 'M-24 -190 q2 -30 24 -30 q22 0 24 30 q-3 4 -7 6 q-16 -9 -34 0 q-4 -2 -7 -6 z', style: 'fill:var(--kd-k-metal)' }, g);
  });
  // 8 visor + plume
  armorGroup(8, (g) => {
    el('rect', { x: -21, y: -197, width: 42, height: 6, rx: 3, style: 'fill:var(--kd-k-metal)' }, g);
    el('path', { d: 'M-4 -216 q-3 -24 15 -33 q10 16 4 32 q-10 7 -19 1 z', style: 'fill:var(--kd-k-plume)' }, g);
    el('circle', { cx: 0, cy: -213, r: 4, style: 'fill:var(--kd-k-gem)' }, g);
  });
  // 10 shield (behind sword in paint order, per the design)
  armorGroup(10, (g) => {
    el('path', { d: 'M-64 -150 q19 -8 40 0 v24 q0 32 -20 44 q-20 -12 -20 -44 z', style: 'fill:var(--kd-k-shield)' }, g);
    el('path', { d: 'M-64 -150 q19 -8 40 0 v24 q0 32 -20 44 q-20 -12 -20 -44 z', style: 'fill:none;stroke:var(--kd-k-trim);stroke-width:3.5' }, g);
    el('circle', { cx: -44, cy: -122, r: 6, style: 'fill:var(--kd-k-gem)' }, g);
  });
  // 9 sword — pivots at the hilt for the jab strike
  armorGroup(9, (g) => {
    swordGroup = el('g', { style: 'transform-origin:44px -122px;transition:transform .16s ease' }, g);
    el('rect', { x: 38, y: -128, width: 12, height: 3, style: 'fill:var(--kd-k-trim)' }, swordGroup);
    el('rect', { x: 42, y: -196, width: 4, height: 68, style: 'fill:var(--kd-k-metal-2)' }, swordGroup);
    el('path', { d: 'M40 -128 L40 -190 L44 -200 L48 -190 L48 -128 Z', style: 'fill:#eef3fb' }, swordGroup);
    el('circle', { cx: 44, cy: -122, r: 5, style: 'fill:var(--kd-k-trim)' }, swordGroup);
  });
}

function jabSword(deg) {
  if (!swordGroup) return;
  swordGroup.style.transform = `rotate(${deg}deg)`;
}

// A brief wobble on hit. Lands on dragonPatrol — during battle it carries no
// animation (the ambient-only 'kd-patrol' class is off), so this can't fight
// dragonAnchor's JS-driven absolute mode transform.
function flinch() {
  dragonPatrol.classList.remove('kd-flinch');
  void dragonPatrol.offsetWidth;
  dragonPatrol.classList.add('kd-flinch');
}

function tintDragon() {
  if (dmg <= 0) { dragonTint.style.filter = 'none'; return; }
  dragonTint.style.filter =
    `sepia(${dmg.toFixed(2)}) saturate(${(1 + dmg * 4).toFixed(2)}) hue-rotate(${Math.round(-dmg * 34)}deg) brightness(${(1 - dmg * 0.12).toFixed(2)})`;
}

export const knightTheme = {
  name: 'knight',
  strings: { finaleBanner: 'VICTORY!' },
  numberColors() { return numColors(); },

  mount(sceneEl) {
    mountAbort?.abort();
    mountAbort = new AbortController();
    sceneEl.replaceChildren();
    svg = el('svg', { viewBox: '0 0 1000 700', preserveAspectRatio: 'xMidYMax slice', 'data-theme': 'knight' }, null);
    sceneEl.appendChild(svg);
    const fitView = () => {
      svg.setAttribute('viewBox', innerWidth / innerHeight < 0.85 ? '280 0 660 700' : '0 0 1000 700');
    };
    fitView();
    window.addEventListener('resize', fitView, { signal: mountAbort.signal });

    defs = el('defs', {}, svg);
    const style = el('style', {}, svg);
    style.textContent = `
      text { font-family: 'Fredoka', ui-rounded, sans-serif; }
      .kd-twinkle { animation: kdTwinkle 2.6s ease-in-out infinite; }
      @keyframes kdTwinkle { 50% { opacity: .2; } }
      .kd-flick { animation: kdFlick .3s ease-in-out infinite; }
      @keyframes kdFlick { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.1,.86); opacity: 1; } }
      .kd-float { animation: kdFloat 4.2s ease-in-out infinite; }
      @keyframes kdFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      .kd-flapA { animation: kdFlapA 1.35s ease-in-out infinite; }
      @keyframes kdFlapA { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(-24deg); } }
      .kd-flapB { animation: kdFlapB 1.35s ease-in-out infinite; }
      @keyframes kdFlapB { 0%,100% { transform: rotate(4deg); } 50% { transform: rotate(22deg); } }
      .kd-patrol { animation: kdPatrol 9s ease-in-out infinite; }
      @keyframes kdPatrol { 0%,100% { transform: translate(0,0); } 50% { transform: translate(180px,36px); } }
      .kd-flinch { animation: kdFlinch .26s ease; }
      @keyframes kdFlinch { 0% { transform: translate(0,0) rotate(0); } 40% { transform: translate(-14px,-8px) rotate(-6deg); } 100% { transform: translate(0,0) rotate(0); } }
      .slot rect { fill: var(--kd-slot-off); stroke: var(--kd-slot-off-stroke); stroke-width: 2; transition: fill .25s; }
      .slot text { fill: rgba(255,255,255,.55); font-weight: 600; transition: fill .25s; }
      .slot.lit text { fill: #fff; }
    `;

    buildCountryside();
    buildTower();
    buildDragon();
    buildSpark();
    buildKnight();
    applyPalette(variant);

    this.reset();
  },

  unmount() {
    mountAbort?.abort();
    mountAbort = null;
    // page-level sky vars are the only thing this theme leaves outside
    // #scene — clear them so switching back to another theme never
    // inherits a knight palette.
    const root = document.documentElement;
    root.style.removeProperty('--sky-top');
    root.style.removeProperty('--sky-mid');
    root.style.removeProperty('--sky-bottom');
  },

  reset(empty = false) {
    saidNums.clear();
    dmg = 0;
    tintDragon();
    fireBreath.style.opacity = 0;
    deadEye.style.opacity = 0;
    sparkEl.style.opacity = 0;
    sparkEl.style.transform = 'scale(0.4)';
    jabSword(0);
    // launch() swaps in a slower one-shot transition for the death fall;
    // restore the normal mode-switch speed for the next round.
    dragonAnchor.style.transition = 'transform .9s ease, opacity 1s ease';
    setDragonMode('ambient');
    for (let n = 1; n <= 10; n++) {
      const on = !empty;
      armor[n].style.opacity = on ? 1 : 0;
      armor[n].style.transform = on ? 'translateY(0)' : 'translateY(10px)';
      this.light(n, false);
    }
    this.setRange(10);
    this.setDirection(null);
  },

  setMasked(m) {
    masked = m;
    for (let n = 1; n <= 10; n++) slotText(n);
  },

  setRange(len) {
    const top = 482 - (len - 1) * 30;
    for (let n = 1; n <= 10; n++) slots[n].style.display = n <= len ? '' : 'none';
    for (const r of [railL, railR]) {
      r.setAttribute('y', top - 22);
      r.setAttribute('height', GROUND_Y - (top - 22));
    }
    arrowEl.setAttribute('y', top - 34);
  },

  setDirection(dir) {
    arrowEl.textContent = dir === 'up' ? '⬆️' : dir === 'down' ? '⬇️' : '';
  },

  light(n, on) {
    const g = slots[n];
    if (!g) return;
    g.classList.toggle('lit', on);
    g.querySelector('rect').style.fill = on ? numColors()[n] : '';
    slotText(n);
  },

  markCounted(n) {
    saidNums.add(n);
    this.light(n, true);
  },

  // Direct reveal — no separate "flies up" flourish; armor{n} fades/settles
  // into place, matching the source design's simple opacity+translateY cue.
  async loadCrate(n, len = 10, fast = false) {
    const g = armor[n];
    if (g) {
      g.style.opacity = 1;
      g.style.transform = 'translateY(0)';
    }
    // decorative — the dragon huffs at the countryside as the knight arms up
    fireBreath.style.opacity = 1;
    setTimeout(() => { fireBreath.style.opacity = 0; }, 550);
    await new Promise((r) => setTimeout(r, fast ? 200 : 500));
  },

  // "Draw your sword!" — force-reveal sword+shield if the range left them
  // hidden, flourish the blade up, and settle the dragon into battle stance.
  async boardCrew() {
    armor[9].style.opacity = 1; armor[9].style.transform = 'translateY(0)';
    armor[10].style.opacity = 1; armor[10].style.transform = 'translateY(0)';
    jabSword(-24);
    setTimeout(() => jabSword(0), 260);

    setDragonMode('battle');
    await new Promise((r) => setTimeout(r, 1100));
    await new Promise((r) => setTimeout(r, 900)); // let the transition settle before questions start
  },

  preCountdown(len) {
    saidNums.clear();
    for (let n = 1; n <= 10; n++) this.light(n, n <= len);
    this.setDirection('down');
    setDragonMode('battle');
  },

  // n just got counted; strike intensity grows as we approach 1.
  tickCountdown(n, len) {
    saidNums.add(n);
    this.light(n, false);
    jabSword(-92);
    setTimeout(() => jabSword(0), 250);
    setTimeout(() => {
      dmg = Math.min(0.78, ((len - n) / len) * 0.85);
      tintDragon();
      flinch();
      sparkEl.style.opacity = 1;
      sparkEl.style.transform = 'scale(1.2)';
      setTimeout(() => { sparkEl.style.opacity = 0; sparkEl.style.transform = 'scale(0.4)'; }, 210);
    }, 160);
  },

  // The final blow. Resolves once the dragon has fallen from the sky.
  async launch(shakeEls) {
    shakeEls.forEach((e) => e.classList.add('shake-lg'));
    jabSword(-108);
    setTimeout(() => jabSword(0), 320);
    await new Promise((r) => setTimeout(r, 240));

    dmg = 1;
    tintDragon();
    sparkEl.style.opacity = 1;
    sparkEl.style.transform = 'scale(1.9)';
    setTimeout(() => { sparkEl.style.opacity = 0; }, 300);
    deadEye.style.opacity = 1;
    await new Promise((r) => setTimeout(r, 450));

    dragonAnchor.style.transition = 'transform 1.2s ease-in, opacity 1s ease-in .1s';
    setDragonMode('dead');

    const rect = svg.getBoundingClientRect();
    confettiBurst(rect.left + rect.width * 0.66, rect.top + rect.height * 0.42, 80);

    await new Promise((r) => setTimeout(r, 1300));
    shakeEls.forEach((e) => e.classList.remove('shake-lg'));
    await new Promise((r) => setTimeout(r, 500));
  },

  setVariant(i) { applyPalette(i); },
};
