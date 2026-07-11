// The knight & dragon theme: a besieged countryside where counting up arms
// a knight piece-by-piece while the dragon strafes the burning shires, and
// counting down lands a sword strike per number until the final blow.
//
// The scene art is a VERBATIM port of the Claude Design spec (project
// eef274a5-697b-4bc4-a885-8a5b6ea5ce39, KnightDragonScene.dc.html): all
// path data, keyframes, transforms and choreography timings come from the
// design via tools/port-knight-scene.mjs → knight-scene.js — the design is
// the spec, never re-draw (the v23 lesson). The only adaptations, each
// marked ADAPTED below: the game's 1000×700 viewBox (one wrapper transform
// in the generated markup), the battle-hover/spark position (the design
// parks the dragon by its far-left meter; the game's tower is center-locked
// by the test contract), the dmg curve's round length, and the tower/rail/
// arrow geometry itself — copied verbatim from rocket.js so every theme
// shares the exact "meter" contract the tests assert.

import { confettiBurst } from '../fx.js';
import { KEYFRAMES, STAGE_MARKUP } from './knight-scene.js';

const SVG = 'http://www.w3.org/2000/svg';
const GROUND_Y = 560; // same convention as rocket — tile tray sits below this

// Three color worlds across a mission's 3 launches (day → dusk → night):
// setVariant(sessionStars) → 0 meadow, 1 ember, 2 twilight. `vars` are the
// design's themeFor() palettes VERBATIM (scene-scoped custom properties on
// the svg root); `sky` drives the page-level gradient (top/bottom from the
// design, mid = their midpoint); `numColors` is this theme's per-number
// rainbow for tiles + lit tower slots (game data, not design art).
const PALETTES = [
  { // 0: meadow — bright daytime pastels
    sky: { top: '#bfe6ff', mid: '#dfe8f9', bottom: '#ffeaf3' },
    vars: {
      '--sky-top': '#bfe6ff', '--sky-bottom': '#ffeaf3', '--celest': '#fff2b0', '--particle': '#ffffff',
      '--hill-far': '#c6e8c8', '--hill-mid': '#a2dba6', '--hill-near': '#7ecb82', '--hill-front': '#5cad68', '--tree': '#4fa35f',
      '--house': '#f2e8da', '--house-2': '#e3d6c2', '--roof': '#d98f5c', '--roof-2': '#b06e3e',
      '--castle': '#c3aee6', '--castle-2': '#ad95da', '--flag': '#ff8ac0', '--window-lit': '#ffe38a', '--smoke': 'rgba(104,96,116,.74)',
      '--fire-1': '#ff8a2c', '--fire-2': '#ffd23f', '--horizon': '#4c9c5a', '--horizon-edge': 'rgba(255,255,255,.28)', '--tray': '#57ad67', '--tray-edge': 'rgba(255,255,255,.42)',
      '--k-cloth': '#d98fc4', '--k-cloth-2': '#c46fae', '--k-cape': '#ff9ec7', '--k-skin': '#f6cda8', '--k-ink': '#3a2a3f', '--k-cheek': '#ff9ec7', '--k-metal': '#eaf0fb', '--k-metal-2': '#aebbd6', '--k-trim': '#f0c07a', '--k-plume': '#d86fb0', '--k-shield': '#6f8fe0', '--k-shield-2': '#4f6fc4', '--k-gem': '#ff6fae', '--k-gem-2': '#8fd0ff',
      '--d-body': '#7ed36f', '--d-body-2': '#5cb457', '--d-wing': '#a7e59a', '--d-wing-2': '#6fc266', '--d-belly': '#f4f1c9', '--d-horn': '#f0e6a8', '--d-eye': '#2e7d32',
      '--num': '#ffffff', '--num-glow': 'rgba(255,140,190,.9)', '--hud-bg': '#b07fd0', '--hud-text': '#5a3f78', '--hud-border': 'rgba(255,255,255,.7)', '--banner': '#ff6aa6', '--banner-sub': '#a05fd0', '--star-on': '#ffcf5c', '--star-off': 'rgba(150,110,170,.45)',
      '--card-a': '#8ad9b0', '--card-b': '#7cc6f0', '--card-c': '#ff9fc0',
      '--stone-top': '#b3a894', '--stone-bot': '#8f836c', '--stone-ftop': '#d9c2ee', '--stone-fbot': '#b493dd', '--stone-edge': 'rgba(0,0,0,.2)', '--rune': '#ffffff', '--stone-glow': '#ff7ab0',
    },
    numColors: { 1: '#ff6f9d', 2: '#ff9438', 3: '#ffcf5c', 4: '#6fcf6f', 5: '#4fd9b0', 6: '#5cc9f0', 7: '#6f8fe0', 8: '#b07fd0', 9: '#d86fb0', 10: '#ff9ec7' },
  },
  { // 1: ember — warm dramatic dusk
    sky: { top: '#2b1830', mid: '#89513d', bottom: '#e88a4a' },
    vars: {
      '--sky-top': '#2b1830', '--sky-bottom': '#e88a4a', '--celest': '#ffd27a', '--particle': '#ffb066',
      '--hill-far': '#7a4238', '--hill-mid': '#5a2e2c', '--hill-near': '#3f1e20', '--hill-front': '#2a1218', '--tree': '#24100f',
      '--house': '#5a3a34', '--house-2': '#472a26', '--roof': '#7a4a30', '--roof-2': '#5a3220',
      '--castle': '#4a2a2e', '--castle-2': '#351b20', '--flag': '#ffb04a', '--window-lit': '#ffdd6a', '--smoke': 'rgba(74,58,58,.74)',
      '--fire-1': '#ff6a2c', '--fire-2': '#ffe14d', '--horizon': '#1e0d12', '--horizon-edge': 'rgba(255,180,120,.22)', '--tray': '#170a0f', '--tray-edge': 'rgba(255,180,120,.34)',
      '--k-cloth': '#7a352c', '--k-cloth-2': '#5a231a', '--k-cape': '#c8452e', '--k-skin': '#e0a878', '--k-ink': '#2a1510', '--k-cheek': '#ff8a6a', '--k-metal': '#f0dcb4', '--k-metal-2': '#bd924e', '--k-trim': '#ffd76a', '--k-plume': '#ff8a3c', '--k-shield': '#c85a3a', '--k-shield-2': '#9c3a24', '--k-gem': '#ffd76a', '--k-gem-2': '#ff8a4a',
      '--d-body': '#e0472e', '--d-body-2': '#a52a1c', '--d-wing': '#ff7a4d', '--d-wing-2': '#a5321c', '--d-belly': '#ffd9a0', '--d-horn': '#2a1512', '--d-eye': '#ffe14d',
      '--num': '#fff0d6', '--num-glow': 'rgba(255,140,60,.95)', '--hud-bg': '#a5432e', '--hud-text': '#ffe6cc', '--hud-border': 'rgba(255,220,180,.5)', '--banner': '#ffd76a', '--banner-sub': '#ffcf9a', '--star-on': '#ffd76a', '--star-off': 'rgba(255,220,180,.35)',
      '--card-a': '#ff8a3c', '--card-b': '#ffc94d', '--card-c': '#ff5a3c',
      '--stone-top': '#4a3a34', '--stone-bot': '#2f231d', '--stone-ftop': '#d07048', '--stone-fbot': '#a5432a', '--stone-edge': 'rgba(0,0,0,.4)', '--rune': '#ffe6cc', '--stone-glow': '#ffd76a',
    },
    numColors: { 1: '#ff5a3c', 2: '#ff6a2c', 3: '#ff8a3c', 4: '#ffc94d', 5: '#ffd76a', 6: '#c85a3a', 7: '#9c3a24', 8: '#bd924e', 9: '#ffd9a0', 10: '#ffe14d' },
  },
  { // 2: twilight — deep night, closest to the rocket build's palette
    sky: { top: '#241a4a', mid: '#372461', bottom: '#4a2f78' },
    vars: {
      '--sky-top': '#241a4a', '--sky-bottom': '#4a2f78', '--celest': '#f4ecc9', '--particle': '#ffffff',
      '--hill-far': '#332968', '--hill-mid': '#281e5c', '--hill-near': '#1d1548', '--hill-front': '#140f38', '--tree': '#150f34',
      '--house': '#3a3568', '--house-2': '#2b2652', '--roof': '#4a3f78', '--roof-2': '#33285a',
      '--castle': '#2b2668', '--castle-2': '#201a50', '--flag': '#ff6f9d', '--window-lit': '#ffd76a', '--smoke': 'rgba(160,150,190,.62)',
      '--fire-1': '#ff8a2c', '--fire-2': '#ffe14d', '--horizon': '#100b2e', '--horizon-edge': 'rgba(255,255,255,.12)', '--tray': '#0d0924', '--tray-edge': 'rgba(150,140,205,.34)',
      '--k-cloth': '#3a4f8f', '--k-cloth-2': '#2d3f74', '--k-cape': '#6f4fb0', '--k-skin': '#e8b892', '--k-ink': '#201830', '--k-cheek': '#ff9db0', '--k-metal': '#dbe2f2', '--k-metal-2': '#8f9ec4', '--k-trim': '#ffd06a', '--k-plume': '#ff6f7d', '--k-shield': '#5c78d6', '--k-shield-2': '#3f56b0', '--k-gem': '#ff6f9d', '--k-gem-2': '#57c1e8',
      '--d-body': '#a24fd4', '--d-body-2': '#7a34ab', '--d-wing': '#c47ae8', '--d-wing-2': '#7d3bb0', '--d-belly': '#efe0ff', '--d-horn': '#f0d48a', '--d-eye': '#ffd23f',
      '--num': '#ffffff', '--num-glow': 'rgba(150,110,255,.95)', '--hud-bg': '#4a5fa0', '--hud-text': '#eaf0ff', '--hud-border': 'rgba(255,255,255,.5)', '--banner': '#ffd06a', '--banner-sub': '#ffe6a8', '--star-on': '#ffd06a', '--star-off': 'rgba(255,255,255,.35)',
      '--card-a': '#57c98e', '--card-b': '#57c1e8', '--card-c': '#ff7ab0',
      '--stone-top': '#3a3560', '--stone-bot': '#26224a', '--stone-ftop': '#6a7fce', '--stone-fbot': '#4155a0', '--stone-edge': 'rgba(0,0,0,.35)', '--rune': '#ffffff', '--stone-glow': '#ffd06a',
    },
    numColors: { 1: '#ff6f9d', 2: '#ffd06a', 3: '#ffe6a8', 4: '#57c98e', 5: '#57c1e8', 6: '#5c78d6', 7: '#3f56b0', 8: '#7a34ab', 9: '#c47ae8', 10: '#ff7ab0' },
  },
];

