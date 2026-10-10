#!/usr/bin/env bash
# Symlink this repo's mod/ folder into the game's mods directory so edits are picked up on restart.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GAME_APP="${GDT_APP:-$HOME/Library/Application Support/Steam/steamapps/common/Game Dev Tycoon/Game Dev Tycoon.app}"
MODS_DIR="$GAME_APP/Contents/Resources/app.nw/mods"
LINK="$MODS_DIR/StudioDashboard"

if [ -L "$LINK" ]; then
  echo "Already linked: $LINK -> $(readlink "$LINK")"
elif [ -e "$LINK" ]; then
  echo "$LINK exists and is not a symlink; move it aside first." >&2
  exit 1
else
  ln -s "$REPO_DIR/mod" "$LINK"
  echo "Linked $LINK -> $REPO_DIR/mod"
fi
