// The rocket theme: SVG launch-pad scene + all vehicle animations.
// A theme owns the scenery and exposes the same handful of hooks the engine
// calls, so new vehicles (plane, pirate ship, dragon...) are one file each.
//
// The rocket art lives in <defs> and is rendered through 10 clipped bands;
// counting up reveals bands bottom-to-top, so the ship assembles from an
// empty pad as the child counts.

import { smoke, confettiBurst, starStreaks } from '../fx.js';

export const NUMBER_COLORS = {
  1: '#ff5a5a', 2: '#ff9438', 3: '#ffc93c', 4: '#7ed957', 5: '#35c99e',
  6: '#3ec5ff', 7: '#4f7bff', 8: '#8f6bff', 9: '#e06bff', 10: '#ff6bb3',
};

const SVG = 'http://www.w3.org/2000/svg';
const BAND_H = 41;            // build band height in scene units
const GROUND_Y = 640;         // rocket base line
let svg, rocket, flame, astro, hatch, arrowEl, padMark, walkerG, walkerText;
const slots = {};
const bands = [];             // band groups, index 0 = bottom band
let revealed = 0;
let masked = false;
let smokeTimer = null;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Animations pause in hidden tabs; never let game logic wait on one forever.
function settled(anim, maxMs) {
  return Promise.race([
    anim.finished.catch(() => {}),
    new Promise(r => setTimeout(r, maxMs)),
  ]);
}

function gradient(defs, id, x2, y2, stops) {
  const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs);
  for (const [offset, color] of stops) el('stop', { offset, 'stop-color': color }, g);
}

