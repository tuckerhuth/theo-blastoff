#!/bin/bash
# Bakes all voice clips for Blast Off, Theo! using the macOS speech engine.
#
# To use YOUR OWN voice instead: record a clip saying the same phrase and save
# it over the matching .m4a in assets/voice/ (same filename). The game just
# plays the files — it doesn't care who recorded them.
#
# Usage: ./tools/generate_voice.sh   (regenerates every clip)

set -euo pipefail
cd "$(dirname "$0")/../assets/voice"

VOICE="Samantha"
RATE=150          # words per minute; a touch slower than default for a 2.5yo
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

gen() { # gen <name> <text> [rate]
  local name="$1" text="$2" rate="${3:-$RATE}"
  say -v "$VOICE" -r "$rate" -o "$TMP/$name.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$name.aiff" "$name.m4a" >/dev/null
  echo "  $name.m4a  <- \"$text\""
}

echo "Generating voice clips with $VOICE @ ${RATE}wpm..."

# The numbers — the heart of the game
gen n1  "One!"
gen n2  "Two!"
gen n3  "Three!"
gen n4  "Four!"
gen n5  "Five!"
gen n6  "Six!"
gen n7  "Seven!"
gen n8  "Eight!"
gen n9  "Nine!"
gen n10 "Ten!"

# Phrases
gen hello     "Captain Theo! Time to build your rocket!"
gen countup   "Let's count up!"
gen countdown "Now, let's count down to blast off!"
gen whatnext  "What comes next?"
gen watchme   "Watch me!"
gen yourturn  "Your turn!"
gen ready     "Ready?"
gen blastoff  "Blast off!" 130
gen great1    "Great counting, Captain Theo!"
gen great2    "Hooray! You did it!"
gen great3    "Amazing counting!"
gen mission   "Mission complete! You earned a sticker!"
gen onemore   "One more launch?"
gen alldone   "Great flying, Captain Theo! See you next time!"
gen taptoplay "Tap to play!"

echo "Done. $(ls -1 *.m4a | wc -l | tr -d ' ') clips in assets/voice/"
