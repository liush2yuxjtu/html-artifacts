# ChatCut Production Mirror + Playable Homepage Design

## Goal

Create an interview-ready mirror of the current public `chatcut.io` marketing site that copies the live production HTML for the homepage and every current English `/features/*` page, preserves the original public media/video assets, and modifies only the homepage to make the existing product demos locally playable in the Cursor-style interaction pattern already agreed with the user.

## Scope

### Mirrored pages
- `/`
- `/features`
- every current English `/features/*` page discovered from the live `/features` index and a baseline allowlist:
  - `/features/ai-video-editor`
  - `/features/ai-motion-graphics`
  - `/features/ai-video-generator`
  - `/features/ai-captions`
  - `/features/ai-voiceover`
  - `/features/ai-music`
  - `/features/ai-image-generator`
  - `/features/ai-noise-removal`
  - `/features/ai-sound-effects`
  - `/features/text-based-editing`

Translated, docs, blog, model, use-case, pricing, plugin, and app pages are not mirrored.

### Homepage-only product changes
Use one shared in-page `DemoSession`; sections do not navigate away when their demo trigger is used.

1. **Edit Like an Expert Editor** — keep the original Best Moments DOM, frame strips, final clip video, layout, title, and copy. Add one Send trigger to the existing prompt card. Before Send, hold the result. After Send, play the original `final-clip.mp4` and advance the existing final playhead.
2. **AI Motion Graphics** — keep the original cards/Remotion content and prompt dock. Intercept Generate locally. Before Generate, results are visually pending. After Generate, reveal/emphasize the existing generated cards in place.
3. **Text-Based Editing** — keep the original Transcript component. Reset its initial mirrored state to the raw transcript; Send `Clean up all the filler words` then uses the original filler-word classes and status UI to remove/collapse filler words and shorten the visual timeline state.
4. **Auto AI Captions** — no product redesign. Preserve the original caption preview, original video, and style controls.
5. **AI Image Generation** — keep the original ImageToVideo section shell/options/prompt. Start from an original public “before” image asset rather than the already-generated result. Generate shows a short local loading state, then restores the original generated result in the existing showcase.
6. **AI Video Generation** — keep the original reference card, prompt, option dock, poster, and real preview videos. Initial state displays the selected original reference image and keeps the generated video paused/hidden. Generate shows loading, then reveals and plays the exact original preview video.
7. **AI Music Generator** — keep the original music board, waveform canvas, covers, and genre controls. Add a small silent-video state using an existing original ChatCut video asset; Send the existing music prompt, then transition into the existing generated-waveform/music UI. Do not claim that a generated soundtrack is audibly playing unless an original soundtrack asset is present.
8. **Pricing** — preserve the original production pricing component and its existing behavior; no redesign.

## Architecture

### Copy, do not rebuild
The build process fetches the live production HTML at build time. It saves an untouched raw snapshot for audit, produces a sanitized served copy, and injects only two homepage patch files (`patches/home.css`, `patches/home.js`). Feature pages receive no product patch.

### Runtime bundles
The mirrored HTML keeps ChatCut's production Astro CSS/JS bundles pointed at `https://chatcut.io` so hydrated production components retain their original behavior. This avoids re-implementing proprietary components and avoids breakage from dynamic imports.

### Asset localization
The mirror build extracts public media URLs from the fetched HTML, inline Astro props, `src`, `poster`, `srcset`, CSS `url(...)`, and absolute URL strings. It downloads image/video/audio/SVG media into `dist/_mirror/<hostname>/...` and rewrites those media URLs in served HTML to the local copies.

Production fonts are not copied into this deliverable. Stylesheets remain remote and therefore continue to load the production font files from their original host.

The build also records CSS/JS bundle URLs in an asset manifest for traceability, but does not rewrite runtime bundle execution to local copies.

### Sanitization
The served copy removes marketing analytics and tracking scripts (PostHog, Google Tag Manager, Ahrefs, FirstPromoter, Cloudflare Insights) and the homepage session-check script that can redirect logged-in users to `app.chatcut.io`. Product component hydration scripts remain.

### Navigation
- `/` and `/features/*` mirror links remain local.
- Other same-origin ChatCut routes point back to the live `https://chatcut.io` site.
- `app.chatcut.io` CTAs remain real external product CTAs unless they are the specific homepage demo trigger being intercepted.

## Shared DemoSession

```js
{
  expert: 'idle' | 'running' | 'done',
  motion: 'idle' | 'done',
  transcript: 'raw' | 'cleaning' | 'clean',
  image: 'source' | 'loading' | 'generated',
  video: 'reference' | 'loading' | 'generated',
  music: 'silent' | 'loading' | 'generated'
}
```

The session is a single `window.__chatcutDemoSession` object created by the homepage patch. It exists only for the current page load; no persistence or backend calls.

## Deliverables

Repository directory: `chatcut-production-mirror/`

- `package.json` — zero-dependency Node build/test scripts.
- `vercel.json` — preview build configuration; output directory `dist`.
- `scripts/mirror.mjs` — live-page fetch, page discovery, sanitization, asset extraction/localization, rewriting, snapshot/manifests.
- `scripts/mirror-lib.mjs` — pure functions covered by unit tests.
- `patches/home.js` — homepage-only interaction patch using original DOM/components/assets.
- `patches/home.css` — minimal visual states only; no homepage redesign.
- `tests/*.test.mjs` — Node built-in test coverage for mirror transformations and DemoSession transitions.
- `intent.md` — implementation intent and decision log.
- `intent.html` — Chinese ELI5 explainer showing “original component → one trigger → original result continues”.
- `dist/` — generated preview output; ignored in source control.

## Success criteria

1. Build discovers and mirrors every current English `/features/*` page plus the homepage.
2. Raw production HTML snapshots are written for every mirrored page.
3. Original public images/videos used by those pages are downloaded into the build output when reachable.
4. No font binaries are copied.
5. Feature page served HTML has no homepage patch injected.
6. Homepage visual hierarchy remains the copied production page; no replacement marketing layout is introduced.
7. Homepage interactions remain on-page and use the original assets/videos.
8. Automated tests pass.
9. Preview is manually exercised for the six playable homepage states and mobile/desktop smoke checks.
10. Work is delivered as a **Draft PR** and is not merged without the user's final approval.
