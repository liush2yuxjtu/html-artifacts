---
name: verify
description: Verify ChatCut playable/mirror changes against the exact candidate using the repository's real Vercel browser acceptance harness, desktop/mobile interaction, hydration checks, and captured evidence.
---

# Verify ChatCut

Upstream behavior reference:
`https://raw.githubusercontent.com/asgeirtj/system_prompts_leaks/main/Anthropic/claude-code/skills/verify/SKILL.md`

## Candidate

Verify the exact commit and exact Vercel Preview/Pages candidate. Local PASS does not substitute for the deployed candidate.

## Build the actual Vercel output

From repo root:

```bash
node chatcut-mirror-src/vercel-build.mjs
```

This writes `.vercel/output`.

For local serving of that exact output:

```bash
python3 chatcut-mirror-src/browser/serve_preview.py --output .vercel/output --port 8768
```

Readiness: `http://127.0.0.1:8768/` returns the packaged homepage.

## Drive

The canonical browser gate is already in-repo:

```bash
python3 chatcut-mirror-src/browser/vercel_e2e.py \
  --url https://YOUR-EXACT-PREVIEW.vercel.app/ \
  --out /tmp/chatcut-verify/root
```

Also verify the language redirect/fallback path:

```bash
python3 chatcut-mirror-src/browser/vercel_e2e.py \
  --url https://YOUR-EXACT-PREVIEW.vercel.app/zh \
  --out /tmp/chatcut-verify/zh
```

The script drives both desktop and mobile by default, waits for hydration, checks overflow and HTTP/request failures, records console/page errors, and performs real demo clicks with visible-result assertions.

For timing-sensitive hydration changes, add `--cpu 4`.

## Evidence

Keep the harness output directory. It contains rendered DOM/report data and full-page screenshots. Bind the report to the exact candidate URL and SHA.

Do not replace this with static HTML inspection, screenshots alone, build success, or node tests.

## Probe

At minimum, use one of:
- `--cpu 4` hydration stress;
- the `/zh` redirect/fallback path;
- mobile viewport behavior;
- a changed interactive island or demo flow.

## Cleanup

Stop only the preview server you started. Preserve `/tmp/chatcut-verify/**`.

## Maintain this verifier

When the repository's canonical browser harness, output path, route behavior, or evidence format changes, update this file in the same PR that proves the new path.
