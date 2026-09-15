# ChatCut P0/P1 interaction prototype

A public, static interaction prototype created from a UX audit of `chatcut.io` vs `cursor.com`.

## What this prototype solves

### P0
- Interactive **Prompt → AI work → First cut → Ready for review** hero flow.
- Clear split between **Edit in ChatCut** and **Use in ChatGPT / Claude**.
- Outcome-oriented CTA: **Edit my first video**.

### P1
- One persistent editing session instead of disconnected feature demos.
- Visible AI work states and concrete change metrics.
- Caption, motion, music, B-roll, and duration all modify the same timeline.
- Follow-up editing that visibly updates the existing session.

## Technical notes

- Single self-contained `index.html`.
- No build system or framework.
- No tracking, network requests, uploads, or backend.
- Responsive and keyboard-accessible.
- Honors `prefers-reduced-motion`.

## Disclaimer

This is an unofficial interaction prototype for product/UX review. It is not the production ChatCut site.
