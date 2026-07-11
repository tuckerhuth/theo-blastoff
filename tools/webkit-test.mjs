// Blast Off, Theo! — cross-engine scenario suite.
//
//   node tools/webkit-test.mjs --engine=webkit --device=iphone [--url=http://127.0.0.1:8672/]
//
// Engines: webkit (Safari's engine) | chromium (uses installed Chrome).
// Devices: iphone (touch, iPhone 13 emulation) | desktop (mouse, 1280×800).
// Run every combo via tools/verify.sh — the pre-deploy gate.
//
// Needs: npm install (playwright dev-dep) + npx playwright install webkit.

import { webkit, chromium, devices } from 'playwright';

const arg = (name, dflt) => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1] || dflt;
const ENGINE = arg('engine', 'webkit');
const DEVICE = arg('device', 'iphone');
const URL = arg('url', 'http://127.0.0.1:8672/');

const KEY = 'blastoff-theo-v1';
const results = [];
const consoleErrors = [];
const pageErrors = [];
let bannerWord = 'BLAST'; // per-theme finale word; knight scenarios swap this to 'VICTORY'

const browser = ENGINE === 'chromium'
  ? await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  : await webkit.launch();
const context = await browser.newContext(
  DEVICE === 'iphone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const TOUCH = DEVICE === 'iphone';

page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => { if (!String(e).includes('suite-test')) pageErrors.push(String(e)); });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tapSel = async (sel) => (TOUCH ? page.tap(sel) : page.click(sel));

// synthetic pointer with explicit pointerType (for gear-hold semantics)
const pointer = (sel, type, kind) => page.evaluate(([sel, type, kind]) => {
  document.querySelector(sel).dispatchEvent(
    new PointerEvent(kind, { isPrimary: true, bubbles: true, pointerType: type }));
}, [sel, type, kind]);

async function fresh(state = {}) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(([KEY, state]) => {
    localStorage.clear();
    const base = {
      theme: 'rocket', tutorialDone: true, levelUp: 1, levelDown: 1, seqLen: 3, roundsAtLen: 1,
      transitions: {}, stickers: [], launches: 0, missions: 0,
      settings: { voice: true, sfx: true, keyboardZones: true, showNumbers: false, micOn: false },
    };
    localStorage.setItem(KEY, JSON.stringify({ ...base, ...state }));
  }, [KEY, state]);
  await page.reload({ waitUntil: 'load' });
  await sleep(700);
}

const gameState = () => page.evaluate((word) => ({
  title: !document.getElementById('title').classList.contains('hidden'),
  banner: !document.getElementById('banner').classList.contains('hidden')
    && document.getElementById('banner').textContent.includes(word),
  tiles: [...document.querySelectorAll('.tile')].map(t => +t.dataset.n),
  lit: [...document.querySelectorAll('#scene .slot.lit')].map(s => +s.id.slice(4)),
  bigSolo: !document.getElementById('bigNum').classList.contains('hidden')
    && document.getElementById('bigNum').classList.contains('solo'),
  parentOpen: !document.getElementById('parent').classList.contains('hidden'),
  err: document.getElementById('errBadge').textContent,
  launches: JSON.parse(localStorage.getItem('blastoff-theo-v1') || '{}').launches ?? 0,
}), bannerWord);

// answer whatever question is currently up (the perfect-Theo heuristic)
async function answerOnce() {
  const move = await page.evaluate(() => {
    const big = document.getElementById('bigNum');
    if (!big.classList.contains('hidden') && big.classList.contains('solo')) return { kind: 'big' };
    const tiles = [...document.querySelectorAll('.tile')];
    if (!tiles.length) return null;
    const lit = [...document.querySelectorAll('#scene .slot.lit')].map(s => +s.id.slice(4));
    const down = [...document.querySelectorAll('#scene text')].some(t => t.textContent === '⬇️');
    const expected = down ? Math.max(...lit) : (lit.length ? Math.max(...lit) + 1 : 1);
    const idx = tiles.findIndex(t => +t.dataset.n === expected);
    return idx >= 0 ? { kind: 'tile', idx } : null;
  });
  if (!move) return false;
  if (move.kind === 'big') await tapSel('#bigNum');
  else await (TOUCH ? page.tap(`.tile >> nth=${move.idx}`) : page.click(`.tile >> nth=${move.idx}`));
  return true;
}

