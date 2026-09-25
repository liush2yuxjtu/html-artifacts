#!/bin/sh
# Point this clone's git hooks at the versioned .githooks/ directory.
#   sh chatcut-v3/scripts/install-hooks.sh
set -eu
ROOT=$(git rev-parse --show-toplevel)
current=$(git config --get core.hooksPath || true)
if [ -n "$current" ] && [ "$current" != ".githooks" ]; then
  echo "core.hooksPath is already '$current'; not overriding it." >&2
  echo "Copy or call $ROOT/.githooks/post-merge from your own post-merge hook instead." >&2
  exit 1
fi
chmod +x "$ROOT/.githooks/post-merge" "$ROOT/chatcut-v3/scripts/preview.sh"
git config core.hooksPath .githooks
echo "Installed: core.hooksPath=.githooks (post-merge rebuilds and serves the ChatCut v3 compare page)"
