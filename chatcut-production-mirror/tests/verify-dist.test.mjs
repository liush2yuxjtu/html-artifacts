import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractLocalFeatureLinks, extractLocalResourcePaths, verifyDist } from '../scripts/verify-dist.mjs';

async function makeFixture() {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'chatcut-dist-'));
  await fs.mkdir(path.join(dist, 'patches'), { recursive: true });
  await fs.mkdir(path.join(dist, '_meta'), { recursive: true });
  await fs.mkdir(path.join(dist, '_mirror/chatcut.io'), { recursive: true });
  await fs.mkdir(path.join(dist, 'features/ai-captions'), { recursive: true });
  await fs.writeFile(path.join(dist, 'patches/home.css'), 'body{}');
  await fs.writeFile(path.join(dist, 'patches/home.js'), '');
  await fs.writeFile(path.join(dist, '_mirror/chatcut.io/favicon.svg'), '<svg/>');
  await fs.writeFile(path.join(dist, 'features/ai-captions/index.html'), '<h1>captions</h1>');
  await fs.writeFile(path.join(dist, 'intent.html'), '<h1>Intent</h1>');
  await fs.writeFile(path.join(dist, 'index.html'), '<link rel="icon" href="/_mirror/chatcut.io/favicon.svg"><a href="/features/ai-captions">Captions</a><link rel="stylesheet" href="/patches/home.css">');
  await fs.writeFile(path.join(dist, '_meta/page-manifest.json'), JSON.stringify({ pages: [
    { pathname: '/', output: 'index.html' },
    { pathname: '/features/ai-captions', output: 'features/ai-captions/index.html' },
  ] }));
  await fs.writeFile(path.join(dist, '_meta/asset-manifest.json'), JSON.stringify({ media: [] }));
  return dist;
}

test('extracts local resources and feature links that must survive deployment', () => {
  const html = '<img src="/_mirror/a.webp"><video poster="/_mirror/p.jpg"></video><style>.x{background:url(/_mirror/bg.png)}</style><a href="/features/ai-music">Music</a>';
  assert.deepEqual(extractLocalResourcePaths(html), ['/_mirror/a.webp', '/_mirror/bg.png', '/_mirror/p.jpg']);
  assert.deepEqual(extractLocalFeatureLinks(html), ['/features/ai-music']);
});

test('passes when review artifact, mirrored routes, and local assets are deployable', async () => {
  const dist = await makeFixture();
  const summary = await verifyDist(dist);
  assert.equal(summary.mirroredRoutes, 2);
  assert.equal(summary.requiredFiles, 6);
});

test('fails before deploy when intent.html or a local resource would 404', async () => {
  const dist = await makeFixture();
  await fs.rm(path.join(dist, 'intent.html'));
  await fs.writeFile(path.join(dist, 'index.html'), '<img src="/_mirror/missing.svg"><a href="/features/ai-captions">Captions</a>');
  await assert.rejects(() => verifyDist(dist), error => {
    assert.match(error.message, /missing required file: intent\.html/);
    assert.match(error.message, /broken local resource in index\.html: \/_mirror\/missing\.svg/);
    return true;
  });
});
