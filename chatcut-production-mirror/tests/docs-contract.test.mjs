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

test('Chinese ELI5 intent.html explains original component to one trigger to original result', async () => {
  const html = await read('intent.html');
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /原组件/);
  assert.match(html, /一个动作/);
  assert.match(html, /原结果/);
  assert.match(html, /不重建/);
  assert.match(html, /feature pages/i);
  assert.match(html, /href="\/"/);
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
