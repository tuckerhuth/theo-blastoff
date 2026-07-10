#!/bin/bash
# Bakes all voice clips with the macOS speech engine, from a phrases file.
# To use YOUR OWN voice instead, run ./tools/record_voice.sh — it records
# over the same filenames, and the game just plays whatever files exist.
#
# Usage: ./tools/generate_voice.sh                                  (all shared clips)
#        ./tools/generate_voice.sh phrases-knight.txt ../assets/voice/knight   (a theme's pack)

set -euo pipefail
cd "$(dirname "$0")"
PHRASES="${1:-phrases.txt}"
OUT="${2:-../assets/voice}"
mkdir -p "$OUT"

VOICE="Samantha"
RATE=150          # words per minute; a touch slower than default for a 2.5yo
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Generating voice clips with $VOICE @ ${RATE}wpm from $PHRASES -> $OUT ..."

n=0
while IFS='|' read -r name text rate; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  say -v "$VOICE" -r "${rate:-$RATE}" -o "$TMP/$name.aiff" "$text"
  afconvert -f m4af -d aac -b 64000 "$TMP/$name.aiff" "$OUT/$name.m4a" >/dev/null
  echo "  $name.m4a  <- \"$text\""
  n=$((n+1))
done < "$PHRASES"

echo "Done. $n clips in $OUT/"
