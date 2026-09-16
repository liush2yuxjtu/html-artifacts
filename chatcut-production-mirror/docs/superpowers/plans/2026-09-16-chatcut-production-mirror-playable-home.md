# ChatCut Production Mirror + Playable Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live-production mirror of ChatCut's homepage and all English feature pages, localize their public media at build time, and patch only the copied homepage with the approved playable product interactions.

**Architecture:** A zero-dependency Node build fetches production HTML, discovers `/features/*`, writes raw snapshots, sanitizes analytics/redirect scripts, localizes public media, and preserves remote Astro CSS/JS runtime bundles. The copied homepage gets a CSS/JS patch that manipulates the existing production DOM and media rather than rebuilding sections.

**Tech Stack:** Node.js 20+ built-in `fetch`, `node:test`, static HTML/CSS/JS, Vercel static output.

**Spec:** `docs/superpowers/specs/2026-09-16-chatcut-production-mirror-playable-home-design.md`

## Global Constraints

- Mirror `/` plus all current English `/features/*` pages; no translated pages.
- Product interaction changes apply only to `/`.
- Use copied production DOM and original public media; do not replace sections with a clean-room redesign.
- Keep production Astro runtime CSS/JS on `https://chatcut.io`.
- Localize image/video/audio/SVG media into build output when reachable.
- Do not copy font binaries.
- Remove analytics/tracking and auth redirect scripts from served mirror pages.
- Use one shared in-page `DemoSession`; no backend calls.
- Produce `intent.md` and Chinese ELI5 `intent.html`.
- Create a Draft PR; do not merge without final human approval.

---

### Task 1: Mirror transformation library

**Files:**
- Create: `scripts/mirror-lib.mjs`
- Test: `tests/mirror-lib.test.mjs`

**Interfaces:**
- Produces `discoverFeaturePaths(html) -> string[]`
- Produces `extractAssetUrls(html, pageUrl) -> { media: string[], stylesheets: string[], scripts: string[] }`
- Produces `assetOutputPath(url) -> string`
- Produces `pageOutputPath(pathname) -> string`
- Produces `sanitizeHtml(html) -> string`
- Produces `rewritePageLinks(html) -> string`
- Produces `rewriteMediaUrls(html, urlToLocalPath) -> string`
- Produces `injectHomepagePatch(html) -> string`

- [ ] **Step 1: Write failing tests** for feature discovery, asset extraction (including inline Astro props and posters), no font extraction, sanitization, local route mapping, and homepage patch injection.
- [ ] **Step 2: Run** `node --test tests/mirror-lib.test.mjs` and verify failures are due to missing implementation.
- [ ] **Step 3: Implement minimal pure functions** in `scripts/mirror-lib.mjs`.
- [ ] **Step 4: Run** `node --test tests/mirror-lib.test.mjs` and verify pass.
- [ ] **Step 5: Commit** mirror library + tests.

### Task 2: Shared homepage DemoSession

**Files:**
- Create: `patches/demo-session.js`
- Test: `tests/demo-session.test.mjs`

**Interfaces:**
- Produces `createDemoSession()`
- Produces `transitionDemo(session, action)`

Actions: `EXPERT_START`, `EXPERT_DONE`, `MOTION_GENERATE`, `TRANSCRIPT_START`, `TRANSCRIPT_DONE`, `IMAGE_START`, `IMAGE_DONE`, `VIDEO_START`, `VIDEO_DONE`, `MUSIC_START`, `MUSIC_DONE`.

- [ ] **Step 1: Write failing reducer tests** covering the initial state and every allowed transition.
- [ ] **Step 2: Run** `node --test tests/demo-session.test.mjs` and verify RED.
- [ ] **Step 3: Implement the minimal state reducer.**
- [ ] **Step 4: Run** the reducer test and full test suite; verify GREEN.
- [ ] **Step 5: Commit** DemoSession + tests.

### Task 3: Production mirror build

**Files:**
- Create: `scripts/mirror.mjs`
- Create: `package.json`
- Create: `.gitignore`
- Create: `vercel.json`
- Test: `tests/build-contract.test.mjs`

**Interfaces:**
- Consumes Task 1 mirror functions.
- Produces `dist/index.html`, `dist/features/**/index.html`, `dist/_raw/**`, `dist/_mirror/**`, `dist/_meta/page-manifest.json`, and `dist/_meta/asset-manifest.json`.