async function playUntilBanner(timeoutMs = 45000, answer = true) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await gameState()).banner) return true;
    if (answer) await answerOnce();
    await sleep(450);
  }
  return false;
}

async function scenario(name, fn) {
  try {
    const ok = await fn();
    results.push({ name, ok: !!ok });
  } catch (e) {
    results.push({ name, ok: false, error: String(e).slice(0, 200) });
  }
}

/* ---------------- scenarios ---------------- */

await scenario('start', async () => {
  await fresh();
  await tapSel('#title');
  await sleep(1500);
  return !(await gameState()).title;
});

await scenario('full round by taps → BLAST OFF', () => playUntilBanner());

await scenario('knight: full round by taps → VICTORY', async () => {
  await fresh({ theme: 'knight' });
  const dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  if (dataTheme !== 'knight') return false;
  await tapSel('#title');
  bannerWord = 'VICTORY';
  try {
    const done = await playUntilBanner();
    if (!done) return false;
    // launches++ runs only after the full launch animation + praise audio
    // (~4-6s past the banner) — poll rather than guess the delay, same
    // lesson as "late levels reach a full count of 10" below.
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      if ((await gameState()).launches >= 1) return true;
      await sleep(500);
    }
    return false;
  } finally {
    bannerWord = 'BLAST';
  }
});

await scenario('knight scene structure matches the design source', async () => {
  // Guards against re-simplification: the scene must carry the design's
  // actual art density (burning shires, smoke columns, full dragon/knight
  // rigs), not a redrawn approximation — the v23 rejection. Structural
  // only (no timing/pixels): counts + the choreography handles knight.js
  // drives. Numbers trace to the design source: 141 verbatim paths / 84
  // rects / 6 house clusters / 20+ kdSmoke columns.
  await fresh({ theme: 'knight' });
  return page.evaluate(() => {
    const svg = document.querySelector('#scene svg');
    if (!svg || svg.getAttribute('data-theme') !== 'knight') return false;
    const paths = svg.querySelectorAll('path').length;
    const rects = svg.querySelectorAll('rect').length;
    const shires = svg.querySelectorAll('[data-kd="shire"]').length;
    const smoke = [...svg.querySelectorAll('ellipse')]
      .filter((e) => (e.getAttribute('style') || '').includes('kdSmoke')).length;
    const handles = ['dragonOuter', 'dragonRoam', 'dragonWince', 'dragonTint', 'painEye',
      'deadEye', 'fireBreath', 'swordJab', 'spark',
      ...Array.from({ length: 10 }, (_, i) => `armor${i + 1}`)]
      .every((k) => svg.querySelector(`[data-kd="${k}"]`));
    return paths >= 130 && rects >= 75 && shires >= 6 && smoke >= 15 && handles;
  });
});

await scenario('theme cards: switch without starting + persistence', async () => {
  await fresh(); // rocket
  await tapSel('.theme-card[data-theme="knight"]');
  await sleep(300);
  const afterTap = await gameState();
  if (!afterTap.title) return false; // a card tap must never start the game
  let dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  if (dataTheme !== 'knight') return false;
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('blastoff-theo-v1')).theme);
  if (stored !== 'knight') return false;

  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  if (dataTheme !== 'knight') return false; // survived reload

  await tapSel('.theme-card[data-theme="rocket"]');
  await sleep(300);
  dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  return dataTheme === 'rocket';
});

await scenario('voice theme switch at title only', async () => {
  await fresh(); // rocket
  await page.evaluate(() => { window.__hear('dragon'); });
  await sleep(250);
  let dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  if (dataTheme !== 'knight' || !(await gameState()).title) return false;

  await page.evaluate(() => { window.__hear('rocket'); });
  await sleep(250);
  dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  if (dataTheme !== 'rocket') return false;

  // mid-round: a stray "dragon" must be refused
  await tapSel('#title');
  await sleep(1200);
  await page.evaluate(() => { window.__hear('dragon'); });
  await sleep(300);
  dataTheme = await page.evaluate(() => document.querySelector('#scene svg')?.getAttribute('data-theme'));
  return dataTheme === 'rocket';
});

