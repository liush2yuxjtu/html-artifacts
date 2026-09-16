# Shift-left test gate

- PR CI runs `npm run ci:check` before merge.
- Vercel build runs `npm run ci:predeploy` before publishing output.
- `verify:dist` fails the build when `intent.html`, a mirrored feature route, or a local asset reference would deploy as a 404.
