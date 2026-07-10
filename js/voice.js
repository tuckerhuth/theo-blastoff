// Experimental microphone input via the browser's native SpeechRecognition.
//
// Strictly additive: tapping always works; a correctly-spoken number is
// accepted instantly, anything else is ignored — recognition noise must
// never punish. Muted while the game itself is speaking so the game's own
// voice can't answer its prompts.

import { store } from './store.js';

// Generous fuzzy map — toddler pronunciation and speech-API guesses.
const WORDS = {
  one: 1, won: 1, wan: 1, '1': 1,
  two: 2, to: 2, too: 2, '2': 2,
  three: 3, free: 3, tree: 3, '3': 3,
  four: 4, for: 4, fore: 4, '4': 4,
  five: 5, hive: 5, '5': 5,
  six: 6, sick: 6, sicks: 6, '6': 6,
  seven: 7, heaven: 7, seben: 7, '7': 7,
  eight: 8, ate: 8, hate: 8, '8': 8,
  nine: 9, mine: 9, '9': 9,
  ten: 10, tin: 10, den: 10, '10': 10,
};

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// The game's own lines (normalized) — recognition of these is the game
// talking to itself through the speakers, never the child. Keep roughly in
// sync with tools/phrases.txt (number clips are handled separately below).
const GAME_PHRASES = [
  'captain theo time to build your rocket',
  'let s count up',
  'now let s count down to blast off',
  'what comes next',
  'what comes first',
  'watch me',
  'your turn',
  'blast off',
  'great counting captain theo',
  'hooray you did it',
  'amazing counting',
  'mission complete you earned a sticker',
  'one more launch',
  'great flying captain theo see you next time',
  'tap to play',
  'all aboard',
];

let rec = null;
let listening = false;
let muted = false;
let wanted = null;
let onMatch = null;
let dotEl = null;
let captionEl = null;
let captionTimer = null;

export function voiceSupported() { return !!SR; }

export function initVoice(indicatorEl, transcriptEl) {
  dotEl = indicatorEl;
  captionEl = transcriptEl;
}

function updateDot() {
  if (dotEl) dotEl.classList.toggle('hidden', !(listening && store.data.settings.micOn));
  refreshCaption();
}

// Steady state of the audit strip: "listening…" while the recognizer is
// live, hidden when it isn't. No caption at all = recognition is not running.
function refreshCaption() {
  if (!captionEl || captionTimer) return; // a transcript is on screen — let it finish
  if (listening && store.data.settings.micOn) {
    captionEl.textContent = '🎤 listening…';
    captionEl.classList.add('idle');
    captionEl.classList.remove('match', 'hidden');
  } else {
    captionEl.classList.add('hidden');
  }
}

// Parent-facing audit trail: show what the recognizer heard, briefly.
function caption(text, matched) {
  if (!captionEl) return;
  captionEl.textContent = text;
  captionEl.classList.toggle('match', !!matched);
  captionEl.classList.remove('idle', 'hidden');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => { captionTimer = null; refreshCaption(); }, 2500);
}

// Numbers the game itself said recently (echo window): n → timestamp.
const recentGameNums = new Map();

// audio.js reports every clip the game plays, so we can discount echoes.
export function noteGameSpeech(names) {
  const now = Date.now();
  for (const name of names) {
    const m = String(name).match(/^n(\d+)$/);
    if (m) recentGameNums.set(+m[1], now);
  }
}

// Strict number words — no homophones. While the game itself is speaking,
// "time TO build" must never become 2, but a clear "two!" still lands.
const STRICT_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
};

// Core of recognition handling; also reachable as window.__hear for testing.
function hear(transcript) {
  const tokens = (transcript || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return;

  if (muted) {
    // Barge-in: the child can cut the speaker off, but only with a strict
    // utterance of the wanted number — and not while the game itself just
    // said that number (the 12s idle hint speaks the answer aloud).
    if (wanted === null) return;
    if (Date.now() - (recentGameNums.get(wanted) || 0) < 3000) return;
    for (const tok of tokens) {
      if (STRICT_WORDS[tok] === wanted) {
        caption(`🗣 “${tokens.join(' ')}”  → ${wanted} ✓`, true);
        const cb = onMatch;
        wanted = null; onMatch = null;
        cb && cb();
        return;
      }
    }
    return; // everything else mid-speech is (mostly) the game's own voice
  }

  const joined = tokens.join(' ');

  // The game's own lines coming back through the speakers: never show them.
  // (Single-word transcripts are exempt — "one" must not die because the
  // phrase "one more launch" contains it.)
  for (const p of GAME_PHRASES) {
    if (joined.includes(p) || (tokens.length >= 2 && p.includes(joined))) return;
  }

  let matchedNum = null;
  if (wanted !== null) {
    for (const tok of tokens) {
      if (WORDS[tok] === wanted) { matchedNum = wanted; break; }
    }
  }

  // Bare numbers the game just said (echo through the speakers): discount
  // them — unless it's the number we're waiting for, which is always his.
  if (matchedNum === null && tokens.length <= 3) {
    const now = Date.now();
    const nums = tokens.map(t => WORDS[t]).filter(v => v !== undefined);
    if (nums.length && nums.every(n => now - (recentGameNums.get(n) || 0) < 3000)) return;
  }

  caption(`🗣 “${joined}”${matchedNum !== null ? `  → ${matchedNum} ✓` : ''}`, matchedNum !== null);
  if (matchedNum !== null) {
    const cb = onMatch;
    wanted = null; onMatch = null;
    cb && cb();
  }
}

function handleResults(e) {
  for (let i = e.resultIndex; i < e.results.length; i++) {
    for (const alt of e.results[i]) {
      hear(alt.transcript);
      if (wanted === null) return; // matched — don't double-fire
    }
  }
}

// Debug/audit hook (harmless in production): __hear('seven') simulates the
// recognizer hearing that phrase.
if (typeof window !== 'undefined') window.__hear = hear;

function create() {
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = 'en-US';
  rec.onresult = handleResults;
  rec.onstart = () => { listening = true; updateDot(); };
  rec.onend = () => {
    listening = false; updateDot();
    // The API stops itself constantly; keep it alive while the mode is on.
    if (store.data.settings.micOn) setTimeout(() => { try { rec.start(); } catch { /* already starting */ } }, 300);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      store.data.settings.micOn = false; // permission denied — turn the mode off
      store.save();
      listening = false;
      caption('🎤 mic blocked — allow it in browser settings, then re-enable in ⚙️');
      updateDot();
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      caption(`🎤 speech error: ${e.error}`); // e.g. Chrome's routine 'network' hiccups
    }
  };
}

// Call whenever settings.micOn may have changed (toggle, session start).
export function voiceRefresh() {
  if (!SR) return;
  if (store.data.settings.micOn) {
    if (!rec) create();
    if (!listening) { try { rec.start(); } catch { /* already started */ } }
  } else if (rec && listening) {
    try { rec.stop(); } catch { /* already stopped */ }
  }
}

// The engine registers what number would be correct right now.
export function voiceExpect(n, cb) { wanted = n; onMatch = cb; }
export function voiceClearExpect() { wanted = null; onMatch = null; }

// audio.js mutes recognition while the game's own voice is playing.
export function setVoiceMuted(m) { muted = m; }
