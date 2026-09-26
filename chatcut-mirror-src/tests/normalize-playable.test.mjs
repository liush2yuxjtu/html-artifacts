import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeMedia, normalizeFile } from '../normalize-playable.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('points preview-only /_media references back at their public host', () => {
  const src = [
    '<img src="/_media/cdn.chatcut.dev/landing-hero/a.webp">',
    'poster:"https://chatcut-production-mirror-preview-73uactwqj.vercel.app/_media/cdn.chatcut.dev/playback/f.jpg"',
    "url('/_media/chatcut-beta-mainbucketbucket-bdabrmdk.s3.us-east-2.amazonaws.com/x/y.png')",
    '&quot;/_media/cdn.chatcut.dev/b.png&quot;',
  ].join('\n');
  const { text, count } = canonicalizeMedia(src);
  assert.equal(count, 4);
  assert.doesNotMatch(text, /\/_media\//);
  assert.match(text, /src="https:\/\/cdn\.chatcut\.dev\/landing-hero\/a\.webp"/);
  assert.match(text, /poster:"https:\/\/cdn\.chatcut\.dev\/playback\/f\.jpg"/);
  assert.match(text, /url\('https:\/\/chatcut-beta-mainbucketbucket-bdabrmdk\.s3\.us-east-2\.amazonaws\.com\/x\/y\.png'\)/);
  assert.match(text, /&quot;https:\/\/cdn\.chatcut\.dev\/b\.png&quot;/);
  assert.equal(canonicalizeMedia(text).count, 0, 'idempotent');
});

test('leaves ordinary paths alone', () => {
  const src = '<a href="/features/ai-music">x</a><img src="/_astro/a.png"><img src="/media/cdn.chatcut.dev/a.png">';
  assert.deepEqual(canonicalizeMedia(src), { text: src, count: 0 });
});

test('the committed playable carries no preview-only /_media references', async () => {
  const offenders = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:html|js|css|json)$/.test(entry.name) && (await fs.readFile(file, 'utf8')).includes('/_media/')) offenders.push(path.relative(ROOT, file));
    }
  }
  await walk(path.join(ROOT, 'chatcut-playable'));
  assert.deepEqual(offenders, []);
});

test('upgrades a transcript guard pinned to one playable version', () => {
  const legacy = 'St=e=>{if(window.__chatcutDemoSession&&document.documentElement.dataset.ccPlayableVersion==="2")return;const n=e>=.22';
  const { text, count } = normalizeFile('TranscriptCaptionsIsland.js', legacy);
  assert.equal(count, 1);
  assert.match(text, /\+document\.documentElement\.dataset\.ccPlayableVersion>=2\)return;/);
  assert.deepEqual(normalizeFile('TranscriptCaptionsIsland.js', text), { text, count: 0 });
  assert.equal(normalizeFile('index.html', legacy).text, legacy, 'only runtime JS is guarded');
});

test('the committed playable keeps the transcript guard live on the current version', async () => {
  const dir = path.join(ROOT, 'chatcut-playable/_astro');
  const sources = await Promise.all((await fs.readdir(dir)).filter(f => f.endsWith('.js')).map(f => fs.readFile(path.join(dir, f), 'utf8')));
  const guarded = sources.filter(s => s.includes('window.__chatcutDemoSession&&'));
  assert.ok(guarded.length > 0, 'transcript island is guarded');
  for (const s of guarded) assert.doesNotMatch(s, /ccPlayableVersion==="\d+"/);
});

test('root-absolute runtime assets survive a sub-path deploy', () => {
  const js = 'M={avatar:"/editor-scene/figma/avatar.svg",clip:`/editor-scene/vertical/clip.mp4`};async function St(){const e=await fetch("/landing-data/motion-templates/popular",{})}';
  const html = '&quot;iconSrc&quot;:[0,&quot;/codex-plugin/claude-mark.svg&quot;] <a href="/features/ai-music">';
  const a = normalizeFile('EditorSceneIsland.js', js).text;
  assert.match(a, /avatar:"https:\/\/chatcut\.io\/editor-scene\/figma\/avatar\.svg"/);
  assert.match(a, /clip:`https:\/\/chatcut\.io\/editor-scene\/vertical\/clip\.mp4`/);
  assert.match(a, /fetch\(new URL\("landing-data\/motion-templates\/popular\.json",document\.baseURI\)\.href/);
  const b = normalizeFile('index.html', html).text;
  assert.match(b, /&quot;https:\/\/chatcut\.io\/codex-plugin\/claude-mark\.svg&quot;/);
  assert.match(b, /href="\/features\/ai-music"/, 'page links are not assets');
  assert.equal(normalizeFile('x.js', a).count, 0);
});

test('the committed playable vendors the motion template feed it fetches', async () => {
  const feed = JSON.parse(await fs.readFile(path.join(ROOT, 'chatcut-playable/landing-data/motion-templates/popular.json'), 'utf8'));
  assert.ok(Array.isArray(feed.templates) && feed.templates.length > 0);
});
