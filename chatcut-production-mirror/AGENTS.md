# ChatCut agent instructions

These instructions apply to all work under `chatcut-production-mirror/`.

## Shift Testing Left

Keep the fast local and CI gates early:

1. `npm test`
2. `npm run build`
3. `npm run verify:dist`
4. `npm run ci:check` for PR/local verification
5. `npm run ci:predeploy` before Vercel publishes the output

These checks are necessary but are not sufficient to call a product/UI change ready.

## Real Preview acceptance with TinyFish

After a Vercel Preview URL exists, use **TinyFish real-browser automation** as the post-preview acceptance gate. Do not substitute a static fetch, build success, or `verify:dist` result for this browser check.

Run TinyFish against the exact PR Preview URL and verify at minimum:

- `/` renders as the expected ChatCut production mirror without an obvious 404 or broken critical assets.
- `/intent.html` is reachable.
- Representative `/features/...` routes used by the change are reachable.
- At least one affected homepage/demo interaction is exercised through the visible UI and reaches its expected visible result/state.
- Any route, asset, interaction, console-visible failure, or access blocker discovered by the browser run is treated as a real acceptance failure until resolved.

Use strict/fail-fast browser automation when available and capture screenshots/snapshots when the tool supports them.

## PR evidence

After the TinyFish run, leave a PR comment containing:

- the exact Preview URL tested;
- the TinyFish run ID or run URL when available;
- PASS / FAIL / BLOCKED;
- routes and interaction(s) exercised;
- concrete failures or blockers;
- the relevant timing when available.

Do not mark a product/UI PR ready for final human review only because local tests, GitHub Actions, or Vercel build checks are green. The real Preview browser acceptance must also pass.

If TinyFish cannot access the Preview because of authentication, protection, or another external dependency, record `BLOCKED` on the PR instead of silently replacing the check with a weaker proxy.
