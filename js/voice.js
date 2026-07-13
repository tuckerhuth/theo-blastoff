// Experimental microphone input via the browser's native SpeechRecognition.
//
// Strictly additive: tapping always works; a correctly-spoken number is
// accepted instantly, anything else is ignored — recognition noise must
// never punish. The game's own voice can't answer its prompts because every
// spoken clip opens a one-occurrence echo budget (the ledger below), not
// because of any time-based muting — the child is trusted at all times.

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

// EVERY word the speaker can emit, per clip (normalized like a transcript:
// lowercase, punctuation → token breaks). This is the single source of truth
// for the echo ledger AND the phrase-strip list — the game can only echo what
// it actually plays. Keys are RESOLVED clip keys (audio.js clipKey()): shared
// clips bare, theme overrides as '<theme>/<name>'. Kept in lockstep with
// tools/phrases*.txt by tools/check-clip-text.mjs (wired into verify.sh) —
// the format below is parsed by that checker, keep it one 'key': 'text' pair
// per line.
/* CLIP_TEXT-BEGIN */
const CLIP_TEXT = {
  'n1': 'one',
  'n2': 'two',
  'n3': 'three',
  'n4': 'four',
  'n5': 'five',
  'n6': 'six',
  'n7': 'seven',
  'n8': 'eight',
  'n9': 'nine',
  'n10': 'ten',
  'hello': 'captain theo time to build your rocket',
  'countup': 'let s count up',
  'countdown': 'now let s count down to blast off',
  'whatnext': 'what comes next',
  'whatfirst': 'what comes first',
  'countingup': 'counting up',
  'countingdown': 'counting down',
  'after1': 'what comes after one',
  'after2': 'what comes after two',
  'after3': 'what comes after three',
  'after4': 'what comes after four',
  'after5': 'what comes after five',
  'after6': 'what comes after six',
  'after7': 'what comes after seven',
  'after8': 'what comes after eight',
  'after9': 'what comes after nine',
  'after10': 'what comes after ten',
  'watchme': 'watch me',
  'yourturn': 'your turn',
  'ready': 'ready',
  'blastoff': 'blast off',
  'great1': 'great counting captain theo',
  'great2': 'hooray you did it',
  'great3': 'amazing counting',
  'mission': 'mission complete you earned a sticker',
  'onemore': 'one more launch',
  'alldone': 'great flying captain theo see you next time',
  'taptoplay': 'tap to play',
  'allaboard': 'all aboard',
  'notquite': 'no not',
  'knight/hello': 'sir theo a dragon is attacking the castle put on your armor',
  'knight/countdown': 'now let s count down and charge the dragon',
  'knight/allaboard': 'draw your sword',
  'knight/blastoff': 'victory',
  'knight/great1': 'great counting sir theo',
  'knight/onemore': 'one more quest',
  'knight/alldone': 'great questing sir theo see you next time',
  'monkey/hello': 'hi theo let s fill the tree with bananas',
  'monkey/countdown': 'now let s count down and eat every banana',
  'monkey/allaboard': 'a whole bunch time to eat',
  'monkey/blastoff': 'you re the top banana',
  'monkey/great1': 'great counting theo',
  'monkey/onemore': 'one more bunch',
  'monkey/alldone': 'great counting theo see you next time',
};
/* CLIP_TEXT-END */

// The game's own multi-word lines — a transcript that is (a fragment of) one
// of these is the game talking to itself through the speakers, never the
// child. Derived, not hand-kept: single-token clips (the numbers, 'ready',
// knight 'victory') are excluded so a bare spoken word is never stripped.
const GAME_PHRASES = [...new Set(
  Object.values(CLIP_TEXT).filter((t) => t.includes(' ')),
)];

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

