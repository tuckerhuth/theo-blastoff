// Input: touch/mouse taps + mash-tolerant keyboard.
//
// Policy: the keyboard can never do anything destructive — every key is
// swallowed. When "keyboard zones" is on, the physical keyboard is split into
// vertical bands that map to the on-screen tiles, so mashing plays the game.

import { store } from './store.js';

const DEBOUNCE_MS = 260;
let lastTap = 0;

// The currently answerable step. null when the game is busy animating.
let active = null; // { elements: [..], onPick(i), allowAnywhere }

export function setTargets(elements, onPick, { allowAnywhere = false } = {}) {
  active = { elements, onPick, allowAnywhere };
}
export function clearTargets() { active = null; }

function debounced() {
  const now = Date.now();
  if (now - lastTap < DEBOUNCE_MS) return true;
  lastTap = now;
  return false;
}

function pick(i) {
  if (!active) return;
  if (debounced()) return;
  const a = active;
  a.onPick(i);
}

/* ------- physical keyboard → horizontal position 0..1 ------- */

const KEY_ROWS = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'];
const KEY_POS = {};
for (const row of KEY_ROWS) {
  for (let i = 0; i < row.length; i++) KEY_POS[row[i]] = i / (row.length - 1);
}

function keyZone(e, nTargets) {
  const k = (e.key || '').toLowerCase();
  if (k === ' ') return Math.floor(nTargets / 2);
  if (k === 'arrowleft') return 0;
  if (k === 'arrowright') return nTargets - 1;
  const pos = KEY_POS[k];
  if (pos === undefined) return null;
  return Math.min(nTargets - 1, Math.floor(pos * nTargets));
}

export function initInput(app) {
  // --- swallow everything a toddler can mash ---
  window.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.repeat || !active) return;
    if (!store.data.settings.keyboardZones) return;
    const n = active.elements.length;
    if (n === 1 || active.allowAnywhere) { pick(0); return; }
    const z = keyZone(e, n);
    if (z !== null) pick(z);
  }, { capture: true });
  window.addEventListener('keyup', (e) => e.preventDefault(), { capture: true });

  // Block iOS pinch zoom / double-tap zoom / scroll / long-press menus
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(ev, (e) => e.preventDefault());
  }
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Focus/scrollIntoView can still scroll overflow:hidden containers.
  // Snap anything that isn't the parent panel straight back.
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t instanceof Element && !t.closest('.parent-inner')) { t.scrollTop = 0; t.scrollLeft = 0; }
    else if (!(t instanceof Element)) window.scrollTo(0, 0);
  }, { capture: true, passive: true });
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

  // --- taps ---
  // Tiles call pick() via their own listeners (wired in ui.js through tapHandler).
  // "Tap anywhere" support: a tap on open space counts when there's one target.
  app.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return; // first finger wins; ignore multi-touch chaos
    if (!active || !active.allowAnywhere) return;
    if (e.target.closest('.tile, .overlay, #parentZone, button')) return;
    pick(0);
  });
}

// Used by ui.js to wire each tile button.
export function tileTapHandler(index) {
  return (e) => {
    if (e && !e.isPrimary) return;
    pick(index);
  };
}
