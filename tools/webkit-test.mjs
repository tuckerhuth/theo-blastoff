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
      tutorialDone: true, levelUp: 1, levelDown: 1, seqLen: 3, roundsAtLen: 1,
      transitions: {}, stickers: [], launches: 0, missions: 0,
      settings: { voice: true, sfx: true, keyboardZones: true, showNumbers: false, micOn: false },
    };
    localStorage.setItem(KEY, JSON.stringify({ ...base, ...state }));
  }, [KEY, state]);
  await page.reload({ waitUntil: 'load' });
  await sleep(700);
}

const gameState = () => page.evaluate(() => ({
  title: !document.getElementById('title').classList.contains('hidden'),
  banner: !document.getElementById('banner').classList.contains('hidden')
    && document.getElementById('banner').textContent.includes('BLAST'),
  tiles: [...document.querySelectorAll('.tile')].map(t => +t.dataset.n),
  lit: [...document.querySelectorAll('#scene .slot.lit')].map(s => +s.id.slice(4)),
  bigSolo: !document.getElementById('bigNum').classList.contains('hidden')
    && document.getElementById('bigNum').classList.contains('solo'),
  parentOpen: !document.getElementById('parent').classList.contains('hidden'),
  err: document.getElementById('errBadge').textContent,
  launches: JSON.parse(localStorage.getItem('blastoff-theo-v1') || '{}').launches ?? 0,
}));

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