// DEBUG: live muted-vs-listening state, updated with no delay (unlike the
// transcript caption below, which can lag up to 2.5s behind a mute flip
// while a transcript is on screen). This is the authoritative signal for
// watching the hint-block window in real time. — Tucker, debugging the
// post-hint deafness bug.
function updateDot() {
  if (dotEl) {
    const on = listening && store.data.settings.micOn;
    dotEl.classList.toggle('hidden', !on);
    dotEl.classList.toggle('muted', muted);
    dotEl.textContent = muted ? '🔇' : '🎤';
  }
  refreshCaption();
}

// Steady state of the audit strip: "listening…"/"muted…" while the
// recognizer is live, hidden when it isn't. No caption at all = recognition
// is not running.
function refreshCaption() {
  if (!captionEl || captionTimer) return; // a transcript is on screen — let it finish
  if (listening && store.data.settings.micOn) {
    captionEl.textContent = muted ? '🔇 muted…' : '🎤 listening…';
    captionEl.classList.toggle('idle', !muted);
    captionEl.classList.toggle('muted-state', muted);
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
  captionEl.classList.remove('idle', 'muted-state', 'hidden');
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

// Strict number words — no homophones. Used to decide which CLIP tokens are
// number content (a clip saying "three" opens a number-class ledger entry;
// its "to" in "time to build" opens only a literal-token entry, so a child's
// "two" is never debited against it).
const STRICT_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
};

/* ---------------- expectation-biased fuzzy matching (v36) ----------------
   The recognizer garbles toddler speech constantly ("four" arrives as
   "pour", "or", "fourth"...). A global fuzz would invent numbers out of
   ambient chatter, but the game always KNOWS the expected next number — so
   near-misses are accepted only against that one word, only at the chain
   position, and never for a word the game itself speaks (a clip echo must
   not gain new disguises). The ledger debits fuzzy hits symmetrically, so a
   hint echo transcribed as a near-miss still spends its budget instead of
   self-answering. */

// every word any clip can say — excluded from the fuzzy tier only (exact
// WORDS matching is never narrowed; that was v24's mistake)
const CLIP_WORD_SET = new Set(Object.values(CLIP_TEXT).flatMap((t) => t.split(' ')));

// all known spellings per number, canonical word first
const NUM_VARIANTS = {};
for (const [tok, n] of Object.entries(WORDS)) {
  (NUM_VARIANTS[n] = NUM_VARIANTS[n] || []).push(tok);
}
// common recognizer clippings/near-misses seen on-device that sit at edit
// distance >1 or under the length guard — still expectation-scoped
const EXTRA_FUZZ = {
  2: ['tutu'], 4: ['or', 'oar', 'ore', 'door', 'floor'], 6: ['fix', 'sits'],
  8: ['aid'], 9: ['line', 'wine'], 10: ['pen'],
};

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2; // only 0/1 matter here
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

// Does this unrecognized token plausibly mean the number n?
function fuzzyNumber(tok, n) {
  const variants = NUM_VARIANTS[n];
  if (!variants || CLIP_WORD_SET.has(tok)) return false;
  const canonical = variants[0];
  if (tok.startsWith(canonical) && tok.length <= canonical.length + 3) return true; // fours, fourth
  if (EXTRA_FUZZ[n]?.includes(tok)) return true;
  if (tok.length < 3) return false; // too little signal for edit distance
  return variants.some((v) => v.length >= 4 && editDistance(tok, v) <= 1);
}

/* ---------------- echo ledger (v36) ----------------
   The game authored every clip, so it knows the exact tokens its speaker
   will emit — and each spoken token can echo back through the mic AT MOST
   ONCE. speak() opens one discountable entry per token; the FIRST transcript
   occurrence debits it (that's the echo), and every occurrence beyond the
   budget is the child — accepted instantly, mid-clip or after, even appended
   to the same recognition slot the echo landed in. This replaces v24/v25's
   time windows and lifetime slot-poisoning, which ate real answers for ~3s
   after every hint (July 12 playtest): distrust here is scoped to specific
   CONTENT and at most one OCCURRENCE, never to a stretch of time.
   Prior art: Sonos wake-word occurrence counting (US10475449). */

const ECHO_ENTRY_TTL = 2000;  // ms past a clip's audio end that its tokens stay
                              // discountable — must exceed the observed 0.5-1.5s
                              // echo-final lag (v25) or a late echo self-answers.
                              // Bounds the ECHO allowance, never gates the child.
let speechGen = 0;            // bumped per speak(); voids stale unplayed budgets
const ledger = [];            // { tok, numClass, clipKey, gen, wantedAtOpen,
                              //   started, audibleEnd, spent }

function ledgerExpire() {
  const now = Date.now();
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i];
    if (e.audibleEnd && now - e.audibleEnd > ECHO_ENTRY_TTL) ledger.splice(i, 1);
  }
  while (ledger.length > 60) ledger.shift(); // hard cap: oldest budgets first
}

