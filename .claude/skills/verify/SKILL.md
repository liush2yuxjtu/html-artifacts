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

Changes to `.github/workflows/pages.yml`, `chatcut-v3/**` (see the ChatCut v3 section), `chatcut-interaction-review/**`, `original-homepages-2026-09-15/chatcut/**`, or `chatcut-production-mirror/intent-assets/**` require a separate deployed Pages check. This path exists because the review UI can be HTTP 200 while a nested baseline or proof asset is still missing.

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

## ChatCut v3 (`chatcut-v3/**`)

The v3 playable covers chatcut.io homepage **experiment variant B** (cookie `chatcut_homepage_415_20260920_id`, ~50/50 with the legacy variant A the steps above cover). It has no Vercel preview: the candidate is the Pages artifact. Verified end to end on PR #19; run every step below before opening a PR that touches `chatcut-v3/**`, `.githooks/**` or the v3 lines of `.github/workflows/pages.yml`.

### 0. Local hooks (soft gate, never blocks)

```bash
sh chatcut-v3/scripts/check-hooks.sh     # silent = installed
```

If it warns about a missing hook, run `sh chatcut-v3/scripts/install-hooks.sh` and say so in the report; never override a different existing `core.hooksPath`. Record the hook state in the report either way. A missing hook is not a reason to report FAIL or BLOCKED.

### 1. Offline gate

```bash
node chatcut-v3/scripts/build.mjs          # must leave git clean: index.html, sw.js, compare.html are generated
git diff --exit-code -- chatcut-v3/site/index.html chatcut-v3/site/sw.js chatcut-v3/site/compare.html
node --test chatcut-v3/tests/build.test.mjs
```

### 2. Local browser acceptance on the served site

```bash
(cd chatcut-v3/site && python3 -m http.server 8777 --bind 127.0.0.1) &
node chatcut-v3/tests/qa.cjs http://127.0.0.1:8777/
```

`qa.cjs` drives desktop 1440 and mobile 390 and must print `PASS`: no overflow, patch injected once, B01 (`#editor-demo`) held → Send → production reply + timeline revealed, B02 (`#connect` Codex window) held at frame 0 → Send → all production steps done and destination editor revealed, patch idle afterwards (0 self-mutations), no page/console/HTTP errors except the dm-sans font that 404s on chatcut.io too. Desktop clicks the product's own Send, mobile the full-size status Send. Evidence lands in `chatcut-v3/evidence/` (or `QA_OUT=`).

### 3. Exact Pages artifact under the real path prefix

Pages serves the site at `/html-artifacts/chatcut-v3/`, which changes the service-worker scope and how root-relative media resolve. Assemble `_site` with the workflow's own step, not by hand:

```bash
V=/tmp/chatcut-verify/pages && rm -rf $V && mkdir -p $V
python3 -c "import yaml;[print(s['run']) for s in yaml.safe_load(open('.github/workflows/pages.yml'))['jobs']['deploy']['steps'] if s.get('name')=='Build public Pages artifact']" > $V/assemble.sh
sed -i 's|rm -rf _site|rm -rf "$OUT"|; s|mkdir -p _site$|mkdir -p "$OUT"|; s|_site|"$OUT"|g' $V/assemble.sh
OUT=$V/root/html-artifacts bash $V/assemble.sh
(cd $V/root && python3 -m http.server 8790 --bind 127.0.0.1) &
QA_OUT=$V/evidence node chatcut-v3/tests/qa.cjs http://127.0.0.1:8790/html-artifacts/chatcut-v3/
```

Probes on the same server (browser, not curl):
- every `<img>` on `/html-artifacts/chatcut-v3/` has `naturalWidth > 0` after a full scroll (proves `sw.js` forwards 404 media to chatcut.io under the prefix; last run 132/132);
- a full scroll makes **zero** requests to `chatcut.io/ingest`, `api.chatcut.io` or posthog (the mirror must not report experiment exposure);
- `compare.html` loads `baseline.html` (no `script[data-cc-v3-patch]`) next to `index.html` (patched, `ccV3.session.editor === 'idle'`), the B02 jump scrolls both frames to `#connect`, and the 390 layout has no overflow;
- the legacy review surfaces still assemble: `chatcut-interaction-review/`, its `../original-homepages-2026-09-15/chatcut/` iframe, and `chatcut-production-mirror/intent-assets/11-video-before.png`.

Before merge this is the strongest candidate available: Pages only deploys from `main`. State that explicitly in the PR; do not call it the deployed check.

### 4. After merge: the deployed candidate

Once the `Publish HTML Artifacts to GitHub Pages` run for the merge commit succeeds, repeat the step-3 browser checks against:

- `https://liush2yuxjtu.github.io/html-artifacts/chatcut-v3/`
- `https://liush2yuxjtu.github.io/html-artifacts/chatcut-v3/baseline.html`
- `https://liush2yuxjtu.github.io/html-artifacts/chatcut-v3/compare.html`
- the legacy review surfaces listed in the Pages section above.

The first visit installs `sw.js` and reloads once; measure after that reload.

### Re-capturing the original

`node chatcut-v3/scripts/snapshot.mjs` refetches chatcut.io (retrying until variant B is served), rewrites `baseline/`, `site/_astro/**` and `site/baseline.html`, then `build.mjs` regenerates the playable. Review that diff like any product change and rerun steps 1–3; a changed baseline can silently move the patch's anchors.

### Local post-merge preview

`sh chatcut-v3/scripts/install-hooks.sh` sets `core.hooksPath=.githooks`. After any `git pull`/`git merge` that changes `chatcut-v3/`, `.githooks/post-merge` rebuilds and serves `http://127.0.0.1:8777/compare.html` (`CHATCUT_V3_PORT`, `CHATCUT_V3_OPEN=0`, `CHATCUT_V3_ALWAYS=1`; stop with `sh chatcut-v3/scripts/preview.sh stop`). Verified in a scratch clone: a merge of the v3 branch served compare/baseline with HTTP 200 and left the tree clean; an unrelated merge stayed silent.

### Behind the Claude Code web agent proxy

Chromium does not trust the proxy CA by default. Trust only that key; never disable verification:

```bash
SPKI=$(openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64)
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright CHROMIUM_PATH=/opt/pw-browsers/chromium \
CHROMIUM_ARGS="--ignore-certificate-errors-spki-list=$SPKI" node chatcut-v3/tests/qa.cjs <url>
```

Do not pass a Playwright `proxy` option: Chromium already uses the environment proxy and bypasses loopback, while an explicit proxy sends `127.0.0.1` through the agent proxy (HTTP 405). `snapshot.mjs` needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`. Never `pkill -f "http.server <port>"` inside a compound shell command: the pattern matches that shell itself.

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
