<!-- verify-shift-left:start -->
## Pre-PR verification

Use /verify skill every time BEFORE we make a PR

- Canonical skill source: `liush2yuxjtu/claude-runtime-verification-skills@0d585c02bbeaa756e45865dd0a36f84d1b08f589`.
- Run relevant existing tests locally through `/verify` before PR creation.
- Keep test files in the repository; shift their execution left instead of deleting coverage.
- Preserve remote CI only for checks that genuinely require remote, production, deployment, secret, runner, or environment-specific execution.
- Do not open a PR on `FAIL` or `BLOCKED`. `SKIP` is only valid when the skill says no executable runtime behavior applies.

<!-- verify-shift-left:end -->

<!-- local-git-hooks:start -->
## Local git hooks (soft gate)

git never installs hooks on `clone` or `pull`: a cloned repository must not be able to run code on your machine. This repo keeps its hooks versioned in `.githooks/`, and each clone opts in once.

- **Check:** `sh chatcut-v3/scripts/check-hooks.sh` prints nothing when `core.hooksPath=.githooks`, otherwise the fix. Claude Code runs it at session start (`.claude/settings.json` → `SessionStart`) and passes any warning into the session context.
- **Install:** `sh chatcut-v3/scripts/install-hooks.sh`. It is local and reversible (`git config --unset core.hooksPath`). An agent that sees the warning may install it and must tell the human it did.
- **Never override** a different existing `core.hooksPath`: the installer refuses, and the agent asks the human how to chain `.githooks/post-merge` into their own hook.
- **What it does:** after any `git pull`/`git merge` that changes `chatcut-v3/`, `.githooks/post-merge` rebuilds the playable and serves `http://127.0.0.1:8777/compare.html` (frozen original vs our playable). Stop the server with `sh chatcut-v3/scripts/preview.sh stop`.
- **Soft gate:** a missing hook never blocks work or a PR. `/verify` step 0 records its state in the report.
<!-- local-git-hooks:end -->
