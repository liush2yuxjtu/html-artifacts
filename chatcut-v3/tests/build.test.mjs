// node --test chatcut-v3/tests/build.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyPatch } from '../scripts/build.mjs';

const ROOT = path.resolve('chatcut-v3');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const baseline = read('site/baseline.html');
const css = read('runtime/patch.css');
const js = read('runtime/patch.js');
const built = applyPatch(baseline, css, js);
const manifest = JSON.parse(read('baseline/manifest.json'));

test('baseline is chatcut.io variant B with the runtime localized', () => {
  for (const id of ['editor-demo', 'creator-wall', 'creative-workflow', 'skills-styles', 'connect', 'features-gallery', 'pricing', 'faq', 'final-cta']) {
    assert.ok(baseline.includes(`id="${id}"`), `missing #${id}`);
  }
  assert.ok(!/https:\/\/chatcut\.io\/_astro\//.test(baseline), 'runtime must not load from chatcut.io');
  const islands = [...baseline.matchAll(/component-url="([^"]+)"/g)].map(m => m[1]);
  assert.ok(islands.length >= 5);
  for (const url of islands) {
    assert.match(url, /^\.\/_astro\//);
    assert.ok(fs.existsSync(path.join(ROOT, 'site', url)), `island module missing: ${url}`);
  }
  // Experiment bookkeeping stays as data-* attributes; no tracker may load.
  const loaders = [...baseline.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*>|<img\b[^>]*>/gi)].map(m => m[0]);
  const trackers = loaders.filter(tag => /googletagmanager|posthog\.com|i\.posthog|ahrefs|firstpromoter|cloudflareinsights/i.test(tag));
  assert.deepEqual(trackers.map(t => t.slice(0, 80)), [], 'tracking must be stripped');
});

test('both experiment variants are preserved raw', () => {
  const b = read('baseline/raw/variant-b.html');
  assert.equal(manifest.experimentCookie, 'chatcut_homepage_415_20260920_id');
  assert.ok(b.includes('id="creator-wall"'));
  if (manifest.variants.a) assert.ok(read('baseline/raw/variant-a.html').includes('id="best-moments"'));
});

test('patch is injected exactly once and verbatim', () => {
  assert.equal(built.match(/<script data-cc-v3-patch>/g).length, 1);
  assert.equal(built.match(/<style data-cc-v3-patch>/g).length, 1);
  // Regression: String.replace patterns like $' inside the patch must not expand.
  assert.ok(built.includes(js), 'patch.js must be embedded byte-for-byte');
  assert.ok(built.includes(css), 'patch.css must be embedded byte-for-byte');
  assert.throws(() => applyPatch(built, css, js), /already carries/);
});

test('agent panels switch from finished-run to manual play', () => {
  const tags = [...built.matchAll(/<div class="(?:cxwin-root|ccr)"[^>]*>/g)].map(m => m[0]);
  assert.equal(tags.length, 2);
  for (const tag of tags) {
    assert.ok(!/\sdata-conversation-only\b/.test(tag), tag.slice(0, 80));
    assert.equal((tag.match(/\sdata-manual\b/g) || []).length, 1, 'exactly one data-manual');
  }
  // Only those two tags change; everything else is the baseline.
  const strip = html => html.replace(/<div class="(?:cxwin-root|ccr)"[^>]*>/g, '').replace(/<style data-cc-v3-patch>[\s\S]*?<\/style>|<script data-cc-v3-patch>[\s\S]*?<\/script>|<meta name="cc-v3-playable"[^>]*>/g, '');
  assert.equal(strip(built), strip(baseline));
});

test('patch makes no network requests and never claims new generation', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(js));
  assert.ok(!/\bgenerated\b|\bnew (video|edit|cut)\b/i.test(js.match(/const COPY = \{[\s\S]*?\};/)[0]));
});

test('rejects a variant A document', () => {
  if (!manifest.variants.a) return;
  assert.throws(() => applyPatch(read('baseline/raw/variant-a.html'), css, js), /variant B/);
});

test('compare page frames the frozen original next to the playable', () => {
  const compare = read('runtime/compare.html');
  assert.equal(read('site/compare.html'), compare, 'site/compare.html is stale: run build.mjs');
  assert.match(compare, /id="frame-orig"[^>]*src="baseline\.html"/);
  assert.match(compare, /id="frame-play"[^>]*src="index\.html"/);
  for (const id of ['editor-demo', 'connect']) assert.ok(compare.includes(`data-jump="${id}"`), `missing jump to #${id}`);
});

test('SessionStart soft gate points at an existing, non-blocking check', () => {
  const settings = JSON.parse(fs.readFileSync(path.resolve('.claude/settings.json'), 'utf8'));
  const cmd = settings.hooks.SessionStart.flatMap(h => h.hooks).map(h => h.command).join('\n');
  assert.match(cmd, /chatcut-v3\/scripts\/check-hooks\.sh" --claude/);
  assert.match(cmd, /\|\| true/, 'the reminder must never fail the session');
  const script = fs.readFileSync(path.resolve('chatcut-v3/scripts/check-hooks.sh'), 'utf8');
  assert.match(script, /exit 0\s*$/, 'check-hooks.sh must always exit 0');
  assert.ok(fs.existsSync(path.resolve('.githooks/post-merge')));
});
