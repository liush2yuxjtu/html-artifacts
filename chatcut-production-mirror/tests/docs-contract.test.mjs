import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function read(name) {
  return fs.readFile(new URL(`../${name}`, import.meta.url), 'utf8');
}

test('intent.md records copy-edit architecture and every homepage decision', async () => {
  const text = await read('intent.md');
  for (const phrase of [
    'copy first, edit second',
    'Edit Like an Expert Editor',
    'AI Motion Graphics',
    'Text-Based Editing',
    'Auto AI Captions',
    'AI Image Generation',
    'AI Video Generation',
    'AI Music Generator',
    'Pricing',
    'Draft PR',
    'do not merge',
  ]) assert.match(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), phrase);
});

test('intent.html is a real Screens + Flows review surface backed by runtime screenshots', async () => {
  const html = await read('intent.html');
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /Screens \+ Flows/i);
  for (const flow of ['F01','F02','F03','F04','F05','F06']) assert.match(html, new RegExp(flow));
  for (const screen of ['S00','S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13']) assert.match(html, new RegExp(screen));
  for (const asset of ['02-expert-before.png','03-expert-after.png','09-image-before.png','10-image-after.png','15-pricing.png']) assert.match(html, new RegExp(asset.replace('.', '\\.')));
  assert.match(html, /Local DemoSession/);
  assert.match(html, /不声称调用真实生成后端/);
});

test('intent.md carries versioned traceability and an explicit intent-drift guard', async () => {
  const text = await read('intent.md');
  assert.match(text, /chatcut-homepage-causal-demo-v2/);
  assert.match(text, /Intent drift guard/);
  assert.match(text, /Duplicate or contradictory state labels are an intent failure/);
  for (const flow of ['F01','F02','F03','F04','F05','F06']) assert.match(text, new RegExp(flow));
});

test('every screenshot referenced by intent.html exists in intent-assets', async () => {
  const html = await read('intent.html');
  const refs = [...html.matchAll(/src="\/intent-assets\/([^"]+)"/g)].map(match => match[1]);
  assert.ok(refs.length >= 15);
  for (const ref of refs) await fs.access(new URL(`../intent-assets/${ref}`, import.meta.url));
});

test('README documents preview/full mirror modes, raw snapshots, and media provenance', async () => {
  const readme = await read('README.md');
  assert.match(readme, /npm run build/);
  assert.match(readme, /npm run mirror:full/);
  assert.match(readme, /_raw/);
  assert.match(readme, /chatcut\.io/);
  assert.match(readme, /font/i);
  assert.match(readme, /feature/i);
});

test('captions contract matches the shipped first-frame gate (F07), not KEEP', async () => {
  const text = await read('intent.md');
  const html = await read('intent.html');
  assert.match(text, /\| F07 \|[^\n]*first frame/i);
  assert.doesNotMatch(text, /\| KEEP \|[^\n]*Captions/, 'captions must not be listed as KEEP while the playable gates them');
  assert.match(text, /F01–F07 complete/);
  assert.match(html, /F07 · Auto AI Captions/);
  assert.match(html, /08a-captions-before\.png/);
  const build = await fs.readFile(new URL('../../chatcut-mirror-src/build.mjs', import.meta.url), 'utf8');
  assert.match(build, /lockCaptionFirstFrame/, 'if the gate is removed from build.mjs, revise intent.md F07 in the same change');
});