// Dragon transforms, in the dragon's own 540×360 nested viewport (wrapper
// origin = viewport center, matching the design's div semantics).
// Ambient flight + death fall are the design's values VERBATIM.
// ADAPTED — battle hover: the design's translate(80px,224px) parks the
// dragon beside its far-left meter; the game's tower is center-locked at
// x 400–472 (test contract), so the hover sits between tower and knight
// (dragon center ≈ stage 640,380 — inside the portrait crop, sword-range
// from the knight, fly-height above the tray). Pose/flip/speed verbatim.
const AMBIENT_HOME = 'translate(-800px,14px) scale(0.4)';
const BATTLE_TRANSFORM = 'translate(140px,184px) scale(-0.75,0.75)';
const DEAD_TRANSFORM = 'translate(90px,560px) scale(0.85) rotate(-55deg)';

let svg;
let dragonOuter, dragonRoam, dragonWince, dragonTint, painEye, deadEye, fireBreath;
let swordJab, sparkEl;
let arrowEl, railL, railR;
const slots = {};
const armor = {}; // 1..10 -> <g data-kd="armorN">
let masked = false;
const saidNums = new Set();
let dmg = 0;
let variant = 2; // index into PALETTES; twilight until setVariant runs
let dragonMode = 'ambient';
let fireT = null;
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

