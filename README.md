# 🚀 Blast Off, Theo!

A counting game for a 2.5-year-old who loves watching things take off.

**Play it:** https://tuckerhuth.com/theo-blastoff/

Counting **up** loads the rocket, counting **down** launches it. The countdown
is the one place in a toddler's world where counting backwards actually means
something — and the launch he loves is the reward for getting the sequence right.

## How a round works

1. **Build** — the pad starts *empty*, and every correct answer bolts the next
   chunk of the rocket into place (1, 2, 3…). A gantry beside the rocket is a
   persistent 1–10 number line that lights up as he counts, and the big
   numeral up top always shows the last number he counted.
2. **All aboard!** — the astronaut walks out and climbs into the rocket.
3. **Countdown** — 10, 9, 8… each tap ticks the countdown, the engine rumble
   builds, the tower lights drain downward.
4. **BLAST OFF!** Smoke, shake, confetti, gone. Every round ends in a launch.
5. Three launches = **Mission Complete** → he earns a sticker for his shelf.

## How it teaches (without you)

- **It never says "wrong."** A missed tap wiggles; after two misses the right
  answer pulses; after three it glows while the others fade. Every round
  reaches the launch — the win is structurally guaranteed, the *difficulty*
  is what adapts.
- **Difficulty ladder**, separate for counting up and counting down (solo
  tiles exist only in the tutorial):
  far distractor (4 vs 9) → near distractor (7 vs 8) → three tiles → three
  near tiles. One clean round moves up a level *and* stretches the counting
  range by two; a rough round steps back down.
- **The tower is a meter, not an answer key**: only the numbers he has
  *already said this phase* are readable — everything ahead in the direction
  he's counting is a dot, and the slate wipes when the direction flips for
  the countdown. Each number he says appears and stays. (Parents can flip
  "show the tower numbers" on in the ⚙️ panel as the easy mode.)
- **Adaptive targeting**: every transition (like 8→7) is tracked. Shaky ones
  quietly get extra practice with the tempting wrong answer present.
- **First run is a tutorial**: a ghost hand plays the first step ("Watch me!"),
  then hands over ("Your turn!").
- Rainbow colors are stable per number (7 is always blue), the tiles carry
  ten-frame dot patterns, and a recorded voice counts every tap.

## Themes

Two worlds so far, picked with a tap on the title screen (🚀 rocket / 🐉
knight & dragon) or by saying "rocket", "knight", or "dragon" out loud —
the last one picked is remembered. Knight & Dragon: counting up arms a
knight piece by piece while a dragon torments the countryside; counting
down lands a sword strike each number until the final blow slays it. Its
color world shifts day → night across a mission's three launches (meadow
→ ember → twilight).

Numbers and the core prompts are shared across every theme, in whatever
voice you've recorded; each theme can override a handful of its own
flavor lines (greeting, countdown intro, victory, "one more?", goodbye).
Knight's overrides currently speak in the built-in synthetic voice —
record your own with the same tool, pointed at that theme's phrase file:

```
./tools/record_voice.sh phrases-knight.txt ../assets/voice/knight
```

## Parent panel

**The ⚙️ button, top-left.** One click with a mouse; on a touchscreen,
press and hold ~2 seconds until the green ring fills (so a mashing toddler
can't open it). You'll find:
- Per-transition first-try accuracy (spot the missing 7 healing in real time)
- **Difficulty steppers** — skip ahead or ease back the level and counting
  range for each direction (applies from the next round)
- Toggles: voice, sound effects, keyboard mode, always-mask tower numbers,
  and **🎤 say-it-out-loud mode** (experimental): with the mic on, saying the
  right number counts as a tap and gets an extra chime. Tapping always still
  works; wrong or unclear speech is simply ignored, never punished. Speech
  goes through the browser's speech service — it's off by default, and a
  pulsing 🎤 shows whenever the game is listening. Toddler speech recognition
  is genuinely hit-or-miss; if it frustrates more than it delights, toggle it
  back off.
- Replay tutorial / reset progress

## Setup on an iPad (recommended)

1. Open the URL in Safari.
2. Share button → **Add to Home Screen**. It becomes a fullscreen app with no
   browser chrome, and works offline after the first visit.
3. For full toddler-proofing, turn on **Guided Access**
   (Settings → Accessibility) so the home gesture is locked too.

## On a Mac

Works in any browser — make it fullscreen. The keyboard is swallowed
completely: no key can type, navigate, or zoom. By default "keyboard zones"
is on, which maps the left/middle/right of the keyboard to the on-screen
tiles, so mashing *plays the game*. Turn that off in the parent panel if you
want the keyboard fully inert. (The browser still owns ⌘Q/⌘W — supervise, or
ask for the kiosk-wrapper app version.)

## Recording your own voice (recommended!)

The counting voice is just audio files, and a 2.5-year-old would much rather
hear Dad than a robot. On the Mac:

```
brew install sox          # once
./tools/record_voice.sh   # ~10 minutes
```

It walks you through every phrase — Enter to record, Enter to stop, hear it
back, accept or retry — trims the silence, and saves straight into
`assets/voice/`. Re-do individual clips any time with
`./tools/record_voice.sh n7 blastoff`. When you're happy, commit and push;
the deployed game now counts in your voice. (First recording triggers the
macOS microphone permission prompt for your terminal.)

To go back to the built-in synthetic voice: `./tools/generate_voice.sh`.
The phrase list for both tools lives in `tools/phrases.txt`.

## Tech notes

Pure static HTML/CSS/JS — no build step, no framework, no runtime network
calls. Themes are data (`js/themes/rocket.js`, `js/themes/knight.js`,
registered in `js/themes/index.js`); a pirate ship or spider is one new
file conforming to the same contract. The sequence engine (`js/tasks.js`)
is generic — letters or shapes can slot in later. Local dev: any static
server, e.g. `python3 -m http.server` then open `http://localhost:8000`.

**Before deploying:** `./tools/verify.sh` — runs the scenario suite on
Chromium and WebKit (Safari's engine) at desktop and iPhone viewports
(start, full round per theme, theme switching by tap and by voice, voice
chains via the `__hear` hook, gear semantics, panel scrolling, keyboard
mash, persistence, error strip), and refuses if `sw.js`'s VERSION hasn't
been bumped past the live site. One-time setup:
`npm install && npx playwright install webkit`.