await scenario('voice chain: interim dedup + prompt contamination + digit-runs', async () => {
  await fresh({ seqLen: 5 });
  await tapSel('#title');
  await page.waitForSelector('.tile', { timeout: 8000 });
  await sleep(200);
  let s = await gameState();
  const litReaches = async (n, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms && !(s.lit.length >= n || s.bigSolo)) { await sleep(300); s = await gameState(); }
    return s.lit.length >= n || s.bigSolo;
  };
  // growing interim transcripts — each number must land exactly once
  await page.evaluate(() => { window.__hear('one'); });
  await page.evaluate(() => { window.__hear('one two'); });
  await page.evaluate(() => { window.__hear('one two three'); });
  // build (1..3) drains as animations catch up
  if (!(await litReaches(3, 12000))) return false;
  // the phrase-strip path only runs un-muted — wait out the game's own
  // speech (while muted, STRICT_WORDS would accept the 4 vacuously)
  const tMute = Date.now();
  while (Date.now() - tMute < 10000 && await page.evaluate(() => window.__voiceMuted())) await sleep(250);
  if (await page.evaluate(() => window.__voiceMuted())) return false;
  // expecting 4: recognition lag merged the game's own prompt with the
  // answer into one transcript — v15's filter killed the whole thing; the
  // 4 inside must survive, and the echoed 3 must NOT re-land (chain guard)
  await page.evaluate(() => { window.__hear('counting up what comes after three four'); });
  if (!(await litReaches(4, 8000))) return false;
  if (s.lit.length !== 4) return false; // exactly 4 — nothing double-counted
  // expecting 5: "4 5" merged into one numeric token (the "65" problem,
  // build direction) — reads as 4,5 and only the chain-extending 5 lands
  await page.evaluate(() => { window.__hear('45'); });
  if (!(await litReaches(5, 8000))) return false;
  // CARRYOVER regression: the build ends on 5 and the countdown STARTS on 5.
  // A late echo of "five" (recognition lag from finishing the build) arrives
  // during boarding — it must NOT carry over and auto-fire the countdown
  // anchor. The anchor has to wait and ask "what comes first?".
  await page.evaluate(() => { window.__hear('five'); }); // stray echo, must be ignored
  // the countdown anchor arms as the solo big number and STAYS there
  const t1 = Date.now(); let armed = false;
  while (Date.now() - t1 < 12000) { s = await gameState(); if (s.bigSolo) { armed = true; break; } await sleep(300); }
  if (!armed) return false;                       // anchor never appeared
  await sleep(700); s = await gameState();
  if (!s.bigSolo) return false;                   // it auto-advanced — the echo skipped the anchor
  // now Theo actually answers the anchor, then voice carries the rest down:
  // "5" (anchor) → "4 3" → "2 1" arriving as the single token "21" (must be
  // read as 2,1, never twenty-one)
  await page.evaluate(() => { window.__hear('five'); });
  await page.evaluate(() => { window.__hear('four three'); });
  await page.evaluate(() => { window.__hear('21'); });
  return playUntilBanner(25000, false); // watch only — voice must carry it
});

