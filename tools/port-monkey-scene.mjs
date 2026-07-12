// Regenerate js/themes/monkey-scene.js from the Claude Design source of truth
// (themes/monkey/ — pull the latest from Claude Design project
// fe16e7c1-b1f1-4853-bdb3-49851d87eaf1 first).
//
//   node tools/port-monkey-scene.mjs
//
// VERBATIM extraction — the knight/v23 lesson: never re-draw the design by
// hand. Path data, transforms, inline styles and keyframes are copied
// character-for-character across THREE composed design files (MonkeyScene =
// background, Monkey = the 5-pose character, Monkey Game Flow = the bananas/
// vines choreography layer). The only edits are mechanical, and each one
// asserts it found its exact anchor (so a design refactor fails loudly here
// instead of silently drifting):
//   - DCLogic {{ bindings }} and <sc-if>/<sc-for> → data-mk handles; the
//     theme (monkey.js) drives visibility/animation off those.
//   - the baked single-pose monkey + the day/night <sc-if> toggles → data-mk
//     groups the theme shows/hides per palette; the interactive Monkey
//     character (all 5 poses) is composed in from Monkey.dc.html.
//   - the baked banana bunch's 10 <use> bananas → per-banana data-mk-banana
//     wrappers the theme reveals one-by-one as the child counts.
//   - design-doc chrome is NOT ported (tiki totem, tiles, big numeral,
//     banner, demo controls — the game's shared UI owns those), nor its
//     tile/unused keyframes (mkTileA/mkTileB/mkDrop), nor the scene's
//     baked-monkey-only keyframes (mkBob/mkTail/mkBlink — that monkey is cut).
//   - ADAPTED (documented in monkey.js): the design is a hybrid (SVG scene +
//     HTML-% overlays); the game is one SVG so it scales/crops as a unit, so
//     the overlays (character, flying banana) become nested <svg>/<g> at the
//     design's positions, and the HTML-box keyframes (mkPop/mkEat/mkSwingRig)
//     are re-expressed as SVG transforms by the theme.

import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'themes/monkey';
const SCENE_SRC = `${DIR}/MonkeyScene.dc.html`;
const CHAR_SRC = `${DIR}/Monkey.dc.html`;
const FLOW_SRC = `${DIR}/Monkey Game Flow.dc.html`;
const OUT = 'js/themes/monkey-scene.js';

const fail = (msg) => { console.error(`port-monkey-scene: ${msg}`); process.exit(1); };

// Replace exactly one occurrence, loudly.
function replaceOnce(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  if (i < 0) fail(`anchor not found: ${label}\n  ${needle}`);
  if (haystack.indexOf(needle, i + 1) >= 0) fail(`anchor not unique: ${label}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

// Replace the FIRST occurrence (used where the same binding tag legitimately
// repeats — e.g. isContent tags both the arm group and the expression group).
function replaceFirst(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  if (i < 0) fail(`anchor not found: ${label}\n  ${needle}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

/* ---------------- keyframes (whitelist per file, verbatim) ---------------- */

function keyframes(src, keep, label) {
  const lines = src.split('\n');
  const found = lines
    .map((l) => l.trim())
    .filter((l) => keep.some((n) => l.startsWith(`@keyframes ${n}{`)));
  if (found.length !== keep.length) fail(`${label}: expected ${keep.length} keyframes, found ${found.length}`);
  return found;
}

// Scene sways/particles that survive the baked-monkey cut (mkBob/mkTail/mkBlink
// only drove that monkey, which we delete). Character mkb*. Flow choreography.
const KF_SCENE = ['mkSwayA', 'mkSwayB', 'mkVine', 'mkWing', 'mkFly1', 'mkFly2', 'mkTwinkle', 'mkFire', 'mkRay', 'mkGlow'];
const KF_CHAR = ['mkbBob', 'mkbBlink', 'mkbTail', 'mkbSwing', 'mkbSpark', 'mkbChompA', 'mkbChompB'];
const KF_FLOW = ['mkPop', 'mkReactA', 'mkReactB', 'mkEatA', 'mkEatB', 'mkSwingRig', 'mkVineSway', 'mkBanner', 'mkSparkle', 'mkBigPop'];

/* ---------------- verbatim svg blocks ---------------- */

// Inner lines of the FIRST svg at/after `fromRe` whose open matches `openRe`.
function svgInner(lines, openRe, label, fromRe) {
  let start = 0;
  if (fromRe) {
    start = lines.findIndex((l) => fromRe.test(l));
    if (start < 0) fail(`no line matches ${label} start`);
  }
  const i0 = lines.findIndex((l, i) => i >= start && openRe.test(l));
  if (i0 < 0) fail(`no svg matches ${label}`);
  const i1 = lines.findIndex((l, i) => i > i0 && l.includes('</svg>'));
  if (i1 < 0) fail(`unterminated svg: ${label}`);
  return lines.slice(i0 + 1, i1).join('\n');
}

const sceneSrc = readFileSync(SCENE_SRC, 'utf8');
const charSrc = readFileSync(CHAR_SRC, 'utf8');
const flowSrc = readFileSync(FLOW_SRC, 'utf8');

const kf = [
  ...keyframes(sceneSrc, KF_SCENE, 'scene'),
  ...keyframes(charSrc, KF_CHAR, 'char'),
  ...keyframes(flowSrc, KF_FLOW, 'flow'),
];

/* ---------------- BACKGROUND scene (MonkeyScene, viewBox 1200x760) ---------------- */

let scene = svgInner(sceneSrc.split('\n'), /<svg viewBox="0 0 1200 760"/, 'scene');

// Cut the baked single-pose monkey — the game overlays the interactive
// 5-pose character (composed below). Non-greedy to the block's own </g></sc-if>.
scene = scene.replace(
  /<!-- MONKEY: delight[\s\S]*?<sc-if value="\{\{ showMonkey \}\}" hint-placeholder-val="\{\{ true \}\}"><g data-mk="monkey"[\s\S]*?<\/g><\/sc-if>/,
  '<!-- baked monkey omitted: the game overlays the interactive Monkey character -->',
);
if (scene.includes('showMonkey') || scene.includes('data-mk="monkey"')) fail('baked monkey not fully removed');

// Give the night moon-craters a handle (their <g> has no data-mk of its own).
scene = replaceOnce(scene,
  '<g style="fill:var(--moon-crater,#d7e0ff);opacity:.5">',
  '<g data-mk="moon" style="fill:var(--moon-crater,#d7e0ff);opacity:.5">',
  'moon craters');

// The baked banana bunch is the interactive one: wrap each <use> so the theme
// can reveal bananas one at a time (display) and pop them (scale about the
// hang point). The stalk + banana-heart blossom paths stay always-on.
let bananaCount = 0;
scene = scene.replace(
  /<use href="#ban" data-n="(\d+)" transform="translate\((-?[\d.]+) (-?[\d.]+)\)([^"]*)"><\/use>/g,
  (m, n, x, y, rest) => {
    bananaCount++;
    return `<g data-mk-banana="${n}" style="display:none;transform-box:fill-box;transform-origin:${x}px ${y}px"><use href="#ban" transform="translate(${x} ${y})${rest}"></use></g>`;
  },
);
if (bananaCount !== 10) fail(`expected 10 bananas in the bunch, wrapped ${bananaCount}`);

