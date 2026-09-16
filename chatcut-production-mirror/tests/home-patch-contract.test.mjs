import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sourceUrl = new URL('../patches/home.js', import.meta.url);

test('patch targets copied production components instead of replacement mock sections', async () => {
  const source = await fs.readFile(sourceUrl, 'utf8');
  for (const selector of [
    '#best-moments', '.bm-final-video', '#motion-graphics',
    '#transcript-captions [data-tc-part="edit"]',
    '#transcript-captions [data-tc-part="captions"]',
    '#image-to-video .itv-story:not(.itv-story-video)',
    '#image-to-video .itv-story-video', '#music-generation',
  ]) assert.ok(source.includes(selector), selector);
});

test('image and music story use approved original-source intent', async () => {
  const source = await fs.readFile(sourceUrl, 'utf8');
  assert.match(source, /https:\/\/chatcut\.io\/features\/ai-image-generator\/cat-white-before\.webp/);
  assert.match(source, /Upbeat lo-fi hip hop, relaxed mood, 90 BPM/);
});

test('homepage patch is self-contained classic script and intercepts local demo triggers', async () => {
  const source = await fs.readFile(sourceUrl, 'utf8');
  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /^export\s/m);
  assert.match(source, /function createDemoSession/);
  assert.match(source, /preventDefault\(\)/);
  for (const action of ['EXPERT_START','MOTION_GENERATE','TRANSCRIPT_START','IMAGE_START','VIDEO_START','MUSIC_START']) assert.match(source, new RegExp(action));
  assert.doesNotMatch(source, /setupCaptions\s*\(/);
});

test('homepage patch stylesheet only uses cc-prefixed custom state classes for new UI', async () => {
  const css = await fs.readFile(new URL('../patches/home.css', import.meta.url), 'utf8');
  assert.match(css, /\.cc-expert-awaiting/);
  assert.match(css, /\.cc-motion-awaiting/);
  assert.match(css, /\.cc-image-loading/);
  assert.match(css, /\.cc-video-reference-overlay/);
  assert.match(css, /\.cc-music-source-row/);
});
