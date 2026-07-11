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
  'what comes after',
  'counting up',
  'counting down',
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
  // Knight & Dragon theme's own flavor lines (tools/phrases-knight.txt).
  'sir theo a dragon is attacking the castle put on your armor',
  'now let s count down and charge the dragon',
  'draw your sword',
  'victory',
  'great counting sir theo',
  'one more quest',
  'great questing sir theo see you next time',
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

// parent-panel health line
export function micStatus() {
  if (!SR) return 'unsupported';
  if (!store.data.settings.micOn) return 'off';
  return listening ? 'listening' : 'starting';
}

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

/* ---------------- persistent voice audit ---------------- */
// Every transcript the recognizer delivers — and every clip the game plays
// (audio.js) — with the verdict of what happened to it. THE diagnostic for
// "he said it and nothing happened": mid-speech drops used to leave no
// trace at all (the v23 playtest was undiagnosable after the fact). Ring of
// 200, persisted under its own key, surfaced in the parent panel and as
// window.__hearLog.
const AUDIT_KEY = 'blastoff-voicelog-v1';
let auditLog = [];
try { auditLog = JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; } catch { /* fresh log */ }
let auditSaveT = null;
export function voiceAudit(entry) {
  auditLog.push({ t: Date.now(), ...entry });
  if (auditLog.length > 200) auditLog.splice(0, auditLog.length - 200);
  if (auditSaveT) return; // debounce: interim transcripts arrive several/sec
  auditSaveT = setTimeout(() => {
    auditSaveT = null;
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog)); } catch { /* storage blocked */ }
  }, 500);
}
export function voiceAuditLog() { return auditLog; }

// Numbers the game itself said recently (echo window): n → timestamp.
// audio.js stamps every clip at speak() START and again as each clip's
// audio ENDS (and on hush) — so the guards below can anchor on real sound.
const recentGameNums = new Map();

