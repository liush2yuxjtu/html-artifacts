import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRuntimeRefs, normalizeRuntimeUrl, runtimeOutputPath, shouldScanRuntimeHtml, localizeRuntimeText } from '../scripts/pin-runtime.mjs';

test('normalizes ChatCut Astro runtime and same-origin CSS dependency URLs only', () => {
  assert.equal(normalizeRuntimeUrl('/_astro/index.ABC.css'), 'https://chatcut.io/_astro/index.ABC.css');
  assert.equal(normalizeRuntimeUrl('https://chatcut.io/_astro/chunk.X.js'), 'https://chatcut.io/_astro/chunk.X.js');
  assert.equal(normalizeRuntimeUrl('/editor-mock/waveform.svg', 'https://chatcut.io/_astro/index.ABC.css'), 'https://chatcut.io/editor-mock/waveform.svg');
  assert.equal(normalizeRuntimeUrl('https://example.com/_astro/chunk.X.js'), null);
  assert.equal(normalizeRuntimeUrl('/pricing', 'https://chatcut.io/_astro/index.ABC.css'), null);
});

test('runtime output path preserves same-origin production asset paths', () => {
  assert.equal(runtimeOutputPath('https://chatcut.io/_astro/index.ABC.css?x=1'), '_astro/index.ABC.css');
  assert.equal(runtimeOutputPath('https://chatcut.io/editor-mock/waveform.svg'), 'editor-mock/waveform.svg');
});

test('extracts root, absolute, escaped, and relative runtime dependencies', () => {
  const source = `
    import '/_astro/root.A.js';
    import('./chunk.B.js');
    const css = 'https:\\/\\/chatcut.io\\/_astro\\/theme.C.css';
    @font-face{src:url(./inter.D.woff2)}
    const nope = 'https://example.com/_astro/nope.js';
  `;
  const refs = extractRuntimeRefs(source, 'https://chatcut.io/_astro/entry.Z.js');
  assert.deepEqual(refs, [
    'https://chatcut.io/_astro/chunk.B.js',
    'https://chatcut.io/_astro/inter.D.woff2',
    'https://chatcut.io/_astro/root.A.js',
    'https://chatcut.io/_astro/theme.C.css',
  ]);
});

test('extracts same-directory bare CSS runtime filenames', () => {
  const refs = extractRuntimeRefs(
    '@font-face{src:url(stack-sans-notch-latin-700-normal.TEST.woff2) format("woff2")}',
    'https://chatcut.io/_astro/index.TEST.css',
  );
  assert.deepEqual(refs, [
    'https://chatcut.io/_astro/stack-sans-notch-latin-700-normal.TEST.woff2',
  ]);
});

test('extracts production-root CSS dependencies so they can be pinned locally', () => {
  const refs = extractRuntimeRefs(
    'a{background:url(/editor-mock/waveform.svg)}b{background:url("/images/grid.webp")}',
    'https://chatcut.io/_astro/index.TEST.css',
  );
  assert.deepEqual(refs, [
    'https://chatcut.io/editor-mock/waveform.svg',
    'https://chatcut.io/images/grid.webp',
  ]);
});

test('runtime css keeps same-origin assets local instead of creating CORS requests', () => {
  const css = 'a{src:url("/_astro/font.A.woff2")}b{background:url(/editor-mock/waveform.svg)}c{background:url(https://chatcut.io/images/grid.webp)}';
  const out = localizeRuntimeText(css);
  assert.match(out, /url\("\/_astro\/font\.A\.woff2"\)/);
  assert.match(out, /url\(\/editor-mock\/waveform\.svg\)/);
  assert.match(out, /url\(\/images\/grid\.webp\)/);
  assert.doesNotMatch(out, /https:\/\/chatcut\.io\/editor-mock\/waveform\.svg/);
});

test('runtime pinning scans served html but never immutable raw audit snapshots', () => {
  assert.equal(shouldScanRuntimeHtml('index.html'), true);
  assert.equal(shouldScanRuntimeHtml('features/ai-motion-graphics/index.html'), true);
  assert.equal(shouldScanRuntimeHtml('_raw/home.source.html'), false);
  assert.equal(shouldScanRuntimeHtml('_raw/features/ai-motion-graphics.source.html'), false);
  assert.equal(shouldScanRuntimeHtml('_meta/reference.html'), false);
  assert.equal(shouldScanRuntimeHtml('_meta/runtime-manifest.json'), false);
});