await scenario('voice during game speech: homophones land, game words never', async () => {
  await fresh({ seqLen: 5 });
  await tapSel('#title');
  await page.waitForSelector('.tile', { timeout: 8000 });
  await sleep(200);
  let s = await gameState();
  const litReaches = async (n, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms && s.lit.length < n) { await sleep(300); s = await gameState(); }
    return s.lit.length >= n;
  };
  await page.evaluate(() => { window.__hear('one'); });
  if (!(await litReaches(1, 8000))) return false;

  // REGRESSION: a game phrase heard mid-speech must never count. "time TO
  // build" carries a homophone of the expected 2 — it has to stay dead.
  const mutedAtPhrase = await page.evaluate(() => {
    window.__speak(['countingup', 'after1']); // mutes synchronously
    window.__hear('captain theo time to build your rocket');
    return window.__voiceMuted();
  });
  if (!mutedAtPhrase) return false; // validity: injection really was mid-speech
  await sleep(1200);
  s = await gameState();
  if (s.lit.length !== 1) return false; // 'to' answered the game's own prompt

  await page.evaluate(() => { window.__hear('two'); });
  if (!(await litReaches(2, 8000))) return false;

  // DURING SPEECH: expecting 3, the recognizer transcribes Theo's "three"
  // as the homophone "free" while the game is mid-prompt. It must land —
  // dropping it was the v23 playtest bug ("he said the right answer during
  // the prompt and nothing happened").
  const mutedAtFree = await page.evaluate(() => {
    window.__speak(['countingup', 'after2']);
    window.__hear('free');
    return window.__voiceMuted();
  });
  if (!mutedAtFree) return false;
  if (!(await litReaches(3, 8000))) return false;

  // UNMUTE TAIL: expecting 4, "for" arrives in the 700ms post-clip window
  // (recognition lag) — still muted, must still land.
  const mutedAtFor = await page.evaluate(async () => {
    await window.__speak(['after3']); // resolves at clip end, before the tail unmute
    const m = window.__voiceMuted();
    window.__hear('for');
    return m;
  });
  if (!mutedAtFor) return false;
  return litReaches(4, 8000);
});

await scenario('voice hint echo: game\'s own number blocked, Theo\'s repeat lands', async () => {
  await fresh({ seqLen: 5 });
  await tapSel('#title');
  await page.waitForSelector('.tile', { timeout: 8000 });
  await sleep(200);
  let s = await gameState();
  const litReaches = async (n, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms && s.lit.length < n) { await sleep(300); s = await gameState(); }
    return s.lit.length >= n;
  };
  for (const w of ['one', 'two', 'three', 'four']) {
    await page.evaluate((w) => { window.__hear(w); }, w);
  }
  if (!(await litReaches(4, 15000))) return false;

  // The game models the answer (rung-3 hint / countdown solo prompt speaks
  // "five"). Its own echo through the speakers must NOT answer for Theo...
  await page.evaluate(() => {
    window.__speak(['n5']);
    window.__hear('five'); // speaker echo, mid-clip
  });
  await sleep(900);
  s = await gameState();
  if (s.lit.length !== 4) return false; // the game answered its own hint

  // ...but Theo repeating the modeled number right after IS the point of
  // the hint (call-and-response). Half a second past the unmute it must land.
  const t0 = Date.now();
  while (Date.now() - t0 < 5000 && await page.evaluate(() => window.__voiceMuted())) await sleep(100);
  if (await page.evaluate(() => window.__voiceMuted())) return false;
  await sleep(500);
  await page.evaluate(() => { window.__hear('five'); });
  return litReaches(5, 8000);
});

await scenario('voice echo finals: muted-born utterance blocked, fresh one instant', async () => {
  // The July 11 playtest sequence, verbatim: the hint's speaker echo posts
  // its FINAL transcript ~1s after the clip ends — after the unmute — and
  // must stay blocked because its UTTERANCE began during the speech; the
  // child's answer is a fresh utterance and must land with NO cooldown at
  // all (v24's post-end time windows ate real answers here).
  await fresh({ seqLen: 5 });
  await tapSel('#title');
  await page.waitForSelector('.tile', { timeout: 8000 });
  await sleep(200);
  let s = await gameState();
  const litReaches = async (n, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms && s.lit.length < n) { await sleep(300); s = await gameState(); }
    return s.lit.length >= n;
  };
  for (const w of ['one', 'two', 'three', 'four']) {
    await page.evaluate((w) => { window.__hear(w); }, w);
  }
  if (!(await litReaches(4, 15000))) return false;

  // hint plays "five"; the echo's interim arrives mid-clip on utterance echo:1
  const mutedAt = await page.evaluate(() => {
    window.__speak(['n5']);
    window.__hear('five', 'echo:1');
    return window.__voiceMuted();
  });
  if (!mutedAt) return false;
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && await page.evaluate(() => window.__voiceMuted())) await sleep(100);
  if (await page.evaluate(() => window.__voiceMuted())) return false;

  // the echo's FINAL posts post-unmute on the SAME utterance → still blocked
  await page.evaluate(() => { window.__hear('five', 'echo:1'); });
  await sleep(700);
  s = await gameState();
  if (s.lit.length !== 4) return false; // the echo final answered the hint

  // the child's answer — a NEW utterance — lands immediately
  await page.evaluate(() => { window.__hear('five', 'child:1'); });
  return litReaches(5, 8000);
});

