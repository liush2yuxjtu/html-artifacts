#!/bin/sh
# Soft gate: report whether this clone uses the versioned git hooks in .githooks/.
# git never installs hooks on clone or pull (a cloned repo must not be able to
# run code on your machine), so every clone opts in once with install-hooks.sh.
#
#   sh chatcut-v3/scripts/check-hooks.sh          # human-readable status
#   sh chatcut-v3/scripts/check-hooks.sh --claude # JSON for the Claude Code SessionStart hook
#
# Always exits 0: it reminds, it never blocks.

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
current=$(git -C "$ROOT" config --get core.hooksPath 2>/dev/null)
[ "$current" = ".githooks" ] && exit 0

if [ -n "$current" ]; then
  msg="git hooks: core.hooksPath is '$current', so .githooks/post-merge (ChatCut v3 compare preview) and .githooks/pre-push (offline contract tests) do not run. Do not override it; ask the human whether to call them from their own hooks."
else
  msg="git hooks: not installed in this clone, so .githooks/post-merge (rebuild + serve the ChatCut v3 compare page after git pull) and .githooks/pre-push (offline contract tests before git push) do not run. Soft gate: run 'sh chatcut-v3/scripts/install-hooks.sh' (reversible with 'git config --unset core.hooksPath') and tell the human you did, or tell them to run it."
fi

if [ "${1:-}" = "--claude" ]; then
  esc=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc" "$esc"
else
  echo "$msg"
fi
exit 0
