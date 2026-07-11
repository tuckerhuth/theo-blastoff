// Sequence tasks. Today: numbers 1–10, up and down. The engine only sees
// generic "steps with choices", so letters/shapes/etc. can slot in later.
//
// Level semantics (solo tiles are tutorial-only; every real choice is 3 tiles
// so lazy "tap until it's right" is never a 50/50 coin flip):
//   0  [target]                      tutorial / countdown anchor
//   1  [target, far, far]            two clearly-distant decoys — easiest
//   2  [target, near, far]           one tempting near, one far
//   3  [target, near, near]          two tempting near decoys
//   4  [target, near, near]          full discrimination

import { store } from './store.js';

export function makeSequence(dir, len) {
  const seq = [];
  if (dir === 'up') for (let i = 1; i <= len; i++) seq.push(i);
  else for (let i = len; i >= 1; i--) seq.push(i);
  return seq;
}

export function shuffle(a) {
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
    choices = [target];                         // tutorial / countdown anchor
  } else if (level === 1) {
    // easiest real step: 3 tiles, both decoys far — unless this transition is
    // weak, then slip in the tempting near one he keeps missing.
    const far = pickDistractor(target, 'far');
    const second = weak ? pickDistractor(target, 'near', [far])
                        : pickDistractor(target, 'far', [far]);
    choices = [target, far, second];
  } else if (level === 2) {
    const near = pickDistractor(target, 'near');
    choices = [target, near, pickDistractor(target, 'far', [near])];
  } else {
    // levels 3–4: full discrimination — two tempting near decoys
    const near = pickDistractor(target, 'near');
    choices = [target, near, pickDistractor(target, 'near', [near])];
  }
  shuffle(choices);
  return { choices, correctIndex: choices.indexOf(target) };
}