// Flatten the day/night <sc-if> toggles into inert wrapper <g>s (the theme
// shows/hides the inner data-mk groups per palette). Keeps nesting intact.
scene = scene.replace(/<sc-if value="\{\{ (\w+) \}\}"[^>]*>/g, '<g data-scif="$1">');
scene = scene.replace(/<\/sc-if>/g, '</g>');

/* ---------------- CHARACTER (Monkey, viewBox 300x380, all 5 poses) ---------------- */

let character = svgInner(charSrc.split('\n'), /<svg viewBox="0 0 300 380"/, 'character');

// pose containers
character = replaceOnce(character,
  '<sc-if value="{{ isStanding }}" hint-placeholder-val="{{ true }}">',
  '<g data-mk="pose-standing">', 'pose-standing');
character = replaceOnce(character,
  '<sc-if value="{{ isSwing }}" hint-placeholder-val="{{ false }}">',
  '<g data-mk="pose-swing" style="display:none">', 'pose-swing');
// the eat chomp animation binding → a handle the theme drives
character = replaceOnce(character,
  '<g style="transform-origin:150px 189px;animation:{{ chompAnim }}">',
  '<g data-mk="chomp" style="transform-origin:150px 189px">', 'chomp');

// arms first (they precede the head), then expressions — same binding tags,
// so consume the earliest each time.
for (const [bind, name] of [['isContent', 'arms-content'], ['isDelight', 'arms-delight'], ['isCheer', 'arms-cheer'], ['isEat', 'arms-eat']]) {
  const hint = bind === 'isDelight' ? 'true' : 'false';
  character = replaceFirst(character,
    `<sc-if value="{{ ${bind} }}" hint-placeholder-val="{{ ${hint} }}">`,
    `<g data-mk="${name}"${name === 'arms-delight' ? '' : ' style="display:none"'}>`, name);
}
for (const [bind, name] of [['isContent', 'expr-content'], ['isDelight', 'expr-delight'], ['isCheer', 'expr-cheer'], ['isEat', 'expr-eat']]) {
  const hint = bind === 'isDelight' ? 'true' : 'false';
  character = replaceFirst(character,
    `<sc-if value="{{ ${bind} }}" hint-placeholder-val="{{ ${hint} }}">`,
    `<g data-mk="${name}"${name === 'expr-delight' ? '' : ' style="display:none"'}>`, name);
}
character = character.replace(/<\/sc-if>/g, '</g>');

/* ---------------- CELEBRATION VINES (Flow, viewBox 1200x760) ---------------- */

let vines = svgInner(flowSrc.split('\n'), /<svg viewBox="0 0 1200 760"/, 'celebration vines', /<!-- CELEBRATION VINES/);

