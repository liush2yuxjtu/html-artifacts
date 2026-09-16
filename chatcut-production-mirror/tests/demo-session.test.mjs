import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSession, transitionDemo } from '../patches/demo-session.js';

test('creates one idle shared demo session', () => {
  assert.deepEqual(createDemoSession(), {
    expert: 'idle',
    motion: 'idle',
    transcript: 'raw',
    image: 'source',
    video: 'reference',
    music: 'silent',
  });
});

test('applies all approved transitions without mutating prior state', () => {
  const initial = createDemoSession();
  const actions = [
    ['EXPERT_START','expert','running'], ['EXPERT_DONE','expert','done'],
    ['MOTION_GENERATE','motion','done'],
    ['TRANSCRIPT_START','transcript','cleaning'], ['TRANSCRIPT_DONE','transcript','clean'],
    ['IMAGE_START','image','loading'], ['IMAGE_DONE','image','generated'],
    ['VIDEO_START','video','loading'], ['VIDEO_DONE','video','generated'],
    ['MUSIC_START','music','loading'], ['MUSIC_DONE','music','generated'],
  ];
  let current = initial;
  for (const [type,key,value] of actions) {
    const previous = current;
    current = transitionDemo(current, { type });
    assert.equal(current[key], value, type);
    assert.notEqual(current, previous, `${type} returns a new object`);
  }
  assert.deepEqual(initial, {
    expert: 'idle', motion: 'idle', transcript: 'raw', image: 'source', video: 'reference', music: 'silent',
  });
});

test('ignores unknown actions safely', () => {
  const session = createDemoSession();
  assert.deepEqual(transitionDemo(session, {type:'NOPE'}), session);
});
