// The monkey & banana-tree theme: a lush storybook jungle where counting up
// fills a banana bunch in the tree (the monkey getting giddier with each one),
// and counting down eats them one by one before a vine-swing victory.
//
// The scene art is a VERBATIM port of the Claude Design spec (project
// fe16e7c1-b1f1-4853-bdb3-49851d87eaf1 — MonkeyScene + Monkey + Monkey Game
// Flow) via tools/port-monkey-scene.mjs → monkey-scene.js. The design is the
// spec, never re-draw. Adaptations, each marked ADAPTED below:
//   - the game's 1000x700 viewBox (one wrapper transform in the generated
//     markup — identical to knight/rocket);
//   - the design is a hybrid (SVG scene + HTML-% overlay layer); the game is
//     ONE svg so it scales/crops as a unit through preserveAspectRatio slice +
//     the portrait crop (an HTML overlay would drift on the iPad). So the
//     Flow's % overlays (character, flying banana, swing) are nested svg/g at
//     the design's positions, and its HTML-box keyframes (mkPop/mkEat/
//     mkSwingRig) are re-expressed here as SVG transforms;
//   - the tower/rail/arrow geometry + #slot{n}/.lit contract are copied
//     verbatim from rocket.js (the tests assert that shape); only the x offset
//     and the TIKI-TOTEM styling are themed;
//   - the design's baked banana bunch is the interactive one (revealed per
//     count); its baked single-pose monkey is cut in favor of the 5-pose
//     Monkey character.

import { confettiBurst } from '../fx.js';
import { sfx } from '../audio.js';
import { KEYFRAMES, STAGE_MARKUP } from './monkey-scene.js';

const SVG = 'http://www.w3.org/2000/svg';
const GROUND_Y = 560; // same convention as rocket/knight — tile tray sits below

// ADAPTED (tile-tray contract — Tucker): the Flow stands the monkey on a soft
// mound whose crest falls *inside* the tray's band, so the tiles float amid the
// scene. Every other theme reserves a clean ground shelf at GROUND_Y for the
// tray (rocket's tarmac, knight's foreground band). Match that — mount() draws a
// flat foreground shelf at the shelf line and raises the monkey onto it, so the
// tiles get a dedicated slot below. The lift shifts his mouth (eat target) and
// vine grip, so those follow MONKEY_Y below.
const MONKEY_BASE_Y = 285;               // design y the Flow places the standing monkey
const MONKEY_LIFT = 30;                   // raise him onto the shelf, clear of the tray
const MONKEY_Y = MONKEY_BASE_Y - MONKEY_LIFT; // 255

// The number ramp (design's Flow COLORS 1..10) for the selection tiles. Like
// knight's stone tower, the tiki totem itself is wood (lit = bright, unlit =
// dimmed), NOT rainbow — the tiles carry the color.
const RAMP = {
  1: '#e5484d', 2: '#f2851f', 3: '#f0b429', 4: '#5aa84f', 5: '#22a39a',
  6: '#2f7ad6', 7: '#3f6fe0', 8: '#8a4fd6', 9: '#d64f9e', 10: '#c76b2e',
};

