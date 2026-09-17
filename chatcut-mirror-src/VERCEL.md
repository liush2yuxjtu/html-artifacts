# ChatCut Vercel preview

This packaging path reuses the committed `chatcut-playable` homepage, including playable v2, the hydration lifecycle, and the hit-test fixes. It does not rebuild the older v1 homepage from `chatcut-production-mirror`.

## Build and verify

From the repository root, with Node.js 24 or newer:

```sh
node --test chatcut-mirror-src/tests/*.test.mjs chatcut-production-mirror/tests/*.test.mjs
node chatcut-mirror-src/vercel-build.mjs
```

Output is `.vercel/output` (Vercel Build Output API v3). The build includes the homepage, intent, feature index, all ten previously supported feature routes, their JS/CSS/image dependencies, and the original public motion-template response. Videos continue to use original public ChatCut CDN URLs. No generated backend results or network mocks are used.

The mirror is English-only. `/zh`, `/en`, `/es`, `/ja`, and `/zh-hant` redirect to `/`. This is an explicit fallback, not a translated page. Unknown paths are not rewritten to the homepage.

Browser requirements: Python 3, `playwright==1.58.0`, installed Google Chrome. The script uses a new unauthenticated browser context, Chinese browser locale, and desktop/mobile viewports.

```sh
python3 chatcut-mirror-src/browser/vercel_e2e.py \
  --url https://YOUR-EXACT-PREVIEW.vercel.app/zh \
  --out chatcut-vercel-evidence/zh
python3 chatcut-mirror-src/browser/vercel_e2e.py \
  --url https://YOUR-EXACT-PREVIEW.vercel.app/ \
  --out chatcut-vercel-evidence/root
```

Use `--cpu 4` for an additional hydration timing stress check. Optional `--device desktop` or `--device mobile` scopes a diagnostic run; default is both.

Each run collects navigation, console/page/request failures, rendered DOM, full-page screenshots, hydration, overflow, and six actual demo clicks with visible-result assertions. Media streams can keep `networkidle` outstanding: after a bounded wait, fallback is allowed only when every outstanding request is a media request. JavaScript, document, image, CSS, or fetch requests do not qualify. Console errors, HTTP failures, hydration failures, and missing visible results still fail the gate. Exit 0 means PASS; exit 1 means FAIL.

For local testing, `browser/serve_preview.py --output .vercel/output --port 8768` serves the actual output plus its route definitions. Use the upstream `anthropics/skills` `webapp-testing/scripts/with_server.py` lifecycle helper to start and stop it around the tests.

## Deploy the verified build

Link only the intended preview project, then:

```sh
vercel deploy --prebuilt --yes --scope YOUR-TEAM
```

Run browser acceptance again against the immutable URL returned by Vercel. Local PASS does not substitute for this final check. `_meta/build.json` records source commit, dirty status, page list, packaged-asset hashes, and the homepage hash. Never commit `.vercel` credentials or browser authentication state.

## Runtime integration fixes

The mirrored Astro renderer used an asynchronous React transition during hydration, allowing the outside DOM patch to run before React finished. Initial hydration now commits synchronously using ReactDOM `flushSync` at that integration boundary. This is narrow and contract-tested; error reporting is not suppressed. The passive transcript autoplay yields to the interactive demo session, so it cannot overwrite the user's completed edit. Visible hydrated controls are preferred over hidden SSR fallback duplicates. Production session lookup does not execute from the mirror origin.