// Tower x — Tucker (July 11): in landscape the column moves far left, clear
// of the burning shires and the dragon-vs-knight battle sightline. Portrait
// keeps rocket's centered x: the portrait crop window starts at x=280, so a
// far-left tower would fall outside it on the iPad (the primary device).
const TOWER_X = 150;
const TOWER_X_PORTRAIT = 400;

function layoutTower(x) {
  if (!railL) return; // fitView can run before the tower exists
  railL.setAttribute('x', x);
  railR.setAttribute('x', x + 62);
  for (let n = 1; n <= 10; n++) {
    slots[n].querySelector('rect').setAttribute('x', x + 8);
    slots[n].querySelector('text').setAttribute('x', x + 36);
  }
  arrowEl.setAttribute('x', x + 36);
}

function buildTower() {
  // Slot/rail/arrow geometry verbatim from rocket.js (the tests assert this
  // shape); only the x offset is themed — see layoutTower. Drawn AFTER the
  // stage markup so ambient fly-bys pass BEHIND the slots (the design keeps
  // its meter above the dragon too).
  railL = el('rect', { x: 400, y: 185, width: 10, height: 375, style: 'fill:var(--castle-2)' }, svg);
  railR = el('rect', { x: 462, y: 185, width: 10, height: 375, style: 'fill:var(--castle-2)' }, svg);
  for (let n = 1; n <= 10; n++) {
    const y = 482 - (n - 1) * 30;
    const g = el('g', { class: 'slot', id: `slot${n}` }, svg);
    el('rect', { x: 408, y, width: 56, height: 28, rx: 8 }, g);
    el('text', { x: 436, y: y + 21, 'font-size': 20, 'text-anchor': 'middle' }, g).textContent = n;
    slots[n] = g;
  }
  arrowEl = el('text', { x: 436, y: 172, 'font-size': 34, 'text-anchor': 'middle' }, svg);
}

