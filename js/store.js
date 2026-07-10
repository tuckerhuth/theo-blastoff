// Persistent state: progress, adaptive stats, stickers, settings.

const KEY = 'blastoff-theo-v1';

const DEFAULTS = {
  tutorialDone: false,
  levelUp: 1, levelDown: 1,          // 0=tutorial 1=solo 2=far distractor 3=near distractor 4=three tiles
  streakUp: 0, streakDown: 0,
  seqLenUp: 5, seqLenDown: 5,        // grows to 10 with success
  transitions: {},                   // "u:3>4" | "d:8>7" -> { ok, err }
  stickers: [],                      // earned sticker emoji, in order
  launches: 0,
  missions: 0,
  settings: { voice: true, sfx: true, keyboardZones: true },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export const store = {
  data: clone(DEFAULTS),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.data = { ...clone(DEFAULTS), ...saved, settings: { ...DEFAULTS.settings, ...(saved.settings || {}) } };
      }
    } catch { /* private mode or corrupt data — run on defaults */ }
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* best effort */ }
  },

  reset() {
    this.data = clone(DEFAULTS);
    this.save();
  },

  transKey(dir, from, to) { return `${dir === 'up' ? 'u' : 'd'}:${from}>${to}`; },

  recordTransition(dir, from, to, firstTry) {
    const k = this.transKey(dir, from, to);
    const t = this.data.transitions[k] || (this.data.transitions[k] = { ok: 0, err: 0 });
    firstTry ? t.ok++ : t.err++;
    this.save();
  },

  // Error rate for a transition; null until there's enough data to mean anything.
  transitionErrorRate(dir, from, to) {
    const t = this.data.transitions[this.transKey(dir, from, to)];
    if (!t || t.ok + t.err < 3) return null;
    return t.err / (t.ok + t.err);
  },
};