// Three times of day across a mission's 3 launches (morning → sunset → night),
// setVariant(sessionStars) → 0/1/2. `sky` drives the page-level gradient
// (documentElement --sky-*); `vars` are the design's palette CSS custom
// properties VERBATIM (scene-scoped on the svg root); `night` flips the
// day/night scene groups (sun+rays+butterflies ↔ moon+stars+fireflies).
const PALETTES = [
  { // 0: morning — soft gold sunrise, misty peach-and-blue, dewy greens
    night: false,
    sky: { top: '#bfe0f0', mid: '#ffe3cf', bottom: '#ffd9b0' },
    vars: {
      '--sky-top': '#bfe0f0', '--sky-mid': '#ffe3cf', '--sky-bot': '#ffd9b0', '--celest': '#fff3c4', '--celest-glow': '#ffe9a8', '--mist': '#ffffff', '--mist-a': '.5', '--ray': '#fff6d8',
      '--canopy-far': '#cfe6c9', '--canopy-far-2': '#bcdcc0', '--canopy-mid': '#8fc98a', '--canopy-mid-2': '#79bd82', '--leaf': '#6bbf59', '--leaf-2': '#57ab4c', '--leaf-3': '#84cf6b', '--leaf-dark': '#3f8f43', '--fg-leaf': '#2f7a3a', '--fg-leaf-2': '#1f5f2c', '--vine': '#4f9a4a',
      '--ground': '#7bb86a', '--ground-2': '#6aa85c', '--ground-rim': '#96d17e', '--trunk': '#b07a45', '--trunk-2': '#8f5f33', '--trunk-dark': '#6f4a28', '--trunk-rim': '#d6a56a',
      '--banana': '#ffd23f', '--banana-2': '#ffe884', '--banana-tip': '#7a5a2a', '--banana-stem': '#5f7a2a',
      '--fur': '#b57a45', '--fur-2': '#96602f', '--fur-face': '#f0d3a8', '--fur-face-2': '#e0bd8c', '--fur-rim': '#fff0c0', '--eye': '#3a2416', '--eye-white': '#fffaf0', '--nose': '#6f4a2c', '--mouth': '#7a3f2a', '--tongue': '#e88a7a', '--cheek': '#f2a37a', '--char-shadow': 'rgba(40,60,30,.22)',
      '--bfly': '#e5674f', '--bfly-2': '#f2a83f', '--spark': '#ffd23f', '--vign-a': '0', '--glow-a': '0',
    },
  },
  { // 1: sunset — warm orange-coral-magenta, golden-hour rim light
    night: false,
    sky: { top: '#7a3d8f', mid: '#e5674f', bottom: '#ffb057' },
    vars: {
      '--sky-top': '#7a3d8f', '--sky-mid': '#e5674f', '--sky-bot': '#ffb057', '--celest': '#fff0c0', '--celest-glow': '#ffb04a', '--mist': '#ffcaa0', '--mist-a': '.4', '--ray': '#ffd9a0',
      '--canopy-far': '#8a5f86', '--canopy-far-2': '#79527a', '--canopy-mid': '#4f7a56', '--canopy-mid-2': '#3f6a4c', '--leaf': '#3f8a4a', '--leaf-2': '#2f6f3d', '--leaf-3': '#5aa855', '--leaf-dark': '#245a33', '--fg-leaf': '#1f4f2e', '--fg-leaf-2': '#153f24', '--vine': '#356b3d',
      '--ground': '#4a6a3e', '--ground-2': '#3a5632', '--ground-rim': '#6a8a4e', '--trunk': '#9a5f38', '--trunk-2': '#6f4326', '--trunk-dark': '#4a2c16', '--trunk-rim': '#ffb267',
      '--banana': '#ffc23a', '--banana-2': '#ffdc72', '--banana-tip': '#7a5a24', '--banana-stem': '#4f5a24',
      '--fur': '#a86a3c', '--fur-2': '#7f4e27', '--fur-face': '#ecc493', '--fur-face-2': '#d6a877', '--fur-rim': '#ffb267', '--eye': '#2e1c12', '--eye-white': '#fff0e0', '--nose': '#5f3f24', '--mouth': '#6a3423', '--tongue': '#e07a5f', '--cheek': '#e8865a', '--char-shadow': 'rgba(70,30,20,.32)',
      '--bfly': '#d64a6a', '--bfly-2': '#ffca55', '--spark': '#ffdc72', '--vignette': '#3a1530', '--vign-a': '.14', '--glow-a': '0',
    },
  },
  { // 2: starry night — deep indigo, bright moon, fireflies, warm monkey glow
    night: true,
    sky: { top: '#0d1233', mid: '#1c2a5a', bottom: '#2f4a68' },
    vars: {
      '--sky-top': '#0d1233', '--sky-mid': '#1c2a5a', '--sky-bot': '#2f4a68', '--celest': '#f4f7ff', '--celest-glow': '#ccd8ff', '--moon-crater': '#d7e0ff', '--mist': '#5a7fb0', '--mist-a': '.3', '--star': '#eaf0ff',
      '--canopy-far': '#20304c', '--canopy-far-2': '#192740', '--canopy-mid': '#25464a', '--canopy-mid-2': '#1d383c', '--leaf': '#2f6a5f', '--leaf-2': '#245650', '--leaf-3': '#3d7d6a', '--leaf-dark': '#1a4038', '--fg-leaf': '#16362f', '--fg-leaf-2': '#0e2622', '--vine': '#295a4f',
      '--ground': '#213f3b', '--ground-2': '#18312c', '--ground-rim': '#33564a', '--trunk': '#4a3a4a', '--trunk-2': '#352838', '--trunk-dark': '#221826', '--trunk-rim': '#8f9bd0',
      '--banana': '#f2c64a', '--banana-2': '#ffe08a', '--banana-tip': '#6a5a2a', '--banana-stem': '#3a4a2a',
      '--fur': '#7a5a48', '--fur-2': '#59403a', '--fur-face': '#cdb89a', '--fur-face-2': '#a8927c', '--fur-rim': '#ffe3b0', '--eye': '#161320', '--eye-white': '#eef0ff', '--nose': '#4a3a30', '--mouth': '#4a2a26', '--tongue': '#b06a5a', '--cheek': '#b0705a', '--char-shadow': 'rgba(8,12,28,.4)',
      '--firefly': '#fff1a8', '--char-glow': '#ffe6b0', '--glow-a': '.5', '--vignette': '#080c22', '--vign-a': '.55',
      // sunset-only vars the night set omits; keep the day sun/butterfly/spark
      // colors defined so a mid-mission repaint back to day is clean:
      '--celest-glow-day': '#ffe9a8',
    },
  },
];

