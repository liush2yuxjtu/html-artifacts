# ChatCut v3 · playable homepage on the 2026-09 variant

chatcut.io is running a homepage A/B experiment from the same URL
(cookie `chatcut_homepage_415_20260920_id`, ~50/50 in 16 samples on 2026-09-24):

| Variant | Sections | Covered by |
| --- | --- | --- |
| A (legacy) | `#best-moments`, `#transcript-captions`, `#image-to-video`, `#music-generation`, … | `chatcut-mirror-src/` + `chatcut-playable/` (unchanged) |
| B (new) | `#editor-demo`, `#creator-wall`, `#creative-workflow`, `#skills-styles`, `#connect`, `#features-gallery`, `#more-tools`, `#pricing`, `#faq`, `#final-cta` | **this folder** |

The legacy pipeline stays pinned to variant A. This folder adds a separate,
frozen variant B baseline and one patch layer on top of it, following the same
contract: **copy first, edit second** — original state → one visitor action →
the original ChatCut result continues in place.

## Layout

```text
chatcut-v3/
├── baseline/raw/variant-{a,b}.html  untouched production HTML (2026-09-24)
├── baseline/manifest.json           capture time, hashes, localized files
├── site/                            what GitHub Pages serves
│   ├── baseline.html                variant B as captured (no product patch)
│   ├── index.html                   variant B + v3 patch (the playable)
│   ├── compare.html                 original vs playable, side by side
│   ├── _astro/ fonts/               production runtime, localized
│   └── sw.js                        media fallback (see below)
├── runtime/patch.{css,js} sw.js     the only hand-written product layer
├── scripts/snapshot.mjs             re-capture from chatcut.io (network)
├── scripts/build.mjs                baseline + patch → index.html (offline)
├── tests/build.test.mjs             contract tests (node --test)
├── tests/qa.cjs                     browser acceptance, desktop + mobile
└── evidence/                        before/after screenshots from qa.cjs
```

## Flows

| Flow | Production surface | Before | One action | After |
| --- | --- | --- | --- | --- |
| B01 | `#editor-demo`, Creators project | Chat empty, the production prompt waits in the composer, timeline pending, video paused on the raw first frame | Send overlay on the demo video (sits outside the React island, re-aligned to `.hve-viewer` on resize/re-fit; falls back to the Send under the demo if the viewer is missing) | Production user bubble, tool steps and reply appear with their own entrance animation; timeline un-dims; native player starts |
| B02 | `#connect` agent window (Codex, and Claude via the dock) | Agent window at its first frame, destination editor pending | Send | The production `cxwin:play` / `ccr:play` timeline runs: steps run → done, then the ChatCut editor is revealed |
| KEEP | Hero, creator wall, creative workflow tabs, skills gallery, editing-apps export, features gallery, creative tools, pricing, FAQ, final CTA | — | — | Native behavior, untouched |

B02 needs no invented UI: the production agent components already ship the
full send → working → reveal sequence, and the homepage only disables it with
`data-conversation-only`. The build swaps that for `data-manual`, and the patch
dispatches the component's own play event.

## Truthfulness

Nothing is generated. B01 reveals the edit the production demo already
contains; B02 replays the production agent timeline. Status copy says
"Original ChatCut edit…" / "Original run finished…", never "generated".
The patch makes no network requests (checked in `build.test.mjs`).

## Runtime and media

`snapshot.mjs` localizes everything the variant B runtime loads from its own
origin (`/_astro/**` JS/CSS/fonts, `/fonts/**`), strips trackers, and answers
the anonymous session probe locally. Images and videos keep their production
paths; many are concatenated at runtime (`assetRoot + '/poster.jpg'`), so
rewriting them statically breaks. Instead `sw.js` redirects any same-origin GET
that 404s to the same path on chatcut.io, and answers `/ingest/*` (PostHog
proxy) locally so the mirror never reports analytics or experiment exposure
upstream. On a first visit the page reloads once when the service worker takes
control.

Known production issue carried over: `/public/workflow-story/dm-sans-v4.woff2`
404s on chatcut.io too; it falls back to the next font.

## Commands

```bash
# offline: rebuild the playable from the committed baseline
node chatcut-v3/scripts/build.mjs
node --test chatcut-v3/tests/build.test.mjs

# browser acceptance against a local server
(cd chatcut-v3/site && python3 -m http.server 8777) &
node chatcut-v3/tests/qa.cjs http://127.0.0.1:8777/

# local preview after every pull that touches chatcut-v3/ (once per clone)
sh chatcut-v3/scripts/install-hooks.sh
sh chatcut-v3/scripts/preview.sh           # by hand: build + serve http://127.0.0.1:8777/compare.html

# re-capture from production (changes the baseline; review the diff)
node chatcut-v3/scripts/snapshot.mjs && node chatcut-v3/scripts/build.mjs
```

Behind an HTTPS-intercepting proxy, Node needs `NODE_USE_ENV_PROXY=1` and
`NODE_EXTRA_CA_CERTS`, and `qa.cjs` accepts `CHROMIUM_PATH`, `CHROMIUM_ARGS`
and `PLAYWRIGHT_MODULE`.
