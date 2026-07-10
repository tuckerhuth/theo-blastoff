#!/bin/bash
# Bakes all voice clips with the macOS speech engine, from tools/phrases.txt.
# To use YOUR OWN voice instead, run ./tools/record_voice.sh — it records
# over the same filenames, and the game just plays whatever files exist.
#
# Usage: ./tools/generate_voice.sh   (regenerates every clip)

set -euo pipefail
cd "$(dirname "$0")"
OUT="../assets/voice"

VOICE="Samantha"
RATE=150          # words per minute; a touch slower than default for a 2.5yo
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Generating voice clips with $VOICE @ ${RATE}wpm..."

n=0
while IFS='|' read -r name text rate; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  say -v "$VOICE" -r "${rate:-$RATE}" -o "$TMP/$name.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$name.aiff" "$OUT/$name.m4a" >/dev/null
  echo "  $name.m4a  <- \"$text\""
  n=$((n+1))
done < phrases.txt

echo "Done. $n clips in assets/voice/"
