import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { sanitizeMirror, prepareHomepage, playableVersion, outputConfig, PAGES, HOME_ALIASES, guardProductionSession, synchronizeAstroHydration, stopAutoplayTranscript, prepareVisibleControls } from '../vercel-build.mjs';
test('removes production-only locale and session redirects without removing product islands', () => {
  const input = '<script>function runBrowserLocaleBootstrap(){location.href="/zh"}</script><script>fetch("https://api.chatcut.io/auth/get-session")</script><astro-island></astro-island><script>window.product=true</script>';
  const output = sanitizeMirror(input);
  assert.doesNotMatch(output, /runBrowserLocaleBootstrap|auth\/get-session/);
  assert.match(output, /astro-island/);
  assert.match(output, /window.product=true/);
});
test('canonical locale fallbacks cannot redirect back into an unsupported locale', () => {
  const first = outputConfig().routes[0];
  for (const locale of HOME_ALIASES) {
    assert.match('/' + locale, new RegExp(first.src));
    assert.match('/' + locale + '/', new RegExp(first.src));
  }
  assert.equal(first.headers.Location, '/');
  assert.equal(first.status, 307);
  assert.equal(new RegExp(first.src).test('/'), false);
  assert.equal(new RegExp(first.src).test('/zh/unknown'), false);
});
test('preserves the full latest playable homepage and same-origin runtime on Vercel', async () => {
  const source = await fs.readFile(new URL('../../chatcut-playable/index.html', import.meta.url), 'utf8');
  const output = prepareHomepage(source);
  for (const marker of ['best-moments', 'image-to-video', 'music-generation', 'data-cc-playable-hydration-safe', 'data-cc-playable-layer-fix']) assert.ok(output.includes(marker), marker);
  assert.doesNotMatch(output, /runBrowserLocaleBootstrap|auth\/get-session|\.\/_astro\//);
  assert.match(output, /\/_astro\//);
  assert.throws(() => prepareHomepage('<h1>Fake page</h1>'), /checked-in homepage/);
});
test('accepts every playable revision from v2 on, not one pinned version', () => {
  const page = v => `<meta data-cc-playable-hydration-safe content="1"><script>document.documentElement.dataset.ccPlayableVersion = '${v}';</script>`;
  for (const v of ['2', '3', '12']) assert.doesNotThrow(() => prepareHomepage(page(v)), `v${v}`);
  assert.throws(() => prepareHomepage(page('1')), /v2\+/);
  assert.equal(playableVersion(page('3')), 3);
  assert.equal(playableVersion('<h1>none</h1>'), 0);
});
test('keeps all previously supported feature pages and directory routes', () => {
  assert.equal(PAGES.length, 12);
  assert.ok(PAGES.includes('/features/ai-music'));
  assert.equal(outputConfig().routes.filter(x => x.dest).length, 13);
});

test('guards the production-only session lookup in hydrated navbar modules', () => {
  const code = 'a.useEffect(()=>{fetch(`${t}/auth/get-session`,{credentials:"include"}).then(x=>x.json())},[t]);';
  const patched = guardProductionSession(code);
  assert.match(patched, /if\(window.location.origin!=="https:\/\/chatcut.io"\)return;/);
  assert.equal(guardProductionSession(patched), patched);
  assert.match(patched, /fetch/);
});

test('commits initial Astro React hydration before releasing DOM ownership', () => {
  const original = 'na.startTransition(()=>{my(T,()=>{const il=vy.hydrateRoot(T,_,_a);';
  const fixed = synchronizeAstroHydration(original);
  assert.match(fixed, /jh\(\)\.flushSync/);
  assert.match(fixed, /hydrateRoot/);
  assert.doesNotMatch(fixed, /suppressHydrationWarning|onRecoverableError/);
  assert.equal(synchronizeAstroHydration(fixed), fixed);
  assert.throws(() => synchronizeAstroHydration('changed(()=>{const il=vy.hydrateRoot(T,_,_a);'), /contract/);
});

test('does not let the passive transcript animation overwrite an interactive edit', () => {
  const result = stopAutoplayTranscript('St=e=>{const n=e>=.22,s=e>=.38;');
  assert.match(result, /window\.__chatcutDemoSession/);
  assert.match(result, /\+document\.documentElement\.dataset\.ccPlayableVersion>=2/);
  assert.equal(stopAutoplayTranscript(result), result);
});
test('prefers live visible controls over hidden static fallback duplicates', async () => {
  const source = await fs.readFile(new URL('../../chatcut-playable/index.html', import.meta.url), 'utf8');
  const result = prepareVisibleControls(source);
  assert.match(result, /getClientRects\(\)\.length > 0/);
  assert.match(result, /status\.parentElement !== dock/);
});
