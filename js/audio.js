// Audio: pre-baked voice clips (assets/voice/*.m4a) + synthesized sound effects.
// Everything hangs off one AudioContext created on the first user gesture
// (required by iOS Safari).

import { store } from './store.js';
import { setVoiceMuted, noteGameSpeech, voiceAudit } from './voice.js';

const CLIPS = [
  'n1','n2','n3','n4','n5','n6','n7','n8','n9','n10',
  'after1','after2','after3','after4','after5','after6','after7','after8','after9','after10',
  'hello','countup','countdown','whatnext','whatfirst','notquite','countingup','countingdown',
  'watchme','yourturn','ready',
  'blastoff','great1','great2','great3','mission','onemore','alldone','taptoplay',
  'allaboard',
];

// Per-theme voice-pack overrides: clip names a theme speaks in its own
// flavor (e.g. knight's "hello"/"blastoff" lines), stored at
// assets/voice/<theme>/<name>.m4a. Every clip NOT listed here is shared
// across all themes at assets/voice/<name>.m4a (numbers, afterN, etc.) —
// listing a theme with an empty set (rocket) is a no-op, kept for symmetry.
const PACK_OVERRIDES = {
  rocket: new Set(),
  knight: new Set(['hello', 'countdown', 'allaboard', 'blastoff', 'great1', 'onemore', 'alldone']),
};

let voicePack = 'rocket';

// Cache key / URL for a clip name, resolved against the ACTIVE pack at call
// time (never baked in early) — a pack switch never serves a stale voice.
function clipKey(name) {
  return PACK_OVERRIDES[voicePack]?.has(name) ? `${voicePack}/${name}` : name;
}
function clipUrl(name) {
  return `assets/voice/${clipKey(name)}.m4a`;
}

let ctx = null;
let master = null;
const buffers = new Map();  // keyed by clipKey(name), NOT the bare clip name
let currentSpeech = null;   // { stop() } — so a new line can cut off the old one
let lastSpoken = [];        // clip names of the speech now/last playing (for hush re-stamp)
let rumbleNodes = null;

// Rolling audit of what the voice actually said, and when. Exposed as
// window.__speechLog so a stray clip (e.g. a hint speaking "ten" after
// blast off) can be traced to what played just before it.
const speechLog = [];
function logSpeech(name) {
  speechLog.push({ name, t: Date.now() });
  if (speechLog.length > 60) speechLog.shift();
  voiceAudit({ clip: name }); // interleave clips with heard-transcript verdicts
}
if (typeof window !== 'undefined') {
  window.__speechLog = speechLog;
  // Test hook (harmless in prod): drive a real speak() — including its mute
  // window and unmute tail — so the gate can inject __hear() at exact points
  // of the speech timeline instead of racing the idle-prompt ladder.
  window.__speak = (names) => speak(names);
}

export function audioReady() { return !!ctx; }
export function audioState() { return ctx ? ctx.state : 'none'; } // parent-panel health line

// Call from inside the first tap handler. Never blocks: if this gesture
// can't unlock audio (iOS accepts some gesture types and not others), the
// unlock listeners below catch the next one.
export async function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  for (const ev of ['touchend', 'pointerup', 'click']) {
    window.addEventListener(ev, () => {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }, { passive: true });
  }
  // Load voice clips in the background; speak() waits per-clip as needed.
  for (const name of CLIPS) loadClip(name);
}

function loadClip(name) {
  const key = clipKey(name);
  if (buffers.has(key)) return;
  fetch(clipUrl(name))
    .then(r => r.ok ? r.arrayBuffer() : Promise.reject())
    .then(ab => ctx.decodeAudioData(ab))
    .then(buf => buffers.set(key, buf))
    .catch(() => buffers.set(key, null)); // missing clip: speak() skips it
}

// Called when the active theme (and its voice pack) changes at the title
// screen. Kicks background loads for that pack's override clips that
// aren't cached yet; shared clips are already loaded from initAudio and
// never need re-fetching.
export function setVoicePack(name) {
  voicePack = name;
  if (!ctx) return;
  for (const clipName of PACK_OVERRIDES[voicePack] || []) loadClip(clipName);
}

function clipReady(name) {
  const key = clipKey(name);
  if (buffers.has(key)) return Promise.resolve();
  return new Promise(res => {
    const t = setInterval(() => { if (buffers.has(key)) { clearInterval(t); res(); } }, 60);
    setTimeout(() => { clearInterval(t); res(); }, 4000); // give up quietly
  });
}

export function numClip(n) { return `n${n}`; }

