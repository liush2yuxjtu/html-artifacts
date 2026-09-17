import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractRuntimeRefs, normalizeRuntimeUrl } from '../scripts/pin-runtime.mjs';
import { verifyDist } from '../scripts/verify-dist.mjs';

test('dynamic template asset placeholders are never fetched as static runtime files', () => {
  assert.equal(
    normalizeRuntimeUrl('https://chatcut.io/features/ai-image-generator/showcase/tl-${e%6+1}.webp'),
    null,
  );
  assert.equal(
    normalizeRuntimeUrl('https://chatcut.io/features/ai-image-generator/showcase/tl-$%7Be%6+1%7D.webp'),
    null,
  );
  assert.deepEqual(
    extractRuntimeRefs(
      'a{background:url(https://chatcut.io/features/ai-image-generator/showcase/tl-${e%6+1}.webp)}b{background:url(https://chatcut.io/features/ai-image-generator/showcase/tl-$%7Be%6+1%7D.webp)}',
      'https://chatcut.io/_astro/index.TEST.css',
    ),
    [],
  );
});

async function makeRuntimeFixture() {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'chatcut-runtime-hardening-'));
  await fs.mkdir(path.join(dist, 'patches'), { recursive: true });
  await fs.mkdir(path.join(dist, '_meta'), { recursive: true });
  await fs.mkdir(path.join(dist, '_mirror/chatcut.io'), { recursive: true });
  await fs.mkdir(path.join(dist, '_astro'), { recursive: true });
  await fs.mkdir(path.join(dist, 'editor-mock'), { recursive: true });
  await fs.mkdir(path.join(dist, 'features/ai-captions'), { recursive: true });
  await fs.writeFile(path.join(dist, 'patches/home.css'), 'body{}');
  await fs.writeFile(path.join(dist, 'patches/home.js'), '');
  await fs.writeFile(path.join(dist, '_mirror/chatcut.io/favicon.svg'), '<svg/>');
  await fs.writeFile(path.join(dist, '_astro/client.js'), 'export{}');
  await fs.writeFile(path.join(dist, 'editor-mock/waveform.svg'), '<svg/>');
  await fs.writeFile(path.join(dist, 'features/ai-captions/index.html'), '<h1>captions</h1>');
  await fs.writeFile(path.join(dist, 'intent.html'), '<h1>Intent</h1>');
  await fs.writeFile(
    path.join(dist, 'index.html'),
    '<script type="module" src="/_astro/client.js"></script><link rel="icon" href="/_mirror/chatcut.io/favicon.svg"><a href="/features/ai-captions">Captions</a><link rel="stylesheet" href="/patches/home.css">',
  );
  await fs.writeFile(path.join(dist, '_meta/page-manifest.json'), JSON.stringify({ pages: [
    { pathname: '/', output: 'index.html' },
    { pathname: '/features/ai-captions', output: 'features/ai-captions/index.html' },
  ] }));
  await fs.writeFile(path.join(dist, '_meta/asset-manifest.json'), JSON.stringify({ mediaMode: 'local', media: [
    { url: 'https://chatcut.io/favicon.svg', status: 'downloaded', localPath: '/_mirror/chatcut.io/favicon.svg' },
  ] }));
  await fs.writeFile(path.join(dist, '_meta/runtime-manifest.json'), JSON.stringify({ assets: [
    { url: 'https://chatcut.io/_astro/client.js', output: '/_astro/client.js', bytes: 8 },
    { url: 'https://chatcut.io/editor-mock/waveform.svg', output: '/editor-mock/waveform.svg', bytes: 6 },
  ] }));
  return dist;
}

test('same-origin CSS dependencies may be pinned outside _astro when the local file exists', async () => {
  const dist = await makeRuntimeFixture();
  const summary = await verifyDist(dist);
  assert.equal(summary.pinnedRuntimeAssets, 2);
});
