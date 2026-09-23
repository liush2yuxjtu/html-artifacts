---
name: verify
description: Verify ChatCut playable/mirror and review-layer changes against the exact candidate using the repository's real Vercel/browser acceptance path, deployed GitHub Pages review surface, desktop/mobile interaction, hydration checks, and captured evidence.
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

## Drive the Vercel product surface

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

The script drives desktop and mobile, waits for hydration, checks overflow and HTTP/request failures, records console/page errors, and performs real demo clicks with visible-result assertions.

For timing-sensitive hydration changes, add `--cpu 4`.

## Drive the GitHub Pages review layer when it is in scope

Changes to `.github/workflows/pages.yml`, `chatcut-interaction-review/**`, `original-homepages-2026-09-15/chatcut/**`, or `chatcut-production-mirror/intent-assets/**` require a separate deployed Pages check. This path exists because the review UI can be HTTP 200 while a nested baseline or proof asset is still missing.

After the exact Pages deployment completes, verify these public surfaces from the same deployed candidate:

- `https://liush2yuxjtu.github.io/html-artifacts/chatcut-interaction-review/`
- `https://liush2yuxjtu.github.io/html-artifacts/original-homepages-2026-09-15/chatcut/`
- at least one proof asset referenced by the review, e.g. `/html-artifacts/chatcut-production-mirror/intent-assets/11-video-before.png`
- the immutable Vercel Preview linked by the review page.

The review page must render the Baseline and Preview sources it actually references. Do not substitute the legacy `/chatcut-baseline/` alias for the review page's `/original-homepages-2026-09-15/chatcut/` path.

When browser automation is available, additionally:

1. open the deployed review page at desktop and 390x844 mobile;
2. confirm no page-level horizontal overflow;
3. switch at least one A0x tab;
4. confirm the Baseline iframe loads the frozen page;
5. drive at least one safe Preview interaction and observe the visible state change.

If the deployed browser surface cannot be reached from the current verifier environment, keep the runtime verdict **BLOCKED**. HTTP/content fetches may support diagnosis but do not upgrade a browser-required acceptance to PASS.

## Evidence

Keep the harness output directory. It contains rendered DOM/report data and full-page screenshots. Bind the report to the exact candidate URL and SHA.

For a Pages review-layer change, also preserve the exact Pages deployment/run identity plus the public review URL, baseline URL, sampled proof-asset URL, and immutable Preview URL that were checked.

Do not replace runtime evidence with static HTML inspection, screenshots alone, build success, workflow success, or node tests.

## Probe

At minimum, use one of:
- `--cpu 4` hydration stress;
- the `/zh` redirect/fallback path;
- mobile viewport behavior;
- a changed interactive island or demo flow;
- for Pages review-layer changes, a nested baseline/proof-asset path that would fail independently of the top-level review page.

## Cleanup

Stop only the preview server you started. Preserve `/tmp/chatcut-verify/**`.

## Maintain this verifier

When the repository's canonical browser harness, output path, review-layer dependency path, route behavior, or evidence format changes, update this file in the same project change that proves the new path. Persist only commands and surfaces that were actually verified for this repository.
