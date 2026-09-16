import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://chatcut.io';
const ROOT = path.resolve('chatcut-playable');
const HTML_FILE = path.join(ROOT, 'index.html');
const ASTRO_PREFIX = `${ORIGIN}/_astro/`;

const seen = new Set();
const mirrored = [];

function isAstroJs(url) {
  try {
    const u = new URL(url, ORIGIN);
    return u.origin === ORIGIN && u.pathname.startsWith('/_astro/') && /\.m?js$/i.test(u.pathname);
  } catch {
    return false;
  }
}

function localFileFor(url) {
  const u = new URL(url, ORIGIN);
  return path.join(ROOT, u.pathname.replace(/^\/+/, ''));
}

function browserSpec(fromUrl, toUrl) {
  const fromPath = new URL(fromUrl, ORIGIN).pathname;
  const toPath = new URL(toUrl, ORIGIN).pathname;
  let rel = path.posix.relative(path.posix.dirname(fromPath), toPath);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 ChatCutPlayableMirror/3.0',
      accept: 'text/javascript,application/javascript,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`Runtime fetch failed ${response.status} ${url}`);
  return response.text();
}

async function mirrorModule(rawUrl) {
  const u = new URL(rawUrl, ORIGIN);
  u.hash = '';
  const url = u.href;
  if (!isAstroJs(url) || seen.has(url)) return;
  seen.add(url);

  let source = await fetchText(url);
  const dependencies = new Map();

  // Astro/Vite production chunks use quoted relative/root/absolute module specs.
  // Keep the original module graph, but rewrite any root/absolute same-origin JS
  // specifier to a relative same-origin path so GitHub Pages subpath hosting works.
  const quoted = /(["'`])((?:https:\/\/chatcut\.io)?(?:\.\.?\/|\/)[^"'`\s]+?\.m?js(?:\?[^"'`\s]*)?)\1/g;
  source = source.replace(quoted, (match, quote, spec) => {
    let dep;
    try { dep = new URL(spec, url); } catch { return match; }
    if (!isAstroJs(dep.href)) return match;
    dependencies.set(dep.href, true);
    return `${quote}${browserSpec(url, dep.href)}${quote}`;
  });

  const file = localFileFor(url);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, source, 'utf8');
  mirrored.push(new URL(url).pathname);

  for (const dep of dependencies.keys()) await mirrorModule(dep);
}

let html = await fs.readFile(HTML_FILE, 'utf8');
const entryUrls = new Set();
for (const match of html.matchAll(/https:\/\/chatcut\.io\/_astro\/[^"'<>\s]+?\.m?js(?:\?[^"'<>\s]*)?/g)) {
  entryUrls.add(match[0]);
}
if (!entryUrls.size) throw new Error('No ChatCut Astro runtime entry modules found in generated homepage');

for (const url of entryUrls) await mirrorModule(url);

html = html.replace(/https:\/\/chatcut\.io(\/_astro\/[^"'<>\s]+?\.m?js(?:\?[^"'<>\s]*)?)/g, (_m, pathname) => `.${pathname}`);
html = html.replace(/<\/head\s*>/i, `<meta name="cc-runtime-localized" content="${mirrored.length}"></head>`);
await fs.writeFile(HTML_FILE, html, 'utf8');

console.log(JSON.stringify({ ok: true, entryModules: entryUrls.size, mirroredModules: mirrored.length, files: mirrored.slice(0, 20) }, null, 2));