- [ ] **Step 1: Write failing build-contract tests** asserting baseline feature paths, build config, output path rules, and font exclusion.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement live page queue:** start with `/` + `/features` + baseline feature slugs, then add English `/features/*` links discovered from `/features`.
- [ ] **Step 4: Implement fetch retry/timeout and raw snapshot writing.** A failed optional media download is recorded in the manifest without aborting the page build; a failed HTML page fetch fails the build.
- [ ] **Step 5: Implement served-copy transformation:** sanitize, make non-mirrored same-origin links absolute, keep mirrored feature links local, localize media URLs, inject homepage patch only for `/`.
- [ ] **Step 6: Copy patch/intent files into `dist/` during build.**
- [ ] **Step 7: Run full tests.**
- [ ] **Step 8: Commit** build pipeline/config.

### Task 4: Homepage patch using copied components

**Files:**
- Create: `patches/home.js`
- Create: `patches/home.css`
- Test: `tests/home-patch-contract.test.mjs`

**Interfaces:**
- Consumes `createDemoSession`/`transitionDemo` from `/patches/demo-session.js`.
- Mutates only copied homepage DOM after `DOMContentLoaded` / `astro:page-load`.

- [ ] **Step 1: Write failing contract tests** asserting production selectors and required local interception points are represented in the patch source.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement Best Moments patch:** pause/reset original final clip until Send; append local Send control; after Send play original video and update existing CSS progress variable.
- [ ] **Step 4: Implement Motion patch:** intercept Generate anchors and reveal/emphasize original result cards in place.
- [ ] **Step 5: Implement Transcript patch:** reset production mirrored completed state back to raw, intercept prompt send, animate filler removal using existing classes/status UI.
- [ ] **Step 6: Leave Captions behavior untouched.**
- [ ] **Step 7: Implement Image patch:** source image first, intercept Generate, loading overlay, then original generated showcase asset.
- [ ] **Step 8: Implement Video patch:** selected reference first, original preview video hidden/paused, Generate → loading → reveal/play exact original preview.
- [ ] **Step 9: Implement Music patch:** add small silent source preview without deleting the original waveform/album UI; Send → local loading → reveal original generated music UI state. Do not fake audible generated audio.
- [ ] **Step 10: Run full test suite.**
- [ ] **Step 11: Commit** homepage patch.

### Task 5: Intent artifacts and audit docs

**Files:**
- Create: `intent.md`
- Create: `intent.html`
- Create: `README.md`
- Test: `tests/docs-contract.test.mjs`

- [ ] **Step 1: Write failing docs contract test** requiring the seven agreed homepage decisions, production-mirror explanation, and Draft PR / no-merge boundary.
- [ ] **Step 2: Run and verify RED.**
- [ ] **Step 3: Write `intent.md`** with the product rationale and exact per-section edits.
- [ ] **Step 4: Write Chinese ELI5 `intent.html`** showing original component → one local trigger → original result continues; keep it self-contained except links to the preview pages.
- [ ] **Step 5: Write README** with local build, mirror provenance, and limitations.
- [ ] **Step 6: Run full tests and verify GREEN.**
- [ ] **Step 7: Commit** docs.

### Task 6: Preview, snapshot critique, repair, and Draft PR

**Files:**
- Modify only files implicated by QA failures.

- [ ] **Step 1: Deploy the branch as a Vercel preview.**
- [ ] **Step 2: Desktop smoke test:** homepage loads, original CSS/DOM/video assets render, all six playable interactions stay on-page and reach the expected final state.
- [ ] **Step 3: Feature mirror smoke test:** all discovered `/features/*` pages return successfully and do not load `/patches/home.js`.
- [ ] **Step 4: Mobile smoke test** on homepage and representative feature pages.
- [ ] **Step 5: Snapshot/Critique:** compare homepage production geometry to preview, list visible regressions, then repair only regressions caused by the patch/mirror.
- [ ] **Step 6: Re-run tests and browser smoke checks.**
- [ ] **Step 7: Run `git`/PR diff review equivalent through GitHub compare and verify no unrelated files.**
- [ ] **Step 8: Create a Draft PR to `main`** containing preview link, test evidence, mirrored page count, asset count, and known limitations.
- [ ] **Step 9: Stop.** Present final preview + Draft PR and wait for explicit human merge approval.