// audio.js: a speak() sequence is starting with these resolved clip keys.
// Runs in the same tick as setVoiceMuted(true) — the gate asserts that.
export function voiceSpeechStart(clipKeys) {
  speechGen++;
  // an interrupted speak never plays its remaining clips — void their budgets
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i].gen < speechGen && !ledger[i].started) ledger.splice(i, 1);
  }
  for (const key of clipKeys) {
    for (const tok of (CLIP_TEXT[key] || '').split(' ').filter(Boolean)) {
      ledger.push({
        tok,
        numClass: STRICT_WORDS[tok],   // undefined for non-number clip words
        clipKey: key,
        gen: speechGen,
        wantedAtOpen: wanted,          // hint/solo clips model the ANSWER; the
                                       // victory lap plays with nothing armed
        started: false,
        audibleEnd: null,
        spent: false,
      });
    }
  }
  ledgerExpire();
}

// NOTE: an interrupted speak() reports its cut clip's end AFTER the
// interrupting speak has bumped speechGen — so these match on clip identity
// and started-state, never on the current generation.
export function voiceClipStart(clipKey) {
  // newest un-started batch for this clip (repeat clips, e.g. solo prompts,
  // can coexist across generations)
  let gen = -1;
  for (const e of ledger) if (e.clipKey === clipKey && !e.started && e.gen > gen) gen = e.gen;
  for (const e of ledger) if (e.clipKey === clipKey && e.gen === gen) e.started = true;
}

export function voiceClipEnd(clipKey) {
  const now = Date.now();
  for (const e of ledger) {
    if (e.clipKey === clipKey && e.started && !e.audibleEnd) e.audibleEnd = now;
  }
}

// hushSpeech(): the playing clip was cut — close its entries now (its audio
// DID reach the room up to this moment) and void clips that never started.
export function voiceSpeechHush() {
  const now = Date.now();
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i];
    if (e.started && !e.audibleEnd) e.audibleEnd = now;
    else if (!e.started) ledger.splice(i, 1);
  }
}

// An open (unexpired, unspent) entry matching this transcript token —
// literal match for any clip word, number-CLASS match for number content
// ('hive'/'5' debit a spoken 'five'; a child's 'two' never debits 'to').
// Fuzzy near-misses debit too: whatever disguise a spoken number's echo
// wears in the transcript, it must spend the same budget it would have
// spent undisguised — otherwise the fuzzy tier would be a self-answer hole.
function openEntry(tok) {
  const now = Date.now();
  const cls = WORDS[tok]; // undefined for non-number transcript tokens
  for (const e of ledger) {
    if (e.spent) continue;
    if (e.audibleEnd && now - e.audibleEnd > ECHO_ENTRY_TTL) continue;
    if (e.tok === tok) return e;
    if (e.numClass === undefined) continue;
    if (cls !== undefined ? e.numClass === cls : fuzzyNumber(tok, e.numClass)) return e;
  }
  return null;
}

/* ---------------- utterance slot diffing (replaces mutedBornUtt) ----------
   The recognizer grows ONE result slot per utterance (interim → final), and
   on iOS the child's answer often lands in the SAME slot as the game's echo.
   v25 poisoned such slots for life — the diagnosed ~3s deafness. Instead:
   per slot, process only the class-normalized multiset DIFFERENCE vs what
   that slot already delivered. An echo final that rewrites 'five'→'5'
   contributes nothing; a child answer appended to the echo's slot is pure
   new tokens and lands immediately. */

