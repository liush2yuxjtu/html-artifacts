import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PRODUCTION_SELECTORS, MUSIC_PROMPT, IMAGE_BEFORE_ASSET } from '../patches/home.js';

test('patch targets copied production components instead of replacement mock sections', () => {
  assert.equal(PRODUCTION_SELECTORS.bestMoments, '#best-moments');
  assert.equal(PRODUCTION_SELECTORS.bestMomentsVideo, '.bm-final-video');
  assert.equal(PRODUCTION_SELECTORS.motion, '#motion-graphics');
  assert.equal(PRODUCTION_SELECTORS.transcript, '#transcript-captions [data-tc-part="edit"]');
  assert.equal(PRODUCTION_SELECTORS.captions, '#transcript-captions [data-tc-part="captions"]');
  assert.equal(PRODUCTION_SELECTORS.imageStory, '#image-to-video .itv-story:not(.itv-story-video)');
  assert.equal(PRODUCTION_SELECTORS.videoStory, '#image-to-video .itv-story-video');
  assert.equal(PRODUCTION_SELECTORS.music, '#music-generation');
});

test('image and music story use approved original-source intent', () => {
  assert.equal(IMAGE_BEFORE_ASSET, 'https://chatcut.io/features/ai-image-generator/cat-white-before.webp');
  assert.equal(MUSIC_PROMPT, 'Upbeat lo-fi hip hop, relaxed mood, 90 BPM');
});

test('homepage patch intercepts local demo triggers and does not patch captions', async () => {
  const source = await fs.readFile(new URL('../patches/home.js', import.meta.url), 'utf8');
  assert.match(source, /preventDefault\(\)/);
  assert.match(source, /EXPERT_START/);
  assert.match(source, /MOTION_GENERATE/);
  assert.match(source, /TRANSCRIPT_START/);
  assert.match(source, /IMAGE_START/);
  assert.match(source, /VIDEO_START/);
  assert.match(source, /MUSIC_START/);
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