// Scene coords → screen pixels (for the particle canvas).
function toScreen(x, y) {
  const m = svg.getScreenCTM();
  if (!m) return { x: innerWidth / 2, y: innerHeight / 2 };
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

function slotText(n) {
  const g = slots[n];
  g.querySelector('text').textContent =
    (masked && !g.classList.contains('lit')) ? '•' : n;
}

export const rocketTheme = {
  name: 'rocket',

  mount(sceneEl) {
    sceneEl.replaceChildren();
    svg = el('svg', { viewBox: '0 0 1000 700', preserveAspectRatio: 'xMidYMax slice' }, null);
    sceneEl.appendChild(svg);
    // On narrow portrait screens, crop the scene toward the rocket so the
    // star of the show never falls off the edge.
    const fitView = () => {
      svg.setAttribute('viewBox', innerWidth / innerHeight < 0.72 ? '280 0 660 700' : '0 0 1000 700');
    };
    fitView();
    window.addEventListener('resize', fitView);

    const defs = el('defs', {}, svg);
    gradient(defs, 'bodyGrad', 1, 0, [[0, '#ffffff'], [0.55, '#eef1fb'], [1, '#c3c9e6']]);
    gradient(defs, 'flameGrad', 0, 1, [[0, '#ffdf6b'], [0.5, '#ff9438'], [1, '#ff5a3c']]);

    const style = el('style', {}, svg);
    style.textContent = `
      text { font-family: 'Fredoka', ui-rounded, sans-serif; }
      .twinkle { animation: tw 2.6s ease-in-out infinite; }
      @keyframes tw { 50% { opacity: .25; } }
      .slot rect { fill: #262b58; stroke: rgba(255,255,255,.09); stroke-width: 2; transition: fill .25s; }
      .slot text { fill: #7d84bd; font-weight: 600; transition: fill .25s; }
      .slot.lit text { fill: #fff; }
      #walkerText.walking { animation: bob .28s ease-in-out infinite alternate; }
      @keyframes bob { to { transform: translateY(-7px); } }
      #flame { transform-origin: 690px 636px; }
      #flame.on { animation: flick .09s linear infinite alternate; }
      @keyframes flick { from { transform: scaleY(1) scaleX(1); } to { transform: scaleY(1.25) scaleX(.88); } }
      #rocket.rumbling { animation: rshake .12s linear infinite; }
      @keyframes rshake {
        0%,100% { transform: translate(0,0); }
        25% { transform: translate(var(--amp,1px), calc(var(--amp,1px) * -0.7)); }
        50% { transform: translate(calc(var(--amp,1px) * -1), var(--amp,1px)); }
        75% { transform: translate(var(--amp,1px), var(--amp,1px)); }
      }
    `;

    // stars, moon, planet
    for (let i = 0; i < 46; i++) {
      const s = el('circle', {
        cx: Math.round(Math.random() * 1000), cy: Math.round(Math.random() * 420),
        r: (1 + Math.random() * 2.2).toFixed(1), fill: '#fff',
        opacity: (0.5 + Math.random() * 0.5).toFixed(2), class: 'twinkle',
      }, svg);
      s.style.animationDelay = `${(Math.random() * 2.6).toFixed(2)}s`;
    }
    el('circle', { cx: 120, cy: 105, r: 52, fill: '#f4f0dc', opacity: 0.95 }, svg);
    el('circle', { cx: 143, cy: 92, r: 46, fill: '#191d46' }, svg); // crescent cutout
    const planet = el('text', { x: 880, y: 130, 'font-size': 58, 'text-anchor': 'middle' }, svg);
    planet.textContent = '🪐';

    // ground + pad
    el('rect', { x: -50, y: 645, width: 1100, height: 70, fill: '#171040' }, svg);
    el('ellipse', { cx: 220, cy: 662, rx: 60, ry: 9, fill: '#221a52' }, svg);
    el('ellipse', { cx: 900, cy: 676, rx: 80, ry: 11, fill: '#221a52' }, svg);
    el('rect', { x: 560, y: 640, width: 14, height: 24, fill: '#2b2b5e' }, svg);
    el('rect', { x: 806, y: 640, width: 14, height: 24, fill: '#2b2b5e' }, svg);
    el('rect', { x: 545, y: 622, width: 290, height: 20, rx: 8, fill: '#3a3f77' }, svg);
    padMark = el('rect', { x: 685, y: 640, width: 10, height: 4, fill: 'none' }, svg); // smoke emitter marker

    // gantry tower with the 1–10 number board — raised high so the tile
    // tray can never cover it, on any screen shape
    el('rect', { x: 400, y: 185, width: 10, height: 455, fill: '#3a3f77' }, svg);
    el('rect', { x: 462, y: 185, width: 10, height: 455, fill: '#3a3f77' }, svg);
    for (let n = 1; n <= 10; n++) {
      const y = 482 - (n - 1) * 30;
      const g = el('g', { class: 'slot', id: `slot${n}` }, svg);
      el('rect', { x: 408, y, width: 56, height: 28, rx: 8 }, g);
      el('text', { x: 436, y: y + 21, 'font-size': 20, 'text-anchor': 'middle' }, g)
        .textContent = n;
      slots[n] = g;
    }
    arrowEl = el('text', { x: 436, y: 172, 'font-size': 34, 'text-anchor': 'middle' }, svg);

    // the rocket art — defined once, rendered through 10 build bands
    const art = el('g', { id: 'rocketArt' }, defs);
    el('path', { d: 'M632,560 L632,642 L570,672 Z', fill: '#e04848' }, art);      // left fin
    el('path', { d: 'M748,560 L748,642 L810,672 Z', fill: '#e04848' }, art);      // right fin
    el('rect', { x: 630, y: 352, width: 120, height: 262, rx: 24, fill: 'url(#bodyGrad)' }, art); // body
    el('path', { d: 'M655,614 L725,614 L713,638 L667,638 Z', fill: '#6a719e' }, art); // nozzle
    el('rect', { x: 630, y: 572, width: 120, height: 20, fill: '#ff5a5a' }, art);  // stripe
    el('path', { d: 'M630,368 C630,302 660,254 690,232 C720,254 750,302 750,368 Z', fill: '#ff5a5a' }, art); // nose
    el('circle', { cx: 690, cy: 428, r: 36, fill: '#a8e1ff', stroke: '#39406e', 'stroke-width': 9 }, art); // window
    astro = el('text', { x: 690, y: 443, 'font-size': 46, 'text-anchor': 'middle', opacity: 0 }, art);
    astro.textContent = '👨‍🚀';
    hatch = el('circle', { cx: 690, cy: 528, r: 28, fill: '#39406e', stroke: '#dfe4f5', 'stroke-width': 7 }, art);

    rocket = el('g', { id: 'rocket' }, svg);
    flame = el('g', { id: 'flame', opacity: 0 }, rocket);
    el('path', { d: 'M663,636 C663,692 678,716 690,738 C702,716 717,692 717,636 Z', fill: 'url(#flameGrad)' }, flame);
    el('path', { d: 'M676,636 C676,672 684,690 690,702 C696,690 704,672 704,636 Z', fill: '#fff3b8' }, flame);

    bands.length = 0;
    for (let i = 1; i <= 10; i++) {
      const clip = el('clipPath', { id: `band${i}` }, defs);
      // bottom band reaches below GROUND_Y to catch the fin tips
      el('rect', {
        x: 520, y: GROUND_Y - BAND_H * i,
        width: 340, height: i === 1 ? BAND_H + 36 : BAND_H + 0.8,
      }, clip);
      const g = el('g', { 'clip-path': `url(#band${i})` }, rocket);
      el('use', { href: '#rocketArt' }, g);
      bands.push(g);
    }

    // the boarding astronaut
    walkerG = el('g', { opacity: 0 }, svg);
    walkerText = el('text', {
      id: 'walkerText', x: 0, y: 0, 'font-size': 44, 'text-anchor': 'middle',
    }, walkerG);
    walkerText.textContent = '🧑‍🚀';

    this.reset();
  },

  reset(empty = false) {
    rocket.getAnimations().forEach(a => a.cancel());
    rocket.style.transform = '';
    rocket.classList.remove('rumbling');
    rocket.style.removeProperty('--amp');
    flame.setAttribute('opacity', 0);
    flame.classList.remove('on');
    astro.setAttribute('opacity', 0);
    walkerG.setAttribute('opacity', 0);
    walkerG.getAnimations().forEach(a => a.cancel());
    walkerText.classList.remove('walking');
    revealed = empty ? 0 : 10;
    bands.forEach((b, i) => {
      b.getAnimations().forEach(a => a.cancel());
      b.style.transform = '';
      b.style.opacity = i < revealed ? 1 : 0;
    });
    for (let n = 1; n <= 10; n++) this.light(n, false);
    this.setDirection(null);
    this.stopSmoke();
  },

  setMasked(m) {
    masked = m;
    for (let n = 1; n <= 10; n++) slotText(n);
  },

  setDirection(dir) {
    arrowEl.textContent = dir === 'up' ? '⬆️' : dir === 'down' ? '⬇️' : '';
  },

  light(n, on) {
    const g = slots[n];
    if (!g) return;
    g.classList.toggle('lit', on);
    g.querySelector('rect').style.fill = on ? NUMBER_COLORS[n] : '';
    slotText(n); // lit slots always show their number, even in masked mode
  },

  // Count n of len: a numbered crate flies to the top of the stack, then the
  // next chunk(s) of rocket drop into place.
  async loadCrate(n, len = 10) {
    const targetBands = Math.round((10 * n) / len);
    const stackTopY = GROUND_Y - BAND_H * revealed;

    const g = el('g', {}, svg);
    el('rect', { x: -38, y: -38, width: 76, height: 76, rx: 14, fill: NUMBER_COLORS[n], stroke: 'rgba(0,0,0,.25)', 'stroke-width': 4 }, g);
    el('text', { x: 0, y: 16, 'font-size': 46, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 600 }, g)
      .textContent = n;

    const crate = g.animate([
      { transform: `translate(690px, 810px) scale(1) rotate(0deg)`, opacity: 1 },
      { transform: `translate(556px, ${Math.min(stackTopY, 620)}px) scale(0.95) rotate(-12deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(690px, ${stackTopY - 16}px) scale(0.25) rotate(4deg)`, opacity: 0.7 },
    ], { duration: 700, easing: 'cubic-bezier(.45,.1,.5,1)', fill: 'forwards' });
    await settled(crate, 950);
    g.remove();
    this.light(n, true);

    // reveal the new chunk(s)
    for (let i = revealed; i < targetBands; i++) {
      const band = bands[i];
      const drop = band.animate([
        { transform: 'translateY(-64px)', opacity: 0 },
        { transform: 'translateY(6px)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(0)', opacity: 1 },
      ], { duration: 300, easing: 'cubic-bezier(.3,1.2,.5,1)' });
      settled(drop, 450).then(() => {
        band.style.opacity = 1;
        band.style.transform = '';
        drop.cancel();
        const p = toScreen(690, GROUND_Y - BAND_H * i);
        smoke(p.x, p.y, 3);
      });
      await new Promise(r => setTimeout(r, 130));
    }
    revealed = targetBands;
  },

  // The astronaut walks from the gantry to the rocket and climbs aboard.
  async boardCrew() {
    walkerG.setAttribute('opacity', 1);
    walkerText.classList.add('walking');
    const walk = walkerG.animate([
      { transform: 'translate(446px, 662px)' },
      { transform: 'translate(690px, 662px)' },
    ], { duration: 1900, easing: 'linear', fill: 'forwards' });
    await settled(walk, 2200);

    walkerText.classList.remove('walking');
    const climb = walkerG.animate([
      { transform: 'translate(690px, 662px) scale(1)', opacity: 1 },
      { transform: 'translate(690px, 532px) scale(0.4)', opacity: 0 },
    ], { duration: 750, easing: 'ease-in', fill: 'forwards' });
    await settled(climb, 1000);

    walkerG.setAttribute('opacity', 0);
    walkerG.getAnimations().forEach(a => a.cancel());
    try {
      hatch.animate([{ r: '28px' }, { r: '35px' }, { r: '28px' }], { duration: 350 });
    } catch { /* flash is decoration */ }
    astro.setAttribute('opacity', 1);
  },

  preCountdown(len) {
    for (let n = 1; n <= 10; n++) this.light(n, n <= len);
    this.setDirection('down');
    rocket.classList.add('rumbling');
    rocket.style.setProperty('--amp', '0.6px');
  },

  // n just got counted; intensity grows as we approach 1.
  tickCountdown(n, len) {
    this.light(n, false);
    const x = (len - n + 1) / len;
    rocket.style.setProperty('--amp', `${(0.6 + x * 2.6).toFixed(2)}px`);
    if (x > 0.55) {
      flame.setAttribute('opacity', 0.5);
      flame.classList.add('on');
      this.startSmoke(2);
    }
  },

  emitterPoint() {
    const r = padMark.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  },

  startSmoke(rate = 5) {
    this.stopSmoke();
    smokeTimer = setInterval(() => {
      const p = this.emitterPoint();
      smoke(p.x, p.y, rate, rate > 3);
    }, 90);
  },
  stopSmoke() { if (smokeTimer) { clearInterval(smokeTimer); smokeTimer = null; } },

  // The payoff. Resolves once the rocket has left the screen.
  async launch(shakeEls) {
    flame.setAttribute('opacity', 1);
    flame.classList.add('on');
    rocket.style.setProperty('--amp', '3.5px');
    this.startSmoke(7);
    shakeEls.forEach(e => e.classList.add('shake-lg'));

    await new Promise(r => setTimeout(r, 950));

    const p = this.emitterPoint();
    confettiBurst(p.x, innerHeight * 0.45, 80);
    starStreaks(2400);
    rocket.classList.remove('rumbling');
    const anim = rocket.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(-1250px)' },
    ], { duration: 2400, easing: 'cubic-bezier(.55,0,.85,.36)' });

    await settled(anim, 2800);
    // Park it off-screen explicitly — WAAPI fill state is not reliable across
    // rounds (replaced animations get dropped). reset() clears this.
    rocket.style.transform = 'translateY(-1250px)';
    anim.cancel();
    shakeEls.forEach(e => e.classList.remove('shake-lg'));
    this.stopSmoke();
    await new Promise(r => setTimeout(r, 500));
  },
};