const uttSeen = new Map(); // uttKey → { counts: Map(class → n), echoProne }

function tokClass(tok) { return WORDS[tok] !== undefined ? String(WORDS[tok]) : tok; }

// Returns the ORIGINAL tokens that are new for this slot, in order, and
// updates the slot record. null key (tests, unknown) = no diffing.
function slotNewTokens(uttKey, tokens) {
  if (uttKey === null) return tokens;
  let rec = uttSeen.get(uttKey);
  if (!rec) {
    rec = { counts: new Map(), echoProne: muted };
    uttSeen.set(uttKey, rec);
    if (uttSeen.size > 24) uttSeen.delete(uttSeen.keys().next().value);
  }
  const budget = new Map(rec.counts);
  const fresh = [];
  const seen = new Map();
  for (const tok of tokens) {
    const c = tokClass(tok);
    seen.set(c, (seen.get(c) || 0) + 1);
    const b = budget.get(c) || 0;
    if (b > 0) budget.set(c, b - 1); // already delivered by this slot
    else fresh.push(tok);
  }
  // remember the LARGEST multiset this slot has delivered per class
  for (const [c, n] of seen) rec.counts.set(c, Math.max(rec.counts.get(c) || 0, n));
  return fresh;
}

function slotEchoProne(uttKey) {
  if (uttKey === null) return muted; // tests/unknown: the live speech state
  return uttSeen.get(uttKey)?.echoProne || false;
}

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

export function voiceQueueSize() { return pending.length; }

