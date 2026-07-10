#!/bin/bash
# Record the game's voice in YOUR voice, phrase by phrase.
#
#   ./tools/record_voice.sh          walk through every phrase
#   ./tools/record_voice.sh n7 hello re-record just those clips
#
# For each phrase: Enter starts recording, Enter stops, you hear it back,
# then accept / retry / skip. Accepted clips are saved straight into
# assets/voice/ — preview the game locally, then commit + push to deploy.
#
# Needs sox (brew install sox). The first recording triggers the macOS
# microphone permission prompt for your terminal app. Tips: quiet room,
# phone-distance from the mic, and smile while you talk — it comes through.

set -euo pipefail
cd "$(dirname "$0")"
VOICE_DIR="../assets/voice"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ONLY=("$@")

command -v sox >/dev/null || { echo "sox is required: brew install sox"; exit 1; }

wanted() { # no args = all phrases
  [[ ${#ONLY[@]} -eq 0 ]] && return 0
  local n
  for n in "${ONLY[@]}"; do [[ "$n" == "$1" ]] && return 0; done
  return 1
}

count=0
while IFS='|' read -r name text _rate <&3; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  wanted "$name" || continue
  echo
  echo "────────────────────────────────────────"
  echo "  $name — say:   \"$text\""
  echo "────────────────────────────────────────"
  while true; do
    read -r -p "  Enter to record, s to skip: " cmd
    [[ "$cmd" == "s" ]] && break

    wav="$TMP/$name.wav"
    sox -q -d -c 1 "$wav" &     # record from the default mic
    soxpid=$!
    read -r -p "  ● recording… Enter to stop " _
    kill -INT "$soxpid" 2>/dev/null
    wait "$soxpid" 2>/dev/null || true

    # trim leading/trailing silence, gentle normalize, then AAC like the rest
    trimmed="$TMP/$name-trim.wav"
    sox -q "$wav" "$trimmed" norm -3 silence 1 0.05 1% reverse silence 1 0.05 1% reverse 2>/dev/null \
      || cp "$wav" "$trimmed"
    afconvert -f m4af -d aac -b 64000 "$trimmed" "$TMP/$name.m4a" >/dev/null

    echo "  ▶ playback…"
    afplay "$TMP/$name.m4a"
    read -r -p "  (a)ccept  (r)etry  (s)kip: " x
    case "$x" in
      a|"") mv "$TMP/$name.m4a" "$VOICE_DIR/$name.m4a"; count=$((count+1)); echo "  saved ✓"; break ;;
      s)    break ;;
      *)    continue ;;
    esac
  done
done 3< phrases.txt

echo
echo "Done — $count clip(s) saved to assets/voice/."
echo "Preview locally, then commit + push to put your voice in the game."
