# ChatCut Perfect Rebuild Prototype

A clean-room, componentized reconstruction of the current public `chatcut.io` homepage for interaction review.

## What this repo does
- Recreates the homepage layout from scratch as editable components.
- References current public ChatCut image/media URLs rather than copying binaries.
- Adds minimal Cursor-style frontend interactions:
  - Send → video continues
  - Send → motion result appears
  - Transcript edit → timeline changes
  - Generate → image/video result appears
  - Silent video → music appears
  - Pricing toggle

## What this repo does not do
- It does not copy ChatCut's proprietary frontend source, CSS, JS, or build output.
- It does not redistribute ChatCut's image/media files.

## Files
- `index.html` — page shell
- `styles.css` — clean-room design system
- `assets.js` — public asset URL manifest
- `components.js` — editable component functions
- `app.js` — local interaction state
- `design.md` — design and interaction contract