/* ---------------- dragon choreography (design script, ported) ---------------- */

function setDragonMode(mode) {
  dragonMode = mode;
  if (mode === 'battle') {
    // 'turn' phase: sweep from wherever the flight left it into the hover,
    // facing the knight (the single scaleX flip lives in the -0.75).
    dragonRoam.style.transform = 'scaleX(1)';
    dragonOuter.style.transition = 'transform .9s ease, opacity .4s ease';
    dragonOuter.style.opacity = 1;
    dragonOuter.style.transform = BATTLE_TRANSFORM;
  } else if (mode === 'dead') {
    dragonOuter.style.transition = 'transform 1.2s ease-in, opacity 1s ease-in .1s';
    dragonOuter.style.opacity = 0;
    dragonOuter.style.transform = DEAD_TRANSFORM;
  } else { // ambient — snap offstage-left; the flight loop takes it from here
    dragonRoam.style.transform = 'scaleX(-1)';
    dragonOuter.style.transition = 'none';
    dragonOuter.style.opacity = 1;
    dragonOuter.style.transform = AMBIENT_HOME;
    // Commit the snap NOW. In a throttled/backgrounded tab no style recalc
    // may run between this write and the flight loop's next glide (which
    // restores a 4.2s transition) — without a forced flush the browser
    // batches both and the dead dragon visibly glides back to life across
    // the sky instead of reappearing offstage.
    void dragonOuter.getBoundingClientRect();
  }
}

