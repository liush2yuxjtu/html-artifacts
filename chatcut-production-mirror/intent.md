# ChatCut Homepage Interaction Intent

## Principle

**copy first, edit second.**

This project does not rebuild ChatCut from scratch. The build fetches the current production homepage and English feature pages, stores raw HTML snapshots, keeps the production Astro runtime, and applies one small homepage-only patch on top of the copied DOM.

The goal is to preserve what already looks like ChatCut while making the product demos explain themselves through one clear causal interaction: **original state → one user action → original result continues in place**.

## Scope boundary

- Homepage `/`: copied production page + local playable interaction patch.
- English `/features/*`: copied production mirrors only. No Cursor-style redesign is applied to feature pages.
- Other routes continue to point to the real `chatcut.io` site.
- The app CTAs still point to the real product unless a specific demo trigger is intentionally intercepted for the homepage prototype.

## Shared DemoSession

All homepage demo interactions use one shared in-page state object. This makes the page feel like one continuous product session instead of unrelated marketing widgets. The state is local only and makes no backend requests.

## Per-section decision

### 1. Edit Like an Expert Editor

Keep the original Best Moments component, original three source strips, prompt copy, playhead, and original `final-clip.mp4`.

Change: before the user sends the prompt, the production animation/result is held. The added Send control uses the existing prompt `Find the highlights and add B-roll to my video.` Once sent, the original sequence resumes, the original final clip plays, and the existing playhead progresses.

### 2. AI Motion Graphics

Keep the original production cards, category tabs, prompt dock, and Remotion-generated graphics.

Change: before Generate, the existing result cards visually read as pending. Clicking Generate is intercepted locally and reveals/emphasizes those same production results in place instead of navigating to the app.

### 3. Text-Based Editing

Keep the original Transcript component and original filler-word tokens.

Change: the copied page is reset from its already-finished production demo state to the raw transcript. Sending `Clean up all the filler words` then collapses the exact filler-word nodes using the component's existing classes and updates the original status/meta copy.

### 4. Auto AI Captions

**No redesign.** Keep the original caption video, word-level overlay, preset rail, and previous/next controls. The current section already communicates the feature well.

### 5. AI Image Generation

Keep the original ImageToVideo section layout, option dock, prompt shell, and generated output asset.

Change: the first frame is an original ChatCut “before” image rather than showing the answer immediately. Generate shows a brief local loading state, then restores the real generated result in the original showcase.

### 6. AI Video Generation

Keep the original reference image, prompt, option dock, poster, and actual preview video URLs.

Change: the initial showcase displays the selected reference image and holds the generated video. Generate shows a brief loading state and then reveals/plays the exact original preview video.

### 6.5. AI Music Generator

Keep the original music board, waveform canvas, style covers, album controls, and production copy.

Change: add a compact silent-source preview and the existing music prompt `Upbeat lo-fi hip hop, relaxed mood, 90 BPM`. Sending it transitions from silent/pending to the existing generated waveform/music state. The prototype does not pretend that a newly generated audible soundtrack exists when no original soundtrack asset is available.

### 7. Pricing

Keep the original production Pricing component and its existing Monthly/Annual behavior. No replacement pricing cards are introduced.

## Asset strategy

`npm run build` creates a thin preview mirror: it stores the copied production HTML and asset manifests while media continues to load from the original public URLs. This keeps the deploy small and ensures all original videos are still present in the preview.

`npm run mirror:full` runs the same mirror in full-media mode and downloads discovered public image/video/audio/SVG assets into `dist/_mirror/`, then rewrites the copied HTML to those local files. Font binaries are intentionally not copied; production stylesheets continue to load typography from the original host.

## Delivery boundary

The work is delivered as a **Draft PR**. Human-facing changes **do not merge** automatically. The final preview is for human product review and the merge decision remains with the reviewer.

## Intent version and traceability

**Intent contract:** `chatcut-homepage-causal-demo-v2` · 2026-09-17.

The canonical review chain is:

`production chatcut.io → raw snapshots → copied production components → homepage DemoSession patch → runtime Screens + Flows → browser evidence`

| Flow | User goal | Production surface | Local intervention | Runtime evidence |
| --- | --- | --- | --- | --- |
| F01 | See a rough edit become a first cut | `#best-moments` | Hold, then resume the original final clip after Send | `intent-assets/02-expert-before.png` → `03-expert-after.png` |
| F02 | Understand sentence-to-motion causality | `#motion-graphics` | Intercept Generate and reveal existing production result cards in place | `04-motion-before.png` → `05-motion-after.png` |
| F03 | Understand text-based cleanup | Transcript edit block | Reset to raw fillers, then collapse the existing filler nodes | `06-transcript-before.png` → `07-transcript-after.png` |
| F04 | Understand image source→result causality | Image generation story | Show production before image, then restore existing production generated asset | `09-image-before.png` → `10-image-after.png` |
| F05 | Understand reference→video causality | Video generation story | Hold the original preview video behind the reference image, then reveal it | `11-video-before.png` → `12-video-after.png` |
| F06 | Understand silent source→music-result causality | Music generator | Add the explicit silent-source/prompt step, then reveal existing waveform/music UI | `13-music-before.png` → `14-music-after.png` |
| KEEP | Preserve already-clear native behavior | Captions + Pricing | No redesign | `08-captions-native.png`, `15-pricing.png` |

`intent.html` is the human-facing Screens + Flows preview and uses these real runtime screenshots directly. It must not regress into a text-only flowchart or an ELI5 document that describes the product without showing it.

## Runtime truth and non-goals

The homepage patch is intentionally a **causal prototype over copied production assets**, not a replacement implementation of ChatCut's AI backend. A local `setTimeout`, local DemoSession transition, or revealing an existing production asset must never be used as evidence that a new image, video, music track, edit, or motion graphic was generated by a real backend request.

User-visible demo states must therefore stay consistent with the prototype boundary:

- Before the trigger, the source/reference/pending state is explicit.
- During the trigger, only a local transition/loading state is shown.
- After the trigger, the UI may say the existing production result is ready/visible, but runtime evidence must not claim a new backend generation occurred.
- Duplicate or contradictory state labels are an intent failure because they break the one-action→one-outcome causal contract.

## Intent drift guard

Every final acceptance must independently verify all of the following against the deployed immutable target:

1. The build raw snapshot still records `https://chatcut.io` as source origin.
2. Homepage patch injection occurs exactly once.
3. Every interactive demo has exactly one current `.cc-demo-status` and, where applicable, one local trigger/overlay.
4. F01–F06 complete their intended before→action→after behavior in a real browser.
5. Captions and Pricing remain production behavior rather than replacement mock UI.
6. Desktop and mobile have no horizontal overflow caused by the patch.
7. No uncaught page errors are produced by the patched flows.
8. `intent.html` still shows the real Screen sequence for every flow and not merely documentation about it.
9. The tested deployment/commit is the same deployment/commit being presented for human review.
10. Any change to source origin, scope boundary, state semantics, route ownership, or delivery boundary updates both this contract and `intent.html` in the same change.