// speak('whatnext') or speak(['ready','n3'], {gap:0.12}). Interrupts prior
// speech; skipIfBusy drops the line instead (for redundant prompts).
export async function speak(names, { gap = 0.08, interrupt = true, skipIfBusy = false } = {}) {
  if (!ctx || !store.data.settings.voice) return;
  if (skipIfBusy && currentSpeech) return;
  const list = Array.isArray(names) ? names : [names];
  if (interrupt && currentSpeech) currentSpeech.stop();

  const sources = [];
  let cancelled = false;
  currentSpeech = { stop() { cancelled = true; sources.forEach(s => { try { s.stop(); } catch {} }); } };
  const mine = currentSpeech;
  setVoiceMuted(true); // the mic must not hear the game count to itself
  noteGameSpeech(list); // so late-arriving echo transcripts get discounted
  lastSpoken = list;

  for (const name of list) {
    if (cancelled) return;
    await clipReady(name);
    const buf = buffers.get(clipKey(name));
    if (!buf || cancelled) continue;
    await new Promise(res => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      sources.push(src);
      src.onended = res;
      src.start();
      logSpeech(name);
      setTimeout(res, buf.duration * 1000 + 300); // safety net
    });
    // Echo windows measure from when a clip's AUDIO ends, not when the
    // sequence started — re-stamp so voice.js guards track real sound and
    // neither expire mid-clip nor over-block after short clips.
    noteGameSpeech([name]);
    if (gap) await new Promise(res => setTimeout(res, gap * 1000));
  }
  if (currentSpeech === mine) {
    currentSpeech = null;
    // tail: recognition results arrive well after the audio they transcribe
    setTimeout(() => { if (!currentSpeech) setVoiceMuted(false); }, 700);
  }
}

// Cut off whatever the game is currently saying. Called when the child
// answers (tap or voice) so a prompt/hint never talks over — or trails
// past — their response. No-op if nothing is playing.
export function hushSpeech() {
  if (!currentSpeech) return;
  currentSpeech.stop();
  currentSpeech = null;
  logSpeech('(hushed)');
  noteGameSpeech(lastSpoken); // the audio stopped NOW — echo windows anchor here
  // Same recognition-lag tail as a natural finish, so a late echo of the
  // clip we just cut doesn't get treated as the child speaking.
  setTimeout(() => { if (!currentSpeech) setVoiceMuted(false); }, 700);
}

/* ---------------- synthesized SFX ---------------- */

function env(node, t0, attack, peak, decay) {
  node.gain.setValueAtTime(0, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + attack);
  node.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
}

function tone({ freq, freqEnd, type = 'sine', dur = 0.2, peak = 0.2, when = 0 }) {
  if (!ctx || !store.data.settings.sfx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  env(g, t0, 0.012, peak, dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.1);
}

function noiseBuffer(seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {           // brown-ish noise: deeper, less hissy
    const white = Math.random() * 2 - 1;
    last = (last + 0.03 * white) / 1.03;
    d[i] = last * 3.5;
  }
  return buf;
}

export const sfx = {
  press()  { tone({ freq: 420, type: 'triangle', dur: 0.08, peak: 0.12 }); },

  thunk()  {
    tone({ freq: 170, freqEnd: 65, type: 'sine', dur: 0.16, peak: 0.35 });
    tone({ freq: 900, type: 'square', dur: 0.03, peak: 0.05 });
  },

  softNo() { // gentle "hmm" — never harsh
    tone({ freq: 300, type: 'sine', dur: 0.14, peak: 0.1 });
    tone({ freq: 250, type: 'sine', dur: 0.18, peak: 0.1, when: 0.14 });
  },

  steps(n = 7, gap = 0.27) { // little footsteps for the boarding walk
    for (let i = 0; i < n; i++) {
      tone({ freq: 230 + (i % 2) * 34, type: 'sine', dur: 0.05, peak: 0.07, when: i * gap });
    }
  },

  chime()  {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.45, peak: 0.14, when: i * 0.085 }));
  },

  fanfare() {
    [392, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, peak: 0.15, when: i * 0.11 }));
    [523, 659, 784, 1046].forEach(f => tone({ freq: f, type: 'triangle', dur: 1.4, peak: 0.09, when: 0.62 }));
  },

  tick(n)  { // countdown tick, more tension as n approaches 1
    const f = 500 + (10 - n) * 40;
    tone({ freq: f, type: 'square', dur: 0.07, peak: 0.08 });
    tone({ freq: f / 2, type: 'sine', dur: 0.12, peak: 0.12 });
  },

  whoosh() {
    if (!ctx || !store.data.settings.sfx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(180, t0);
    bp.frequency.exponentialRampToValueAtTime(3200, t0 + 1.3);
    const g = ctx.createGain();
    env(g, t0, 0.06, 0.95, 1.45); // loud — the launch payoff; must carry on iPad speakers
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0);
  },

  rumbleStart() {
    if (!ctx || !store.data.settings.sfx || rumbleNodes) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.5);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start();
    rumbleNodes = { src, g, lp };
  },

  rumbleLevel(x) { // 0..1
    if (!rumbleNodes) return;
    rumbleNodes.g.gain.linearRampToValueAtTime(0.55 * x, ctx.currentTime + 0.25);
    rumbleNodes.lp.frequency.linearRampToValueAtTime(110 + 160 * x, ctx.currentTime + 0.25);
  },

  rumbleStop(fade = 0.6) {
    if (!rumbleNodes) return;
    const { src, g } = rumbleNodes;
    rumbleNodes = null;
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    setTimeout(() => { try { src.stop(); } catch {} }, fade * 1000 + 100);
  },
};
