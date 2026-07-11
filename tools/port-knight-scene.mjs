// Regenerate js/themes/knight-scene.js from the Claude Design source of
// truth (themes/knight-dragon/KnightDragonScene.dc.html — pull the latest
// from Claude Design project eef274a5-697b-4bc4-a885-8a5b6ea5ce39 first).
//
//   node tools/port-knight-scene.mjs [path/to/KnightDragonScene.dc.html]
//
// VERBATIM extraction — the v23 lesson: never re-draw the design by hand.
// Path data, transforms, inline styles and keyframes are copied character-
// for-character. The only edits are mechanical, and each one asserts it
// found its exact anchor (so a design refactor fails loudly here instead of
// silently drifting):
//   - DCLogic {{ bindings }} → data-kd handles with their initial values
//     (opacity 0, sword at rest, dragon parked offstage-left)
//   - the design's positioning <div> wrappers → nested <svg>/<g> equivalents
//     with the same offsets and div-center transform-origins
//   - house clusters tagged data-kd="shire" for the fidelity gate
//   - design-doc chrome is NOT ported (meter/cards/gear/stars/voice chip/
//     big number/banner — the game's shared UI owns those), and neither are
//     its dead keyframes (kdFig8) or chrome keyframes (kdBob/kdSpin/
//     kdBannerPop)
//   - ADAPTED (documented in knight.js): hit-spark box rides at the game's
//     battle anchor instead of the design's far-left-meter layout

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2] || 'themes/knight-dragon/KnightDragonScene.dc.html';
const OUT = 'js/themes/knight-scene.js';

const src = readFileSync(SRC, 'utf8');
const lines = src.split('\n');

const fail = (msg) => { console.error(`port-knight-scene: ${msg}`); process.exit(1); };

