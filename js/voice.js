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
}

// Parent-facing audit trail: show what the recognizer heard, briefly.
function caption(text, matched) {
  if (!captionEl) return;
  captionEl.textContent = text;
  captionEl.classList.toggle('match', !!matched);
  captionEl.classList.remove('hidden');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => captionEl.classList.add('hidden'), 2500);
}

// Core of recognition handling; also reachable as window.__hear for testing.
function hear(transcript) {
  if (muted) return; // while the game speaks, the mic hears the game — ignore
  const tokens = (transcript || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return;
  let matchedNum = null;
  if (wanted !== null) {
    for (const tok of tokens) {
      if (WORDS[tok] === wanted) { matchedNum = wanted; break; }
    }
  }
  caption(`🗣 “${tokens.join(' ')}”${matchedNum !== null ? `  → ${matchedNum} ✓` : ''}`, matchedNum !== null);
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
      updateDot();
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
