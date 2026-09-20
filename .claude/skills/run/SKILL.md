---
name: run
description: Launch and drive the current project's real runtime surface so a human-visible or programmatic behavior can be observed. Use when asked to run the app, try a change, open the UI, exercise a CLI/TUI/API, or capture runtime evidence. Prefer an existing project run-* skill; otherwise infer the smallest safe launch path.
---

# Run the real application

The goal is not merely that a command exits zero. The goal is a live handle on the surface a user or downstream program actually touches.

## Find the project recipe first

Before inventing commands, search the relevant repo/package scope for project skills. Prefer the most specific matching `run-*` recipe for the files or package being worked on.

If no usable project recipe exists, inspect the smallest set of authoritative launch hints: package/build manifests, README/developer docs, container config, executable entrypoints, and server config. If the launch path is unusual or took real discovery, use `run-skill-generator` after you get it working.

## Identify the runtime surface

| Product shape | Runtime surface |
|---|---|
| Web/desktop GUI | pixels plus browser/window interaction |
| CLI | command line, stdout/stderr, exit status |
| TUI/REPL | interactive terminal session |
| HTTP/API/server | listening socket plus real request/response |
| Library/SDK | public package boundary from a consumer process |
| Agent/prompt | real agent invocation and resulting behavior |
| Workflow/CI | actual workflow run |

Do not substitute an internal function call for the public surface when a public surface exists.

## Launch safely

Use the project's documented install/build/launch steps. Reuse existing dependencies and credentials; do not invent secrets. Isolate shared state with ephemeral ports, temporary directories, named tmux sessions, and test/sandbox accounts where practical.

Never perform destructive external writes just to prove the app starts. Use a dry run, sandbox, disposable target, or stop at the risky boundary and report it.

## Drive the smallest meaningful flow

Exercise the smallest path that reaches the intended behavior:

- UI change -> navigate to the changed screen and interact with it.
- CLI flag -> invoke the shipped/public CLI with the flag.
- API handler -> send a real request through the listening server.
- error handling -> trigger the actual error from the public surface.
- persistence -> perform the action, reload/reopen, and observe persisted state.

Capture evidence as you go: screenshot, pane capture, stdout/stderr, response body, or another runtime artifact.

## Report

Return the launch method, exact surface driven, observed result, evidence, any environment limitation, and cleanup status. Tests/typecheck are not proof that the application itself ran.

See `references/surfaces.md` when the project has multiple possible runtime surfaces.
