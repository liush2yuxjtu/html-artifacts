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

## Real Preview acceptance

After a Vercel Preview URL exists, use deterministic browser automation as the required post-preview acceptance gate.

Preferred runners:

1. Playwright against the exact Vercel Preview URL.
2. Vercel `agent-browser` when an agent is performing the verification interactively.

Do not substitute a static fetch, build success, or `verify:dist` result for this browser check.

If Deployment Protection is enabled, use Vercel's automation bypass support such as `VERCEL_AUTOMATION_BYPASS_SECRET` instead of relying on manually generated share links.

Verify at minimum:

- `/` renders as the expected ChatCut production mirror without an obvious 404 or broken critical assets.
- `/intent.html` is reachable and visibly renders.
- Representative `/features/...` routes used by the change are reachable.
- At least one affected homepage/demo interaction is exercised through the visible UI and reaches its expected visible result/state.
- No framework error overlay or relevant browser console error appears during the checked flow.
- Capture a screenshot and an interactive/DOM snapshot when the runner supports them.
- When a stable visual baseline exists, run a screenshot diff and treat a material unexpected difference as an acceptance failure.

Any route, asset, interaction, console-visible failure, or access blocker discovered by the browser run is a real acceptance failure until resolved.

## TinyFish policy

TinyFish is optional exploratory acceptance, not the default or mandatory PR gate.

Use TinyFish only when human-like autonomous exploration adds value beyond the deterministic Playwright/agent-browser checks, or when the user explicitly requests it. Do not make a PR depend on metered TinyFish availability when the same acceptance criteria can be expressed deterministically.

If TinyFish is unavailable, out of credits, or blocked by account capabilities, that does not block the PR when the required Playwright/agent-browser Preview acceptance passes.

## PR evidence

After the real Preview browser run, leave or update PR evidence containing:

- the exact Preview URL tested;
- the browser runner used and run/artifact URL when available;
- PASS / FAIL / BLOCKED;
- routes and interaction(s) exercised;
- screenshot/snapshot or visual-diff artifact references when available;
- concrete failures or blockers;
- queue, execution, and end-to-end timing separately when available.

Do not mark a product/UI PR ready for final human review only because local tests, GitHub Actions, or Vercel build checks are green. The real Preview browser acceptance must also pass.