let svg;
let variant = 0;
let masked = false;
const saidNums = new Set();
let curGlow = 0; // slot currently ringed as the "active" rung (0 = none)
let mountAbort = null;

// scene handles
const slots = {};
const bananaEls = {}; // 1..10 -> <g data-mk-banana="n">
let railL, railR, arrowEl;
let monkeyBounce, poseStanding, poseSwing, chompEl, flyingBanana, celebVines, sceneVines, swingVine, vignette, vstopIn, vstopOut;
let eatT1, eatT2; // countdown mouth open/close timers
const arms = {}, expr = {};
let dayGroups = [], nightGroups = [];
let reactToggle = 0, chompToggle = 0;
let woodStops = null;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slotText(n) {
  const g = slots[n];
  g.querySelector('text').textContent = (!masked || saidNums.has(n)) ? n : '•';
}

function numColors() { return RAMP; }

function applyPalette(i) {
  variant = ((i % PALETTES.length) + PALETTES.length) % PALETTES.length;
  const p = PALETTES[variant];
  const root = document.documentElement;
  root.style.setProperty('--sky-top', p.sky.top);
  root.style.setProperty('--sky-mid', p.sky.mid);
  root.style.setProperty('--sky-bottom', p.sky.bottom);
  for (const [k, v] of Object.entries(p.vars)) svg.style.setProperty(k, v);
  // day/night scene groups
  for (const g of dayGroups) if (g) g.style.display = p.night ? 'none' : '';
  for (const g of nightGroups) if (g) g.style.display = p.night ? '' : 'none';
  // vignette (edge darkening), recolored + faded per palette
  if (vignette) {
    vignette.style.opacity = p.vars['--vign-a'] || '0';
    const vc = p.vars['--vignette'] || '#080c22';
    vstopIn.setAttribute('style', `stop-color:${vc};stop-opacity:0`);
    vstopOut.setAttribute('style', `stop-color:${vc};stop-opacity:1`);
  }
}

