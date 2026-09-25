#!/bin/sh
# Rebuild the ChatCut v3 playable and serve the side-by-side review page
# (frozen original vs our latest playable) on a local port.
#
#   sh chatcut-v3/scripts/preview.sh          # build + serve + print URL
#   sh chatcut-v3/scripts/preview.sh stop     # stop the server started here
#
# Env: CHATCUT_V3_PORT (default 8777), CHATCUT_V3_OPEN=1 to open a browser.
# Called by .githooks/post-merge; safe to run by hand.
set -eu

ROOT=$(git rev-parse --show-toplevel)
GIT_DIR=$(git rev-parse --absolute-git-dir)
PORT=${CHATCUT_V3_PORT:-8777}
PIDFILE="$GIT_DIR/chatcut-v3-preview.pid"
LOG="$GIT_DIR/chatcut-v3-preview.log"
URL="http://127.0.0.1:$PORT/compare.html"

running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

if [ "${1:-}" = "stop" ]; then
  if running; then kill "$(cat "$PIDFILE")" && echo "chatcut-v3 preview stopped"; fi
  rm -f "$PIDFILE"
  exit 0
fi

cd "$ROOT"
if command -v node >/dev/null 2>&1; then
  node chatcut-v3/scripts/build.mjs >/dev/null
else
  echo "chatcut-v3: node not found, serving the committed build as is" >&2
fi

if ! running; then
  command -v python3 >/dev/null 2>&1 || { echo "chatcut-v3: python3 is required to serve the preview" >&2; exit 1; }
  # Bind to loopback only; the service worker needs http://127.0.0.1 (a secure context).
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/chatcut-v3/site" >"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  sleep 0.5
  if ! running; then echo "chatcut-v3: preview server failed to start, see $LOG" >&2; rm -f "$PIDFILE"; exit 1; fi
fi

echo "chatcut-v3 preview: $URL  (original: baseline.html · playable: index.html · stop: sh chatcut-v3/scripts/preview.sh stop)"
if [ "${CHATCUT_V3_OPEN:-0}" = "1" ]; then
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
  fi
fi
