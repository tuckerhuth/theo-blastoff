// Gate check: js/voice.js CLIP_TEXT must stay in lockstep with the phrase
// scripts the clips are recorded from — the echo ledger can only discount
// what the speaker really says. Run by tools/verify.sh; exits nonzero on any
// drift (missing clip, extra clip, text mismatch).
//
//   node tools/check-clip-text.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (msg) => { console.error(`check-clip-text: ${msg}`); process.exitCode = 1; };

// Same normalization the recognizer pipeline applies to transcripts.
const norm = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ');

// ---- expected: parse the phrase scripts (name|text|optional-rate) ----
function parsePhrases(file, prefix) {
  const out = {};
  for (const line of readFileSync(join(root, 'tools', file), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [name, text] = t.split('|');
    if (!name || text === undefined) { fail(`${file}: unparseable line: ${t}`); continue; }
    out[`${prefix}${name}`] = norm(text);
  }
  return out;
}
const expected = {
  ...parsePhrases('phrases.txt', ''),
  ...parsePhrases('phrases-knight.txt', 'knight/'),
  ...parsePhrases('phrases-monkey.txt', 'monkey/'),
};

// ---- actual: extract the CLIP_TEXT literal from js/voice.js ----
const src = readFileSync(join(root, 'js', 'voice.js'), 'utf8');
const block = src.match(/\/\* CLIP_TEXT-BEGIN \*\/([\s\S]*?)\/\* CLIP_TEXT-END \*\//);
if (!block) { fail('CLIP_TEXT-BEGIN/END markers not found in js/voice.js'); process.exit(1); }
const actual = {};
for (const m of block[1].matchAll(/'([\w/]+)':\s*'([^']*)'/g)) actual[m[1]] = m[2];
if (!Object.keys(actual).length) { fail('no CLIP_TEXT entries parsed'); process.exit(1); }

// ---- compare ----
for (const [key, text] of Object.entries(expected)) {
  if (!(key in actual)) fail(`missing from CLIP_TEXT: '${key}' (${text})`);
  else if (actual[key] !== text) fail(`text drift for '${key}': voice.js has '${actual[key]}', phrases file says '${text}'`);
}
for (const key of Object.keys(actual)) {
  if (!(key in expected)) fail(`CLIP_TEXT has '${key}' but no phrases file defines it`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`✓ CLIP_TEXT in lockstep with phrases*.txt (${Object.keys(expected).length} clips)`);
