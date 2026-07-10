// The difficulty ladder. Choice difficulty (level) adapts per direction —
// counting down genuinely lags counting up — but the counting RANGE is one
// shared number per round: build the rocket up to N, count down from N.
//
//   L1  two tiles, far decoy        (4 vs 9)
//   L2  two tiles, near decoy       (7 vs 8 — the real confusions)
//   L3  three tiles (near + far)
//   L4  three tiles, all near
//
// A clean phase promotes its direction's level; the range stretches +2 only
// when BOTH halves of the round were clean. A rough phase (<50% first-try)
// steps its level back down — and if there's no level left to give, the
// range shrinks. New counting territory always gets one scaffolded round
// with the tower numbers visible; from level 2 the tower masks (see
// roundPlan) so it's a meter, never an answer key.

import { store } from './store.js';

export const MAX_LEVEL = 4;
export const MIN_LEVEL = 1;
export const MAX_LEN = 10;
export const MIN_LEN = 3;

function levelField(dir) { return dir === 'up' ? 'levelUp' : 'levelDown'; }

export function roundPlan(dir) {
  const d = store.data;
  const level = d[levelField(dir)];
  const firstAtLen = (d.roundsAtLen || 0) === 0;
  const masked = d.settings.forceMask || level >= 3 || (level >= 2 && !firstAtLen);
  return { level, len: d.seqLen, masked };
}

// stats: { steps, firstTry } for one phase. Returns first-try accuracy.
export function afterPhase(dir, stats) {
  const d = store.data;
  const f = levelField(dir);
  const acc = stats.steps ? stats.firstTry / stats.steps : 1;

  if (acc >= 0.99) {
    if (d[f] < MAX_LEVEL) d[f]++;
  } else if (acc < 0.5) {
    if (d[f] > MIN_LEVEL) d[f]--;
    else if (d.seqLen > 5) { d.seqLen--; d.roundsAtLen = 0; }
  }
  store.save();
  return acc;
}

// Called once per round with both phases' accuracy — governs the shared range.
export function afterRound(accUp, accDown) {
  const d = store.data;
  d.roundsAtLen = (d.roundsAtLen || 0) + 1;
  if (accUp >= 0.99 && accDown >= 0.99 && d.seqLen < MAX_LEN) {
    d.seqLen = Math.min(MAX_LEN, d.seqLen + 2);
    d.roundsAtLen = 0; // new territory → next round shows the tower numbers
  }
  store.save();
}

// Parent panel steppers. dir is ignored for 'len' — the range is shared.
export function nudge(dir, what, delta) {
  const d = store.data;
  if (what === 'level') {
    const f = levelField(dir);
    d[f] = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, d[f] + delta));
  } else {
    d.seqLen = Math.max(MIN_LEN, Math.min(MAX_LEN, d.seqLen + delta));
    d.roundsAtLen = 0;
  }
  store.save();
}
