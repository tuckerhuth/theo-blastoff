// WebKit (Safari-engine) smoke test with iPhone emulation: does the game
// start, do touch taps land, do errors fire?
import { webkit, devices } from 'playwright';

const URL = process.env.GAME_URL || 'http://127.0.0.1:8661/';
const iPhone = devices['iPhone 13'];

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...iPhone });
const page = await ctx.newPage();

const errors = [];
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const before = await page.evaluate(() => ({
  titleVisible: !document.getElementById('title').classList.contains('hidden'),
  version: !!window.__blastoff,
}));

await page.tap('#title'); // real touch tap
await page.waitForTimeout(3000);

const after = await page.evaluate(() => ({
  titleHidden: document.getElementById('title').classList.contains('hidden'),
  tiles: [...document.querySelectorAll('.tile')].map((t) => t.dataset.n),
  visibleSlots: [...document.querySelectorAll('#scene .slot')].filter((s) => s.style.display !== 'none').length,
  errBadge: document.getElementById('errBadge').textContent,
}));

// try answering the first question by touch
let answered = null;
try {
  const tile1 = await page.$('.tile[data-n="1"]');
  if (tile1) {
    await tile1.tap();
    await page.waitForTimeout(2000);
    answered = await page.evaluate(() => !!document.querySelector('#scene #slot1.lit'));
  }
} catch (e) {
  answered = 'tap failed: ' + e.message;
}

console.log(JSON.stringify({ before, after, answered, errors, logs: logs.slice(-15) }, null, 2));
await browser.close();

// Usage:
//   npm i playwright && npx playwright install webkit   (once, anywhere)
//   python3 -m http.server 8661 &                        (from the repo root)
//   node tools/webkit-test.mjs                           (or GAME_URL=https://... node tools/webkit-test.mjs)