// The design's flightLoop VERBATIM: one-way straight passes — glide right at
// altitude 14 over 4.2s, flip via scaleX (the dragon never flies backwards),
// glide back lower at 56. One setTimeout per leg — no rAF, the fx loop stays
// asleep on an idle title screen. (In a throttled/occluded tab the timers
// stretch; the CSS transition still runs 4.2s — cosmetic only.)
async function flightLoop(signal) {
  const sleep = (ms) => new Promise((res) => {
    const t = setTimeout(done, ms);
    function done() { signal.removeEventListener('abort', onAbort); res(); }
    function onAbort() { clearTimeout(t); res(); }
    signal.addEventListener('abort', onAbort, { once: true });
  });
  const glide = (x, y) => {
    dragonOuter.style.transition = 'transform 4.2s linear';
    dragonOuter.style.transform = `translate(${x}px,${y}px) scale(0.4)`;
  };
  while (!signal.aborted) {
    if (dragonMode !== 'ambient') { await sleep(250); continue; }
    dragonRoam.style.transform = 'scaleX(-1)'; // flyDir 1: face right
    await sleep(40); if (signal.aborted) return;
    if (dragonMode !== 'ambient') continue;
    glide(850, 14);
    await sleep(4200); if (signal.aborted) return;
    if (dragonMode !== 'ambient') continue;
    dragonRoam.style.transform = 'scaleX(1)'; // flyDir -1: face left
    await sleep(40); if (signal.aborted) return;
    if (dragonMode !== 'ambient') continue;
    glide(-800, 56);
    await sleep(4200);
  }
}

// fire(): the breath washes over the shires for 1s (design timing).
function fire() {
  fireBreath.style.opacity = 1;
  clearTimeout(fireT);
  fireT = setTimeout(() => { fireBreath.style.opacity = 0; }, 1000);
}

function setWince(on, hard = false) {
  dragonWince.style.transform = on
    ? `translate(${hard ? -26 : -20}px,${hard ? -40 : -34}px) rotate(${hard ? -12 : -10}deg) scale(1.05,0.9)`
    : 'translate(0,0) rotate(0deg) scale(1,1)';
  painEye.style.opacity = on ? 1 : 0;
}

function setSpark(op, scale) {
  sparkEl.style.opacity = op;
  sparkEl.style.transform = `scale(${scale})`;
}

function jabSword(deg) {
  swordJab.style.transform = `rotate(${deg}deg)`;
}

function setArmor(n, on) {
  const g = armor[n];
  g.style.opacity = on ? 1 : 0;
  // the sword (9) fades in place — no translateY settle, per the design
  if (n !== 9) g.style.transform = on ? 'translateY(0)' : 'translateY(14px)';
}