// Replace exactly one occurrence, loudly.
function replaceOnce(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  if (i < 0) fail(`anchor not found: ${label}\n  ${needle}`);
  if (haystack.indexOf(needle, i + 1) >= 0) fail(`anchor not unique: ${label}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

/* ---------------- keyframes ---------------- */

const KEEP_KF = ['kdFloat', 'kdFlapA', 'kdFlapB', 'kdFlick', 'kdTwinkle', 'kdSmoke', 'kdFlag'];
const kf = lines.filter((l) => KEEP_KF.some((n) => l.startsWith(`@keyframes ${n}{`)));
if (kf.length !== KEEP_KF.length) fail(`expected ${KEEP_KF.length} keyframes, found ${kf.length}`);

/* ---------------- verbatim svg blocks ---------------- */

// Inner lines of the svg element whose opening tag matches `openRe`
// (none of the extracted blocks contain a nested </svg>).
function svgInner(openRe, label) {
  const i0 = lines.findIndex((l) => openRe.test(l));
  if (i0 < 0) fail(`no svg matches ${label}`);
  const i1 = lines.findIndex((l, i) => i > i0 && l.includes('</svg>'));
  if (i1 < 0) fail(`unterminated svg: ${label}`);
  return lines.slice(i0 + 1, i1).join('\n');
}

let countryside = svgInner(/<svg viewBox="0 0 1200 640"/, 'countryside');
let dragon = svgInner(/<svg viewBox="0 0 540 360"/, 'dragon');
let spark = svgInner(/<svg viewBox="0 0 150 150"/, 'spark');
let knight = svgInner(/<svg viewBox="0 0 240 340"/, 'knight');

/* ---------------- countryside: tag the shires ---------------- */

// Every house cluster sits right after a SHIRE/burning-village comment.
{
  const out = [];
  let pendingShire = false;
  let shires = 0;
  for (const l of countryside.split('\n')) {
    if (/<!-- (SHIRE|burning village)/.test(l)) pendingShire = true;
    let line = l;
    if (pendingShire && l.trim() === '<g>') {
      line = l.replace('<g>', '<g data-kd="shire">');
      pendingShire = false;
      shires++;
    }
    out.push(line);
  }
  if (shires !== 6) fail(`expected 6 shires, tagged ${shires}`);
  countryside = out.join('\n');
}

// Tag the burning: smoke columns and flame groups get data-kd handles so the
// theme can fade them out when the dragon is slain (the kd-peace state —
// Tucker's addition, not in the design doc).
{
  let smoke = 0;
  countryside = countryside.replace(/<ellipse ([^>]*kdSmoke)/g, (m, rest) => {
    smoke++;
    return `<ellipse data-kd="smoke" ${rest}`;
  });
  if (smoke < 15) fail(`expected ≥15 smoke ellipses, tagged ${smoke}`);
  let fire = 0;
  countryside = countryside.replace(/<g style="(transform-origin:[^"]*kdFlick[^"]*)">/g, (m, style) => {
    fire++;
    return `<g data-kd="fire" style="${style}">`;
  });
  if (fire < 6) fail(`expected ≥6 flame groups, tagged ${fire}`);
  console.log(`tagged ${smoke} smoke + ${fire} flame nodes`);
}

/* ---------------- dragon: bindings → handles ---------------- */

dragon = replaceOnce(dragon,
  '<g style="{{ dragonTintStyle }}">',
  '<g data-kd="dragonTint" style="transition:filter .18s ease">',
  'dragonTint');
dragon = replaceOnce(dragon,
  '<g style="opacity:{{ painEye }};transition:opacity .1s ease">',
  '<g data-kd="painEye" style="opacity:0;transition:opacity .1s ease">',
  'painEye');
dragon = replaceOnce(dragon,
  '<g style="opacity:{{ deadEye }};transition:opacity .3s ease">',
  '<g data-kd="deadEye" style="opacity:0;transition:opacity .3s ease">',
  'deadEye');
dragon = replaceOnce(dragon,
  '<g style="opacity:{{ fireOp }};transform-origin:14px 132px;transform:rotate(-78deg) scale(2.6);transition:opacity .2s ease">',
  '<g data-kd="fireBreath" style="opacity:0;transform-origin:14px 132px;transform:rotate(-78deg) scale(2.6);transition:opacity .2s ease">',
  'fireBreath');

/* ---------------- knight: armor pieces + sword pivot ---------------- */

for (let n = 1; n <= 10; n++) {
  if (n === 9) continue; // the sword piece has no translateY in the design
  knight = replaceOnce(knight,
    `<g style="opacity:{{ a${n} }};transform:translateY({{ ty${n} }}px);transition:opacity .35s ease,transform .4s ease">`,
    `<g data-kd="armor${n}" style="opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .4s ease">`,
    `armor${n}`);
}
knight = replaceOnce(knight,
  '<g style="opacity:{{ a9 }};transition:opacity .35s ease">',
  '<g data-kd="armor9" style="opacity:0;transition:opacity .35s ease">',
  'armor9');
knight = replaceOnce(knight,
  '<g style="{{ swordJabStyle }}">',
  '<g data-kd="swordJab" style="transform:rotate(0deg);transform-origin:170px 278px;transition:transform .16s ease">',
  'swordJab');

/* ---------------- assemble the stage ---------------- */

// The design's 1200×760 canvas maps onto the game's 1000×700 viewBox with a
// single wrapper transform: translate(0,52) scale(5/6) puts the design's
// card-tray top (stage y 610) exactly on the game's GROUND_Y (560). Every
// coordinate inside is design-verbatim. Twinkle particles + celestial disc
// are the design's stage-level divs re-expressed as circles at the same
// positions (left 82/top 42 96px disc; particles at 24%/9%, 42%/15%,
// 66%/7%, 88%/13% of 1200×760).
const stage = `<g data-kd="stage" transform="translate(0,52) scale(0.8333333)">
  <defs>
    <linearGradient id="kdHorizonGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--horizon);stop-opacity:0"></stop>
      <stop offset=".42" style="stop-color:var(--horizon);stop-opacity:1"></stop>
    </linearGradient>
  </defs>
  <!-- SKY: celestial disc + twinkles -->
  <circle cx="130" cy="90" r="66" style="fill:var(--celest);opacity:.28"></circle>
  <circle cx="130" cy="90" r="48" style="fill:var(--celest);opacity:.9"></circle>
  <circle cx="288" cy="68" r="2.5" style="fill:var(--particle);animation:kdTwinkle 2.6s ease-in-out infinite"></circle>
  <circle cx="504" cy="114" r="2" style="fill:var(--particle);animation:kdTwinkle 3.1s ease-in-out .4s infinite"></circle>
  <circle cx="792" cy="53" r="2.5" style="fill:var(--particle);animation:kdTwinkle 2.2s ease-in-out .9s infinite"></circle>
  <circle cx="1056" cy="99" r="2" style="fill:var(--particle);animation:kdTwinkle 2.8s ease-in-out .6s infinite"></circle>
  <!-- COUNTRYSIDE (verbatim; overflow stays hidden like the design's svg —
       the rising smoke dissolves at the countryside's top edge) -->
  <svg x="0" y="120" width="1200" height="640" viewBox="0 0 1200 640" preserveAspectRatio="none" style="overflow:hidden">
${countryside}
  </svg>
  <!-- HORIZON + TRAY SHELF (design z3/z4; the game's tile tray sits over it) -->
  <rect x="0" y="584" width="1200" height="176" fill="url(#kdHorizonGrad)"></rect>
  <rect x="0" y="610" width="1200" height="220" style="fill:var(--tray)"></rect>
  <rect x="0" y="610" width="1200" height="3" style="fill:var(--tray-edge)"></rect>
  <!-- DRAGON (verbatim; positioning divs → g's with div-center origins) -->
  <svg x="230" y="16" width="540" height="360" viewBox="0 0 540 360" style="overflow:visible">
    <g data-kd="dragonOuter" style="transform:translate(-800px,14px) scale(0.4);transform-origin:270px 180px">
      <g data-kd="dragonRoam" style="transform:scaleX(-1);transform-origin:270px 180px">
        <g data-kd="dragonWince" style="transform-origin:270px 180px;transition:transform .14s ease">
          <g style="animation:kdFloat 4.2s ease-in-out infinite">
${dragon}
          </g>
        </g>
      </g>
    </g>
  </svg>
  <!-- HIT SPARK (box position ADAPTED to ride at the game's battle anchor) -->
  <svg x="565" y="305" width="150" height="150" viewBox="0 0 150 150" style="overflow:visible">
    <g data-kd="spark" style="opacity:0;transform:scale(0.4);transform-origin:75px 75px;transition:opacity .16s ease,transform .16s ease">
${spark}
    </g>
  </svg>
  <!-- KNIGHT (verbatim; feet on the tray top / GROUND_Y) -->
  <svg x="762" y="270" width="240" height="340" viewBox="0 0 240 340" style="overflow:visible">
${knight}
  </svg>
</g>`;

const out = `// GENERATED by tools/port-knight-scene.mjs — DO NOT hand-edit.
// Source: ${SRC} (Claude Design project
// eef274a5-697b-4bc4-a885-8a5b6ea5ce39 / KnightDragonScene.dc.html).
// To update the scene: pull the latest design file, replace the source,
// re-run the generator. Hand-editing this file is how v23 drifted.

export const KEYFRAMES = \`
${kf.join('\n')}
\`;

export const STAGE_MARKUP = \`${stage}\`;
`;

if (out.includes('{{')) fail('unresolved {{ binding }} left in output');
if (/[`\\]|\$\{/.test(stage + kf.join('\n'))) fail('markup would break the template literal');
writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${out.split('\n').length} lines, ${stage.length} bytes of stage markup`);