// tokens → in-order chain-extending numbers (digit runs expanded). Echo
// rejection happens BEFORE this, in the ledger debit pass — by the time
// tokens reach the chain they are trusted as the child, so the FULL fuzzy
// WORDS map applies at all times (no vocabulary narrowing while the game
// speaks; dropping homophones mid-speech was the v23 playtest bug).
// Tokens the WORDS map doesn't know get one more chance, biased toward the
// answer: a near-miss of exactly the expected number (see fuzzyNumber).
let lastFuzzy = []; // "tok→n" notes for the audit trail, reset per hear()
function extractChain(tokens) {
  if (wanted === null) return [];
  const accepted = [];
  const expectAt = () => {
    if (accepted.length) return accepted[accepted.length - 1] + wantedDir;
    return pending.length ? pending[pending.length - 1].n + wantedDir : wanted;
  };
  for (const tok of tokens) {
    const candidates = [];
    if (WORDS[tok] !== undefined) candidates.push(WORDS[tok]);
    else if (/^\d+$/.test(tok)) {
      const digits = [...tok].map(Number);
      if (digits.every((d) => d >= 1 && d <= 9)) candidates.push(...digits);
    } else if (fuzzyNumber(tok, expectAt())) {
      candidates.push(expectAt());
      lastFuzzy.push(`${tok}→${expectAt()}`);
    }
    for (const n of candidates) {
      if (n !== expectAt()) continue; // doesn't extend the chain → noise
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
// uttKey identifies which result slot a transcript belongs to (slot diffing);
// null (tests, unknown) processes the full transcript every call.
// Pipeline: slot-diff → phrase strip → ledger debit → chain. No time gate
// anywhere: an echo is rejected because it is the first occurrence of a
// token the speaker just emitted, never because of when it arrived.
function hear(transcript, uttKey = null) {
  const allTokens = (transcript || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!allTokens.length) return;
  const joined = allTokens.join(' ');

  // A multi-word transcript that is itself a fragment of a game line is all
  // game speech, whatever slot it lives in (single words are exempt — "one"
  // must not die because "one more launch" contains it).
  if (allTokens.length >= 2 && GAME_PHRASES.some((p) => p.includes(joined))) {
    voiceAudit({ heard: joined, muted, verdict: 'game-phrase' });
    return;
  }

  // Only what this slot hasn't already delivered — an echo final that
  // rewrites its interim ('five' → '5') contributes nothing; a child answer
  // appended to the echo's slot is pure new tokens.
  let tokens = slotNewTokens(uttKey, allTokens);
  if (!tokens.length) { voiceAudit({ heard: joined, muted, verdict: 'echo-final' }); return; }

  // Strip whole game lines out of merged transcripts ("counting up what
  // comes after three FOUR") and process the remainder — v16's fix, now
  // unconditional since it's content-based, not state-based.
  let rest = ` ${tokens.join(' ')} `;
  for (const p of GAME_PHRASES) {
    while (rest.includes(` ${p} `)) rest = rest.replace(` ${p} `, ' ');
  }
  const stripped = rest.split(/[^a-z0-9]+/).filter(Boolean);
  const phraseContent = stripped.length !== tokens.length;
  if (!stripped.length) { voiceAudit({ heard: joined, muted, verdict: 'game-phrase' }); return; }
  tokens = stripped;

  // Title-screen theme words. Only between rounds (no expectation armed) and
  // never while the game itself is speaking — a mid-round "dragon" must never
  // switch the world out from under an in-progress question.
  if (!muted && wanted === null && titleCommands) {
    for (const tok of tokens) {
      if (titleCommands[tok]) { voiceAudit({ heard: joined, verdict: `theme:${tok}` }); titleCommands[tok](); return; }
    }
  }

  // Ledger debit pass: the first occurrence of a token the speaker just
  // emitted is the echo — spent, dropped. Debit only with evidence this
  // delivery carries game audio: (a) the slot's FIRST tokens arrived during
  // speech, (b) game-line content rode in the same delivery, or (c) the token
  // is the answer a hint modeled for the CURRENTLY armed question (the v25
  // late-final path — a hint echo must never self-answer, marked slot or
  // fresh). Everything past the budget is the child, at zero delay.
  let contaminated = phraseContent;
  const echoProne = slotEchoProne(uttKey);
  const survivors = [];
  let debits = 0;
  for (const tok of tokens) {
    const entry = openEntry(tok);
    if (entry && !entry.spent) {
      const modelsWanted = wanted !== null && WORDS[tok] === wanted && entry.wantedAtOpen === wanted;
      if (echoProne || contaminated || modelsWanted) {
        entry.spent = true;
        debits++;
        if (entry.numClass === undefined) contaminated = true; // clip words around a number = prompt echo
        continue;
      }
    }
    survivors.push(tok);
  }

  lastFuzzy = [];
  const accepted = extractChain(survivors);
  if (accepted.length) {
    const now = Date.now();
    for (const n of accepted) pending.push({ n, t: now });
    caption(`🗣 “${joined}”  → ${accepted.join(', ')} ✓`, true);
    voiceAudit({
      heard: joined, muted, debits: debits || undefined,
      fuzzy: lastFuzzy.length ? lastFuzzy.join(' ') : undefined,
      verdict: `accepted ${accepted.join(',')}`,
    });
    drainPending();
    return;
  }
  if (debits) {
    // the delivery was (at least partly) the game's own voice coming back —
    // keep the evidence: silent drops made v23 undiagnosable.
    voiceAudit({ heard: joined, muted, debits, verdict: 'echo-debit' });
    caption(`🗣 “${joined}” · 🔇`, false);
    return;
  }
  voiceAudit({ heard: joined, muted: muted || undefined, verdict: wanted === null ? 'not-armed' : 'no-match' });
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
// recognizer hearing that phrase; __voiceMuted reports the speech-active
// status flag (clips playing + 200ms tail) the gate uses to time injections;
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

// audio.js flags when the game's own voice is audible (clips playing plus a
// 200ms recognition tail). v36: this is a STATUS, not a gate — it feeds the
// debug badge, slot echo-prone tagging, and title-command suppression; no
// transcript is ever dropped because of it. The echo ledger owns rejection.
export function setVoiceMuted(m) {
  muted = m;
  updateDot();
}
