import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://chatcut.io';
const ROOT = path.resolve('chatcut-playable');
const HTML_FILE = path.join(ROOT, 'index.html');

const seen = new Set();
const mirrored = [];

function normalize(rawUrl, base = `${ORIGIN}/`) {
  const u = new URL(rawUrl, base);
  u.hash = '';
  return u;
}

function isAstroAsset(rawUrl, base) {
  try {
    const u = normalize(rawUrl, base);
    return u.origin === ORIGIN && u.pathname.startsWith('/_astro/');
  } catch {
    return false;
  }
}

function localFileFor(rawUrl) {
  const u = normalize(rawUrl);
  return path.join(ROOT, u.pathname.replace(/^\/+/, ''));
}

function browserSpec(fromUrl, toUrl) {
  const fromPath = normalize(fromUrl).pathname;
  const toPath = normalize(toUrl, fromUrl).pathname;
  let rel = path.posix.relative(path.posix.dirname(fromPath), toPath);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

async function fetchAsset(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      'user-agent': 'Mozilla/5.0 ChatCutPlayableMirror/4.0',
      accept: '*/*',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`Asset fetch failed ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function mirrorAsset(rawUrl, base = `${ORIGIN}/`) {
  const u = normalize(rawUrl, base);
  const url = u.href;
  if (!isAstroAsset(url) || seen.has(url)) return;
  seen.add(url);

  const bytes = await fetchAsset(url);
  const pathname = u.pathname;
  const file = localFileFor(url);
  await fs.mkdir(path.dirname(file), { recursive: true });

  if (/\.m?js$/i.test(pathname)) {
    let source = bytes.toString('utf8');
    const dependencies = new Set();

    // Vite/Astro chunks use quoted module specs for static and dynamic imports.
    // Rewrite same-origin /_astro/ dependencies to relative local paths so the
    // mirror also works under a GitHub Pages subdirectory.
    const quoted = /(["'`])((?:https:\/\/chatcut\.io)?(?:\.\.?\/|\/)[^"'`\s]+?)\1/g;
    source = source.replace(quoted, (match, quote, spec) => {
      let dep;
      try { dep = normalize(spec, url); } catch { return match; }
      if (!isAstroAsset(dep.href)) return match;
      dependencies.add(dep.href);
      return `${quote}${browserSpec(url, dep.href)}${quote}`;
    });

    await fs.writeFile(file, source, 'utf8');
    mirrored.push(pathname);
    for (const dep of dependencies) await mirrorAsset(dep, url);
    return;
  }

  if (/\.css$/i.test(pathname)) {
    let source = bytes.toString('utf8');
    const dependencies = new Set();

    source = source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote, spec) => {
      const trimmed = spec.trim();
      if (!trimmed || /^data:/i.test(trimmed)) return match;
      let dep;
      try { dep = normalize(trimmed, url); } catch { return match; }
      if (!isAstroAsset(dep.href)) return match;
      dependencies.add(dep.href);
      return `url(${quote}${browserSpec(url, dep.href)}${quote})`;
    });

    await fs.writeFile(file, source, 'utf8');
    mirrored.push(pathname);
    for (const dep of dependencies) await mirrorAsset(dep, url);
    return;
  }

  await fs.writeFile(file, bytes);
  mirrored.push(pathname);
}

let html = await fs.readFile(HTML_FILE, 'utf8');
const entryUrls = new Set();
for (const match of html.matchAll(/https:\/\/chatcut\.io\/_astro\/[^"'<>\s&)]+/g)) {
  entryUrls.add(match[0]);
}
if (!entryUrls.size) throw new Error('No ChatCut /_astro/ assets found in generated homepage');

for (const url of entryUrls) await mirrorAsset(url);

// Every hashed Astro asset referenced by the frozen HTML is now local. This is
// intentionally broader than JS-only localization: CSS and font hashes can be
// rotated at the same time as JS hashes during a production deploy.
html = html.replaceAll(`${ORIGIN}/_astro/`, './_astro/');
html = html.replace(/<meta name="cc-runtime-localized"[^>]*>/i, '');
html = html.replace(/<\/head\s*>/i, `<meta name="cc-runtime-localized" content="${mirrored.length}"></head>`);
await fs.writeFile(HTML_FILE, html, 'utf8');

console.log(JSON.stringify({
  ok: true,
  entryAssets: entryUrls.size,
  mirroredAssets: mirrored.length,
  js: mirrored.filter(x => /\.m?js$/i.test(x)).length,
  css: mirrored.filter(x => /\.css$/i.test(x)).length,
  files: mirrored.slice(0, 24),
}, null, 2));
