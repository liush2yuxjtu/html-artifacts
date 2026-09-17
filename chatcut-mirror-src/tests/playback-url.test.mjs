import test from 'node:test';
import assert from 'node:assert/strict';
import { localizePlaybackFactory } from '../vercel-build.mjs';
const original = 'const c=x=>x,p="https://cdn.chatcut.dev/playback",a=(t,i)=>`${c(p)}/${t}`;';
const imageMap = {'https://cdn.chatcut.dev/playback/talking-head-filmstrip.jpg':'/_media/cdn.chatcut.dev/playback/talking-head-filmstrip.jpg'};
test('dynamic playback image uses the packaged original image', () => {
  const fixed = localizePlaybackFactory(original, imageMap);
  const factory = new Function(fixed + 'return a;')();
  assert.equal(factory('talking-head-filmstrip.jpg'), imageMap['https://cdn.chatcut.dev/playback/talking-head-filmstrip.jpg']);
  assert.equal(factory('talking-head-final.mp4'), 'https://cdn.chatcut.dev/playback/talking-head-final.mp4');
  assert.equal(factory('unpackaged.jpg'), 'https://cdn.chatcut.dev/playback/unpackaged.jpg');
});
test('unrelated modules are not rewritten', () => {
  assert.equal(localizePlaybackFactory('const x=1;', imageMap), 'const x=1;');
});
test('changed URL factory fails closed instead of silently corrupting code', () => {
  assert.throws(()=>localizePlaybackFactory('p="https://cdn.chatcut.dev/playback",a=(t,i)=>build(t);',imageMap), /contract/);
});
