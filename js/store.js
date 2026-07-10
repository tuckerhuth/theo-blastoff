// Persistent state: progress, adaptive stats, stickers, settings.

const KEY = 'blastoff-theo-v1';

// Shown in the parent panel; keep in lockstep with VERSION in sw.js.
export const GAME_VERSION = 'v13';

const DEFAULTS = {
  tutorialDone: false,
  levelUp: 1, levelDown: 1,          // 1=far pair 2=near pair 3=triple 4=all-near triple (0=tutorial solo)
  streakUp: 0, streakDown: 0,
  seqLen: 5,                         // ONE number per round: build to N, count down from N
  roundsAtLen: 0,                    // 0 → new territory, tower numbers shown
  transitions: {},                   // "u:3>4" | "d:8>7" -> { ok, err }
  stickers: [],                      // earned sticker emoji, in order
  launches: 0,
  missions: 0,
  settings: { voice: true, sfx: true, keyboardZones: true, showNumbers: false, micOn: true },
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
        // migrate pre-unification saves (separate up/down ranges): the
        // countdown range was the marquee skill, so it wins
        if (saved.seqLen === undefined && (saved.seqLenDown || saved.seqLenUp)) {
          this.data.seqLen = saved.seqLenDown || saved.seqLenUp;
          this.data.roundsAtLen = 0;
        }
        delete this.data.seqLenUp; delete this.data.seqLenDown;
        delete this.data.roundsAtLenUp; delete this.data.roundsAtLenDown;
        delete this.data.settings.mic; // renamed micOn (now defaults on)
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
