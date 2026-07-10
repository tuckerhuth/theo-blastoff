// The difficulty ladder, per direction. Solo tiles exist only in the
// tutorial — real levels always offer a choice; the errorless escalation
// (wiggle → pulse → glow) is the safety floor, not easier questions.
//
//   L1  two tiles, far decoy        (4 vs 9)
//   L2  two tiles, near decoy       (7 vs 8 — the real confusions)
//   L3  three tiles (near + far); tower numbers mask after the first
//       round at each new counting range
//   L4  three tiles, all near; tower masked
//
// One clean round promotes and stretches the range by 2. A rough round
// (<50% first-try) steps back down. New counting territory always gets one
// scaffolded round with the tower numbers visible.

import { store } from './store.js';

export const MAX_LEVEL = 4;
export const MIN_LEVEL = 1;
export const MAX_LEN = 10;
export const MIN_LEN = 3;

function fields(dir) {
  return dir === 'up'
    ? { level: 'levelUp', len: 'seqLenUp', rounds: 'roundsAtLenUp' }
    : { level: 'levelDown', len: 'seqLenDown', rounds: 'roundsAtLenDown' };
}

export function roundPlan(dir) {
  const d = store.data;
  const f = fields(dir);
  const level = d[f.level];
  const firstAtLen = (d[f.rounds] || 0) === 0;
  const masked = d.settings.forceMask || (level >= 3 && !firstAtLen);
  return { level, len: d[f.len], masked };
}

// stats: { steps, firstTry } for the phase just finished.
export function afterPhase(dir, stats) {
  const d = store.data;
  const f = fields(dir);
  const acc = stats.steps ? stats.firstTry / stats.steps : 1;

  d[f.rounds] = (d[f.rounds] || 0) + 1;

  if (acc >= 0.99) {
    if (d[f.level] < MAX_LEVEL) d[f.level]++;
    if (d[f.len] < MAX_LEN) {
      d[f.len] = Math.min(MAX_LEN, d[f.len] + 2);
      d[f.rounds] = 0; // new territory → next round shows the tower numbers
    }
  } else if (acc < 0.5) {
    if (d[f.level] > MIN_LEVEL) d[f.level]--;
    else if (d[f.len] > 5) { d[f.len]--; d[f.rounds] = 0; }
  }
  store.save();
}

// Parent panel steppers.
export function nudge(dir, what, delta) {
  const d = store.data;
  const f = fields(dir);
  if (what === 'level') {
    d[f.level] = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, d[f.level] + delta));
  } else {
    d[f.len] = Math.max(MIN_LEN, Math.min(MAX_LEN, d[f.len] + delta));
    d[f.rounds] = 0;
  }
  store.save();
}