// ADAPTED (wrapper-forced): the design authored these vines in their OWN
// full-frame overlay svg (inset:0, preserveAspectRatio=none), so each path's
// M{x} 0 top sat on the frame's TOP EDGE. Flattened into the game's single
// stage wrapper (translate(0,52)…), design-y 0 lands at game-y 52 — INSIDE the
// frame — so the blunt round vine-tops float mid-sky instead of descending from
// above the window. Re-anchor each vine off-screen above the top (like
// swingVine's M600 -600 in monkey.js): prepend a straight segment up to
// design-y -200 (game-y ≈ -115, clipped at the frame top), leaving the
// transform-origin at the design's y=0 hang point so the sway pivot + amplitude
// stay design-exact. The original curve data is preserved character-for-char.
let vineLift = 0;
vines = vines.replace(/d="M(\d+) 0 /g, (_m, x) => { vineLift++; return `d="M${x} -200 L${x} 0 `; });
if (vineLift !== 4) fail(`expected 4 celebration vines to re-anchor off-screen, lifted ${vineLift}`);

/* ---------------- assemble the stage ---------------- */

// Same wrapper as knight/rocket: the design's 1200x760 canvas maps onto the
// game's 1000x700 viewBox via translate(0,52) scale(5/6) — design tray-top
// (y610) lands exactly on the game GROUND_Y (560); every inner coord is
// design-verbatim. The interactive character sits where the Flow's standing
// monkey does (center 74% x, bottom 16.5% → nested svg x750 y285, w276 h349.6
// keeping the 300/380 aspect).
const stage = `<g data-mk="stage" transform="translate(0,52) scale(0.8333333)">
  <defs>
    <radialGradient id="mkVignette" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0.56" data-mk="vstop-in" style="stop-color:#080c22;stop-opacity:0"></stop>
      <stop offset="1" data-mk="vstop-out" style="stop-color:#080c22;stop-opacity:1"></stop>
    </radialGradient>
  </defs>
  <!-- BACKGROUND: MonkeyScene, verbatim (baked monkey cut; bananas + day/night now interactive) -->
${scene}
  <!-- CELEBRATION VINES (Flow; shown during the launch swing) -->
  <g data-mk="celebration-vines" style="display:none">
${vines}
  </g>
  <!-- MONKEY CHARACTER (Monkey.dc.html; all 5 poses; at the Flow's standing spot) -->
  <g data-mk="monkey-bounce" style="transform-box:fill-box;transform-origin:50% 60%">
    <svg data-mk="monkey-char" x="750" y="285" width="276" height="349.6" viewBox="0 0 300 380" style="overflow:visible">
${character}
    </svg>
  </g>
  <!-- FLYING BANANA (grabbed & eaten during the countdown) -->
  <g data-mk="flying-banana" style="display:none"><use href="#ban"></use></g>
  <!-- VIGNETTE (edge-darkening; opacity per palette via --vign-a) -->
  <rect data-mk="vignette" x="0" y="0" width="1200" height="760" fill="url(#mkVignette)" style="opacity:0;pointer-events:none"></rect>
</g>`;

/* ---------------- guards ---------------- */

if (stage.includes('{{')) fail('unresolved {{ binding }} left in output');
if (stage.includes('<sc-if') || stage.includes('</sc-if>')) fail('unconverted <sc-if> left in output');
if (/[`\\]|\$\{/.test(stage + kf.join('\n'))) fail('markup would break the template literal');

// every handle the theme queries must exist
const HANDLES = [
  'banana', 'stars', 'moon', 'celestial', 'rays', 'bg-far', 'bg-far2', 'bg-mid',
  'vines', 'tree', 'canopy-back', 'bananas', 'canopy-front', 'foreground',
  'butterflies', 'fireflies',
  'pose-standing', 'arms-content', 'arms-delight', 'arms-cheer', 'arms-eat',
  'expr-content', 'expr-delight', 'expr-cheer', 'expr-eat', 'pose-swing', 'chomp',
  'celebration-vines', 'monkey-char', 'monkey-bounce', 'flying-banana', 'vignette',
];
for (const h of HANDLES) {
  if (!stage.includes(`data-mk="${h}"`)) fail(`missing handle: ${h}`);
}
const fronds = (scene.match(/<ellipse /g) || []).length;
if (fronds < 85) fail(`expected >=85 canopy/scene ellipses (fronds), found ${fronds}`);

const out = `// GENERATED by tools/port-monkey-scene.mjs — DO NOT hand-edit.
// Source: themes/monkey/{MonkeyScene,Monkey,Monkey Game Flow}.dc.html
// (Claude Design project fe16e7c1-b1f1-4853-bdb3-49851d87eaf1).
// To update the scene: pull the latest design files, replace the sources,
// re-run the generator. Hand-editing this file is how a port drifts.

export const KEYFRAMES = \`
${kf.join('\n')}
\`;

export const STAGE_MARKUP = \`${stage}\`;
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT}: ${out.split('\n').length} lines, ${stage.length} bytes stage, ${kf.length} keyframes, ${bananaCount} bananas, ${fronds} ellipses`);
