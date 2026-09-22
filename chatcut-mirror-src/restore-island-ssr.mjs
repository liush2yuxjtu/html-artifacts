import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://chatcut.io';
const VERIFIED_FALLBACK = 'https://chatcut-production-mirror-preview-73uactwqj.vercel.app';
const FILE = path.resolve('chatcut-playable/index.html');

function extractIslands(html) {
  return Array.from(html.matchAll(/<astro-island\b[^>]*>[\s\S]*?<\/astro-island>/gi), match => match[0]);
}

function openingTag(block) {
  const end = block.indexOf('>');
  if (end < 0) throw new Error('Snapshot mismatch: malformed astro-island opening tag');
  return block.slice(0, end + 1);
}

function body(block) {
  const start = block.indexOf('>') + 1;
  const end = block.toLowerCase().lastIndexOf('</astro-island>');
  if (start <= 0 || end < start) throw new Error('Snapshot mismatch: malformed astro-island body');
  return block.slice(start, end);
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m?.[1] ?? m?.[2] ?? null;
}

function runtimeKey(tag) {
  const raw = attr(tag, 'component-url') || '';
  let component = raw;
  try { component = new URL(raw, ORIGIN).pathname; } catch {}
  return `${component}|${attr(tag, 'component-export') || ''}|${attr(tag, 'client') || ''}`;
}

function localizableOpening(tag, sourceOrigin) {
  for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) {
    const re = new RegExp(`(${name}\\s*=\\s*["'])(/(?!/)[^"']*)(["'])`, 'gi');
    tag = tag.replace(re, (_m, a, p, z) => `${a}${sourceOrigin}${p}${z}`);
  }
  return tag;
}

let frozen = await fs.readFile(FILE, 'utf8');
const sourceOrigin = frozen.includes('data-cc-mirror-source="verified-fallback"') ? VERIFIED_FALLBACK : ORIGIN;
const response = await fetch(`${sourceOrigin}/?mirror-ssr=${Date.now()}`, {
  redirect: 'follow',
  cache: 'no-store',
  headers: {
    'user-agent': 'Mozilla/5.0 ChatCutPlayableMirror/4.3',
    accept: 'text/html,application/xhtml+xml',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
  },
});
if (!response.ok) throw new Error(`Fetch failed ${response.status} ${sourceOrigin}/`);
const live = await response.text();

const liveIslands = extractIslands(live);
const frozenIslands = extractIslands(frozen);
if (!liveIslands.length || liveIslands.length !== frozenIslands.length) {
  throw new Error(`Snapshot mismatch: island count live=${liveIslands.length} frozen=${frozenIslands.length}`);
}

const replacements = [];
for (let i = 0; i < frozenIslands.length; i += 1) {
  const liveTag = openingTag(liveIslands[i]);
  const frozenTag = openingTag(frozenIslands[i]);
  if (runtimeKey(liveTag) !== runtimeKey(frozenTag)) {
    throw new Error(`Snapshot mismatch: island runtime changed at index ${i}`);
  }
  const restored = `${localizableOpening(liveTag, sourceOrigin)}${body(liveIslands[i])}</astro-island>`;
  replacements.push([frozenIslands[i], restored]);
}

for (const [from, to] of replacements) frozen = frozen.replace(from, to);
await fs.writeFile(FILE, frozen, 'utf8');
console.log(JSON.stringify({ ok: true, restoredIslands: replacements.length, sourceOrigin }, null, 2));
