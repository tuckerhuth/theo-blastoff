// The difficulty ladder. Levels and sequence lengths move gently, per
// direction, based on first-try accuracy. Never punishing: hard rounds only
// arrive after streaks of easy wins, and one rough round steps back down.

import { store } from './store.js';

export const MAX_LEVEL = 4;
export const MAX_LEN = 10;

export function roundPlan(dir) {
  const d = store.data;
  return dir === 'up'
    ? { level: d.levelUp, len: d.seqLenUp }
    : { level: d.levelDown, len: d.seqLenDown };
}

// stats: { steps, firstTry } for the phase just finished.
export function afterPhase(dir, stats) {
  const d = store.data;
  const acc = stats.steps ? stats.firstTry / stats.steps : 1;
  const up = dir === 'up';
  let level = up ? d.levelUp : d.levelDown;
  let streak = up ? d.streakUp : d.streakDown;
  let len = up ? d.seqLenUp : d.seqLenDown;

  if (acc >= 0.99) {
    streak++;
    if (streak >= 2) {
      streak = 0;
      if (level < MAX_LEVEL) level++;
      else if (len < MAX_LEN) len = Math.min(MAX_LEN, len + 1);
    } else if (level >= 2 && len < MAX_LEN) {
      len++; // long sequences are their own gentle ramp
    }
  } else if (acc < 0.5) {
    streak = 0;
    if (level > 1) level--;
  } else {
    streak = 0;
  }

  if (up) { d.levelUp = level; d.streakUp = streak; d.seqLenUp = len; }
  else { d.levelDown = level; d.streakDown = streak; d.seqLenDown = len; }
  store.save();
}
