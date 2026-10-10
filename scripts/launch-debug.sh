#!/usr/bin/env bash
# Launch Game Dev Tycoon with Chrome remote debugging enabled, for scripts/cdp.mjs.
# Requires the NW.js SDK build in the app bundle (see README) and Steam running;
# SteamAppId lets the Steam API initialise outside the Steam launcher.
#
# The extra Chromium flags keep the game rendering while it is hidden behind other windows
# or on another Space, so screenshots and automation work without stealing focus.
set -euo pipefail

GAME_APP="${GDT_APP:-$HOME/Library/Application Support/Steam/steamapps/common/Game Dev Tycoon/Game Dev Tycoon.app}"
PORT="${GDT_DEBUG_PORT:-9222}"

if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  echo "Something is already listening on port $PORT (game already running?)" >&2
  exit 1
fi

SteamAppId=239820 SteamGameId=239820 \
  "$GAME_APP/Contents/MacOS/nwjs" \
  --remote-debugging-port="$PORT" \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  "$@" >/dev/null 2>&1 &
echo "Launched (pid $!). Waiting for the debugger on port $PORT..."

for _ in $(seq 1 60); do
  if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    echo "Debugger ready: http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 1
done
echo "Timed out waiting for the debugger" >&2
exit 1
