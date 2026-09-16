import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BASELINE_FEATURE_PATHS, shouldDownloadMedia, outputPathForRawSnapshot } from '../scripts/mirror.mjs';

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

test('vercel config builds to dist and dist is gitignored', async () => {
  const vercel = JSON.parse(await fs.readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.buildCommand, 'npm run build');
  assert.equal(vercel.outputDirectory, 'dist');
  const gitignore = await fs.readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(gitignore, /(^|\n)dist\/?($|\n)/);
});