/* ---------------- tiki totem (tower) — geometry verbatim, styling themed ---------------- */

const TOWER_X = 150;          // landscape: left of the tree, clear of the monkey
const TOWER_X_PORTRAIT = 300; // portrait crop starts at x=280, tree trunk ~405

// `x` is the tower anchor (rocket/knight's rail-left reference, canonically
// 400). Every rung part carries its offset-from-anchor in data-col, so the
// aspect-dependent shift is one add. Circles reposition via cx, everything
// else via x.
function layoutTower(x) {
  if (!railL) return;
  railL.setAttribute('x', x - 4);
  railR.setAttribute('x', x + 66);
  for (let n = 1; n <= 10; n++) {
    for (const node of slots[n].querySelectorAll('[data-col]')) {
      node.setAttribute(node.tagName === 'circle' ? 'cx' : 'x', x + Number(node.dataset.col));
    }
  }
  arrowEl.setAttribute('x', x + 36);
}

function buildTower() {
  // Slot/rail/arrow geometry verbatim from rocket.js (tests assert #slot{n}
  // rect + .lit); only the x offset and the carved-wood TIKI styling are
  // themed. Built AFTER the stage markup so the totem sits over the scene.
  const defs = el('defs', {}, svg);
  const wood = el('linearGradient', { id: 'mkWood', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  woodStops = {
    top: el('stop', { offset: 0, 'stop-color': '#d69a5c' }, wood),
    mid: el('stop', { offset: 0.4, 'stop-color': '#b67840' }, wood),
    bot: el('stop', { offset: 1, 'stop-color': '#a2673a' }, wood),
  };

  const X = TOWER_X; // fitView() re-lays-out immediately after with the real x
  railL = el('rect', { x: X - 4, y: 185, width: 8, height: 375, rx: 4, style: 'fill:var(--trunk-dark,#6f4a28)' }, svg);
  railR = el('rect', { x: X + 66, y: 185, width: 8, height: 375, rx: 4, style: 'fill:var(--trunk-dark,#6f4a28)' }, svg);

  for (let n = 1; n <= 10; n++) {
    const y = 482 - (n - 1) * 30;
    const g = el('g', { class: 'slot', id: `slot${n}` }, svg);
    // carved-wood rung (the design's rung gradient + border + inset highlight)
    el('rect', { x: X + 8, y, width: 56, height: 28, rx: 8, class: 'mk-wood', 'data-col': 8 }, g);
    el('rect', { x: X + 11, y: y + 2, width: 50, height: 3, rx: 1.5, class: 'mk-hi', 'data-col': 11 }, g);
    // tiki peg dots — two carved pegs, three studs each (design's box-shadow trio)
    for (const off of [14, 58]) {
      for (const dy of [7, 14, 21]) {
        el('circle', { cx: X + off, cy: y + dy, r: 1.8, class: 'mk-peg', 'data-col': off }, g);
      }
    }
    el('text', { x: X + 36, y: y + 21, 'font-size': 19, 'text-anchor': 'middle', 'data-col': 36 }, g).textContent = n;
    // dim veil when the rung is not yet counted (design's rgba(22,18,10,.56))
    el('rect', { x: X + 8, y, width: 56, height: 28, rx: 8, class: 'mk-dim', 'data-col': 8 }, g);
    // gold "active rung" ring (design's 3px #ffe08a + glow)
    el('rect', { x: X + 6, y: y - 2, width: 60, height: 32, rx: 10, class: 'mk-ring', 'data-col': 6 }, g);
    slots[n] = g;
  }
  arrowEl = el('text', { x: X + 36, y: 172, 'font-size': 34, 'text-anchor': 'middle' }, svg);
}

function glowSlot(n) {
  if (curGlow && slots[curGlow]) slots[curGlow].classList.remove('mk-cur');
  curGlow = n;
  if (n && slots[n]) slots[n].classList.add('mk-cur');
}

/* ---------------- character choreography (Flow script, ported) ---------------- */

// Show exactly one pose. content/delight/cheer/eat share the standing base
// (swap arms + expression); swing is its own body.
function setPose(pose) {
  const swing = pose === 'swing';
  poseStanding.style.display = swing ? 'none' : '';
  poseSwing.style.display = swing ? '' : 'none';
  if (!swing) {
    for (const p of ['content', 'delight', 'cheer', 'eat']) {
      if (arms[p]) arms[p].style.display = p === pose ? '' : 'none';
      if (expr[p]) expr[p].style.display = p === pose ? '' : 'none';
    }
  }
}

// mkReactA/B — the monkey's little bounce on each count. ADAPTED: the design's
// translateY(-15px) rides in the container's px box; here it's -15 stage units
// (≈ -12.5 game px) about the monkey's own centre.
function bounce() {
  const name = reactToggle++ % 2 ? 'mkReactA' : 'mkReactB';
  monkeyBounce.style.animation = 'none';
  void monkeyBounce.getBoundingClientRect();
  monkeyBounce.style.transformOrigin = '50% 60%';
  monkeyBounce.style.animation = `${name} .5s ease`;
}

// mkbChompA/B — the eat mouth. Alternates like the design's eatKey%2.
function chomp() {
  const name = chompToggle++ % 2 ? 'mkbChompA' : 'mkbChompB';
  chompEl.style.animation = 'none';
  void chompEl.getBoundingClientRect();
  chompEl.style.animation = `${name} .8s ease-in-out`;
}

function showBanana(n, on, pop = false) {
  const g = bananaEls[n];
  if (!g) return;
  g.style.display = on ? '' : 'none';
  if (on && pop) {
    g.style.animation = 'none';
    void g.getBoundingClientRect();
    g.style.animation = 'mkPopSvg .45s ease'; // ADAPTED mkPop (SVG scale; no HTML translate-50%)
  }
}

// mkEatA/B — a banana flies from the bunch to the monkey's mouth. ADAPTED:
// the design animates HTML left/top; SVG can't, so this is the same arc
// (design offsets/scale/rotate) as a transform on the flying-banana group.
function flyBanana() {
  flyingBanana.style.display = '';
  // Mouth-targeting frames follow the monkey up by MONKEY_LIFT; the start frame
  // is the banana leaving the bunch (unchanged).
  const a = flyingBanana.animate([
    { transform: 'translate(624px,243px) scale(.8)', opacity: 0 },
    { transform: 'translate(624px,243px) scale(.8)', opacity: 1, offset: 0.18 },
    { transform: `translate(852px,${410 - MONKEY_LIFT}px) rotate(20deg) scale(1.05)`, opacity: 1, offset: 0.6 },
    { transform: `translate(876px,${433 - MONKEY_LIFT}px) scale(1)`, opacity: 1, offset: 0.82 },
    { transform: `translate(876px,${433 - MONKEY_LIFT}px) scale(0)`, opacity: 1 },
  ], { duration: 850, easing: 'ease-in' });
  a.finished.catch(() => {}).then(() => { flyingBanana.style.display = 'none'; });
}

export const monkeyTheme = {
  name: 'monkey',
  strings: { finaleBanner: "You're the top banana!" },
  numberColors() { return numColors(); },

  mount(sceneEl) {
    mountAbort?.abort();
    mountAbort = new AbortController();
    sceneEl.replaceChildren();
    svg = el('svg', { viewBox: '0 0 1000 700', preserveAspectRatio: 'xMidYMax slice', 'data-theme': 'monkey' }, null);
    sceneEl.appendChild(svg);
    const fitView = () => {
      const portrait = innerWidth / innerHeight < 0.85;
      svg.setAttribute('viewBox', portrait ? '280 0 660 700' : '0 0 1000 700');
      layoutTower(portrait ? TOWER_X_PORTRAIT : TOWER_X);
    };
    fitView();
    window.addEventListener('resize', fitView, { signal: mountAbort.signal });

    // Fredoka is the game default — no --display-font switch (unlike knight).
    const style = el('style', {}, svg);
    style.textContent = `
      text { font-family: 'Fredoka', ui-rounded, sans-serif; }
      ${KEYFRAMES}
      /* ADAPTED mkPop — HTML translate(-50%,-50%) is meaningless in SVG; the
         wrapper is centred on the hang point, so the pop is scale-only. */
      @keyframes mkPopSvg { 0% { transform: scale(0); } 62% { transform: scale(1.22); } 100% { transform: scale(1); } }
      /* tiki totem rungs */
      .slot .mk-wood { fill: url(#mkWood); stroke: #7f5228; stroke-width: 2; }
      .slot .mk-hi { fill: rgba(255,255,255,.24); pointer-events: none; }
      .slot .mk-peg { fill: #6e4620; opacity: .5; }
      .slot text { fill: #5a3618; font-weight: 700; }
      .slot .mk-dim { fill: rgba(22,18,10,.56); opacity: 1; transition: opacity .3s; pointer-events: none; }
      .slot.lit .mk-dim { opacity: 0; }
      .slot .mk-ring { fill: none; stroke: #ffe08a; stroke-width: 3; opacity: 0; transition: opacity .2s; }
      .slot.mk-cur .mk-ring { opacity: 1; filter: drop-shadow(0 0 6px rgba(255,214,80,.7)); }
    `;

    svg.insertAdjacentHTML('beforeend', STAGE_MARKUP);
    const q = (k) => {
      const node = svg.querySelector(`[data-mk="${k}"]`);
      if (!node) throw new Error(`monkey scene missing handle: ${k}`);
      return node;
    };
    monkeyBounce = q('monkey-bounce');
    poseStanding = q('pose-standing');
    poseSwing = q('pose-swing');
    chompEl = q('chomp');
    flyingBanana = q('flying-banana');
    celebVines = q('celebration-vines');
    vignette = q('vignette');
    vstopIn = q('vstop-in');
    vstopOut = q('vstop-out');
    for (const p of ['content', 'delight', 'cheer', 'eat']) { arms[p] = q(`arms-${p}`); expr[p] = q(`expr-${p}`); }
    for (let n = 1; n <= 10; n++) bananaEls[n] = svg.querySelector(`[data-mk-banana="${n}"]`);
    dayGroups = [q('rays'), q('butterflies')];
    nightGroups = [q('stars'), q('moon'), q('fireflies')];

    // Bananas out in front of the front fronds so the growing count is always
    // clearly visible — the design nests them in the canopy, but gameplay
    // legibility wins here. — Tucker (on-device feedback)
    const stageG = q('stage');
    const bananasG = svg.querySelector('[data-scif="showBananas"]') || q('bananas');
    const cf = q('canopy-front');
    cf.parentNode.insertBefore(bananasG, cf.nextSibling); // just in front of the front fronds

    // Dedicated tile-tray shelf (see MONKEY_LIFT). A flat foreground ground band
    // at the shelf line, drawn over the design's soft mound + the lower foreground
    // plants so the tray sits on a clean surface — only the plant tips peek above
    // it. The monkey (next in z-order) stands on it; the tower (a later sibling)
    // rises from it. Extends past both edges so the portrait crop stays covered.
    const shelf = el('g', { 'data-mk': 'tile-shelf' }, null);
    el('path', { d: 'M-40 588 C 250 580 450 592 640 586 C 880 580 1020 590 1240 584 L1240 780 L-40 780 Z', style: 'fill:var(--ground,#7bb86a)' }, shelf);
    el('path', { d: 'M-40 588 C 250 580 450 592 640 586 C 880 580 1020 590 1240 584', style: 'fill:none;stroke:var(--ground-rim,#96d17e);stroke-width:5;opacity:.7' }, shelf);
    stageG.insertBefore(shelf, monkeyBounce);
    // Raise the monkey onto the shelf so his feet clear the tray.
    svg.querySelector('[data-mk="monkey-char"]').setAttribute('y', String(MONKEY_Y));

    sceneVines = q('vines'); // ambient hanging vines — hidden during the finale
    // Finale swing vine: hangs from OFF-SCREEN top; shown + pendulum-swung at
    // launch so the monkey swings a wide arc from the top of the screen. Behind
    // the monkey so his gripping hand reads in front.
    swingVine = el('path', {
      d: 'M600 -600 L600 285', // anchor off-screen top → monkey grip; launch() redraws it per frame
      style: 'fill:none;stroke:var(--vine,#4f9a4a);stroke-width:11;stroke-linecap:round;display:none',
    }, stageG);
    stageG.insertBefore(swingVine, monkeyBounce);

    buildTower();
    fitView(); // now the tower exists, apply the aspect-dependent x
    applyPalette(variant);

    this.reset();
  },

  unmount() {
    mountAbort?.abort();
    mountAbort = null;
    const root = document.documentElement;
    root.style.removeProperty('--sky-top');
    root.style.removeProperty('--sky-mid');
    root.style.removeProperty('--sky-bottom');
  },

  reset(empty = false) {
    saidNums.clear();
    clearTimeout(eatT1); clearTimeout(eatT2);
    setPose('content');
    monkeyBounce.style.animation = '';
    monkeyBounce.style.transform = '';
    monkeyBounce.removeAttribute('transform'); // clear any leftover finale-swing transform
    monkeyBounce.style.transformOrigin = '50% 60%';
    if (swingVine) { swingVine.style.display = 'none'; swingVine.removeAttribute('transform'); }
    if (sceneVines) sceneVines.style.display = '';
    celebVines.style.display = 'none';
    flyingBanana.style.display = 'none';
    for (let n = 1; n <= 10; n++) {
      showBanana(n, !empty);
      this.light(n, !empty ? true : false);
    }
    // reset() leaves the tower fully lit when !empty (a finished stack) and
    // dark when empty (fresh count) — matching rocket/knight.
    if (empty) for (let n = 1; n <= 10; n++) this.light(n, false);
    glowSlot(0);
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
    // bananas beyond the range never appear (shorter rounds use fewer)
    for (let n = len + 1; n <= 10; n++) showBanana(n, false);
  },

  setDirection(dir) {
    arrowEl.textContent = dir === 'up' ? '⬆️' : dir === 'down' ? '⬇️' : '';
  },

  light(n, on) {
    const g = slots[n];
    if (!g) return;
    g.classList.toggle('lit', on);
    slotText(n);
  },

  markCounted(n) {
    saidNums.add(n);
    this.light(n, true);
    glowSlot(n); // the just-counted rung glows as the active one
  },

  // Count-up: banana n pops into the bunch, the monkey bounces, and past 8 he
  // graduates from content to delight (design: pose n>=8 ? 'delight':'content').
  async loadCrate(n, len = 10, fast = false) {
    showBanana(n, true, true);
    setPose(n >= 8 ? 'delight' : 'content');
    bounce();
    await sleep(fast ? 200 : 500);
  },

  // "A whole bunch! Time to eat." — the design's delight settle beat.
  async boardCrew() {
    setPose('delight');
    bounce();
    await sleep(1000);
  },

  preCountdown(len) {
    saidNums.clear();
    for (let n = 1; n <= 10; n++) this.light(n, n <= len);
    glowSlot(len); // top rung is the active one to eat down from
    this.setDirection('down');
    setPose('content'); // mouth closed, waiting to eat
  },

  // n just got counted → eat it: a banana flies to his mouth, the bunch drains
  // to n-1, rung n unlights. His mouth stays CLOSED and only opens to catch the
  // banana as it lands (~0.6s into the fly), then closes again. — Tucker.
  // Must stay await-free.
  tickCountdown(n, len) {
    saidNums.add(n);
    this.light(n, false);
    showBanana(n, false); // that banana is eaten out of the bunch
    glowSlot(n - 1);      // active rung drops to the next number down
    clearTimeout(eatT1); clearTimeout(eatT2);
    setPose('content');   // closed mouth, tracking the incoming banana
    flyBanana();
    bounce();
    eatT1 = setTimeout(() => { setPose('eat'); chomp(); }, 560); // open + chomp as it lands
    eatT2 = setTimeout(() => setPose('content'), 1020);          // close again
  },

  // The payoff: he grabs a vine and swings (design mkSwingRig), sticks the
  // landing (delight), then a chest-thump cheer with confetti + celebration
  // vines. The shared UI shows "You're the top banana!" as this begins.
  async launch(shakeEls) {
    sceneVines.style.display = 'none'; // dedupe: ambient vines off during the finale
    celebVines.style.display = '';
    shakeEls.forEach((e) => e.classList.add('shake-lg'));

    // He grabs a vine from the TOP of the screen and swings WIDE. The rig
    // (vine + monkey) is a pendulum about an off-screen-top pivot, driven by
    // the SVG transform ATTRIBUTE (rotate about a point) so it stays a rigid
    // arc sweeping ~80% of the width. — Tucker (on-device feedback). PY well
    // above the stage makes the vine long, so a modest angle covers the width.
    setPose('swing');
    monkeyBounce.style.animation = 'none';
    monkeyBounce.style.transform = ''; // the swing drives the transform ATTRIBUTE, not style
    swingVine.style.display = '';
    // Explicit swing (symmetric by construction — rotating the nested-svg
    // monkey shifts its box asymmetrically, so we translate only): centre the
    // monkey (TX), swing horizontally ±W (~80% of the width), and rise slightly
    // at both extremes for the arc. The swing pose carries its own ±7° body
    // sway, so it still reads as a lean. The vine is a line from the fixed
    // off-screen-top anchor to the monkey each frame.
    const TX = -288, TY = -3, AY = -600, W = 470, RISE = 44, dur = 3400;
    await new Promise((resolve) => {
      const t0 = performance.now();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const frame = (now) => {
        if (done) return;
        if (mountAbort?.signal.aborted) return finish();
        const t = Math.min(1, (now - t0) / dur);
        const sp = (1 - t) ** 1.1 * Math.sin(t * Math.PI * 5); // -1..1 wide swing, damping to rest
        const X = W * sp, Y = -RISE * sp * sp;
        monkeyBounce.setAttribute('transform', `translate(${(TX + X).toFixed(1)} ${(TY + Y).toFixed(1)})`);
        const gx = 600 + X, gy = MONKEY_Y + Y; // grip follows the lifted monkey
        swingVine.setAttribute('d', `M600 ${AY} Q${((600 + gx) / 2).toFixed(1)} ${((AY + gy) / 2).toFixed(1)} ${gx.toFixed(1)} ${gy.toFixed(1)}`);
        if (t < 1) requestAnimationFrame(frame); else finish();
      };
      requestAnimationFrame(frame);
      setTimeout(finish, dur + 700); // safety: hidden tabs pause rAF — never hang the round
    });
    // sticks the landing: settle upright at centre, drop the vine
    monkeyBounce.setAttribute('transform', `translate(${TX} ${TY})`);
    swingVine.style.display = 'none';
    shakeEls.forEach((e) => e.classList.remove('shake-lg'));

    setPose('delight');
    await sleep(900);

    // chest-thump cheer + screech + confetti burst over the tree
    setPose('cheer');
    sfx.screech(); // the monkey's win whoop, right on the chest-thump
    const rect = svg.getBoundingClientRect();
    confettiBurst(rect.left + rect.width * 0.5, rect.top + rect.height * 0.42, 90);
    await sleep(1600);
    celebVines.style.display = 'none';
    sceneVines.style.display = '';
  },

  setVariant(i) { applyPalette(i); },
};
