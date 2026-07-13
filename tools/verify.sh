#!/bin/bash
# Pre-deploy gate: the scenario suite on Chromium + WebKit × desktop + iPhone,
# plus the stale-cache guard. Run before EVERY push:
#
#   ./tools/verify.sh
#
# Exits nonzero (and says so loudly) if anything fails. First-time setup:
#   npm install && npx playwright install webkit

set -uo pipefail
cd "$(dirname "$0")/.."
PORT=8672

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1

fail=0
echo "── clip-text lockstep ──────────────────"
node tools/check-clip-text.mjs || fail=1

for eng in chromium webkit; do
  for dev in desktop iphone; do
    echo "── $eng / $dev ─────────────────────────"
    node tools/webkit-test.mjs --engine="$eng" --device="$dev" --url="http://127.0.0.1:$PORT/" || fail=1
  done
done

echo "── version guard ───────────────────────"
LIVE=$(curl -s --max-time 10 https://tuckerhuth.com/theo-blastoff/sw.js | grep -o "blastoff-v[0-9]*" | head -1)
LOCAL=$(grep -o "blastoff-v[0-9]*" sw.js | head -1)
if [ -z "$LIVE" ]; then
  echo "⚠ could not read the live sw.js — skipping the stale-cache check"
elif [ "$LIVE" = "$LOCAL" ]; then
  echo "✗ sw.js VERSION ($LOCAL) matches the live site — bump VERSION + GAME_VERSION before deploying"
  fail=1
else
  echo "✓ version bump: live $LIVE → local $LOCAL"
fi

echo
if [ $fail -eq 0 ]; then echo "ALL GREEN — deploy-ready 🚀"; else echo "FAILURES — do not deploy"; fi
exit $fail