await scenario(TOUCH ? 'gear: touch hold (0.7s no, 2.2s yes)' : 'gear: mouse click opens instantly', async () => {
  await fresh();
  if (!TOUCH) {
    await pointer('#parentBtn', 'mouse', 'pointerdown');
    await sleep(250);
    const open = (await gameState()).parentOpen;
    await page.click('#btnCloseParentX');
    return open;
  }
  await pointer('#parentBtn', 'touch', 'pointerdown');
  await sleep(700);
  const early = (await gameState()).parentOpen;
  await pointer('#parentBtn', 'touch', 'pointerup');
  if (early) return false;
  await pointer('#parentBtn', 'touch', 'pointerdown');
  await sleep(2300);
  return (await gameState()).parentOpen;
});

if (TOUCH) {
  await scenario('parent panel scrolls and closes on touch', async () => {
    if (!(await gameState()).parentOpen) {
      await pointer('#parentBtn', 'touch', 'pointerdown');
      await sleep(2300);
    }
    const scrolled = await page.evaluate(() => {
      const inner = document.querySelector('.parent-inner');
      inner.scrollTop = 150;
      return new Promise(res => setTimeout(() => res(inner.scrollTop), 300));
    });
    if (scrolled < 100) return false; // the toddler scroll-lock wrongly reset the panel
    await page.tap('#btnCloseParentX');
    await sleep(200);
    return !(await gameState()).parentOpen;
  });
}

await scenario('keyboard mash changes nothing', async () => {
  await fresh();
  const before = page.url();
  await page.evaluate(() => {
    const keys = ['a','q','p','z','m','1','9','0',' ','Enter','Escape','Tab','F5','ArrowLeft','Backspace','/'];
    for (let i = 0; i < 130; i++) {
      const k = keys[i % keys.length];
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
    }
  });
  const s = await gameState();
  return page.url() === before && !s.parentOpen;
});

await scenario('late levels reach a full count of 10', async () => {
  // (Audio behavior — no arm-time prompt, no per-answer echo — is not
  // assertable headlessly; this covers the range rule.)
  await fresh({ levelUp: 3, levelDown: 3, seqLen: 5 });
  await tapSel('#title');
  const done = await playUntilBanner(60000);
  if (!done) return false;
  // afterRound runs only after the full launch animation + praise (~6s
  // past the banner) — poll rather than guess the delay
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    const seqLen = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('blastoff-theo-v1')).seqLen);
    if (seqLen === 10) return true;
    await sleep(500);
  }
  return false;
});

await scenario('state persists across reload', async () => {
  const launches = (await gameState()).launches;
  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  const s = await gameState();
  return s.title && s.launches === launches;
});

await scenario('error strip reports uncaught errors', async () => {
  await page.evaluate(() => { Promise.reject(new Error('suite-test')); });
  await sleep(400);
  const text = await page.evaluate(() => document.getElementById('errBadge').textContent);
  const visible = await page.evaluate(() => !document.getElementById('errBadge').classList.contains('hidden'));
  await page.evaluate(() => document.getElementById('errBadge').classList.add('hidden'));
  return visible && text.includes('suite-test');
});

/* ---------------- report ---------------- */

const failed = results.filter(r => !r.ok);
if (consoleErrors.length) failed.push({ name: 'console errors', error: consoleErrors.slice(0, 3).join(' | ') });
if (pageErrors.length) failed.push({ name: 'page errors', error: pageErrors.slice(0, 3).join(' | ') });

for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
if (consoleErrors.length || pageErrors.length) {
  console.log(`  ✗ errors: ${[...consoleErrors, ...pageErrors].slice(0, 4).join(' | ')}`);
}
console.log(failed.length ? `FAIL (${ENGINE}/${DEVICE}): ${failed.length} problem(s)` : `PASS (${ENGINE}/${DEVICE})`);

await browser.close();
process.exit(failed.length ? 1 : 0);
