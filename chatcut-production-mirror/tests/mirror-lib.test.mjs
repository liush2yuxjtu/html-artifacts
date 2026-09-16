import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverFeaturePaths, extractAssetUrls, assetOutputPath, pageOutputPath, sanitizeHtml, rewritePageLinks, rewriteMediaUrls, injectHomepagePatch } from '../scripts/mirror-lib.mjs';

test('discovers unique English feature paths only', () => {
  const html = `<a href="/features/ai-video-editor">Editor</a><a href="https://chatcut.io/features/ai-music?x=1">Music</a><a href="/zh/features/ai-captions">ZH</a><a href="/features/ai-video-editor#x">dup</a><a href="/blog/x">blog</a>`;
  assert.deepEqual(discoverFeaturePaths(html), ['/features/ai-music','/features/ai-video-editor']);
});

test('extracts media, stylesheet and script assets, including inline absolute URLs, while excluding fonts', () => {
  const html = `<link rel="stylesheet" href="/_astro/index.css"><link rel="preload" as="font" href="/_astro/inter.woff2"><script type="module" src="/_astro/island.js"></script><img src="/img/a.webp"><video src="https://cdn.chatcut.dev/a.mp4" poster="/img/p.jpg"></video><div style="background-image:url('/img/bg.png')"></div><astro-island props="{&quot;videoUrl&quot;:[0,&quot;https://cdn.chatcut.dev/b.mp4&quot;],&quot;image&quot;:[0,&quot;https://chatcut.io/img/c.svg&quot;]}"></astro-island>`;
  const result = extractAssetUrls(html, 'https://chatcut.io/features/ai-video-editor');
  assert.deepEqual(result.stylesheets, ['https://chatcut.io/_astro/index.css']);
  assert.deepEqual(result.scripts, ['https://chatcut.io/_astro/island.js']);
  for (const url of ['https://chatcut.io/img/a.webp','https://cdn.chatcut.dev/a.mp4','https://chatcut.io/img/p.jpg','https://chatcut.io/img/bg.png','https://cdn.chatcut.dev/b.mp4','https://chatcut.io/img/c.svg']) assert.ok(result.media.includes(url), url);
  assert.equal(result.media.some(x => x.endsWith('.woff2')), false);
});

test('asset output path is deterministic, host namespaced and never emits font files', () => {
  assert.equal(assetOutputPath('https://cdn.chatcut.dev/path/video.mp4?x=1'), '_mirror/cdn.chatcut.dev/path/video.mp4');
  assert.throws(() => assetOutputPath('https://chatcut.io/_astro/inter.woff2'), /font/i);
});

test('maps page routes to directory index files', () => {
  assert.equal(pageOutputPath('/'), 'index.html');
  assert.equal(pageOutputPath('/features'), 'features/index.html');
  assert.equal(pageOutputPath('/features/ai-music'), 'features/ai-music/index.html');
});

test('sanitizes analytics and auth redirect scripts but keeps Astro product islands', () => {
  const html = `<!doctype html><html><head><script src="https://www.googletagmanager.com/gtm.js?id=x"></script><script>window.posthog?.capture('x')</script><script type="module" src="/_astro/Navbar.js"></script></head><body><script>fetch('https://api.chatcut.io/auth/get-session').then(()=>window.location.replace('https://app.chatcut.io/'))</script><astro-island component-url="/_astro/Thing.js"></astro-island></body></html>`;
  const out = sanitizeHtml(html);
  assert.equal(out.includes('googletagmanager'), false); assert.equal(out.includes('posthog'), false); assert.equal(out.includes('auth/get-session'), false); assert.equal(out.includes('/_astro/Navbar.js'), true); assert.equal(out.includes('<astro-island'), true);
});

test('rewrites same-origin non-mirror links to live ChatCut and preserves mirror routes', () => {
  const out = rewritePageLinks(`<a href="/">Home</a><a href="/features/ai-music">Music</a><a href="/pricing">Pricing</a><script src="/_astro/x.js"></script>`);
  assert.match(out, /href="\/"/); assert.match(out, /href="\/features\/ai-music"/); assert.match(out, /href="https:\/\/chatcut\.io\/pricing"/); assert.match(out, /src="https:\/\/chatcut\.io\/_astro\/x\.js"/);
});

test('rewrites media URLs using exact URL map without touching unrelated URLs', () => {
  const out = rewriteMediaUrls(`<img src="https://chatcut.io/a.webp"><a href="https://chatcut.io/pricing">x</a>`, new Map([['https://chatcut.io/a.webp','/_mirror/chatcut.io/a.webp']]));
  assert.match(out, /src="\/_mirror\/chatcut\.io\/a\.webp"/); assert.match(out, /href="https:\/\/chatcut\.io\/pricing"/);
});

test('injects homepage patch exactly once', () => {
  const twice = injectHomepagePatch(injectHomepagePatch('<!doctype html><html><head></head><body></body></html>'));
  assert.equal((twice.match(/\/patches\/home\.css/g) ?? []).length, 1); assert.equal((twice.match(/\/patches\/home\.js/g) ?? []).length, 1); assert.equal((twice.match(/\/patches\/demo-session\.js/g) ?? []).length, 0);
});
