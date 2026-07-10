# 🚀 Blast Off, Theo!

A counting game for a 2.5-year-old who loves watching things take off.

**Play it:** https://tuckerhuth.com/theo-blastoff/

Counting **up** loads the rocket, counting **down** launches it. The countdown
is the one place in a toddler's world where counting backwards actually means
something — and the launch he loves is the reward for getting the sequence right.

## How a round works

1. **Build** — numbered cargo crates load onto the rocket in order (1, 2, 3…).
   A gantry beside the rocket is a persistent 1–10 number line that lights up
   as he counts.
2. **Countdown** — 10, 9, 8… each tap ticks the countdown, the engine rumble
   builds, the tower lights drain downward.
3. **BLAST OFF!** Smoke, shake, confetti, gone. Every round ends in a launch.
4. Three launches = **Mission Complete** → he earns a sticker for his shelf.

## How it teaches (without you)

- **It never says "wrong."** A missed tap wiggles; after two misses the right
  answer pulses; after three it glows while the others fade. Every round
  reaches the launch — the win is structurally guaranteed, the *difficulty*
  is what adapts.
- **Difficulty ladder**, separate for counting up and counting down:
  solo tile → far distractor (4 vs 9) → near distractor (7 vs 8) → three tiles.
  Two clean rounds moves up a level; a rough round steps back down.
  Sequences start short (1–5) and stretch to the full 1–10.
- **Adaptive targeting**: every transition (like 8→7) is tracked. Shaky ones
  quietly get extra practice with the tempting wrong answer present.
- **First run is a tutorial**: a ghost hand plays the first step ("Watch me!"),
  then hands over ("Your turn!").
- Rainbow colors are stable per number (7 is always blue), the tiles carry
  ten-frame dot patterns, and a recorded voice counts every tap.

## Parent panel

**Press and hold the top-left corner for 3 seconds.** You'll find:
- Per-transition first-try accuracy (spot the missing 7 healing in real time)
- Toggles: voice, sound effects, keyboard mode
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

## Recording your own voice

The counting voice is just audio files. Record yourself saying each phrase in
`tools/generate_voice.sh` and save over the matching file in `assets/voice/`
(same name, .m4a). Done — the game now counts in your voice.
To regenerate the built-in voice: `./tools/generate_voice.sh`.

## Tech notes

Pure static HTML/CSS/JS — no build step, no framework, no runtime network
calls. Themes are data (`js/themes/rocket.js`); a pirate ship or dragon is one
new file. The sequence engine (`js/tasks.js`) is generic — letters or shapes
can slot in later. Local dev: any static server, e.g.
`python3 -m http.server` then open `http://localhost:8000`.
