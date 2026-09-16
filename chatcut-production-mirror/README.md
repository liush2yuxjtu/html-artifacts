# ChatCut Production Mirror + Playable Homepage

This interview prototype follows a **copy-and-edit** architecture rather than a clean-room homepage rebuild.

At build time it fetches the current public `https://chatcut.io` production HTML for the homepage and every current English `/features/*` page, stores untouched raw snapshots, keeps ChatCut's production Astro runtime, and patches only the copied homepage with local demo interactions.

## Commands

```bash
npm test
npm run build
```

`npm run build` is the deploy/preview mode. It mirrors HTML and records all discovered media/runtime assets, while public media continues to load from the original ChatCut/CDN URLs. This avoids producing an oversized preview deployment while preserving the real videos.

For a local archival copy of public media:

```bash
npm run mirror:full
```

Full mode downloads discovered image/video/audio/SVG assets into `dist/_mirror/` and rewrites the served HTML to the local copies.

## Output

```text
dist/
├── index.html                    # copied + homepage-only patch
├── features/.../index.html       # copied feature pages, no product patch
├── _raw/                         # untouched production HTML snapshots
├── _meta/page-manifest.json      # mirrored pages + per-page asset inventory
├── _meta/asset-manifest.json     # media/CSS/JS provenance + download status
├── _mirror/                      # populated by mirror:full
├── patches/
└── intent.html
```

## What is copied

- Raw production HTML snapshots.
- Current English `/features/*` pages discovered from `/features` plus the audited baseline list.
- Public image, video, audio, and SVG references.
- In `mirror:full`, those public media assets are downloaded to the build output.

## What stays remote

The served mirror deliberately keeps production Astro CSS/JS bundles on `chatcut.io` so hydrated production components keep their real behavior and dynamic imports. This is a copy-and-edit prototype, not a reverse-engineered application build.

Font binaries are not copied. Production stylesheets continue to request fonts from the original source.

## Homepage edits

Only `/` gets `patches/home.css` + `patches/home.js`:

- Best Moments: Send → original final clip continues.
- Motion Graphics: Generate → existing generated cards resolve in place.
- Text-Based Editing: prompt → original filler-word nodes collapse.
- Captions: untouched.
- Image Generation: original source state → Generate → original output.
- Video Generation: original reference → Generate → original preview video.
- Music: silent source → prompt → original waveform/music result state.
- Pricing: untouched production component.

See `intent.md` and `intent.html` for the product rationale.

## Safety / prototype behavior

Analytics and marketing tracking scripts are removed from served mirror pages. The production session-check script that can redirect a logged-in visitor into `app.chatcut.io` is also removed. Real app CTAs remain external unless they are the specific homepage demo trigger intercepted by the prototype.

## Review workflow

This branch is intended for a Draft PR and preview review. It should not be merged until the human reviewer approves the final interactive result.
