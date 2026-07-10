// Sequence tasks. Today: numbers 1–10, up and down. The engine only sees
// generic "steps with choices", so letters/shapes/etc. can slot in later.

import { store } from './store.js';

export function makeSequence(dir, len) {
  const seq = [];
  if (dir === 'up') for (let i = 1; i <= len; i++) seq.push(i);
  else for (let i = len; i >= 1; i--) seq.push(i);
  return seq;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampN(n) { return Math.min(10, Math.max(1, n)); }

function pickDistractor(target, prev, kind) {
  const cands = [];
  for (let d = 1; d <= 10; d++) {
    if (d === target) continue;
    const dist = Math.abs(d - target);
    if (kind === 'near' ? (dist <= 2) : (dist >= 3)) cands.push(d);
  }
  // The just-said number is a *great* near distractor (it's the exact
  // repeat/reverse error), so leave it in. Fall back to anything if needed.
  if (!cands.length) return clampN(target + 3);
  return cands[Math.floor(Math.random() * cands.length)];
}

// One step of a round: which tiles to show for "what comes next".
// level: 1 solo · 2 +far · 3 +near · 4 three tiles
export function makeStep({ dir, target, prev, level }) {
  // Adaptive: if this exact transition has a history of trouble, make sure
  // the tempting wrong answer is present so he practices resisting it.
  const errRate = prev != null ? store.transitionErrorRate(dir, prev, target) : null;
  const weak = errRate !== null && errRate >= 0.34;

  let choices;
  if (level <= 1) {
    choices = [target];
  } else if (level === 2) {
    choices = [target, pickDistractor(target, prev, weak ? 'near' : 'far')];
  } else if (level === 3) {
    choices = [target, pickDistractor(target, prev, 'near')];
  } else {
    const near = pickDistractor(target, prev, 'near');
    let far = pickDistractor(target, prev, 'far');
    while (far === near) far = pickDistractor(target, prev, 'far');
    choices = [target, near, far];
  }
  shuffle(choices);
  return { choices, correctIndex: choices.indexOf(target) };
}
