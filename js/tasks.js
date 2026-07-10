// Sequence tasks. Today: numbers 1–10, up and down. The engine only sees
// generic "steps with choices", so letters/shapes/etc. can slot in later.
//
// Level semantics (solo tiles are tutorial-only):
//   0  [target]                      tutorial / countdown anchor
//   1  [target, far]                 e.g. 4 vs 9
//   2  [target, near]                e.g. 7 vs 8 — the real confusions
//   3  [target, near, far]
//   4  [target, near, near]          full discrimination

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

function pickDistractor(target, kind, exclude = []) {
  const cands = [];
  for (let d = 1; d <= 10; d++) {
    if (d === target || exclude.includes(d)) continue;
    const dist = Math.abs(d - target);
    if (kind === 'near' ? (dist <= 2) : (dist >= 3)) cands.push(d);
  }
  // The just-said number stays eligible on purpose — it's the exact
  // repeat/reverse error we want him to practice resisting.
  if (!cands.length) {
    for (let d = 1; d <= 10; d++) if (d !== target && !exclude.includes(d)) cands.push(d);
  }
  return cands[Math.floor(Math.random() * cands.length)];
}

// One step of a round: which tiles to show for "what comes next".
export function makeStep({ dir, target, prev, level }) {
  // Adaptive: a transition with a history of trouble always gets the
  // tempting near decoy, whatever the level says.
  const errRate = prev != null ? store.transitionErrorRate(dir, prev, target) : null;
  const weak = errRate !== null && errRate >= 0.34;

  let choices;
  if (level <= 0) {
    choices = [target];
  } else if (level === 1) {
    choices = [target, pickDistractor(target, weak ? 'near' : 'far')];
  } else if (level === 2) {
    choices = [target, pickDistractor(target, 'near')];
  } else if (level === 3) {
    const near = pickDistractor(target, 'near');
    choices = [target, near, pickDistractor(target, 'far', [near])];
  } else {
    const near = pickDistractor(target, 'near');
    choices = [target, near, pickDistractor(target, 'near', [near])];
  }
  shuffle(choices);
  return { choices, correctIndex: choices.indexOf(target) };
}
