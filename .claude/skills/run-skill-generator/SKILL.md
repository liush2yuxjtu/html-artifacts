---
name: run-skill-generator
description: Discover, verify, and persist a project-specific recipe that lets future agents build, launch, and drive the real application surface from a clean environment.
---

# Generate a project run skill

Create a durable `run-<unit>` skill for the smallest meaningful application unit. Document commands that were actually exercised.

## Existing recipe first

Search the repo root and relevant app/package directories. If an existing run skill targets the same unit, preserve what works and repair stale or missing steps.

## Discover the recipe

Use package/build manifests, developer docs, existing scripts, environment examples, container config, and executable entrypoints. Determine prerequisites, build/install, launch/readiness, how to drive the real surface, evidence capture, and cleanup.

## Prove it

Execute the recipe from a fresh enough process with an explicit working directory and isolated runtime state. Drive at least one meaningful surface action. Repair the recipe until the documented commands match what actually works.

## Persist

Default location:

```text
<unit>/.claude/skills/run-<unit-name>/
  SKILL.md
  driver.*
```

Include the working directory, verified prerequisites, build/install, launch, readiness, drive commands/tooling, evidence method, cleanup, and observed gotchas. Keep local credentials and machine-specific absolute home paths out of the skill.

Finally, follow the generated skill literally in a new process where practical. Only report success after paths resolve, launch reaches readiness, the real surface can be driven, and cleanup works.