// audio.js reports every clip the game plays, so we can discount echoes.
// afterN prompt clips ("What comes after three?") speak the previous number,
// so they register it too.
export function noteGameSpeech(names) {
  const now = Date.now();
  for (const name of names) {
    const m = String(name).match(/^(?:n|after)(\d+)$/);
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

// Mid-speech fuzzy matching (v24). A homophone that is ALSO a word the game
// itself says must stay dead while the game speaks — "time TO build" can
// never become 2 — but homophones the game never utters ("for", "ate",
// "free") are almost certainly the child answering over the prompt, and
// dropping those was the v23 playtest bug ("he said the right answer during
// the prompt and nothing happened"). Strict words always count; the chain
// guard keeps everything honest. Known residual: "two" transcribed as "to"
// still dies mid-speech — the safe trade.
const GAME_VOCAB = new Set(GAME_PHRASES.flatMap((p) => p.split(' ')));
const MUTED_WORDS = Object.fromEntries(Object.entries(WORDS)
  .filter(([tok]) => STRICT_WORDS[tok] !== undefined || !GAME_VOCAB.has(tok)));

/* ---------------- chain counting ---------------- */
// Theo counts in bursts ("one… two… three…" at ~1/sec). We accept every
// number that extends the expected sequence from the current target in the
// current direction; extras queue briefly and land as the game catches up.
// A numeric token like "65" during a countdown at 6 expands to the digits
// 6,5 and is accepted ONLY because it extends the chain — the same "65"
// while counting up is noise. The chain expectation is also what dedups the
// recognizer's growing interim transcripts ("one" → "one two" → …): numbers
// already counted no longer match the moved expectation.

let wantedDir = 1;             // +1 build, −1 countdown — drives chain validation
const pending = [];            // numbers said ahead of the game: [{ n, t }]
const PENDING_TTL = 4000;
let lastHintBlocked = false;   // set by extractChain, read for the audit verdict

// Utterance identity (v25). The recognizer delivers interim and final
// results of ONE utterance in the same result slot — so the speaker's echo
// of a hint, whose utterance always BEGINS while the game is speaking,
// stays identifiable even when its final transcript posts a second after
// the unmute. Time windows can't make that call: an echo's late final and
// the child's prompt answer both land 0.5–1.5s after the clip ends, and
// v24's post-end windows ate Tucker's real answers (July 11 playtest log).
// An utterance born muted is treated as game audio for its whole lifetime;
// a fresh utterance is never time-blocked at all.
const mutedBornUtt = new Set();
function utteranceEcho(key) {
  if (key === null) return false;
  if (muted) {
    mutedBornUtt.add(key);
    if (mutedBornUtt.size > 40) mutedBornUtt.delete(mutedBornUtt.values().next().value);
  }
  return mutedBornUtt.has(key);
}

export function voiceQueueSize() { return pending.length; }

// tokens → in-order chain-extending numbers (digit runs expanded).
// gameVoice: this transcript is — or began during — the game's own speech.
function extractChain(tokens, words, gameVoice) {
  if (wanted === null) return [];
  const accepted = [];
  // The game sometimes speaks the wanted number itself (rung-3 hint, the
  // countdown's solo prompts) — its own echo must not answer the question.
  // Blocked iff the wanted number is part of the current/latest speech AND
  // this transcript belongs to that speech (muted now, or utterance born
  // muted). No post-end time window: the child repeating the modeled number
  // right after the clip is call-and-response — the point of the hint — and
  // v24's 1s window systematically ate it (recognition posts answers
  // 0.5–1.5s after the clip, indistinguishable from the echo BY TIME alone).
  const stamp = recentGameNums.get(wanted) || 0;
  const hintBlocked = gameVoice && stamp >= muteStartedAt;
  const expectAt = () => {
    if (accepted.length) return accepted[accepted.length - 1] + wantedDir;
    return pending.length ? pending[pending.length - 1].n + wantedDir : wanted;
  };
  for (const tok of tokens) {
    const candidates = [];
    if (words[tok] !== undefined) candidates.push(words[tok]);
    else if (/^\d+$/.test(tok)) {
      const digits = [...tok].map(Number);
      if (digits.every((d) => d >= 1 && d <= 9)) candidates.push(...digits);
    }
    for (const n of candidates) {
      if (n !== expectAt()) continue; // doesn't extend the chain → noise
      if (n === wanted && !accepted.length && !pending.length && hintBlocked) { lastHintBlocked = true; continue; }
      accepted.push(n);
    }
  }
  return accepted;
}

function drainPending() {
  const now = Date.now();
  while (pending.length && now - pending[0].t > PENDING_TTL) pending.shift();
  if (wanted === null || !pending.length) return;
  if (pending[0].n !== wanted) { pending.length = 0; return; } // derailed chain
  if (!onMatch) return; // provisional expectation (step not armed yet) — hold
  pending.shift();
  const cb = onMatch;
  wanted = null; onMatch = null;
  cb(); // engine advances and re-arms via voiceExpect → drains the rest
}

// Title-screen theme switching by voice ("rocket"/"knight"/"dragon"). Set
// once at boot (js/main.js); callbacks re-guard against a mid-round switch.
let titleCommands = null;
export function setTitleCommands(map) { titleCommands = map; }

// Core of recognition handling; also reachable as window.__hear for testing.
// uttKey identifies which utterance a result belongs to (see utteranceEcho);
// null (tests, unknown) falls back to the plain muted state.
function hear(transcript, uttKey = null) {
  // Must run first even for transcripts we discard: it MARKS the utterance
  // while muted so its post-unmute finals stay recognizable as game audio.
  const gameVoice = utteranceEcho(uttKey) || muted;
  let tokens = (transcript || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return;
  let joined = tokens.join(' ');

  if (!gameVoice) {
    // The game's own lines coming back through the speakers: recognition lags
    // real time, so a late transcript often merges the game's prompt with the
    // child's answer ("counting up what comes after three FOUR"). Discarding
    // the whole thing would throw the answer away — strip the game's words
    // and process whatever is left. A multi-word transcript that is itself a
    // fragment of a phrase is all game speech; single words are exempt from
    // that check — "one" must not die because "one more launch" contains it.
    let rest = ` ${joined} `;
    for (const p of GAME_PHRASES) {
      if (tokens.length >= 2 && p.includes(joined)) { voiceAudit({ heard: joined, verdict: 'game-phrase' }); return; }
      while (rest.includes(` ${p} `)) rest = rest.replace(` ${p} `, ' ');
    }
    if (rest.trim() !== joined) {
      tokens = rest.split(/[^a-z0-9]+/).filter(Boolean);
      if (!tokens.length) { voiceAudit({ heard: joined, verdict: 'game-phrase' }); return; }
      joined = tokens.join(' ');
    }
  }

  // Title-screen theme words. Only between rounds (no expectation armed) and
  // never while the game itself is speaking — a mid-round "dragon" must never
  // switch the world out from under an in-progress question.
  if (!gameVoice && wanted === null && titleCommands) {
    for (const tok of tokens) {
      if (titleCommands[tok]) { voiceAudit({ heard: joined, verdict: `theme:${tok}` }); titleCommands[tok](); return; }
    }
  }

  // While the game speaks (or the utterance began during its speech), fuzzy
  // matching narrows to words the game itself never says (MUTED_WORDS) — a
  // clear chain still cuts through, homophone or not, and the game's own
  // lines can never count themselves.
  lastHintBlocked = false;
  const accepted = extractChain(tokens, gameVoice ? MUTED_WORDS : WORDS, gameVoice);
  if (accepted.length) {
    const now = Date.now();
    for (const n of accepted) pending.push({ n, t: now });
    caption(`🗣 “${joined}”  → ${accepted.join(', ')} ✓`, true);
    voiceAudit({ heard: joined, muted: gameVoice, verdict: `accepted ${accepted.join(',')}` });
    drainPending();
    return;
  }
  if (gameVoice) {
    // The game's own voice (live, or an echo utterance finalizing after the
    // unmute) — keep the evidence: silent drops made v23 undiagnosable.
    voiceAudit({
      heard: joined, muted: gameVoice,
      verdict: lastHintBlocked ? 'hint-blocked' : (muted ? 'muted-drop' : 'echo-final'),
    });
    caption(`🗣 “${joined}” · 🔇`, false);
    return;
  }

  voiceAudit({ heard: joined, verdict: wanted === null ? 'not-armed' : 'no-match' });
  caption(`🗣 “${joined}”`, false);
}

let recGen = 0; // bumped per recognizer (re)start — result indices reset with it

function handleResults(e) {
  for (let i = e.resultIndex; i < e.results.length; i++) {
    // best alternative only: lower-ranked alternatives re-offer the same
    // audio and could push the chain past what was actually said.
    // gen:index identifies the utterance across its interim→final results.
    hear(e.results[i][0].transcript, `${recGen}:${i}`);
  }
}

// Debug/audit hooks (harmless in production): __hear('seven') simulates the
// recognizer hearing that phrase; __voiceMuted lets the test gate wait for
// the un-muted state, where the phrase-strip path (not MUTED_WORDS) runs;
// __hearLog is the persistent transcript-verdict audit (see voiceAudit).
if (typeof window !== 'undefined') {
  window.__hear = (t, uttKey = null) => hear(t, uttKey); // optional utterance key, e.g. __hear('five', 'echo:1')
  window.__voiceMuted = () => muted;
  window.__hearLog = auditLog;
}

// Chrome's SpeechRecognition is network-backed and ends itself on silence
// (no-speech) — and a start() right after end can throw InvalidStateError.
// The old code restarted once with no retry, so a single throw left the mic
// silently dead until the next unrelated start(): the "long, inconsistent
// delay after the final hint" Tucker hit (a long silence cycles end→restart,
// and one failed restart kills it). `starting` dedups in-flight starts; the
// watchdog below guarantees recovery within ~1s no matter how it died.
let starting = false;

function safeStart(reason) {
  if (!rec || !store.data.settings.micOn || listening || starting) return;
  starting = true;
  try {
    rec.start();
    voiceAudit({ rec: 'start', reason });
  } catch (err) {
    starting = false; // benign if already running; the watchdog retries otherwise
    voiceAudit({ rec: 'start-fail', reason, note: String(err && err.name || err).slice(0, 40) });
  }
}

function create() {
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = 'en-US';
  rec.onresult = handleResults;
  rec.onstart = () => { recGen++; starting = false; listening = true; voiceAudit({ rec: 'live' }); updateDot(); };
  rec.onend = () => {
    listening = false; starting = false; updateDot();
    voiceAudit({ rec: 'end' });
    // Restart fast; the watchdog is the backstop if this throw-and-dies.
    if (store.data.settings.micOn) setTimeout(() => safeStart('onend'), 150);
  };
  rec.onerror = (e) => {
    starting = false;
    voiceAudit({ rec: 'error', note: e.error });
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      store.data.settings.micOn = false; // permission denied — turn the mode off
      store.save();
      listening = false;
      stopWatchdog();
      caption('🎤 mic blocked — allow it in browser settings, then re-enable in ⚙️');
      updateDot();
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      caption(`🎤 speech error: ${e.error}`); // e.g. Chrome's routine 'network' hiccups
    }
    // no-speech/aborted/network just end the session; onend + watchdog recover.
  };
}

// Keeps the recognizer alive whenever the mode is on — including WHILE the
// game speaks (muted), so it's already warm when the child answers. Recovers
// any death (thrown restart, swallowed error) within one tick. A 1s interval,
// not a rAF — negligible cost, and only while mic is on.
let watchdog = null;
function startWatchdog() {
  if (watchdog || !SR) return;
  watchdog = setInterval(() => {
    if (store.data.settings.micOn && !listening && !starting) safeStart('watchdog');
  }, 1000);
}
function stopWatchdog() { clearInterval(watchdog); watchdog = null; }

// Call whenever settings.micOn may have changed (toggle, session start).
export function voiceRefresh() {
  if (!SR) return;
  if (store.data.settings.micOn) {
    if (!rec) create();
    startWatchdog();
    safeStart('refresh');
  } else if (rec) {
    stopWatchdog();
    if (listening) { try { rec.stop(); } catch { /* already stopped */ } }
  }
}

// The engine registers what number would be correct right now (and the
// direction, so spoken chains can run ahead). Queued numbers land instantly.
export function voiceExpect(n, cb, dir = wantedDir) {
  wanted = n; onMatch = cb; wantedDir = dir;
  drainPending();
}
export function voiceClearExpect() { wanted = null; onMatch = null; pending.length = 0; }

// audio.js mutes recognition while the game's own voice is playing.
// muteStartedAt lets the hint guard tell "this number is part of the speech
// playing right now" (stamp ≥ mute start) from a stale stamp.
let muteStartedAt = 0;
export function setVoiceMuted(m) {
  if (m && !muted) muteStartedAt = Date.now();
  muted = m;
}