function tintDragon() {
  // damage is a CSS filter on the whole dragon (design formula verbatim)
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
      const portrait = innerWidth / innerHeight < 0.85;
      svg.setAttribute('viewBox', portrait ? '280 0 660 700' : '0 0 1000 700');
      layoutTower(portrait ? TOWER_X_PORTRAIT : TOWER_X);
    };
    fitView();
    window.addEventListener('resize', fitView, { signal: mountAbort.signal });

    const style = el('style', {}, svg);
    style.textContent = `
      text { font-family: 'Fredoka', ui-rounded, sans-serif; }
      ${KEYFRAMES}
      .slot rect { fill: var(--stone-top); stroke: var(--stone-edge); stroke-width: 2; transition: fill .25s; }
      .slot text { fill: rgba(255,255,255,.55); font-weight: 600; transition: fill .25s; }
      .slot.lit text { fill: var(--rune); }
    `;

    // The whole world, verbatim from the design (see knight-scene.js).
    svg.insertAdjacentHTML('beforeend', STAGE_MARKUP);
    const q = (k) => {
      const node = svg.querySelector(`[data-kd="${k}"]`);
      if (!node) throw new Error(`knight scene missing handle: ${k}`);
      return node;
    };
    dragonOuter = q('dragonOuter'); dragonRoam = q('dragonRoam'); dragonWince = q('dragonWince');
    dragonTint = q('dragonTint'); painEye = q('painEye'); deadEye = q('deadEye'); fireBreath = q('fireBreath');
    swordJab = q('swordJab'); sparkEl = q('spark');
    for (let n = 1; n <= 10; n++) armor[n] = q(`armor${n}`);

    buildTower();
    fitView(); // now that the tower exists, apply the aspect-dependent x
    applyPalette(variant);
    flightLoop(mountAbort.signal);

    this.reset();
  },

  unmount() {
    mountAbort?.abort(); // stops the flight loop + resize listener
    mountAbort = null;
    clearTimeout(fireT);
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
    setWince(false);
    setSpark(0, 0.4);
    jabSword(0);
    setDragonMode('ambient'); // snaps offstage; the flight loop resumes passes
    for (let n = 1; n <= 10; n++) {
      setArmor(n, !empty);
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

  // Count-up: armor piece n settles into place (design opacity+translateY
  // cue) while the dragon torches the countryside mid-flight.
  async loadCrate(n, len = 10, fast = false) {
    if (armor[n]) setArmor(n, true);
    fire();
    await new Promise((r) => setTimeout(r, fast ? 200 : 500));
  },

  // "Draw your sword!" — force-reveal sword+shield if the range left them
  // hidden, then the dragon sweeps into the battle hover facing the knight.
  async boardCrew() {
    setArmor(9, true);
    setArmor(10, true);
    setDragonMode('battle');
    await new Promise((r) => setTimeout(r, 2000)); // let the .9s sweep settle before questions start
  },

  preCountdown(len) {
    saidNums.clear();
    for (let n = 1; n <= 10; n++) this.light(n, n <= len);
    this.setDirection('down');
    setDragonMode('battle');
  },

  // n just got counted → strike(n), design timings verbatim: the sword
  // ROTATES 92° to swing (never translates), the dragon winces with the
  // pain face, the spark flashes, and the damage tint deepens toward 1.
  // ADAPTED: dmg curve uses the round's actual length (design hardcodes 10;
  // a full 10-round is identical). Must stay await-free.
  tickCountdown(n, len) {
    saidNums.add(n);
    this.light(n, false);
    jabSword(92);
    setTimeout(() => jabSword(0), 250);
    setTimeout(() => {
      dmg = Math.min(0.78, ((len - n) / len) * 0.85);
      tintDragon();
      setWince(true);
      setSpark(1, 1.25);
      setTimeout(() => setWince(false), 260);
      setTimeout(() => setSpark(0, 0.4), 210);
    }, 160);
  },

  // The final blow — the design's slay sequence, then the fall from the sky.
  async launch(shakeEls) {
    shakeEls.forEach((e) => e.classList.add('shake-lg'));
    jabSword(92);
    setTimeout(() => jabSword(0), 330);
    setWince(true, true);
    await new Promise((r) => setTimeout(r, 240));

    dmg = 1;
    tintDragon();
    setSpark(1, 1.95);
    setTimeout(() => { sparkEl.style.opacity = 0; }, 300);
    await new Promise((r) => setTimeout(r, 450));

    deadEye.style.opacity = 1;
    setWince(false);
    setDragonMode('dead'); // translate/rotate fall + fade, design verbatim

    const rect = svg.getBoundingClientRect();
    confettiBurst(rect.left + rect.width * 0.66, rect.top + rect.height * 0.42, 80);

    await new Promise((r) => setTimeout(r, 1300));
    shakeEls.forEach((e) => e.classList.remove('shake-lg'));
    await new Promise((r) => setTimeout(r, 500));
  },

  setVariant(i) { applyPalette(i); },
};
