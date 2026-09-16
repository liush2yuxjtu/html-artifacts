import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BASELINE_FEATURE_PATHS, shouldDownloadMedia, outputPathForRawSnapshot, rewriteRuntimeAssetUrls, classifyMediaFailure, buildMediaMap } from '../scripts/mirror.mjs';

const expected = [
  '/features/ai-video-editor',
  '/features/ai-motion-graphics',
  '/features/ai-video-generator',
  '/features/ai-captions',
  '/features/ai-voiceover',
  '/features/ai-music',
  '/features/ai-image-generator',
  '/features/ai-noise-removal',
  '/features/ai-sound-effects',
  '/features/text-based-editing',
];

test('baseline includes every audited English feature page', () => {
  for (const pathname of expected) assert.ok(BASELINE_FEATURE_PATHS.includes(pathname), pathname);
  assert.equal(BASELINE_FEATURE_PATHS.some(x => /\/(?:zh|zh-hant|es|ja)\//.test(x)), false);
});

test('download policy includes public media and excludes fonts/runtime bundles', () => {
  assert.equal(shouldDownloadMedia('https://cdn.chatcut.dev/x.mp4'), true);
  assert.equal(shouldDownloadMedia('https://chatcut.io/x.webp'), true);
  assert.equal(shouldDownloadMedia('https://chatcut.io/x.svg'), true);
  assert.equal(shouldDownloadMedia('https://chatcut.io/_astro/inter.woff2'), false);
  assert.equal(shouldDownloadMedia('https://chatcut.io/_astro/index.css'), false);
  assert.equal(shouldDownloadMedia('https://chatcut.io/_astro/island.js'), false);
});

test('raw snapshots use stable audit paths', () => {
  assert.equal(outputPathForRawSnapshot('/'), '_raw/home.source.html');
  assert.equal(outputPathForRawSnapshot('/features/ai-music'), '_raw/features/ai-music.source.html');
});

test('vercel config runs tests before full mirror deploy and proxies Astro runtime same-origin', async () => {
  const vercel = JSON.parse(await fs.readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.buildCommand, 'npm run ci:predeploy');
  assert.equal(vercel.outputDirectory, 'dist');
  assert.ok(vercel.rewrites?.some(rule =>
    rule.source === '/_astro/:path*' && rule.destination === 'https://chatcut.io/_astro/:path*'
  ));
  const gitignore = await fs.readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(gitignore, /(^|\n)dist\/?($|\n)/);
});

test('normalizes production Astro runtime URLs to the same-origin proxy', () => {
  const html = `<script src="https://chatcut.io/_astro/a.js"></script><script>const x='https:\\/\\/chatcut.io\\/_astro\\/b.js'</script>`;
  const out = rewriteRuntimeAssetUrls(html);
  assert.match(out, /src="\/_astro\/a\.js"/);
  assert.match(out, /const x='\\\/_astro\\\/b\.js'/);
});

test('treats upstream 404/410 as documented source drift but keeps real fetch failures fatal', () => {
  assert.equal(classifyMediaFailure(new Error('404 Not Found')), 'upstream-missing');
  assert.equal(classifyMediaFailure(new Error('410 Gone')), 'upstream-missing');
  assert.equal(classifyMediaFailure(new Error('403 Forbidden')), 'failed');
  assert.equal(classifyMediaFailure(new Error('The operation was aborted')), 'failed');
});

test('full-media rewrite map includes only successfully downloaded assets', () => {
  const map = buildMediaMap([
    { url: 'https://chatcut.io/a.webp', status: 'downloaded', localPath: '/_mirror/chatcut.io/a.webp' },
    { url: 'https://chatcut.io/dead.webp', status: 'failed', localPath: null },
  ], 'local');
  assert.equal(map.get('https://chatcut.io/a.webp'), '/_mirror/chatcut.io/a.webp');
  assert.equal(map.has('https://chatcut.io/dead.webp'), false);
});
